import Foundation
import SallaPush
import UserNotifications

/// The plugin's method logic. SallaPushPlugin reads each call's options and calls it on the main thread; apps don't use
/// it.
final class SallaPushBridge {
    private let native: NativeSallaPush
    private let console: ConsoleOutput
    private let once: OncePerProcess
    private let earlyInit: () -> StaticConfig?
    private let displays: DisplayStore
    private let events: EventRegistry

    /// The logic over `native`; it emits events through `emitter`, held weakly.
    init(native: NativeSallaPush, console: ConsoleOutput, once: OncePerProcess, emitter: SallaPushEventEmitter,
         earlyInit: @escaping () -> StaticConfig?) {
        self.native = native
        self.console = console
        self.once = once
        self.earlyInit = earlyInit
        displays = DisplayStore(console: console)
        events = EventRegistry(native: native, displays: displays, emitter: emitter)
    }

    // MARK: - Initialization and consent

    /// Initializes SallaPush with the `ConfigSpec` fields that JavaScript set, keyed by name.
    func initialize(appId: String, options: [String: Any]) {
        let options = InitOptions(options)
        if let earlyInit = earlyInit(), earlyInit.appId == appId, options.apiBaseUrl == nil {
            reportIgnoredOptions(options.startOptions)
        }
        native.initialize(appId, configuration: options.configuration())
    }

    var isInitialized: Bool { native.isInitialized }

    var appId: String? { native.appId }

    var sdkVersion: String { native.sdkVersion }

    func setConsentRequired(_ required: Bool) {
        if required, let earlyInit = earlyInit(), earlyInit.requiresUserConsent != true {
            let key = StaticConfig.Key.requiresUserConsent
            console.error("setConsentRequired(true) came after SallaPush started from SallaPushAppId without \(key), "
                + "so the device may already have registered and sent data. Set \(key) to YES in the Info.plist to "
                + "require consent from the start.")
        }
        native.setConsentRequired(required)
    }

    func setConsentGiven(_ given: Bool) {
        native.setConsentGiven(given)
    }

    // MARK: - Identity

    func login(externalId: String, identityToken: String) {
        native.login(externalId: externalId, identityToken: identityToken)
    }

    func logout() {
        native.logout()
    }

    // MARK: - User

    var externalId: String? { native.externalId }

    var isLoggedIn: Bool { native.isLoggedIn }

    func addTag(key: String, value: String) {
        native.addTag(key: key, value: value)
    }

    /// The tags from JavaScript, entries unchecked: native skips and logs the ones that aren't strings.
    func addTags(_ tags: [AnyHashable: Any]) {
        native.addTags(tags)
    }

    func removeTag(_ key: String) {
        native.removeTag(key)
    }

    /// The keys from JavaScript, unchecked: native skips and logs the ones that aren't strings.
    func removeTags(_ keys: [Any]) {
        native.removeTags(keys)
    }

    var tags: [String: String] { native.tags }

    func setLanguage(_ language: String?) {
        native.setLanguage(language)
    }

    // MARK: - Push subscription

    var pushSubscriptionId: String? { native.pushSubscriptionId }

    var pushSubscriptionToken: String? { native.pushSubscriptionToken }

    var pushSubscriptionOptedIn: Bool { native.pushSubscriptionOptedIn }

    func optIn() {
        native.optIn()
    }

    func optOut() {
        native.optOut()
    }

    // MARK: - Notifications

    var permission: Bool { native.permission }

    var canRequestPermission: Bool { native.canRequestPermission }

    var permissionStatus: String { native.permissionStatus.name }

    func requestPermission(fallbackToSettings: Bool, completion: @escaping (Bool) -> Void) {
        native.requestPermission(fallbackToSettings: fallbackToSettings, completion: completion)
    }

    func registerForProvisionalAuthorization(completion: @escaping (Bool) -> Void) {
        native.registerForProvisionalAuthorization(completion: completion)
    }

    func refreshPermission() {
        native.refreshPermission()
    }

    func registerForRemoteNotifications() {
        native.registerForRemoteNotifications()
    }

    /// Forwards the APNs token another SDK holds, given as hexadecimal text, as native's token data.
    func forwardApnsToken(_ apnsToken: String) {
        guard let deviceToken = Data(hexadecimal: apnsToken) else {
            console.error("Notifications.forwardApnsToken ignored: the APNs token must be hexadecimal text of even "
                + "length, as @capacitor-firebase/messaging's apnsTokenReceived event gives it.")
            return
        }
        native.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }

    func clearAll() {
        native.clearAll()
    }

    func removeNotification() {
        once.info("Notifications.removeNotification is Android only and does nothing on iOS.", to: console)
    }

    /// Whether a payload from JavaScript is SallaPush's; its null values are dropped first.
    func isSallaPushNotification(_ payload: [String: Any]) -> Bool {
        native.isSallaPushNotification(payload.filter { !($0.value is NSNull) })
    }

    /// Shows a foreground notification held for JavaScript: it wasn't prevented there, or the app calls display().
    func displayNotification(_ handle: String) {
        displays.display(handle)
    }

    func trackOpened() -> Bool {
        once.info("Notifications.trackOpened is Android only and resolves false on iOS, where taps on OneSignal-format "
            + "SallaPush notifications reach SallaPush through its notification-center delegate.", to: console)
        return false
    }

    // MARK: - Debug and migration

    /// The console log level by its JavaScript name; a name that isn't a level is ignored.
    var logLevel: String {
        get { native.logLevel.name }
        set {
            guard let level = SallaPushLogLevel(name: newValue) else { return }
            native.logLevel = level
        }
    }

    /// The level of JavaScript's log handler; a name that isn't a level is ignored.
    func setLogHandlerLevel(_ level: String) {
        guard let level = SallaPushLogLevel(name: level) else { return }
        events.setLogLevel(level)
    }

    func setDisplayOneSignalCompatPayloads() {
        once.info("Migration.setDisplayOneSignalCompatPayloads is Android only and does nothing on iOS.", to: console)
    }

    // MARK: - Events

    /// Registers the native listener of an event kind once JavaScript listens to it; an unknown kind is ignored.
    func startEvents(_ kind: String) {
        guard let kind = EventRegistry.Kind(rawValue: kind) else { return }
        events.start(kind)
    }

    func stopEvents(_ kind: String) {
        guard let kind = EventRegistry.Kind(rawValue: kind) else { return }
        events.stop(kind)
    }

    func addPushSubscriptionListener(_ listenerId: Int) {
        events.addSubscriptionListener(listenerId)
    }

    func removePushSubscriptionListener(_ listenerId: Int) {
        events.removeSubscriptionListener(listenerId)
    }

    /// Removes every native registration and forgets the held notifications: the plugin calls it when the WebView loads
    /// a page, and when it is released.
    func reset() {
        events.stopAll()
        displays.clear()
    }

    // MARK: - Console

    /// A second initialize with the static app id and API host changes nothing natively, its options included.
    private func reportIgnoredOptions(_ options: [(option: String, key: String)]) {
        guard !options.isEmpty else { return }
        let names = options.map(\.option).joined(separator: ", ")
        let keys = options.map(\.key).joined(separator: ", ")
        console.error("initialize ignored \(names): SallaPush already started with this app id from SallaPushAppId, "
            + "so the call changes nothing. Set them with the Info.plist keys \(keys) instead.")
    }
}

/// The options of a JavaScript `initialize` call; nil means the option was left out.
struct InitOptions {
    var apiBaseUrl: String?
    var logLevel: SallaPushLogLevel?
    var appVersion: String?
    var clearTagsOnLogout: Bool?
    var requiresUserConsent: Bool?
    var openLaunchUrls: Bool?
    var autoClearBadge: Bool?
    var autoUpdateBadge: Bool?
    var appGroupIdentifier: String?
    var apnsEnvironment: SallaPushAPNsEnvironment?
    /// The deprecated `ios.autoClearBadge`: it applies only when `autoClearBadge` is left out.
    var iosAutoClearBadge: Bool?
    var registerForRemoteNotificationsOnInit: Bool?
}

extension InitOptions {
    init(_ options: [String: Any]) {
        self.init(
            apiBaseUrl: options["apiBaseUrl"] as? String,
            logLevel: (options["logLevel"] as? String).flatMap(SallaPushLogLevel.init(name:)),
            appVersion: options["appVersion"] as? String,
            clearTagsOnLogout: options["clearTagsOnLogout"] as? Bool,
            requiresUserConsent: options["requiresUserConsent"] as? Bool,
            openLaunchUrls: options["openLaunchUrls"] as? Bool,
            autoClearBadge: options["autoClearBadge"] as? Bool,
            autoUpdateBadge: options["autoUpdateBadge"] as? Bool,
            appGroupIdentifier: options["iosAppGroupIdentifier"] as? String,
            apnsEnvironment: (options["iosApnsEnvironment"] as? String).flatMap(SallaPushAPNsEnvironment.init(name:)),
            iosAutoClearBadge: options["iosAutoClearBadge"] as? Bool,
            registerForRemoteNotificationsOnInit: options["iosRegisterForRemoteNotificationsOnInit"] as? Bool
        )
    }

    /// The native configuration with the options that were given, and native's defaults for the others.
    func configuration() -> SallaPushConfiguration {
        let configuration = SallaPushConfiguration()
        if let apiBaseUrl {
            // Text that isn't a URL reaches native as an invalid URL, so native logs config.invalid_base_url and uses
            // production, as on Android; nil would mean the Info.plist URL.
            let text = apiBaseUrl.trimmingCharacters(in: .whitespacesAndNewlines)
            configuration.apiBaseURL = URL(string: text) ?? URL(fileURLWithPath: "/")
        }
        if let logLevel { configuration.logLevel = logLevel }
        if let appVersion { configuration.appVersion = appVersion }
        if let clearTagsOnLogout { configuration.clearTagsOnLogout = clearTagsOnLogout }
        if let requiresUserConsent { configuration.requiresUserConsent = requiresUserConsent }
        if let openLaunchUrls { configuration.openLaunchURLs = openLaunchUrls }
        applyBadgeOptions(to: configuration)
        if let appGroupIdentifier { configuration.appGroupIdentifier = appGroupIdentifier }
        if let apnsEnvironment { configuration.apnsEnvironment = apnsEnvironment }
        if let registerForRemoteNotificationsOnInit {
            configuration.registerForRemoteNotificationsOnInit = registerForRemoteNotificationsOnInit
        }
        return configuration
    }

    /// The badge options: autoClearBadge, else the deprecated ios.autoClearBadge, and autoUpdateBadge.
    private func applyBadgeOptions(to configuration: SallaPushConfiguration) {
        if let autoClearBadge = autoClearBadge ?? iosAutoClearBadge { configuration.autoClearBadge = autoClearBadge }
        if let autoUpdateBadge { configuration.autoUpdateBadge = autoUpdateBadge }
    }

    /// The given options that only the first initialize applies, each with the Info.plist key that sets it at launch.
    var startOptions: [(option: String, key: String)] {
        let options: [(option: String, key: String)?] = [
            logLevel.map { _ in ("logLevel", "SallaPushLogLevel") },
            appVersion.map { _ in ("appVersion", StaticConfig.Key.appVersion) },
            clearTagsOnLogout.map { _ in ("clearTagsOnLogout", StaticConfig.Key.clearTagsOnLogout) },
            requiresUserConsent.map { _ in ("requiresUserConsent", StaticConfig.Key.requiresUserConsent) },
            openLaunchUrls.map { _ in ("openLaunchUrls", StaticConfig.Key.openLaunchURLs) },
            autoClearBadge.map { _ in ("autoClearBadge", StaticConfig.Key.autoClearBadge) },
            autoUpdateBadge.map { _ in ("autoUpdateBadge", StaticConfig.Key.autoUpdateBadge) },
            appGroupIdentifier.map { _ in ("ios.appGroupIdentifier", "SallaPushAppGroup") },
            apnsEnvironment.map { _ in ("ios.apnsEnvironment", StaticConfig.Key.apnsEnvironment) },
            // The deprecated alias counts only without autoClearBadge, which would win over it.
            (autoClearBadge == nil ? iosAutoClearBadge : nil).map { _ in
                ("ios.autoClearBadge", StaticConfig.Key.autoClearBadge)
            },
            registerForRemoteNotificationsOnInit.map { _ in
                ("ios.registerForRemoteNotificationsOnInit", StaticConfig.Key.registerForRemoteNotificationsOnInit)
            }
        ]
        return options.compactMap { $0 }
    }
}

extension SallaPushLogLevel {
    /// The level named as JavaScript names it.
    init?(name: String) {
        switch name {
        case "off": self = .off
        case "error": self = .error
        case "warn": self = .warn
        case "info": self = .info
        case "debug": self = .debug
        case "verbose": self = .verbose
        default: return nil
        }
    }

    /// The level's JavaScript name.
    var name: String {
        switch self {
        case .off: return "off"
        case .error: return "error"
        case .warn: return "warn"
        case .info: return "info"
        case .debug: return "debug"
        case .verbose: return "verbose"
        }
    }
}

extension SallaPushAPNsEnvironment {
    /// The environment named as JavaScript and the Info.plist name it.
    init?(name: String) {
        switch name {
        case "automatic": self = .automatic
        case "sandbox": self = .sandbox
        case "production": self = .production
        default: return nil
        }
    }
}

extension UNAuthorizationStatus {
    /// The status as JavaScript names it; a status newer than this SDK reads as notDetermined.
    var name: String {
        switch self {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "notDetermined"
        }
    }
}

extension Data {
    /// The bytes of hexadecimal text of even length, in either case; nil for any other text.
    init?(hexadecimal text: String) {
        let digits = Array(text.utf8)
        guard !digits.isEmpty, digits.count.isMultiple(of: 2) else { return nil }
        var bytes: [UInt8] = []
        bytes.reserveCapacity(digits.count / 2)
        for index in stride(from: 0, to: digits.count, by: 2) {
            guard let high = Self.hexadecimalValue(digits[index]),
                  let low = Self.hexadecimalValue(digits[index + 1]) else { return nil }
            bytes.append(high << 4 | low)
        }
        self.init(bytes)
    }

    private static func hexadecimalValue(_ digit: UInt8) -> UInt8? {
        switch digit {
        case UInt8(ascii: "0")...UInt8(ascii: "9"): return digit - UInt8(ascii: "0")
        case UInt8(ascii: "a")...UInt8(ascii: "f"): return digit - UInt8(ascii: "a") + 10
        case UInt8(ascii: "A")...UInt8(ascii: "F"): return digit - UInt8(ascii: "A") + 10
        default: return nil
        }
    }
}
