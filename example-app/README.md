# SallaPush example

A Capacitor 8.5 app (Vite and TypeScript, no UI framework) that runs `@salla.sa/sallapush-capacitor` from this
repository's sources. It shows SallaPush's state on the device, makes every API call, decides about foreground
notifications, and logs every event. It also hosts the plugin's iOS unit tests, the `AppTests` target.

## What it shows

- **Status:** whether SallaPush started, and with which app id; the device id, whether it is opted in, and the last 6
  characters of the push token, which is private; the permission, with iOS's status; the customer; the tags; the
  console log level. The status is read again after every event and with Refresh. Without an app id, a "Not
  configured" banner says so.
- **Actions:** log in with an external id and an identity token, and log out; add and remove a tag; set the language;
  opt in and out; request the permission, optionally opening the settings after a denial; ask for provisional
  authorization and register for remote notifications (iOS); refresh the permission; clear the delivered notifications,
  or remove one by its id (Android); the consent switches; the log level; showing OneSignal-format payloads (Android).
  Each call is written to the event log.
- **Foreground notifications:**
  - Off: no listener, so SallaPush shows the original itself.
  - Show: a listener that doesn't prevent. On iOS the notification is then shown as SallaPush's local copy, without the
    image, action buttons or interruption level.
  - Hold: a listener that prevents, and a Display button for each notification it held (within 10 minutes).
- **Event log:** taps, with their URL and action id, and where they route; foreground decisions; permission, customer
  and subscription changes; login failures; SallaPush's log entries at the chosen level.

The code of the README and of the [reference](../docs/REFERENCE.md) comes from here:

- `src/main.ts` adds the click listener of `src/start.ts` before it renders.
- `ios/App/App/AppDelegate.swift` has the lines every iOS app adds; `ios/App/App/Info.plist` and
  `android/app/src/main/AndroidManifest.xml` hold the static configuration; `ios/App/SallaPushNotificationService/` is
  the Notification Service Extension.
- `src/readmeSnippets/` holds their other snippets, which `yarn typecheck` compiles and which never run.

## Configure it

SallaPush starts natively at launch, from the app id in the app's static configuration. Contact the Salla team for
your app id. You need one for each platform: the Salla team sets them up with your iOS bundle id and APNs key, and your
Android application id and a Firebase project. Every file below is ignored by git.

### iOS

Copy `ios/App/Config/SallaPush.local.xcconfig.example` to `ios/App/Config/SallaPush.local.xcconfig` and set:

| Setting | Value |
|---|---|
| `SALLAPUSH_APP_ID` | your iOS app id |
| `SALLAPUSH_EXAMPLE_BUNDLE_ID` | the bundle id the Salla team set up; the Notification Service Extension's is `<bundle id>.SallaPushNotificationService` |
| `DEVELOPMENT_TEAM` | your Apple team, to run on a device |
| `SALLAPUSH_APP_GROUP` | optional: an App Group for the app and the extension |
| `SALLAPUSH_API_BASE_URL` | optional: the SallaPush server's URL (default: SallaPush's production URL) |

With an App Group, also add the App Groups capability with that group to the App and SallaPushNotificationService
targets in Xcode, and keep that change local: the committed entitlements have no group, since an empty one breaks
device signing.

The project uses Swift Package Manager: Xcode resolves `SallaApp/sallapush-ios-sdk`, for the plugin and for the
extension's `SallaPushExtension`, when it builds.

### Android

Set these Gradle properties in `android/sallapush.properties`, or in `~/.gradle/gradle.properties`,
`ORG_GRADLE_PROJECT_<name>` or `-P<name>=`, which win over the file:

| Property | Value |
|---|---|
| `sallapushAppId` | your Android app id |
| `sallapushApplicationId` | the application id the Salla team set up (default `sa.salla.sallapush.example`) |
| `sallapushApiBaseUrl` | optional: the SallaPush server's URL (default: SallaPush's production URL) |

Put your Firebase project's `google-services.json` in `android/app/`. Without it the app still builds, and SallaPush
logs `token.firebase_missing`. Gradle downloads the SallaPush Android SDK from Maven Central. Capacitor 8 builds with
JDK 21.

## Run it

From the repository root:

```sh
yarn install
yarn example build
cd example-app
npx cap sync
npx cap run ios # or: npx cap run android
```

The web code runs from the plugin's TypeScript sources, so a change there or in `src/` needs only `yarn example build`
and `npx cap copy` before the next run. To run from Xcode, open `ios/App/App.xcodeproj` (`npx cap open ios`) and run
the App scheme.

## Test pushes without a server

From `example-app/`, with the bundle id and application id you set (`sa.salla.sallapush.example` by default):

- **iOS simulator:** `xcrun simctl push booted <bundle id> ios/TestPayloads/native.apns`, or `compat.apns` for the
  OneSignal-compatible format. iOS shows it only once notifications are allowed. A Notification Service Extension
  never runs for `simctl push`: test images and the badge count on a device.
- **Android:** `adb shell am broadcast -n <application id>/sa.salla.sallapush.example.TestPushReceiver --es payload
  "'$(tr -d '\n' < android/TestPayloads/native.json)'"`, or `compat.json`; the receiver's class name keeps the
  example's package whatever the application id. `TestPushReceiver` hands the data to SallaPush as FCM delivers a
  message. It exists for the smoke tests: never copy it into an app.

## The self-test

When SallaPush started with the app id `example_smoke`, the app runs `src/selfTest.ts` at launch. It calls every API
member, checks that a removed listener misses the next event where it can cause one, and logs one line,
`SALLAPUSH_SELFTEST {"passed":…,"failed":…,"failures":[…],"skipped":[…],"willDisplay":…}`. `skipped` names the checks
it can't make there, such as a permission request that would prompt, or a listener whose event needs a tap. On iOS it
asks for provisional authorization, which shows no prompt. When notifications are allowed (`"willDisplay":
"waiting"`), it then waits for a test push in the foreground, sent as above, and logs
`SALLAPUSH_SELFTEST_WILL_DISPLAY {"ok":true}`.

Then it reloads the page once, as a live update would: Capacitor resets every plugin's listeners, and SallaPush stops
every native registration of the old page. The new page checks that its calls work, listens for the test push again,
and logs `SALLAPUSH_SELFTEST_RELOAD {"ok":…,"failures":[…],"willDisplay":…}`; a second test push then logs
`SALLAPUSH_SELFTEST_WILL_DISPLAY` once more.

Release builds don't forward the WebView's console to native logs, so the self-test also writes each line through the
example's own plugin, `SmokeReporter` (`ios/App/App/SmokeReporterPlugin.swift` and
`android/app/src/main/java/sa/salla/sallapush/example/SmokeReporterPlugin.java`): to the unified log on iOS (subsystem
`sa.salla.sallapush.example`, category `smoke`) and to Logcat on Android (tag `SallaPushSmoke`). Like
`TestPushReceiver`, it exists for the smoke tests: never copy it into an app.

The smoke tests build the Release app with that app id and a SallaPush server URL on a closed local port, so no call
reaches a server. After `yarn example build` and `npx cap sync`:

```sh
# iOS, in ios/App (read the result with: xcrun simctl spawn booted log stream --level info --predicate 'subsystem == "sa.salla.sallapush.example"')
xcodebuild -project App.xcodeproj -scheme App -configuration Release -sdk iphonesimulator -scmProvider system \
  SALLAPUSH_APP_ID=example_smoke SALLAPUSH_API_BASE_URL=http://localhost:9/notifications/v1/sallapush build

# Android, in android/ (read the result with: adb logcat -s SallaPushSmoke)
ORG_GRADLE_PROJECT_sallapushAppId=example_smoke \
  ORG_GRADLE_PROJECT_sallapushApiBaseUrl=http://10.0.2.2:9/notifications/v1/sallapush ./gradlew assembleRelease
```

`scripts/verify.sh smoke` builds the same way, with the bundle id and application id set to
`sa.salla.sallapush.example`, whatever you set above, and without your `google-services.json`, then installs, runs
and removes that app.
