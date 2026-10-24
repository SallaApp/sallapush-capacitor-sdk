# SallaPush Capacitor SDK

Push notifications for the Capacitor apps of [Salla](https://salla.dev) stores, on iOS and Android.

[![npm](https://img.shields.io/npm/v/@salla.sa/sallapush-capacitor?color=004956)](https://www.npmjs.com/package/@salla.sa/sallapush-capacitor) [![Capacitor 8](https://img.shields.io/badge/Capacitor-8-004956?logo=capacitor&logoColor=white)](#requirements) [![License: MIT](https://img.shields.io/github/license/SallaApp/sallapush-capacitor-sdk?color=004956)](LICENSE) [![CI](https://img.shields.io/github/actions/workflow/status/SallaApp/sallapush-capacitor-sdk/ci.yml?branch=master&label=CI)](https://github.com/SallaApp/sallapush-capacitor-sdk/actions/workflows/ci.yml)

[Installation](#installation) · [Quick start](#quick-start) · [API reference](docs/REFERENCE.md) ·
[Troubleshooting](docs/TROUBLESHOOTING.md) · [Changelog](CHANGELOG.md)

> **SallaPush is for the mobile apps of Salla stores.** Contact the Salla team for your app id.

- **Version:** 1.0.0. It wraps SallaPush iOS 1.0.4 and SallaPush Android 1.0.4. See [CHANGELOG.md](CHANGELOG.md).
- **Also for:** [iOS](https://github.com/SallaApp/sallapush-ios-sdk) · [Android](https://github.com/SallaApp/sallapush-android-sdk) · [Flutter](https://github.com/SallaApp/sallapush-flutter-sdk) · [React Native](https://github.com/SallaApp/sallapush-react-native-sdk)

## Requirements

| Wrapper | SallaPush iOS | SallaPush Android | Framework | iOS | Android | Node |
|---|---|---|---|---|---|---|
| Capacitor 1.0.0 | 1.0.4 | 1.0.4 | Capacitor 8 (Capacitor 9 isn't supported yet) | 15.0, Xcode 26 | minSdk 24, compileSdk 36, JDK 21 | 22 or later |

SallaPush needs an app id for iOS and one for Android. On the web its calls fail: check
`Capacitor.isNativePlatform()` first.

## Installation

```sh
npm install @salla.sa/sallapush-capacitor
npx cap sync
```

- **Yarn 4:** `yarn add @salla.sa/sallapush-capacitor`, with `nodeLinker: node-modules` in `.yarnrc.yml`.
- **From git:** each release is also a git tag of this repository. Add
  `"@salla.sa/sallapush-capacitor": "git+https://github.com/SallaApp/sallapush-capacitor-sdk.git#<version>"` to your
  app's dependencies. npm 12 needs `allow-git=root` in the app's `.npmrc`; Yarn 4.14 or later needs the repository's
  URL in `approvedGitRepositories` of `.yarnrc.yml`.
- **Android, and iOS with Swift Package Manager** (Capacitor 8's default, with `ios/App/CapApp-SPM`): nothing to add.
  Never add the SallaPush pods to such an app.
- **iOS with CocoaPods:** before the first `npx cap sync`, add these lines to `ios/App/Podfile`, in `target 'App' do`,
  after `capacitor_pods`. Without them, `npx cap sync ios` fails: "Unable to find a specification for SallaPush".

<!-- snippet:docs/snippets/Podfile#podfile-app -->
```ruby
pod 'SallaPushCore', :git => 'https://github.com/SallaApp/sallapush-ios-sdk.git', :tag => '1.0.4'
pod 'SallaPush', :git => 'https://github.com/SallaApp/sallapush-ios-sdk.git', :tag => '1.0.4'
```

**Updating:** run `npm update @salla.sa/sallapush-capacitor`. When the new release's row in
[Requirements](#requirements) names another SallaPush iOS version, first set your app's own SallaPush pins to it:
every `:tag =>` of the Podfile, or the extension's SallaPush package rule. Then run `npx cap sync`.

## Platform setup

### iOS

**1. Capabilities.** In the App target, under **Signing & Capabilities**, add **Push Notifications** and **Background
Modes → Remote notifications**.

**2. The app id,** in `ios/App/App/Info.plist`, from a build setting, `SALLAPUSH_APP_ID`, that every build
configuration defines in an xcconfig or the target's **Build Settings**. With an empty value, SallaPush doesn't start.

<!-- snippet:example-app/ios/App/App/Info.plist#app-id -->
```xml
<key>SallaPushAppId</key>
<string>$(SALLAPUSH_APP_ID)</string>
```

**3. The AppDelegate.** In `ios/App/App/AppDelegate.swift`, add `import SallaPushCapacitorPlugin`, call
`SallaPushCapacitor.start()` as the first statement of `application(_:didFinishLaunchingWithOptions:)`, and add these
methods; add SallaPush's line to those it already has. Set no `UNUserNotificationCenter.current().delegate` after
`start()`: SallaPush would get no taps.

<!-- snippet:example-app/ios/App/App/AppDelegate.swift#forwarding -->
```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    SallaPush.Notifications.didRegisterForRemoteNotifications(deviceToken: deviceToken)
}

func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    SallaPush.Notifications.didFailToRegisterForRemoteNotifications(error: error)
}

func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                 fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    SallaPush.Notifications.didReceiveRemoteNotification(userInfo)
    completionHandler(.noData)
}
```

**4. The Notification Service Extension,** recommended: it shows images, reports `received` and counts the
[badge](#badges). Add a **Notification Service Extension** target, `SallaPushNotificationService`, with the app's
deployment target, version and build, and give it the `SallaPushExtension` library, never `SallaPush`: with Swift
Package Manager, `https://github.com/SallaApp/sallapush-ios-sdk.git` at the **Exact Version** of
[Requirements](#requirements), for the extension target only; with CocoaPods, this target at the Podfile's top level:

<!-- snippet:docs/snippets/Podfile#podfile-extension -->
```ruby
target 'SallaPushNotificationService' do
  pod 'SallaPushCore', :git => 'https://github.com/SallaApp/sallapush-ios-sdk.git', :tag => '1.0.4'
  pod 'SallaPushExtension', :git => 'https://github.com/SallaApp/sallapush-ios-sdk.git', :tag => '1.0.4'
end
```

Replace its `NotificationService.swift` with this one. `didReceive` returns false and doesn't handle the notification
when it isn't a SallaPush notification.

<!-- snippet:example-app/ios/App/SallaPushNotificationService/NotificationService.swift -->
```swift
import SallaPushExtension
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
    private var sallaPushService: SallaPushServiceExtension?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        if SallaPushServiceExtension.isSallaPushNotification(request) {
            // Reads the App Group from this extension's Info.plist key SallaPushAppGroup.
            sallaPushService = SallaPushServiceExtension()
            sallaPushService?.didReceive(request, withContentHandler: contentHandler)
        } else {
            // Not a SallaPush notification: hand it to your other SDKs here, or deliver it unchanged.
            contentHandler(request.content)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        sallaPushService?.serviceExtensionTimeWillExpire()
    }
}
```

**5. An App Group,** which the badge count and `received` need: add the App Groups capability with the same group to
both targets, and this key to both Info.plist files, with `SALLAPUSH_APP_GROUP` defined for both targets (in the
project's base xcconfig or **Build Settings**).

<!-- snippet:example-app/ios/App/App/Info.plist#app-group -->
```xml
<key>SallaPushAppGroup</key>
<string>$(SALLAPUSH_APP_GROUP)</string>
```

### Android

**1. Firebase.** Android receives pushes through Firebase Cloud Messaging: put your app's `google-services.json` in
`android/app`, and leave Firebase's auto-init on.

**2. The app id and the notification icon,** inside `<application>` in `android/app/src/main/AndroidManifest.xml`,
and the app id's placeholder in `defaultConfig` of `android/app/build.gradle`. The icon must be white on transparent:
`ic_stat_sallapush` is the example's drawable, so name your own.

<!-- snippet:example-app/android/app/src/main/AndroidManifest.xml#meta-data -->
```xml
<meta-data android:name="com.salla.push.APP_ID" android:value="${sallaPushAppId}" />
<meta-data
    android:name="com.salla.push.default_notification_icon"
    android:resource="@drawable/ic_stat_sallapush" />
```

<!-- snippet:docs/snippets/app-build.gradle#placeholders -->
```groovy
manifestPlaceholders += [sallaPushAppId: "your_app_id"]
```

**3. Another push plugin.** Android hands each push message to one service. When another plugin in your app declares
one, it takes every message, and SallaPush shows nothing: add the
[forwarding service](docs/REFERENCE.md#another-push-plugin-on-android), which hands each message to SallaPush first.

## Quick start

In your app's entry module, before your framework renders its first screen (Angular's `src/main.ts`, React's
`src/main.tsx`, Vue's `src/main.ts`), import SallaPush and add the click listener. Taps made before it, such as the tap
that launched the app, wait and arrive once it is added.

<!-- snippet:example-app/src/readmeSnippets/platform.ts#import -->
```ts
import { SallaPush } from '@salla.sa/sallapush-capacitor';
```

<!-- snippet:example-app/src/start.ts#click-listener -->
```ts
SallaPush.Notifications.addEventListener('click', (event) => {
  route(event.notification);
});
```

Ask for permission where it fits your app; SallaPush never shows the system prompt on its own:

<!-- snippet:example-app/src/readmeSnippets/notifications.ts#request-permission -->
```ts
const granted = await SallaPush.Notifications.requestPermission(true);
```

`route` stands for your app's navigation; in an Angular app with zone.js, run it in `NgZone.run`. An app that knows its
app id only at run time calls [`SallaPush.initialize(appId)`](docs/REFERENCE.md#sallapush) first.

## Usage

### Login and logout

Pass the customer's id and the Salla token your app received for them, without `Bearer `:

<!-- snippet:example-app/src/readmeSnippets/user.ts#login-logout -->
```ts
// After the customer signs in, and at each app launch while they are signed in:
SallaPush.login(externalId, identityToken);

// After the customer signs out:
SallaPush.logout();
```

At each app launch while nobody is signed in, call `SallaPush.logout()` too: on iOS, a reinstall keeps the earlier
install's customer linked until then.

### Notification permission

`requestPermission(true)` also opens the app's notification settings when the prompt no longer shows; `getPermission()`
resolves whether notifications are allowed.

### Notification taps and deep links

- **Taps:** the click listener gets `event.notification`, the launch URL in `event.result.url`, and on iOS the tapped
  action button in `event.result.actionId`. Route with the typed getters, such as `notification.getString('type')`
  and `notification.getInt('id')`.
- **Launch URLs:** SallaPush opens https launch URLs itself only when `SallaPushOpenLaunchURLs` (Info.plist),
  `com.salla.push.OPEN_LAUNCH_URLS` (manifest) or `openLaunchUrls` in `initialize`'s config is on: then don't open
  `result.url` again. Check a launch URL's scheme and host before you open it.
- **Other events:** `'foregroundWillDisplay'` and `'permissionChange'` on `SallaPush.Notifications`, `'change'` and
  `'loginFailure'` on `SallaPush.User`, and `'change'` on `SallaPush.User.pushSubscription`. `remove()` on the
  subscription `addEventListener` returns stops a listener; a page load removes them all, so add them at start-up.

### Foreground notifications

Without a `'foregroundWillDisplay'` listener, SallaPush shows its notifications in the foreground itself. A listener
can hold each one back, such as on a chat screen, which removes it when it closes:

<!-- snippet:example-app/src/readmeSnippets/notifications.ts#will-display -->
```ts
const chatListener = SallaPush.Notifications.addEventListener(
  'foregroundWillDisplay',
  (event) => {
    if (event.notification.getString('chat_id') === chatId) {
      event.preventDefault(); // before any await: it counts only while the listener runs
    }
  }
);
```

`event.notification.display()` shows a held notification later, once, within 10 minutes. On iOS, a notification shown
while a listener exists is SallaPush's local copy, without its image and action buttons.

### Tags and language

<!-- snippet:example-app/src/readmeSnippets/user.ts#tags -->
```ts
SallaPush.User.addTag('add_to_cart', String(Math.floor(Date.now() / 1000)));
SallaPush.User.addTags({
  total_cart_amount: String(total),
  cart_items: String(items),
});
```

- `removeTag` and `removeTags` remove tags, and `getTags()` resolves them. Keys are lowercased, at most 64 characters
  of `a-z`, `0-9` and `_`; values are cut at 255 characters; a device holds at most 100 tags.
- A logout and an account switch delete the tags, unless `SallaPushClearTagsOnLogout` (Info.plist),
  `com.salla.push.CLEAR_TAGS_ON_LOGOUT` (manifest) or `clearTagsOnLogout` in `initialize`'s config is `false`.
- `SallaPush.User.setLanguage(code)` sets the customer's language, such as `ar`; `null` means the device language.

### Push subscription

`SallaPush.User.pushSubscription.optOut()` turns SallaPush notifications off on this device, and `optIn()` turns them
back on. Its `'change'` listener gets the device id, the push token and the opted-in state once the device is
registered, then every change: read them there, since right after a cold start the getters show only this launch's
calls. The push token is private: don't send it to analytics or third parties.

### Consent

If your app needs the user's consent first (PDPL), require it at every launch: set `SallaPushRequiresUserConsent`
(Info.plist) to `YES` and `com.salla.push.REQUIRES_USER_CONSENT` (manifest) to `true`, or, with `initialize`, call
`setConsentRequired(true)` before it:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#consent-required -->
```ts
SallaPush.setConsentRequired(true);
SallaPush.initialize(appId);
```

Then pass the user's choice to `SallaPush.setConsentGiven(…)` whenever they make it. Until consent is given, SallaPush
sends nothing; withdrawing it opts the device out, deletes its tags and unlinks it.

### Logging

The default level is `warn`. While you integrate, set `SallaPushLogLevel` (Info.plist) and `com.salla.push.LOG_LEVEL`
(manifest) to `verbose`, and filter the logs on `SallaPush` (Xcode, `adb logcat -s SallaPush`): a first launch logs
`init.started`, then `token.received` and `register.ok`. `SallaPush.Debug.setLogLevel(level)` changes the level at run
time, and `SallaPush.Debug.setLogHandler(level, handler)` forwards entries at `level` or more severe to your
telemetry. Match entries on their stable `code`
([iOS codes](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/LOGGING.md#log-code-reference),
[Android codes](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/LOGGING.md#log-code-reference)).
Ship with the level at `warn`, and never set Capacitor's `loggingBehavior` to `'production'`: it logs `login`'s token.

### Badges

On iOS, each SallaPush notification adds 1 to the app icon's badge, which goes back to 0 when the app opens; counting
needs the [Notification Service Extension](#ios) and the App Group. On Android, the launcher counts the notifications
in the shade; opening the app removes nothing by default. Set these keys next to the static app id, or pass the
settings to `initialize`, where a setting given applies to both platforms and one left out keeps each one's default:

| Setting | Info.plist | Manifest meta-data | Default |
|---|---|---|---|
| `autoClearBadge`: clear the badge when the app opens | `SallaPushAutoClearBadge` | `com.salla.push.AUTO_CLEAR_BADGE` | `true` on iOS, `false` on Android |
| `autoUpdateBadge`: count SallaPush notifications | `SallaPushAutoUpdateBadge` | `com.salla.push.AUTO_UPDATE_BADGE` | `true` |

On Android, `autoClearBadge` removes SallaPush's notifications from the shade when the app comes to the foreground.
`clearAll()` removes SallaPush's notifications, and on iOS sets the badge to 0 while `autoUpdateBadge` is on
([Badges](docs/REFERENCE.md#badges)).

## SallaPush and other push SDKs

SallaPush never swizzles, and handles only its own notifications: its calls return false for every other one, so the
order of your forwarding lines doesn't matter.

- **iOS:** `SallaPush.Notifications.didReceiveRemoteNotification(_:)` returns true for a SallaPush notification: hand
  another SDK only the notifications for which it returns false. When another SDK takes the APNs token, also pass it to
  `SallaPush.Notifications.forwardApnsToken` in JavaScript, as hexadecimal text.
- **A shared Notification Service Extension:** call SallaPush first, and hand the other SDK only the notifications for
  which `SallaPushServiceExtension.isSallaPushNotification(request)` is false.
- **Android:** add the forwarding service of [Platform setup](#android).
- **Calls that reach every SDK:** don't unregister the app from remote notifications or delete its push token from
  another SDK, and remove SallaPush's notifications with `clearAll()`, not with a call that removes all of the app's.

## Example app

[example-app](example-app) is a Capacitor 8.5 app that runs the plugin from this repository's sources and makes every
API call. Its [README](example-app/README.md) says how to set your app ids and run it.

## Troubleshooting

| Problem or log code | Fix |
|---|---|
| `npx cap sync ios`: "Unable to find a specification for SallaPush" | A CocoaPods app: add the [Podfile lines](#installation), then run `npx cap sync ios` again. |
| `token.firebase_missing`, or no notification on Android | Add your app's `google-services.json`; with another push plugin, the [forwarding service](#android). |
| The tap that launched the app never reaches the click listener | Call `SallaPushCapacitor.start()` first in `didFinishLaunchingWithOptions`, and add the click listener in your entry module. |

[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) has more.

## Support

- **SDK bugs and feature requests:**
  [open an issue](https://github.com/SallaApp/sallapush-capacitor-sdk/issues/new/choose) with the SDK, Capacitor and OS
  versions, how you installed SallaPush, and its log codes at verbose level. Never paste tokens, keys or customer data.
- **App ids:** Contact the Salla team for your app id.

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Everyone taking part follows the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

The SallaPush Capacitor SDK is available under the [MIT License](LICENSE).
