import SallaPush
@testable import SallaPushCapacitorPlugin
import XCTest

final class StaticConfigTests: XCTestCase {
    private typealias Key = StaticConfig.Key

    private let console = RecordingConsole()

    func testReadsEveryKeyFromPlistValues() {
        let config = StaticConfig(info: [
            Key.appId: "st_42_ios",
            Key.openLaunchURLs: true,
            Key.requiresUserConsent: true,
            Key.clearTagsOnLogout: false,
            Key.appVersion: "2.1.0",
            Key.autoClearBadge: false,
            Key.autoUpdateBadge: false,
            Key.registerForRemoteNotificationsOnInit: false,
            Key.apnsEnvironment: "sandbox"
        ], console: console)

        XCTAssertEqual(config, StaticConfig(
            appId: "st_42_ios",
            openLaunchURLs: true,
            requiresUserConsent: true,
            clearTagsOnLogout: false,
            appVersion: "2.1.0",
            autoClearBadge: false,
            autoUpdateBadge: false,
            registerForRemoteNotificationsOnInit: false,
            apnsEnvironment: .sandbox
        ))
        XCTAssertEqual(console.errors, [])
    }

    func testReadsBooleansThatComeThroughBuildSettings() {
        let config = StaticConfig(info: [
            Key.openLaunchURLs: "YES",
            Key.requiresUserConsent: "true",
            Key.clearTagsOnLogout: "NO",
            Key.autoClearBadge: " 0 ",
            Key.autoUpdateBadge: "No",
            Key.registerForRemoteNotificationsOnInit: "1"
        ], console: console)

        XCTAssertEqual(config, StaticConfig(
            openLaunchURLs: true,
            requiresUserConsent: true,
            clearTagsOnLogout: false,
            autoClearBadge: false,
            autoUpdateBadge: false,
            registerForRemoteNotificationsOnInit: true
        ))
        XCTAssertEqual(console.errors, [])
    }

    func testReadsBooleanStringsInAnyCase() {
        let config = StaticConfig(info: [Key.openLaunchURLs: "yEs", Key.requiresUserConsent: "False"], console: console)

        XCTAssertEqual(config.openLaunchURLs, true)
        XCTAssertEqual(config.requiresUserConsent, false)
    }

    func testTreatsEmptyValuesFromUnsetBuildSettingsAsAbsent() {
        let config = StaticConfig(info: [
            Key.appId: "",
            Key.openLaunchURLs: "",
            Key.appVersion: "   ",
            Key.apnsEnvironment: ""
        ], console: console)

        XCTAssertEqual(config, StaticConfig())
        XCTAssertEqual(console.errors, [])
    }

    func testTrimsStrings() {
        let config = StaticConfig(info: [Key.appId: "  st_42_ios\n", Key.appVersion: " 2.1.0 "], console: console)

        XCTAssertEqual(config.appId, "st_42_ios")
        XCTAssertEqual(config.appVersion, "2.1.0")
    }

    func testLeavesEveryOptionUnsetWithoutKeys() {
        XCTAssertEqual(StaticConfig(info: [:], console: console), StaticConfig())
        XCTAssertEqual(StaticConfig(info: ["CFBundleName": "SallaPushExample"], console: console), StaticConfig())
        XCTAssertEqual(console.errors, [])
    }

    func testIgnoresAStringThatIsNotABooleanWithOneConsoleLine() {
        let config = StaticConfig(info: [Key.appId: "st_42_ios", Key.requiresUserConsent: "maybe"], console: console)

        XCTAssertNil(config.requiresUserConsent)
        XCTAssertEqual(config.appId, "st_42_ios")
        XCTAssertEqual(console.errors, ["Ignored SallaPushRequiresUserConsent: \"maybe\" is not true, false, YES, NO, 1 or 0."])
    }

    func testIgnoresAnAutoUpdateBadgeThatIsNotABooleanWithOneConsoleLine() {
        let config = StaticConfig(info: [Key.appId: "st_42_ios", Key.autoUpdateBadge: "never"], console: console)

        XCTAssertNil(config.autoUpdateBadge)
        XCTAssertEqual(console.errors, ["Ignored SallaPushAutoUpdateBadge: \"never\" is not true, false, YES, NO, 1 or 0."])
    }

    func testIgnoresANumberForABooleanKey() {
        let config = StaticConfig(info: [Key.openLaunchURLs: NSNumber(value: 1)], console: console)

        XCTAssertNil(config.openLaunchURLs)
        XCTAssertEqual(console.errors.count, 1)
        XCTAssertTrue(console.errors[0].hasPrefix("Ignored SallaPushOpenLaunchURLs: "))
    }

    func testIgnoresAStringKeyOfAnotherType() {
        let config = StaticConfig(info: [Key.appId: 42, Key.appVersion: true], console: console)

        XCTAssertEqual(config, StaticConfig())
        XCTAssertEqual(console.errors, [
            "Ignored SallaPushAppId: it must be a String.",
            "Ignored SallaPushAppVersion: it must be a String."
        ])
    }

    func testReadsTheAPNsEnvironmentInAnyCase() {
        XCTAssertEqual(StaticConfig(info: [Key.apnsEnvironment: "automatic"], console: console).apnsEnvironment, .automatic)
        XCTAssertEqual(StaticConfig(info: [Key.apnsEnvironment: "Sandbox"], console: console).apnsEnvironment, .sandbox)
        XCTAssertEqual(StaticConfig(info: [Key.apnsEnvironment: "PRODUCTION"], console: console).apnsEnvironment, .production)
        XCTAssertEqual(console.errors, [])
    }

    func testIgnoresAnUnknownAPNsEnvironmentWithOneConsoleLine() {
        let config = StaticConfig(info: [Key.apnsEnvironment: "staging"], console: console)

        XCTAssertNil(config.apnsEnvironment)
        XCTAssertEqual(console.errors, ["Ignored SallaPushAPNsEnvironment: \"staging\" is not automatic, sandbox or production."])
    }

    func testBuildsTheNativeConfigurationWithTheGivenOptionsOnly() {
        let configuration = StaticConfig(openLaunchURLs: true, autoClearBadge: false).configuration()
        let defaults = SallaPushConfiguration()

        XCTAssertTrue(configuration.openLaunchURLs)
        XCTAssertFalse(configuration.autoClearBadge)
        XCTAssertEqual(configuration.autoUpdateBadge, defaults.autoUpdateBadge)
        XCTAssertEqual(configuration.requiresUserConsent, defaults.requiresUserConsent)
        XCTAssertEqual(configuration.clearTagsOnLogout, defaults.clearTagsOnLogout)
        XCTAssertEqual(configuration.registerForRemoteNotificationsOnInit, defaults.registerForRemoteNotificationsOnInit)
        XCTAssertEqual(configuration.apnsEnvironment, defaults.apnsEnvironment)
        XCTAssertEqual(configuration.logLevel, defaults.logLevel)
        XCTAssertNil(configuration.appVersion)
        XCTAssertNil(configuration.appGroupIdentifier)
    }

    func testPassesEveryOptionToTheNativeConfiguration() {
        let configuration = StaticConfig(
            appId: "st_42_ios",
            openLaunchURLs: false,
            requiresUserConsent: true,
            clearTagsOnLogout: false,
            appVersion: "2.1.0",
            autoClearBadge: false,
            autoUpdateBadge: false,
            registerForRemoteNotificationsOnInit: false,
            apnsEnvironment: .production
        ).configuration()

        XCTAssertFalse(configuration.openLaunchURLs)
        XCTAssertTrue(configuration.requiresUserConsent)
        XCTAssertFalse(configuration.clearTagsOnLogout)
        XCTAssertEqual(configuration.appVersion, "2.1.0")
        XCTAssertFalse(configuration.autoClearBadge)
        XCTAssertFalse(configuration.autoUpdateBadge)
        XCTAssertFalse(configuration.registerForRemoteNotificationsOnInit)
        XCTAssertEqual(configuration.apnsEnvironment, .production)
    }
}
