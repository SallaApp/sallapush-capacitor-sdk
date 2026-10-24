# SallaPush example

A Capacitor 8.5 app (Vite and TypeScript, no UI framework) that runs `@salla.sa/sallapush-capacitor` from this
repository's sources. It shows SallaPush's state on the device, makes every API call, decides about foreground
notifications, and logs every event. It also hosts the plugin's iOS unit tests, the `AppTests` target.

The code of the README and of the [reference](../docs/REFERENCE.md) comes from here:

- `src/main.ts` adds the click listener of `src/start.ts` before it renders.
- `ios/App/App/AppDelegate.swift` has the lines every iOS app adds; `ios/App/App/Info.plist` and
  `android/app/src/main/AndroidManifest.xml` hold the static configuration; `ios/App/SallaPushNotificationService/` is
  the Notification Service Extension.
- `src/readmeSnippets/` holds the other snippets, which `yarn typecheck` compiles and which never run.

## Configure it

SallaPush starts at launch from the app id in the app's static configuration: you need one for iOS and one for
Android. Contact the Salla team for your app id. The files below are ignored by git.

- **iOS:** copy `ios/App/Config/SallaPush.local.xcconfig.example` to `ios/App/Config/SallaPush.local.xcconfig`, and
  set `SALLAPUSH_APP_ID`, `SALLAPUSH_EXAMPLE_BUNDLE_ID` (the extension's is `<bundle id>.SallaPushNotificationService`)
  and, to run on a device, `DEVELOPMENT_TEAM`. With an App Group, also set `SALLAPUSH_APP_GROUP`, and add the App Groups
  capability with that group to the App and SallaPushNotificationService targets; keep that change local, since an
  empty group in the committed entitlements breaks device signing.
- **Android:** set `sallapushAppId`, and `sallapushApplicationId` (default `sa.salla.sallapush.example`), in
  `android/sallapush.properties`, or in `~/.gradle/gradle.properties`, `ORG_GRADLE_PROJECT_<name>` or `-P<name>=`,
  which win over the file. Put your app's `google-services.json` in `android/app/`. Capacitor 8 builds with JDK 21.

## Run it

From the repository root:

```sh
yarn install
yarn example build
cd example-app
npx cap sync
npx cap run ios # or: npx cap run android
```

A change in the plugin's TypeScript or in `src/` needs only `yarn example build` and `npx cap copy` before the next
run. To run from Xcode, open `ios/App/App.xcodeproj` (`npx cap open ios`) and run the App scheme.
