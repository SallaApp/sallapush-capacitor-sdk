import SallaPush
@testable import SallaPushCapacitorPlugin
import XCTest

/// The bridge form of real SallaPush notifications, which native's own parse(_:) builds from the test payloads.
final class MappingTests: XCTestCase {
    // MARK: - Notifications

    func testMapsTheNativeTestPayload() throws {
        let notification = try parse(TestNotifications.payload("native"))

        let body = Mapping.notification(notification) as NSDictionary

        XCTAssertEqual(body["notificationId"] as? String, "msg_5a11a90001")
        XCTAssertEqual(body["title"] as? String, "SallaPush test")
        XCTAssertEqual(body["body"] as? String, "A native SallaPush notification")
        XCTAssertEqual(body["launchUrl"] as? String, "https://example.com/products/42")
        XCTAssertEqual(body["sound"] as? String, "default")
        XCTAssertEqual(body["source"] as? String, "native")
        XCTAssertEqual(body["additionalData"] as? NSDictionary, notification.additionalData as NSDictionary)
        for key in ["subtitle", "imageUrl", "badge", "threadId"] {
            XCTAssertNil(body[key], key)
        }
    }

    func testMapsTheCompatibleTestPayload() throws {
        let payload = try TestNotifications.payload("compat")
        let notification = try parse(payload)

        let body = Mapping.notification(notification) as NSDictionary

        XCTAssertEqual(body["notificationId"] as? String, "msg_5a11a90002")
        XCTAssertEqual(body["body"] as? String, "A OneSignal-compatible SallaPush notification")
        XCTAssertEqual(body["launchUrl"] as? String, "https://example.com/products/42")
        XCTAssertEqual(body["source"] as? String, "compat")
        XCTAssertEqual(body["additionalData"] as? NSDictionary, ["type": "product", "id": 42])
        XCTAssertEqual(body["rawPayload"] as? NSDictionary, payload as NSDictionary)
    }

    func testMapsEveryOptionalField() throws {
        let notification = try parse([
            "aps": [
                "alert": ["title": "Order shipped", "subtitle": "Today", "body": "On its way"],
                "badge": 3,
                "sound": "chime",
                "thread-id": "orders"
            ] as [String: Any],
            "sp_v": "1",
            "sp_id": "msg_5a11a90003",
            "sp_image": "https://example.com/order.png",
            "sp_url": "salla://orders/42"
        ])

        let body = Mapping.notification(notification) as NSDictionary

        XCTAssertEqual(body["subtitle"] as? String, "Today")
        XCTAssertEqual(body["imageUrl"] as? String, "https://example.com/order.png")
        XCTAssertEqual(body["launchUrl"] as? String, "salla://orders/42")
        XCTAssertEqual(body["badge"] as? Int, 3)
        XCTAssertEqual(body["sound"] as? String, "chime")
        XCTAssertEqual(body["threadId"] as? String, "orders")
    }

    func testTheTypedValuesAreNativesAccessorResultsForEveryKey() throws {
        for name in ["native", "compat"] {
            let notification = try parse(TestNotifications.payload(name))
            let body = Mapping.notification(notification)
            let strings = try XCTUnwrap(body["stringValues"] as? [String: String])
            let ints = try XCTUnwrap(body["intValues"] as? [String: Int])
            let bools = try XCTUnwrap(body["boolValues"] as? [String: Bool])
            let numbers = try XCTUnwrap(body["numberValues"] as? [String: NSNumber])

            XCTAssertFalse(notification.additionalData.isEmpty, name)
            for key in notification.additionalData.keys {
                XCTAssertEqual(strings[key], notification.string(forKey: key), "\(name) \(key)")
                XCTAssertEqual(ints[key], notification.int(forKey: key), "\(name) \(key)")
                XCTAssertEqual(bools[key], notification.bool(forKey: key), "\(name) \(key)")
                XCTAssertEqual(numbers[key]?.doubleValue, notification.number(forKey: key)?.doubleValue, "\(name) \(key)")
            }
            let keys = Set(notification.additionalData.keys)
            XCTAssertTrue(Set(strings.keys).union(ints.keys).union(bools.keys).union(numbers.keys).isSubset(of: keys))
        }
    }

    func testTheTypedValuesOfStringAndJSONData() throws {
        let native = Mapping.notification(try parse(TestNotifications.payload("native")))
        let compat = Mapping.notification(try parse(TestNotifications.payload("compat")))

        XCTAssertEqual(native["intValues"] as? [String: Int], ["id": 42])
        XCTAssertEqual((native["stringValues"] as? [String: String])?["type"], "product")
        XCTAssertEqual(compat["stringValues"] as? [String: String], ["type": "product", "id": "42"])
        XCTAssertEqual(compat["intValues"] as? [String: Int], ["id": 42])
        XCTAssertEqual(compat["numberValues"] as? [String: NSNumber], ["id": 42])
    }

    func testAJSONBooleanIsANumberNotABooleanForGetNumber() throws {
        let notification = try parse([
            "aps": ["alert": "Hi"],
            "custom": ["i": "os-id", "a": ["push_ref": "msg_5a11a90004", "express": true] as [String: Any]] as [String: Any]
        ])

        let body = Mapping.notification(notification)
        let number = try XCTUnwrap((body["numberValues"] as? [String: NSNumber])?["express"])

        XCTAssertNotEqual(CFGetTypeID(number), CFBooleanGetTypeID())
        XCTAssertEqual(number.intValue, 1)
        XCTAssertEqual(body["boolValues"] as? [String: Bool], ["express": true])
        XCTAssertEqual(body["stringValues"] as? [String: String], ["express": "true"])
    }

    func testTheRawPayloadKeepsOnlyJSONValuesWithTextKeys() throws {
        var payload = try TestNotifications.payload("native")
        payload["received_at"] = Date()
        payload["blob"] = Data([1, 2])
        payload[7] = "seven"
        payload["nested"] = ["at": Date(), "list": [1, Date(), "x", NSNull()] as [Any]] as [String: Any]

        let raw = try XCTUnwrap(Mapping.notification(parse(payload))["rawPayload"] as? [String: Any])

        XCTAssertTrue(JSONSerialization.isValidJSONObject(raw))
        XCTAssertNil(raw["received_at"])
        XCTAssertNil(raw["blob"])
        XCTAssertEqual(raw["7"] as? String, "seven")
        XCTAssertEqual(raw["sp_id"] as? String, "msg_5a11a90001")
        XCTAssertEqual(raw["nested"] as? NSDictionary, ["list": [1, "x", NSNull()] as [Any]])
    }

    // Capacitor turns the event into JSON for JavaScript, so it must be valid JSON as it is.
    func testANotificationIsValidJSON() throws {
        for name in ["native", "compat"] {
            XCTAssertTrue(JSONSerialization.isValidJSONObject(Mapping.notification(try parse(TestNotifications.payload(name)))))
        }
    }

    // MARK: - Events

    func testMapsPermissionChanges() {
        XCTAssertEqual(Mapping.permissionChange(true) as NSDictionary, ["permission": true])
        XCTAssertEqual(Mapping.permissionChange(false) as NSDictionary, ["permission": false])
    }

    func testNamesEnumsByCase() {
        XCTAssertEqual(Mapping.loginFailure(.tokenRejected) as NSDictionary, ["failure": "tokenRejected"])
        XCTAssertEqual(Mapping.loginFailure(.invalidRequest) as NSDictionary, ["failure": "invalidRequest"])
        XCTAssertEqual(SallaPushPayloadSource.native.name, "native")
        XCTAssertEqual(SallaPushPayloadSource.compat.name, "compat")
    }

    private func parse(_ payload: [AnyHashable: Any]) throws -> SallaPushNotification {
        try XCTUnwrap(SallaPush.Notifications.parse(payload))
    }
}
