# Releasing the SallaPush Capacitor SDK

How versions are chosen, how a release is made and checked, how the native SDKs are updated, and the checks on
devices. For working on the package, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contents

1. [Versions](#versions)
2. [Before a release](#before-a-release)
3. [Making the release](#making-the-release)
4. [After the release](#after-the-release)
5. [Updating the native SDKs](#updating-the-native-sdks)
6. [The device checklist](#the-device-checklist)

## Versions

The package follows [Semantic Versioning](https://semver.org). Its pins of the native SDKs are exact.

- **A patch** carries a native release that changes nothing in the native API, or a fix of the package.
- **A minor** wraps new native API, or adds API of its own that changes nothing for existing apps.
- **A major** changes the package's API in a way that apps must follow.

A release is a git tag on this repository: the version itself, without a `v`, such as `1.0.0` or `1.1.0-beta.1`.
Apps install that tag ([README](README.md#installation)). A pushed tag never moves and is never deleted: an app's
lockfile records its commit. A defect in a release is fixed by the next version.

## Before a release

In a pull request, and merged to `master`:

- **The version.** Set `version` in `package.json`. In the README, set the version line, without "not released yet",
  the Capacitor row of the versions table and the tag of the install line. `git grep -nF <previous version>` lists
  every place; earlier CHANGELOG entries keep theirs. The `snippets` step fails when the versions table and
  `package.json` disagree.
- **The CHANGELOG entry.** Rename `## [Unreleased]` to the version, with the release date, such as
  `## [1.0.0] - 2026-10-20`, and start a new, empty `## [Unreleased]` above it.
- **The checks.** On the merged commit, in a clean checkout, on a Mac with access to the native SDKs, run
  `scripts/verify.sh` with no step names. Every step must pass, `consumer` included, which installs a dry run of the
  release in fresh Capacitor apps.
- **The devices.** A release that changes the native pins or the plugin's native code also passes the
  [device checklist](#the-device-checklist). Record the result of each item in the release's pull request.

## Making the release

An app installs the package from git, and nothing builds at install time: the tag names a release commit that holds
the built `dist/`. `scripts/release-dist.sh` makes it:

1. Check out the merged commit, with a clean working tree.
2. Run `scripts/release-dist.sh <version>`. It checks that `package.json` declares the version, that the CHANGELOG has
   its entry, that the tag doesn't exist yet, and that `master` on `origin` has the commit, which it fetches to check.
   Then it builds the package afresh, packs it as npm does, keeps in `package.json` only what an install needs (the
   `capacitor` key included, without which Capacitor's CLI doesn't see the plugin), and commits that tree as a child of
   the merged commit, signed with your git signing key. It tags that commit with the version. It refuses a package that
   would ship a file that isn't committed, such as one `.gitignore` hides in `android/`: release from a fresh clone.
3. Push the tag, and only the tag: `git push origin <version>`. The script never pushes, and prints that command.

The release commit is on no branch, by design: `master` keeps the sources only. `scripts/release-dist.sh <version>
--dry-run` makes the same commit in a temporary clone, from any commit, and changes nothing here.

## After the release

In a fresh Capacitor 8 app, install the pushed tag with the README's exact dependency line:

- once with npm 12, with `allow-git=root` in the app's `.npmrc`;
- once with Yarn 4.18.1, with the repository in `approvedGitRepositories`;
- each time, run `npx cap sync`, and build both platforms.

From the second release on, also update an app that has the previous release, once with CocoaPods and once with Swift
Package Manager and the Notification Service Extension, as the setup guide's
[Updating the package](docs/SETUP.md#updating-the-package) says: move the tag and the app's SallaPush pins, run
`npx cap sync`, and build both platforms.

Record the result in the release's pull request.

## Updating the native SDKs

1. Run `scripts/bump-native.sh <version>`, or `--ios <version> --android <version>`. With `gh`'s own credentials, it
   fetches the native API files at the new tags, sets every pin (the podspec, `Package.swift`, the example extension's
   package requirement, `docs/snippets/Podfile`, the Android dependency, `tool/api-parity/mapping.json`, the README and
   the docs), adds the CHANGELOG line, and runs the API parity check. A platform already at its version is left as it
   is, and out of the CHANGELOG line. It never commits, pushes or prints a credential.
2. Map each native symbol the parity check names in `tool/api-parity/mapping.json`: wrap it, or list it as not
   wrapped, with the reason.
3. Wrap the new API, with its tests ([CONTRIBUTING.md](CONTRIBUTING.md#adding-or-changing-api)).
4. Update the README and the docs where the native behaviour changed, with links to the native docs at the new tag.
5. Open the pull request, and release as above. When the native API didn't change, the parity check passes at once,
   and the release is a patch.

SallaPush iOS has no release 1.0.1: that tag was pushed by mistake, and `bump-native.sh` refuses it.

## The device checklist

Run it on an iPhone and on an Android 13 or later phone, with a real app id that the SallaPush team set up with your
APNs key and bundle id, and your Firebase project. Use the example app with your values
([example-app/README.md](example-app/README.md)), and for the storyboard app of item 3 and items 10 and 11, test apps
made as `scripts/verify.sh consumer` makes its apps. Turn on verbose logs.

1. **Registration.** `register.ok` appears in the logs, and `pushSubscription.getId()` and `getToken()` are set.
2. **Without a `'foregroundWillDisplay'` listener.** A foreground notification shows, with its image on iOS, through
   the extension. A background notification shows, and a tap on it reaches the click listener, with its `url`.
3. **The tap that launches the app.** Kill the app, tap a notification: the tap reaches the click listener once. On
   iOS, in the example, which has Capacitor 8.5's UIScene template, and in a storyboard app made with Capacitor 8.0 to
   8.4's template. On Android, also after the app's process was killed again within 5 minutes, before JavaScript ran.
4. **Launch URLs.** With the open-launch-URLs option on, an https launch URL opens.
5. **With a `'foregroundWillDisplay'` listener.** When it prevents, nothing shows, and `display()` later shows it.
   When it doesn't, the notification shows; on iOS as SallaPush's local copy, without image or action buttons.
6. **The opt-out on Android.** Call `optOut()`, kill the app, send a push: nothing shows. This is the process that FCM
   starts without JavaScript.
7. **Identity.** A `login` with a valid token gets no failure; a bad token gets a `'loginFailure'` with
   `tokenRejected`; `logout()` works.
8. **Consent.** With the consent key on, nothing registers until `setConsentGiven(true)`.
9. **Permission.** The prompt, and `requestPermission(true)` after a permanent denial, on Android 13 or later.
10. **Coexistence.**
    - **`@capacitor/push-notifications`:** on iOS, its own pushes show by its `presentationOptions`, and their taps
      reach `pushNotificationActionPerformed`; SallaPush's reach only SallaPush's listeners. On Android, its pushes
      arrive through the forwarding service, without a duplicate.
    - **`@capacitor/local-notifications`:** its notifications still show, and their taps reach
      `localNotificationActionPerformed`; SallaPush's foreground copies don't reach it.
    - **OneSignal** (`@onesignal/capacitor-plugin`, with `ios.handleApplicationNotifications` set to `false`):
      - Android: a tap on a notification OneSignal showed, SallaPush's compatible ones included, goes through the
        app's routing and records `opened` (`trackOpened` resolves `true`); a foreground one follows the app's policy.
      - iOS: a compatible SallaPush notification in the foreground shows once, without and with a SallaPush
        `'foregroundWillDisplay'` listener, and a tap on it is routed once, by SallaPush's click listener. The result
        decides the README's advice on that listener. A plain OneSignal notification in the foreground reaches
        OneSignal's `'foregroundWillDisplay'` listener once, both when it shows and when that listener calls
        `preventDefault()`, and a tap on it reaches OneSignal's click listener once.
    - **`@capacitor-firebase/messaging`:** as `@capacitor/push-notifications`. Also, forwarding its
      `apnsTokenReceived` token with `forwardApnsToken` changes nothing visible, and a SallaPush push with
      `content-available`, in the foreground and in the background, never reaches its `notificationReceived` listener.
11. **Another SDK's tap that launches the app, compared.** This item blocks the release. Build the same test app with
    `@capacitor/push-notifications` twice, once with SallaPush and once without, and kill it before each tap on one of
    that plugin's pushes. The tap must reach `pushNotificationActionPerformed` in the app with SallaPush whenever it
    does in the app without it, in both iOS app shapes. Note whether the `[SallaPush]` line "A notification response
    that isn't SallaPush's arrived before Capacitor's notification router existed" appeared. A difference blocks the
    release until SallaPush holds such a tap for Capacitor's router.
12. **A page reload.** Reload the example's page (`location.reload()`, as a live update does), then tap a
    notification: the tap reaches the new page's click listener once.

Each item that passes for the first time leaves
[Not verified yet](docs/TROUBLESHOOTING.md#not-verified-yet).

The example's test hooks are for its own checks: its `TestPushReceiver` (Android) accepts a test push from `adb`, its
`SmokeReporter` plugin writes the self-test's lines to the native logs, and its self-test runs only with the app id
`example_smoke`. Never copy `TestPushReceiver` or `SmokeReporter` into an app.
