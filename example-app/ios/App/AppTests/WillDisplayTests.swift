import SallaPush
@testable import SallaPushCapacitorPlugin
import UserNotifications
import XCTest

/// The foreground decision: the registry prevents and holds each notification native offers, and JavaScript shows it
/// through its handle.
final class WillDisplayTests: XCTestCase {
    private let native = FakeNativeSallaPush()
    private let emitter = RecordingEmitter()
    private let console = RecordingConsole()
    private lazy var bridge = SallaPushBridge(native: native, console: console, once: OncePerProcess(), emitter: emitter) {
        nil
    }

    func testRegistersOneForegroundListenerAndRemovesIt() {
        bridge.startEvents("willDisplay")
        bridge.startEvents("willDisplay")
        bridge.stopEvents("willDisplay")

        XCTAssertEqual(native.calls, ["addForegroundLifecycleListener"])
        XCTAssertEqual(native.observations.map(\.isCancelled), [true])
    }

    func testPreventsHoldsAndEmitsEachForegroundNotification() throws {
        let first = FakeWillDisplay("msg_5a11a90001")
        let second = FakeWillDisplay("msg_5a11a90002")
        bridge.startEvents("willDisplay")

        native.willDisplayHandlers.first?(first.event)
        native.willDisplayHandlers.first?(second.event)

        XCTAssertTrue(first.isPrevented)
        XCTAssertTrue(second.isPrevented)
        XCTAssertEqual(emitter.events.map(\.name), ["willDisplay", "willDisplay"])
        let handles = try emitter.events.map { try XCTUnwrap($0.body["handle"] as? String) }
        XCTAssertEqual(Set(handles).count, 2)
        XCTAssertNotNil(UUID(uuidString: handles[0]))
        XCTAssertEqual(emitter.events.map { $0.body["notification"] as? NSDictionary },
                       [first.notification as NSDictionary, second.notification as NSDictionary])
        XCTAssertEqual(first.displays + second.displays, 0)
    }

    func testShowsTheHeldNotificationOnceThroughItsHandle() throws {
        let first = FakeWillDisplay("msg_5a11a90001")
        let second = FakeWillDisplay("msg_5a11a90002")
        bridge.startEvents("willDisplay")
        native.willDisplayHandlers.first?(first.event)
        native.willDisplayHandlers.first?(second.event)
        let handle = try XCTUnwrap(emitter.events.last?.body["handle"] as? String)

        bridge.displayNotification(handle)
        bridge.displayNotification(handle)

        XCTAssertEqual(first.displays, 0)
        XCTAssertEqual(second.displays, 1)
        XCTAssertEqual(console.warnings.count, 1)
    }

    func testLeavesTheNotificationToNativeOnceStopped() {
        bridge.startEvents("willDisplay")
        let handler = native.willDisplayHandlers.first
        bridge.stopEvents("willDisplay")
        let notification = FakeWillDisplay()

        handler?(notification.event)

        XCTAssertFalse(notification.isPrevented)
        XCTAssertTrue(emitter.events.isEmpty)
    }

    func testForgetsTheHeldNotificationsWhenReset() throws {
        let notification = FakeWillDisplay()
        bridge.startEvents("willDisplay")
        native.willDisplayHandlers.first?(notification.event)
        let handle = try XCTUnwrap(emitter.events.first?.body["handle"] as? String)

        bridge.reset()
        bridge.displayNotification(handle)

        XCTAssertEqual(notification.displays, 0)
        XCTAssertEqual(native.observations.map(\.isCancelled), [true])
    }

    // MARK: - The live seam

    func testTheLiveForegroundListenerDecidesInsideWillPresentWithTheBridgeForm() throws {
        let payload = try TestNotifications.payload("native")
        var bodies: [[String: Any]] = []
        let observation = LiveNativeSallaPush().addForegroundLifecycleListener { event in
            bodies.append(event.notification)
            event.preventDefault()
        }
        defer { observation.cancel() }

        let options = SallaPush.Notifications.willPresent(try TestNotifications.notification(userInfo: payload))

        XCTAssertEqual(options, [])
        XCTAssertEqual(bodies.count, 1)
        let parsed = try XCTUnwrap(SallaPush.Notifications.parse(payload))
        XCTAssertEqual(bodies.first as NSDictionary?, Mapping.notification(parsed) as NSDictionary)
    }
}
