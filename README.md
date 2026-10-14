# SallaPush Capacitor SDK

SallaPush is Salla's push notification service. This package brings it to Capacitor apps. Its TypeScript API calls the
native SallaPush iOS and Android SDKs, so an app behaves as a native SallaPush app does. The API follows OneSignal v5,
so most calls will look familiar.

- **Version:** 1.0.0, not released yet. It wraps SallaPush iOS 1.0.3 and SallaPush Android 1.0.3. See
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

## Contents

- [Versions](#versions)
- [Before you start](#before-you-start)
- [Install](#install)
- [iOS setup](#ios-setup)
- [Android setup](#android-setup)
- [Quick start](#quick-start)
- [API overview](#api-overview)
- [Events](#events)
- [Consent](#consent)
- [Logging](#logging)
- [Initializing from JavaScript](#initializing-from-javascript)
- [Coexistence](#coexistence)
- [Migrating from OneSignal](#migrating-from-onesignal)
- [Verify your integration](#verify-your-integration)
- [Troubleshooting](#troubleshooting)
- [Updating the native SDKs](#updating-the-native-sdks)
- [More documentation](#more-documentation)

## Versions

| Wrapper | SallaPush iOS | SallaPush Android | Framework | iOS | Android |
|---|---|---|---|---|---|
| Capacitor 1.0.0 | 1.0.3 | 1.0.3 | Capacitor 8 (8.0 or later; Capacitor 9 isn't supported yet) | 15.0 | minSdk 24 (SallaPush itself needs 23), compileSdk 36 |

The package pins the native SDKs exactly. A new native release comes with a new version of this package.

Not every tool stops a Capacitor 9 app: npm refuses the install, and CocoaPods refuses the pod, but Yarn and pnpm only
warn about the peer range, and with Swift Package Manager Capacitor's CLI only warns that the plugin "is built for
Capacitor 8". So check the version yourself before you upgrade Capacitor.

## Before you start

- **Read access to three private repositories,** for every developer and CI machine that builds the app: this one,
  `SallaApp/sallapush-ios-sdk`, which serves the iOS Swift package and pods, and `SallaApp/sallapush-android-sdk`,
  whose GitHub Packages registry serves the Android library. Ask the repositories' admins for access.
- **A network that the SallaApp organization allows,** CI machines included: the organization accepts git and package
  fetches from its private repositories only from allowed networks, and GitHub-hosted runners aren't among them.
- **A personal access token (classic) with the `read:packages` scope,** from an account that can read
  `SallaApp/sallapush-android-sdk`, for Gradle. Fine-grained tokens don't work with GitHub Packages' Maven registry.
- **An app id for each platform, from the SallaPush team,** such as `st_<store id>_ios` and `st_<store id>_android`.
  The team sets up the iOS app id with your bundle id and APNs key, and the Android one with your Firebase project.
  Until then devices register, but no notification arrives
  ([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/REFERENCE.md#before-you-start),
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/REFERENCE.md#before-you-start)).

## Install

Add the package to your app's `package.json`, with the release tag:

<!-- unchecked: a dependency line of an app's package.json; scripts/verify.sh consumer installs a release commit the same way -->
```json
"@salla.sa/sallapush-capacitor": "git+ssh://git@github.com/SallaApp/sallapush-capacitor-sdk.git#1.0.0"
```

- **The tag is a release commit** that holds the built library, so nothing builds at install time.
- **Keep this `git+ssh` form:** Yarn turns the `github:` shorthand into an HTTPS URL and never tries SSH.
- **Keep the package name as the dependency key.** Capacitor's CLI names the plugin's pod and Swift package after the
  key, not after the installed package, so an alias points your app at a pod and a package that don't exist.

Recent package managers fetch git dependencies only when the app allows them:

- **npm 12:** add `allow-git=root` to the app's `.npmrc`. npm 11 only warns.
- **Yarn 4.14 and later:** approve the repository in `.yarnrc.yml`, and keep Yarn's `node_modules` folder, where
  Capacitor's CLI looks for plugins:

<!-- unchecked: settings of an app's .yarnrc.yml; scripts/verify.sh consumer proves them with a local git server -->
```yaml
nodeLinker: node-modules
approvedGitRepositories:
  - "ssh://git@github.com/SallaApp/sallapush-capacitor-sdk.git"
```

- **pnpm:** the release runs no install script, so pnpm has nothing to approve. pnpm isn't part of the release checks
  yet ([Not verified yet](docs/TROUBLESHOOTING.md#not-verified-yet)).
- **Yarn 1 (classic) and Bun:** neither has an approval setting for git dependencies, and the release runs no install
  script. Neither is part of the release checks yet ([Not verified yet](docs/TROUBLESHOOTING.md#not-verified-yet)).

Then run `npx cap sync`. It finds the plugin and adds it to both native projects: to the iOS project as a Swift package,
or as a pod in a CocoaPods app, and to the Android build. **A CocoaPods app adds the
[Podfile lines](#swift-package-manager-or-cocoapods) first:** until they're in, `npx cap sync ios` fails with "Unable to
find a specification for SallaPush".

The native SDKs come from their private repositories, as in native apps:

- **iOS with Swift Package Manager,** Capacitor 8's default: Xcode fetches `SallaApp/sallapush-ios-sdk` when it builds
  the app, and `npx cap sync` fetches nothing. Sign in to Xcode with a GitHub account that can read it (**Xcode →
  Settings → Accounts**).
- **iOS with CocoaPods:** the [Podfile lines](#swift-package-manager-or-cocoapods) fetch the SallaPush pods with your
  own git, over SSH, so `pod install` needs an SSH key that can read `SallaApp/sallapush-ios-sdk`.
- **Android:** the package's Gradle script adds SallaPush's GitHub Packages repository to every project of your
  build. Gradle reads the credentials from the Gradle properties `gpr.user` (your GitHub login) and `gpr.key` (the
  token), for example in `~/.gradle/gradle.properties`, outside every project, or from the environment variables
  `GITHUB_ACTOR` and `GITHUB_TOKEN`. Never commit them.

### CI machines

A machine that has only a token, not an SSH key, rewrites the SSH URLs of SallaApp's repositories to HTTPS with that
token. It covers this package and the iOS pods. Set the rewrites in the environment of the job that installs and
builds the app, where every git that npm, Yarn and CocoaPods start reads them (git 2.31 or later), never with
`git config --global`: on a machine that stays, such as a self-hosted runner, the token would stay in `~/.gitconfig`
for every later job, and after a rotation git would keep sending the first token written there.

```bash
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0="url.https://x-access-token:${TOKEN}@github.com/SallaApp/.insteadOf" GIT_CONFIG_VALUE_0="git@github.com:SallaApp/"
export GIT_CONFIG_KEY_1="url.https://x-access-token:${TOKEN}@github.com/SallaApp/.insteadOf" GIT_CONFIG_VALUE_1="ssh://git@github.com/SallaApp/"
```

`TOKEN` comes from the machine's secrets: a token that can read the contents of this repository and of
`SallaApp/sallapush-ios-sdk`. Gradle still needs `GITHUB_ACTOR` and `GITHUB_TOKEN`, with the classic token.

These rewrites never reach the Swift package, whose URL is `https://github.com/SallaApp/sallapush-ios-sdk.git`. A Swift
Package Manager app builds on CI with `xcodebuild … -scmProvider system`, so that Xcode uses the machine's git
(`npx cap build ios` doesn't pass it: call `xcodebuild` yourself), and with one of native's rewrites of that URL
([native private repository access](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/REFERENCE.md#private-repository-access)).
On a machine with an SSH key, to SSH:

```bash
git config --global url."git@github.com:SallaApp/sallapush-ios-sdk.git".insteadOf "https://github.com/SallaApp/sallapush-ios-sdk.git"
```

On a machine with a token that can read the repository's contents, with that token, as a third rewrite in the same
environment:

```bash
export GIT_CONFIG_COUNT=3
export GIT_CONFIG_KEY_2="url.https://x-access-token:${SALLAPUSH_SDK_TOKEN}@github.com/SallaApp/sallapush-ios-sdk.git.insteadOf" GIT_CONFIG_VALUE_2="https://github.com/SallaApp/sallapush-ios-sdk.git"
```

This isn't verified on CI yet ([Not verified yet](docs/TROUBLESHOOTING.md#not-verified-yet)). Until it is, use a CI Mac
whose Xcode is signed in to an account with access, or CocoaPods, whose pods come through the machine's git.

## iOS setup

### Capabilities

In the App target of `ios/App/App.xcodeproj`, under **Signing & Capabilities**, add:

- **Push Notifications.**
- **Background Modes → Remote notifications.** Capacitor's template doesn't have it.
- **App Groups,** optional: the same group on the app and the Notification Service Extension lets SallaPush report
  `received` for the notifications the extension handles.

### Info.plist

SallaPush starts natively at launch when the app's Info.plist, `ios/App/App/Info.plist`, names its app id. Set it from
a build setting, so each build configuration can have its own:

<!-- snippet:example-app/ios/App/App/Info.plist#app-id -->
```xml
<key>SallaPushAppId</key>
<string>$(SALLAPUSH_APP_ID)</string>
```

Define the build setting in an xcconfig file:

<!-- snippet:example-app/ios/App/Config/SallaPush.local.xcconfig.example#app-id -->
```xcconfig
// The SallaPush app id for iOS, from the SallaPush team.
SALLAPUSH_APP_ID = your_app_id
```

- **Make the xcconfig the project's base configuration** (the project's **Info** tab, **Configurations**, for Debug
  and Release), as the example does: the App target's own base configurations are Capacitor's or CocoaPods' files, and
  the target's settings build on the project's. Or add `SALLAPUSH_APP_ID` to the App target's **Build Settings** as a
  user-defined setting.
- **An undefined setting expands to an empty value,** which SallaPush reads as no app id: it then doesn't start at
  launch, and says nothing about it.
- The example keeps its value in `example-app/ios/App/Config/SallaPush.local.xcconfig`, which git ignores and the
  committed `SallaPush.xcconfig` includes.
- Every other key is optional, such as `SallaPushRequiresUserConsent` for [consent](#consent):
  [docs/REFERENCE.md](docs/REFERENCE.md#static-configuration) lists them all.
- **Not `capacitor.config`.** SallaPush reads no `plugins.SallaPush` section of `capacitor.config`: such a section is
  ignored, with one `[SallaPush]` error when the plugin loads. The Info.plist keys and the manifest meta-data can differ
  per build configuration and flavor, and SallaPush reads them in every process.

### AppDelegate

SallaPush starts in your `AppDelegate`, in `ios/App/App/AppDelegate.swift`, before Capacitor's bridge exists. Every app
adds the same three parts, whatever Capacitor version created it. The import, next to the others:

<!-- snippet:example-app/ios/App/App/AppDelegate.swift#imports -->
```swift
import SallaPushCapacitorPlugin
```

The start, as the first statement of `application(_:didFinishLaunchingWithOptions:)`:

<!-- snippet:example-app/ios/App/App/AppDelegate.swift#start -->
```swift
SallaPushCapacitor.start()
```

And the three forwarding methods, in the class:

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

**Capacitor's bridge makes its notification router the notification-center delegate after launch; SallaPush takes the
delegate back when its plugin loads and hands Capacitor's router every notification that isn't SallaPush's, so
Capacitor's push and local-notification plugins keep working. Don't set `UNUserNotificationCenter.current().delegate`
yourself below `start()`.**

- **`SallaPushCapacitor.start()` comes first** in `application(_:didFinishLaunchingWithOptions:)`: only a line that sets
  your own notification-center delegate goes above it. It starts SallaPush from the Info.plist keys, once per process,
  and makes SallaPush's notification-center delegate the current one. iOS hands the tap that launched the app to the
  delegate set during launch, so a later start loses it.
- **A delegate set before `start()`,** your app's own or another SDK's, keeps getting every notification and tap that
  isn't SallaPush's when `ios.handleApplicationNotifications` is `false`. With the default, `true`, Capacitor's router
  replaces it and gets them instead, as it would without SallaPush.
- **A delegate assigned after `start()` replaces SallaPush's.** SallaPush then gets no taps and no foreground
  notifications. The package checks 2 seconds after the app first becomes active, and logs an error that names the
  class of the delegate that replaced SallaPush's. If your delegate must be set later, forward to SallaPush from it with
  `SallaPush.Notifications.willPresent(_:)` and `didReceive(_:)`, as native apps do
  ([native quick start](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/REFERENCE.md#1-forward-from-your-app-delegate)).
- **Leave `ios.handleApplicationNotifications` in `capacitor.config` as your app has it.** By default it is `true`,
  and Capacitor's router gets the notifications that aren't SallaPush's. OneSignal's setup sets it to `false`
  ([Migrating from OneSignal](#migrating-from-onesignal)).
- **The three forwarding methods** hand SallaPush the APNs token, a registration failure and background
  notifications, as in a native app
  ([native quick start](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/REFERENCE.md#1-forward-from-your-app-delegate)).
  SallaPush never calls your completion handlers: call each one, once. If your `AppDelegate` already has one of these
  methods, for another push plugin, put SallaPush's line first in it ([Another push plugin](#another-push-plugin)).
- **`import SallaPushCapacitorPlugin` also brings SallaPush's own iOS API,** `SallaPush.Notifications` included: no
  second import.
- **Apps created with Capacitor 8.0 to 8.4** start from a storyboard and have no `SceneDelegate`. Add the same three
  parts to their `AppDelegate`, and keep its `ApplicationDelegateProxy` methods, which hand Capacitor the URLs that open
  the app.
- **The example's whole file,** Capacitor 8.5's UIScene template with these lines:
  [example-app/ios/App/App/AppDelegate.swift](example-app/ios/App/App/AppDelegate.swift).
- **Without `SallaPushCapacitor.start()`,** SallaPush starts when Capacitor loads its plugin, and logs an error that
  says the tap that launched the app can be missed.

An Objective-C app delegate imports both modules, calls `[SallaPushCapacitor start]` first, and forwards with
SallaPush's Objective-C forms
([native Objective-C section](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/REFERENCE.md#objective-c)):

<!-- unchecked: an Objective-C app delegate; no app of scripts/verify.sh has one, and the forwarding calls are the native SDK's own Objective-C forms -->
```objc
@import SallaPush;
@import SallaPushCapacitorPlugin;

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    [SallaPushCapacitor start];
    return YES;
}

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
    [SallaPush.Notifications didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
    [SallaPush.Notifications didFailToRegisterForRemoteNotificationsWithError:error];
}

- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo
    fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
    [SallaPush.Notifications didReceiveRemoteNotification:userInfo];
    completionHandler(UIBackgroundFetchResultNoData);
}
```

Don't copy the native section's `UNUserNotificationCenter.currentNotificationCenter.delegate = self` line below
`[SallaPushCapacitor start]`: it would replace SallaPush's delegate.

### Swift Package Manager or CocoaPods

Your app uses Swift Package Manager when `ios/App/CapApp-SPM` exists, as in apps that Capacitor 8 created with its
default. Then there is nothing to add: the plugin's Swift package brings SallaPush. **Never add the SallaPush pods to
such an app,** not even to a Podfile you keep for other SDKs: SallaPush would be linked twice, with duplicate classes
and two SDK instances.

With CocoaPods (an app created with `npx cap add ios --packagemanager cocoapods`), the SallaPush pods come from
SallaPush's private repository, so your Podfile names them. In `ios/App/Podfile`, inside `target 'App' do`, after
`capacitor_pods`:

<!-- snippet:docs/snippets/Podfile#podfile-app -->
```ruby
pod 'SallaPushCore', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '1.0.3'
pod 'SallaPush', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '1.0.3'
```

- **Add them before the first `npx cap sync` with the plugin.** The plugin's pod depends on SallaPush at this exact
  version, and `npx cap sync ios` runs `pod install`, which fails without these lines: "Unable to find a specification
  for SallaPush". If it did, add them and run `npx cap sync ios` again.
- **Add the iOS platform before the plugin** in an app that has none yet: `npx cap add ios --packagemanager cocoapods`
  syncs too, and fails the same way once the plugin is a dependency.
- **Declare `SallaPushCore` too:** SallaPush depends on it.
- `npx cap sync` rewrites only `def capacitor_pods`, so these lines stay.

### Notification Service Extension

Optional, and recommended: the extension shows the images of SallaPush notifications, and reports `received` for the
notifications it handles.

**1. Add the target.** Open `ios/App/App.xcodeproj`, or `ios/App/App.xcworkspace` in a CocoaPods app, and choose
**File → New → Target → Notification Service Extension**, in Swift, named `SallaPushNotificationService`, with a
deployment target of 15.0, or the app's when it is higher. If your app already has an extension, such as OneSignal's,
don't add a second one: call SallaPush first in it
([native coexistence](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/REFERENCE.md#notification-service-extension)).

Give the extension the app's **Version** and **Build**, on its **General** tab, and change them together with the
app's at every release: a new target starts at 1.0 (1), and App Store Connect warns about an extension whose version or
build differs from its app's.

**2. Give it SallaPush's extension library.**

- **Swift Package Manager:** choose **File → Add Package Dependencies…**, enter
  `https://github.com/SallaApp/sallapush-ios-sdk.git`, the rule **Exact Version** with the SallaPush iOS version of
  [Versions](#versions), and add the product **`SallaPushExtension`** to the `SallaPushNotificationService` target only.
  Keep that exact URL, the one the plugin's package uses, so Xcode resolves one SallaPush package for both. Never add it
  to `CapApp-SPM`, which `npx cap sync` writes again.
- **CocoaPods:** at the top level of the Podfile:

<!-- snippet:docs/snippets/Podfile#podfile-extension -->
```ruby
target 'SallaPushNotificationService' do
  pod 'SallaPushCore', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '1.0.3'
  pod 'SallaPushExtension', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '1.0.3'
end
```

At the top level, the target gets the template's `use_frameworks!`, and `npx cap sync` leaves it as it is. Never add
`SallaPush` to an extension, with either package manager.

**3. Replace its `NotificationService.swift`** with the example's:

<!-- snippet:example-app/ios/App/SallaPushNotificationService/NotificationService.swift -->
```swift
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
```

`didReceive` returns false for notifications that aren't SallaPush's, and never touches them.

**4. Optional: an App Group.** Add the App Groups capability, with the same group, to both targets, and this key to
both Info.plist files, with `SALLAPUSH_APP_GROUP` defined like `SALLAPUSH_APP_ID`:

<!-- snippet:example-app/ios/App/App/Info.plist#app-group -->
```xml
<key>SallaPushAppGroup</key>
<string>$(SALLAPUSH_APP_GROUP)</string>
```

`xcrun simctl push` never runs the extension: test images on a device.

### Another push plugin

With `@capacitor/push-notifications` or `@capacitor-firebase/messaging` in the app, that plugin's setup posts the
APNs token and a registration failure from your `AppDelegate`. Put those posts after SallaPush's lines, in methods that
replace the forwarding methods of the same names:

<!-- snippet:docs/snippets/CapacitorPushAppDelegate.swift#token-methods -->
```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    SallaPush.Notifications.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
}

func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    SallaPush.Notifications.didFailToRegisterForRemoteNotifications(error: error)
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
}
```

`@capacitor-firebase/messaging` also wants background notifications posted. Post only those that aren't SallaPush's,
so SallaPush's never reach its `notificationReceived` listeners:

<!-- snippet:docs/snippets/CapacitorPushAppDelegate.swift#firebase-remote-notification -->
```swift
func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                 fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // @capacitor-firebase/messaging reports every posted notification to its notificationReceived listeners.
    if !SallaPush.Notifications.didReceiveRemoteNotification(userInfo) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"),
                                        object: completionHandler, userInfo: userInfo)
    }
    completionHandler(.noData)
}
```

- **`didReceiveRemoteNotification(_:)` returns true for a SallaPush notification,** so the post skips SallaPush's.
  Neither SallaPush nor `@capacitor-firebase/messaging` calls the completion handler: the method calls it, once.
- **[docs/snippets/CapacitorPushAppDelegate.swift](docs/snippets/CapacitorPushAppDelegate.swift)** is a whole
  `AppDelegate` with these methods. With `@capacitor/push-notifications` only, nothing observes the background post,
  so the same file serves both plugins.
- **SallaPush's notifications never reach those plugins' listeners:** SallaPush's delegate handles them before
  Capacitor's router, and on Android the [forwarding service](#another-fcm-plugin) hands them to SallaPush first.
- **`@capacitor-firebase/messaging` 8.2 and later report the APNs token** in their `apnsTokenReceived` event.
  Forwarding it to SallaPush is optional: the `AppDelegate` line already hands SallaPush the token, and the same token
  forwarded twice costs nothing:

<!-- snippet:example-app/src/readmeSnippets/capacitorFirebase.ts#firebase-apns-token -->
```ts
FirebaseMessaging.addListener('apnsTokenReceived', ({ token }) =>
  SallaPush.Notifications.forwardApnsToken(token)
);
```

## Android setup

### Firebase

Put the `google-services.json` of the Firebase project that the SallaPush team set up for your app id in
`android/app`. Capacitor's template applies the Google services Gradle plugin whenever that file exists.

SallaPush uses the default Firebase app, which that file configures: with another project's file, no notification
arrives. Leave Firebase's auto-init on
([native Firebase setup](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/REFERENCE.md#set-up-firebase)).

### App id and notification icon

Inside `<application>` in `android/app/src/main/AndroidManifest.xml`:

<!-- snippet:example-app/android/app/src/main/AndroidManifest.xml#meta-data -->
```xml
<meta-data android:name="com.salla.push.APP_ID" android:value="${sallaPushAppId}" />
<meta-data
    android:name="com.salla.push.default_notification_icon"
    android:resource="@drawable/ic_stat_sallapush" />
```

`${sallaPushAppId}` is a manifest placeholder. Define it in `defaultConfig` in `android/app/build.gradle`:

<!-- snippet:docs/snippets/app-build.gradle#placeholders -->
```groovy
manifestPlaceholders += [sallaPushAppId: "your_app_id"]
```

- **`+=` keeps any other placeholder your build sets.** Set it per product flavor when each flavor has its own app id,
  or write the app id in the manifest in place of the placeholder. Without a definition, the manifest merger fails:
  "requires a placeholder substitution but no value for <sallaPushAppId> is provided".
- **With an app id, SallaPush starts whenever your app's process starts,** before `Application.onCreate`, also when
  FCM starts the process for a message. Without one, it starts when JavaScript calls `initialize`.
- **The icon** must be white on transparent. `@drawable/ic_stat_sallapush` is the example's; use your own. Without
  this key, SallaPush uses Firebase's `com.google.firebase.messaging.default_notification_icon` when it is set, else its
  own bell, and then logs `display.default_icon`.
- Every other key is optional, such as `com.salla.push.REQUIRES_USER_CONSENT` for [consent](#consent):
  [docs/REFERENCE.md](docs/REFERENCE.md#static-configuration) lists them all.

### Another FCM plugin

Android hands each FCM message to one service: the one with the highest priority in your merged manifest. SallaPush's
is at −450, so the service of another FCM plugin takes every message, and SallaPush shows nothing. Add a service that
hands each message to SallaPush first, then to that plugin, and declare it at priority 1:

| The app also has | What it adds |
|---|---|
| No other FCM plugin | Nothing: SallaPush's service gets every message |
| `@capacitor/push-notifications` | The service below, extending `com.capacitorjs.plugins.pushnotifications.MessagingService` |
| `@capacitor-firebase/messaging` | The same service, extending `io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService` instead |
| Intercom, Klaviyo, MoEngage, WebEngage or another FCM SDK | A service with SallaPush's line first, then the SDK's calls ([native guide](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/REFERENCE.md#coexistence-with-other-sdks)) |
| OneSignal (`@onesignal/capacitor-plugin`) | Nothing for FCM: OneSignal shows its own format's notifications ([Migrating from OneSignal](#migrating-from-onesignal)) |

For `@capacitor/push-notifications`, in `android/app/src/main/java/<your package path>/SallaPushMessagingService.java`:

<!-- snippet:docs/snippets/SallaPushMessagingService.java -->
```java
package com.example.app;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.salla.push.SallaPush;

/** Hands SallaPush its own messages and tokens first; everything else goes to @capacitor/push-notifications. */
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

Inside `<application>` in `android/app/src/main/AndroidManifest.xml`:

<!-- snippet:docs/snippets/AndroidManifest-forwarding.xml -->
```xml
<service android:name=".SallaPushMessagingService" android:exported="false">
    <intent-filter android:priority="1">
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

- **Where it goes.** Next to `MainActivity.java`. Replace `com.example.app` with your app's package, the `namespace`
  of `android/app/build.gradle`: the manifest's `.SallaPushMessagingService` resolves against it. Or write the full
  class name in `android:name`.
- **The SallaPush line comes first.** `handleFirebaseMessage` returns false at once for messages that aren't
  SallaPush's. For `@capacitor-firebase/messaging`, import and extend
  `io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService` instead.
- **Priority 1** outranks those plugins' services, at 0. Never rely on a tie.
- **`super.onNewToken`** keeps the plugin's own token events working.
- **SallaPush's messages never reach the plugin's listeners,** `pushNotificationReceived` or `notificationReceived`:
  neither plugin receives FCM any other way, so their listeners need no `isSallaPushNotification` check.
- **A service of your own already.** If your app already declares a `com.google.firebase.MESSAGING_EVENT` service, to
  forward to Intercom or Klaviyo for example, don't add a second one: put the SallaPush lines first in it, keep its
  forwarding, and give its intent filter `android:priority="1"`. Android Studio's Merged Manifest tab, or
  `apkanalyzer manifest print`, lists the services
  ([native FCM setup](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/REFERENCE.md#3-make-sure-fcm-reaches-sallapush)).
- **Don't call `unregister()` of `@capacitor/push-notifications` or `deleteToken()` of
  `@capacitor-firebase/messaging`.** On Android both delete the app's FCM token, which SallaPush uses too, and
  `unregister()` also turns FCM's auto-init off; on iOS, `unregister()` unregisters the app from APNs, for every SDK.

### Builds that refuse project repositories

The package adds SallaPush's GitHub Packages repository to every project of your build, under the name
`SallaPushGitHubPackages`, unless the project has one by that name. A build whose settings set `RepositoriesMode`
`PREFER_SETTINGS` ignores it: declare the repository in `android/settings.gradle` instead, under the same name. Gradle
then still warns that a build file added a repository; the warning is harmless. `FAIL_ON_PROJECT_REPOS` can't work in
a Capacitor app at all, since Capacitor's own Gradle files declare project repositories too.

<!-- unchecked: the native SDK's settings block, for builds that refuse project repositories; the example's build doesn't need it -->
```groovy
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        exclusiveContent {
            forRepository {
                maven {
                    url = uri("https://maven.pkg.github.com/SallaApp/sallapush-android-sdk")
                    name = "SallaPushGitHubPackages"
                    credentials {
                        username = providers.gradleProperty("gpr.user").orNull ?: System.getenv("GITHUB_ACTOR")
                        password = providers.gradleProperty("gpr.key").orNull ?: System.getenv("GITHUB_TOKEN")
                    }
                }
            }
            filter { includeGroup("com.salla.push") }
        }
    }
}
```

Keep the group exactly `com.salla.push`
([native repository setup](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/REFERENCE.md#1-add-the-repository)).

### JDK 21

Capacitor 8 compiles Android with Java 21, and so does the plugin: build with a JDK 21, through `JAVA_HOME` or Android
Studio's Gradle JDK setting. An older JDK fails with "invalid source release: 21".

## Quick start

The same code serves Angular, React, Vue and plain TypeScript apps.

### Consent first

If your app must ask for consent before any data processing (PDPL):

- **With a static app id** (`SallaPushAppId` or `com.salla.push.APP_ID`), require it in the static configuration:
  `SallaPushRequiresUserConsent` set to `YES` in the Info.plist, and `com.salla.push.REQUIRES_USER_CONSENT` set to
  `true` in the manifest. SallaPush starts natively before JavaScript runs, so a `setConsentRequired(true)` from
  JavaScript comes too late.
- **When your app calls `SallaPush.initialize`,** call `SallaPush.setConsentRequired(true)` before it, at every launch.
  This package reads the consent key only together with the static app id, so the key alone requires nothing then.

Then call `setConsentGiven(true)` once the user agrees ([Consent](#consent)).

### At app start

In your app's entry module, before your framework renders the first screen (Angular's `src/main.ts`, React's
`src/main.tsx`, Vue's `src/main.ts`), add the click listener and make the launch identity call. This is the example's
start-up code, which its `src/main.ts` runs before it renders:

<!-- snippet:example-app/src/start.ts#click-listener -->
```ts
SallaPush.Notifications.addEventListener('click', (event) => {
  route(event.notification);
});
```

<!-- snippet:example-app/src/start.ts#launch-identity -->
```ts
const customer = currentCustomer();
if (customer) {
  SallaPush.login(customer.externalId, customer.identityToken);
} else {
  SallaPush.logout();
}
```

- **Add the click listener at app start.** Taps made before the first click listener, such as the tap that launched
  the app, wait natively. They arrive a moment after the first click listener is added, once, at every click listener
  added by then. A listener added later, in a screen, misses them.
- **On a cold start, the tap can arrive before your navigation is ready:** before your router has started, or while a
  splash or sign-in screen shows. Keep the destination, and open it once your navigation is ready.
- **At every launch, call exactly one of `login` or `logout`:** `login` while a customer is signed in, with their id
  and their Salla token, and `logout` while nobody is. SallaPush keeps the token in memory only, and needs it to link
  the device again whenever the device has to register again. Make this call before any tag call.
- `currentCustomer()` stands for your app's session, and `route` for its navigation
  ([Routing with the typed getters](#routing-with-the-typed-getters)).

**Processes without JavaScript don't make the launch identity call.** An Android process that FCM or WorkManager
starts runs no JavaScript. SallaPush runs there, but has no identity token: if the device has to register again in
such a process, it stays unlinked until the next launch that calls `login` (`identity.token_needed`). When native code
can read your app's session, make the same call natively too, as native apps do. A second `login` for the linked
customer sends nothing. On Android, in the `onCreate` of your `Application` class, after `super.onCreate()` (Capacitor's
template has none: add a class that extends `android.app.Application`, and name it in `<application android:name>`):

<!-- unchecked: native code over your app's session, which CustomerSession stands for; the SallaPush calls are the native SDK's own -->
```java
String customerId = CustomerSession.customerId(this);
String token = CustomerSession.identityToken(this);
if (customerId != null && token != null) {
    SallaPush.login(customerId, token);
} else {
    SallaPush.logout();
}
```

On iOS, right after `SallaPushCapacitor.start()`:

<!-- unchecked: native code over your app's session, which currentCustomer() stands for; the SallaPush calls are the native SDK's own, as in its quick start -->
```swift
if let customer = currentCustomer() {
    SallaPush.login(externalId: customer.id, identityToken: customer.token)
} else {
    SallaPush.logout()
}
```

### Sign-in and sign-out

Call `login` when the customer signs in, and `logout` when they sign out. The example's session:

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

- **Pass the customer's id and their Salla token,** a customer's JWT or a merchant app's PASETO token, without a
  `Bearer ` prefix. Salla checks the token, and the device is linked only when the token belongs to that id.
- **Call `login` again when your app refreshes the token.** A `login` for the customer the device is linked to sends
  nothing.
- **`logout()` needs no token and works offline.** The device stays registered as a guest. Call it at every sign-out,
  the forced ones too, and before the next customer's `login`.

Watch for login failures:

<!-- snippet:example-app/src/readmeSnippets/user.ts#login-failures -->
```ts
SallaPush.User.addEventListener('loginFailure', (failure) => {
  // tokenRejected: log in again once the app has a current token, never from here.
  // invalidRequest: push-service refused the request as invalid; tell the SallaPush team.
  telemetry.report('sallapush', `login_${failure}`, 'Login refused', {});
});
```

Don't call `login` again from this listener: when push-service couldn't check the token, an immediate retry only
repeats the refusal
([native login failures](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/BEHAVIOUR.md#login-failures)).

### Notification permission

SallaPush never shows the system prompt on its own. Ask where it fits your app:

<!-- snippet:example-app/src/readmeSnippets/notifications.ts#request-permission -->
```ts
const granted = await SallaPush.Notifications.requestPermission(true);
```

`true` opens the app's notification settings when the system no longer shows the prompt. The device registers before
any permission, and the server knows whether notifications are allowed. To let customers turn SallaPush notifications
off and on in your app:

<!-- snippet:example-app/src/readmeSnippets/user.ts#opt-out -->
```ts
if (isOn) {
  SallaPush.User.pushSubscription.optIn();
} else {
  SallaPush.User.pushSubscription.optOut();
}
```

`optIn()` also shows the prompt while it can still show (on iOS, when the app never asked), as in OneSignal v5.

### Tags and language

Tags are string keys and values stored on the server for this device:

<!-- snippet:example-app/src/readmeSnippets/user.ts#tags -->
```ts
SallaPush.User.addTag('add_to_cart', String(Math.floor(Date.now() / 1000)));
SallaPush.User.addTags({
  total_cart_amount: String(total),
  cart_items: String(items),
});
```

<!-- snippet:example-app/src/readmeSnippets/user.ts#remove-tags -->
```ts
SallaPush.User.removeTags(['total_cart_amount', 'cart_items']);
```

- **Keys** are trimmed and lowercased, then must be 1 to 64 characters of `a-z`, `0-9` and `_`. **Values** are cut at
  255 characters, and an empty value removes the tag. A device holds at most 100 tags.
- **Set tags after the launch `login` or `logout` call,** so they belong to the right customer. By default
  (`clearTagsOnLogout`), a logout and an account switch delete the device's tags.
- **`getTags()`** has your latest changes at once, but right after a cold start, not yet the tags of earlier launches:
  don't use it at launch to decide whether to set a tag.

Pass your app's language, such as `ar`, whenever it changes; `null` means the device language:

<!-- snippet:example-app/src/readmeSnippets/user.ts#language -->
```ts
SallaPush.User.setLanguage(code);
```

### On the web

SallaPush runs on iOS and Android only. In a browser, during web development or in a progressive web app, its
requests reject with Capacitor's `UNIMPLEMENTED` error, and its other calls print one console error per method and
page, such as `[SallaPush] SallaPush.login failed: "SallaPush" plugin is not implemented on web`. Nothing is faked
there. Code that also runs on the web checks the platform first:

<!-- snippet:example-app/src/readmeSnippets/platform.ts#native-only -->
```ts
if (Capacitor.isNativePlatform()) {
  settingsScreen.showPermission(
    await SallaPush.Notifications.getPermission()
  );
} else {
  settingsScreen.hidePushSettings();
}
```

`Capacitor.isPluginAvailable('SallaPush')` tells the same apart, and is also false in a native build made without
`npx cap sync`.

## API overview

Every member is described in [docs/REFERENCE.md](docs/REFERENCE.md#api-reference). Getters and requests return a
`Promise`, and every other call returns at once. (iOS) and (Android) mark the members that work on one platform only;
on the other they resolve a neutral value or do nothing. On the web, requests reject, and the other calls print one
console error each ([On the web](#on-the-web)).

| Member | What it does |
|---|---|
| `SallaPush.initialize(appId, config?)` | Starts SallaPush when the app id is known only at run time |
| `SallaPush.isInitialized()`, `getAppId()`, `getSdkVersion()` | Whether SallaPush started, with which app id, and the native SDK's version |
| `SallaPush.setConsentRequired(required)`, `setConsentGiven(given)` | Consent before any data processing |
| `SallaPush.login(externalId, identityToken)`, `logout()` | Links the signed-in customer, or unlinks the device |
| `SallaPush.User.getExternalId()`, `isLoggedIn()` | The current login |
| `SallaPush.User.addTag(key, value)`, `addTags(tags)`, `removeTag(key)`, `removeTags(keys)`, `getTags()` | The device's tags |
| `SallaPush.User.setLanguage(language)` | The customer's language |
| `SallaPush.User.addEventListener('change', listener)` | Login changes |
| `SallaPush.User.addEventListener('loginFailure', listener)` | Refusals of the current login |
| `SallaPush.User.pushSubscription.getId()`, `getToken()`, `getOptedIn()` | The device id, the push token and the opted-in state |
| `SallaPush.User.pushSubscription.optIn()`, `optOut()` | Turns SallaPush notifications on and off on this device |
| `SallaPush.User.pushSubscription.addEventListener('change', listener)` | Subscription changes, with a replay for each listener |
| `SallaPush.Notifications.getPermission()`, `canRequestPermission()`, `getPermissionStatus()` (iOS) | The notification permission |
| `SallaPush.Notifications.requestPermission(fallbackToSettings?)`, `registerForProvisionalAuthorization()` (iOS) | Asks for the permission |
| `SallaPush.Notifications.refreshPermission()` | Reads the permission again after your app asked itself |
| `SallaPush.Notifications.registerForRemoteNotifications()` (iOS), `forwardApnsToken(apnsToken)` (iOS) | The APNs token, for apps that handle it themselves |
| `SallaPush.Notifications.clearAll()`, `removeNotification(androidNotificationId)` (Android) | Removes delivered SallaPush notifications |
| `SallaPush.Notifications.isSallaPushNotification(payload)` | Whether a payload another SDK received is SallaPush's |
| `SallaPush.Notifications.trackOpened(additionalData)` (Android) | Records a tap on a notification OneSignal showed |
| `SallaPush.Notifications.addEventListener('click', listener)` | Taps, the one that launched the app included |
| `SallaPush.Notifications.addEventListener('foregroundWillDisplay', listener)` | Decides about each foreground notification |
| `SallaPush.Notifications.addEventListener('permissionChange', listener)` | Permission changes |
| `SallaPush.Debug.getLogLevel()`, `setLogLevel(level)` | The console log level |
| `SallaPush.Debug.setLogHandler(level, handler)` | Forwards log entries to your telemetry |
| `SallaPush.Migration.setDisplayOneSignalCompatPayloads(display)` (Android) | Leaves OneSignal-format notifications to OneSignal |
| `removeEventListener(event, listener)`, `subscription.remove()` | Removes a listener |
| `SallaPushNotification` | A notification: its fields, `getString`, `getInt`, `getBool`, `getNumber` (iOS) and `display()` |

## Events

Listeners are added with `addEventListener`, which returns a subscription at once. `subscription.remove()` and
`removeEventListener(event, listener)` both remove it, and the same function added twice is added once. Listeners run
in the page's JavaScript, in the order they were added. A listener that throws is reported with `console.error` and
doesn't stop the others.

A page load, such as a reload, a navigation or a live update, removes the old page's listeners, as Capacitor removes
every plugin's listeners then: SallaPush stops every native registration of that page. The new page adds its own, as
its start-up code runs again.

### Taps

- **The click listener gets every tap** on a SallaPush notification: `event.notification`, `event.result.url`, its
  launch URL, and on iOS `event.result.actionId`, the action button tapped.
- **Cold starts.** A tap made before the first click listener exists waits natively: up to 10 taps for 5 minutes,
  and on Android across a process restart. The waiting taps arrive a moment after the first click listener is added,
  once, at every click listener added by then. So add the click listener at app start ([At app start](#at-app-start)).
- **After the last click listener is removed,** and after every page load, taps wait natively again, until the next
  first click listener.
- **If your app reloads its page at launch,** for example to apply a live update, add the click listener in the page
  that stays: SallaPush hands the taps it kept to the first listener, and a page that reloads right after takes them
  with it.
- **Launch URLs.** SallaPush opens a notification's https launch URL itself only with the open-launch-URLs option
  (`SallaPushOpenLaunchURLs`, `com.salla.push.OPEN_LAUNCH_URLS`, or `openLaunchUrls` in `SallaPush.initialize`'s
  config); otherwise route it yourself. With the option on, your click listener still gets the tap, with
  `result.url`: don't open that URL again. A launch URL is whatever the sender set, of any scheme: check its scheme and
  host before you open it. A `javascript:` URL assigned to `window.location` runs in your app's page, with access to
  every plugin.

### Routing with the typed getters

Route with the typed getters, never with raw payload keys:

<!-- snippet:example-app/src/start.ts#route -->
```ts
function route(notification: SallaPushNotification): void {
  switch (notification.getString('type')) {
    case 'product': {
      const id = notification.getInt('id');
      if (id !== null) {
        router.showProduct(id);
      }
      break;
    }
    case 'order': {
      const id = notification.getString('id');
      if (id !== null) {
        router.showOrder(id);
      }
      break;
    }
    default:
      // With openLaunchUrls on, SallaPush opened it already: skip this.
      if (notification.launchUrl !== null) {
        router.open(notification.launchUrl);
      }
  }
}
```

SallaPush sends two payload formats: the native one carries every data value as a string (`"id": "42"`), and the
OneSignal-compatible one, which store apps receive today, keeps JSON types (`"id": 42`). `getString`, `getInt` and
`getBool`, and `getNumber` on iOS, read both: they return native's own conversion of a top-level `additionalData`
value, or `null`. The keys are your own data, chosen by whoever sends the notification, and so is the launch URL
that `router.open` gets here: check it first ([Taps](#taps)).

### Foreground notifications

Without a `foregroundWillDisplay` listener, SallaPush shows its notifications in the foreground itself. A listener can
hold each one back, such as on a chat screen:

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

- **While a listener exists, SallaPush holds every foreground notification** and hands it to JavaScript. Once the
  listeners have returned, the notification is shown, unless one called `event.preventDefault()`. Call it before any
  `await`: a later call changes nothing.
- **`event.notification.display()`** shows a prevented notification, then or later, once, within 10 minutes. Before
  `event.preventDefault()` it does nothing, as natively: a later listener may still prevent the notification.
- **On iOS, a notification shown this way is SallaPush's local copy, which loses:**
  - the image;
  - its category, so the action buttons, their `actionId` and the dismiss event;
  - the interruption level, such as time-sensitive;
  - the relevance score;
  - the collapse identifier: a later push with the same collapse id doesn't replace it.

  Android shows the real notification, picture included.
- **So add a listener only where your app decides per notification,** such as a chat screen, and remove it when the
  screen goes, as above. Without one, iOS shows the original notification, with all of it.
- **While the user is opted out,** SallaPush notifications aren't shown, and the listeners don't run.

### Subscription changes

<!-- snippet:example-app/src/readmeSnippets/user.ts#subscription-listener -->
```ts
const subscription = SallaPush.User.pushSubscription.addEventListener(
  'change',
  ({ current }) => {
    settingsScreen.showDevice(current.id, current.optedIn);
  }
);
```

- **Each listener gets the current state once,** with `previous` equal to `current`, as soon as the device is
  registered, whenever the listener is added. Then it gets every change of the device id, the push token and the
  opted-in state.
- **Read the subscription here, not from the getters at launch.** Right after a cold start, the getters show only this
  launch's calls until SallaPush has loaded its saved state
  ([native state at launch](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/BEHAVIOUR.md#state-at-launch)).
- **The push token is private.** Don't send it to analytics or third parties.

### User and permission changes

`SallaPush.User`'s `'change'` event reports login changes, once SallaPush handled a `login` or `logout`, and
`'loginFailure'` each refusal of the current login ([Sign-in and sign-out](#sign-in-and-sign-out)). The
`'permissionChange'` event of `SallaPush.Notifications` reports changes between allowed and not allowed. Neither
replays the current state.

## Consent

For apps that must ask for consent before any data processing (PDPL):

- **With a static app id,** require consent in the static configuration: `SallaPushRequiresUserConsent` or
  `com.salla.push.REQUIRES_USER_CONSENT`. SallaPush starts natively before JavaScript runs.
- **When JavaScript initializes SallaPush,** require consent before `initialize`, at every launch:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#consent-required -->
```ts
SallaPush.setConsentRequired(true);
SallaPush.initialize(appId);
```

Then record the user's choice whenever they make it:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#consent-given -->
```ts
export function privacyChoiceChanged(allowsNotifications: boolean): void {
  SallaPush.setConsentGiven(allowsNotifications);
}
```

- **While consent is required and not given,** SallaPush sends nothing and saves nothing but the answer. Your calls
  wait, and run once consent is given.
- **`setConsentGiven(true)` is saved** for the app. `setConsentGiven(false)`, while consent is required, withdraws
  consent that was given: SallaPush opts the device out, deletes its tags and unlinks it on the server, then goes
  idle.
- **`setConsentRequired(true)` isn't saved:** require consent at every launch.
- **A late `setConsentRequired(true)`,** after SallaPush started from the static app id without the consent key, comes
  after the device may already have registered. SallaPush still applies it, and logs this error:
  `[SallaPush] setConsentRequired(true) came after SallaPush started from SallaPushAppId without
  SallaPushRequiresUserConsent, …` (on Android, `com.salla.push.APP_ID` and `com.salla.push.REQUIRES_USER_CONSENT`).

The full rules are native's
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/BEHAVIOUR.md#consent),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/BEHAVIOUR.md#consent)).

## Logging

The default level is `warn`. Turn on more detail while you integrate:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#log-level -->
```ts
SallaPush.Debug.setLogLevel(SallaPushLogLevel.Verbose);
```

You can also set the level in the static configuration (`SallaPushLogLevel`, `com.salla.push.LOG_LEVEL`). To forward
entries to your own telemetry:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#log-handler -->
```ts
SallaPush.Debug.setLogHandler(SallaPushLogLevel.Error, (entry) => {
  telemetry.report('sallapush', entry.code, entry.message, entry.metadata);
});
```

- **Levels,** from the quietest: `off`, `error`, `warn`, `info`, `debug` and `verbose`.
- **The consoles.** SallaPush logs to the unified log on iOS, subsystem `com.salla.push` (filter on `SallaPush` in
  Xcode or Console), and to Logcat on Android, tag `SallaPush`.
- **The handler** gets the entries at its own level or more severe, whatever the console level. There is one handler
  for the app: a new one replaces the previous one, and `null` removes it. The first handler of the process also gets
  up to 100 earlier warnings and errors. On iOS it replaces a handler set from native code.
- **Every entry has a stable `code`,** such as `register.ok`. Match on it, not on the message. Secrets and identity
  tokens are never logged. On iOS, the info entries `status.launch` and `status.changed` hold the full push token and
  the customer's id: don't forward info entries to third parties. A handler at `warn` or quieter never receives them,
  and every other entry shows at most the push token's last 6 characters and no customer identifier. The native docs
  list every code
  ([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/LOGGING.md#log-code-reference),
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/LOGGING.md#log-code-reference)).
- **Ship with the console level at `warn`,** the default. At `info` or more, set by the static key, `initialize`'s
  `logLevel` or `SallaPush.Debug.setLogLevel`, iOS also writes `status.launch` and `status.changed` to the device log,
  in release builds too.
- **Capacitor's own logging.** In debug builds Capacitor logs every plugin call with its options, and on iOS the start
  of every result and event it sends to JavaScript, so `login`'s identity token, push tokens and handler entries reach
  the device log there. Never set Capacitor's `loggingBehavior` to `'production'`, which logs the same in release
  builds.
- **The package's own lines** start with `[SallaPush]`: on iOS in the unified log, subsystem `com.salla.push` and
  category `wrapper`; on Android in Logcat, tag `SallaPush`; in JavaScript, warnings about mistyped arguments, once
  per method and argument, and errors for calls that can't reach the plugin, such as on the web. Setup problems are
  errors, and calls that work on the other platform only are noted once per process.

## Initializing from JavaScript

An app that knows its app id only at run time starts SallaPush from JavaScript:

<!-- snippet:example-app/src/readmeSnippets/configuration.ts#initialize -->
```ts
SallaPush.initialize(appId, {
  ios: { appGroupIdentifier: 'group.com.example.shop' },
});
```

It costs native behaviour wherever no JavaScript runs yet:

- **Android processes that FCM starts** for a message don't initialize SallaPush. It still shows SallaPush's
  notifications there, but without honouring the user's opt-out, and their events stay in memory, so they are lost
  when the process ends.
- **A tap that starts the app,** on both platforms, reaches SallaPush before JavaScript initializes it: the launch URL
  isn't opened, and on Android the tap isn't kept across a process restart.

So prefer the static app id. With it, a JavaScript `initialize` with the same app id and no `apiBaseUrl` changes
nothing, its options included, and logs an error that names the ignored options and the static keys to use instead:
`[SallaPush] initialize ignored <options>: SallaPush already started with this app id from SallaPushAppId, so the call
changes nothing. Set them with the Info.plist keys <keys> instead.` (on Android, `com.salla.push.APP_ID` and the
meta-data). Another app id switches to it.

## Coexistence

SallaPush handles its own notifications only, and hands every other one on, so the other push plugins of your app keep
working:

| Plugin | iOS | Android |
|---|---|---|
| `@capacitor/push-notifications` | Its listeners get every push that isn't SallaPush's, shown with its `presentationOptions`; SallaPush's never reach them. Keep its posts after SallaPush's lines ([Another push plugin](#another-push-plugin)). | The [forwarding service](#another-fcm-plugin) hands SallaPush its messages first, the plugin every other one. |
| `@capacitor/local-notifications` | Its notifications and their taps reach it as before; SallaPush's foreground copies don't. | Nothing changes. |
| `@capacitor-firebase/messaging` | As `@capacitor/push-notifications`, and its background post only for notifications that aren't SallaPush's ([Another push plugin](#another-push-plugin)). | The forwarding service, extending its `MessagingService`. |
| OneSignal (`@onesignal/capacitor-plugin`) | Keep `ios.handleApplicationNotifications` `false`, as OneSignal's setup asks; route each notification once ([Migrating from OneSignal](#migrating-from-onesignal)). | Nothing for FCM: OneSignal shows its own format's notifications, and its click listener reports them with `trackOpened`. |
| Intercom, Klaviyo, MoEngage, WebEngage | Their own forwarding stays: their notifications are never SallaPush's. | A forwarding service with SallaPush's line first ([Another FCM plugin](#another-fcm-plugin)). |

- **`removeAllDeliveredNotifications()`** of `@capacitor/push-notifications`, `@capacitor/local-notifications` and
  `@capacitor-firebase/messaging` removes SallaPush's notifications too, on both platforms: use
  `SallaPush.Notifications.clearAll()` for SallaPush's, and the other plugins' `removeDeliveredNotifications(…)` for
  theirs.
- **On iOS 15, SallaPush's `autoClearBadge`,** on by default, clears the badge when the app becomes active, which can
  also remove the app's delivered notifications, the other plugins' included. To keep them, set
  `SallaPushAutoClearBadge` to `NO`, or `ios.autoClearBadge` to `false` in `initialize`'s config.
- **Their `unregister()` and `deleteToken()` reach SallaPush too:** on Android they delete the app's FCM token, and on
  iOS `unregister()` unregisters the app from APNs ([Another FCM plugin](#another-fcm-plugin)). Avoid them.
- **Another notification-center delegate on iOS:** set it before `SallaPushCapacitor.start()`, or forward from it to
  SallaPush ([AppDelegate](#appdelegate)).

[docs/REFERENCE.md](docs/REFERENCE.md#coexistence-with-other-sdks) has the details.

## Migrating from OneSignal

**Keep the OneSignal SDK in your app until the SallaPush team confirms you can remove it.** Add SallaPush next to it,
and keep OneSignal initialized
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/REFERENCE.md#onesignal),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/REFERENCE.md#onesignal-5)). Keep
`ios.handleApplicationNotifications` set to `false` in `capacitor.config`, as OneSignal's Capacitor setup asks.

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

While both SDKs are in the app:

**Route each notification once.** On iOS, both SDKs see each tap on a OneSignal-compatible SallaPush notification, so
OneSignal's click listener returns early for SallaPush's. On Android, OneSignal shows those notifications itself, and
SallaPush never sees them or their taps, so OneSignal's click listener records the tap with `trackOpened` and keeps
routing it. Add these lines to the click listener your app already has, so that each tap is handled once, in one
place.

<!-- snippet:example-app/src/readmeSnippets/oneSignal.ts#onesignal-click -->
```ts
OneSignal.Notifications.addEventListener(
  'click',
  async ({ notification }: NotificationClickEvent) => {
    if (Capacitor.getPlatform() === 'android') {
      // SallaPush never sees the taps on notifications OneSignal shows: record them, keep routing them.
      await SallaPush.Notifications.trackOpened({
        ...notification.additionalData,
      });
    } else if (
      await SallaPush.Notifications.isSallaPushNotification({
        ...notification.rawPayload,
      })
    ) {
      return; // iOS: SallaPush's click listener routes it.
    }
    routeOneSignal(notification);
  }
);
```

**Decide foreground notifications with one synchronous policy.** OneSignal applies its decision as soon as its
listeners return, too early to wait for `isSallaPushNotification`. On Android, give SallaPush's listener the same
policy:

<!-- snippet:example-app/src/readmeSnippets/oneSignal.ts#onesignal-foreground -->
```ts
// One synchronous policy for both SDKs. SallaPush's listener is Android only: on iOS it would make each compatible
// notification SallaPush's local copy.
const foregroundPolicy = (event: { preventDefault(): void }) => {
  if (chat.isOpen()) {
    event.preventDefault();
  }
};
OneSignal.Notifications.addEventListener(
  'foregroundWillDisplay',
  foregroundPolicy
);
if (Capacitor.getPlatform() === 'android') {
  SallaPush.Notifications.addEventListener(
    'foregroundWillDisplay',
    foregroundPolicy
  );
}
```

On iOS, both SDKs answer for the same compatible notification, and a SallaPush listener makes it SallaPush's local
copy ([Foreground notifications](#foreground-notifications)). So until a device test shows a single banner, add no
SallaPush `foregroundWillDisplay` listener on iOS while OneSignal is in the app, as above.

**Opt in and out on both SDKs, and ask for the permission once.** Salla's backend reaches the device through both, so
an opt-out in one SDK alone leaves the other's notifications coming. Each SDK's `optIn()` asks for the permission while
it is missing, and on Android 13 a second request shows the prompt again after a denial:

<!-- snippet:example-app/src/readmeSnippets/oneSignal.ts#onesignal-opt-in -->
```ts
if (isOn) {
  // Each SDK's optIn() asks for the permission while it is missing: ask once, then opt both in.
  if (await SallaPush.Notifications.requestPermission(true)) {
    OneSignal.User.pushSubscription.optIn();
    SallaPush.User.pushSubscription.optIn();
  }
} else {
  OneSignal.User.pushSubscription.optOut();
  SallaPush.User.pushSubscription.optOut();
}
```

- **iOS:** keep `OneSignal_suppress_launch_urls` set to `YES` in the Info.plist. In the Notification Service
  Extension, call SallaPush first and OneSignal last.
- **Android:** only if a device shows two copies of a notification, leave OneSignal-format notifications to
  OneSignal with `com.salla.push.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS` set to `false`.
  `SallaPush.Migration.setDisplayOneSignalCompatPayloads(false)` does the same, for the current process only.

## Verify your integration

Before you ship, check on a device, with a real app id:

1. **Turn on verbose logs** in the static configuration (`SallaPushLogLevel`, `com.salla.push.LOG_LEVEL`), so the
   entries of the launch show too, and watch the [consoles](#logging).
2. **Launch the app.** On iOS, 2 seconds after the app first becomes active, the package logs at info level:
   `[SallaPush] SallaPush's notification-center delegate is the current one; it hands other notifications to
   Capacitor's notification router.` (subsystem `com.salla.push`, category `wrapper`; in Console.app, with info
   messages shown). This line, with no `[SallaPush]` error before it, shows that `SallaPushCapacitor.start()` ran
   before Capacitor's bridge and that the plugin took the delegate back. Otherwise an error names the problem
   ([Capacitor setup](docs/TROUBLESHOOTING.md#capacitor-setup)).
3. **Watch the registration.** `init.started` names the app id and the API URL, and `register.ok` follows once the
   device is registered. `SallaPush.User.pushSubscription.getId()` then resolves the device id, which the SallaPush
   team can look up. Check this in a build of every configuration you ship, Release included: SallaPush doesn't start
   in a build without the app id, and nothing logs it ([Identity](docs/TROUBLESHOOTING.md#identity)).
4. **Have the SallaPush team send a notification** to that device, with the app in the foreground, then in the
   background, and tap it: the click listener gets the tap.
5. **Sign in:** no `'loginFailure'` event follows.

The native guides list the codes to expect at each launch
([iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/docs/RELEASING.md#verify-your-integration),
[Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/docs/RELEASING.md#verify-your-integration)).
Set the default level back before release.

## Troubleshooting

| Problem | Fix |
|---|---|
| `"SallaPush" plugin is not implemented on ios` (or `android`) | Run `npx cap sync` after installing the package, then rebuild the app. |
| `npx cap sync ios` or `pod install`: "Unable to find a specification for SallaPush" | A CocoaPods app: add the [Podfile lines](#swift-package-manager-or-cocoapods), then run `npx cap sync ios` again. It needs SSH access to `SallaApp/sallapush-ios-sdk`. |
| Xcode can't resolve `sallapush-ios-sdk` | Sign in to Xcode with an account that can read `SallaApp/sallapush-ios-sdk`; on CI, see [CI machines](#ci-machines). |
| Gradle: `Could not find com.salla.push:sallapush`, 401, or `Username must not be null!` | Give Gradle a classic token with `read:packages` in `gpr.user` and `gpr.key` ([Install](#install)). |
| No notification on Android, or `token.firebase_missing` | Add the right project's `google-services.json`, and with another FCM plugin, the [forwarding service](#another-fcm-plugin). |
| The tap that launched the app never reaches the click listener | Call `SallaPushCapacitor.start()` first in `didFinishLaunchingWithOptions`, and add the click listener in your entry module ([At app start](#at-app-start)). |

[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) has the full list.

## Updating the native SDKs

`scripts/bump-native.sh <version>` moves the package to new native SallaPush releases. It fetches their API files, sets
every pin (the podspec, `Package.swift`, the example's extension package, the Podfile lines, the Android dependency,
the docs), adds the CHANGELOG line and runs the API parity check, which names each new native API that needs a
decision. CI checks on every pull request that the pins agree, that every native API is wrapped or listed as not
wrapped, that TypeScript, Swift and Kotlin declare the same plugin methods and events, and that the README's code
equals the example's. [RELEASING.md](RELEASING.md#updating-the-native-sdks) has the whole flow.

## More documentation

- [docs/REFERENCE.md](docs/REFERENCE.md): how the package works, the static configuration, the full API, events,
  foreground display, errors, data mapping, coexistence, logging and compatibility.
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): every known problem and its fix.
- [example-app/README.md](example-app/README.md): the example app, test pushes without a server, and its self-test.
- [CONTRIBUTING.md](CONTRIBUTING.md): working on this package, its checks and its pull requests.
- [RELEASING.md](RELEASING.md): versions, releases, native updates and the checks on devices.
- The native SDKs' docs: [iOS](https://github.com/SallaApp/sallapush-ios-sdk/blob/1.0.3/README.md) and
  [Android](https://github.com/SallaApp/sallapush-android-sdk/blob/1.0.3/README.md).

## License

Copyright Salla. All rights reserved. See [LICENSE](LICENSE).
