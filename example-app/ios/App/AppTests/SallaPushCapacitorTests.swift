@testable import SallaPushCapacitorPlugin
import XCTest

final class SallaPushCapacitorTests: XCTestCase {
    private let native = FakeNativeSallaPush()
    private let console = RecordingConsole()

    func testStartsSallaPushOnceWithTheStaticConfiguration() {
        let start = makeStart(info: [
            "SallaPushAppId": "st_42_ios",
            "SallaPushOpenLaunchURLs": true,
            "SallaPushAPNsEnvironment": "sandbox"
        ])

        start.startOnce()
        start.startOnce()

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertEqual(native.configurations.first?.openLaunchURLs, true)
        XCTAssertEqual(native.configurations.first?.apnsEnvironment, .sandbox)
        XCTAssertEqual(start.earlyInit, StaticConfig(appId: "st_42_ios", openLaunchURLs: true, apnsEnvironment: .sandbox))
    }

    func testStartsNothingWithoutAnAppId() {
        let start = makeStart(info: ["SallaPushRequiresUserConsent": true])

        start.startOnce()

        XCTAssertEqual(native.initializedAppIds, [])
        XCTAssertNil(start.earlyInit)
    }

    func testStartsNothingWhenTheAppIdBuildSettingIsUnset() {
        let start = makeStart(info: ["SallaPushAppId": ""])

        start.startOnce()

        XCTAssertEqual(native.initializedAppIds, [])
        XCTAssertNil(start.earlyInit)
        XCTAssertEqual(console.errors, [])
    }

    func testReportsIgnoredKeysOnceAndStillStarts() {
        let start = makeStart(info: ["SallaPushAppId": "st_42_ios", "SallaPushAutoClearBadge": "sometimes"])

        start.startOnce()
        start.startOnce()

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertEqual(native.configurations.first?.autoClearBadge, true)
        XCTAssertEqual(console.errors, ["Ignored SallaPushAutoClearBadge: \"sometimes\" is not true, false, YES, NO, 1 or 0."])
    }

    func testAPluginLoadStartsSallaPushWhenTheAppDidNotStartIt() {
        let start = makeStart(info: ["SallaPushAppId": "st_42_ios", "SallaPushRequiresUserConsent": "YES"])

        start.pluginLoaded()
        start.pluginLoaded()

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertEqual(native.configurations.first?.requiresUserConsent, true)
        XCTAssertEqual(start.earlyInit, StaticConfig(appId: "st_42_ios", requiresUserConsent: true))
    }

    func testAPluginLoadAfterTheStartStartsNothingMore() {
        let start = makeStart(info: ["SallaPushAppId": "st_42_ios"])

        start.startOnce()
        start.pluginLoaded()

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertEqual(console.errors, [])
    }

    private func makeStart(info: [String: Any]) -> SallaPushCapacitor {
        SallaPushCapacitor(native: native, info: info, console: console)
    }
}
