import SallaPush
@testable import SallaPushCapacitorPlugin
import XCTest

/// JavaScript's log handler: one native registration at the level JavaScript set, and entries hopping to main.
final class LogHandlerTests: XCTestCase {
    private let native = FakeNativeSallaPush()
    private let emitter = RecordingEmitter()
    private lazy var bridge = SallaPushBridge(native: native, console: RecordingConsole(), once: OncePerProcess(),
                                              emitter: emitter) { nil }

    // MARK: - The registration

    func testRegistersNativesHandlerOnceAtWarnByDefault() {
        bridge.startEvents("log")
        bridge.startEvents("log")

        XCTAssertEqual(native.logHandlers.map(\.level), [.warn])
    }

    func testRegistersAtTheLevelJavaScriptSetFirst() {
        bridge.setLogHandlerLevel("info")
        bridge.startEvents("log")

        XCTAssertEqual(native.logHandlers.map(\.level), [.info])
    }

    func testALevelChangeReplacesNativesHandlerOnlyWhileRegistered() {
        bridge.setLogHandlerLevel("debug")
        bridge.startEvents("log")
        bridge.setLogHandlerLevel("debug")
        bridge.setLogHandlerLevel("verbose")
        bridge.setLogHandlerLevel("trace")
        bridge.stopEvents("log")
        bridge.setLogHandlerLevel("error")

        XCTAssertEqual(native.logHandlers.map(\.level), [.debug, .verbose])
        XCTAssertEqual(native.observations.map(\.isCancelled), [false, true])
    }

    // MARK: - Entries

    func testEmitsEachEntryOnTheMainThreadInOrder() throws {
        let first = Mapping.logEntry(try nativeEntry())
        var second = first
        second["code"] = "register.ok"
        bridge.startEvents("log")
        let handler = try XCTUnwrap(native.logHandlers.first?.handler)
        let queue = DispatchQueue(label: "test.native-log")

        queue.async {
            handler(first)
            handler(second)
        }
        queue.sync {}
        drainMainQueue()

        XCTAssertEqual(emitter.events.map(\.name), ["log", "log"])
        XCTAssertEqual(emitter.onMainThread, [true, true])
        XCTAssertEqual(emitter.events.map(\.body), [first as NSDictionary, second as NSDictionary])
    }

    func testEmitsNothingForAnEntryQueuedBeforeTheStop() throws {
        let entry = Mapping.logEntry(try nativeEntry())
        bridge.startEvents("log")
        let handler = try XCTUnwrap(native.logHandlers.first?.handler)

        handler(entry)
        bridge.stopEvents("log")
        drainMainQueue()

        XCTAssertTrue(emitter.events.isEmpty)
    }

    func testMapsAnEntryAsNativeLoggedIt() throws {
        let entry = try nativeEntry()

        let body = Mapping.logEntry(entry) as NSDictionary

        XCTAssertEqual(body["level"] as? String, "verbose")
        XCTAssertEqual(body["category"] as? String, entry.category)
        XCTAssertEqual(body["code"] as? String, "notif.foreign")
        XCTAssertEqual(body["message"] as? String, entry.message)
        XCTAssertEqual(body["metadata"] as? [String: String], entry.metadata)
        let timestamp = try XCTUnwrap(body["timestamp"] as? Double)
        XCTAssertEqual(timestamp, (entry.date.timeIntervalSince1970 * 1000).rounded(.down))
        XCTAssertTrue(JSONSerialization.isValidJSONObject(body))
    }

    // MARK: - The live seam

    func testTheLiveHandlerGetsNativesEntriesInBridgeForm() throws {
        var bodies: [[String: Any]] = []
        let logged = expectation(description: "native logs notif.foreign")
        logged.assertForOverFulfill = false
        let registration = LiveNativeSallaPush().setLogHandler(level: .verbose) { body in
            guard body["code"] as? String == "notif.foreign" else { return }
            DispatchQueue.main.async {
                bodies.append(body)
                logged.fulfill()
            }
        }
        defer { registration.cancel() }

        SallaPush.Notifications.didReceiveRemoteNotification(TestNotifications.foreign)

        wait(for: [logged], timeout: 5)
        let body = try XCTUnwrap(bodies.first)
        XCTAssertEqual(body["level"] as? String, "verbose")
        XCTAssertNotNil(body["timestamp"] as? Double)
    }

    func testCancellingTheLiveRegistrationRemovesNativesHandler() {
        let logged = expectation(description: "no entry reaches a cancelled handler")
        logged.isInverted = true
        LiveNativeSallaPush().setLogHandler(level: .verbose) { body in
            if body["code"] as? String == "notif.foreign" { logged.fulfill() }
        }.cancel()

        SallaPush.Notifications.didReceiveRemoteNotification(TestNotifications.foreign)

        wait(for: [logged], timeout: 0.5)
    }

    // MARK: - Helpers

    /// A real entry from native's logger: a foreign payload logs notif.foreign at verbose. Native's own handler API is
    /// public, so no testable import of SallaPush is needed.
    private func nativeEntry() throws -> SallaPushLogEntry {
        let entries = Entries()
        let logged = expectation(description: "native logs notif.foreign")
        logged.assertForOverFulfill = false
        SallaPush.Debug.setLogHandler(level: .verbose) { entry in
            guard entry.code == "notif.foreign" else { return }
            DispatchQueue.main.async {
                entries.values.append(entry)
                logged.fulfill()
            }
        }
        defer { SallaPush.Debug.setLogHandler(level: .warn, nil) }

        SallaPush.Notifications.didReceiveRemoteNotification(TestNotifications.foreign)

        wait(for: [logged], timeout: 5)
        return try XCTUnwrap(entries.values.first)
    }

    private func drainMainQueue() {
        let drained = expectation(description: "the main queue ran what was queued before")
        DispatchQueue.main.async { drained.fulfill() }
        wait(for: [drained], timeout: 5)
    }
}

/// The entries native's handler got: it runs on native's queue and appends them on the main thread only.
private final class Entries: @unchecked Sendable {
    var values: [SallaPushLogEntry] = []
}
