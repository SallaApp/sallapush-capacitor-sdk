import Capacitor
@testable import SallaPushCapacitorPlugin
import XCTest

/// The Capacitor plugin itself over FakeNativeSallaPush: its method table, and each method's options and results as
/// Capacitor's bridge passes them. load(on:) needs a bridge, so the tests give the plugin its logic.
final class SallaPushPluginTests: XCTestCase {
    private let native = FakeNativeSallaPush()
    private let console = RecordingConsole()

    // MARK: - The method table

    func testDeclaresTheMethodsOfTheTypeScriptPluginWithTheirKinds() {
        let methods = SallaPushPlugin().pluginMethods.map { "\($0.name ?? "") \($0.returnType ?? "")" }

        XCTAssertEqual(methods, [
            "initialize none", "isInitialized promise", "getSallaPushAppId promise", "getSdkVersion promise",
            "setConsentRequired none", "setConsentGiven none", "login none", "logout none",
            "getExternalId promise", "isLoggedIn promise", "addTag none", "addTags none", "removeTag none",
            "removeTags none", "getTags promise", "setLanguage none",
            "getPushSubscriptionId promise", "getPushSubscriptionToken promise", "getPushSubscriptionOptedIn promise",
            "optIn none", "optOut none"
        ])
    }

    // The compiler only warns when a pluginMethods entry has no @objc method, and JavaScript's call would then fail at
    // run time: Capacitor's bridge looks the method up by name and sends its selector.
    func testImplementsEveryMethodOfItsTableUnderTheSelectorCapacitorSends() {
        let plugin = SallaPushPlugin()

        for method in plugin.pluginMethods {
            XCTAssertEqual(NSStringFromSelector(method.selector), "\(method.name ?? ""):")
            XCTAssertTrue(plugin.responds(to: method.selector), method.name ?? "")
        }
    }

    // MARK: - Initialization, consent and identity

    func testInitializePassesTheAppIdAndTheConfigAsJavaScriptSendsThem() throws {
        makePlugin().initialize(call([
            "appId": "st_42_ios",
            "config": ["logLevel": "debug", "openLaunchUrls": true, "iosAutoClearBadge": false]
        ]))

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        let configuration = try XCTUnwrap(native.configurations.first)
        XCTAssertEqual(configuration.logLevel, .debug)
        XCTAssertTrue(configuration.openLaunchURLs)
        XCTAssertFalse(configuration.autoClearBadge)
    }

    func testRequestsResolveTheValuesNativeReadsAtCallTime() {
        let plugin = makePlugin()
        XCTAssertEqual(value(of: plugin.isInitialized) as? Bool, false)
        XCTAssertTrue(value(of: plugin.getSallaPushAppId) is NSNull)

        native.isInitialized = true
        native.appId = "st_42_ios"
        native.sdkVersion = "1.0.3"

        XCTAssertEqual(value(of: plugin.isInitialized) as? Bool, true)
        XCTAssertEqual(value(of: plugin.getSallaPushAppId) as? String, "st_42_ios")
        XCTAssertEqual(value(of: plugin.getSdkVersion) as? String, "1.0.3")
    }

    func testPassesConsentAndIdentityOptionsToNativeAndNeverSettlesTheseCalls() {
        let plugin = makePlugin()
        let required = RecordingPluginCall(["required": true])
        let given = RecordingPluginCall(["given": false])
        let login = RecordingPluginCall(["externalId": " customer-7 ", "identityToken": " token "])
        let logout = RecordingPluginCall()

        plugin.setConsentRequired(required.call)
        plugin.setConsentGiven(given.call)
        plugin.login(login.call)
        plugin.logout(logout.call)

        XCTAssertEqual(native.calls, [
            "setConsentRequired(true)", "setConsentGiven(false)", "login( customer-7 ,  token )", "logout()"
        ])
        let recordings = [required, given, login, logout]
        XCTAssertEqual(recordings.map(\.resolved.count) + recordings.map(\.rejected.count), Array(repeating: 0, count: 8))
    }

    // The TypeScript API validates every argument first, so only another caller could send these.
    func testDoesNothingForAMissingOrMistypedOption() {
        let plugin = makePlugin()

        plugin.initialize(call(["config": ["logLevel": "debug"]]))
        plugin.initialize(call(["appId": 42]))
        plugin.setConsentRequired(call(["required": "true"]))
        plugin.setConsentGiven(call())
        plugin.login(call(["externalId": "customer-7"]))

        XCTAssertEqual(native.initializedAppIds, [])
        XCTAssertEqual(native.calls, [])
    }

    func testRunsTheCallsOfCapacitorsQueueOnTheMainThreadInCallOrder() {
        let plugin = makePlugin()
        let ran = expectation(description: "the main thread ran the calls")

        DispatchQueue(label: "bridge").async {
            plugin.setConsentGiven(self.call(["given": true]))
            plugin.login(self.call(["externalId": "customer-7", "identityToken": "token"]))
            plugin.setConsentGiven(self.call(["given": false]))
            DispatchQueue.main.async { ran.fulfill() }
        }
        wait(for: [ran], timeout: 5)

        XCTAssertEqual(native.calls, ["setConsentGiven(true)", "login(customer-7, token)", "setConsentGiven(false)"])
    }

    // MARK: - User and push subscription

    func testUserAndSubscriptionRequestsResolveTheValuesNativeReadsAtCallTime() {
        let plugin = makePlugin()
        XCTAssertTrue(value(of: plugin.getExternalId) is NSNull)
        XCTAssertEqual(value(of: plugin.isLoggedIn) as? Bool, false)
        XCTAssertEqual(value(of: plugin.getTags) as? [String: String], [:])
        XCTAssertTrue(value(of: plugin.getPushSubscriptionId) is NSNull)
        XCTAssertTrue(value(of: plugin.getPushSubscriptionToken) is NSNull)
        XCTAssertEqual(value(of: plugin.getPushSubscriptionOptedIn) as? Bool, false)

        native.externalId = "customer-7"
        native.isLoggedIn = true
        native.tags = ["level": "gold", "city": "riyadh"]
        native.pushSubscriptionId = "3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40"
        native.pushSubscriptionToken = "a1b2c3"
        native.pushSubscriptionOptedIn = true

        XCTAssertEqual(value(of: plugin.getExternalId) as? String, "customer-7")
        XCTAssertEqual(value(of: plugin.isLoggedIn) as? Bool, true)
        XCTAssertEqual(value(of: plugin.getTags) as? [String: String], ["level": "gold", "city": "riyadh"])
        XCTAssertEqual(value(of: plugin.getPushSubscriptionId) as? String, "3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40")
        XCTAssertEqual(value(of: plugin.getPushSubscriptionToken) as? String, "a1b2c3")
        XCTAssertEqual(value(of: plugin.getPushSubscriptionOptedIn) as? Bool, true)
    }

    func testPassesTheTagEntriesJavaScriptSendsUncheckedToNativesObjectiveCForms() {
        let plugin = makePlugin()

        plugin.addTags(call(["tags": ["level": "gold", "visits": 3, "vip": true, "note": NSNull()]]))
        plugin.removeTags(call(["keys": ["level", 3, NSNull()]]))

        XCTAssertEqual(native.calls, ["addTags", "removeTags"])
        XCTAssertEqual(native.addedTags.map { NSDictionary(dictionary: $0) }, [
            ["level": "gold", "visits": 3, "vip": true, "note": NSNull()] as NSDictionary
        ])
        XCTAssertEqual(native.removedTags.map { NSArray(array: $0) }, [["level", 3, NSNull()] as NSArray])
    }

    func testPassesTagLanguageAndSubscriptionOptionsWithNullAsTheDeviceLanguage() {
        let plugin = makePlugin()

        plugin.addTag(call(["key": " Level ", "value": ""]))
        plugin.removeTag(call(["key": " City "]))
        plugin.setLanguage(call(["language": "ar"]))
        plugin.setLanguage(call(["language": NSNull()]))
        plugin.optIn(call())
        plugin.optOut(call())

        XCTAssertEqual(native.calls, [
            "addTag( Level , )", "removeTag( City )", "setLanguage(ar)", "setLanguage(nil)", "optIn()", "optOut()"
        ])
    }

    // The TypeScript API validates every argument first, so only another caller could send these.
    func testDoesNothingForAMissingOrMistypedUserOption() {
        let plugin = makePlugin()

        plugin.addTag(call(["key": "level"]))
        plugin.addTag(call(["key": "vip", "value": true]))
        plugin.addTags(call(["tags": "level=gold"]))
        plugin.removeTag(call())
        plugin.removeTags(call(["keys": "level"]))
        plugin.setLanguage(call())
        plugin.setLanguage(call(["language": 1]))

        XCTAssertEqual(native.calls, [])
    }

    // MARK: - A plugin without logic

    // Capacitor loads every plugin it creates; only a test makes one that was never loaded.
    func testAPluginThatWasNeverLoadedAnswersRequestsWithTheirNeutralValues() {
        let plugin = SallaPushPlugin()

        XCTAssertNil(plugin.logic)
        XCTAssertEqual(value(of: plugin.isInitialized) as? Bool, false)
        XCTAssertTrue(value(of: plugin.getSallaPushAppId) is NSNull)
        XCTAssertTrue(value(of: plugin.getSdkVersion) is NSNull)
        XCTAssertTrue(value(of: plugin.getExternalId) is NSNull)
        XCTAssertEqual(value(of: plugin.isLoggedIn) as? Bool, false)
        XCTAssertEqual(value(of: plugin.getTags) as? [String: String], [:])
        XCTAssertTrue(value(of: plugin.getPushSubscriptionId) is NSNull)
        XCTAssertTrue(value(of: plugin.getPushSubscriptionToken) is NSNull)
        XCTAssertEqual(value(of: plugin.getPushSubscriptionOptedIn) as? Bool, false)
    }

    func testAPluginThatWasNeverLoadedIsReleasedCleanly() {
        weak var released: SallaPushPlugin?

        autoreleasepool {
            let plugin = SallaPushPlugin()
            plugin.logout(call())
            released = plugin
        }

        XCTAssertNil(released)
    }

    // MARK: - Helpers

    private func makePlugin() -> SallaPushPlugin {
        let plugin = SallaPushPlugin()
        plugin.logic = SallaPushBridge(native: native, console: console) { nil }
        return plugin
    }

    private func call(_ options: [String: Any] = [:]) -> CAPPluginCall {
        RecordingPluginCall(options).call
    }

    /// The value a request resolved: `{ value }`, settled once and never rejected.
    private func value(of method: (CAPPluginCall) -> Void, _ options: [String: Any] = [:],
                       file: StaticString = #filePath, line: UInt = #line) -> Any? {
        let recording = RecordingPluginCall(options)
        method(recording.call)
        XCTAssertEqual(recording.resolved.count, 1, "resolutions", file: file, line: line)
        XCTAssertEqual(recording.rejected, [], file: file, line: line)
        return recording.resolved.first?["value"]
    }
}
