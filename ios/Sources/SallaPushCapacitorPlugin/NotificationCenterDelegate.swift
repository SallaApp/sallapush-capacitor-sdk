import Capacitor
import Foundation
import SallaPush
import UserNotifications

/// The notification center whose delegate `SallaPushCapacitor.start()` sets. Tests replace it with a fake.
protocol UserNotificationCenter: AnyObject {
    var delegate: UNUserNotificationCenterDelegate? { get set }
}

extension UNUserNotificationCenter: UserNotificationCenter {}

/// The delegate `SallaPushCapacitor.start()` installs and the plugin takes back from Capacitor's notification router.
/// SallaPush's notifications go to native's ready-made delegate, which completes each once; other notifications go to
/// the router's handlers by the router's own rule, or to the delegate that was set before, so Capacitor's push and
/// local-notification plugins and other SDKs keep working.
final class SallaPushCapacitorNotificationCenterDelegate: SallaPushNotificationCenterDelegate { // swiftlint:disable:this type_name
    static let shared = SallaPushCapacitorNotificationCenterDelegate()

    /// Capacitor's router that SallaPush took the delegate back from, held weakly: its bridge owns it.
    private(set) weak var router: NotificationRouter?

    /// Any other delegate set before SallaPush's, held strongly: the notification center holds its delegate weakly.
    private(set) var previous: UNUserNotificationCenterDelegate?

    private let console: ConsoleOutput
    private let once: OncePerProcess
    private let isPush: (UNNotification) -> Bool
    private let isSallaPush: ([AnyHashable: Any]) -> Bool

    init(
        console: ConsoleOutput = Console(),
        once: OncePerProcess = .shared,
        isPush: @escaping (UNNotification) -> Bool = { $0.request.trigger?.isKind(of: UNPushNotificationTrigger.self) == true },
        isSallaPush: @escaping ([AnyHashable: Any]) -> Bool = { SallaPush.Notifications.isSallaPushNotification($0) }
    ) {
        self.console = console
        self.once = once
        self.isPush = isPush
        self.isSallaPush = isSallaPush
        super.init()
    }

    /// Hands other notifications to the delegate SallaPush's replaces. A router replaces the delegate kept before, as
    /// Capacitor's router itself dropped it.
    func chain(to current: UNUserNotificationCenterDelegate?) {
        if let current = current as? NotificationRouter {
            router = current
            previous = nil
        } else {
            router = nil
            previous = current
        }
    }

    override func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                         withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        guard !isSallaPush(notification.request.content.userInfo) else {
            super.userNotificationCenter(center, willPresent: notification, withCompletionHandler: completionHandler)
            return
        }
        if let router {
            completionHandler(handler(of: router, for: notification)?.willPresent(notification: notification) ?? [])
            return
        }
        let selector = #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))
        if let previous, previous.responds(to: selector) {
            // OneSignal's placeholder would run OneSignal's handling a second time: its swizzling already ran it on this
            // delegate, and completes OneSignal's notifications right after this method returns. Others get the defaults.
            guard NSStringFromClass(type(of: previous)) != "OSUNUserNotificationCenterDelegate" else {
                DispatchQueue.main.async {
                    super.userNotificationCenter(center, willPresent: notification, withCompletionHandler: completionHandler)
                }
                return
            }
            previous.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
            return
        }
        super.userNotificationCenter(center, willPresent: notification, withCompletionHandler: completionHandler)
    }

    override func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                         withCompletionHandler completionHandler: @escaping () -> Void) {
        guard !isSallaPush(response.notification.request.content.userInfo) else {
            super.userNotificationCenter(center, didReceive: response, withCompletionHandler: completionHandler)
            return
        }
        if let router {
            handler(of: router, for: response.notification)?.didReceive(response: response)
            completionHandler()
            return
        }
        let selector = #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))
        if let previous, previous.responds(to: selector) {
            previous.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
            return
        }
        if previous == nil {
            once.info("A notification response that isn't SallaPush's arrived before Capacitor's notification router "
                + "existed, and was completed without a handler.", to: console)
        }
        super.userNotificationCenter(center, didReceive: response, withCompletionHandler: completionHandler)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
        previous?.userNotificationCenter?(center, openSettingsFor: notification)
    }

    /// The router's handler of a notification, by the router's own rule: a push to its push handler, anything else to
    /// its local-notification handler.
    private func handler(of router: NotificationRouter, for notification: UNNotification) -> NotificationHandlerProtocol? {
        isPush(notification) ? router.pushNotificationHandler : router.localNotificationHandler
    }
}
