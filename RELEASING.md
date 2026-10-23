# Releasing the SallaPush Capacitor SDK

How versions are chosen, how a release is made and checked, and how the native SDKs are updated. For working on the
package, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Versions

The package follows [Semantic Versioning](https://semver.org), and pins the native SDKs exactly.

- **A patch** carries a native release that changes nothing in the native API, or a fix of the package.
- **A minor** wraps new native API, or adds API of its own that changes nothing for existing apps.
- **A major** changes the package's API in a way that apps must follow.

A release is a git tag of this repository, the version without a `v`, such as `1.1.0` or `1.2.0-beta.1`, and the same
version on npm. A pushed tag never moves and is never deleted, and npm never takes a version twice: a defect in a
release is fixed by the next version. Every release after 1.0.0 is on npm; 1.0.0 is a git tag only.

## Before a release

In a pull request, merged to `master`:

- **The version:** `version` in `package.json`, and in the README the version line and the Capacitor row of the
  versions table. `git grep -nF <previous version>` lists every place; earlier CHANGELOG entries keep theirs. The
  `snippets` step fails when the versions table and `package.json` disagree.
- **The CHANGELOG entry:** rename `## [Unreleased]` to the version, with the release date, such as
  `## [1.0.0] - 2026-10-20`, and start a new, empty `## [Unreleased]` above it.
- **The checks:** CI passed on the merged commit, and `scripts/verify.sh`, with no step names, passes in a clean
  checkout of it on a Mac, `smoke` and `consumer` included.
- **The devices:** a release that changes the native pins or the plugin's native code also passes the
  [device checks](#device-checks). Record the result in the release's pull request.

## Making the release

The tag names a release commit that holds the built `dist/`, so nothing builds at install time:

1. Check out the merged commit, in a fresh clone with a clean working tree.
2. Run `scripts/release-dist.sh <version>`. It checks the version, the CHANGELOG entry, that the tag doesn't exist yet
   and that `origin/master` has the commit; builds and packs the package; keeps in `package.json` only what an install
   and npm need; and commits that tree, signed, as a child of the merged commit, tagged with the version.
   `--dry-run` makes the same commit in a temporary clone and changes nothing here.
3. Push the tag, and only the tag: `git push origin <version>`. The script never pushes.
4. The tag's push runs [.github/workflows/publish.yml](.github/workflows/publish.yml): it checks the tag, then, in the
   protected `release` environment that a maintainer approves, publishes the tag's tree to npm with trusted publishing
   and creates the GitHub Release from the CHANGELOG entry. A pre-release goes to npm's `next` tag.

The first version of a new package can't use trusted publishing yet: before step 3, a maintainer with publish rights on
the `@salla.sa` scope publishes it by hand from a clean checkout of the tag, with two-factor authentication, and sets
up trusted publishing for this repository, `publish.yml` and the `release` environment.

## After the release

In a fresh Capacitor 8 app, install the release from npm, run `npx cap sync`, and build both platforms. Then install
the pushed tag from git ([Installation](README.md#installation)), once with npm 12 and once with Yarn 4.18.1, and build
both platforms each time. Also update an app that has the previous release, once with CocoaPods and once with Swift
Package Manager and the Notification Service Extension: update the package, move the app's SallaPush pins, run
`npx cap sync`, and build both platforms. Record the results in the release's pull request.

## Updating the native SDKs

1. Run `scripts/bump-native.sh <version>`, or `--ios <version> --android <version>`. It fetches the native API files
   at the new tags with `gh`, sets every pin, adds the CHANGELOG line and runs the API parity check. It never commits
   or pushes.
2. Map each native symbol the parity check names in `tool/api-parity/mapping.json`: wrap it, or list it as not
   wrapped, with the reason.
3. Wrap the new API, with its tests ([CONTRIBUTING.md](CONTRIBUTING.md#adding-or-changing-api)).
4. Read the native CHANGELOG entries since the old pins, and update the README and the reference where the native
   behaviour changed, such as a new Info.plist key or manifest meta-data in
   [Static configuration](docs/REFERENCE.md#static-configuration).
5. Open the pull request, and release as above.

SallaPush iOS has no release 1.0.1, and `bump-native.sh` refuses it.

## Device checks

On an iPhone and on an Android 13 or later phone, with a real app id, the example app with your values
([example-app/README.md](example-app/README.md)) and verbose logs:

1. **Registration:** `register.ok`, and `pushSubscription.getId()` and `getToken()` are set.
2. **Notifications:** a foreground and a background notification show, with the image on iOS through the extension,
   and a tap reaches the click listener with its `url`.
3. **The tap that launches the app** reaches the click listener once: on iOS in the UIScene example and in a storyboard
   app made with Capacitor 8.0 to 8.4's template; on Android also after the process was killed again before
   JavaScript ran.
4. **Launch URLs:** with the open-launch-URLs option on, an https launch URL opens.
5. **A `'foregroundWillDisplay'` listener:** a prevented notification doesn't show, and `display()` shows it later;
   one that isn't prevented shows, on iOS as SallaPush's local copy.
6. **The opt-out on Android:** after `optOut()`, with the app killed, a SallaPush notification doesn't show.
7. **Identity:** a valid token gets no login failure; a bad one gets `'loginFailure'` with `tokenRejected`; `logout()`
   works.
8. **Consent:** with the consent key on, nothing registers until `setConsentGiven(true)`.
9. **Permission:** the prompt, and `requestPermission(true)` after a permanent denial on Android 13 or later.
10. **Another push plugin:** in a test app with another push plugin, that plugin's notifications and taps reach its
    own listeners, SallaPush's reach only SallaPush's, and on Android nothing shows twice. A tap on that plugin's
    notification that launches the app reaches it as it does without SallaPush, in both iOS app shapes.
11. **A page reload:** after `location.reload()`, a tap reaches the new page's click listener once.
12. **Badges:** on iOS, three notifications while the app is in the background show 3, and opening the app shows 0. On
    Android, opening the app keeps SallaPush's notifications in the shade by default, and removes them with
    `com.salla.push.AUTO_CLEAR_BADGE` set to `true`.
