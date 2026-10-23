# SallaPush Capacitor SDK

SallaPush is Salla's push notification service. This package brings it to Capacitor apps. Its TypeScript API calls the
native SallaPush iOS and Android SDKs, so an app behaves as a native SallaPush app does. The API follows OneSignal v5,
so most calls will look familiar.

- **Version:** 1.0.0. It wraps SallaPush iOS 1.0.4 and SallaPush Android 1.0.4. See
  [CHANGELOG.md](CHANGELOG.md).

## Features

- Starts SallaPush natively at launch, from Info.plist keys and manifest meta-data. Taps, background pushes, the
  opt-out and consent then work as in a native app, also in processes where no JavaScript runs.
- Registers the device and keeps its push token up to date.
- Links the signed-in customer to the device. Salla checks the customer's token first.
- Keeps tags, the language and the opt-in state on the server.
- Reports `received`, `displayed` and `opened` events on its own, and `dismissed` on Android.
- Hands taps, foreground notifications, permission, customer and subscription changes, and log entries to JavaScript
  listeners.
- Capacitor 8, on iOS with Swift Package Manager or CocoaPods, and on Android.
- No swizzling. It keeps working beside `@capacitor/push-notifications`, `@capacitor/local-notifications`,
  `@capacitor-firebase/messaging` and OneSignal.
- Every call is safe at any time, before or after initialization. No call throws on iOS and Android: bad input is
  logged and ignored. On the web SallaPush isn't available, and its calls say so.

## Requirements

| Wrapper | SallaPush iOS | SallaPush Android | Framework | iOS | Android | Node |
|---|---|---|---|---|---|---|
| Capacitor 1.0.0 | 1.0.4 | 1.0.4 | Capacitor 8 (8.0 or later; Capacitor 9 isn't supported yet) | 15.0, Xcode 26 | minSdk 24 (SallaPush itself needs 23), compileSdk 36, JDK 21 | 22 or later, for Capacitor 8's CLI |

- **A SallaPush app id from the Salla team:** see [Get started](#get-started).
- **Check the Capacitor version yourself before you upgrade Capacitor:** some tools only warn about Capacitor 9
  ([Versions](docs/SETUP.md#versions)).

## Get started

SallaPush is for the mobile apps of Salla stores.

1. **Get an app id for iOS and one for Android.** Contact the Salla team for your app id.
2. **Set up the push credentials with the Salla team.** On iOS, the Salla team adds your APNs key (the `.p8` key, its
   key id and your Apple team id) and your bundle id to your iOS app id. On Android, it sets up your Android app id
   with a Firebase project: use that project's `google-services.json`. Until then, devices register, but no
   notification arrives. Never share keys or Firebase files in an issue or a pull request.
3. **Sign customers in with their Salla token.** `SallaPush.login(externalId, identityToken)` takes the customer's id
   and the customer token your app received when the customer signed in. Salla checks the token, and links the device
   only when the token belongs to that customer.
4. **Send a test notification.** Ask the Salla team to send one to your device id,
   `await SallaPush.User.pushSubscription.getId()`.

Report SDK bugs in [GitHub issues](https://github.com/SallaApp/sallapush-capacitor-sdk/issues), and security problems as
[SECURITY.md](SECURITY.md) explains. What SallaPush collects, for your app's privacy details in App Store Connect and
its Data safety form in Google Play Console, is listed in the native SDKs' docs:
[iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/BEHAVIOUR.md#what-sallapush-sends) and
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/BEHAVIOUR.md#what-sallapush-sends).

## Installation

Install the package from npm:

```sh
npm install @salla.sa/sallapush-capacitor
```

With Yarn, run `yarn add @salla.sa/sallapush-capacitor`, and keep Yarn's `node_modules` folder
(`nodeLinker: node-modules`), where Capacitor's CLI looks for plugins. pnpm, Yarn 1 and Bun aren't verified yet. Each
release is also a git tag of this repository, which installs over HTTPS ([Install](docs/SETUP.md#install)).

Then run `npx cap sync`, which adds the plugin to both native projects:

- **Swift Package Manager,** Capacitor 8's default (`ios/App/CapApp-SPM` exists): nothing more. The plugin's Swift
  package brings SallaPush. Never add the SallaPush pods to such an app.
- **CocoaPods:** before the first `npx cap sync`, add the SallaPush pods to `ios/App/Podfile`, inside
  `target 'App' do`, after `capacitor_pods`. Without them, `npx cap sync ios` fails with "Unable to find a
  specification for SallaPush" ([Swift Package Manager or CocoaPods](docs/SETUP.md#swift-package-manager-or-cocoapods)).

<!-- snippet:docs/snippets/Podfile#podfile-app -->
```ruby
pod 'SallaPushCore', :git => 'https://github.com/SallaApp/sallapush-ios-sdk.git', :tag => '1.0.4'
pod 'SallaPush', :git => 'https://github.com/SallaApp/sallapush-ios-sdk.git', :tag => '1.0.4'
```

### Updating the package

Run `npm update @salla.sa/sallapush-capacitor`, or `npm install @salla.sa/sallapush-capacitor@<version>`. When the new
release names another SallaPush iOS version, move the SallaPush pins your app holds itself before you run
`npx cap sync`: every SallaPush `:tag =>` of the Podfile, or the rule of the extension's SallaPush package. Then run
`npx cap sync` ([Updating the package](docs/SETUP.md#updating-the-package)).

## Setup

### iOS

**Capabilities.** In the App target of `ios/App/App.xcodeproj`, under **Signing & Capabilities**, add **Push
Notifications** and **Background Modes → Remote notifications**. Capacitor's template doesn't have the background
mode.

**The app id.** SallaPush starts natively at launch when `ios/App/App/Info.plist` names its app id. Set it from a build
setting, `SALLAPUSH_APP_ID`, defined for every build configuration, in an xcconfig or the App target's **Build
Settings**. An undefined setting expands to an empty value, and SallaPush then doesn't start
([Info.plist](docs/SETUP.md#infoplist)).

<!-- snippet:example-app/ios/App/App/Info.plist#app-id -->
```xml
<key>SallaPushAppId</key>
<string>$(SALLAPUSH_APP_ID)</string>
```

**The AppDelegate.** In `ios/App/App/AppDelegate.swift`, add the import, start SallaPush as the first statement of
`application(_:didFinishLaunchingWithOptions:)`, and add the three forwarding methods to the class:

<!-- snippet:example-app/ios/App/App/AppDelegate.swift#imports -->
```swift
import SallaPushCapacitorPlugin
```

<!-- snippet:example-app/ios/App/App/AppDelegate.swift#start -->
```swift
SallaPushCapacitor.start()
```

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

- **`SallaPushCapacitor.start()` comes first:** iOS hands the tap that launched the app to the delegate set during
  launch. Never set `UNUserNotificationCenter.current().delegate` below it: that replaces SallaPush's delegate.
- **SallaPush never calls your completion handlers:** call each one, once.
- **With another push plugin, an Objective-C app delegate, or an app created with Capacitor 8.0 to 8.4:** see
  [AppDelegate](docs/SETUP.md#appdelegate) and [Another push plugin](docs/SETUP.md#another-push-plugin).

**The Notification Service Extension,** optional and recommended, shows the images of SallaPush notifications and
reports `received`. Add a `SallaPushNotificationService` target with SallaPush's `SallaPushExtension` library and the
example's `NotificationService.swift`
([Notification Service Extension](docs/SETUP.md#notification-service-extension)).

### Android

**Maven Central and JDK 21.** Gradle downloads SallaPush Android from Maven Central, which Capacitor's template
already declares: there is no repository or token to add. Build with a JDK 21 ([JDK 21](docs/SETUP.md#jdk-21)).

**Firebase.** Put the `google-services.json` of the Firebase project that the Salla team set up for your app id in
`android/app`, and leave Firebase's auto-init on. With another project's file, no notification arrives
([Firebase](docs/SETUP.md#firebase)).

**The app id and the notification icon.** Inside `<application>` in `android/app/src/main/AndroidManifest.xml`:

<!-- snippet:example-app/android/app/src/main/AndroidManifest.xml#meta-data -->
```xml
<meta-data android:name="com.salla.push.APP_ID" android:value="${sallaPushAppId}" />
<meta-data
    android:name="com.salla.push.default_notification_icon"
    android:resource="@drawable/ic_stat_sallapush" />
```

Define the placeholder in `defaultConfig` in `android/app/build.gradle`:

<!-- snippet:docs/snippets/app-build.gradle#placeholders -->
```groovy
manifestPlaceholders += [sallaPushAppId: "your_app_id"]
```

The icon must be white on transparent: use your own
([App id and notification icon](docs/SETUP.md#app-id-and-notification-icon)).

**Another FCM plugin.** With `@capacitor/push-notifications`, `@capacitor-firebase/messaging` or another FCM SDK in
the app, its service takes every message, and SallaPush shows nothing. Add a service that hands each message to
SallaPush first ([Another FCM plugin](docs/SETUP.md#another-fcm-plugin)).

## Usage

The same code serves Angular, React, Vue and plain TypeScript apps. In an Angular app that uses zone.js, run the work
of a listener that navigates or changes a screen in `NgZone.run` ([Quick start](docs/SETUP.md#quick-start)). Every
member is described in [docs/REFERENCE.md](docs/REFERENCE.md#api-reference).

### Initialize

SallaPush starts natively from the app id of the [Setup](#setup), before JavaScript runs. In your app's entry module,
before your framework renders the first screen (Angular's `src/main.ts`, React's `src/main.tsx`, Vue's
`src/main.ts`), add the [click listener](#handling-notifications-and-deep-links) and make the launch identity call.
The example's start-up code:

<!-- snippet:example-app/src/start.ts#launch-identity -->
```ts
const customer = currentCustomer();
if (customer) {
  SallaPush.login(customer.externalId, customer.identityToken);
} else {
  SallaPush.logout();
}
```

- `currentCustomer()` stands for your app's session.
- **An app id known only at run time:** call `SallaPush.initialize(appId)` instead of the static app id. It costs
  native behaviour wherever no JavaScript runs yet
  ([Initializing from JavaScript](docs/SETUP.md#initializing-from-javascript)).
- **Consent first (PDPL):** set `SallaPushRequiresUserConsent` to `YES` in the Info.plist and
  `com.salla.push.REQUIRES_USER_CONSENT` to `true` in the manifest, or, with `initialize`, call
  `SallaPush.setConsentRequired(true)` before it at every launch. Then call `SallaPush.setConsentGiven(true)` once the
  user agrees ([Consent](docs/SETUP.md#consent)).

### Customer login and logout

At every launch, call exactly one of `login` or `logout`, as above. Then call `login` when the customer signs in, and
`logout` when they sign out. The example's session:

<!-- snippet:example-app/src/session.ts#sign-in-out -->
```ts
export function customerDidSignIn(signedIn: Customer): void {
  customer = signedIn;
  SallaPush.login(signedIn.externalId, signedIn.identityToken);
}

export function customerDidSignOut(): void {
  customer = null;
  SallaPush.logout();
}
```

- **Pass the customer's id and their Salla token,** without a `Bearer ` prefix. Salla checks the token, and the device
  is linked only when the token belongs to that id. SallaPush keeps the token in memory only: call `login` again when
  your app refreshes it.
- **`logout()` needs no token and works offline.** The device stays registered as a guest. Call it before the next
  customer's `login`.
- **Watch for login failures** with `SallaPush.User.addEventListener('loginFailure', …)`: `tokenRejected` or
  `invalidRequest`. Don't call `login` again from that listener
  ([Sign-in and sign-out](docs/SETUP.md#sign-in-and-sign-out)).

### Notification permission

SallaPush never shows the system prompt on its own. Ask where it fits your app:

<!-- snippet:example-app/src/readmeSnippets/notifications.ts#request-permission -->
```ts
const granted = await SallaPush.Notifications.requestPermission(true);
```

`true` opens the app's notification settings when the system no longer shows the prompt. To let customers turn
SallaPush notifications off and on in your app, call `SallaPush.User.pushSubscription.optOut()` and `optIn()`
([Notification permission](docs/SETUP.md#notification-permission)).

### Handling notifications and deep links

Add the click listener at app start, in your entry module, as the example does. It gets every tap on a SallaPush
notification: `event.notification`, and `event.result.url`, its launch URL.

<!-- snippet:example-app/src/start.ts#click-listener -->
```ts
SallaPush.Notifications.addEventListener('click', (event) => {
  route(event.notification);
});
```

- **Cold starts.** Taps made before the first click listener, such as the tap that launched the app, wait natively,
  and arrive once it is added: a listener added later, in a screen, misses them. The tap can arrive before your
  navigation is ready: keep the destination, and open it once your navigation is.
- **Route with the typed getters** in `route`, your app's navigation, never with raw payload keys: `getString`,
  `getInt` and `getBool`, and `getNumber` on iOS, read your data from both payload formats, such as
  `notification.getInt('id')` ([Routing with the typed getters](docs/SETUP.md#routing-with-the-typed-getters)).
- **Launch URLs.** SallaPush opens a notification's https launch URL itself only with the open-launch-URLs option;
  otherwise route it yourself. A launch URL is whatever the sender set: check its scheme and host before you open it
  ([Taps](docs/SETUP.md#taps)).

### Tags

Tags are string keys and values stored on the server for this device:

<!-- snippet:example-app/src/readmeSnippets/user.ts#tags -->
```ts
SallaPush.User.addTag('add_to_cart', String(Math.floor(Date.now() / 1000)));
SallaPush.User.addTags({
  total_cart_amount: String(total),
  cart_items: String(items),
});
```

- Remove tags with `removeTag` and `removeTags`.
- Keys are trimmed and lowercased, then must be 1 to 64 characters of `a-z`, `0-9` and `_`. Values are cut at 255
  characters, and an empty value removes the tag. A device holds at most 100 tags.
- Set tags after the launch `login` or `logout` call. By default (`clearTagsOnLogout`), a logout and an account switch
  delete the device's tags.
- Pass your app's language, such as `ar`, with `SallaPush.User.setLanguage(code)` whenever it changes
  ([Tags and language](docs/SETUP.md#tags-and-language)).

### Events

SallaPush reports `received`, `displayed` and `opened` for its own notifications, and `dismissed` on Android. You call
nothing. Your listeners get the rest:

- **`SallaPush.User.pushSubscription`'s `'change'`** gets the current state once the device is registered, then every
  change of the device id, the push token and the opted-in state. The push token is private: don't send it to analytics or third parties.
- **`SallaPush.User`'s `'change'`** reports login changes, and `'loginFailure'` each refusal of the current login.
- **`SallaPush.Notifications`' `'permissionChange'`** reports changes between allowed and not allowed.
- **`addEventListener` returns a subscription,** whose `remove()` removes the listener. A page load removes every
  listener: add them in start-up code that runs at every page load ([Events](docs/SETUP.md#events)).

**Foreground notifications.** Without a `'foregroundWillDisplay'` listener, SallaPush shows its notifications in the
foreground itself. A listener can hold one back with `event.preventDefault()`, called before any `await`. On iOS, a
notification shown while a listener exists is SallaPush's local copy, without its image and action buttons, so add the
listener only where your app decides per notification, such as a chat screen, and remove it when the screen goes
([Foreground notifications](docs/SETUP.md#foreground-notifications)).

### Logging

The default level is `warn`. Turn on more detail while you integrate:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#log-level -->
```ts
SallaPush.Debug.setLogLevel(SallaPushLogLevel.Verbose);
```

To forward entries to your own telemetry:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#log-handler -->
```ts
SallaPush.Debug.setLogHandler(SallaPushLogLevel.Error, (entry) => {
  telemetry.report('sallapush', entry.code, entry.message, entry.metadata);
});
```

- **The consoles.** SallaPush logs to the unified log on iOS, subsystem `com.salla.push`, and to Logcat on Android,
  tag `SallaPush`. The static keys `SallaPushLogLevel` and `com.salla.push.LOG_LEVEL` set the level too.
- **Every entry has a stable `code`,** such as `register.ok`. Match on it, not on the message. Secrets and identity
  tokens are never logged.
- **Privacy, with SallaPush iOS 1.0.4:** the info entries `status.launch` and `status.changed` hold the full push token
  and the customer's id. Keep the console level at `warn` in release builds, and don't forward info entries to third
  parties ([Logging](docs/SETUP.md#logging)).

## Migrating from OneSignal

**Keep the OneSignal SDK in your app until the Salla team confirms you can remove it.** Add SallaPush next to it,
keep OneSignal initialized, and keep `ios.handleApplicationNotifications` set to `false` in `capacitor.config`, as
OneSignal's Capacitor setup asks.

| `@onesignal/capacitor-plugin` 1.2 | SallaPush |
|---|---|
| `OneSignal.initialize(appId)` | The static app id, or `SallaPush.initialize(appId)` |
| `OneSignal.login(externalId)` | `SallaPush.login(externalId, identityToken)`, with the customer's Salla token |
| `OneSignal.logout()` | `SallaPush.logout()`, at every launch while signed out too |
| `OneSignal.User.addTag`, `addTags`, `removeTag`, `removeTags`, `getTags` | The same names on `SallaPush.User` |
| `OneSignal.User.pushSubscription.getIdAsync`, `getTokenAsync`, `getOptedInAsync` | `SallaPush.User.pushSubscription.getId`, `getToken`, `getOptedIn` |
| `OneSignal.User.pushSubscription.optIn`, `optOut`, `addEventListener('change')` | The same names on `SallaPush.User.pushSubscription` |
| `OneSignal.Notifications.requestPermission(fallbackToSettings)` | `SallaPush.Notifications.requestPermission(fallbackToSettings)` |
| `OneSignal.Notifications.addEventListener('click')`, `('foregroundWillDisplay')`, `('permissionChange')` | The same events on `SallaPush.Notifications` |
| `OneSignal.Notifications.clearAll()` | `SallaPush.Notifications.clearAll()`, which removes SallaPush notifications only |
| `OneSignal.Debug.setLogLevel(level)` | `SallaPush.Debug.setLogLevel(level)` |
| `OneSignal.setConsentRequired(required)`, `setConsentGiven(given)` | The same names on `SallaPush` |

While both SDKs are in the app, route each notification once, decide foreground notifications with one synchronous
policy, and opt in and out on both SDKs. [Migrating from OneSignal](docs/SETUP.md#migrating-from-onesignal) has the
code for each.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npx cap sync ios` or `pod install`: "Unable to find a specification for SallaPush" | A CocoaPods app: add the [Podfile lines](#installation), then run `npx cap sync ios` again. |
| Gradle: `Could not find com.salla.push:sallapush` | Add `mavenCentral()` to your build's repositories, or to the settings' when they set `RepositoriesMode.PREFER_SETTINGS` ([Builds that refuse project repositories](docs/SETUP.md#builds-that-refuse-project-repositories)). |
| No notification on Android, or `token.firebase_missing` | Add the right project's `google-services.json`, and with another FCM plugin, the [forwarding service](docs/SETUP.md#another-fcm-plugin). |
| The tap that launched the app never reaches the click listener | Call `SallaPushCapacitor.start()` first in `didFinishLaunchingWithOptions`, and add the click listener in your entry module ([Initialize](#initialize)). |

[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) has the full list.

## More documentation

- [docs/SETUP.md](docs/SETUP.md): the full setup guide: every install path and package manager, the whole iOS and
  Android setup, the start-up code, events, consent, logging, initializing from JavaScript, coexistence with other push
  plugins, migrating from OneSignal, checking your integration and updating the native SDKs.
- [docs/REFERENCE.md](docs/REFERENCE.md): how the package works, the static configuration, the full API, events,
  foreground display, errors, data mapping, coexistence, logging and compatibility.
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): every known problem and its fix.
- [example-app/README.md](example-app/README.md): the example app, test pushes without a server, and its self-test.
- [CONTRIBUTING.md](CONTRIBUTING.md): working on this package, its checks and its pull requests.
- [RELEASING.md](RELEASING.md): versions, releases, native updates and the checks on devices.
- [CHANGELOG.md](CHANGELOG.md): the changes of each release.
- The native SDKs' docs: [iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/README.md) and
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/README.md).

## License

The SallaPush Capacitor SDK is available under the [MIT License](LICENSE).
