import SallaPush
@testable import SallaPushCapacitorPlugin
import XCTest

/// The registry over the fake native, whose listeners get bridge-form values as the live seam hands them over.
final class EventRegistryTests: XCTestCase {
    private let native = FakeNativeSallaPush()
    private let emitter = RecordingEmitter()
    private let console = RecordingConsole()
    private lazy var displays = DisplayStore(console: console)
    private lazy var registry = EventRegistry(native: native, displays: displays, emitter: emitter)

    // MARK: - Registrations

    func testStartsOneNativeRegistrationPerKindOnce() {
        for kind in [EventRegistry.Kind.click, .permission, .user, .loginFailure] {
            registry.start(kind)
            registry.start(kind)
        }

        XCTAssertEqual(native.calls, [
            "addClickListener", "addPermissionObserver", "addUserObserver", "addLoginFailureHandler"
        ])
    }

    func testStopCancelsTheObservationItsStartKept() {
        registry.start(.click)
        registry.start(.user)

        registry.stop(.click)
        registry.stop(.click)
        registry.stop(.permission)

        XCTAssertEqual(native.observations.map(\.isCancelled), [true, false])
    }

    func testStartsAgainAfterAStop() {
        registry.start(.permission)
        registry.stop(.permission)
        registry.start(.permission)

        XCTAssertEqual(native.calls, ["addPermissionObserver", "addPermissionObserver"])
        XCTAssertEqual(native.observations.map(\.isCancelled), [true, false])
    }

    func testAddsOneSubscriptionObserverPerListenerAndRemovesOnlyItsOwn() {
        registry.addSubscriptionListener(1)
        registry.addSubscriptionListener(1)
        registry.addSubscriptionListener(2)
        registry.removeSubscriptionListener(1)
        registry.removeSubscriptionListener(1)
        registry.removeSubscriptionListener(3)

        XCTAssertEqual(native.calls, ["addSubscriptionObserver", "addSubscriptionObserver"])
        XCTAssertEqual(native.observations.map(\.isCancelled), [true, false])
    }

    func testStopAllCancelsEveryRegistration() {
        registry.start(.click)
        registry.start(.loginFailure)
        registry.addSubscriptionListener(1)
        registry.addSubscriptionListener(2)

        registry.stopAll()
        registry.start(.click)

        XCTAssertEqual(native.observations.map(\.isCancelled), [true, true, true, true, false])
    }

    // MARK: - Emitted events

    func testEmitsPermissionChanges() {
        registry.start(.permission)

        native.permissionHandlers.first?(true)
        native.permissionHandlers.first?(false)

        XCTAssertEqual(emitter.events.map(\.name), ["permissionChange", "permissionChange"])
        XCTAssertEqual(emitter.events.map(\.body), [["permission": true], ["permission": false]])
    }

    func testEmitsLoginFailuresByCase() {
        registry.start(.loginFailure)

        native.loginFailureHandlers.first?(Mapping.loginFailure(.tokenRejected))
        native.loginFailureHandlers.first?(Mapping.loginFailure(.invalidRequest))

        XCTAssertEqual(emitter.events.map(\.name), ["loginFailure", "loginFailure"])
        XCTAssertEqual(emitter.events.map(\.body), [["failure": "tokenRejected"], ["failure": "invalidRequest"]])
    }

    func testEmitsUserChanges() {
        registry.start(.user)

        native.userHandlers.first?(userChange)

        XCTAssertEqual(emitter.events.map(\.name), ["userChange"])
        XCTAssertEqual(emitter.events.first?.body, userChange as NSDictionary)
    }

    func testEmitsEachSubscriptionChangeWithTheIdOfItsListener() {
        registry.addSubscriptionListener(1)
        registry.addSubscriptionListener(2)

        native.subscriptionHandlers.last?(subscriptionChange)

        XCTAssertEqual(emitter.events.map(\.name), ["pushSubscriptionChange"])
        XCTAssertEqual(emitter.events.first?.body, [
            "listenerId": 2,
            "previous": ["optedIn": false],
            "current": ["id": "3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40", "token": "a1b2c3", "optedIn": true] as [String: Any]
        ])
    }

    func testEmitsClicksWithTheirNotification() throws {
        let notification = try XCTUnwrap(SallaPush.Notifications.parse(TestNotifications.payload("native")))
        let click: [String: Any] = [
            "notification": Mapping.notification(notification), "actionId": "reply", "url": "https://example.com/products/42"
        ]
        registry.start(.click)

        native.clickHandlers.first?(click)

        XCTAssertEqual(emitter.events.map(\.name), ["click"])
        XCTAssertEqual(emitter.events.first?.body, click as NSDictionary)
        XCTAssertEqual(emitter.onMainThread, [true])
    }

    func testEmitsNothingForAnEventNativeDeliversAfterTheStop() {
        registry.start(.user)
        registry.addSubscriptionListener(1)
        let userHandler = native.userHandlers.first
        let subscriptionHandler = native.subscriptionHandlers.first

        registry.stop(.user)
        registry.removeSubscriptionListener(1)
        userHandler?(userChange)
        subscriptionHandler?(subscriptionChange)

        XCTAssertTrue(emitter.events.isEmpty)
    }

    func testHoldsTheEmitterWeakly() {
        weak var released: RecordingEmitter?
        let registry: EventRegistry = {
            let emitter = RecordingEmitter()
            released = emitter
            return EventRegistry(native: native, displays: displays, emitter: emitter)
        }()
        registry.start(.permission)

        withExtendedLifetime(registry) {
            native.permissionHandlers.first?(true)
        }

        XCTAssertNil(released)
    }

    // MARK: - The bridge

    func testTheBridgeRoutesEventCallsAndIgnoresUnknownKinds() {
        let bridge = makeBridge()

        bridge.startEvents("click")
        bridge.startEvents("opened")
        bridge.startEvents("Click")
        bridge.addPushSubscriptionListener(7)
        bridge.stopEvents("click")
        bridge.stopEvents("opened")
        bridge.removePushSubscriptionListener(7)

        XCTAssertEqual(native.calls, ["addClickListener", "addSubscriptionObserver"])
        XCTAssertEqual(native.observations.map(\.isCancelled), [true, true])
    }

    func testTheBridgeStopsEveryRegistrationWhenReset() {
        let bridge = makeBridge()
        bridge.startEvents("user")
        bridge.startEvents("permission")
        bridge.addPushSubscriptionListener(1)

        bridge.reset()

        XCTAssertEqual(native.observations.map(\.isCancelled), [true, true, true])
    }

    // MARK: - The live seam

    // Native keeps taps made without a click listener (earlier tests' taps included) and hands them over at once, so
    // the listener looks for its own tap by a marker.
    func testTheLiveClickListenerGetsARealTapInBridgeForm() throws {
        let marker = UUID().uuidString
        var payload = try TestNotifications.payload("native")
        payload["marker"] = marker
        var bodies: [[String: Any]] = []
        let delivered = expectation(description: "the tap reaches the live click listener")
        let observation = LiveNativeSallaPush().addClickListener { body in
            let notification = body["notification"] as? [String: Any]
            guard (notification?["stringValues"] as? [String: String])?["marker"] == marker else { return }
            bodies.append(body)
            delivered.fulfill()
        }
        defer { observation.cancel() }

        XCTAssertTrue(SallaPush.Notifications.didReceive(try TestNotifications.response(userInfo: payload)))

        wait(for: [delivered], timeout: 5)
        let body = try XCTUnwrap(bodies.first)
        let notification = try XCTUnwrap(SallaPush.Notifications.parse(payload))
        XCTAssertEqual(Set(body.keys), ["notification", "url"])
        XCTAssertEqual(body["url"] as? String, "https://example.com/products/42")
        XCTAssertEqual(body["notification"] as? NSDictionary, Mapping.notification(notification) as NSDictionary)
    }

    // MARK: - Helpers

    private var userChange: [String: Any] {
        ["previous": ["isLoggedIn": false], "current": ["externalId": "customer-7", "isLoggedIn": true] as [String: Any]]
    }

    private var subscriptionChange: [String: Any] {
        [
            "previous": ["optedIn": false],
            "current": ["id": "3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40", "token": "a1b2c3", "optedIn": true] as [String: Any]
        ]
    }

    private func makeBridge() -> SallaPushBridge {
        SallaPushBridge(native: native, console: RecordingConsole(), once: OncePerProcess(), emitter: emitter) { nil }
    }
}
