import Capacitor
@testable import SallaPushCapacitorPlugin
import UIKit
import UserNotifications
import XCTest

/// SallaPushCapacitor over fakes: native, the notification center, the app's notifications, the clock and its state.
class SallaPushCapacitorTestCase: XCTestCase {
    let native = FakeNativeSallaPush()
    let console = RecordingConsole()
    let center = FakeUserNotificationCenter()
    let delegate = SallaPushCapacitorNotificationCenterDelegate(console: RecordingConsole(), once: OncePerProcess())
    let notifications = NotificationCenter()
    let scheduler = FakeScheduler()
    var active = false

    func makeStart(info: [String: Any] = [:]) -> SallaPushCapacitor {
        SallaPushCapacitor(
            native: native,
            info: info,
            console: console,
            notificationCenter: { [center] in center },
            delegate: delegate,
            notifications: notifications,
            after: scheduler.after,
            isActive: { [unowned self] in self.active }
        )
    }

    /// The app becomes active: UIKit posts the notification with the state already active.
    func activate() {
        active = true
        notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
    }
}

final class SallaPushCapacitorTests: SallaPushCapacitorTestCase {
    // MARK: - The start

    func testStartsSallaPushOnceWithTheStaticConfiguration() {
        let start = makeStart(info: [
            "SallaPushAppId": "st_42_ios",
            "SallaPushOpenLaunchURLs": true,
            "SallaPushAutoUpdateBadge": false,
            "SallaPushAPNsEnvironment": "sandbox"
        ])

        start.startFromApp()
        start.startFromApp()

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertEqual(native.configurations.first?.openLaunchURLs, true)
        XCTAssertEqual(native.configurations.first?.autoUpdateBadge, false)
        XCTAssertEqual(native.configurations.first?.apnsEnvironment, .sandbox)
        XCTAssertEqual(start.earlyInit, StaticConfig(appId: "st_42_ios", openLaunchURLs: true, autoUpdateBadge: false,
                                                     apnsEnvironment: .sandbox))
    }

    func testStartsNothingWithoutAnAppId() {
        let start = makeStart(info: ["SallaPushRequiresUserConsent": true])

        start.startFromApp()

        XCTAssertEqual(native.initializedAppIds, [])
        XCTAssertNil(start.earlyInit)
    }

    func testStartsNothingWhenTheAppIdBuildSettingIsUnset() {
        let start = makeStart(info: ["SallaPushAppId": ""])

        start.startFromApp()

        XCTAssertEqual(native.initializedAppIds, [])
        XCTAssertNil(start.earlyInit)
        XCTAssertEqual(console.errors, [])
    }

    func testReportsIgnoredKeysOnceAndStillStarts() {
        let start = makeStart(info: ["SallaPushAppId": "st_42_ios", "SallaPushAutoClearBadge": "sometimes"])

        start.startFromApp()
        start.startFromApp()

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertEqual(native.configurations.first?.autoClearBadge, SallaPushConfiguration().autoClearBadge)
        XCTAssertEqual(console.errors, ["Ignored SallaPushAutoClearBadge: \"sometimes\" is not true, false, YES, NO, 1 or 0."])
    }

    func testAPluginLoadStartsSallaPushWhenTheAppDidNotStartIt() {
        let start = makeStart(info: ["SallaPushAppId": "st_42_ios", "SallaPushRequiresUserConsent": "YES"])

        start.pluginLoaded(pluginConfigIsEmpty: true)
        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertEqual(native.configurations.first?.requiresUserConsent, true)
        XCTAssertEqual(start.earlyInit, StaticConfig(appId: "st_42_ios", requiresUserConsent: true))
    }

    func testAPluginLoadAfterTheStartStartsNothingMore() {
        let start = makeStart(info: ["SallaPushAppId": "st_42_ios"])

        start.startFromApp()
        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertEqual(console.errors, [])
    }

    // MARK: - The delegate

    func testInstallsItsDelegateAndKeepsThePreviousOneStrongly() {
        weak var weakPrevious: RecordingNotificationCenterDelegate?
        do {
            let previous = RecordingNotificationCenterDelegate()
            weakPrevious = previous
            center.delegate = previous

            makeStart().startFromApp()
        }

        XCTAssertTrue(center.delegate === delegate)
        XCTAssertNotNil(weakPrevious)
        XCTAssertTrue(delegate.previous === weakPrevious)
        XCTAssertNil(delegate.router)
    }

    func testInstallsItsDelegateWhenNoneIsSet() {
        makeStart(info: ["SallaPushAppId": "st_42_ios"]).startFromApp()

        XCTAssertTrue(center.delegate === delegate)
        XCTAssertNil(delegate.previous)
        XCTAssertNil(delegate.router)
    }

    func testInstallsItsDelegateOnce() {
        let start = makeStart()
        start.startFromApp()
        let later = RecordingNotificationCenterDelegate()
        center.delegate = later

        start.startFromApp()

        XCTAssertTrue(center.delegate === later)
        XCTAssertNil(delegate.previous)
    }

    func testAPluginLoadTakesTheDelegateBackFromCapacitorsRouter() {
        let start = makeStart()
        start.startFromApp()
        let router = NotificationRouter()
        center.delegate = router

        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertTrue(center.delegate === delegate)
        XCTAssertTrue(delegate.router === router)
        XCTAssertNil(delegate.previous)
    }

    func testAPluginLoadTakesTheDelegateBackFromTheNewestRouterAndDropsTheOneSignalPlaceholder() {
        let placeholder = OneSignalPlaceholderDelegate()
        center.delegate = placeholder
        let start = makeStart()
        start.startFromApp()
        let first = NotificationRouter()
        center.delegate = first
        start.pluginLoaded(pluginConfigIsEmpty: true)
        let second = NotificationRouter()
        center.delegate = second

        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertTrue(center.delegate === delegate)
        XCTAssertTrue(delegate.router === second)
        XCTAssertNil(delegate.previous)
    }

    func testAPluginLoadLeavesSallaPushsDelegateAlone() {
        let previous = RecordingNotificationCenterDelegate()
        center.delegate = previous
        let start = makeStart()
        start.startFromApp()

        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertTrue(center.delegate === delegate)
        XCTAssertTrue(delegate.previous === previous)
        XCTAssertNil(delegate.router)
    }

    func testAPluginLoadLeavesADelegateThatIsNotCapacitorsRouter() {
        let start = makeStart()
        start.startFromApp()
        let other = RecordingNotificationCenterDelegate()
        center.delegate = other

        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertTrue(center.delegate === other)
    }

    func testTheLateStartInstallsTheDelegateOverCapacitorsRouter() {
        let router = NotificationRouter()
        center.delegate = router
        let start = makeStart(info: ["SallaPushAppId": "st_42_ios"])

        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertEqual(native.initializedAppIds, ["st_42_ios"])
        XCTAssertTrue(center.delegate === delegate)
        XCTAssertTrue(delegate.router === router)
    }

    // MARK: - capacitor.config

    func testAPluginsSallaPushSectionIsReportedOncePerProcess() {
        let start = makeStart()
        start.startFromApp()

        start.pluginLoaded(pluginConfigIsEmpty: false)
        start.pluginLoaded(pluginConfigIsEmpty: false)

        XCTAssertEqual(console.errors, [
            "capacitor.config's plugins.SallaPush section is ignored: SallaPush reads its settings from the Info.plist "
                + "keys on iOS and the com.salla.push meta-data on Android (README, iOS setup and Android setup)."
        ])
    }

    func testAnEmptyPluginConfigIsNotReported() {
        let start = makeStart()
        start.startFromApp()

        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertEqual(console.errors, [])
    }
}

/// The first-activation check, and the check after a plugin load in an active app.
final class SallaPushCapacitorCheckTests: SallaPushCapacitorTestCase {
    private static let missingStart = "SallaPushCapacitor.start() was not called in "
        + "application(_:didFinishLaunchingWithOptions:), so SallaPush started when Capacitor loaded its plugin, and the "
        + "tap that launched the app can be missed. Call SallaPushCapacitor.start() as the first statement there."

    func testTheFirstActivationChecksTwoSecondsLaterThatCapacitorsRouterIsChained() {
        let start = makeStart()
        start.startFromApp()
        let router = NotificationRouter()
        center.delegate = router
        start.pluginLoaded(pluginConfigIsEmpty: true)

        activate()

        XCTAssertEqual(scheduler.delays, [2])
        XCTAssertEqual(console.infos, [])
        scheduler.runPending()
        XCTAssertEqual(console.infos, [
            "SallaPush's notification-center delegate is the current one; it hands other notifications to Capacitor's "
                + "notification router."
        ])
        XCTAssertEqual(console.errors, [])
    }

    func testTheCheckNamesThePreviousDelegate() {
        let placeholder = OneSignalPlaceholderDelegate()
        center.delegate = placeholder
        let start = makeStart()
        start.startFromApp()
        start.pluginLoaded(pluginConfigIsEmpty: true)

        activate()
        scheduler.runPending()

        XCTAssertEqual(console.infos, [
            "SallaPush's notification-center delegate is the current one; it hands other notifications to "
                + "OSUNUserNotificationCenterDelegate."
        ])
        XCTAssertEqual(console.errors, [])
    }

    func testTheCheckSaysWhenItHandsOtherNotificationsToNothing() {
        let start = makeStart()
        start.startFromApp()
        start.pluginLoaded(pluginConfigIsEmpty: true)

        activate()
        scheduler.runPending()

        XCTAssertEqual(console.infos, [
            "SallaPush's notification-center delegate is the current one; it hands other notifications to nothing."
        ])
    }

    func testTheCheckReportsADelegateThatReplacedSallaPushs() {
        let start = makeStart()
        start.startFromApp()
        start.pluginLoaded(pluginConfigIsEmpty: true)
        let other = RecordingNotificationCenterDelegate()
        center.delegate = other

        activate()
        scheduler.runPending()

        XCTAssertEqual(console.errors, [
            "\(NSStringFromClass(RecordingNotificationCenterDelegate.self)) replaced SallaPush's notification-center "
                + "delegate after SallaPushCapacitor.start(): SallaPush receives taps and foreground notifications only if "
                + "that delegate forwards them to SallaPush.Notifications.willPresent(_:) and didReceive(_:). Set your own "
                + "delegate before SallaPushCapacitor.start()."
        ])
        XCTAssertEqual(console.infos, [])
    }

    func testOnlyTheFirstActivationIsChecked() {
        let start = makeStart()
        start.startFromApp()

        activate()
        activate()
        scheduler.runPending()

        XCTAssertEqual(scheduler.delays, [2])
        XCTAssertEqual(console.infos.count, 1)
    }

    func testTheCheckReportsAMissingStartOncePerProcess() {
        let router = NotificationRouter()
        center.delegate = router
        let start = makeStart()
        start.pluginLoaded(pluginConfigIsEmpty: true)

        activate()
        scheduler.runPending()
        start.pluginLoaded(pluginConfigIsEmpty: true)
        scheduler.runPending()

        XCTAssertEqual(console.errors, [Self.missingStart])
        XCTAssertEqual(console.infos.count, 2)
    }

    func testAPluginLoadBeforeTheStartIsNoMissingStart() {
        let start = makeStart()
        start.pluginLoaded(pluginConfigIsEmpty: true)
        start.startFromApp()

        activate()
        scheduler.runPending()

        XCTAssertEqual(console.errors, [])
        XCTAssertEqual(console.infos.count, 1)
    }

    func testAPluginLoadInAnActiveAppChecksAgainAndReportsAReplacedDelegate() {
        let start = makeStart()
        start.startFromApp()
        activate()
        scheduler.runPending()
        let other = RecordingNotificationCenterDelegate()
        center.delegate = other

        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertEqual(scheduler.delays, [2, 2])
        scheduler.runPending()
        XCTAssertEqual(console.errors.count, 1)
        XCTAssertTrue(console.errors[0].hasPrefix(
            "\(NSStringFromClass(RecordingNotificationCenterDelegate.self)) replaced SallaPush's notification-center delegate"
        ))
    }

    func testAPluginLoadInAnInactiveAppLeavesTheCheckToTheActivation() {
        let start = makeStart()
        start.startFromApp()

        start.pluginLoaded(pluginConfigIsEmpty: true)

        XCTAssertEqual(scheduler.delays, [])
    }

    func testALateStartInAnActiveAppIsCheckedOnce() {
        active = true
        let router = NotificationRouter()
        center.delegate = router
        let start = makeStart()

        start.pluginLoaded(pluginConfigIsEmpty: true)
        notifications.post(name: UIApplication.didBecomeActiveNotification, object: nil)
        scheduler.runPending()

        XCTAssertEqual(scheduler.delays, [2])
        XCTAssertEqual(console.errors, [Self.missingStart])
        XCTAssertEqual(console.infos.count, 1)
    }
}
