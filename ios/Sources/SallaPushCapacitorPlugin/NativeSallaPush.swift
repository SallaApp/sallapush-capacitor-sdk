import Foundation
import SallaPush
import UserNotifications

/// A native registration the wrapper cancels once JavaScript stops listening.
protocol NativeObservation: AnyObject {
    func cancel()
}

extension SallaPushObservation: NativeObservation {}

/// A foreground SallaPush notification about to be shown, as the registry gets it.
struct NativeWillDisplay {
    /// The notification's bridge form.
    let notification: [String: Any]
    /// Keeps the notification from being shown now; it counts only before the listener returns.
    let preventDefault: () -> Void
    /// Shows the notification later: native shows only the very object it offered.
    let display: () -> Void
}

/// The native SallaPush calls the wrapper makes. Tests replace it with a fake. Listeners get their events in bridge
/// form, as JavaScript gets them, so tests never need native's objects.
protocol NativeSallaPush: AnyObject {
    func initialize(_ appId: String, configuration: SallaPushConfiguration)
    var isInitialized: Bool { get }
    var appId: String? { get }
    var sdkVersion: String { get }
    func setConsentRequired(_ required: Bool)
    func setConsentGiven(_ given: Bool)
    func login(externalId: String, identityToken: String)
    func logout()

    var externalId: String? { get }
    var isLoggedIn: Bool { get }
    func addTag(key: String, value: String)
    /// Native's Objective-C `addTags:`, which skips and logs the entries that aren't strings.
    func addTags(_ tags: [AnyHashable: Any])
    func removeTag(_ key: String)
    /// Native's Objective-C `removeTags:`, which skips and logs the keys that aren't strings.
    func removeTags(_ keys: [Any])
    var tags: [String: String] { get }
    func setLanguage(_ language: String?)
    func addUserObserver(_ handler: @escaping ([String: Any]) -> Void) -> NativeObservation
    func addLoginFailureHandler(_ handler: @escaping ([String: Any]) -> Void) -> NativeObservation

    var pushSubscriptionId: String? { get }
    var pushSubscriptionToken: String? { get }
    var pushSubscriptionOptedIn: Bool { get }
    func optIn()
    func optOut()
    /// Each change as previous and current; EventRegistry adds the id of the JavaScript listener.
    func addSubscriptionObserver(_ handler: @escaping ([String: Any]) -> Void) -> NativeObservation

    var permission: Bool { get }
    var canRequestPermission: Bool { get }
    var permissionStatus: UNAuthorizationStatus { get }
    func requestPermission(fallbackToSettings: Bool, completion: @escaping (Bool) -> Void)
    func registerForProvisionalAuthorization(completion: @escaping (Bool) -> Void)
    func refreshPermission()
    func registerForRemoteNotifications()
    func didRegisterForRemoteNotifications(deviceToken: Data)
    func clearAll()
    func isSallaPushNotification(_ userInfo: [AnyHashable: Any]) -> Bool
    func addClickListener(_ handler: @escaping ([String: Any]) -> Void) -> NativeObservation
    /// Native calls `handler` synchronously on the main thread, before a SallaPush notification shows in the foreground.
    func addForegroundLifecycleListener(_ handler: @escaping (NativeWillDisplay) -> Void) -> NativeObservation
    func addPermissionObserver(_ handler: @escaping (Bool) -> Void) -> NativeObservation

    var logLevel: SallaPushLogLevel { get set }
    /// Native's one log handler for the process, called on native's own queue with each entry in bridge form;
    /// cancelling the registration removes it.
    func setLogHandler(level: SallaPushLogLevel, _ handler: @escaping ([String: Any]) -> Void) -> NativeObservation
}

final class LiveNativeSallaPush: NativeSallaPush {
    func initialize(_ appId: String, configuration: SallaPushConfiguration) {
        SallaPush.initialize(appId, withLaunchOptions: nil, configuration: configuration)
    }

    var isInitialized: Bool { SallaPush.isInitialized }

    var appId: String? { SallaPush.appId }

    var sdkVersion: String { SallaPush.sdkVersion }

    func setConsentRequired(_ required: Bool) {
        SallaPush.setConsentRequired(required)
    }

    func setConsentGiven(_ given: Bool) {
        SallaPush.setConsentGiven(given)
    }

    func login(externalId: String, identityToken: String) {
        SallaPush.login(externalId: externalId, identityToken: identityToken)
    }

    func logout() {
        SallaPush.logout()
    }

    var externalId: String? { SallaPush.User.externalId }

    var isLoggedIn: Bool { SallaPush.User.isLoggedIn }

    func addTag(key: String, value: String) {
        SallaPush.User.addTag(key: key, value: value)
    }

    // Swift can't name the Objective-C forms (`@available(swift, obsoleted: 1)`), so their selectors are sent.
    func addTags(_ tags: [AnyHashable: Any]) {
        _ = SallaPush.User.perform(NSSelectorFromString("addTags:"), with: tags)
    }

    func removeTag(_ key: String) {
        SallaPush.User.removeTag(key)
    }

    func removeTags(_ keys: [Any]) {
        _ = SallaPush.User.perform(NSSelectorFromString("removeTags:"), with: keys)
    }

    var tags: [String: String] { SallaPush.User.getTags() }

    func setLanguage(_ language: String?) {
        SallaPush.User.setLanguage(language)
    }

    func addUserObserver(_ handler: @escaping ([String: Any]) -> Void) -> NativeObservation {
        SallaPush.User.addObserver { handler(Mapping.userChange($0)) }
    }

    func addLoginFailureHandler(_ handler: @escaping ([String: Any]) -> Void) -> NativeObservation {
        SallaPush.User.addLoginFailureHandler { handler(Mapping.loginFailure($0)) }
    }

    var pushSubscriptionId: String? { SallaPush.User.pushSubscription.id }

    var pushSubscriptionToken: String? { SallaPush.User.pushSubscription.token }

    var pushSubscriptionOptedIn: Bool { SallaPush.User.pushSubscription.optedIn }

    func optIn() {
        SallaPush.User.pushSubscription.optIn()
    }

    func optOut() {
        SallaPush.User.pushSubscription.optOut()
    }

    func addSubscriptionObserver(_ handler: @escaping ([String: Any]) -> Void) -> NativeObservation {
        SallaPush.User.pushSubscription.addObserver { handler(Mapping.subscriptionChange($0)) }
    }

    var permission: Bool { SallaPush.Notifications.permission }

    var canRequestPermission: Bool { SallaPush.Notifications.canRequestPermission }

    var permissionStatus: UNAuthorizationStatus { SallaPush.Notifications.permissionStatus }

    func requestPermission(fallbackToSettings: Bool, completion: @escaping (Bool) -> Void) {
        SallaPush.Notifications.requestPermission(fallbackToSettings: fallbackToSettings) { completion($0) }
    }

    func registerForProvisionalAuthorization(completion: @escaping (Bool) -> Void) {
        SallaPush.Notifications.registerForProvisionalAuthorization { completion($0) }
    }

    func refreshPermission() {
        SallaPush.Notifications.refreshPermission()
    }

    func registerForRemoteNotifications() {
        SallaPush.Notifications.registerForRemoteNotifications()
    }

    func didRegisterForRemoteNotifications(deviceToken: Data) {
        SallaPush.Notifications.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }

    func clearAll() {
        SallaPush.Notifications.clearAll()
    }

    func isSallaPushNotification(_ userInfo: [AnyHashable: Any]) -> Bool {
        SallaPush.Notifications.isSallaPushNotification(userInfo)
    }

    func addClickListener(_ handler: @escaping ([String: Any]) -> Void) -> NativeObservation {
        SallaPush.Notifications.addClickListener { handler(Mapping.click($0)) }
    }

    func addForegroundLifecycleListener(_ handler: @escaping (NativeWillDisplay) -> Void) -> NativeObservation {
        SallaPush.Notifications.addForegroundLifecycleListener { event in
            handler(NativeWillDisplay(notification: Mapping.notification(event.notification),
                                      preventDefault: event.preventDefault, display: event.notification.display))
        }
    }

    func addPermissionObserver(_ handler: @escaping (Bool) -> Void) -> NativeObservation {
        SallaPush.Notifications.addPermissionObserver { handler($0) }
    }

    var logLevel: SallaPushLogLevel {
        get { SallaPush.Debug.logLevel }
        set { SallaPush.Debug.logLevel = newValue }
    }

    func setLogHandler(level: SallaPushLogLevel, _ handler: @escaping ([String: Any]) -> Void) -> NativeObservation {
        SallaPush.Debug.setLogHandler(level: level) { handler(Mapping.logEntry($0)) }
        return LogHandlerRegistration()
    }
}

/// The process-wide log handler as a registration.
private final class LogHandlerRegistration: NativeObservation {
    func cancel() {
        SallaPush.Debug.setLogHandler(level: .warn, nil)
    }
}
