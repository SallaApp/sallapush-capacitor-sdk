import Foundation
import SallaPush
import UserNotifications

/// The native SallaPush calls the wrapper makes. Tests replace it with a fake.
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

    var pushSubscriptionId: String? { get }
    var pushSubscriptionToken: String? { get }
    var pushSubscriptionOptedIn: Bool { get }
    func optIn()
    func optOut()

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

    var logLevel: SallaPushLogLevel { get set }
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

    var pushSubscriptionId: String? { SallaPush.User.pushSubscription.id }

    var pushSubscriptionToken: String? { SallaPush.User.pushSubscription.token }

    var pushSubscriptionOptedIn: Bool { SallaPush.User.pushSubscription.optedIn }

    func optIn() {
        SallaPush.User.pushSubscription.optIn()
    }

    func optOut() {
        SallaPush.User.pushSubscription.optOut()
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

    var logLevel: SallaPushLogLevel {
        get { SallaPush.Debug.logLevel }
        set { SallaPush.Debug.logLevel = newValue }
    }
}
