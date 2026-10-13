import Foundation
import SallaPush

/// The plugin's method logic. SallaPushPlugin reads each call's options and calls it on the main thread; apps don't use
/// it.
final class SallaPushBridge {
    private let native: NativeSallaPush
    private let console: ConsoleOutput
    private let earlyInit: () -> StaticConfig?

    init(native: NativeSallaPush, console: ConsoleOutput, earlyInit: @escaping () -> StaticConfig?) {
        self.native = native
        self.console = console
        self.earlyInit = earlyInit
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
    var appGroupIdentifier: String?
    var apnsEnvironment: SallaPushAPNsEnvironment?
    var autoClearBadge: Bool?
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
            appGroupIdentifier: options["iosAppGroupIdentifier"] as? String,
            apnsEnvironment: (options["iosApnsEnvironment"] as? String).flatMap(SallaPushAPNsEnvironment.init(name:)),
            autoClearBadge: options["iosAutoClearBadge"] as? Bool,
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
        if let appGroupIdentifier { configuration.appGroupIdentifier = appGroupIdentifier }
        if let apnsEnvironment { configuration.apnsEnvironment = apnsEnvironment }
        if let autoClearBadge { configuration.autoClearBadge = autoClearBadge }
        if let registerForRemoteNotificationsOnInit {
            configuration.registerForRemoteNotificationsOnInit = registerForRemoteNotificationsOnInit
        }
        return configuration
    }

    /// The given options that only the first initialize applies, each with the Info.plist key that sets it at launch.
    var startOptions: [(option: String, key: String)] {
        let options: [(option: String, key: String)?] = [
            logLevel.map { _ in ("logLevel", "SallaPushLogLevel") },
            appVersion.map { _ in ("appVersion", StaticConfig.Key.appVersion) },
            clearTagsOnLogout.map { _ in ("clearTagsOnLogout", StaticConfig.Key.clearTagsOnLogout) },
            requiresUserConsent.map { _ in ("requiresUserConsent", StaticConfig.Key.requiresUserConsent) },
            openLaunchUrls.map { _ in ("openLaunchUrls", StaticConfig.Key.openLaunchURLs) },
            appGroupIdentifier.map { _ in ("ios.appGroupIdentifier", "SallaPushAppGroup") },
            apnsEnvironment.map { _ in ("ios.apnsEnvironment", StaticConfig.Key.apnsEnvironment) },
            autoClearBadge.map { _ in ("ios.autoClearBadge", StaticConfig.Key.autoClearBadge) },
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
