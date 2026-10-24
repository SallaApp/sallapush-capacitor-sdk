# SallaPush Capacitor SDK: troubleshooting

Known problems, by what you see. Set the log level to `verbose` first ([Logging](../README.md#logging)); the native
docs explain every log code
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.4/docs/LOGGING.md#log-code-reference),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.4/docs/LOGGING.md#log-code-reference)).

## Installing and building

| You see | Fix |
|---|---|
| `npx cap sync ios` or `pod install`: "Unable to find a specification for `SallaPush (= 1.0.4)` depended upon by `Salla.saSallapushCapacitor`" | A CocoaPods app: add the [Podfile lines](../README.md#installation), and the extension's target when the app has the extension, then run `npx cap sync ios` again. |
| After an update: `CocoaPods could not find compatible versions for pod "SallaPush"`, or Xcode can't resolve `sallapush-ios-sdk` | Set every SallaPush pin of your app, each `:tag =>` of the Podfile or the extension's package rule, to the SallaPush iOS version of [Requirements](../README.md#requirements), then run `npx cap sync`. |
| Duplicate SallaPush symbols, or two SallaPush instances at run time | A Swift Package Manager app, with `ios/App/CapApp-SPM`, never declares the SallaPush pods: remove them from the Podfile. |
| "unknown ISA `PBXFileSystemSynchronizedRootGroup`", or "Unable to find compatibility version string for object version 77" | Update CocoaPods to 1.16 or later, or convert the extension's folder to a group (right-click it, **Convert to Group**). |
| `"SallaPush" plugin is not implemented on ios` (or `android`) | Run `npx cap sync`, then rebuild the app. On the web, it is expected. |
| npm: `ERESOLVE` for the peer dependency `@capacitor/core@"^8.0.0"` | The app uses Capacitor 9, which isn't supported yet. |
| npm or Yarn refuses the git dependency | npm 12 needs `allow-git=root` in `.npmrc`; Yarn 4.14 or later, the repository in `approvedGitRepositories` ([Installation](../README.md#installation)). |
| Gradle: `Could not find com.salla.push:sallapush` | Add `mavenCentral()` to the repositories, or to `settings.gradle`'s when it sets `RepositoriesMode.PREFER_SETTINGS`. |
| Gradle: "invalid source release: 21" | Build with JDK 21, through `JAVA_HOME` or Android Studio's Gradle JDK setting. |
| The manifest merger: "requires a placeholder substitution but no value for <sallaPushAppId> is provided" | Add `manifestPlaceholders += [sallaPushAppId: "…"]` to `defaultConfig` ([Android setup](../README.md#android)). |

## Setup

| You see | Fix |
|---|---|
| SallaPush doesn't start: no `init.started`, and `isInitialized()` resolves `false` | The build has no app id: define `SALLAPUSH_APP_ID` for every build configuration, Release included, and the `sallaPushAppId` placeholder for every product flavor. |
| `init.invalid_app_id` | Fix the app id: 1 to 64 letters, digits, `_` and `-`. |
| `register.dormant` with `404 unknown_app` | Check the app id you set. |
| Nothing registers, and `consent.waiting` at info level | Consent is required and not given: call `SallaPush.setConsentGiven(true)` once the user agrees. |
| `[SallaPush] SallaPushCapacitor.start() was not called in application(_:didFinishLaunchingWithOptions:)…` | Add `SallaPushCapacitor.start()` as its first statement ([iOS setup](../README.md#ios)). |
| `[SallaPush] <class> replaced SallaPush's notification-center delegate after SallaPushCapacitor.start(): …`, or no tap reaches the click listener | Set your own `UNUserNotificationCenter` delegate before `SallaPushCapacitor.start()`, or forward from it with `SallaPush.Notifications.willPresent(_:)` and `didReceive(_:)`. |
| `[SallaPush] capacitor.config's plugins.SallaPush section is ignored: …` | Remove it, and use the [static keys](REFERENCE.md#static-configuration). |
| `[SallaPush] initialize ignored …` | Set those options with the static keys the message names, and drop the `initialize` call. |
| `[SallaPush] setConsentRequired(true) came after SallaPush started from …` | Set `SallaPushRequiresUserConsent` to `YES` and `com.salla.push.REQUIRES_USER_CONSENT` to `true`. |
| `[SallaPush] Ignored …` | Fix the static key's value as the message says ([Static configuration](REFERENCE.md#static-configuration)). |

## iOS

| You see | Fix |
|---|---|
| No `token.received`, and `token.missing` | Add the Push Notifications capability and the [AppDelegate methods](../README.md#ios). With `registerForRemoteNotificationsOnInit` off, call `SallaPush.Notifications.registerForRemoteNotifications()` at every launch. |
| `token.registration_failed` | The message ends with iOS's reason. "remote notifications are not supported in the simulator": use iOS 16 or later on a Mac with Apple silicon or a T2 chip, or a device. "no valid aps-environment entitlement": add the Push Notifications capability. |
| The tap that launched the app never reaches the click listener | Call `SallaPushCapacitor.start()` first, set your own delegate before it, and add the click listener in your entry module, in the page that stays. |
| No image, no `received`, or the badge doesn't count | Add the [Notification Service Extension](../README.md#ios), with the same App Group in both targets and in their `SallaPushAppGroup`. Images must be https, at most 10 MB. With `SallaPushLogLevel` at `info` in the extension's Info.plist, `nse.badge_skipped` says why it doesn't count. |
| The badge always shows 1 | The extension isn't counting: see the row above. |
| A foreground notification has no image or action buttons | A `'foregroundWillDisplay'` listener exists, so iOS shows SallaPush's local copy ([Foreground display](REFERENCE.md#foreground-display)). |
| On iOS 15, delivered notifications disappear when the app opens | `autoClearBadge` sets the badge to 0, which on iOS 15 removes them: set it to `false`. |

## Android

| You see | Fix |
|---|---|
| `token.firebase_missing` | Put your app's `google-services.json` in `android/app`. |
| `token.auto_init_disabled` | Turn Firebase's auto-init back on. |
| `register.ok`, but SallaPush notifications never show; `fcm.forwarding_hint` | Another plugin's service receives the messages: add the [forwarding service](REFERENCE.md#another-push-plugin-on-android). |
| `notif.suppressed` | The message says why: notifications are off, the channel is blocked, the user opted out, or the notification has no text. |
| `display.default_icon` | Add a white-on-transparent drawable as `com.salla.push.default_notification_icon`. |
| SallaPush notifications leave the shade when the app opens | `autoClearBadge` is on: remove `com.salla.push.AUTO_CLEAR_BADGE` or set it to `false`, and leave `autoClearBadge` out of `initialize`'s config. |
| The badge stays after the app opens | Expected: `autoClearBadge` is off by default on Android. Turn it on, or call `SallaPush.Notifications.clearAll()`. |
| `badge.channel_badges_on` | The channel existed with badges: create your own with `setShowBadge(false)`, and name it in `com.salla.push.default_channel_id`. |
| A minified release build crashes at start: "Failed to create an instance of class androidx.work.impl.WorkDatabase" | Keep the libraries' consumer rules, or add `-keep class * extends androidx.room.RoomDatabase { <init>(); }`. |

## Identity and JavaScript

| You see | Fix |
|---|---|
| `login.rejected`, and a `'loginFailure'` event with `tokenRejected` | Pass the customer's current token, without `Bearer `, and their id as `externalId`. Call `login` again once your app has a current token, not from the listener. |
| `identity.token_needed` | Call `login` at each app launch while the customer is signed in. |
| `identity.client_error`, and a `'loginFailure'` event with `invalidRequest` | Contact the Salla team, with your app id and when it happened. |
| In a browser: `"SallaPush" plugin is not implemented on web` | Expected: guard code that also runs on the web with `Capacitor.isNativePlatform()`. |
| `[SallaPush] <method> ignored: <argument> must be …` | Pass the type the message names. |
| `[SallaPush] A … listener threw:` | Fix that listener; the others still ran. |
| Listeners get nothing after the page reloaded | Add them in start-up code that runs at every page load. |
| `getId()` is `null`, or `getTags()` lacks earlier tags, right after launch | Read the subscription in its `'change'` listener. |
| `[SallaPush] SallaPushNotification.display() did nothing…` | Call `display()` once, within 10 minutes, on a notification a listener prevented. |
| A tap's launch URL opens twice | With the open-launch-URLs option on, don't open `result.url` from the click listener. |
| A cold-start tap opens the home screen | Keep the destination, and open it once your navigation is ready. |
| Tokens appear in the device log | Capacitor's logging in debug builds. Never set `loggingBehavior` to `'production'`. |
| A promise rejected with `E_SALLAPUSH_INTERNAL` | [Open an issue](https://github.com/SallaApp/sallapush-capacitor-sdk/issues/new/choose) with the message and the versions. |
