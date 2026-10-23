# SallaPush Capacitor SDK: reference

How the package works, its static configuration, every API member, events, foreground display, badges, errors, data
mapping, coexistence with other SDKs, logging and compatibility. For the short guide, see the [README](../README.md), and
for the full setup, the [setup guide](SETUP.md).

Other docs: [Setup guide](SETUP.md), [Troubleshooting](TROUBLESHOOTING.md)

## Contents

1. [How the package works](#how-the-package-works)
2. [Static configuration](#static-configuration)
3. [API reference](#api-reference)
4. [Events](#events)
5. [Foreground display](#foreground-display)
6. [Badges](#badges)
7. [Errors](#errors)
8. [Data mapping](#data-mapping)
9. [Coexistence with other SDKs](#coexistence-with-other-sdks)
10. [Migrating from OneSignal](#migrating-from-onesignal)
11. [Logging](#logging)
12. [Compatibility](#compatibility)

## How the package works

```text
 JavaScript ── SallaPush.* ── Capacitor plugin "SallaPush" ──▶ SallaPush iOS SDK ─────▶ push-service ──▶ APNs ──▶ device
                                                           └─▶ SallaPush Android SDK ─▶ push-service ──▶ FCM ───▶ device
```

- **Native SallaPush does the work.** Registration, tokens, identity, tags, events, retries, consent, display and
  logging are the native SDKs'. The package adds a Capacitor plugin, the TypeScript API and start-up hooks, and no push
  logic of its own. So every rule of the native docs holds, and this reference links to them
  ([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/BEHAVIOUR.md),
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/BEHAVIOUR.md)).
- **SallaPush starts natively, before JavaScript.**
  - iOS: `SallaPushCapacitor.start()`, the first statement of `application(_:didFinishLaunchingWithOptions:)`,
    initializes SallaPush from the Info.plist when `SallaPushAppId` is set. Then, with or without an app id, it makes
    SallaPush's notification-center delegate the current one, chained to the delegate set before
    ([Capacitor's notification router](#capacitors-notification-router)). It runs once per process, on the main
    thread; later calls do nothing. It needs no Capacitor bridge: a background launch for a content-available push
    creates none, and SallaPush runs there too.
  - Android: `SallaPushInitProvider`, a content provider in the package's manifest, runs whenever the app's process
    starts, before `Application.onCreate`. It applies `com.salla.push.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS` with or
    without an app id, then initializes SallaPush from the meta-data when `com.salla.push.APP_ID` is set. Its
    `initOrder` of −1 runs it after Firebase's provider and androidx.startup's, so the default Firebase app and
    WorkManager exist by then. Capacitor loads its plugins only when its `BridgeActivity` starts, never in a process
    that FCM or WorkManager starts, so the provider is the start that covers every process.
  - Without a static app id, SallaPush starts when JavaScript calls `SallaPush.initialize`
    ([what that costs](SETUP.md#initializing-from-javascript)).
- **Processes without JavaScript behave as in a native app.** An Android process that FCM starts for a message runs
  the provider, so SallaPush is initialized there: it honours the opt-out and keeps the message's events. That process
  runs no JavaScript, so no JavaScript listener and no launch identity call run there
  ([Quick start](SETUP.md#at-app-start)).
- **The bridge** is a Capacitor plugin named `SallaPush`, in Swift on iOS and Kotlin on Android. The TypeScript API
  calls its methods; the public namespaces, such as `SallaPush.User`, live in TypeScript. Capacitor runs each
  platform's plugin calls on one queue, in call order. On iOS the plugin moves each call to the main thread, in the
  same order, where SallaPush and its callbacks run; on Android it calls native on Capacitor's plugin thread, and
  registers listeners on the main thread. So a getter called after a setter reads the setter's effect.
- **Getters are asynchronous and uncached.** Each one reads native at call time. Right after a cold start they show
  only this launch's calls, until native has loaded its saved state
  ([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/BEHAVIOUR.md#state-at-launch),
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/BEHAVIOUR.md#state-at-launch)).
- **Native listeners are registered lazily.** The first JavaScript listener of an event adds one Capacitor listener,
  kept for the page, and then registers one native listener or observer; removing the last JavaScript listener removes
  the native one. So native keeps the taps made before any listener, and hands them over when the first click listener
  is added ([Events](#events)).
- **Page loads.** Every page load, such as a reload, a navigation or a live update, makes Capacitor remove every
  plugin's listeners, and so does a restart of the WebView's content process on iOS. The plugin then removes every
  native registration and forgets the held foreground notifications. Native state is untouched, native keeps taps
  again until the new page adds its first click listener, and a second `initialize` changes nothing. On Android, the
  same happens when the activity is destroyed, after which that plugin registers nothing more.
- **A late start on iOS.** When the app delegate doesn't call `SallaPushCapacitor.start()`, the plugin starts SallaPush
  when Capacitor loads it, and logs an error: the tap that launched the app can be missed.
- **Capacitor's notification router on iOS.** With `ios.handleApplicationNotifications` at its default, `true`,
  Capacitor's bridge makes its notification router the notification center's delegate when it starts, after launch,
  and then loads the plugins. SallaPush's plugin takes the delegate back as it loads, inside that same start, so no
  notification arrives in between, and hands the router every notification that isn't SallaPush's
  ([Coexistence](#capacitors-notification-router)).

## Static configuration

The app configures SallaPush with Info.plist keys on iOS and `<meta-data>` inside `<application>` on Android. Keys
"read by this package" are read by the start-up code, and keys "read by native" by the native SDKs themselves. The
start-up code reads its keys, except the OneSignal-format setting, only together with the app id: without
`SallaPushAppId` or `com.salla.push.APP_ID` they do nothing, and a JavaScript `initialize` passes those options
instead, after `setConsentRequired(true)` to require consent ([Consent](SETUP.md#consent)).

| Purpose | iOS Info.plist key | Android meta-data | Read by | Default |
|---|---|---|---|---|
| The app id; SallaPush starts at launch | `SallaPushAppId` (String) | `com.salla.push.APP_ID` | this package | None: SallaPush starts when JavaScript calls `initialize` |
| Require consent | `SallaPushRequiresUserConsent` (Boolean) | `com.salla.push.REQUIRES_USER_CONSENT` | this package, with the app id | `false` |
| Open https launch URLs on tap | `SallaPushOpenLaunchURLs` (Boolean) | `com.salla.push.OPEN_LAUNCH_URLS` | this package, with the app id | `false` |
| Delete the device's tags on logout and account switch | `SallaPushClearTagsOnLogout` (Boolean) | `com.salla.push.CLEAR_TAGS_ON_LOGOUT` | this package, with the app id | `true` |
| The app version on the server | `SallaPushAppVersion` (String) | `com.salla.push.APP_VERSION` | this package, with the app id | `CFBundleShortVersionString`; `versionName` |
| Clear the badge when the app opens ([Badges](#badges)); on iOS 15 that can also remove delivered notifications ([Removing delivered notifications](#removing-delivered-notifications)) | `SallaPushAutoClearBadge` (Boolean) | `com.salla.push.AUTO_CLEAR_BADGE` | this package, with the app id | `true` |
| Count SallaPush notifications on the badge ([Badges](#badges)) | `SallaPushAutoUpdateBadge` (Boolean) | `com.salla.push.AUTO_UPDATE_BADGE` | this package, with the app id | `true` |
| Register for remote notifications at start | `SallaPushRegisterForRemoteNotificationsOnInit` (Boolean) | – | this package, with the app id | `true` |
| The APNs environment | `SallaPushAPNsEnvironment` (String: `automatic`, `sandbox` or `production`) | – | this package, with the app id | `automatic` |
| Show OneSignal-format notifications | – | `com.salla.push.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS` | this package, with or without an app id | `true` |
| The log level | `SallaPushLogLevel` | `com.salla.push.LOG_LEVEL` | native | `warn` |
| The push-service URL | `SallaPushAPIBaseURL` | `com.salla.push.API_BASE_URL` | native | `https://api.salla.dev/notifications/v1/sallapush` |
| The App Group, in the app and the extension | `SallaPushAppGroup` | – | native | None |
| The small icon (required) | – | `com.salla.push.default_notification_icon` (`android:resource`) | native | Firebase's `com.google.firebase.messaging.default_notification_icon`, else SallaPush's bell, with `display.default_icon` |
| The default channel | – | `com.salla.push.default_channel_id`, `com.salla.push.default_channel_name` | native | SallaPush's own channel |

The native keys follow native's rules
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#5-set-the-infoplist-keys),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#configuration)). This
package reads its own keys with these rules:

- **iOS strings** are trimmed, and an empty value counts as absent: an unset build setting such as
  `$(SALLAPUSH_APP_ID)` expands to an empty value. A value that isn't a string is ignored, with one console error.
- **iOS booleans** are `<true/>` or `<false/>`, or the strings `true`, `false`, `YES`, `NO`, `1` and `0` in any case,
  as values from build settings arrive. Anything else, an `<integer>` included, is ignored with one console error.
- **`SallaPushAPNsEnvironment`** is `automatic`, `sandbox` or `production`, in any case. Another value is ignored with
  one console error, and native keeps its default.
- **Android values** arrive typed, and each is read as text: a string as it is, trimmed, an empty one counting as
  absent; an integer as the string resource it names (`android:resource="@string/…"`), else as the number
  (`android:value="12345"`, which makes `0123` the number 123); a boolean as `true` or `false`. A decimal number such as
  a version `2.1` or `5.0`, and a long number such as `12345678901`, arrive as a float, which is ignored with one
  console error. So write a value that looks like a number as a string resource, `android:value="@string/…"`, which
  arrives as its exact text. Boolean keys then take the same values as on iOS.
- **Without an app id** SallaPush doesn't start at launch, and this package's other keys do nothing, except the
  OneSignal-format setting. Nothing is logged about it.

A value that `SallaPush.initialize` passes wins over a native key, as native's configuration does. With a static app
id, though, that `initialize` changes nothing ([SallaPush](#sallapush)).

**`capacitor.config` is not read.** The package reads no `plugins.SallaPush` section of `capacitor.config`. When one
exists, the plugin logs once per process, on each platform, when Capacitor loads it:
`[SallaPush] capacitor.config's plugins.SallaPush section is ignored: SallaPush reads its settings from the Info.plist
keys on iOS and the com.salla.push meta-data on Android (README, iOS setup and Android setup).` The static keys can
differ per build configuration and product flavor, SallaPush reads them in every process, the Notification Service
Extension's included, and they are the keys of the native SDKs and the other SallaPush wrappers. The Capacitor settings
that matter are `ios.handleApplicationNotifications` ([Coexistence](#capacitors-notification-router)) and
`loggingBehavior` ([Logging](#logging)).

## API reference

Everything is imported from `@salla.sa/sallapush-capacitor`.

- **Getters and requests return a `Promise`** that reads native at call time. Every other call returns at once, and
  reaches native in call order.
- **Promises resolve for every SallaPush problem.** Native never throws: it logs invalid input, such as
  `api.invalid_argument`, and ignores it.
- **On the web, and in a native build made without `npx cap sync`,** the native plugin is missing: every request
  rejects with Capacitor's `UNIMPLEMENTED` error, `"SallaPush" plugin is not implemented on web` (or `ios`, `android`),
  and every other call prints one console error per method and page ([Errors](#errors)). Inside the Android plugin, an
  unexpected exception would reject a request with the code `E_SALLAPUSH_INTERNAL`; native never causes one.
- **JavaScript checks each argument's type.** A mistyped call is dropped, with one `console.warn` per method and
  argument, such as `[SallaPush] SallaPush.User.addTag ignored: value must be a string.`, and makes no native call; a
  dropped request resolves `false`.
- **Calls made before SallaPush is initialized,** or while consent is withheld, wait natively, up to 100, and run in
  order.
- **Platform-only members** work on both platforms. On the other one they resolve `null` or `false`, or do nothing,
  and log one `[SallaPush]` info line per process.

### SallaPush

| Member | Native | Behaviour |
|---|---|---|
| `initialize(appId: string, config?: SallaPushConfig): void` | `initialize(_:withLaunchOptions:configuration:)`; `initWithContext(context, appId, config)` | Starts SallaPush with an app id known only at run time. An option left out keeps native's default, which native reads from its own keys, such as `SallaPushLogLevel`. With the app id and API URL SallaPush already runs with, it changes nothing, its options included; after a static start, a call without `apiBaseUrl` also prints an error line naming the ignored options (with `apiBaseUrl` nothing is printed, though native still ignores them when the URL names the API it already runs with). Another app id or URL switches to it, after the previous app finished its pending logout. An invalid first app id (anything but 1 to 64 letters, digits, `_` and `-`) disables SallaPush until the next launch (`init.invalid_app_id`). |
| `isInitialized(): Promise<boolean>` | `isInitialized` | Whether SallaPush is running |
| `getAppId(): Promise<string \| null>` | `appId` | The app id SallaPush runs with |
| `getSdkVersion(): Promise<string>` | `sdkVersion` | The native SDK's version on this platform |
| `setConsentRequired(required: boolean): void` | `setConsentRequired` | Not saved: call it before `initialize` at every launch. With a static app id, use the static key: a later `true` is applied, with an error line ([Consent](SETUP.md#consent)). `false` lowers only what an earlier `true` raised. |
| `setConsentGiven(given: boolean): void` | `setConsentGiven` | Saved for the app. `false`, while consent is required, withdraws consent that was given: opt-out, tags deleted and unlink on the server, then idle. |
| `login(externalId: string, identityToken: string): void` | `login(externalId:identityToken:)`; `login(externalId, identityToken)` | Links the device to the customer, after Salla checked their token. Native trims both; the id has 1 to 128 characters and the token at most 4,096, or the call is ignored (`api.invalid_argument`). The token stays in memory only. A refusal is a `'loginFailure'` event. Call it again whenever your app refreshes the token, and call `logout()` before another customer's `login`. |
| `logout(): void` | `logout()` | Unlinks the device. Saved, and retried until the server confirms it; works offline. |
| `User`, `Notifications`, `Debug`, `Migration` | The namespaces | Below |

`SallaPushConfig`, the options of `initialize`:

| Option | Native | Default |
|---|---|---|
| `apiBaseUrl?: string` | `apiBaseURL`; `setApiBaseUrl` | The native key, else `https://api.salla.dev/notifications/v1/sallapush`. A URL of your own ends in `/notifications/v1/sallapush`. https only; http only for local development hosts, such as `localhost`. Surrounding whitespace is trimmed; a value that isn't a valid URL, the empty string included, is logged (`config.invalid_base_url`), and SallaPush uses the production URL, not the native key. |
| `logLevel?: SallaPushLogLevel` | `logLevel`; `setLogLevel` | The native key, else `warn` |
| `appVersion?: string` | `appVersion`; `setAppVersion` | `CFBundleShortVersionString`; `versionName` |
| `clearTagsOnLogout?: boolean` | `clearTagsOnLogout`; `setClearTagsOnLogout` | `true` |
| `requiresUserConsent?: boolean` | `requiresUserConsent`; `setRequiresUserConsent` | `false` |
| `openLaunchUrls?: boolean` | `openLaunchURLs`; `setOpenLaunchUrls` | `false`. With it on, the click listener still gets the tap, with `result.url`: it must not open that URL again. |
| `autoClearBadge?: boolean` | `autoClearBadge`; `setAutoClearBadge` | `true`: the badge is cleared when the app opens ([Badges](#badges)). On iOS 15, clearing the badge can also remove the app's delivered notifications, other SDKs' included ([Removing delivered notifications](#removing-delivered-notifications)). |
| `autoUpdateBadge?: boolean` | `autoUpdateBadge`; `setAutoUpdateBadge` | `true`: SallaPush raises and lowers the badge for its notifications ([Badges](#badges)). |
| `ios?.appGroupIdentifier?: string` | `appGroupIdentifier` | `SallaPushAppGroup` |
| `ios?.apnsEnvironment?: SallaPushAPNsEnvironment` | `apnsEnvironment` | `automatic`: from the provisioning profile |
| `ios?.autoClearBadge?: boolean` | `autoClearBadge` | Deprecated: use `autoClearBadge`, which applies on both platforms and wins over it. It still applies on iOS when `autoClearBadge` is left out. |
| `ios?.registerForRemoteNotificationsOnInit?: boolean` | `registerForRemoteNotificationsOnInit` | `true`. Set it to `false` only if the app registers at every launch itself. |

The `ios` options are ignored on Android. The native configurations are described in full in the native docs
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#configuration),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#configuration)).

### SallaPush.User

| Member | Native | Behaviour |
|---|---|---|
| `getExternalId(): Promise<string \| null>` | `externalId` | The id of the last `login`; `null` for a guest, and as soon as `logout()` returns |
| `isLoggedIn(): Promise<boolean>` | `isLoggedIn` | Your last `login` or `logout`, at once. Neither getter says whether push-service accepted the link. |
| `addTag(key: string, value: string): void` | `addTag` | Keys are trimmed and lowercased, then must be 1 to 64 characters of `a-z`, `0-9` and `_`, or are dropped (`tags.invalid_key`). Values are cut at 255 characters (`tags.value_truncated`); an empty value removes the tag. At most 100 tags (`tags.limit`). |
| `addTags(tags: Record<string, string>): void` | `addTags:` (Objective-C); `addTags(Map)` | The entries reach native unchanged: native skips a key or a value that isn't a string, and logs it (`api.invalid_argument`) |
| `removeTag(key: string): void` | `removeTag` | |
| `removeTags(keys: string[]): void` | `removeTags:` (Objective-C); `removeTags(Collection)` | Non-string keys as in `addTags` |
| `getTags(): Promise<Record<string, string>>` | `getTags()` | With your latest changes, also before they reach the server. Right after a cold start, only this launch's. |
| `setLanguage(language: string \| null): void` | `setLanguage` | A language code such as `ar`; `null` means the device language. An unchanged value sends nothing. |
| `addEventListener('change', listener: (state: SallaPushUserChangedState) => void)` | `addObserver` | [Events](#events) |
| `addEventListener('loginFailure', listener: (failure: SallaPushLoginFailure) => void)` | `addLoginFailureHandler`; the observer's `onLoginFailure` | [Events](#events) |
| `removeEventListener(event, listener): void` | `removeObserver`; `cancel()` | |
| `pushSubscription` | `pushSubscription` | Below |

Tag changes are sent at most once every 10 seconds while the app is in the foreground, at once when it goes to the
background, after a pending login or logout, and are retried until the server confirms them. With
`clearTagsOnLogout`, a logout and an account switch delete the device's tags first
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/BEHAVIOUR.md#tags),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/BEHAVIOUR.md#tags)).

### SallaPush.User.pushSubscription

| Member | Native | Behaviour |
|---|---|---|
| `getId(): Promise<string \| null>` | `id` | The SallaPush device id, which support can look up; `null` until the device registered or native loaded its saved registration |
| `getToken(): Promise<string \| null>` | `token` | The APNs token, in lowercase hexadecimal, or the FCM token. It is private: never send it to analytics or third parties. |
| `getOptedIn(): Promise<boolean>` | `optedIn` | Notifications allowed, not opted out, and a token |
| `optIn(): void` | `optIn()` | Clears an opt-out, and shows the permission prompt when it can still show. On Android, called while the app is in the background, it shows the prompt at the next foreground (`permission.prompt_deferred`). |
| `optOut(): void` | `optOut()` | Stops SallaPush notifications on this device; the device stays registered |
| `addEventListener('change', listener: (state: SallaPushSubscriptionChangedState) => void)` | `addObserver`, one per listener | [Events](#events) |
| `removeEventListener('change', listener): void` | `removeObserver`; `cancel()` | |

### SallaPush.Notifications

| Member | Native | Behaviour |
|---|---|---|
| `getPermission(): Promise<boolean>` | `permission` | Whether notifications are allowed: on iOS, authorized, provisional or ephemeral. On iOS, `false` until native has read the permission, shortly after start. |
| `canRequestPermission(): Promise<boolean>` | `canRequestPermission` | Whether the system can still show the prompt |
| `getPermissionStatus(): Promise<SallaPushIOSPermissionStatus \| null>` | `permissionStatus` (iOS) | `notDetermined`, `denied`, `authorized`, `provisional` or `ephemeral`; a status newer than this package reads `notDetermined`. `null` on Android. |
| `requestPermission(fallbackToSettings?: boolean): Promise<boolean>` | `requestPermission(fallbackToSettings:completion:)`; `requestPermission(fallbackToSettings, callback)` | Shows the prompt and resolves once, with whether notifications are allowed. With `fallbackToSettings` (default `false`), it opens the app's notification settings when the prompt no longer shows. On Android it resolves the current state without a prompt while the app isn't in the foreground, and `false` before SallaPush is initialized. |
| `registerForProvisionalAuthorization(): Promise<boolean>` | `registerForProvisionalAuthorization(completion:)` (iOS) | Quiet notifications, without a prompt. `false` on Android. |
| `refreshPermission(): void` | `refreshPermission()` | Reads the permission again, after the app asked for it itself |
| `registerForRemoteNotifications(): void` | `registerForRemoteNotifications()` (iOS) | Needed only with `registerForRemoteNotificationsOnInit` set to `false`. Does nothing on Android. |
| `forwardApnsToken(apnsToken: string): void` | `didRegisterForRemoteNotifications(deviceToken:)` (iOS) | Forwards the APNs token another SDK holds, as hexadecimal text of even length, in either case, such as the `token` of `@capacitor-firebase/messaging`'s `apnsTokenReceived` event. Other text is ignored with one console error. Does nothing on Android. |
| `clearAll(): void` | `clearAll()`; `clearAllNotifications()` | Removes the delivered SallaPush notifications; other notifications stay. On iOS it also sets the badge to 0 while `autoUpdateBadge` is on ([Badges](#badges)). |
| `removeNotification(androidNotificationId: number): void` | `removeNotification(Int)` (Android) | Removes one SallaPush notification, by `notification.androidNotificationId`, a 32-bit integer. Does nothing on iOS. |
| `isSallaPushNotification(payload: Record<string, unknown>): Promise<boolean>` | `isSallaPushNotification(_:)`; `isSallaPushMessage(Map)` | Whether a payload another SDK received, an FCM data map or an APNs `userInfo`, is SallaPush's ([Data mapping](#data-mapping)) |
| `trackOpened(additionalData: Record<string, unknown> \| null): Promise<boolean>` | `trackOpened(JSONObject)` (Android) | Records `opened` for a SallaPush notification that OneSignal showed, from OneSignal's `additionalData`; `false` for any other. `false` on iOS, where those taps reach SallaPush through its delegate. |
| `addEventListener('click', listener: (event: SallaPushClickEvent) => void)` | `addClickListener` | [Events](#events) |
| `addEventListener('foregroundWillDisplay', listener: (event: SallaPushWillDisplayEvent) => void)` | `addForegroundLifecycleListener` | [Foreground display](#foreground-display) |
| `addEventListener('permissionChange', listener: (permission: boolean) => void)` | `addPermissionObserver` | Changes between allowed and not allowed; no replay |
| `removeEventListener(event, listener): void` | The matching removal | |

### SallaPush.Debug

| Member | Native | Behaviour |
|---|---|---|
| `getLogLevel(): Promise<SallaPushLogLevel>` | `logLevel` | The console level |
| `setLogLevel(level: SallaPushLogLevel): void` | `logLevel` | Sets the console level at run time. It wins over the configuration and the static key. |
| `setLogHandler(level: SallaPushLogLevel, handler: ((entry: SallaPushLogEntry) => void) \| null): void` | `setLogHandler(level:_:)`; `addLogListener`, `removeLogListener` | One handler for the app: a new one replaces the previous one, and `null` removes it. It gets the entries at `level` or more severe, whatever the console level, in the page's JavaScript. The first handler of the process also gets up to 100 earlier warnings and errors. On iOS it replaces a handler set from native code: native has one per process ([Logging](#logging)). |

### SallaPush.Migration

| Member | Native | Behaviour |
|---|---|---|
| `setDisplayOneSignalCompatPayloads(display: boolean): void` | `Migration.setDisplayOneSignalCompatPayloads` (Android) | Leaves OneSignal-format notifications to OneSignal, for the current process only: set `com.salla.push.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS` for every process. Does nothing on iOS. |

### Types

`SallaPushNotification`:

| Member | Value |
|---|---|
| `notificationId: string \| null` | The SallaPush message id |
| `title`, `subtitle`, `body: string \| null` | The text |
| `imageUrl: string \| null` | The image, https only |
| `launchUrl: string \| null` | The launch URL, as sent. SallaPush opens https URLs itself only with the open-launch-URLs option; the click listener then must not open it again. It is the sender's text, of any scheme: check its scheme and host before opening it, since a `javascript:` URL assigned to `window.location` runs in the app's page, with access to every plugin. |
| `additionalData: Readonly<Record<string, unknown>>` | Your data, with JSON types in the OneSignal-compatible format and strings in the native one |
| `rawPayload: Readonly<Record<string, unknown>>` | The payload as received: the APNs `userInfo`, or the FCM data map |
| `source: SallaPushPayloadSource` | `native` or `compat`, the OneSignal-compatible format |
| `sound: string \| null` | The sound |
| `badge: number \| null`, `threadId: string \| null` | iOS only; `null` on Android |
| `androidNotificationId: number \| null`, `collapseId: string \| null`, `channelId: string \| null` | Android only; `null` on iOS |
| `getString(key)`, `getInt(key)`, `getBool(key)` | A top-level `additionalData` value as native reads it, or `null` ([Data mapping](#data-mapping)) |
| `getNumber(key)` | iOS only, as native's `number(forKey:)`; `null` on Android |
| `display(): void` | Shows a held foreground notification, once, within 10 minutes ([Foreground display](#foreground-display)) |

The other types:

| Type | Members |
|---|---|
| `SallaPushClickEvent` | `notification`, and `result`: `actionId`, the action button tapped (iOS; `null` for a tap on the notification itself, and always on Android), and `url`, the launch URL |
| `SallaPushWillDisplayEvent` | `notification`, `isPrevented`, `preventDefault()` |
| `SallaPushSubscriptionChangedState` | `previous` and `current`, each a `SallaPushSubscriptionState`: `id`, `token`, `optedIn` |
| `SallaPushUserChangedState` | `previous` and `current`, each a `SallaPushUserState`: `externalId`, `isLoggedIn` |
| `SallaPushLogEntry` | `level`, `category`, `code`, `message`, `metadata` and `timestamp`, in milliseconds since the epoch |
| `SallaPushEventSubscription` | `remove()`, which removes the listener; a second call does nothing |
| `SallaPushConfig` | The options of `initialize` ([SallaPush](#sallapush)) |

The enumerations are objects of string constants, with a type of the same name:

| Enumeration | Values |
|---|---|
| `SallaPushLogLevel` | `Off` (`'off'`), `Error`, `Warn`, `Info`, `Debug`, `Verbose` |
| `SallaPushLoginFailure` | `TokenRejected` (`'tokenRejected'`), `InvalidRequest` (`'invalidRequest'`) |
| `SallaPushPayloadSource` | `Native` (`'native'`), `Compat` (`'compat'`) |
| `SallaPushAPNsEnvironment` | `Automatic` (`'automatic'`), `Sandbox`, `Production` |
| `SallaPushIOSPermissionStatus` | `NotDetermined` (`'notDetermined'`), `Denied`, `Authorized`, `Provisional`, `Ephemeral` |

## Events

| Topic | Rule |
|---|---|
| Adding and removing | `addEventListener` returns a subscription at once; `subscription.remove()` and `removeEventListener(event, listener)` both remove the listener. The same function added twice for one event is added once. An unknown event or a listener that isn't a function is dropped with a warning, and returns a subscription that does nothing. |
| Native registrations | The first listener of an event adds the event's Capacitor listener, which stays for the page, and registers one native listener or observer; removing the last one removes the native registration. Push-subscription listeners are the exception: each one has a native observer of its own. |
| Order | Events arrive in native's order, and each one reaches the listeners in the order they were added. A listener removed during a dispatch still gets that event. A listener that throws is reported with `console.error`, and the others still run. |
| Taps before a listener | Native keeps the taps made before its click listener exists: up to 10, for 5 minutes, in memory on iOS, and saved across a process restart on Android when SallaPush started from the static app id. They arrive a moment after the first click listener is added, once, at every click listener added by then; a listener added later doesn't get them. So add the click listener at app start, in the entry module. |
| Taps after the last listener | Once the last click listener is removed, or the page loads again, new taps wait natively again, by the same rules. |
| Page loads | Capacitor removes every plugin's listeners at each page load: the plugin removes every native registration of the page, as the removal of the last listener does, and forgets the held foreground notifications. The new page's listeners register again, from its own start-up code. A page that reloads at launch, for a live update for example, takes the kept taps with it when it had added the first click listener: add the click listener in the page that stays. |
| Subscription replay | Each subscription listener added while the device is registered first gets the current state once, with `previous` equal to `current`, whenever it is added; one added before native read its saved state gets it once native has. A listener added later, by a settings screen for example, gets its own replay, and the others none. |
| User and permission | No replay. User events follow native's handling of `login` and `logout`; permission events are changes only. |
| Login failures | `tokenRejected` or `invalidRequest`, each refusal of the current login once. There is no success event. |
| Foreground notifications | Synchronous: `preventDefault()` counts only before the listener returns, so call it before any `await` ([Foreground display](#foreground-display)). |
| Log entries | One handler, at its own level; the first handler of the process also gets up to 100 earlier warnings and errors |

A known limit: Capacitor runs the plugin calls of every page from one queue. When a listener call of the old page
still waits there as the page loads, behind another plugin's slow call, it reaches native after the page load, and
registers for a page that is gone, until the next page load. While it lasts, events of that kind can reach no
listener: a foreground notification stays hidden, or a kept tap is lost. It needs a page load at that very moment, so it
is rare; this release doesn't guard against it.

Native's own rules for observers and taps:
[iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#taps),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/BEHAVIOUR.md#observers-and-listeners).

## Foreground display

Native decides how a foreground notification shows synchronously: on iOS inside `willPresent`, on the main thread, and
on Android while FCM's thread waits, at most 500 ms, for the listeners. JavaScript can't answer that fast. So while at
least one `'foregroundWillDisplay'` listener exists:

1. Native calls this package's foreground listener, which calls native `preventDefault()`, holds the notification
   under a random handle, and sends it to JavaScript. Native records `received`, and the notification stays hidden.
2. JavaScript calls the listeners, in order. When they have returned, the package asks native to display the
   notification, unless a listener called `event.preventDefault()`. Native then records `displayed`.
3. A prevented notification can be shown later with `notification.display()`, once, within 10 minutes of its event.

What the app gets:

| | iOS | Android |
|---|---|---|
| Not prevented | Shown a moment later as SallaPush's local copy, with the losses below; `displayed` recorded | Shown a moment later, picture included; `displayed` recorded |
| Prevented | Not shown; `received` recorded; `display()` within 10 minutes shows the copy | Not shown; `display()` within 10 minutes shows it |
| No `'foregroundWillDisplay'` listener | The original, as native shows it, with the image from the extension, its actions and its interruption level | Native's default |
| JavaScript never answers, because the page loaded again mid-decision | Stays hidden, as with OneSignal's wrappers; there is no timeout | The same |

**On iOS, the local copy has only** the title, subtitle, body, sound, badge, thread id and payload. It loses:

- the image (the attachment);
- the category, so the action buttons, their `actionId`, and the `dismissed` event;
- the interruption level, such as time-sensitive;
- the relevance score;
- the collapse identifier: the copy's identifier is its own, so a later push with the same `apns-collapse-id` doesn't
  replace it.

So register a `'foregroundWillDisplay'` listener only where the app decides per notification, such as on a chat
screen, and remove it when leaving the screen
([Setup guide](SETUP.md#foreground-notifications)). Without a listener, iOS shows the original. Keeping the original
while JavaScript decides needs a native API that doesn't exist yet: an asynchronous foreground decision.

More rules:

- **The local copy reaches SallaPush's delegate first,** before Capacitor's router: it carries SallaPush's payload, so
  it shows with native's options, and never reaches `@capacitor/local-notifications`.
- **Native runs no listener while the user is opted out,** and shows no SallaPush notification
  ([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#foreground-notifications),
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#foreground-notifications)).
- **A listener that throws** doesn't stop the others or the decision.
- **The last listener's removal** stops native from holding new notifications, while one already on its way still
  gets its decision: it is shown.
- **A page load forgets the held notifications:** one held for the old page stays hidden.
- **Listen in one Capacitor bridge only.** In an app with several `CAPBridgeViewController`s or bridge activities, each
  one's plugin holds each foreground notification on its own: with listeners in several of them, a notification shows
  unless every one of them prevents it.
- **The held notifications** last 10 minutes, native's own display window. iOS holds at most 20, the oldest dropped
  first, as native does; Android holds up to 500. A `display()` for a handle that is unknown, expired or used logs
  `[SallaPush] SallaPushNotification.display() did nothing: a prevented notification is shown once, within 10 minutes
  of its foregroundWillDisplay event.`, and native logs its own refusals as `notif.display_failed`.
- **`display()` before `event.preventDefault()`** does nothing, as native refuses it: a later listener may still
  prevent the notification. A console warning says so, once.
- **`display()` on any other notification,** such as a click event's, does nothing; a console warning says so, once.

## Badges

Native SallaPush keeps the app icon's badge; the package passes on its two settings, both on by default: the static
keys `SallaPushAutoClearBadge` and `SallaPushAutoUpdateBadge` in the Info.plist, and `com.salla.push.AUTO_CLEAR_BADGE`
and `com.salla.push.AUTO_UPDATE_BADGE` in the manifest ([Static configuration](#static-configuration)), or
`autoClearBadge` and `autoUpdateBadge` in `initialize`'s config ([SallaPush](#sallapush)).

| | iOS | Android |
|---|---|---|
| How it counts | The Notification Service Extension adds 1 for each SallaPush notification, in place of a `badge` the push carries; one that replaces an earlier notification with the same collapse id adds nothing while the earlier one is still counted. It needs the extension and the same App Group in the app and the extension, and starts once the app has run with consent. iOS doesn't run the extension when the user turned the app's alerts off. | The launcher counts the app's notifications in the shade: each SallaPush notification adds one, and opening or swiping it away takes it off. Pixel shows a dot, with the count on touch and hold; Samsung and Xiaomi show the number when the user picks numbers; Android 6 to 7.1 shows none. |
| `autoClearBadge`, default `true` | Every time the app becomes active, the badge and SallaPush's count go to 0, and a SallaPush notification shown while the app is open doesn't change the badge. `false` keeps the badge: it then counts the SallaPush notifications still in Notification Center. | When the app comes to the foreground, SallaPush removes its notifications that show on the badge from the shade (Android 8.0 and later), which records no `dismissed`. Not when the phone was unlocked with the app on screen, and never other notifications. `false` keeps them. |
| `autoUpdateBadge`, default `true` | `false` turns counting off: SallaPush sets no number, except `autoClearBadge`'s 0, and a push's own `badge` applies. | `false` creates SallaPush's notification channels without badges, so its notifications add nothing, and the clear on open leaves them. A channel that already exists keeps its badges: `badge.channel_badges_on` says so. |
| `clearAll()` | Removes SallaPush's delivered notifications, and sets the badge to 0 while `autoUpdateBadge` is on | Removes SallaPush's notifications, which lowers the badge |
| Consent required and not given | SallaPush neither counts nor clears | SallaPush clears nothing |

- **One badge per app.** On iOS the icon shows the last number written: SallaPush's, another SDK's, a push's own
  `badge`, or your app's. On Android the launcher adds up all of the app's notifications, SallaPush's and others'.
- **iOS 15.** Setting the badge to 0 also removes the app's delivered notifications, other SDKs' and plugins' included,
  and while SallaPush counts, the badge is above 0 after any SallaPush notification
  ([Removing delivered notifications](#removing-delivered-notifications)).
- **The deprecated `ios.autoClearBadge`** still applies on iOS when `autoClearBadge` is left out; `autoClearBadge`
  wins over it.

The native references have every rule
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#badges),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#badges)).

## Errors

| Situation | Native | This package |
|---|---|---|
| An invalid argument: an empty tag key, a bad token, an invalid URL | Logged (`api.invalid_argument`, `tags.invalid_key`, `config.invalid_base_url`, …) and ignored | The call completes normally |
| An argument of the wrong type: a number for a string, a non-object for tags | – | Dropped by JavaScript with one `console.warn`; a request resolves `false` |
| Entries of another type inside `addTags` or `removeTags` | Skipped and logged | Passed to native unchanged |
| `initialize` after a static start, with the same app id and no `apiBaseUrl` | Changes nothing, every option included; native says so at info, below the default level | One console error names the ignored options and their static keys |
| `setConsentRequired(true)` after a static start without the consent key | Applied late: the device may already have registered and sent data | One console error names the key to set |
| A call before initialization, or while consent is withheld | Kept, then run in order | Completes normally |
| An invalid first app id | SallaPush is off until the next launch (`init.invalid_app_id`) | Completes normally |
| A refused login | The login failure | A `'loginFailure'` event |
| A call for the other platform only | – | The neutral value, and one console line per process |
| `display()` of a will-display notification that no listener prevented | Refused (`notif.display_failed`) | Does nothing; one console warning |
| `display()` of a notification without a handle | – | Does nothing; one console warning |
| The native plugin missing: the web, or a native build made without `npx cap sync` | – | Requests reject with Capacitor's `UNIMPLEMENTED` error; setters and listeners print one console error each, such as `[SallaPush] SallaPush.login failed: "SallaPush" plugin is not implemented on web` |
| `capacitor.config` has a `plugins.SallaPush` section | – | Ignored; one `[SallaPush]` console error when the plugin loads |
| An unexpected exception in the Android plugin | – | The request rejects with `E_SALLAPUSH_INTERNAL`; never expected, since native never throws |

Web code that must not reach these errors checks `Capacitor.isNativePlatform()` or
`Capacitor.isPluginAvailable('SallaPush')` first ([Setup guide](SETUP.md#on-the-web)).

### In unit tests

A test runner loads Capacitor as on the web, so the package's requests reject there and its other calls print console
errors. Mock the package in your tests, with the members your code calls. With Jest:

<!-- unchecked: an app's Jest test file or setup file, with a stand-in for this package; list the members your code calls -->
```ts
jest.mock('@salla.sa/sallapush-capacitor', () => {
  const subscription = { remove: jest.fn() };
  return {
    SallaPush: {
      initialize: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      setConsentGiven: jest.fn(),
      User: {
        addTag: jest.fn(),
        addTags: jest.fn(),
        setLanguage: jest.fn(),
        addEventListener: jest.fn(() => subscription),
        pushSubscription: {
          getId: jest.fn(async () => null),
          optIn: jest.fn(),
          optOut: jest.fn(),
          addEventListener: jest.fn(() => subscription),
        },
      },
      Notifications: {
        requestPermission: jest.fn(async () => false),
        isSallaPushNotification: jest.fn(async () => false),
        addEventListener: jest.fn(() => subscription),
      },
      Debug: { setLogLevel: jest.fn(), setLogHandler: jest.fn() },
    },
    SallaPushLogLevel: { Off: 'off', Error: 'error', Warn: 'warn', Info: 'info', Debug: 'debug', Verbose: 'verbose' },
  };
});
```

With Vitest, the same with `vi`:

<!-- unchecked: an app's Vitest test file or setup file, with a stand-in for this package; list the members your code calls -->
```ts
vi.mock('@salla.sa/sallapush-capacitor', () => {
  const subscription = { remove: vi.fn() };
  return {
    SallaPush: {
      initialize: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      User: {
        addTag: vi.fn(),
        addEventListener: vi.fn(() => subscription),
        pushSubscription: { getId: vi.fn(async () => null) },
      },
      Notifications: {
        requestPermission: vi.fn(async () => false),
        addEventListener: vi.fn(() => subscription),
      },
    },
    SallaPushLogLevel: { Off: 'off', Error: 'error', Warn: 'warn', Info: 'info', Debug: 'debug', Verbose: 'verbose' },
  };
});
```

## Data mapping

| Field | iOS source | Android source | JavaScript |
|---|---|---|---|
| `notificationId`, `title`, `subtitle`, `body`, `launchUrl`, `sound` | The same-named `String?` (`launchURL`) | The same-named `String?` | `string` or `null` |
| `imageUrl` | `imageURL?.absoluteString` | `imageUrl` | `string` or `null` |
| `additionalData` | JSON values | JSON values: strings in native payloads, JSON types in compatible ones | An object, `null` values kept. Numbers arrive as JavaScript numbers on both platforms. |
| `rawPayload` | The whole `userInfo`, kept to JSON values (strings, numbers, booleans, null, arrays and objects; keys as text) | The FCM data map, unchanged: `custom` stays JSON text, so nothing is lost | An object |
| `source` | `.native`, `.compat` | `NATIVE`, `COMPAT` | `'native'`, `'compat'` |
| Typed values | Native's `string(forKey:)`, `int(forKey:)`, `bool(forKey:)` and `number(forKey:)` for each top-level `additionalData` key | `getString`, `getLong` and `getBoolean`; no `getNumber` | Read by `getString`, `getInt`, `getBool` and `getNumber` |
| `badge`, `threadId` | `badge`, `threadId` | – | `number` or `string`, else `null` |
| `androidNotificationId`, `collapseId`, `channelId` | – | The same-named fields | `number` or `string`, else `null` |
| A click's `actionId`, `url` | `result.actionId`, `result.url` | `result.actionId` (always `null`), `result.url` | `string` or `null` |
| A log entry's time | `date` | `timestampMillis` | `timestamp`, in milliseconds since the epoch |
| Enumerations | By case, never by raw value | By name | The strings of the [enumerations](#types) |

- **Native does every conversion.** The typed getters return what native's own accessors returned for each top-level
  key when the notification was mapped. Native's rules differ per platform, and stay native's
  ([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#routing-taps-yourself),
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#reading-notification-data)).
- **Values reach JavaScript as JSON.** Capacitor carries every event as a JSON object, so a `null` in `additionalData`,
  at any depth, arrives as `null` on both platforms, and lists keep their length.
- **JavaScript numbers are exact up to 2^53.** A larger integer in `additionalData`, or from `getInt` or `getNumber`,
  loses precision. On Android, `rawPayload` keeps every value exactly, since `custom` stays text.
- **Which payload is SallaPush's** is native's rule: a native payload has `sp_v`, and a compatible one a `custom`
  object with a string `i` and a SallaPush message id in `a.push_ref`. Every other payload, plain OneSignal pushes
  included, belongs to another SDK.

What JavaScript passes to native:

- **`isSallaPushNotification(payload)`.** On Android, strings stay as they are, objects and arrays become JSON text,
  other values their text, and `null` values are dropped, which gives the string map an FCM message has. On iOS,
  `null` values are dropped.
- **`trackOpened(additionalData)`.** Android passes it as a JSON object, of which native reads `push_ref`.
- **`forwardApnsToken(apnsToken)`.** iOS decodes the hexadecimal text to the token's bytes.
- **`initialize`'s options.** Only the options given reach native; the others keep native's defaults.
- **`setLanguage(null)`** passes native's "device language".

## Coexistence with other SDKs

SallaPush never swizzles, never takes over another SDK's notifications, and removes only its own, except on iOS 15,
where clearing the badge can remove every delivered notification of the app
([Removing delivered notifications](#removing-delivered-notifications)). The rules of the native SDKs hold
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#coexistence-with-other-sdks),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#coexistence-with-other-sdks)).

### Capacitor's notification router

On iOS, Capacitor's bridge has a notification router, which hands each notification to one of two handler slots: a
push, whose trigger is a push trigger, to its push handler (`@capacitor/push-notifications` or
`@capacitor-firebase/messaging` takes that slot), and anything else to its local-notification handler
(`@capacitor/local-notifications`). With `ios.handleApplicationNotifications` at its default, `true`, the bridge makes
the router the notification center's delegate when it starts, after launch.

SallaPush's delegate, which `SallaPushCapacitor.start()` installs during launch, works with that:

- **When the plugin loads,** inside the bridge's start and right after the router took the delegate, it takes the
  delegate back and remembers the router, weakly: the bridge owns it. A delegate kept from before is dropped then, as
  the router itself dropped it.
- **SallaPush's notifications,** its own foreground copies included, go to native, which completes each one once.
- **Every other notification goes to the router's handlers, by the router's own rule:** `willPresent` completes with
  the handler's presentation options, or none without a handler; `didReceive` hands the response to the handler, then
  completes. SallaPush calls the handlers, never the router's delegate methods, so an SDK that swizzled the router's
  class doesn't run twice. Each such notification takes the path it takes in the app without SallaPush.
- **Without a router** (`ios.handleApplicationNotifications` set to `false`), other notifications go to the delegate
  set before `start()`, as in [Other notification-center delegates](#other-notification-center-delegates).
- **A second bridge,** in an app with two `CAPBridgeViewController`s, has a second router. When its plugin loads,
  SallaPush hands notifications to the newest router, as Capacitor itself does, and checks the delegate again when the
  app is active.
- **The package's checks** fail when an update of `@capacitor/ios` changes the router's rule, so the two can't drift
  apart unnoticed.

What happens per app:

| App | At `start()` | When the plugin loads | Result |
|---|---|---|---|
| Default setting, no other SDK | No delegate; SallaPush's is set | The router took over: SallaPush takes it back, chained to the router | SallaPush first; every other notification to Capacitor's handlers |
| Default setting, with `@capacitor/push-notifications`, `@capacitor/local-notifications` or `@capacitor-firebase/messaging` | The same | The same | Their handlers get every notification that isn't SallaPush's, with their presentation options |
| `ios.handleApplicationNotifications` `false` (OneSignal's setup) | OneSignal's placeholder delegate is kept as the previous one | SallaPush's is still the delegate: nothing to do | The [OneSignal rules](#onesignal-5); OneSignal's swizzling runs once, on SallaPush's class |
| `false`, with the app's own delegate set before `start()` | The app's delegate is kept | Nothing to do | The app's delegate gets every notification that isn't SallaPush's |
| Default setting, with OneSignal anyway | OneSignal's placeholder is kept | The router took over: SallaPush takes it back, chained to the router; the placeholder is dropped, as Capacitor drops it | As without SallaPush: the router's handlers answer first, and OneSignal's later answer is ignored |

2 seconds after the app first becomes active, and again when SallaPush's plugin loads while the app is active, the
package checks the delegate and logs which one SallaPush hands other notifications to, or an error ([Logging](#logging)).

### @capacitor/push-notifications

- **iOS.** Its handler gets every push that isn't SallaPush's, with its `presentationOptions`; SallaPush's never reach
  its `pushNotificationReceived` or `pushNotificationActionPerformed` events. Its setup posts the APNs token and a
  registration failure from the `AppDelegate`: keep those posts after SallaPush's lines
  ([Setup guide](SETUP.md#another-push-plugin)).
- **Android.** Its FCM service, at priority 0, outranks SallaPush's at −450, so the app adds the forwarding service
  at priority 1 ([Setup guide](SETUP.md#another-fcm-plugin)). SallaPush's line comes first, so SallaPush's messages
  never reach `pushNotificationReceived`.
- **`unregister()`** unregisters the app from APNs on iOS, for every SDK, and on Android deletes the app's FCM token,
  which SallaPush uses too, and turns FCM's auto-init off: avoid it.

### @capacitor/local-notifications

Its handler gets every local notification except SallaPush's foreground copies, which carry SallaPush's payload. On
Android nothing changes.

### @capacitor-firebase/messaging

- **iOS.** As `@capacitor/push-notifications`, and Firebase's proxy swizzles SallaPush's delegate class and calls the
  original. It reports every notification the `AppDelegate` posts as `"didReceiveRemoteNotification"` to its
  `notificationReceived` listeners, so the app posts only those that aren't SallaPush's: SallaPush's
  `didReceiveRemoteNotification(_:)` returns true for its own ([Setup guide](SETUP.md#another-push-plugin)). It never
  calls the completion handler, so the method calls it, once. Forwarding its `apnsTokenReceived` token with
  `forwardApnsToken` is optional.
- **Android.** As `@capacitor/push-notifications`, with the forwarding service extending its
  `io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService`.
- **`deleteToken()`** deletes the app's FCM token on Android, which SallaPush uses too: avoid it.

### OneSignal 5

`@onesignal/capacitor-plugin` and `onesignal-cordova-plugin` 5:

- **iOS.** OneSignal's setup sets `ios.handleApplicationNotifications` to `false`, so Capacitor's router never becomes
  the delegate. OneSignal-compatible SallaPush notifications carry OneSignal's `custom.i`, so both SDKs see their taps
  and foreground arrivals. Route each one once ([Setup guide](SETUP.md#migrating-from-onesignal)). Keep
  `OneSignal_suppress_launch_urls` set to `YES`. In the Notification Service Extension, SallaPush goes first and
  OneSignal last.
- **Android.** OneSignal's receiver, at priority 999 for FCM's broadcast, shows OneSignal-format notifications first,
  SallaPush's compatible ones included, so SallaPush never sees them: report their taps with `trackOpened`. A device
  that shows two copies needs `com.salla.push.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS` set to `false`.

### Other FCM SDKs

Intercom, Klaviyo, MoEngage, WebEngage and any other SDK with an FCM service outrank SallaPush's service at −450. Add
the forwarding service of the [setup guide](SETUP.md#another-fcm-plugin), with that SDK's calls after SallaPush's
line, as the native guide shows
([Android coexistence](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#coexistence-with-other-sdks)).
On iOS, keep their own forwarding: their notifications are never SallaPush's.

### Removing delivered notifications

`removeAllDeliveredNotifications()` of `@capacitor/push-notifications`, `@capacitor/local-notifications` and
`@capacitor-firebase/messaging` removes every delivered notification of the app, SallaPush's included, on iOS and on
Android. Use `SallaPush.Notifications.clearAll()`, which removes SallaPush's only, for SallaPush's notifications, and
the other plugins' `removeDeliveredNotifications(…)` for theirs.

On iOS 15, `autoClearBadge`, on by default, sets the app's badge to 0 whenever the app becomes active with a badge,
and iOS 15 removes the app's delivered notifications with it, other SDKs' and plugins' included. While SallaPush counts
its notifications, the badge is above 0 after any of them, so that happens at almost every activation. To keep them,
set `SallaPushAutoClearBadge` to `NO` in the Info.plist, or `autoClearBadge` to `false` in `initialize`'s config
([native badges](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#badges)).

### Other notification-center delegates

`SallaPushCapacitor.start()` makes SallaPush's delegate, a subclass of native's `SallaPushNotificationCenterDelegate`,
the notification center's delegate:

- **The delegate set before it is kept**, strongly, since the notification center holds its delegate weakly, until
  Capacitor's router replaces it ([Capacitor's notification router](#capacitors-notification-router)).
- **`willPresent` and `didReceive`** go to that delegate when it implements the method and the notification isn't
  SallaPush's. SallaPush's own go to native, which completes each one once. Without a previous delegate or a router,
  other notifications show with banner, list, sound and badge, as native's ready-made delegate does.
- **OneSignal 5's placeholder delegate,** which OneSignal sets when the app has none, gets the taps but not
  `willPresent`: OneSignal's swizzling already ran its foreground handling on SallaPush's delegate, and OneSignal
  decides its own notifications. Other SDKs' notifications then show with native's default options.
- **`openSettingsFor`** goes to the previous delegate when it implements it.
- **A delegate set later** replaces SallaPush's. The package's check, 2 seconds after the app first becomes active,
  logs an error that names its class. Set your own delegate before `SallaPushCapacitor.start()`, or forward from it to
  SallaPush with `SallaPush.Notifications.willPresent(_:)` and `didReceive(_:)`, as native apps do.

### Another SDK's tap that launches the app

A tap on another SDK's notification that launches the app reaches SallaPush's delegate. When iOS hands it over before
Capacitor's bridge exists, there is no router yet: the delegate gives it to the delegate set before `start()`, if
there is one, and otherwise completes it without a handler, and logs once per process:
`[SallaPush] A notification response that isn't SallaPush's arrived before Capacitor's notification router existed,
and was completed without a handler.` Whether iOS ever hands such a tap over that early isn't verified yet
([Not verified yet](TROUBLESHOOTING.md#not-verified-yet)).

## Migrating from OneSignal

Keep the OneSignal SDK in your app until every notification you send goes through SallaPush. Add SallaPush next to it,
then follow the setup guide's steps ([Migrating from OneSignal](SETUP.md#migrating-from-onesignal)) and the native guides
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/REFERENCE.md#migrating-from-onesignal),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/REFERENCE.md#migrating-from-onesignal)).

## Logging

The native docs list every log code, with its level and meaning
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/LOGGING.md),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/LOGGING.md)). Codes are stable: match on
them, never on messages. Most codes exist on both platforms. These exist on one only:

- **Android only:** `init.not_main_process`, `api.null_argument`, `api.callback_threw`, `token.firebase_missing`,
  `token.auto_init_disabled`, `token.fetch_failed`, `permission.prompt_deferred`, `net.monitor_unavailable`,
  `storage.crypto_reset`, `notif.image_unusable`, `display.default_icon`, `badge.channel_badges_on`,
  `fcm.forwarding_hint`, `work.unavailable` and `internal.error`.
- **iOS only:** `init.no_delegate`, `config.no_app_group`, `status.launch`, `status.changed`, `api.callback_repeated`,
  `token.registration_failed`, `inbox.ingested`, `inbox.invalid_file`, `storage.keychain_locked`,
  `notif.off_main_thread`, `badge.set`, `badge.zero_skipped`, `lifecycle.background_expired`, `nse.attachment_failed`,
  `nse.expired`, `nse.replaced_request`, `nse.received_sent`, `nse.received_deferred`, `nse.badge_set` and
  `nse.badge_skipped`.

No secret or identity token is ever logged. **Privacy:** what SallaPush iOS writes in the info entries `status.launch`
and `status.changed` is described in its
[logging guide](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/LOGGING.md#what-is-never-logged).
Keep the console level at `warn` in release builds, and don't forward info entries to third parties. A log handler at
`warn` or quieter never receives them; a console level of `info` or more, set by the static key, `initialize`'s
`logLevel` or `setLogLevel`, also writes them to the device log, in release builds too.

**One log handler per process on iOS.** Native keeps one handler per process: in an app with two Capacitor bridges
whose pages both set a log handler, the page that set it last receives the entries, and either bridge's page load or
teardown removes it.

**Capacitor's own logging.** With `loggingBehavior` at its default, `'debug'`, Capacitor logs in debug builds every
plugin call with its options, and on iOS the start of every result and event it sends to JavaScript. So `login`'s
identity token, push tokens and log entries reach the device log in debug builds. Never set `loggingBehavior` to
`'production'`, which logs the same in release builds.

The package logs a few lines of its own, all starting with `[SallaPush]`, on iOS to the unified log (subsystem
`com.salla.push`, category `wrapper`) and on Android to Logcat (tag `SallaPush`):

| Level | When |
|---|---|
| Error | A setup problem: `SallaPushCapacitor.start()` wasn't called (iOS); another delegate replaced SallaPush's notification-center delegate (iOS); `capacitor.config` has a `plugins.SallaPush` section; `initialize` repeated the static app id with options; `setConsentRequired(true)` came after a static start without the consent key; a static key with a value it can't use; an APNs token that isn't hexadecimal |
| Warning | `display()` with a handle that is unknown or expired |
| Info | On iOS, 2 seconds after the first activation: SallaPush's delegate is the current one, and which one it hands other notifications to (`Capacitor's notification router`, a class name, or `nothing`). On iOS, once per process: a notification response that isn't SallaPush's, completed before Capacitor's router existed. A call that works on the other platform only, once per process. |

In JavaScript, the package warns once per method and argument about a mistyped call, reports a listener that threw
with `console.error`, and prints one console error per method and page for a call that can't reach the plugin.

## Compatibility

- **Native SDKs:** SallaPush iOS 1.0.4 and SallaPush Android 1.0.4.
- **Capacitor 8,** 8.0.0 or later and below 9. Release checks build apps with Capacitor 8.0.2 and 8.5.3, in both iOS
  app shapes: the storyboard template of 8.0 to 8.4 and the UIScene template of 8.5, with Swift Package Manager and
  CocoaPods. Capacitor 9 isn't supported yet, and the tools stop it unevenly: npm refuses the install (a peer
  conflict), CocoaPods refuses the pod (it requires Capacitor below 9), Yarn 4 and pnpm only warn, and with Swift
  Package Manager Capacitor's CLI rewrites the plugin's Capacitor requirement and only warns.
- **iOS** 15.0 or later. Xcode 26, which Capacitor 8 needs. The Swift package uses tools version 5.9, and the plugin
  builds in Swift 5 language mode with both package managers.
- **Android** minSdk 24, Capacitor 8's floor (SallaPush itself needs 23), and compileSdk 36: the plugin takes both from
  your app's `minSdkVersion` and `compileSdkVersion` (`variables.gradle` in Capacitor's template) when it sets them;
  Java 21. The plugin compiles with your app's Kotlin Gradle plugin (`kotlin_version`), else 2.2.20. The native SDK
  brings `firebase-messaging`, `androidx.core`, `androidx.work` and the Kotlin standard library; a newer version in your
  app wins ([native requirements](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/README.md#requirements)).
- **R8.** Minified release builds need no rule of your own: the package's consumer rules, and those of
  SallaPush Android 1.0.4, add the one that the WorkManager version SallaPush brings lacks. Without it, R8's strict
  full mode, the default from the Android Gradle plugin 9, removes the constructor of WorkManager's database class, and
  the app crashes at start. Capacitor's own rules keep the plugin class. The example's release build is minified.
- **JavaScript.** The package's code is ES2017, as Capacitor's own, so it runs on the oldest Android System WebView
  that Capacitor accepts (version 60) without your bundler transpiling it. On the web the package loads, and its calls
  fail as [Errors](#errors) says.
- **Package managers:** npm and Yarn 4 install the package from npm; a release tag installs from git with the opt-ins
  of the [setup guide](SETUP.md#from-git). The release checks install the package as npm would publish it with
  npm 12.2.0, and from git with npm 12.2.0 and Yarn 4.18.1. npm 11 installs git dependencies with a warning. pnpm,
  Yarn 1 and Bun aren't verified yet.
