# SallaPush Capacitor SDK

Push notifications for the Capacitor apps of [Salla](https://salla.dev) stores. Its TypeScript API calls the native
SallaPush SDKs, so your app behaves as a native SallaPush app does, and its names follow OneSignal v5.

[![npm](https://img.shields.io/npm/v/@salla.sa/sallapush-capacitor?color=004956)](https://www.npmjs.com/package/@salla.sa/sallapush-capacitor) [![Capacitor 8](https://img.shields.io/badge/Capacitor-8-004956?logo=capacitor&logoColor=white)](#requirements) [![License: MIT](https://img.shields.io/github/license/SallaApp/sallapush-capacitor-sdk?color=004956)](LICENSE) [![CI](https://img.shields.io/github/actions/workflow/status/SallaApp/sallapush-capacitor-sdk/ci.yml?branch=master&label=CI)](https://github.com/SallaApp/sallapush-capacitor-sdk/actions/workflows/ci.yml)

[Quick start](#quick-start) · [Documentation](#documentation) · [Example app](#example-app) ·
[Changelog](CHANGELOG.md) · [Report a bug](https://github.com/SallaApp/sallapush-capacitor-sdk/issues/new/choose)

> **SallaPush is for the mobile apps of Salla stores.** Contact the Salla team for your app id.

- **Version:** 1.0.0. It wraps SallaPush iOS 1.0.4 and SallaPush Android 1.0.4. See [CHANGELOG.md](CHANGELOG.md).
- **Also for:** [iOS](https://github.com/SallaApp/sallapush-ios-sdk) ·
  [Android](https://github.com/SallaApp/sallapush-android-sdk) ·
  [Flutter](https://github.com/SallaApp/sallapush-flutter-sdk) ·
  [React Native](https://github.com/SallaApp/sallapush-react-native-sdk)

**Contents:** [Features](#features) · [Requirements](#requirements) · [Before you start](#before-you-start) ·
[Installation](#installation) · [Platform setup](#platform-setup) · [Quick start](#quick-start) ·
[Verify it works](#verify-it-works) · [Usage](#usage) · [Other push SDKs](#onesignal-and-other-push-sdks) ·
[Troubleshooting](#troubleshooting) · [Support](#support)

## Features

- **Starts natively at launch,** before JavaScript runs, so taps, the opt-out and consent work as in a native app.
- **Device registration** with a push token kept up to date, and **verified customers**: Salla checks their token.
- **Tags, the language and the opt-in state,** kept on the SallaPush server and retried until it confirms them.
- **Automatic events:** `received`, `displayed` and `opened`, and `dismissed` on Android.
- **Images and the app badge:** the badge counts SallaPush notifications on iOS, and follows the shade on Android.
- **Your routing:** click and foreground listeners, typed data getters, and launch URLs opened only when you choose.
- **Consent first:** with consent required, SallaPush sends nothing until the user gives it.
- **No swizzling:** Capacitor's push plugins, `@capacitor-firebase/messaging` and OneSignal keep working beside it.
- **Safe at any time:** calls work before or after initialization and never throw on iOS and Android.

## Requirements

| Wrapper | SallaPush iOS | SallaPush Android | Framework | iOS | Android | Node |
|---|---|---|---|---|---|---|
| Capacitor 1.0.0 | 1.0.4 | 1.0.4 | Capacitor 8 (8.0 or later; Capacitor 9 isn't supported yet) | 15.0, Xcode 26 | minSdk 24 (SallaPush itself needs 23), compileSdk 36, JDK 21 | 22 or later, for Capacitor 8's CLI |

- A SallaPush app id: see [Before you start](#before-you-start).
- SallaPush runs on iOS and Android. On the web its requests reject and its other calls log an error: check
  `Capacitor.isNativePlatform()` first ([On the web](docs/SETUP.md#on-the-web)).
- Some tools only warn about Capacitor 9: check it yourself before you upgrade ([Versions](docs/SETUP.md#versions)).

## Before you start

1. **Get an app id for iOS and one for Android.** Contact the Salla team for your app id.
2. **Set up the push credentials with the Salla team.** On iOS, the Salla team adds your APNs key (the `.p8` key, its
   key id and your Apple team id) and your bundle id to your iOS app id. On Android, it sets up your Android app id
   with a Firebase project: use that project's `google-services.json`. Until then, devices register, but no
   notification arrives. Never share keys or Firebase files in an issue or a pull request.
3. **Sign customers in with their Salla token.** `SallaPush.login(externalId, identityToken)` takes the customer's id
   and the customer token your app received when the customer signed in. Salla checks the token, and links the device
   only when the token belongs to that customer. The token is required: SallaPush links no device without it.
4. **Fill in your app's privacy details.** What SallaPush collects is listed in the native SDKs' docs:
   [iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/BEHAVIOUR.md#what-sallapush-sends) and
   [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/BEHAVIOUR.md#what-sallapush-sends).

## Installation

```sh
npm install @salla.sa/sallapush-capacitor
npx cap sync
```

- **Yarn 4:** `yarn add @salla.sa/sallapush-capacitor`, with `nodeLinker: node-modules` in `.yarnrc.yml`. Each
  release is also a git tag ([From git](docs/SETUP.md#from-git)).
- **Android, and iOS with Swift Package Manager** (Capacitor 8's default, with `ios/App/CapApp-SPM`): nothing to add.
  Gradle downloads SallaPush Android from Maven Central, and the plugin's Swift package brings SallaPush iOS. Never
  add the SallaPush pods to such an app.
- **iOS with CocoaPods:** before the first `npx cap sync`, add these lines to `ios/App/Podfile`, in `target 'App' do`,
  after `capacitor_pods`. Without them, `npx cap sync ios` fails: "Unable to find a specification for SallaPush".

<!-- snippet:docs/snippets/Podfile#podfile-app -->
```ruby
pod 'SallaPushCore', :git => 'https://github.com/SallaApp/sallapush-ios-sdk.git', :tag => '1.0.4'
pod 'SallaPush', :git => 'https://github.com/SallaApp/sallapush-ios-sdk.git', :tag => '1.0.4'
```

**Updating:** run `npm update @salla.sa/sallapush-capacitor`. When the new release's row in
[Requirements](#requirements) names another SallaPush iOS version, first set your app's own SallaPush pins to it:
every `:tag =>` of the Podfile in a CocoaPods app, or the extension's SallaPush package rule with Swift Package
Manager. Then run `npx cap sync` ([Updating](docs/SETUP.md#updating-the-package)).

## Platform setup

### iOS

**1. Capabilities.** In the App target, under **Signing & Capabilities**, add **Push Notifications** and **Background
Modes → Remote notifications**. Capacitor's template doesn't have the background mode.

**2. The app id,** in `ios/App/App/Info.plist`, from a build setting, `SALLAPUSH_APP_ID`, that every build
configuration defines in an xcconfig or the target's **Build Settings**. An undefined setting expands to an empty
value, and SallaPush then doesn't start ([Info.plist](docs/SETUP.md#infoplist)).

<!-- snippet:example-app/ios/App/App/Info.plist#app-id -->
```xml
<key>SallaPushAppId</key>
<string>$(SALLAPUSH_APP_ID)</string>
```

**3. The AppDelegate.** In `ios/App/App/AppDelegate.swift`, add `import SallaPushCapacitorPlugin`, call
`SallaPushCapacitor.start()` as the first statement of `application(_:didFinishLaunchingWithOptions:)`, and add the
three forwarding methods to the class:

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

iOS hands the tap that launched the app to the delegate set during launch: keep `SallaPushCapacitor.start()` first, and
set no `UNUserNotificationCenter.current().delegate` after it. SallaPush never calls your completion handlers. With
`@capacitor/push-notifications` or `@capacitor-firebase/messaging`, their posts go after SallaPush's lines
([Another push plugin](docs/SETUP.md#another-push-plugin); Objective-C: [AppDelegate](docs/SETUP.md#appdelegate)).

**4. The Notification Service Extension,** recommended: it shows images, reports `received` and counts the
[badge](#badges). Add a `SallaPushNotificationService` target with SallaPush's `SallaPushExtension` library and the
example's [NotificationService.swift](example-app/ios/App/SallaPushNotificationService/NotificationService.swift)
([steps for each package manager](docs/SETUP.md#notification-service-extension)).

**5. An App Group,** which the badge count and `received` need: add the App Groups capability with the same group to
both targets, and add the key `SallaPushAppGroup` to both Info.plist files, set to `$(SALLAPUSH_APP_GROUP)`. Define
`SALLAPUSH_APP_GROUP` for both targets: in an xcconfig that is the project's base configuration, as the example does,
or in the project's **Build Settings**, not only the App target's. With an empty value the extension neither counts
nor reports `received`, and says so only at info level.

### Android

**1. Firebase.** Put the `google-services.json` of the Firebase project that the Salla team set up for your app id in
`android/app`, and leave Firebase's auto-init on. Build with JDK 21 ([Firebase](docs/SETUP.md#firebase)).

**2. The app id and the notification icon,** inside `<application>` in `android/app/src/main/AndroidManifest.xml`,
and the app id's placeholder in `defaultConfig` of `android/app/build.gradle`. The icon must be white on transparent.
`ic_stat_sallapush` is the example's drawable: add your own to `android/app/src/main/res/drawable` and put its name
in the snippet ([App id and notification icon](docs/SETUP.md#app-id-and-notification-icon)).

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

**3. Another FCM plugin.** Android hands each FCM message to one service. With `@capacitor/push-notifications`,
`@capacitor-firebase/messaging` or another FCM SDK in the app, its service takes every message, and SallaPush shows
nothing: add [the forwarding service](docs/SETUP.md#another-fcm-plugin), which hands each message to SallaPush first.

## Quick start

In your app's entry module, before your framework renders its first screen (Angular's `src/main.ts`, React's
`src/main.tsx`, Vue's `src/main.ts`), import SallaPush, then:

<!-- snippet:example-app/src/readmeSnippets/platform.ts#import -->
```ts
import { SallaPush } from '@salla.sa/sallapush-capacitor';
```

**1. Listen for taps.** Taps made before the first click listener, such as the tap that launched the app, wait and
arrive once it is added:

<!-- snippet:example-app/src/start.ts#click-listener -->
```ts
SallaPush.Notifications.addEventListener('click', (event) => {
  route(event.notification);
});
```

**2. Make the launch identity call,** at every launch: `login` while a customer is signed in, `logout` while nobody is.

<!-- snippet:example-app/src/start.ts#launch-identity -->
```ts
const customer = currentCustomer();
if (customer) {
  SallaPush.login(customer.externalId, customer.identityToken);
} else {
  SallaPush.logout();
}
```

**3. Ask for permission** where it fits your app, from an async function such as an onboarding screen's button
handler, not at the top level of the entry module. SallaPush never shows the system prompt on its own.

<!-- snippet:example-app/src/readmeSnippets/notifications.ts#request-permission -->
```ts
const granted = await SallaPush.Notifications.requestPermission(true);
```

`currentCustomer()` stands for your app's session, and `route` for its navigation. In an Angular app with zone.js,
run listener work that navigates in `NgZone.run`. An app that knows its app id only at run time leaves the static app
id out and calls `SallaPush.initialize(appId)` first, before these calls: on Android, `requestPermission` resolves
`false` until SallaPush is initialized ([Initializing from JavaScript](docs/SETUP.md#initializing-from-javascript)).

## Verify it works

1. **Turn on verbose logs** while you integrate: `SallaPushLogLevel` (Info.plist) and `com.salla.push.LOG_LEVEL`
   (manifest) set to `verbose` show the entries of the launch too. Set them back to `warn` before you ship, or set
   them in debug builds only: from a build setting that only Debug defines, and in
   `android/app/src/debug/AndroidManifest.xml`.
2. **Run the app** on a device, on an iOS 16 or later simulator on a Mac with Apple silicon or a T2 chip, or on an
   Android emulator with Google APIs. Allow notifications, and filter on `SallaPush` (Xcode, `adb logcat -s SallaPush`).
3. **Expect these entries:**

   | Entry | What it shows |
   |---|---|
   | `init.started` | SallaPush started, with the app id and the API URL |
   | `token.received`, then `register.ok` | The first launch registered the device: `register.ok` names its device id. Later launches log `token.unchanged` instead; on iOS, the registration survives a reinstall |
   | `login.ok`, or `logout.skipped` while signed out | The launch identity call; later launches log `login.skipped_same` or `logout.skipped` |
   | `[SallaPush] SallaPush's notification-center delegate is the current one; it hands other notifications to Capacitor's notification router.` | iOS, at info level, 2 seconds after the app first becomes active: `SallaPushCapacitor.start()` ran first |

4. **Push a test notification to the iOS simulator** without a server, with the example's
   [test payload](example-app/ios/TestPayloads/native.apns): `xcrun simctl push booted <your bundle id> native.apns`.
   The simulator never runs the Notification Service Extension: check images and the badge count on a device.
5. **Ask the Salla team to send a test notification** to your device id,
   `await SallaPush.User.pushSubscription.getId()`, and tap it: the click listener gets the tap. The setup guide's
   [Verify your integration](docs/SETUP.md#verify-your-integration) has the details.

## Usage

### Customer login and logout

Call `SallaPush.login(externalId, identityToken)` when the customer signs in, and `SallaPush.logout()` when they sign
out, as well as at every launch ([Quick start](#quick-start)).

- **Pass the customer's id and their Salla token,** without a `Bearer ` prefix. SallaPush keeps the token in memory
  only: call `login` again when your app refreshes it.
- **`logout()` needs no token and works offline.** The device stays registered as a guest.
- **Refused logins** reach `SallaPush.User.addEventListener('loginFailure', …)`: `tokenRejected` or `invalidRequest`.
  Don't call `login` again from that listener ([Sign-in and sign-out](docs/SETUP.md#sign-in-and-sign-out)).

### Notification permission

`requestPermission(true)` also opens the app's notification settings when the prompt no longer shows.
`getPermission()` resolves whether notifications are allowed, `canRequestPermission()` whether the prompt can show,
and `'permissionChange'` listeners get the changes ([Notification permission](docs/SETUP.md#notification-permission)).

### Notification taps and deep links

The click listener gets every tap on a SallaPush notification: `event.notification`, the launch URL in
`event.result.url`, and on iOS the tapped action button in `event.result.actionId`. On a cold start the tap can arrive
before your navigation is ready: keep the destination, and open it once your navigation is.

- **Route with the typed getters,** such as `notification.getString('type')` and `notification.getInt('id')`, never
  with raw payload keys: they read both payload formats ([Routing](docs/SETUP.md#routing-with-the-typed-getters)).
- **Launch URLs:** SallaPush opens https launch URLs itself only when `SallaPushOpenLaunchURLs` (Info.plist),
  `com.salla.push.OPEN_LAUNCH_URLS` (manifest) or `openLaunchUrls` in `initialize`'s config is on. Your click listener
  still gets the tap then: don't open `result.url` again. A launch URL is whatever the sender set: check its scheme and
  host before you open it ([Taps](docs/SETUP.md#taps)).

### Foreground notifications

Without a `'foregroundWillDisplay'` listener, SallaPush shows its notifications in the foreground itself. A listener
can hold each one back, and `subscription.remove()` stops it:

<!-- snippet:example-app/src/readmeSnippets/notifications.ts#will-display -->
```ts
let chatListener: SallaPushEventSubscription | null = null;

// While a chat screen shows its messages, SallaPush doesn't show that chat's notifications.
export function chatScreenOpened(chatId: string): void {
  chatListener?.remove();
  chatListener = SallaPush.Notifications.addEventListener(
    'foregroundWillDisplay',
    (event) => {
      if (event.notification.getString('chat_id') === chatId) {
        event.preventDefault(); // before any await: it counts only while the listener runs
      }
    }
  );
}

export function chatScreenClosed(): void {
  chatListener?.remove();
  chatListener = null;
}
```

`event.notification.display()` shows a held notification later, once, within 10 minutes. On iOS, a notification shown
while a listener exists is SallaPush's local copy, without its image and action buttons: add the listener only where
your app decides per notification ([Foreground notifications](docs/SETUP.md#foreground-notifications)).

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
- Set tags after the launch `login` or `logout` call: a logout and an account switch delete them, unless
  `SallaPushClearTagsOnLogout` (Info.plist) and `com.salla.push.CLEAR_TAGS_ON_LOGOUT` (manifest), or
  `clearTagsOnLogout` in `initialize`'s config, are `false`.
- `SallaPush.User.setLanguage(code)` sets the customer's language, such as `ar`; `null` means the device language.

### Push subscription

`SallaPush.User.pushSubscription.optOut()` turns SallaPush notifications off on this device, and `optIn()` turns them
back on; the device stays registered. A listener gets the device id and the opted-in state once the device is
registered, then every change, until `subscription.remove()`:

<!-- snippet:example-app/src/readmeSnippets/user.ts#subscription-listener -->
```ts
const subscription = SallaPush.User.pushSubscription.addEventListener(
  'change',
  ({ current }) => {
    settingsScreen.showDevice(current.id, current.optedIn);
  }
);
```

Read the state there: right after a cold start, the getters show only this launch's calls. The push token,
`getToken()`, is private: don't send it to analytics or third parties.

### Consent

If your app needs the user's consent first (PDPL), require it at every launch: with the static app id, set
`SallaPushRequiresUserConsent` (Info.plist) to `YES` and `com.salla.push.REQUIRES_USER_CONSENT` (manifest) to
`true`; with `initialize`, call `setConsentRequired(true)` before it:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#consent-required -->
```ts
SallaPush.setConsentRequired(true);
SallaPush.initialize(appId);
```

Then pass the user's choice to `SallaPush.setConsentGiven(…)` whenever they make it. Until consent is given, SallaPush
sends nothing and saves nothing but the answer; withdrawing it opts out, deletes the tags and unlinks the device
([Consent](docs/SETUP.md#consent)).

### Logging

The default level is `warn`: `SallaPush.Debug.setLogLevel(SallaPushLogLevel.Verbose)` changes it at run time, as the
static keys `SallaPushLogLevel` and `com.salla.push.LOG_LEVEL` do. To forward entries to your telemetry:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#log-handler -->
```ts
SallaPush.Debug.setLogHandler(SallaPushLogLevel.Error, (entry) => {
  telemetry.report('sallapush', entry.code, entry.message, entry.metadata);
});
```

- **Every entry has a stable `code`:** match on it, not on the message
  ([iOS codes](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/LOGGING.md#log-code-reference),
  [Android codes](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/LOGGING.md#log-code-reference)).
  The consoles: the unified log on iOS, subsystem `com.salla.push`, and Logcat on Android, tag `SallaPush`.
- **Privacy:** keep the console level at `warn` in release builds, and don't forward info entries to third parties
  ([what iOS logs](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/LOGGING.md#what-is-never-logged)).
  Set `SallaPushLogFullIdentifiers` only in debug builds. Capacitor itself logs every plugin call in debug builds,
  `login`'s token included: never set its `loggingBehavior` to `'production'`.

### Badges

The app icon's badge shows SallaPush's notifications, and each platform counts them in its own way:

- **iOS:** each SallaPush notification adds 1, and the badge goes back to 0 when the app opens. One that arrives while
  the app is open doesn't change it, and `SallaPush.Notifications.clearAll()` sets it to 0 too. Counting needs the
  [Notification Service Extension](#ios) and the same App Group in the app and the extension.
- **Android:** the launcher counts the notifications in the shade, so the badge drops when SallaPush's notifications
  are opened, swiped away or removed with `clearAll()`. Opening the app removes nothing by default.

Two settings change this. With the static app id, set their keys next to it, such as
`<meta-data android:name="com.salla.push.AUTO_CLEAR_BADGE" android:value="true" />` to clear the Android badge when
the app opens. An app that starts SallaPush from JavaScript passes them to `initialize` instead: a setting given there
applies to both platforms, and one left out keeps each platform's default:

| Setting | Info.plist | Manifest meta-data | Default |
|---|---|---|---|
| `autoClearBadge`: clear the badge when the app opens | `SallaPushAutoClearBadge` | `com.salla.push.AUTO_CLEAR_BADGE` | `true` on iOS, `false` on Android |
| `autoUpdateBadge`: count SallaPush notifications | `SallaPushAutoUpdateBadge` | `com.salla.push.AUTO_UPDATE_BADGE` | `true` |

<!-- snippet:example-app/src/readmeSnippets/notifications.ts#badges -->
```ts
SallaPush.initialize(appId, { autoClearBadge: true });
```

- **`autoClearBadge` on Android** removes SallaPush's notifications that show on the badge from the shade when the app
  comes to the foreground, though not after an unlock with the app already on screen.
- **`autoUpdateBadge: false`** stops the count: on iOS a push's own badge applies; on Android, SallaPush creates its
  notification channel without badges, and a channel created before keeps its own setting.
- **What the platforms limit:** Android launchers count the notifications, so an app can't set the number, and Pixel
  phones show a dot. iOS skips the extension for an app whose alerts are off, so those aren't counted, and the last
  SDK to set the badge wins. On iOS 15, a badge set to 0 also removes the delivered notifications:
  `autoClearBadge: false` keeps them ([Badges](docs/REFERENCE.md#badges); native rules for
  [iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#badges) and
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#badges)).

### Events

SallaPush reports `received`, `displayed` and `opened` for its own notifications, and `dismissed` on Android: you call
nothing. Your listeners get taps, foreground notifications and permission changes (`SallaPush.Notifications`), login
changes and refusals (`SallaPush.User`), and subscription changes (`SallaPush.User.pushSubscription`).

- **`addEventListener` returns a subscription,** whose `remove()` stops the listener; as in OneSignal,
  `removeEventListener(event, listener)` with the same function does too.
- **A page load removes every listener,** as Capacitor does for every plugin: add them in start-up code that runs at
  every page load ([Events](docs/SETUP.md#events)).

## OneSignal and other push SDKs

SallaPush never swizzles, and handles only its own notifications. On iOS its delegate hands every other notification
to Capacitor's notification router, so `@capacitor/push-notifications`, `@capacitor/local-notifications` and
`@capacitor-firebase/messaging` keep working; on Android, the [forwarding service](docs/SETUP.md#another-fcm-plugin)
hands each FCM message to SallaPush first. Avoid those plugins' `unregister()`, `deleteToken()` and
`removeAllDeliveredNotifications()`: they reach SallaPush's token and notifications too
([Coexistence](docs/SETUP.md#coexistence)).

**OneSignal:** keep its SDK until every notification you send goes through SallaPush, and keep
`ios.handleApplicationNotifications` set to `false`, as OneSignal's Capacitor setup asks. Route each notification
once, decide foreground notifications with one synchronous policy, and opt in and out on both SDKs, as the
[migration guide](docs/SETUP.md#migrating-from-onesignal) shows. Most names are OneSignal's; these differ:

| `@onesignal/capacitor-plugin` 1.2 | SallaPush |
|---|---|
| `OneSignal.initialize(appId)` | The static app id, or `SallaPush.initialize(appId)` |
| `OneSignal.login(externalId)`, `logout()` | `SallaPush.login(externalId, identityToken)` with the customer's Salla token, and `SallaPush.logout()`, at every launch |
| `pushSubscription.getIdAsync`, `getTokenAsync`, `getOptedInAsync` | `SallaPush.User.pushSubscription.getId`, `getToken`, `getOptedIn` |
| `OneSignal.Notifications.clearAll()` | `SallaPush.Notifications.clearAll()`, for SallaPush's notifications only; on iOS it also sets the badge to 0 |

## Example app

[example-app](example-app) is a Capacitor 8.5 app, with Vite and TypeScript, that runs the plugin from this
repository's sources: the quick start, the platform setup, and a screen that makes every API call and logs every
event; `src/readmeSnippets/` compiles the other snippets of this README. From the repository root, run `yarn install`
and `yarn example build`, then in `example-app/`, `npx cap sync` and `npx cap run ios` (or `android`). Its
[README](example-app/README.md) says how to set your app ids and send test notifications without a server.

## Documentation

| Document | What it holds |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | The full setup: every install path, the iOS and Android setup, the start-up code, events, consent, logging, coexistence, migrating from OneSignal, verifying your integration |
| [docs/REFERENCE.md](docs/REFERENCE.md) | How the package works, the static configuration, every API member, foreground display, badges, errors, data mapping, compatibility |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Every known problem, its cause and its fix |
| [example-app/README.md](example-app/README.md) | The example app, test notifications without a server, and its self-test |
| The native SDKs' docs | [iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/README.md) and [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/README.md), at the versions this release wraps |

## Troubleshooting

| Problem or log code | Fix |
|---|---|
| `npx cap sync ios`: "Unable to find a specification for SallaPush" | A CocoaPods app: add the [Podfile lines](#installation), then run `npx cap sync ios` again. |
| `"SallaPush" plugin is not implemented on ios` (or `android`) | Run `npx cap sync`, then rebuild the app. On the web, it is expected ([Requirements](#requirements)). |
| Gradle: `Could not find com.salla.push:sallapush` | Add `mavenCentral()` to your repositories, or to the settings' with `PREFER_SETTINGS` ([Builds that refuse project repositories](docs/SETUP.md#builds-that-refuse-project-repositories)). |
| `token.firebase_missing`, or no notification on Android | Add the right project's `google-services.json`; with another FCM plugin, the [forwarding service](docs/SETUP.md#another-fcm-plugin). |
| The tap that launched the app never reaches the click listener | Call `SallaPushCapacitor.start()` first in `didFinishLaunchingWithOptions`, and add the click listener in your entry module ([Quick start](#quick-start)). |
| `login.rejected` | Salla refused the token: pass the customer's current token, without a `Bearer ` prefix, and their id as `externalId`. |

The full list is in [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md). When you ask for help, include the SDK
version, the platform and OS version, how you installed SallaPush, and the SallaPush log codes at verbose level.

## Other SallaPush SDKs

| Platform | Repository | Package |
|---|---|---|
| iOS (Swift, Objective-C) | [sallapush-ios-sdk](https://github.com/SallaApp/sallapush-ios-sdk) | Swift packages `SallaPush`, `SallaPushExtension` |
| Android (Kotlin, Java) | [sallapush-android-sdk](https://github.com/SallaApp/sallapush-android-sdk) | `com.salla.push:sallapush` on Maven Central |
| Flutter | [sallapush-flutter-sdk](https://github.com/SallaApp/sallapush-flutter-sdk) | `sallapush_flutter` on pub.dev |
| React Native and Expo | [sallapush-react-native-sdk](https://github.com/SallaApp/sallapush-react-native-sdk) | `@salla.sa/sallapush-react-native` on npm |
| Capacitor | [sallapush-capacitor-sdk](https://github.com/SallaApp/sallapush-capacitor-sdk) | `@salla.sa/sallapush-capacitor` on npm |

## Support

- **SDK bugs and feature requests:**
  [open an issue](https://github.com/SallaApp/sallapush-capacitor-sdk/issues/new/choose) with the SDK, Capacitor and
  OS versions and the SallaPush log codes you saw. Never paste tokens, keys or customer data.
- **App ids:** Contact the Salla team for your app id.
- **Security problems:** don't open an issue. Write to security@salla.sa, as [Security](#security) explains.

## Security

Report security problems privately: use **Report a vulnerability** in this repository's **Security** tab, or write to
security@salla.sa. [SECURITY.md](SECURITY.md) says what to include and what happens next.

## Contributing

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Everyone taking part follows the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

The SallaPush Capacitor SDK is available under the [MIT License](LICENSE).
