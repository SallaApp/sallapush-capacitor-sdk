import UserNotifications
import XCTest

/// Real notifications for the delegate tests. UNNotification and UNNotificationResponse have no public initializer, but
/// both decode from a keyed archive of their parts.
enum TestNotifications {
    static let foreign: [AnyHashable: Any] = [
        "aps": ["alert": ["title": "Another SDK", "body": "Not a SallaPush notification"]],
        "provider_id": "other-sdk"
    ]

    /// A payload of example-app/ios/TestPayloads, as the app receives it.
    static func payload(_ name: String) throws -> [AnyHashable: Any] {
        let url = try XCTUnwrap(Bundle(for: BundleToken.self).url(forResource: name, withExtension: "apns"))
        let json = try JSONSerialization.jsonObject(with: Data(contentsOf: url))
        return try XCTUnwrap(json as? [AnyHashable: Any])
    }

    /// The trigger of a notification that APNs delivered. It has no public initializer either, and decodes from an
    /// empty keyed archive.
    static func pushTrigger() throws -> UNPushNotificationTrigger {
        let archiver = NSKeyedArchiver(requiringSecureCoding: false)
        archiver.finishEncoding()
        return try XCTUnwrap(UNPushNotificationTrigger(coder: unarchiver(of: archiver)))
    }

    static func notification(userInfo: [AnyHashable: Any], trigger: UNNotificationTrigger? = nil) throws -> UNNotification {
        let content = UNMutableNotificationContent()
        content.title = "Title"
        content.userInfo = userInfo
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger)
        let archiver = NSKeyedArchiver(requiringSecureCoding: false)
        archiver.encode(request, forKey: "request")
        archiver.encode(Date(), forKey: "date")
        archiver.finishEncoding()
        return try XCTUnwrap(UNNotification(coder: unarchiver(of: archiver)))
    }

    static func response(userInfo: [AnyHashable: Any], trigger: UNNotificationTrigger? = nil) throws -> UNNotificationResponse {
        let archiver = NSKeyedArchiver(requiringSecureCoding: false)
        archiver.encode(try notification(userInfo: userInfo, trigger: trigger), forKey: "notification")
        archiver.encode(UNNotificationDefaultActionIdentifier, forKey: "actionIdentifier")
        archiver.finishEncoding()
        return try XCTUnwrap(UNNotificationResponse(coder: unarchiver(of: archiver)))
    }

    private static func unarchiver(of archiver: NSKeyedArchiver) throws -> NSKeyedUnarchiver {
        let unarchiver = try NSKeyedUnarchiver(forReadingFrom: archiver.encodedData)
        unarchiver.requiresSecureCoding = false
        return unarchiver
    }
}

private final class BundleToken {}
