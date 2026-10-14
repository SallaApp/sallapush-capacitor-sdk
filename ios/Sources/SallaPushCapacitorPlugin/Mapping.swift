import Foundation
import SallaPush

/// Native values as the JavaScript events carry them: nil values are left out, and enums go by case.
enum Mapping {
    static func click(_ event: SallaPushClickEvent) -> [String: Any] {
        var body: [String: Any] = ["notification": notification(event.notification)]
        body["actionId"] = event.result.actionId
        body["url"] = event.result.url
        return body
    }

    /// A held foreground notification, already in bridge form, with its handle.
    static func willDisplay(_ notification: [String: Any], handle: String) -> [String: Any] {
        ["handle": handle, "notification": notification]
    }

    /// The notification, with the results of native's typed accessors for each top-level additionalData key.
    static func notification(_ notification: SallaPushNotification) -> [String: Any] {
        let keys = Array(notification.additionalData.keys)
        var body: [String: Any] = [
            "additionalData": notification.additionalData,
            "rawPayload": jsonObject(notification.rawPayload),
            "source": notification.source.name,
            "stringValues": values(of: keys, notification.string(forKey:)),
            "intValues": values(of: keys, notification.int(forKey:)),
            "boolValues": values(of: keys, notification.bool(forKey:)),
            "numberValues": values(of: keys) { notification.number(forKey: $0).map(numeric) }
        ]
        body["notificationId"] = notification.notificationId
        body["title"] = notification.title
        body["subtitle"] = notification.subtitle
        body["body"] = notification.body
        body["imageUrl"] = notification.imageURL?.absoluteString
        body["launchUrl"] = notification.launchURL
        body["sound"] = notification.sound
        body["badge"] = notification.badge?.intValue
        body["threadId"] = notification.threadId
        return body
    }

    static func permissionChange(_ permission: Bool) -> [String: Any] {
        ["permission": permission]
    }

    static func userChange(_ change: SallaPushUserChangedState) -> [String: Any] {
        ["previous": user(change.previous), "current": user(change.current)]
    }

    static func loginFailure(_ failure: SallaPushLoginFailure) -> [String: Any] {
        ["failure": failure.name]
    }

    /// The change without a listener id: EventRegistry adds the id of the JavaScript listener whose observer got it.
    static func subscriptionChange(_ change: SallaPushSubscriptionChangedState) -> [String: Any] {
        ["previous": subscription(change.previous), "current": subscription(change.current)]
    }

    private static func user(_ state: SallaPushUserState) -> [String: Any] {
        var body: [String: Any] = ["isLoggedIn": state.isLoggedIn]
        body["externalId"] = state.externalId
        return body
    }

    private static func subscription(_ state: SallaPushSubscriptionState) -> [String: Any] {
        var body: [String: Any] = ["optedIn": state.optedIn]
        body["id"] = state.id
        body["token"] = state.token
        return body
    }

    /// The non-nil results of one accessor, by key.
    private static func values<Value>(of keys: [String], _ accessor: (String) -> Value?) -> [String: Value] {
        keys.reduce(into: [:]) { values, key in values[key] = accessor(key) }
    }

    /// A number as JavaScript reads it. number(forKey:) returns a JSON boolean as it is, which counts as 1 or 0.
    private static func numeric(_ number: NSNumber) -> NSNumber {
        CFGetTypeID(number) == CFBooleanGetTypeID() ? NSNumber(value: number.boolValue ? 1 : 0) : number
    }

    /// The JSON values of a payload, keys as text; values the bridge can't carry, such as dates and data, are left out.
    private static func jsonObject(_ dictionary: [AnyHashable: Any]) -> [String: Any] {
        dictionary.reduce(into: [:]) { object, entry in object["\(entry.key)"] = jsonValue(entry.value) }
    }

    private static func jsonValue(_ value: Any) -> Any? {
        switch value {
        case let string as String: return string
        case let number as NSNumber: return number
        case is NSNull: return NSNull()
        case let dictionary as [AnyHashable: Any]: return jsonObject(dictionary)
        case let array as [Any]: return array.compactMap(jsonValue)
        default: return nil
        }
    }
}

extension SallaPushPayloadSource {
    /// The source as JavaScript names it.
    var name: String {
        switch self {
        case .native: return "native"
        case .compat: return "compat"
        }
    }
}

extension SallaPushLoginFailure {
    /// The failure as JavaScript names it.
    var name: String {
        switch self {
        case .tokenRejected: return "tokenRejected"
        case .invalidRequest: return "invalidRequest"
        }
    }
}
