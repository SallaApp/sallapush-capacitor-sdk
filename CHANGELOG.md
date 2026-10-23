# Changelog

All notable changes to the SallaPush Capacitor SDK. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The package is available under the MIT License; `package.json` and the podspec declare it.

## [1.0.0] - 2026-10-19

### Added

- Initialization and consent: SallaPush starts natively from the app id in the Info.plist or the manifest, and
  `SallaPush.initialize` takes an app id known only at run time; `setConsentRequired` and `setConsentGiven`, and the
  static consent keys.
- Identity: `SallaPush.login(externalId, identityToken)` and `logout()`, with `User.getExternalId()` and
  `User.isLoggedIn()`.
- User and tags: `SallaPush.User.addTag`, `addTags`, `removeTag`, `removeTags`, `getTags` and `setLanguage`.
- Push subscription: `SallaPush.User.pushSubscription`, with the device id, the push token, the opted-in state,
  `optIn()` and `optOut()`.
- Permission: the permission getters and requests of `SallaPush.Notifications`, provisional authorization (iOS), APNs
  tokens from other SDKs (iOS), clearing notifications, and `isSallaPushNotification` and `trackOpened` (Android) for
  apps that also run other push SDKs.
- Events: listeners for taps, the tap that launched the app included, and for permission, user and subscription changes
  and login failures; each subscription listener gets its own replay.
- The foreground decision: a `'foregroundWillDisplay'` listener holds each foreground notification and decides whether
  it shows, and `notification.display()` shows a held one later. On iOS a notification shown this way is SallaPush's
  local copy, without its image and action buttons.
- Logging: the log level of `SallaPush.Debug`, and one log handler for the app.
- Capacitor: the plugin keeps Capacitor's push and local-notification plugins working on iOS by handing Capacitor's
  notification router every notification that isn't SallaPush's; Swift Package Manager and CocoaPods.
- Static configuration and early init: Info.plist keys and manifest meta-data, read by `SallaPushCapacitor.start()` on
  iOS and by a content provider on Android, so SallaPush starts before JavaScript, also in processes that run no
  JavaScript.
- The web: no implementation, and the calls say so: requests reject with Capacitor's `UNIMPLEMENTED` error, and other
  calls print one console error each.
- Minified Android builds: the package's consumer rules keep what R8 must keep, so a minified app needs no rule of its
  own, also on the Android Gradle plugin 9.
- The native versions: SallaPush iOS 1.0.4 and SallaPush Android 1.0.4.
