# SallaPush Capacitor SDK: API reference

The static configuration, the API, events, foreground display, badges, errors and log codes of
`@salla.sa/sallapush-capacitor`. This release wraps SallaPush iOS 1.0.4 and SallaPush Android 1.0.4. The setup is in
the [README](../README.md); known problems are in [Troubleshooting](TROUBLESHOOTING.md).

## Contents

1. [Static configuration](#static-configuration)
2. [Initializing from JavaScript](#initializing-from-javascript)
3. [Another push plugin on Android](#another-push-plugin-on-android)
4. [API](#api)
5. [Events](#events)
6. [Foreground display](#foreground-display)
7. [Badges](#badges)
8. [Errors](#errors)
9. [Log codes](#log-codes)
10. [Compatibility](#compatibility)

## Static configuration

Info.plist keys on iOS, and `<meta-data>` inside `<application>` on Android:

| Purpose | Info.plist key | Manifest meta-data | Default |
|---|---|---|---|
| The app id: SallaPush starts at launch | `SallaPushAppId` | `com.salla.push.APP_ID` | None: SallaPush starts when JavaScript calls `initialize` |
| Require consent | `SallaPushRequiresUserConsent` | `com.salla.push.REQUIRES_USER_CONSENT` | `false` |
| Open https launch URLs on tap | `SallaPushOpenLaunchURLs` | `com.salla.push.OPEN_LAUNCH_URLS` | `false` |
| Delete the tags on logout and account switch | `SallaPushClearTagsOnLogout` | `com.salla.push.CLEAR_TAGS_ON_LOGOUT` | `true` |
| The app version SallaPush reports | `SallaPushAppVersion` | `com.salla.push.APP_VERSION` | `CFBundleShortVersionString`; `versionName` |
| Clear the badge when the app opens | `SallaPushAutoClearBadge` | `com.salla.push.AUTO_CLEAR_BADGE` | `true` on iOS, `false` on Android |
| Count SallaPush notifications on the badge | `SallaPushAutoUpdateBadge` | `com.salla.push.AUTO_UPDATE_BADGE` | `true` |
| Register for remote notifications at start | `SallaPushRegisterForRemoteNotificationsOnInit` | – | `true` |
| The APNs environment: `automatic`, `sandbox` or `production` | `SallaPushAPNsEnvironment` | – | `automatic` |
| The log level | `SallaPushLogLevel` | `com.salla.push.LOG_LEVEL` | `warn` |
| The full push token and customer id in the iOS status lines; debug builds only | `SallaPushLogFullIdentifiers` | – | `false` |
| The App Group, in the app and the extension | `SallaPushAppGroup` | – | None |
| The small notification icon, white on transparent (required) | – | `com.salla.push.default_notification_icon` (`android:resource`) | SallaPush's bell, with `display.default_icon` |
| The default channel | – | `com.salla.push.default_channel_id`, `com.salla.push.default_channel_name` | SallaPush's own channel |

- **The keys from "Require consent" to "The APNs environment" apply only with the app id.** Without it, pass those
  settings to `initialize`.
- **iOS strings** are trimmed, and an empty value counts as absent: an undefined build setting such as
  `$(SALLAPUSH_APP_ID)` expands to an empty value. **Booleans** are `<true/>` or `<false/>`, or the strings `true`,
  `false`, `YES`, `NO`, `1` and `0` in any case, as values from build settings arrive.
- **Android numbers:** write a value that looks like a decimal or a long number, such as a version `2.1`, as a string
  resource, `android:value="@string/…"`: Android stores it as a float, which SallaPush ignores.
- **A value SallaPush can't use** is ignored, with one `[SallaPush]` console error that names the key.
- **`capacitor.config` is not read:** a `plugins.SallaPush` section is ignored, with one `[SallaPush]` console error.
  The keys above can differ per build configuration and product flavor.

## Initializing from JavaScript

An app that knows its app id only at run time leaves `SallaPushAppId` and `com.salla.push.APP_ID` out, and calls
`initialize` first, at every launch:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#initialize -->
```ts
SallaPush.initialize(appId, {
  ios: { appGroupIdentifier: 'group.com.example.shop' },
});
```

Prefer the static app id: SallaPush then starts before JavaScript runs. With `initialize`, the tap that launches the
app reaches SallaPush before it starts, so its launch URL isn't opened, and an Android process that starts in the
background for a message shows SallaPush's notifications without honouring the user's opt-out. With a static app id,
`initialize` with that app id changes nothing: options passed with it are ignored, with an error that names the
static keys to set instead.

## Another push plugin on Android

Android hands each push message to one service, the one with the highest priority in the merged manifest. When another
push plugin declares one, add this service next to `MainActivity.java`, with your app's package (the `namespace` of
`android/app/build.gradle`), extending that plugin's service class. It hands each message and token to SallaPush
first, then to the plugin:

<!-- snippet:docs/snippets/SallaPushMessagingService.java -->
```java
package com.example.app;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.salla.push.SallaPush;

/** Hands SallaPush its own messages and tokens first, and every other one to the push plugin's service it extends. */
public class SallaPushMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(RemoteMessage message) {
        if (SallaPush.getNotifications().handleFirebaseMessage(getApplicationContext(), message)) {
            return;
        }
        super.onMessageReceived(message);
    }

    @Override
    public void onNewToken(String token) {
        SallaPush.getNotifications().onNewToken(getApplicationContext(), token);
        super.onNewToken(token);
    }
}
```

Declare it inside `<application>` in `android/app/src/main/AndroidManifest.xml`, at priority 1, which outranks the
plugin's own service:

<!-- snippet:docs/snippets/AndroidManifest-forwarding.xml -->
```xml
<service android:name=".SallaPushMessagingService" android:exported="false">
    <intent-filter android:priority="1">
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

`handleFirebaseMessage` returns false at once for a message that isn't SallaPush's. If your app already declares such
a service, put the two SallaPush lines first in it and give it priority 1, instead of adding a second one.

## API

Everything is imported from `@salla.sa/sallapush-capacitor`.

- **Getters and requests return a `Promise`** that reads native at call time. Every other call returns at once, and
  reaches native in call order.
- **Nothing throws for a SallaPush problem:** native logs invalid input, such as `api.invalid_argument`, and ignores it.
  A mistyped argument drops the call, with one `console.warn` per method and argument; a dropped request resolves
  `false`.
- **Calls made before SallaPush is initialized,** or while consent is withheld, wait, up to 100, and run in order.
- **A member for one platform** resolves `null` or `false`, or does nothing, on the other.

### SallaPush

| Member | Behaviour |
|---|---|
| `initialize(appId: string, config?: SallaPushConfig): void` | Starts SallaPush with an app id known only at run time ([Initializing from JavaScript](#initializing-from-javascript)). An invalid first app id, anything but 1 to 64 letters, digits, `_` and `-`, turns SallaPush off until the next launch (`init.invalid_app_id`). |
| `isInitialized(): Promise<boolean>` | Whether SallaPush is running |
| `getAppId(): Promise<string \| null>` | The app id SallaPush runs with |
| `getSdkVersion(): Promise<string>` | The native SDK's version on this platform |
| `setConsentRequired(required: boolean): void` | Not saved: call it before `initialize` at every launch. With a static app id, set the static key instead. |
| `setConsentGiven(given: boolean): void` | Saved. `false`, while consent is required, withdraws consent: the device is opted out and its tags deleted. |
| `login(externalId: string, identityToken: string): void` | Links the device to the customer, with the Salla token your app received for them, without `Bearer `. The id has 1 to 128 characters and the token at most 4,096. Call it after the customer signs in, and at each app launch while they are signed in. A refused token is a `'loginFailure'` event. |
| `logout(): void` | Unlinks the device, after the customer signs out; works offline |
| `User`, `Notifications`, `Debug` | The namespaces below |

`SallaPushConfig`, the options of `initialize`; an option left out keeps the static key's value, else the default:

| Option | Default |
|---|---|
| `logLevel?: SallaPushLogLevel` | `warn` |
| `appVersion?: string` | `CFBundleShortVersionString`; `versionName` |
| `clearTagsOnLogout?: boolean` | `true` |
| `requiresUserConsent?: boolean` | `false` |
| `openLaunchUrls?: boolean` | `false`. With it on, the click listener must not open `result.url` again. |
| `autoClearBadge?: boolean` | `true` on iOS, `false` on Android; a value given applies to both platforms ([Badges](#badges)) |
| `autoUpdateBadge?: boolean` | `true` |
| `ios?.appGroupIdentifier?: string` | `SallaPushAppGroup` |
| `ios?.apnsEnvironment?: SallaPushAPNsEnvironment` | `automatic`: from the provisioning profile |
| `ios?.registerForRemoteNotificationsOnInit?: boolean` | `true`. Set it to `false` only if the app registers at every launch itself. |
| `ios?.autoClearBadge?: boolean` | Deprecated: use `autoClearBadge`, which wins over it |

### SallaPush.User

| Member | Behaviour |
|---|---|
| `getExternalId(): Promise<string \| null>` | The id of the last `login`; `null` for a guest |
| `isLoggedIn(): Promise<boolean>` | Whether the last call was a `login` |
| `addTag(key: string, value: string): void` | Keys are trimmed and lowercased, then must be 1 to 64 characters of `a-z`, `0-9` and `_` (`tags.invalid_key`). Values are cut at 255 characters, and an empty value removes the tag. At most 100 tags. |
| `addTags(tags: Record<string, string>): void` | The same, for several tags |
| `removeTag(key: string): void`, `removeTags(keys: string[]): void` | |
| `getTags(): Promise<Record<string, string>>` | With your latest changes; right after a cold start, only this launch's |
| `setLanguage(language: string \| null): void` | A language code such as `ar`; `null` means the device language |
| `addEventListener('change', listener: (state: SallaPushUserChangedState) => void)` | Login changes |
| `addEventListener('loginFailure', listener: (failure: SallaPushLoginFailure) => void)` | Each refusal of the current login. Call `login` again once your app has a current token, not from this listener. |
| `removeEventListener(event, listener): void` | |
| `pushSubscription` | Below |

### SallaPush.User.pushSubscription

| Member | Behaviour |
|---|---|
| `getId(): Promise<string \| null>` | The SallaPush device id; `null` until the device is registered |
| `getToken(): Promise<string \| null>` | The push token. It is private: never send it to analytics or third parties. |
| `getOptedIn(): Promise<boolean>` | Notifications allowed, not opted out, and a token |
| `optIn(): void` | Clears an opt-out, and shows the permission prompt while it can still show |
| `optOut(): void` | Stops SallaPush notifications on this device |
| `addEventListener('change', listener: (state: SallaPushSubscriptionChangedState) => void)` | The current state once the device is registered, then every change |
| `removeEventListener('change', listener): void` | |

### SallaPush.Notifications

| Member | Behaviour |
|---|---|
| `getPermission(): Promise<boolean>` | Whether notifications are allowed |
| `canRequestPermission(): Promise<boolean>` | Whether the system can still show the prompt |
| `getPermissionStatus(): Promise<SallaPushIOSPermissionStatus \| null>` | iOS's status; `null` on Android |
| `requestPermission(fallbackToSettings?: boolean): Promise<boolean>` | Shows the prompt and resolves whether notifications are allowed. With `true`, it opens the app's notification settings when the prompt no longer shows. On Android it resolves `false` before SallaPush is initialized. |
| `registerForProvisionalAuthorization(): Promise<boolean>` | iOS: quiet notifications, without a prompt |
| `refreshPermission(): void` | Reads the permission again, after the app asked for it itself |
| `registerForRemoteNotifications(): void` | iOS: needed only with `registerForRemoteNotificationsOnInit` set to `false` |
| `forwardApnsToken(apnsToken: string): void` | iOS: an APNs token another SDK reports, as hexadecimal text |
| `clearAll(): void` | Removes SallaPush's delivered notifications, and on iOS sets the badge to 0 while `autoUpdateBadge` is on |
| `removeNotification(androidNotificationId: number): void` | Android: removes one SallaPush notification |
| `isSallaPushNotification(payload: Record<string, unknown>): Promise<boolean>` | Whether a payload another SDK received is SallaPush's |
| `trackOpened(additionalData: Record<string, unknown> \| null): Promise<boolean>` | Android: records `opened` for a SallaPush notification that another SDK showed, from its data |
| `addEventListener('click' \| 'foregroundWillDisplay' \| 'permissionChange', listener)` | [Events](#events) |
| `removeEventListener(event, listener): void` | |

### SallaPush.Debug

| Member | Behaviour |
|---|---|
| `getLogLevel(): Promise<SallaPushLogLevel>`, `setLogLevel(level: SallaPushLogLevel): void` | The console level; `setLogLevel` wins over the static key |
| `setLogHandler(level: SallaPushLogLevel, handler: ((entry: SallaPushLogEntry) => void) \| null): void` | One handler for the app, which gets the entries at `level` or more severe; `null` removes it. The first handler also gets up to 100 earlier warnings and errors. |

### Types

| Type | Members |
|---|---|
| `SallaPushNotification` | `notificationId`, `title`, `subtitle`, `body`, `imageUrl`, `launchUrl`, `sound`; `additionalData`, your data; `rawPayload`; `source`, the payload format, `native` or `compat`; on iOS `badge` and `threadId`, on Android `androidNotificationId`, `collapseId` and `channelId`. `getString(key)`, `getInt(key)`, `getBool(key)` and, on iOS, `getNumber(key)` read a top-level `additionalData` value in both formats, or return `null`; `display()` shows a held notification ([Foreground display](#foreground-display)). |
| `SallaPushClickEvent` | `notification`, and `result`: `url`, the launch URL, and `actionId`, the action button tapped (iOS) |
| `SallaPushWillDisplayEvent` | `notification`, `isPrevented`, `preventDefault()` |
| `SallaPushSubscriptionChangedState` | `previous` and `current`: `id`, `token`, `optedIn` |
| `SallaPushUserChangedState` | `previous` and `current`: `externalId`, `isLoggedIn` |
| `SallaPushLogEntry` | `level`, `category`, `code`, `message`, `metadata`, and `timestamp` in milliseconds since the epoch |
| `SallaPushEventSubscription` | `remove()`, which removes the listener |
| `SallaPushLogLevel` | `Off` (`'off'`), `Error`, `Warn`, `Info`, `Debug`, `Verbose` |
| `SallaPushLoginFailure` | `TokenRejected` (`'tokenRejected'`), `InvalidRequest` (`'invalidRequest'`) |
| `SallaPushAPNsEnvironment` | `Automatic` (`'automatic'`), `Sandbox`, `Production` |
| `SallaPushIOSPermissionStatus` | `NotDetermined` (`'notDetermined'`), `Denied`, `Authorized`, `Provisional`, `Ephemeral` |

A `launchUrl` is whatever the sender set, of any scheme: check its scheme and host before you open it.

## Events

- **Order:** listeners run in the order they were added, in the page's JavaScript. A listener that throws is reported
  with `console.error`, and the others still run.
- **Taps before the first click listener** wait, up to 10, for 5 minutes, and arrive once it is added, at every click
  listener added by then. So add the click listener at app start, in the entry module.
- **Subscription listeners** get the current state once when added, with `previous` equal to `current`, then every
  change. User and permission events have no replay.
- **A page load,** such as a reload or a live update, removes every listener: add them in start-up code that runs at
  every page load. Taps then wait again until the new page's first click listener.
- **Removing:** `subscription.remove()` and `removeEventListener(event, listener)` both remove a listener; the same
  function added twice for one event is added once.

## Foreground display

While a `'foregroundWillDisplay'` listener exists, SallaPush holds each foreground notification until the listeners
have returned, then shows it unless one called `event.preventDefault()`. Call it before any `await`: a later call
changes nothing.

- **`event.notification.display()`** shows a prevented notification, once, within 10 minutes of its event.
- **On iOS, the notification shown is SallaPush's local copy,** which loses the image, the action buttons, the
  interruption level, the relevance score and the collapse identifier. Without a listener, iOS shows the original. So
  add a listener only where your app decides per notification, and remove it when the screen goes. Android shows the
  real notification.
- **While the user is opted out,** SallaPush shows no notification, and the listeners don't run.
- **Listen in one Capacitor bridge only:** with listeners in several, a notification shows unless every one prevents it.

## Badges

A setting given in `initialize`'s config applies to both platforms; one left out keeps each platform's default.

| | iOS | Android |
|---|---|---|
| How it counts | The Notification Service Extension adds 1 for each SallaPush notification. It needs the same App Group in the app and the extension, and starts once the app has run this version and, with consent required, once it is given. | The launcher counts the app's notifications in the shade. Pixel shows a dot; some launchers show the number. |
| `autoClearBadge` | On by default: the badge goes to 0 every time the app becomes active. `false` keeps it. | Off by default: the badge follows the notifications in the shade. On: SallaPush removes its notifications from the shade when the app comes to the foreground. |
| `autoUpdateBadge`, on by default | `false` stops the count: a push's own `badge` applies. | `false` creates SallaPush's channel without badges; a channel created before keeps its setting (`badge.channel_badges_on`). |
| `clearAll()` | Removes SallaPush's notifications, and sets the badge to 0 | Removes SallaPush's notifications, which lowers the badge |

- **One badge per app:** on iOS the icon shows the last number any SDK or the app wrote; on Android the launcher adds
  up all of the app's notifications.
- **iOS 15:** setting the badge to 0 also removes the app's delivered notifications, other SDKs' included. To keep them,
  set `autoClearBadge` to `false`.
- **iOS skips the extension** when the user turned the app's alerts off, so those notifications aren't counted.

## Errors

| Situation | Result |
|---|---|
| An invalid argument, such as an empty tag key | Logged (`api.invalid_argument`, `tags.invalid_key`, …) and ignored |
| An argument of the wrong type | Dropped, with one `console.warn`; a request resolves `false` |
| `initialize` repeats the static app id, with options | Changes nothing; one console error names the static keys to set |
| `setConsentRequired(true)` after a static start without the consent key | Applied late, with one console error that names the key to set |
| The web, or a native build made without `npx cap sync` | Requests reject with Capacitor's `UNIMPLEMENTED` error; other calls print one console error each |
| `display()` of a notification that wasn't held, or held more than 10 minutes ago | Does nothing; one console warning |
| An unexpected exception in the Android plugin | The request rejects with `E_SALLAPUSH_INTERNAL` |

Code that also runs on the web checks `Capacitor.isNativePlatform()` first. A test runner loads Capacitor as on the
web: mock `@salla.sa/sallapush-capacitor` in your tests, with the members your code calls.

## Log codes

Every entry has a stable `code`, such as `register.ok`: match on it, never on the message. The native docs list every
code, with its level and meaning
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/LOGGING.md#log-code-reference),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/LOGGING.md#log-code-reference)). The
consoles: the unified log on iOS, subsystem `com.salla.push`, and Logcat on Android, tag `SallaPush`.

The package's own lines start with `[SallaPush]`, on iOS in category `wrapper`:

| Level | When |
|---|---|
| Error | `SallaPushCapacitor.start()` wasn't called (iOS); another delegate replaced SallaPush's notification-center delegate (iOS); `capacitor.config` has a `plugins.SallaPush` section; `initialize` repeated the static app id with options; `setConsentRequired(true)` came after a static start without the consent key; a static key with a value it can't use |
| Warning | `display()` with a notification that is unknown or expired |
| Info | On iOS, 2 seconds after the app first becomes active: SallaPush's notification-center delegate is the current one. A call that works on the other platform only, once per process. |

- **Privacy:** no secret or identity token is ever logged. Keep the console level at `warn` in release builds, don't
  forward info entries to third parties, and set `SallaPushLogFullIdentifiers` only in debug builds.
- **Capacitor's own logging:** in debug builds Capacitor logs every plugin call with its options, `login`'s token
  included. Never set its `loggingBehavior` to `'production'`, which logs the same in release builds.

## Compatibility

- **Capacitor 8,** 8.0.0 or later and below 9. Capacitor 9 isn't supported yet.
- **iOS 15.0** or later, with Xcode 26; Swift Package Manager or CocoaPods.
- **Android** minSdk 24 and compileSdk 36, from your app's `variables.gradle`; Java 21. Minified release builds need no
  rule of your own.
- **JavaScript:** ES2017, as Capacitor's own, so the package runs on the oldest Android System WebView Capacitor
  accepts without transpiling.
- **Package managers:** npm and Yarn 4; from git with npm 12 or Yarn 4.14 and later. pnpm, Yarn 1 and Bun aren't
  verified yet.
