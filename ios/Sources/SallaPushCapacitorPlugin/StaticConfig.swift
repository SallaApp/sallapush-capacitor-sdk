import Foundation
import SallaPush

/// The SallaPush… Info.plist keys that only the wrapper reads. Nil means the key is absent and native's default applies.
/// SallaPush reads its own keys (SallaPushLogLevel, SallaPushAPIBaseURL, SallaPushAppGroup) itself.
struct StaticConfig: Equatable {
    var appId: String?
    var openLaunchURLs: Bool?
    var requiresUserConsent: Bool?
    var clearTagsOnLogout: Bool?
    var appVersion: String?
    var autoClearBadge: Bool?
    var registerForRemoteNotificationsOnInit: Bool?
    var apnsEnvironment: SallaPushAPNsEnvironment?
}

extension StaticConfig {
    enum Key {
        static let appId = "SallaPushAppId"
        static let openLaunchURLs = "SallaPushOpenLaunchURLs"
        static let requiresUserConsent = "SallaPushRequiresUserConsent"
        static let clearTagsOnLogout = "SallaPushClearTagsOnLogout"
        static let appVersion = "SallaPushAppVersion"
        static let autoClearBadge = "SallaPushAutoClearBadge"
        static let registerForRemoteNotificationsOnInit = "SallaPushRegisterForRemoteNotificationsOnInit"
        static let apnsEnvironment = "SallaPushAPNsEnvironment"
    }

    init(info: [String: Any], console: ConsoleOutput) {
        let reader = InfoReader(info: info, console: console)
        self.init(
            appId: reader.text(Key.appId),
            openLaunchURLs: reader.flag(Key.openLaunchURLs),
            requiresUserConsent: reader.flag(Key.requiresUserConsent),
            clearTagsOnLogout: reader.flag(Key.clearTagsOnLogout),
            appVersion: reader.text(Key.appVersion),
            autoClearBadge: reader.flag(Key.autoClearBadge),
            registerForRemoteNotificationsOnInit: reader.flag(Key.registerForRemoteNotificationsOnInit),
            apnsEnvironment: reader.apnsEnvironment(Key.apnsEnvironment)
        )
    }

    /// The native configuration with the options the Info.plist sets, and native's defaults for the others.
    func configuration() -> SallaPushConfiguration {
        let configuration = SallaPushConfiguration()
        if let openLaunchURLs { configuration.openLaunchURLs = openLaunchURLs }
        if let requiresUserConsent { configuration.requiresUserConsent = requiresUserConsent }
        if let clearTagsOnLogout { configuration.clearTagsOnLogout = clearTagsOnLogout }
        if let appVersion { configuration.appVersion = appVersion }
        if let autoClearBadge { configuration.autoClearBadge = autoClearBadge }
        if let registerForRemoteNotificationsOnInit {
            configuration.registerForRemoteNotificationsOnInit = registerForRemoteNotificationsOnInit
        }
        if let apnsEnvironment { configuration.apnsEnvironment = apnsEnvironment }
        return configuration
    }
}

/// Reads keys that may come through build settings, where an unset variable expands to "".
private struct InfoReader {
    let info: [String: Any]
    let console: ConsoleOutput

    func text(_ key: String) -> String? {
        guard let value = info[key] else { return nil }
        guard let text = value as? String else {
            console.error("Ignored \(key): it must be a String.")
            return nil
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    func flag(_ key: String) -> Bool? {
        guard let value = info[key] else { return nil }
        if let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() {
            return number.boolValue
        }
        guard value is String else {
            console.error("Ignored \(key): it must be a Boolean, or a String: true, false, YES, NO, 1 or 0.")
            return nil
        }
        guard let text = text(key) else { return nil }
        switch text.lowercased() {
        case "true", "yes", "1":
            return true
        case "false", "no", "0":
            return false
        default:
            console.error("Ignored \(key): \"\(text)\" is not true, false, YES, NO, 1 or 0.")
            return nil
        }
    }

    func apnsEnvironment(_ key: String) -> SallaPushAPNsEnvironment? {
        guard let text = text(key) else { return nil }
        guard let environment = SallaPushAPNsEnvironment(name: text.lowercased()) else {
            console.error("Ignored \(key): \"\(text)\" is not automatic, sandbox or production.")
            return nil
        }
        return environment
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
