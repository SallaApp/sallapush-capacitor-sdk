import Capacitor
@testable import SallaPushCapacitorPlugin
import XCTest

/// The Capacitor plugin over FakeNativeSallaPush, with each call's options and results as Capacitor's bridge passes
/// them. load(on:) needs a bridge, so the tests give the plugin its logic.
class SallaPushPluginTestCase: XCTestCase {
    let native = FakeNativeSallaPush()
    let console = RecordingConsole()
    let once = OncePerProcess()

    func makePlugin(native: NativeSallaPush? = nil) -> SallaPushPlugin {
        let plugin = SallaPushPlugin()
        plugin.logic = SallaPushBridge(native: native ?? self.native, console: console, once: once) { nil }
        return plugin
    }

    func call(_ options: [String: Any] = [:]) -> CAPPluginCall {
        RecordingPluginCall(options).call
    }

    /// The value a request resolved: `{ value }`, settled once and never rejected.
    func value(of method: (CAPPluginCall) -> Void, _ options: [String: Any] = [:],
               file: StaticString = #filePath, line: UInt = #line) -> Any? {
        let recording = RecordingPluginCall(options)
        method(recording.call)
        XCTAssertEqual(recording.resolved.count, 1, "resolutions", file: file, line: line)
        XCTAssertEqual(recording.rejected, [], file: file, line: line)
        return recording.resolved.first?["value"]
    }
}

/// The plugin itself: its method table, its threading, initialization, consent and identity, and a plugin that was never
/// loaded.
final class SallaPushPluginTests: SallaPushPluginTestCase {
    // MARK: - The method table

    func testDeclaresTheMethodsOfTheTypeScriptPluginWithTheirKinds() {
        let methods = SallaPushPlugin().pluginMethods.map { "\($0.name ?? "") \($0.returnType ?? "")" }

        XCTAssertEqual(methods, [
            "initialize none", "isInitialized promise", "getSallaPushAppId promise", "getSdkVersion promise",
            "setConsentRequired none", "setConsentGiven none", "login none", "logout none",
            "getExternalId promise", "isLoggedIn promise", "addTag none", "addTags none", "removeTag none",
            "removeTags none", "getTags promise", "setLanguage none",
            "getPushSubscriptionId promise", "getPushSubscriptionToken promise", "getPushSubscriptionOptedIn promise",
            "optIn none", "optOut none",
            "getPermission promise", "canRequestPermission promise", "getPermissionStatus promise",
            "requestPermission promise", "registerForProvisionalAuthorization promise", "refreshPermission none",
            "registerForRemoteNotifications none", "forwardApnsToken none", "clearAll none", "removeNotification none",
            "isSallaPushNotification promise", "trackOpened promise"
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
        XCTAssertEqual(value(of: plugin.getPermission) as? Bool, false)
        XCTAssertEqual(value(of: plugin.canRequestPermission) as? Bool, false)
        XCTAssertTrue(value(of: plugin.getPermissionStatus) is NSNull)
        XCTAssertEqual(value(of: plugin.requestPermission) as? Bool, false)
        XCTAssertEqual(value(of: plugin.registerForProvisionalAuthorization) as? Bool, false)
        XCTAssertEqual(value(of: plugin.isSallaPushNotification) as? Bool, false)
        XCTAssertEqual(value(of: plugin.trackOpened) as? Bool, false)
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
}
