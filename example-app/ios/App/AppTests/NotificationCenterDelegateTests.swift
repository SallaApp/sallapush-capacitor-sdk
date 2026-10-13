import Capacitor
import SallaPush
@testable import SallaPushCapacitorPlugin
import UserNotifications
import XCTest

final class NotificationCenterDelegateTests: XCTestCase {
    private static let foreignTapLine = "A notification response that isn't SallaPush's arrived before Capacitor's "
        + "notification router existed, and was completed without a handler."

    private let center = UNUserNotificationCenter.current()
    private let console = RecordingConsole()
    private lazy var delegate = makeDelegate()

    // MARK: - Another delegate set before SallaPush's

    func testAForeignNotificationIsPresentedByThePreviousDelegateOnly() throws {
        let previous = RecordingNotificationCenterDelegate(presentationOptions: [.sound])
        delegate.chain(to: previous)

        let options = present(try TestNotifications.notification(userInfo: TestNotifications.foreign))

        XCTAssertEqual(options, [[.sound]])
        XCTAssertEqual(previous.presented.count, 1)
    }

    func testANativeSallaPushNotificationIsPresentedBySallaPushOnce() throws {
        try assertSallaPushPresents(TestNotifications.payload("native"))
    }

    func testACompatibleSallaPushNotificationIsPresentedBySallaPushOnce() throws {
        try assertSallaPushPresents(TestNotifications.payload("compat"))
    }

    func testWithoutAPreviousDelegateAForeignNotificationGetsTheDefaultOptions() throws {
        let options = present(try TestNotifications.notification(userInfo: TestNotifications.foreign))

        XCTAssertEqual(options, [[.banner, .list, .sound, .badge]])
    }

    func testAPreviousDelegateThatDoesNotPresentLeavesForeignNotificationsToTheDefault() throws {
        let previous = TapOnlyNotificationCenterDelegate()
        delegate.chain(to: previous)

        let options = present(try TestNotifications.notification(userInfo: TestNotifications.foreign))

        XCTAssertEqual(options, [[.banner, .list, .sound, .badge]])
    }

    func testAForeignTapGoesToThePreviousDelegateOnly() throws {
        let previous = RecordingNotificationCenterDelegate()
        delegate.chain(to: previous)

        let completions = receive(try TestNotifications.response(userInfo: TestNotifications.foreign))

        XCTAssertEqual(completions, 1)
        XCTAssertEqual(previous.received.count, 1)
        XCTAssertEqual(console.infos, [])
    }

    func testASallaPushTapGoesToSallaPushAndCompletesOnce() throws {
        let previous = RecordingNotificationCenterDelegate()
        delegate.chain(to: previous)

        let completions = receive(try TestNotifications.response(userInfo: TestNotifications.payload("native")))

        XCTAssertEqual(completions, 1)
        XCTAssertTrue(previous.received.isEmpty)
    }

    func testATapPreviousDelegateStillGetsForeignTaps() throws {
        let previous = TapOnlyNotificationCenterDelegate()
        delegate.chain(to: previous)

        let completions = receive(try TestNotifications.response(userInfo: TestNotifications.foreign))

        XCTAssertEqual(completions, 1)
        XCTAssertEqual(previous.received.count, 1)
    }

    // OneSignal's swizzled willPresent already ran OneSignal's handling on this delegate, and completes OneSignal's own
    // notifications right after it returns; its placeholder would run that handling a second time.
    func testAForeignNotificationIsNotForwardedToOneSignalsPlaceholderAndGetsTheDefaultOptionsOnce() throws {
        let placeholder = OneSignalPlaceholderDelegate()
        delegate.chain(to: placeholder)
        let completed = expectation(description: "completed")
        var options: [UNNotificationPresentationOptions] = []

        delegate.userNotificationCenter(center, willPresent: try TestNotifications.notification(userInfo: TestNotifications.foreign)) {
            options.append($0)
            completed.fulfill()
        }

        XCTAssertTrue(options.isEmpty)
        wait(for: [completed], timeout: 5)
        XCTAssertEqual(options, [[.banner, .list, .sound, .badge]])
        XCTAssertTrue(placeholder.presented.isEmpty)
    }

    func testASallaPushNotificationCompletesAtOnceWithOneSignalsPlaceholder() throws {
        let placeholder = OneSignalPlaceholderDelegate()
        delegate.chain(to: placeholder)

        let options = present(try TestNotifications.notification(userInfo: TestNotifications.payload("native")))

        XCTAssertEqual(options.count, 1)
        XCTAssertTrue(placeholder.presented.isEmpty)
    }

    func testAForeignTapStillGoesToOneSignalsPlaceholder() throws {
        let placeholder = OneSignalPlaceholderDelegate()
        delegate.chain(to: placeholder)

        let completions = receive(try TestNotifications.response(userInfo: TestNotifications.foreign))

        XCTAssertEqual(completions, 1)
        XCTAssertEqual(placeholder.received.count, 1)
    }

    func testOpenSettingsIsForwardedToThePreviousDelegate() throws {
        let previous = RecordingNotificationCenterDelegate()
        delegate.chain(to: previous)
        let notification = try TestNotifications.notification(userInfo: TestNotifications.foreign)

        (delegate as UNUserNotificationCenterDelegate).userNotificationCenter?(center, openSettingsFor: notification)

        XCTAssertEqual(previous.settingsRequests.count, 1)
        XCTAssertTrue(previous.settingsRequests.first.flatMap { $0 } === notification)
    }

    func testOpenSettingsWithoutAPreviousDelegateDoesNothing() {
        let selector = #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:openSettingsFor:))

        XCTAssertTrue(delegate.responds(to: selector))
        delegate.userNotificationCenter(center, openSettingsFor: nil)
    }

    // MARK: - Capacitor's notification router

    func testAForeignPushIsPresentedByTheRoutersPushHandlerOnly() throws {
        delegate = makeDelegate(isPush: true)
        let router = NotificationRouter()
        let push = RecordingNotificationHandler(presentationOptions: [.banner])
        let local = RecordingNotificationHandler(presentationOptions: [.sound])
        router.pushNotificationHandler = push
        router.localNotificationHandler = local
        delegate.chain(to: router)

        let options = present(try TestNotifications.notification(userInfo: TestNotifications.foreign))

        XCTAssertEqual(options, [[.banner]])
        XCTAssertEqual(push.presented.count, 1)
        XCTAssertTrue(local.presented.isEmpty)
    }

    func testAForeignLocalNotificationIsPresentedByTheRoutersLocalHandlerOnly() throws {
        let router = NotificationRouter()
        let push = RecordingNotificationHandler(presentationOptions: [.banner])
        let local = RecordingNotificationHandler(presentationOptions: [.sound])
        router.pushNotificationHandler = push
        router.localNotificationHandler = local
        delegate.chain(to: router)

        // Without a push trigger, as a local notification has none, the router's rule picks the local handler.
        let options = present(try TestNotifications.notification(userInfo: TestNotifications.foreign))

        XCTAssertEqual(options, [[.sound]])
        XCTAssertEqual(local.presented.count, 1)
        XCTAssertTrue(push.presented.isEmpty)
    }

    func testWithoutAHandlerTheRouterPresentsAForeignNotificationWithNoOptions() throws {
        let router = NotificationRouter()
        delegate.chain(to: router)
        let notification = try TestNotifications.notification(userInfo: TestNotifications.foreign)

        XCTAssertEqual(present(notification), [[]])
        XCTAssertEqual(makeDelegate(isPush: true, chainedTo: router).presentedOptions(of: notification, in: center), [[]])
    }

    func testAForeignPushTapGoesToTheRoutersPushHandlerAndCompletesOnce() throws {
        delegate = makeDelegate(isPush: true)
        let router = NotificationRouter()
        let push = RecordingNotificationHandler(presentationOptions: [])
        let local = RecordingNotificationHandler(presentationOptions: [])
        router.pushNotificationHandler = push
        router.localNotificationHandler = local
        delegate.chain(to: router)

        let completions = receive(try TestNotifications.response(userInfo: TestNotifications.foreign))

        XCTAssertEqual(completions, 1)
        XCTAssertEqual(push.received.count, 1)
        XCTAssertTrue(local.received.isEmpty)
    }

    func testAForeignLocalTapGoesToTheRoutersLocalHandlerAndCompletesOnce() throws {
        let router = NotificationRouter()
        let push = RecordingNotificationHandler(presentationOptions: [])
        let local = RecordingNotificationHandler(presentationOptions: [])
        router.pushNotificationHandler = push
        router.localNotificationHandler = local
        delegate.chain(to: router)

        let completions = receive(try TestNotifications.response(userInfo: TestNotifications.foreign))

        XCTAssertEqual(completions, 1)
        XCTAssertEqual(local.received.count, 1)
        XCTAssertTrue(push.received.isEmpty)
    }

    func testWithoutAHandlerTheRouterBranchCompletesAForeignTapOnceWithoutTheInfoLine() throws {
        let router = NotificationRouter()
        delegate.chain(to: router)

        XCTAssertEqual(receive(try TestNotifications.response(userInfo: TestNotifications.foreign)), 1)
        XCTAssertEqual(console.infos, [])
    }

    func testSallaPushsNotificationsGoToSallaPushBeforeTheRouter() throws {
        delegate = makeDelegate(isPush: true)
        let router = NotificationRouter()
        let push = RecordingNotificationHandler(presentationOptions: [.banner])
        router.pushNotificationHandler = push
        router.localNotificationHandler = push
        delegate.chain(to: router)
        let notification = try TestNotifications.notification(userInfo: TestNotifications.payload("native"))
        var nativeOptions: [UNNotificationPresentationOptions] = []
        SallaPushNotificationCenterDelegate().userNotificationCenter(center, willPresent: notification) {
            nativeOptions.append($0)
        }

        XCTAssertEqual(present(notification), nativeOptions)
        XCTAssertEqual(receive(try TestNotifications.response(userInfo: TestNotifications.payload("compat"))), 1)
        XCTAssertTrue(push.presented.isEmpty)
        XCTAssertTrue(push.received.isEmpty)
    }

    // MARK: - Chaining

    func testChainingToARouterHoldsItWeaklyAndDropsThePreviousDelegate() {
        let previous = RecordingNotificationCenterDelegate()
        delegate.chain(to: previous)
        weak var weakRouter: NotificationRouter?
        do {
            let router = NotificationRouter()
            weakRouter = router

            delegate.chain(to: router)

            XCTAssertTrue(delegate.router === router)
            XCTAssertNil(delegate.previous)
        }
        XCTAssertNil(weakRouter)
        XCTAssertNil(delegate.router)
    }

    func testChainingToAnotherDelegateDropsTheRouterAndKeepsTheDelegateStrongly() {
        let router = NotificationRouter()
        delegate.chain(to: router)
        weak var weakPrevious: RecordingNotificationCenterDelegate?
        do {
            let previous = RecordingNotificationCenterDelegate()
            weakPrevious = previous

            delegate.chain(to: previous)
        }

        XCTAssertNil(delegate.router)
        XCTAssertNotNil(weakPrevious)
        XCTAssertTrue(delegate.previous === weakPrevious)
    }

    // MARK: - A foreign tap before the router exists

    func testWithoutARouterOrAPreviousDelegateAForeignTapCompletesOnceAndSaysSoOncePerProcess() throws {
        XCTAssertEqual(receive(try TestNotifications.response(userInfo: TestNotifications.foreign)), 1)
        XCTAssertEqual(receive(try TestNotifications.response(userInfo: TestNotifications.foreign)), 1)

        XCTAssertEqual(console.infos, [Self.foreignTapLine])
    }

    func testWithoutARouterOrAPreviousDelegateASallaPushTapCompletesOnceWithoutTheInfoLine() throws {
        XCTAssertEqual(receive(try TestNotifications.response(userInfo: TestNotifications.payload("compat"))), 1)

        XCTAssertEqual(console.infos, [])
    }

    // MARK: - Helpers

    private func makeDelegate(isPush: Bool = false, chainedTo router: NotificationRouter? = nil)
        -> SallaPushCapacitorNotificationCenterDelegate {
        let delegate = SallaPushCapacitorNotificationCenterDelegate(console: console, once: OncePerProcess(),
                                                                    isPush: { _ in isPush })
        if let router {
            delegate.chain(to: router)
        }
        return delegate
    }

    private func assertSallaPushPresents(_ userInfo: [AnyHashable: Any], line: UInt = #line) throws {
        let previous = RecordingNotificationCenterDelegate(presentationOptions: [.sound])
        delegate.chain(to: previous)
        let notification = try TestNotifications.notification(userInfo: userInfo)
        var nativeOptions: [UNNotificationPresentationOptions] = []
        SallaPushNotificationCenterDelegate().userNotificationCenter(center, willPresent: notification) {
            nativeOptions.append($0)
        }

        let options = present(notification)

        XCTAssertEqual(options, nativeOptions, line: line)
        XCTAssertEqual(options.count, 1, line: line)
        XCTAssertTrue(previous.presented.isEmpty, line: line)
    }

    private func present(_ notification: UNNotification) -> [UNNotificationPresentationOptions] {
        delegate.presentedOptions(of: notification, in: center)
    }

    private func receive(_ response: UNNotificationResponse) -> Int {
        var completions = 0
        delegate.userNotificationCenter(center, didReceive: response) { completions += 1 }
        return completions
    }
}

private extension SallaPushCapacitorNotificationCenterDelegate {
    /// The options each completion of willPresent passed, in order.
    func presentedOptions(of notification: UNNotification, in center: UNUserNotificationCenter)
        -> [UNNotificationPresentationOptions] {
        var completions: [UNNotificationPresentationOptions] = []
        userNotificationCenter(center, willPresent: notification) { completions.append($0) }
        return completions
    }
}
