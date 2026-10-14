@_exported import SallaPush
import Capacitor
import Foundation
import UIKit
import UserNotifications

/// Starts SallaPush natively at launch, so the tap that launched the app and pushes in processes without JavaScript
/// behave as in a native app. Call `SallaPushCapacitor.start()` as the first statement of
/// `application(_:didFinishLaunchingWithOptions:)`. `import SallaPushCapacitorPlugin` also gives Swift code the SallaPush
/// iOS API.
public final class SallaPushCapacitor: NSObject {
    static let shared = SallaPushCapacitor(
        native: LiveNativeSallaPush(),
        info: Bundle.main.infoDictionary ?? [:],
        console: Console(),
        notificationCenter: { UNUserNotificationCenter.current() },
        delegate: .shared,
        notifications: .default,
        after: { delay, work in DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work) },
        isActive: { UIApplication.shared.applicationState == .active }
    )

    private let native: NativeSallaPush
    private let info: [String: Any]
    private let console: ConsoleOutput
    private let notificationCenter: () -> UserNotificationCenter
    private let delegate: SallaPushCapacitorNotificationCenterDelegate
    private let notifications: NotificationCenter
    private let after: (TimeInterval, @escaping () -> Void) -> Void
    private let isActive: () -> Bool
    private var started = false
    private var startedByApp = false
    private var activationObserver: NSObjectProtocol?
    private var reportedMissingStart = false
    private var reportedIgnoredPluginConfig = false

    /// The static configuration SallaPush was started with in this process; nil when SallaPushAppId is not set.
    private(set) var earlyInit: StaticConfig?

    init(
        native: NativeSallaPush,
        info: [String: Any],
        console: ConsoleOutput,
        notificationCenter: @escaping () -> UserNotificationCenter,
        delegate: SallaPushCapacitorNotificationCenterDelegate,
        notifications: NotificationCenter,
        after: @escaping (TimeInterval, @escaping () -> Void) -> Void,
        isActive: @escaping () -> Bool
    ) {
        self.native = native
        self.info = info
        self.console = console
        self.notificationCenter = notificationCenter
        self.delegate = delegate
        self.notifications = notifications
        self.after = after
        self.isActive = isActive
    }

    /// Initializes SallaPush from the SallaPush… Info.plist keys when SallaPushAppId is set, then makes SallaPush's
    /// delegate the notification center's delegate, chained to the one set before. It runs once per process, on the main
    /// thread; later calls do nothing.
    @objc public static func start() {
        onMain { shared.startFromApp() }
    }

    func startFromApp() {
        startedByApp = true
        startOnce()
    }

    func startOnce() {
        guard !started else { return }
        started = true
        let config = StaticConfig(info: info, console: console)
        if let appId = config.appId {
            native.initialize(appId, configuration: config.configuration())
            earlyInit = config
        }
        install()
        scheduleFirstActivationCheck()
    }

    /// From the plugin's load(), inside Capacitor's bridge initializer, on the main thread, right after Capacitor's
    /// notification router may have made itself the delegate: SallaPush takes the delegate back, chained to the router.
    /// An app that didn't call start() starts SallaPush here, too late for the tap that launched the app, which the
    /// check reports.
    func pluginLoaded(pluginConfigIsEmpty: Bool) {
        if !pluginConfigIsEmpty { reportIgnoredPluginConfig() }
        startOnce()
        if notificationCenter().delegate is NotificationRouter { install() }
        if isActive() { scheduleCheck() }
    }

    private func install() {
        let center = notificationCenter()
        guard center.delegate !== delegate else { return }
        delegate.chain(to: center.delegate)
        center.delegate = delegate
    }

    /// Observes the first UIApplication.didBecomeActiveNotification of the process, then schedules the check. A start in
    /// an app that is already active comes from a plugin load, which schedules the check itself.
    private func scheduleFirstActivationCheck() {
        guard !isActive() else { return }
        activationObserver = notifications.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil,
                                                       queue: nil) { [weak self] _ in
            guard let self, let observer = self.activationObserver else { return }
            self.notifications.removeObserver(observer)
            self.activationObserver = nil
            self.scheduleCheck()
        }
    }

    /// The check, two seconds from now (native's own delay), on the main thread.
    private func scheduleCheck() {
        after(2) { [weak self] in self?.check() }
    }

    /// What native can't see: a missing start() call (once per process) and a delegate that replaced SallaPush's; else
    /// which delegate SallaPush hands the other notifications to.
    private func check() {
        if !startedByApp, !reportedMissingStart {
            reportedMissingStart = true
            console.error("SallaPushCapacitor.start() was not called in application(_:didFinishLaunchingWithOptions:), so "
                + "SallaPush started when Capacitor loaded its plugin, and the tap that launched the app can be missed. "
                + "Call SallaPushCapacitor.start() as the first statement there.")
        }
        let current = notificationCenter().delegate
        guard current === delegate else {
            console.error("\(current.map { NSStringFromClass(type(of: $0)) } ?? "nil") replaced SallaPush's "
                + "notification-center delegate after SallaPushCapacitor.start(): SallaPush receives taps and foreground "
                + "notifications only if that delegate forwards them to SallaPush.Notifications.willPresent(_:) and "
                + "didReceive(_:). Set your own delegate before SallaPushCapacitor.start().")
            return
        }
        let next = delegate.router != nil
            ? "Capacitor's notification router"
            : delegate.previous.map { NSStringFromClass(type(of: $0)) } ?? "nothing"
        console.info("SallaPush's notification-center delegate is the current one; it hands other notifications to \(next).")
    }

    /// The plugin reads no plugins.SallaPush section of capacitor.config: one error per process says so.
    private func reportIgnoredPluginConfig() {
        guard !reportedIgnoredPluginConfig else { return }
        reportedIgnoredPluginConfig = true
        console.error("capacitor.config's plugins.SallaPush section is ignored: SallaPush reads its settings from the "
            + "Info.plist keys on iOS and the com.salla.push meta-data on Android (README, iOS setup and Android setup).")
    }
}
