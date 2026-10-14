@testable import SallaPushCapacitorPlugin
import XCTest

/// The held foreground notifications, each a closure that shows the very notification native offered.
final class DisplayStoreTests: XCTestCase {
    private let console = RecordingConsole()
    private var now = Date(timeIntervalSince1970: 1_800_000_000)
    private lazy var store = DisplayStore(console: console) { [unowned self] in now }
    private var shown: [Int] = []
    private let refused = "SallaPushNotification.display() did nothing: a prevented notification is shown once, within "
        + "10 minutes of its foregroundWillDisplay event."

    func testHoldsEachNotificationUnderANewRandomHandle() {
        let first = store.put { self.shown.append(1) }
        let second = store.put { self.shown.append(2) }

        XCTAssertNotEqual(first, second)
        XCTAssertNotNil(UUID(uuidString: first))
    }

    func testShowsTheNotificationItHeldOnce() {
        let first = store.put { self.shown.append(1) }
        let second = store.put { self.shown.append(2) }

        XCTAssertTrue(store.display(second))
        XCTAssertFalse(store.display(second))
        XCTAssertTrue(store.display(first))

        XCTAssertEqual(shown, [2, 1])
        XCTAssertEqual(console.warnings, [refused])
    }

    func testAnUnknownHandleShowsNothing() {
        _ = store.put { self.shown.append(1) }

        XCTAssertFalse(store.display("8d1e3d0a-1a1b-4c63-9d38-4c2b2b7e5f10"))

        XCTAssertEqual(shown, [])
        XCTAssertEqual(console.warnings, [refused])
    }

    func testShowsWithinNativesTenMinuteWindowOnly() {
        let onTime = store.put { self.shown.append(1) }
        now += 600
        XCTAssertTrue(store.display(onTime))

        let late = store.put { self.shown.append(2) }
        now += 600.5
        XCTAssertFalse(store.display(late))

        XCTAssertEqual(shown, [1])
    }

    func testKeepsNativesTwentyRecordsDroppingTheOldestFirst() {
        let handles = (0...DisplayStore.capacity).map { index in store.put { self.shown.append(index) } }

        XCTAssertFalse(store.display(handles[0]))
        for handle in handles.dropFirst() {
            XCTAssertTrue(store.display(handle))
        }
        XCTAssertEqual(shown, Array(1...20))
    }

    func testClearForgetsEveryNotification() {
        let handle = store.put { self.shown.append(1) }

        store.clear()

        XCTAssertFalse(store.display(handle))
        XCTAssertEqual(shown, [])
    }
}
