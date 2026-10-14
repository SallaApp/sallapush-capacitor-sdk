import SallaPushExtension
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
    // Reads the App Group from this extension's Info.plist key SallaPushAppGroup.
    private let sallaPush = SallaPushServiceExtension()

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        if sallaPush.didReceive(request, withContentHandler: contentHandler) { return }
        // Not a SallaPush notification: hand it to your other SDKs here, or deliver it unchanged.
        contentHandler(request.content)
    }

    override func serviceExtensionTimeWillExpire() {
        sallaPush.serviceExtensionTimeWillExpire()
    }
}
