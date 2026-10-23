# Changelog

All notable changes to the SallaPush Capacitor SDK. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `autoClearBadge` and `autoUpdateBadge` in `SallaPush.initialize`'s config, for both platforms: a setting given
  applies to both, and one left out keeps each platform's default. `autoClearBadge`, on by default on iOS and off on
  Android, clears the app icon's badge when the app opens; `autoUpdateBadge`, on by default on both, raises and lowers
  it for SallaPush's notifications. Their static keys are `SallaPushAutoClearBadge` (as before) and the new
  `SallaPushAutoUpdateBadge` in the Info.plist, and the new meta-data `com.salla.push.AUTO_CLEAR_BADGE` and
  `com.salla.push.AUTO_UPDATE_BADGE` in the manifest ([Badges](README.md#badges)).

### Changed

- By default, SallaPush counts its notifications on the iOS app icon's badge, with the Notification Service Extension
  and the same App Group in the app and the extension, and a SallaPush notification shown while the app is open no
  longer changes the iOS badge; on iOS, `clearAll()` also sets the badge to 0. On Android, the launcher's badge
  follows SallaPush's notifications in the shade, and `autoClearBadge`, off by default there, removes them when the
  app comes to the foreground. `autoUpdateBadge: false` turns the count off, and `autoClearBadge: false` keeps the iOS
  badge when the app opens.
- The package is available under the MIT License; `package.json` and the podspec declare it.
- The docs' Podfile lines fetch the SallaPush pods over HTTPS instead of SSH.
- Android: SallaPush Android now comes from Maven Central. The package no longer adds a GitHub Packages repository to
  your build, and no GitHub token is needed: remove the GitHub Packages credentials you set for SallaPush, and the
  `SallaPushGitHubPackages` repository if your settings declare it.
- Install the package from npm: `npm install @salla.sa/sallapush-capacitor`, with no git access or `allow-git`
  setting. A release tag still installs from git, over HTTPS, as a fallback:
  `git+https://github.com/SallaApp/sallapush-capacitor-sdk.git#<version>`.
- The README is rewritten for developers, and shorter: installation, the iOS and Android setup, a quick start, every
  common task and the app badge. `docs/SETUP.md` is removed; the README and the reference hold the setup.
- The package's description, also the podspec's summary, says that SallaPush is for the mobile apps of Salla stores,
  and its npm keywords name Capacitor plugins, push notifications, iOS and Android.

### Deprecated

- `ios.autoClearBadge` in `SallaPush.initialize`'s config. Use the top-level `autoClearBadge`, which applies on both
  platforms; `ios.autoClearBadge` still applies on iOS when `autoClearBadge` is left out.

### Removed

- The server URL is no longer configurable: `SallaPush.initialize`'s `apiBaseUrl` option, the Info.plist key
  `SallaPushAPIBaseURL` and the meta-data `com.salla.push.API_BASE_URL` are removed, and SallaPush always uses its
  built-in URL.

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
