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

A release is a git tag on this repository, the version itself without a `v`, such as `1.0.1` or `1.1.0-beta.1`, and
the same version on npm. Apps install it from npm, or from the tag ([README](README.md#installation)). A pushed tag
never moves and is never deleted, and npm never takes a version twice: an app's lockfile records what it installed. A
defect in a release is fixed by the next version. Every release after 1.0.0 is on npm; 1.0.0 is a git tag only.

## Before a release

In a pull request, and merged to `master`:

- **The version.** Set `version` in `package.json`. In the README, set the version line, without "not released yet", and
  the Capacitor row of the versions table, and in the setup guide the tag of the git dependency line.
  `git grep -nF <previous version>` lists every place; earlier CHANGELOG entries keep theirs. The `snippets` step fails
  when the versions table and `package.json` disagree.
- **The CHANGELOG entry.** Rename `## [Unreleased]` to the version, with the release date, such as
  `## [1.0.0] - 2026-10-20`, and start a new, empty `## [Unreleased]` above it.
- **The checks.** CI passed on the merged commit. Also, in a clean checkout of it, on a Mac, run `scripts/verify.sh`
  with no step names: every step must pass, `smoke` and `consumer` included, which CI doesn't run; `consumer` installs a
  dry run of the release in fresh Capacitor apps.
- **The devices.** A release that changes the native pins or the plugin's native code also passes the
  [device checklist](#the-device-checklist). Record the result of each item in the release's pull request.

## Making the release

Nothing builds at install time: the tag names a release commit that holds the built `dist/`, and npm publishes that
commit's files. `scripts/release-dist.sh` makes the commit:

1. Check out the merged commit, with a clean working tree.
2. Run `scripts/release-dist.sh <version>`. It checks that `package.json` declares the version, that the CHANGELOG has
   its entry, that the tag doesn't exist yet, and that `master` on `origin` has the commit, which it fetches to check.
   Then it builds the package afresh, packs it as npm does, keeps in `package.json` only what an install and npm need
   (the `capacitor` key included, without which Capacitor's CLI doesn't see the plugin, and `publishConfig`), and
   commits that tree as a child of the merged commit, signed with your git signing key. It tags that commit with the
   version. It refuses a package that would ship a file that isn't committed, such as one `.gitignore` hides in
   `android/`: release from a fresh clone.
3. Push the tag, and only the tag: `git push origin <version>`. The script never pushes, and prints that command.
4. The tag's push runs [.github/workflows/publish.yml](.github/workflows/publish.yml), from the tag's own commit,
   where `release-dist.sh` put it. It checks that the tag is the dist commit of a `master` commit, at the version of
   its `package.json` and CHANGELOG. Then, in the protected `release` environment, which a maintainer approves, it
   publishes the tag's tree to npm with trusted publishing (no npm token; npm adds provenance), and creates the GitHub
   Release from the version's CHANGELOG entry. A pre-release (`-alpha`, `-beta`, `-rc`) goes to npm's `next` tag and is
   marked as a pre-release.

The first version of a new package can't use trusted publishing yet. Before step 3, a maintainer with publish rights on
the `@salla.sa` scope publishes it by hand, with two-factor authentication, from a clean checkout of the tag
(`git checkout <version>`, then `npm publish`, which uploads exactly the tag's files, as `npm publish --dry-run` lists
them), and sets up trusted publishing on npmjs.com for this repository, `publish.yml` and the `release` environment.
The tag's workflow then finds the version on npm, publishes nothing, and creates the GitHub Release; so does a re-run.

The release commit is on no branch, by design: `master` keeps the sources only. `scripts/release-dist.sh <version>
--dry-run` makes the same commit in a temporary clone, from any commit, and changes nothing here.

## After the release

In a fresh Capacitor 8 app, install the release from npm, `npm install @salla.sa/sallapush-capacitor@<version>`, run
`npx cap sync`, and build both platforms. Then install the pushed tag with the setup guide's git dependency line
([From git](docs/SETUP.md#from-git)):

- once with npm 12, with `allow-git=root` in the app's `.npmrc`;
- once with Yarn 4.18.1, with the repository in `approvedGitRepositories`;
- each time, run `npx cap sync`, and build both platforms.

Also update an app that has the previous release, once with CocoaPods and once with Swift Package Manager and the
Notification Service Extension, as the setup guide's [Updating the package](docs/SETUP.md#updating-the-package) says:
update the package, move the app's SallaPush pins, run `npx cap sync`, and build both platforms.

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
   The parity check sees only the API, so also read the native CHANGELOG entries since the old pins: add each new
   Info.plist key or manifest meta-data that native reads to the
   [Static configuration](docs/REFERENCE.md#static-configuration) table, and update the **Privacy** notes of the README,
   the setup guide and the reference when what native logs changes.
5. Open the pull request, and release as above. When the native API didn't change, the parity check passes at once,
   and the release is a patch.

SallaPush iOS has no release 1.0.1, and `bump-native.sh` refuses it.

## The device checklist

Run it on an iPhone and on an Android 13 or later phone, with a real app id that the Salla team set up with your
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
