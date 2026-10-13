import Capacitor
import SallaPush
@testable import SallaPushCapacitorPlugin
import UserNotifications

final class RecordingConsole: ConsoleOutput {
    private(set) var errors: [String] = []
    private(set) var warnings: [String] = []
    private(set) var infos: [String] = []

    func error(_ message: String) {
        errors.append(message)
    }

    func warn(_ message: String) {
        warnings.append(message)
    }

    func info(_ message: String) {
        infos.append(message)
    }
}

/// Records the native calls, and answers the getters with the values a test sets.
final class FakeNativeSallaPush: NativeSallaPush {
    private(set) var initializedAppIds: [String] = []
    private(set) var configurations: [SallaPushConfiguration] = []
    var sdkVersion = "1.0.2"

    func initialize(_ appId: String, configuration: SallaPushConfiguration) {
        initializedAppIds.append(appId)
        configurations.append(configuration)
    }
}

/// Holds its delegate weakly, as UNUserNotificationCenter does.
final class FakeUserNotificationCenter: UserNotificationCenter {
    weak var delegate: UNUserNotificationCenterDelegate?
}

/// Another SDK's delegate: it handles every notification it gets and completes it.
final class RecordingNotificationCenterDelegate: NSObject, UNUserNotificationCenterDelegate {
    private let presentationOptions: UNNotificationPresentationOptions
    private(set) var presented: [UNNotification] = []
    private(set) var received: [UNNotificationResponse] = []
    private(set) var settingsRequests: [UNNotification?] = []

    init(presentationOptions: UNNotificationPresentationOptions = [.sound]) {
        self.presentationOptions = presentationOptions
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        presented.append(notification)
        completionHandler(presentationOptions)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        received.append(response)
        completionHandler()
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
        settingsRequests.append(notification)
    }
}

/// Another SDK's delegate that implements taps only.
final class TapOnlyNotificationCenterDelegate: NSObject, UNUserNotificationCenterDelegate {
    private(set) var received: [UNNotificationResponse] = []

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        received.append(response)
        completionHandler()
    }
}

/// Stands in for the placeholder delegate OneSignal 5 sets when the app has none, under its Objective-C name.
@objc(OSUNUserNotificationCenterDelegate)
final class OneSignalPlaceholderDelegate: NSObject, UNUserNotificationCenterDelegate {
    private(set) var presented: [UNNotification] = []
    private(set) var received: [UNNotificationResponse] = []

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        presented.append(notification)
        completionHandler([])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        received.append(response)
        completionHandler()
    }
}

/// A Capacitor plugin's handler in a slot of Capacitor's notification router, as @capacitor/push-notifications and
/// @capacitor/local-notifications set it: it records what the router hands it and answers with its options.
final class RecordingNotificationHandler: NSObject, NotificationHandlerProtocol {
    private let presentationOptions: UNNotificationPresentationOptions
    private(set) var presented: [UNNotification] = []
    private(set) var received: [UNNotificationResponse] = []

    init(presentationOptions: UNNotificationPresentationOptions) {
        self.presentationOptions = presentationOptions
    }

    func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        presented.append(notification)
        return presentationOptions
    }

    func didReceive(response: UNNotificationResponse) {
        received.append(response)
    }
}

/// Records the work SallaPushCapacitor schedules, with its delay, and runs it when a test says so.
final class FakeScheduler {
    private(set) var delays: [TimeInterval] = []
    private var pending: [() -> Void] = []

    func after(_ delay: TimeInterval, _ work: @escaping () -> Void) {
        delays.append(delay)
        pending.append(work)
    }

    func runPending() {
        let work = pending
        pending = []
        work.forEach { $0() }
    }
}
