@testable import SallaPushCapacitorPlugin
import UserNotifications
import XCTest

final class NotificationsBridgeTests: XCTestCase {
    private let native = FakeNativeSallaPush()
    private let console = RecordingConsole()
    private let once = OncePerProcess()
    private let emitter = RecordingEmitter()

    func testReadsThePermissionAtCallTime() {
        let bridge = makeBridge()
        XCTAssertFalse(bridge.permission)
        XCTAssertFalse(bridge.canRequestPermission)

        native.permission = true
        native.canRequestPermission = true

        XCTAssertTrue(bridge.permission)
        XCTAssertTrue(bridge.canRequestPermission)
    }

    func testNamesEveryAuthorizationStatusAsJavaScriptDoes() throws {
        let newer = try XCTUnwrap(UNAuthorizationStatus(rawValue: 99))
        let statuses: [(UNAuthorizationStatus, String)] = [
            (.notDetermined, "notDetermined"), (.denied, "denied"), (.authorized, "authorized"),
            (.provisional, "provisional"), (.ephemeral, "ephemeral"), (newer, "notDetermined")
        ]
        let bridge = makeBridge()

        for (status, name) in statuses {
            native.permissionStatus = status
            XCTAssertEqual(bridge.permissionStatus, name)
        }
    }

    func testRequestsThePermissionAndCompletesWithNativesAnswer() {
        native.permissionAnswer = true
        var answers: [Bool] = []
        let bridge = makeBridge()

        bridge.requestPermission(fallbackToSettings: true) { answers.append($0) }
        bridge.requestPermission(fallbackToSettings: false) { answers.append($0) }
        bridge.registerForProvisionalAuthorization { answers.append($0) }

        XCTAssertEqual(native.calls, [
            "requestPermission(true)", "requestPermission(false)", "registerForProvisionalAuthorization()"
        ])
        XCTAssertEqual(answers, [true, true, true])
    }

    func testPassesRefreshRegisterAndClearAll() {
        let bridge = makeBridge()

        bridge.refreshPermission()
        bridge.registerForRemoteNotifications()
        bridge.clearAll()

        XCTAssertEqual(native.calls, ["refreshPermission()", "registerForRemoteNotifications()", "clearAll()"])
    }

    func testForwardsAHexadecimalAPNsTokenInEitherCaseAsData() {
        let bridge = makeBridge()

        bridge.forwardApnsToken("0a1bff7c")
        bridge.forwardApnsToken("0A1BFF7C")

        XCTAssertEqual(native.deviceTokens, [Data([0x0A, 0x1B, 0xFF, 0x7C]), Data([0x0A, 0x1B, 0xFF, 0x7C])])
        XCTAssertEqual(console.errors, [])
    }

    func testIgnoresATokenThatIsNotHexadecimalTextOfEvenLength() {
        let bridge = makeBridge()

        for token in ["", "0a1", "0g", "0x1f", " 0a1b", "0a1b\n"] {
            bridge.forwardApnsToken(token)
        }

        XCTAssertEqual(native.deviceTokens, [])
        XCTAssertEqual(console.errors, Array(repeating: "Notifications.forwardApnsToken ignored: the APNs token must be "
            + "hexadecimal text of even length, as @capacitor-firebase/messaging's apnsTokenReceived event gives it.",
            count: 6))
    }

    func testDropsNullValuesBeforeNativeChecksAPayload() {
        native.recognizesPayloads = true

        let recognized = makeBridge().isSallaPushNotification(["sp_v": "1", "sp_url": NSNull(), "count": 3])

        XCTAssertTrue(recognized)
        XCTAssertEqual(native.checkedPayloads.map { NSDictionary(dictionary: $0) }, [["sp_v": "1", "count": 3]])
    }

    func testNativeRecognizesTheTestPayloadsThroughTheLiveSeam() throws {
        let live = LiveNativeSallaPush()

        XCTAssertTrue(live.isSallaPushNotification(try TestNotifications.payload("native")))
        XCTAssertTrue(live.isSallaPushNotification(try TestNotifications.payload("compat")))
        XCTAssertFalse(live.isSallaPushNotification(TestNotifications.foreign))
    }

    func testAndroidOnlyCallsDoNothingAndSayItOncePerProcess() {
        let bridge = makeBridge()

        bridge.removeNotification()
        bridge.removeNotification()
        XCTAssertFalse(bridge.trackOpened())
        XCTAssertFalse(makeBridge().trackOpened())

        XCTAssertEqual(native.calls, [])
        XCTAssertEqual(console.infos, [
            "Notifications.removeNotification is Android only and does nothing on iOS.",
            "Notifications.trackOpened is Android only and resolves false on iOS, where taps on OneSignal-format "
                + "SallaPush notifications reach SallaPush through its notification-center delegate."
        ])
    }

    private func makeBridge() -> SallaPushBridge {
        SallaPushBridge(native: native, console: console, once: once, emitter: emitter) { nil }
    }
}
