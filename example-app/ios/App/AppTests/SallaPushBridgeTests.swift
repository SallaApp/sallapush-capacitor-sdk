import SallaPush
@testable import SallaPushCapacitorPlugin
import XCTest

final class SallaPushBridgeTests: XCTestCase {
    private let native = FakeNativeSallaPush()
    private let console = RecordingConsole()
    private let once = OncePerProcess()
    private let emitter = RecordingEmitter()

    // MARK: - initialize

    func testInitializesWithTheAppIdAndEveryOption() throws {
        makeBridge().initialize(appId: "st_42_ios", options: [
            "apiBaseUrl": "https://push.example.com/notifications/v1/sallapush",
            "logLevel": "debug",
            "appVersion": "2.1.0",
            "clearTagsOnLogout": false,
            "requiresUserConsent": true,
            "openLaunchUrls": true,
            "autoClearBadge": false,
            "autoUpdateBadge": false,
            "iosAppGroupIdentifier": "group.sa.salla.example",
            "iosApnsEnvironment": "sandbox",
            "iosAutoClearBadge": true,
            "iosRegisterForRemoteNotificationsOnInit": false
        ])

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        let configuration = try XCTUnwrap(native.configurations.first)
        XCTAssertEqual(configuration.apiBaseURL, URL(string: "https://push.example.com/notifications/v1/sallapush"))
        XCTAssertEqual(configuration.logLevel, .debug)
        XCTAssertEqual(configuration.appVersion, "2.1.0")
        XCTAssertFalse(configuration.clearTagsOnLogout)
        XCTAssertTrue(configuration.requiresUserConsent)
        XCTAssertTrue(configuration.openLaunchURLs)
        XCTAssertEqual(configuration.appGroupIdentifier, "group.sa.salla.example")
        XCTAssertEqual(configuration.apnsEnvironment, .sandbox)
        XCTAssertFalse(configuration.autoClearBadge, "autoClearBadge wins over the deprecated ios.autoClearBadge")
        XCTAssertFalse(configuration.autoUpdateBadge)
        XCTAssertFalse(configuration.registerForRemoteNotificationsOnInit)
        XCTAssertEqual(console.errors, [])
    }

    func testInitializesWithNativeDefaultsForLeftOutOptions() throws {
        makeBridge().initialize(appId: "st_42_ios", options: [:])

        let configuration = try XCTUnwrap(native.configurations.first)
        let defaults = SallaPushConfiguration()
        XCTAssertNil(configuration.apiBaseURL)
        XCTAssertEqual(configuration.logLevel, defaults.logLevel)
        XCTAssertNil(configuration.appVersion)
        XCTAssertEqual(configuration.clearTagsOnLogout, defaults.clearTagsOnLogout)
        XCTAssertEqual(configuration.requiresUserConsent, defaults.requiresUserConsent)
        XCTAssertEqual(configuration.openLaunchURLs, defaults.openLaunchURLs)
        XCTAssertNil(configuration.appGroupIdentifier)
        XCTAssertEqual(configuration.apnsEnvironment, defaults.apnsEnvironment)
        XCTAssertEqual(configuration.autoClearBadge, defaults.autoClearBadge)
        XCTAssertEqual(configuration.autoUpdateBadge, defaults.autoUpdateBadge)
        XCTAssertEqual(configuration.registerForRemoteNotificationsOnInit, defaults.registerForRemoteNotificationsOnInit)
    }

    // MARK: - The early-init console errors

    func testReportsTheOptionsASecondInitializeWithTheStaticAppIdIgnores() {
        let bridge = makeBridge(earlyInit: StaticConfig(appId: "st_42_ios"))

        bridge.initialize(appId: "st_42_ios", options: [
            "logLevel": "debug", "openLaunchUrls": true, "iosAutoClearBadge": false
        ])

        XCTAssertEqual(console.errors, [
            "initialize ignored logLevel, openLaunchUrls, ios.autoClearBadge: SallaPush already started with this app "
                + "id from SallaPushAppId, so the call changes nothing. Set them with the Info.plist keys "
                + "SallaPushLogLevel, SallaPushOpenLaunchURLs, SallaPushAutoClearBadge instead."
        ])
        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
    }

    func testNamesTheStaticKeyOfEveryIgnoredOption() {
        let bridge = makeBridge(earlyInit: StaticConfig(appId: "st_42_ios"))

        bridge.initialize(appId: "st_42_ios", options: [
            "logLevel": "warn",
            "appVersion": "2.1.0",
            "clearTagsOnLogout": true,
            "requiresUserConsent": true,
            "openLaunchUrls": false,
            "autoClearBadge": true,
            "autoUpdateBadge": true,
            "iosAppGroupIdentifier": "group.sa.salla.example",
            "iosApnsEnvironment": "production",
            "iosAutoClearBadge": true,
            "iosRegisterForRemoteNotificationsOnInit": true
        ])

        // ios.autoClearBadge isn't named beside autoClearBadge, which wins over it.
        XCTAssertEqual(console.errors, [
            "initialize ignored logLevel, appVersion, clearTagsOnLogout, requiresUserConsent, openLaunchUrls, "
                + "autoClearBadge, autoUpdateBadge, ios.appGroupIdentifier, ios.apnsEnvironment, "
                + "ios.registerForRemoteNotificationsOnInit: SallaPush already started with this app id from "
                + "SallaPushAppId, so the call changes nothing. Set them with the Info.plist keys SallaPushLogLevel, "
                + "SallaPushAppVersion, SallaPushClearTagsOnLogout, SallaPushRequiresUserConsent, "
                + "SallaPushOpenLaunchURLs, SallaPushAutoClearBadge, SallaPushAutoUpdateBadge, SallaPushAppGroup, "
                + "SallaPushAPNsEnvironment, SallaPushRegisterForRemoteNotificationsOnInit instead."
        ])
    }

    func testReportsNothingForASecondInitializeWithoutOptions() {
        makeBridge(earlyInit: StaticConfig(appId: "st_42_ios")).initialize(appId: "st_42_ios", options: [:])

        XCTAssertEqual(console.errors, [])
        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
    }

    func testReportsNothingForAnotherAppId() {
        makeBridge(earlyInit: StaticConfig(appId: "st_42_ios")).initialize(appId: "st_7_ios", options: ["logLevel": "debug"])

        XCTAssertEqual(console.errors, [])
    }

    func testReportsNothingWhenTheCallSetsTheAPIHost() {
        let bridge = makeBridge(earlyInit: StaticConfig(appId: "st_42_ios"))

        bridge.initialize(appId: "st_42_ios", options: ["apiBaseUrl": "http://localhost:9/v1", "logLevel": "debug"])

        XCTAssertEqual(console.errors, [])
    }

    func testReportsNothingWithoutEarlyInit() {
        makeBridge().initialize(appId: "st_42_ios", options: ["logLevel": "debug"])

        XCTAssertEqual(console.errors, [])
    }

    func testReportsConsentRequiredAfterEarlyInitWithoutTheStaticKey() {
        makeBridge(earlyInit: StaticConfig(appId: "st_42_ios", requiresUserConsent: false)).setConsentRequired(true)

        XCTAssertEqual(console.errors, [
            "setConsentRequired(true) came after SallaPush started from SallaPushAppId without "
                + "SallaPushRequiresUserConsent, so the device may already have registered and sent data. Set "
                + "SallaPushRequiresUserConsent to YES in the Info.plist to require consent from the start."
        ])
        XCTAssertEqual(native.calls, ["setConsentRequired(true)"])
    }

    func testReportsNothingWhenTheStaticKeyRequiresConsent() {
        makeBridge(earlyInit: StaticConfig(appId: "st_42_ios", requiresUserConsent: true)).setConsentRequired(true)

        XCTAssertEqual(console.errors, [])
        XCTAssertEqual(native.calls, ["setConsentRequired(true)"])
    }

    func testReportsNothingForConsentWithoutEarlyInitOrWhenNotRequired() {
        makeBridge().setConsentRequired(true)
        makeBridge(earlyInit: StaticConfig(appId: "st_42_ios")).setConsentRequired(false)

        XCTAssertEqual(console.errors, [])
        XCTAssertEqual(native.calls, ["setConsentRequired(true)", "setConsentRequired(false)"])
    }

    // MARK: - Getters, consent and identity

    func testReadsTheNativeValuesAtCallTime() {
        let bridge = makeBridge()
        XCTAssertFalse(bridge.isInitialized)
        XCTAssertNil(bridge.appId)

        native.isInitialized = true
        native.appId = "st_42_ios"
        native.sdkVersion = "1.0.3"

        XCTAssertTrue(bridge.isInitialized)
        XCTAssertEqual(bridge.appId, "st_42_ios")
        XCTAssertEqual(bridge.sdkVersion, "1.0.3")
    }

    func testPassesConsentAndIdentityCallsUnchanged() {
        let bridge = makeBridge()

        bridge.setConsentGiven(true)
        bridge.setConsentGiven(false)
        bridge.login(externalId: " customer-7 ", identityToken: " token ")
        bridge.logout()

        XCTAssertEqual(native.calls, [
            "setConsentGiven(true)", "setConsentGiven(false)", "login( customer-7 ,  token )", "logout()"
        ])
    }

    // MARK: - User and push subscription

    func testReadsTheUserAndThePushSubscriptionAtCallTime() {
        let bridge = makeBridge()
        XCTAssertNil(bridge.externalId)
        XCTAssertFalse(bridge.isLoggedIn)
        XCTAssertEqual(bridge.tags, [:])
        XCTAssertNil(bridge.pushSubscriptionId)
        XCTAssertNil(bridge.pushSubscriptionToken)
        XCTAssertFalse(bridge.pushSubscriptionOptedIn)

        native.externalId = "customer-7"
        native.isLoggedIn = true
        native.tags = ["level": "gold"]
        native.pushSubscriptionId = "3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40"
        native.pushSubscriptionToken = "a1b2c3"
        native.pushSubscriptionOptedIn = true

        XCTAssertEqual(bridge.externalId, "customer-7")
        XCTAssertTrue(bridge.isLoggedIn)
        XCTAssertEqual(bridge.tags, ["level": "gold"])
        XCTAssertEqual(bridge.pushSubscriptionId, "3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40")
        XCTAssertEqual(bridge.pushSubscriptionToken, "a1b2c3")
        XCTAssertTrue(bridge.pushSubscriptionOptedIn)
    }

    func testPassesTagEntriesUnchangedForNativesObjectiveCForms() {
        let tags: [AnyHashable: Any] = ["level": "gold", "visits": 3, "vip": true, "note": NSNull()]
        let keys: [Any] = ["level", 3, NSNull()]
        let bridge = makeBridge()

        bridge.addTags(tags)
        bridge.removeTags(keys)

        XCTAssertEqual(native.addedTags.map { NSDictionary(dictionary: $0) }, [NSDictionary(dictionary: tags)])
        XCTAssertEqual(native.removedTags.map { NSArray(array: $0) }, [NSArray(array: keys)])
    }

    func testNativeHasTheObjectiveCTagFormsTheLiveBridgeSends() {
        XCTAssertTrue(SallaPush.User.responds(to: NSSelectorFromString("addTags:")))
        XCTAssertTrue(SallaPush.User.responds(to: NSSelectorFromString("removeTags:")))
    }

    func testPassesTagLanguageAndSubscriptionCallsUnchanged() {
        let bridge = makeBridge()

        bridge.addTag(key: " Level ", value: "")
        bridge.removeTag(" City ")
        bridge.setLanguage("ar")
        bridge.setLanguage(nil)
        bridge.optIn()
        bridge.optOut()

        XCTAssertEqual(native.calls, [
            "addTag( Level , )", "removeTag( City )", "setLanguage(ar)", "setLanguage(nil)", "optIn()", "optOut()"
        ])
    }

    // MARK: - Debug and migration

    func testReadsAndSetsEveryLogLevelByName() {
        let levels: [(SallaPushLogLevel, String)] = [
            (.off, "off"), (.error, "error"), (.warn, "warn"), (.info, "info"), (.debug, "debug"), (.verbose, "verbose")
        ]
        let bridge = makeBridge()

        for (level, name) in levels {
            native.logLevel = level
            XCTAssertEqual(bridge.logLevel, name)
        }
        for (level, name) in levels.reversed() {
            bridge.logLevel = name
            XCTAssertEqual(native.logLevel, level)
        }
    }

    func testIgnoresALogLevelNameThatIsNotALevel() {
        native.logLevel = .error
        let bridge = makeBridge()

        bridge.logLevel = "Debug"
        bridge.logLevel = "trace"

        XCTAssertEqual(native.logLevel, .error)
    }

    func testTheCompatibilitySettingIsAndroidOnlyAndSaysItOncePerProcess() {
        let bridge = makeBridge()

        bridge.setDisplayOneSignalCompatPayloads()
        bridge.setDisplayOneSignalCompatPayloads()

        XCTAssertEqual(native.calls, [])
        XCTAssertEqual(console.infos, [
            "Migration.setDisplayOneSignalCompatPayloads is Android only and does nothing on iOS."
        ])
    }

    private func makeBridge(earlyInit: StaticConfig? = nil) -> SallaPushBridge {
        SallaPushBridge(native: native, console: console, once: once, emitter: emitter) { earlyInit }
    }
}
