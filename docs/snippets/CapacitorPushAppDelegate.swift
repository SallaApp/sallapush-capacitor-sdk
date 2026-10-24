// The AppDelegate of a Capacitor 8.5 app (the UIScene template) that also has another push plugin: each forwarding
// method calls SallaPush, then posts what the other plugin observes. scripts/verify.sh consumer builds this whole file
// in an app with such a plugin.
import Capacitor
import SallaPushCapacitorPlugin
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        SallaPushCapacitor.start()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        SallaPush.Notifications.didRegisterForRemoteNotifications(deviceToken: deviceToken)
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        SallaPush.Notifications.didFailToRegisterForRemoteNotifications(error: error)
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        // Another plugin may report every posted notification: post only those that aren't SallaPush's.
        if !SallaPush.Notifications.didReceiveRemoteNotification(userInfo) {
            NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"),
                                            object: completionHandler, userInfo: userInfo)
        }
        completionHandler(.noData)
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
