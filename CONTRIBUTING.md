# Contributing to the SallaPush Capacitor SDK

This repository is where `@salla.sa/sallapush-capacitor` is developed and released. Every change goes through a pull
request to `master`. For releases, see [RELEASING.md](RELEASING.md).

## Contents

1. [Prerequisites](#prerequisites)
2. [Credentials](#credentials)
3. [Layout](#layout)
4. [Commands](#commands)
5. [Adding or changing API](#adding-or-changing-api)
6. [What needs care](#what-needs-care)
7. [Commits](#commits)
8. [Pull requests](#pull-requests)

## Prerequisites

- **Node 24**, the version in `.nvmrc`, with Corepack: it runs the Yarn release the repository pins (`packageManager`
  and `.yarnrc.yml`). Run `corepack enable` once. Capacitor 8's CLI needs Node 22 or later.
- **Xcode 26**, which Capacitor 8 needs, and an iPhone simulator with iOS 16 or later.
- **JDK 21,** which Capacitor 8 builds Android with. `scripts/verify.sh` takes `SALLAPUSH_JAVA_HOME` when it is set,
  else `$HOME/.sallapush-tools/jdk-21/Contents/Home`, else `/usr/libexec/java_home -v 21`, and checks that it is a JDK
  21. Temurin 21 installs without admin rights: download
  `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.12.1_1.tar.gz`,
  check that its SHA-256 is `3623232f33a9c3baadf304480b2535f9a3cba8a58d42ecbb438ba267315d9998`, create the folder
  `$HOME/.sallapush-tools/jdk-21`, and extract the archive into it with
  `tar -xzf <archive> --strip-components 1 -C "$HOME/.sallapush-tools/jdk-21"`.
- **The Android SDK**, in `ANDROID_HOME`, else `~/Library/Android/sdk`, with platform 36 and its build tools. An
  emulator with API 33 or later, for the smoke tests.
- **CocoaPods 1.16**, for the CocoaPods consumer app, and for the `xcodeproj` gem that `scripts/add-nse-target.rb`
  uses.
- **SwiftLint 0.63.2**, and **shellcheck 0.11.0**, or Docker, which runs shellcheck's pinned image.
- **`gh`**, logged in with an account that can read both native repositories, for `scripts/bump-native.sh`.
- **`python3`, `ruby` and `git`**, which the scripts use.
- **`applesimutils`**, optional: `smoke` grants the iOS example the notification permission with it before the launch.

The example app is a Capacitor app in `example-app/`, a Yarn workspace: [example-app/README.md](example-app/README.md)
says how to configure and run it.

## Credentials

- **Gradle:** a personal access token (classic) with `read:packages`, in the Gradle properties `gpr.user` and
  `gpr.key` of `~/.gradle/gradle.properties`, or in `GITHUB_ACTOR` and `GITHUB_TOKEN`.
- **Swift Package Manager:** an account in Xcode that can read `SallaApp/sallapush-ios-sdk`, or, for
  `scripts/verify.sh`, a clean clone of it in `VERIFY_IOS_SDK_CHECKOUT` ([Commands](#commands)).
- **CocoaPods:** git credentials that can read `SallaApp/sallapush-ios-sdk` over HTTPS.
- **The example's own values,** such as its app id and `google-services.json`, go in the files that git ignores
  ([example-app/README.md](example-app/README.md#configure-it)).

Every machine also needs a network that the SallaApp organization allows: elsewhere, it refuses git and package fetches
from its private repositories.

Never commit a credential. `scripts/verify.sh` checks that the credentials it needs exist, without reading them, and
its `tree` step refuses credential files, tokens, private keys, personal paths and Apple team ids in what a commit
takes.

## Layout

| Path | What it holds |
|---|---|
| `src/` | The TypeScript API: `index.ts` exports it, `definitions.ts` declares it, `SallaPush.ts` and the namespace files call the plugin, and `internal/` holds the plugin's interface (`native.ts`), the call helpers, the event hubs, the mapping and the argument checks |
| `ios/Sources/SallaPushCapacitorPlugin/` | The iOS plugin, in Swift: `SallaPushPlugin.swift` (the Capacitor plugin and its methods), `SallaPushCapacitor.swift` (the start-up hook, the delegate's installation and the first-activation check), the chaining notification-center delegate, `SallaPushBridge.swift` (the method logic), the static configuration, the event registry, the display store, the mapping and the seam over native |
| `android/` | The Android plugin, in Kotlin: `SallaPushPlugin.kt`, `SallaPushInitProvider`, the same components as on iOS, and their JUnit tests (`src/test/`) |
| `Package.swift`, `Salla.saSallapushCapacitor.podspec` | The plugin's Swift package and its pod. Capacitor's CLI names both after the npm package, and apps import the module `SallaPushCapacitorPlugin` with either |
| `example-app/` | The example app: its web app (`src/`), the README's snippets (`src/readmeSnippets/`), and its native projects, with the iOS tests in the `AppTests` target (`ios/App/AppTests/`) and the Notification Service Extension |
| `docs/` | The setup guide, the reference and the troubleshooting guide; `docs/snippets/` holds the docs' code for app shapes the example doesn't have, which `scripts/verify.sh consumer` builds |
| `scripts/` | `verify.sh`, `bump-native.sh`, `release-dist.sh`, `verified-label.sh`, `add-nse-target.rb`, the checkers and `self-test.sh` |
| `api/sallapush-capacitor.api` | The public TypeScript API, as `scripts/dump-api.mjs` prints it |
| `tool/api-parity/` | The native API files at the pinned versions, and `mapping.json`, which maps every native symbol |

## Commands

From the repository's root:

| Command | What it does |
|---|---|
| `yarn install` | Installs the dependencies of the package and the example |
| `yarn lint`, `yarn typecheck` | ESLint with Prettier; TypeScript for the library, its tests and the example, the README's snippets included |
| `yarn test`, `yarn test:scripts` | The Jest tests, which `--coverage` holds to the coverage thresholds; the checkers' own tests, with Node's test runner |
| `yarn build` | Builds `dist/` |
| `yarn example build`, then in `example-app/`: `npx cap sync`, and `npx cap run ios` or `npx cap run android` | Runs the example app, from the plugin's sources ([example-app/README.md](example-app/README.md#run-it)) |
| `node scripts/dump-api.mjs --write` | Writes the public API to `api/sallapush-capacitor.api` |
| `scripts/verify.sh [step…]` | Every check below, or the steps named |

`scripts/verify.sh` runs every check a pull request needs, in this order, and stops at the first failure. Steps:

| Step | What it checks |
|---|---|
| `lint` | `yarn lint` |
| `typecheck` | `yarn typecheck` |
| `test` | `yarn test --coverage` and `yarn test:scripts`; fails when the scripts' tests ran none |
| `build` | `yarn build`, that `dist/plugin.cjs.js` loads, and that Capacitor's notification router still routes by the rule that SallaPush's delegate repeats |
| `api` | `api/sallapush-capacitor.api` is the current public API, and TypeScript, Swift and Kotlin declare the same plugin methods, with the same return kinds, and the same events (`scripts/check-plugin-methods.mjs`) |
| `parity` | Every native symbol is mapped once, as wrapped, platform-only, native-only or not wrapped with a reason, and every wrapped one exists in the API |
| `snippets` | The README's and the docs' code blocks equal their sources in the example and `docs/snippets/`, and the versions they name are the pins |
| `pins` | Every pin of the native versions agrees (`scripts/bump-native.sh --check`) |
| `tree` | What a commit takes: no credential, secret, personal path, Apple team id or ticket key; every workflow action pinned to a commit; the required files; executable scripts; every Swift file of the example in a target of its Xcode project |
| `shell` | `bash -n` and shellcheck on every script, then `scripts/self-test.sh`, the tests of the scripts themselves |
| `swiftlint` | SwiftLint 0.63.2, strict, on the plugin and the example |
| `android` | The plugin's JUnit tests and lint, a minified release build of the example, and the provider order and service priority of its merged manifest |
| `ios` | The example's release build, with its Notification Service Extension, then its XCTest suite, which must run at least one test |
| `smoke` | The example's self-test on a simulator and a running emulator: a test push in the foreground, a page reload, and a second test push that the reloaded page's listener gets once. It builds the example with its own bundle id and application id, `sa.salla.sallapush.example`, whatever your local settings name. |
| `consumer` | Fresh Capacitor apps that install a dry run of the release with only what the README shows, and build: Swift Package Manager on Capacitor 8.5.3, CocoaPods with `@capacitor/push-notifications`, the oldest Capacitor 8 with the storyboard template, and a Yarn install. The CocoaPods and storyboard apps also run on the simulator. It needs a clean working tree. |

The first ten steps need no private access, and CI runs them. The others need macOS, the native SDKs and devices. A
full run takes about 10 minutes on a recent Mac once Gradle, Xcode and npm have filled their caches, and longer the
first time. A run that starts on a clean working tree fails when a step leaves a file behind that no ignore file
covers. Environment variables:

- `VERIFY_LOG_DIR`: a log per step and `summary.tsv`, which names the commit. Use a folder for each commit, outside the
  repository, such as `"$TMPDIR/sallapush-verify/$(git rev-parse --short HEAD)"`: runs of another commit are refused.
- `VERIFY_SIMULATOR_UDID`, else a booted iPhone simulator, else the newest one; `VERIFY_EMULATOR_SERIAL`, else the one
  running emulator.
- `VERIFY_IOS_SDK_CHECKOUT`: optional, a clean clone of `SallaApp/sallapush-ios-sdk` at the pinned tag, in a folder
  named `sallapush-ios-sdk`. Every Swift Package Manager build then uses it in place of the remote package, for a Mac
  whose Xcode has no account that can read the repository, and the summary of each such step says so.
- `YARN`, `SHELLCHECK`, `SWIFTLINT`, `ANDROID_HOME` and `SALLAPUSH_JAVA_HOME`.

The scripts never shut down or erase a simulator or an emulator; `smoke` boots the simulator it uses when it isn't
running yet.

## Adding or changing API

1. **Native semantics first.** Read the native API and docs at the pinned tags: the package adds no push logic.
2. **The mapping.** Map the native symbols in `tool/api-parity/mapping.json`.
3. **The plugin's interface.** Add the method or event to `src/internal/native.ts`: a request resolves `{ value }`
   (`Promise<Value<…>>`), any other method resolves nothing (`Promise<void>`). Add it to the Jest mock in
   `src/internal/__mocks__/native.ts`, and to both native layers' `NativeSallaPush` seams and their test fakes.
4. **The native methods, with their tests.** In Swift, an `@objc func <name>(_ call: CAPPluginCall)` and its entry in
   `pluginMethods`, `CAPPluginReturnPromise` for a request and `CAPPluginReturnNone` otherwise; an event is a
   `notifyListeners("<event>", …)` call. In Kotlin, a `@PluginMethod` function, with `returnType =
   PluginMethod.RETURN_NONE` unless it is a request; an event is an entry of the `Event` enum in `EventRegistry.kt`.
   Tests: JUnit 4 with Robolectric for Kotlin, and XCTest in the example's `AppTests` target for Swift. A new XCTest
   file goes into that target in the Xcode project (the `tree` step checks it).
5. **The TypeScript API,** in `src/definitions.ts` and the namespace files, with its Jest tests.
6. **The API dump and the docs.** Run `node scripts/dump-api.mjs --write`, and update the README and the docs.

The `api` step fails until TypeScript, Swift and Kotlin declare the same methods, with the same kinds, and the same
events: Capacitor itself would only fail a missing method at run time, with "not implemented".

## What needs care

- **The router branch.** For a notification that isn't SallaPush's, SallaPush's notification-center delegate
  (`NotificationCenterDelegate.swift`) repeats the rule of Capacitor's `NotificationRouter`: a push to its push handler,
  anything else to its local-notification handler. The `build` step fails when the installed `@capacitor/ios` no
  longer holds the router's lines that the delegate repeats. After a Capacitor update that changes them, change the
  delegate and its tests to the new rule, then the lines the step checks (`ROUTER_LINES` in `scripts/verify.sh`).
- **One `@objc(` name.** Capacitor's CLI registers the first `@objc(Name)` of every Swift file under `ios/` as a plugin
  class. So `@objc(SallaPushPlugin)` is the only explicit Objective-C name in `ios/Sources/`, and the first `@objc(`
  text of `SallaPushPlugin.swift`, comments included; every other class uses a bare `@objc`. No Objective-C class may
  take the name of a SallaPush class: the runtime has one namespace. On Android, `@CapacitorPlugin(name = "SallaPush")`
  sits directly above `class SallaPushPlugin`, with its KDoc above the annotation. The `api` step checks both.
- **Method names.** A plugin method never takes the name of Capacitor's own plugin members (`addListener`,
  `removeListener`, `removeAllListeners`, `checkPermissions`, `requestPermissions`) or of a public method of Android's
  `Plugin`: that is why the app-id getter is `getSallaPushAppId`.
- **Threads and listener bookkeeping.** On iOS, every plugin method does its work on the main thread, in call order,
  and the overrides of `addListener`, `removeListener` and `removeAllListeners` move Capacitor's listener bookkeeping
  there too, where the plugin emits. On Android, native calls run on Capacitor's plugin thread, registry work on the
  main thread through `onRegistry`, and events go to JavaScript from the plugin thread, where Capacitor keeps its
  listeners. New code keeps to those threads.
- **Page loads and teardown.** Capacitor calls `removeAllListeners` at every page load, with a nil call on iOS: the
  plugin stops every native registration there, and must keep working for the new page. On Android, `handleOnDestroy`
  sets `destroyed`, after which `onRegistry` refuses every registry change.
- **The public API** is `api/sallapush-capacitor.api`; `api` fails when the code differs from it. Commit the new dump
  with an intended change.
- **The README's and the docs' code blocks** are copies of code the checks build: the example's files and their
  `snippet:<name>` regions, and `docs/snippets/`. A hidden marker before each block names its source, such as
  `<!-- snippet:example-app/src/start.ts#click-listener -->`; a block that can't come from there says why in an
  `<!-- unchecked: … -->` marker. Change the source first, then copy it into every block that shows it.
  `node scripts/check-readme-snippets.mjs --print <source>[#<region>]` prints what a block must hold.
- **The native pins** are listed once, in `SP_PINS` of `scripts/common.sh`: `bump-native.sh` sets them all and `pins`
  checks them. A new file that names a native version needs its entry there.
- **The release's `package.json`** keeps only the keys an install needs, the `capacitor` key among them: Capacitor's
  CLI treats a package as a plugin only with it. `scripts/release-dist.sh` refuses a release without it or without a
  key the podspec reads, and a `files` entry that names a nested folder without a glob, which Yarn's pack would drop.
- **Nothing builds at install time.** The package has no `prepare`, `prepack` or `capacitor:*` scripts: git installs
  run none, and Capacitor's CLI would run a plugin's `capacitor:*` scripts at every sync.
- **Dependencies and tools are pinned:** the native SDKs, the workflow actions, each to a commit with its version in a
  comment, Yarn, Capacitor's packages, and the tool versions of `scripts/common.sh`.

## Commits

- One short lowercase line: `feat: …`, `fix: …`, `docs: …`, `test: …` or `ci: …`.
- Small commits, each of which builds and passes its checks, with the tests of a change in the same commit.
- Signed: the organization accepts only commits with a verified signature.

## Pull requests

- **Branch names:** `feature/<TICKET>-<description>`, or `bugfix/`, `hotfix/` or `test/` in place of `feature/`.
- **Titles:** `<type>(<scope>): <subject>`, with a scope, such as the ticket key.
- **Checks:** the organization requires `Validate PR title`, `Validate branch name`, `Greptile Review` and
  `Testing Ready`. CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `JavaScript, types and unit tests`
  (the first nine steps), `Shell scripts` (the `shell` step) and `Native verified`; `Testing Ready` passes only when
  all three did.
- **`Native verified`.** CI can't build the native code: the native SDKs are private, and no macOS runner exists. So
  after each push, run `scripts/verify.sh` with no step names on a Mac, at the pull request's head commit, with
  `VERIFY_LOG_DIR` set. Add the label `native-verified-locally`, and, as the person who added it, comment in the pull
  request's conversation. The comment's first line is exactly `native-verified-locally <the head commit's full id>`, and
  the rest is that run's `summary.tsv` as it is. Its first line and every row name the commit: each must be the head
  commit, without `+dirty`, which marks a run of a tree with changes. Every push needs a new comment, and a comment
  edited after it was posted counts for nothing ([scripts/verified-label.sh](scripts/verified-label.sh)). Neither the
  label nor the comment starts a CI run: then re-run the failed jobs of the head commit's run, with **Re-run failed
  jobs** on its page or `gh run rerun <run id> --failed`, so that `Native verified` and `Testing Ready` pass.
