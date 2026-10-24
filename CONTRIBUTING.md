# Contributing to the SallaPush Capacitor SDK

Thank you for helping improve the SallaPush Capacitor SDK.

## Issues

- **Bugs and feature requests:** [open an issue](https://github.com/SallaApp/sallapush-capacitor-sdk/issues/new/choose)
  with the SDK version, the platform and OS version, what you expected and what happened, and the SallaPush log codes
  you saw. Never paste tokens, keys or customer data.
- **Security problems:** don't open an issue. Report them privately, as [SECURITY.md](SECURITY.md) explains.
- **App ids:** Contact the Salla team for your app id.

## Pull requests

- For a large change, open an issue first, so that we can agree on the approach before you write the code.
- Keep each pull request to one change, with its tests and docs, and a line under `## [Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md). Run `scripts/verify.sh` before you push.
- A maintainer reviews it, and may land it as a commit of their own that credits you as a co-author (`Co-authored-by`).
- By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE); no contributor
  license agreement or sign-off is needed. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- **Node 24**, the version in `.nvmrc`, with Corepack (`corepack enable`), which runs the Yarn release the repository
  pins.
- **Xcode 26** and an iPhone simulator with iOS 16 or later.
- **JDK 21:** `scripts/verify.sh` takes `SALLAPUSH_JAVA_HOME`, else `$HOME/.sallapush-tools/jdk-21/Contents/Home`, else
  `/usr/libexec/java_home -v 21`. `SP_JAVA_INSTALL` in `scripts/common.sh` names a Temurin 21 archive and its SHA-256.
- **The Android SDK,** in `ANDROID_HOME`, else `~/Library/Android/sdk`, with platform 36, and an emulator with API 33 or
  later for the smoke tests.
- **CocoaPods 1.16**, **SwiftLint 0.63.2**, **shellcheck 0.11.0** or Docker, **`gh`** logged in for
  `scripts/bump-native.sh`, and `python3`, `ruby` and `git`. `applesimutils` is optional.

The checks need no account or token. The example's own values go in files that git ignores
([example-app/README.md](example-app/README.md#configure-it)). Never commit a credential: the `tree` step refuses
credential files, tokens, private keys, personal paths and Apple team ids.

## Layout

| Path | What it holds |
|---|---|
| `src/` | The TypeScript API: `definitions.ts` declares it, the namespace files call the plugin, and `internal/` holds the plugin's interface, the call helpers, the event hubs, the mapping and the argument checks |
| `ios/Sources/SallaPushCapacitorPlugin/` | The iOS plugin, in Swift |
| `android/` | The Android plugin, in Kotlin, with its JUnit tests |
| `Package.swift`, `Salla.saSallapushCapacitor.podspec` | The plugin's Swift package and pod |
| `example-app/` | The example app, the docs' snippets (`src/readmeSnippets/`) and the iOS tests (`ios/App/AppTests/`) |
| `docs/` | The reference and the troubleshooting guide; `docs/snippets/` holds code for app shapes the example doesn't have, which `scripts/verify.sh consumer` builds |
| `scripts/` | `verify.sh`, `bump-native.sh`, `release-dist.sh`, `add-nse-target.rb`, the checkers and `self-test.sh` |
| `api/sallapush-capacitor.api`, `tool/api-parity/` | The public TypeScript API, and the native API files with `mapping.json` |

## Checks

`yarn lint`, `yarn typecheck`, `yarn test` and `yarn build` run the usual checks; `yarn example build`, then
`npx cap sync` and `npx cap run ios` (or `android`) in `example-app/`, runs the example. `scripts/verify.sh [step…]`
runs every check a pull request needs, in this order, and stops at the first failure:

| Step | What it checks |
|---|---|
| `lint`, `typecheck`, `test`, `build` | ESLint with Prettier; TypeScript, the docs' snippets included; Jest with coverage, and the scripts' tests; the build, and the rule of Capacitor's notification router |
| `pack` | What npm would publish |
| `api` | The public API dump, and the same plugin methods and events in TypeScript, Swift and Kotlin |
| `parity` | Every native symbol mapped in `tool/api-parity/mapping.json` |
| `snippets` | The docs' code blocks equal their sources, and name the pinned versions |
| `pins` | Every pin of the native versions agrees |
| `tree` | No credential, secret, personal path, team id or ticket key; pinned workflow actions; the required files |
| `shell` | `bash -n`, shellcheck and `scripts/self-test.sh` |
| `swiftlint`, `android`, `ios` | SwiftLint; the Android unit tests, lint and minified build; the iOS build and XCTest suite |
| `smoke`, `consumer` | The example's self-test on a simulator and an emulator; fresh Capacitor apps built with only what the README shows |

CI runs every step but `smoke` and `consumer`, which stay local release steps ([RELEASING.md](RELEASING.md)). Their
apps run with made-up app ids, which SallaPush refuses (`register.dormant` with `404 unknown_app`): that is expected.
`VERIFY_LOG_DIR` keeps a log per step, and `VERIFY_SIMULATOR_UDID` and `VERIFY_EMULATOR_SERIAL` pick the devices. The
scripts never shut down or erase a simulator or an emulator.

## Adding or changing API

1. Read the native API and docs at the pinned tags: the package adds no push logic.
2. Map the native symbols in `tool/api-parity/mapping.json`.
3. Add the method or event to `src/internal/native.ts`, its Jest mock in `src/internal/__mocks__/native.ts`, and both
   native layers' `NativeSallaPush` seams and their test fakes.
4. Add the native methods, with their tests: in Swift, an `@objc func` and its `pluginMethods` entry; in Kotlin, a
   `@PluginMethod` function. A new XCTest file goes into the `AppTests` target.
5. Add the TypeScript API, in `src/definitions.ts` and the namespace files, with its Jest tests.
6. Run `node scripts/dump-api.mjs --write`, and update the README and the reference.

## What needs care

- **The router branch.** SallaPush's iOS notification-center delegate repeats the rule of Capacitor's
  `NotificationRouter`. The `build` step fails when `@capacitor/ios` changes it: update the delegate, its tests and
  `ROUTER_LINES` in `scripts/verify.sh`.
- **One `@objc(` name.** `@objc(SallaPushPlugin)` is the only explicit Objective-C name in `ios/Sources/`; every other
  class uses a bare `@objc`. Plugin methods never take the names of Capacitor's own plugin members, such as
  `addListener` or `checkPermissions`.
- **Threads.** On iOS every plugin method works on the main thread, in call order. On Android native calls run on
  Capacitor's plugin thread, and registry work on the main thread.
- **Page loads.** Capacitor calls `removeAllListeners` at every page load: the plugin stops every native registration
  then, and keeps working for the new page.
- **The docs' code blocks** are copies of code the checks build, each after a hidden
  `<!-- snippet:<source>#<region> -->` marker. Change the source first;
  `node scripts/check-readme-snippets.mjs --print <source>[#<region>]` prints what a block must hold.
- **The native pins** are listed once, in `SP_PINS` of `scripts/common.sh`, which `bump-native.sh` sets and `pins`
  checks.
- **Nothing builds at install time.** The package has no install scripts; only `prepack` builds `dist/`.
