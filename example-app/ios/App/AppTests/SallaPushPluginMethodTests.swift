import Capacitor
@testable import SallaPushCapacitorPlugin
import XCTest

/// The user and push-subscription methods of the plugin, with their options as JavaScript sends them.
final class SallaPushPluginUserTests: SallaPushPluginTestCase {
    func testRequestsResolveTheValuesNativeReadsAtCallTime() {
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
    func testDoesNothingForAMissingOrMistypedOption() {
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
}

/// The permission and notification methods of the plugin, with their options as JavaScript sends them.
final class SallaPushPluginNotificationsTests: SallaPushPluginTestCase {
    func testPermissionRequestsResolveWhatNativeReadsOrAnswers() {
        let plugin = makePlugin()
        XCTAssertEqual(value(of: plugin.getPermission) as? Bool, false)
        XCTAssertEqual(value(of: plugin.canRequestPermission) as? Bool, false)
        XCTAssertEqual(value(of: plugin.getPermissionStatus) as? String, "notDetermined")

        native.permission = true
        native.canRequestPermission = true
        native.permissionStatus = .provisional
        native.permissionAnswer = true

        XCTAssertEqual(value(of: plugin.getPermission) as? Bool, true)
        XCTAssertEqual(value(of: plugin.canRequestPermission) as? Bool, true)
        XCTAssertEqual(value(of: plugin.getPermissionStatus) as? String, "provisional")
        XCTAssertEqual(value(of: plugin.requestPermission, ["fallbackToSettings": true]) as? Bool, true)
        XCTAssertEqual(value(of: plugin.requestPermission) as? Bool, true)
        XCTAssertEqual(value(of: plugin.registerForProvisionalAuthorization) as? Bool, true)
        XCTAssertEqual(native.calls, [
            "requestPermission(true)", "requestPermission(false)", "registerForProvisionalAuthorization()"
        ])
    }

    func testPassesRefreshRegisterClearAllAndTheDecodedAPNsTokenAndNeverSettlesThem() {
        let plugin = makePlugin()
        let calls = [RecordingPluginCall(), RecordingPluginCall(), RecordingPluginCall(["apnsToken": "0A1BFF7C"]),
                     RecordingPluginCall()]

        plugin.refreshPermission(calls[0].call)
        plugin.registerForRemoteNotifications(calls[1].call)
        plugin.forwardApnsToken(calls[2].call)
        plugin.clearAll(calls[3].call)

        XCTAssertEqual(native.calls, [
            "refreshPermission()", "registerForRemoteNotifications()", "didRegisterForRemoteNotifications", "clearAll()"
        ])
        XCTAssertEqual(native.deviceTokens, [Data([0x0A, 0x1B, 0xFF, 0x7C])])
        XCTAssertEqual(calls.map(\.resolved.count) + calls.map(\.rejected.count), Array(repeating: 0, count: 8))
    }

    func testChecksAPayloadAsJavaScriptSendsItWithoutItsNullValues() {
        native.recognizesPayloads = true

        let recognized = value(of: makePlugin().isSallaPushNotification, [
            "payload": ["sp_v": "1", "sp_url": NSNull(), "count": 3]
        ])

        XCTAssertEqual(recognized as? Bool, true)
        XCTAssertEqual(native.checkedPayloads.map { NSDictionary(dictionary: $0) }, [["sp_v": "1", "count": 3]])
    }

    // JavaScript's payload reaches native as Capacitor's JavaScript values, nested objects included.
    func testTheLiveSDKRecognizesTheTestPayloadsAsJavaScriptSendsThem() throws {
        let plugin = makePlugin(native: LiveNativeSallaPush())

        for name in ["native", "compat"] {
            let payload = try TestNotifications.payload(name)
            XCTAssertEqual(value(of: plugin.isSallaPushNotification, ["payload": payload]) as? Bool, true, name)
        }
        XCTAssertEqual(value(of: plugin.isSallaPushNotification, ["payload": TestNotifications.foreign]) as? Bool, false)
    }

    func testAndroidOnlyCallsResolveTheirNeutralValuesAndSayItOncePerProcess() {
        let plugin = makePlugin()

        plugin.removeNotification(call(["androidNotificationId": 42]))
        plugin.removeNotification(call(["androidNotificationId": 42]))
        XCTAssertEqual(value(of: plugin.trackOpened, ["additionalData": ["push_ref": "msg_1a2b"]]) as? Bool, false)
        XCTAssertEqual(value(of: plugin.trackOpened, ["additionalData": NSNull()]) as? Bool, false)

        XCTAssertEqual(native.calls, [])
        XCTAssertEqual(console.infos, [
            "Notifications.removeNotification is Android only and does nothing on iOS.",
            "Notifications.trackOpened is Android only and resolves false on iOS, where taps on OneSignal-format "
                + "SallaPush notifications reach SallaPush through its notification-center delegate."
        ])
    }

    func testDisplayNotificationShowsAHeldNotificationOnceOnTheMainThread() throws {
        let plugin = makePlugin()
        let notification = FakeWillDisplay()
        let listener = RecordingPluginCall(["eventName": "willDisplay"])
        plugin.addListener(listener.call)
        plugin.startEvents(call(["kind": "willDisplay"]))
        native.willDisplayHandlers.first?(notification.event)
        let handle = try XCTUnwrap(listener.resolved.first?["handle"] as? String)
        let ran = expectation(description: "the main thread ran the calls")

        DispatchQueue(label: "bridge").async {
            plugin.displayNotification(self.call(["handle": handle]))
            plugin.displayNotification(self.call(["handle": handle]))
            DispatchQueue.main.async { ran.fulfill() }
        }
        wait(for: [ran], timeout: 5)

        XCTAssertTrue(notification.isPrevented)
        XCTAssertEqual(notification.displays, 1)
        XCTAssertEqual(console.warnings, [
            "SallaPushNotification.display() did nothing: a prevented notification is shown once, within 10 minutes of "
                + "its foregroundWillDisplay event."
        ])
    }

    // The TypeScript API validates every argument first, so only another caller could send these.
    func testUsesTheDefaultsForAMissingOrMistypedOption() {
        let plugin = makePlugin()

        plugin.displayNotification(call())
        plugin.displayNotification(call(["handle": 7]))
        XCTAssertEqual(console.warnings, [])
        XCTAssertEqual(value(of: plugin.requestPermission, ["fallbackToSettings": "yes"]) as? Bool, false)
        XCTAssertEqual(value(of: plugin.isSallaPushNotification, ["payload": "sp_v"]) as? Bool, false)
        plugin.forwardApnsToken(call())
        plugin.forwardApnsToken(call(["apnsToken": 7]))

        XCTAssertEqual(native.calls, ["requestPermission(false)"])
        XCTAssertEqual(native.checkedPayloads.map { NSDictionary(dictionary: $0) }, [NSDictionary()])
        XCTAssertEqual(native.deviceTokens, [])
    }
}

/// The migration and debug methods of the plugin, with their options as JavaScript sends them.
final class SallaPushPluginDebugTests: SallaPushPluginTestCase {
    func testReadsAndSetsTheLogLevelByItsJavaScriptName() {
        let plugin = makePlugin()
        XCTAssertEqual(value(of: plugin.getLogLevel) as? String, "warn")

        native.logLevel = .verbose
        XCTAssertEqual(value(of: plugin.getLogLevel) as? String, "verbose")

        let setting = RecordingPluginCall(["level": "error"])
        plugin.setLogLevel(setting.call)
        XCTAssertEqual(native.logLevel, .error)
        XCTAssertEqual(setting.resolved.count + setting.rejected.count, 0)
    }

    // The TypeScript API validates every argument first, so only another caller could send these.
    func testIgnoresAMissingOrUnknownLogLevel() {
        native.logLevel = .error
        let plugin = makePlugin()

        plugin.setLogLevel(call())
        plugin.setLogLevel(call(["level": 3]))
        plugin.setLogLevel(call(["level": "Debug"]))

        XCTAssertEqual(native.logLevel, .error)
    }

    func testSetsTheLogHandlerLevelByItsJavaScriptNameAndIgnoresAnUnknownOne() {
        let plugin = makePlugin()
        plugin.startEvents(call(["kind": "log"]))

        plugin.setLogHandlerLevel(call(["level": "verbose"]))
        plugin.setLogHandlerLevel(call(["level": "trace"]))
        plugin.setLogHandlerLevel(call(["level": 3]))
        plugin.setLogHandlerLevel(call())

        XCTAssertEqual(native.logHandlers.map(\.level), [.warn, .verbose])
    }

    func testTheCompatibilitySettingIsAndroidOnlyAndSaysItOncePerProcess() {
        let plugin = makePlugin()

        plugin.setDisplayOneSignalCompatPayloads(call(["display": true]))
        plugin.setDisplayOneSignalCompatPayloads(call(["display": false]))

        XCTAssertEqual(native.calls, [])
        XCTAssertEqual(console.infos, [
            "Migration.setDisplayOneSignalCompatPayloads is Android only and does nothing on iOS."
        ])
    }
}
