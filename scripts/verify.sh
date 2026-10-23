#!/usr/bin/env bash
# The full verification of the SallaPush Capacitor SDK. A pull request's Native verified check waits for a person's
# attestation of a full run at its head commit (scripts/verified-label.sh).
#
#   scripts/verify.sh [step...]    run from anywhere; without steps, every step in order, stopping at the first failure
#
# CI runs the portable steps (PORTABLE_STEPS) on Linux. The others need macOS with Xcode 26, JDK 21 and the Android
# SDK:
#   swiftlint   SwiftLint 0.63.2, strict
#   android     the plugin's unit tests and lint, a minified release build of the example, and its merged manifest
#   ios         the example's release build with its Notification Service Extension, then its XCTest suite
#   smoke       the example's self-test on a booted iOS simulator and a running Android emulator: a test push, a page
#               reload, and a second test push that the reloaded page's listener gets once
#   consumer    fresh Capacitor apps that install a dry run of the release with only what the README and the setup
#               guide show: the package as npm would publish it, with Swift Package Manager and with CocoaPods and
#               @capacitor/push-notifications; from git, the oldest Capacitor 8 with the storyboard template with npm,
#               and a Yarn install
#
# A run that starts on a clean tree must end on one: the runner fails, naming the paths, when a step leaves a file that
# the ignore files don't cover.
#
# Environment: VERIFY_LOG_DIR (a <step>.log per step and summary.tsv, whose first line and rows name the commit, +dirty
# for a tree with changes; a folder for each commit, as runs of another commit are refused), VERIFY_SIMULATOR_UDID,
# VERIFY_EMULATOR_SERIAL, VERIFY_IOS_SDK_CHECKOUT (optional: a clean clone of SallaApp/sallapush-ios-sdk at the pinned
# tag, in a folder named sallapush-ios-sdk; every Swift Package Manager build then uses it instead of the remote
# package, and the summary of each such step says so), YARN, SHELLCHECK, SWIFTLINT, ANDROID_HOME, SALLAPUSH_JAVA_HOME.
set -euo pipefail

readonly STEPS="lint typecheck test build pack api parity snippets pins tree shell swiftlint android ios smoke consumer"
readonly PORTABLE_STEPS="lint typecheck test build pack api parity snippets pins tree shell"

scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(cd "$scripts/.." && pwd -P)"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=common.sh
. "$scripts/common.sh"

work="$(mktemp -d "${TMPDIR:-/tmp}/sallapush-verify.XXXXXX")"
trap 'rm -rf "$work"' EXIT
trap 'exit 130' INT TERM

fail() {
  printf 'verify.sh: %s\n' "$*" >&2
  exit 1
}

usage() {
  echo "usage: scripts/verify.sh [step...]   steps: $STEPS (CI runs $PORTABLE_STEPS)" >&2
  exit 2
}

require_macos() {
  [ "$(uname -s)" = Darwin ] || fail "this step needs macOS with Xcode"
}

# note <text>: added to the step's result in summary.tsv.
note() {
  printf '%s\n' "$*" >>"$work/note"
}

# on_exit <command>: runs the command when the step ends, whether it passes or fails, after those added later. Each
# step runs in a subshell of its own, so its exit actions run when the step ends.
exit_actions=""
on_exit() {
  exit_actions="$1${exit_actions:+; $exit_actions}"
  # shellcheck disable=SC2064 # the actions are fixed when they are added
  trap "$exit_actions" EXIT
}

# ---------------------------------------------------------------------------------------------------------------------
# Portable steps

step_lint() { (cd "$root" && sp_yarn lint); }

step_typecheck() { (cd "$root" && sp_yarn typecheck); }

step_test() {
  local tests
  (cd "$root" && sp_yarn test --coverage)
  (cd "$root" && sp_yarn test:scripts) | tee "$work/scripts.tap"
  tests="$(sed -nE 's/^# tests ([0-9]+)$/\1/p' "$work/scripts.tap" | tail -n 1)"
  [ "${tests:-0}" -gt 0 ] || fail "yarn test:scripts ran no tests"
  echo "yarn test:scripts: $tests tests"
}

# What SallaPushCapacitorNotificationCenterDelegate repeats of Capacitor's NotificationRouter: for a notification that
# isn't SallaPush's, the router's push or local handler slot by the trigger, and their options or none.
readonly ROUTER_LINES=(
  "if notification.request.trigger?.isKind(of: UNPushNotificationTrigger.self) == true {"
  "presentationOptions = pushNotificationHandler?.willPresent(notification: notification)"
  "presentationOptions = localNotificationHandler?.willPresent(notification: notification)"
  "completionHandler(presentationOptions ?? [])"
  "if response.notification.request.trigger?.isKind(of: UNPushNotificationTrigger.self) == true {"
  "pushNotificationHandler?.didReceive(response: response)"
  "localNotificationHandler?.didReceive(response: response)"
)

step_build() {
  local file router="node_modules/@capacitor/ios/Capacitor/Capacitor/NotificationRouter.swift" line version
  (cd "$root" && sp_yarn build)
  for file in dist/esm/index.js dist/esm/index.d.ts dist/plugin.cjs.js dist/plugin.js; do
    [ -f "$root/$file" ] || fail "yarn build made no $file"
  done
  (cd "$root" && node -e '
const { SallaPush, SallaPushLogLevel } = require("./dist/plugin.cjs.js");
const problems = [];
if (typeof SallaPush.initialize !== "function") problems.push("SallaPush.initialize is not a function");
if (typeof SallaPush.Notifications.addEventListener !== "function") {
  problems.push("SallaPush.Notifications.addEventListener is not a function");
}
if (SallaPushLogLevel.Warn !== "warn") problems.push("SallaPushLogLevel.Warn is not \"warn\"");
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
') || fail "dist/plugin.cjs.js does not export the API"
  echo "dist/plugin.cjs.js loads: SallaPush.initialize and SallaPush.Notifications.addEventListener are functions," \
    "SallaPushLogLevel.Warn is 'warn'"
  # The router tripwire: Capacitor's rule, which the delegate repeats, must not have changed.
  [ -f "$root/$router" ] || fail "$router is missing: run yarn install"
  for line in "${ROUTER_LINES[@]}"; do
    grep -qF -- "$line" "$root/$router" ||
      fail "Capacitor's NotificationRouter changed: check SallaPushCapacitorNotificationCenterDelegate's router branch" \
        "(ios/Sources/SallaPushCapacitorPlugin/NotificationCenterDelegate.swift); $router no longer holds: $line"
  done
  version="$(node -p 'require(process.argv[1]).version' "$root/node_modules/@capacitor/ios/package.json")"
  echo "@capacitor/ios $version: NotificationRouter still holds the ${#ROUTER_LINES[@]} lines the delegate's router branch repeats"
}

# What npm would publish: npm pack --dry-run, whose prepack builds dist/ afresh. The package holds the built library,
# every native source, Package.swift, the podspec, LICENSE, README.md and package.json, and nothing else: no test, mock
# or dotfile. package.json isn't private, and publishes with public access, which a scoped package needs.
step_pack() {
  (cd "$root" && npm pack --dry-run --json) >"$work/pack.json" || fail "npm pack --dry-run failed"
  git -C "$root" ls-files --cached --others --exclude-standard -- ios/Sources android/src/main >"$work/native-files"
  python3 - "$work/pack.json" "$work/native-files" "$root/package.json" <<'PY'
import json, re, sys

listing, native, manifest = sys.argv[1:4]
with open(listing, encoding="utf-8") as handle:
    packed = [entry["path"] for entry in json.load(handle)[0]["files"]]
with open(manifest, encoding="utf-8") as handle:
    package = json.load(handle)
allowed = re.compile(r"^(?:dist/.+|android/src/main/.+|ios/Sources/.+|android/build\.gradle|android/consumer-rules\.pro|"
                     r"Package\.swift|Salla\.saSallapushCapacitor\.podspec|LICENSE|README\.md|package\.json)$")
refused = re.compile(r"(?:^|/)(?:__tests__|__mocks__|\.[^/]+)(?:/|$)")
needed = ["dist/esm/index.js", "dist/esm/index.d.ts", "dist/plugin.cjs.js", "dist/plugin.js", "Package.swift",
          "Salla.saSallapushCapacitor.podspec", "android/build.gradle", "android/consumer-rules.pro", "LICENSE",
          "README.md", "package.json"]
with open(native, encoding="utf-8") as handle:
    needed += [line.strip() for line in handle if line.strip()]
problems = [f"npm would publish {name}, which isn't part of the package" for name in packed
            if not allowed.match(name) or refused.search(name)]
problems += [f"npm would not publish {name}" for name in needed if name not in packed]
if package.get("private"):
    problems.append("package.json is private, so npm refuses to publish it")
if (package.get("publishConfig") or {}).get("access") != "public":
    problems.append("package.json's publishConfig.access is not \"public\": npm would publish the scoped package as "
                    "restricted")
for problem in problems:
    print(problem)
if problems:
    sys.exit(f"verify.sh: npm pack --dry-run: {len(problems)} problem(s)")
print(f"npm pack --dry-run: {len(packed)} files, the built library, the native sources, Package.swift, the podspec, "
      "LICENSE, README.md and package.json, and no test, mock or dotfile; package.json publishes with public access")
PY
}

step_api() {
  node "$scripts/dump-api.mjs" --check
  node "$scripts/check-plugin-methods.mjs"
}

step_parity() { node "$scripts/check-api-parity.mjs"; }

step_snippets() { node "$scripts/check-readme-snippets.mjs"; }

step_pins() { "$scripts/bump-native.sh" --check; }

# The files a build, the checks and a release need, the docs, and the scripts CI and the docs run directly.
readonly REQUIRED_FILES=".gitignore .nvmrc .yarnrc.yml .yarn/releases/yarn-4.11.0.cjs .swiftlint.yml package.json
yarn.lock README.md CHANGELOG.md CONTRIBUTING.md RELEASING.md docs/SETUP.md docs/REFERENCE.md docs/TROUBLESHOOTING.md
LICENSE Package.swift Salla.saSallapushCapacitor.podspec rollup.config.mjs tsconfig.json tsconfig.build.json
android/build.gradle android/src/main/AndroidManifest.xml src/index.ts src/internal/native.ts .github/workflows/ci.yml
api/sallapush-capacitor.api tool/api-parity/native-ios-API.txt
tool/api-parity/native-android-sallapush.api tool/api-parity/mapping.json
example-app/ios/App/App.xcodeproj/project.pbxproj example-app/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme
example-app/ios/TestPayloads/native.apns example-app/android/TestPayloads/native.json docs/snippets/Podfile
docs/snippets/CapacitorPushAppDelegate.swift docs/snippets/SallaPushMessagingService.java
docs/snippets/AndroidManifest-forwarding.xml docs/snippets/app-build.gradle scripts/common.sh scripts/dump-api.mjs
scripts/check-api-parity.mjs scripts/check-plugin-methods.mjs scripts/check-readme-snippets.mjs
scripts/add-nse-target.rb"
readonly EXECUTABLE_FILES="scripts/verify.sh scripts/bump-native.sh scripts/release-dist.sh scripts/verified-label.sh
scripts/self-test.sh"

# What a commit takes, tracked or untracked and not ignored: no credential file, no secret, personal path, Apple team id or
# ticket key in any file, every workflow action pinned to a commit, every required file present, every script executable,
# and every Swift file of the example in a target of its Xcode project.
step_tree() {
  git -C "$root" ls-files -z --cached --others --exclude-standard >"$work/files" ||
    fail "cannot list the files of $root; run the verification in a clone of the repository"
  git -C "$root" ls-files -z --stage >"$work/staged"
  python3 - "$root" "$work/files" "$work/staged" "$REQUIRED_FILES" "$EXECUTABLE_FILES" <<'PY'
import os, re, sys

root, listing, staged, required, executable = sys.argv[1:6]
with open(listing, "rb") as handle:
    files = [name.decode() for name in handle.read().split(b"\0") if name]
modes = {}
with open(staged, "rb") as handle:
    for entry in handle.read().split(b"\0"):
        if entry:
            meta, name = entry.decode().split("\t", 1)
            modes[name] = meta.split(" ")[0]
problems = []
credential = re.compile(
    r"^(google-services\.json|googleservice-info\.plist|local\.properties|key\.properties|service-account.*\.json|"
    r"\.env.*|.*\.(p8|p12|jks|keystore|mobileprovision|cer))$",
    re.IGNORECASE,
)
# The native repositories' token and key patterns, and this repository's own; the text patterns skip binary files. Each
# pattern is written so that this file's own text never matches it.
revoke = "remove it, and revoke it if it was ever pushed"
secrets = (
    (re.compile(rb"(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{36}(?![A-Za-z0-9_])"), "a GitHub token", revoke),
    (re.compile(rb"(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}(?![A-Za-z0-9_])"), "a GitHub token", revoke),
    (re.compile(rb"-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY(?: BLOCK)?-----"), "a private key", revoke),
    (re.compile(rb"---- BEGIN SSH2 ENCRYPTED " + rb"PRIVATE KEY ----"), "a private key", revoke),
    (re.compile(rb"PuTTY-User-Key-File-[0-9]+: "), "a private key", revoke),
    (re.compile(rb"x-access" + rb"-token:[^$]"), "a token in a git URL", revoke),
    (re.compile(rb"/Us" + rb"ers/"), "a personal home path", "use $HOME"),
)
texts = (
    (re.compile(rb"(?:DEVELOPMENT_TEA" + rb"M|DevelopmentTea" + rb"m) = [A-Z0-9]{10}(?![A-Za-z0-9_])"), "an Apple team id",
     "set DEVELOPMENT_TEAM in the ignored example-app/ios/App/Config/SallaPush.local.xcconfig instead"),
    (re.compile(rb"\b(?:T" + rb"D|S" + rb"P|R" + rb"I|SA" + rb"L|S40" + rb"D)-[0-9]+\b"), "a ticket key",
     "say what the change is instead: the code and docs are written for readers outside the organization"),
)
for name in files:
    path = os.path.join(root, name)
    if credential.match(os.path.basename(name)):
        problems.append(f"{name}: a file of credentials or signing material; never commit it")
    if not os.path.isfile(path):
        continue
    with open(path, "rb") as handle:
        data = handle.read()
    for pattern, what, fix in secrets + (texts if b"\0" not in data else ()):
        if pattern.search(data):
            problems.append(f"{name}: holds {what}; {fix}")
# The example's Swift files: Xcode compiles only those that the project lists, each in a target's Sources.
project = os.path.join(root, "example-app/ios/App/App.xcodeproj/project.pbxproj")
if os.path.isfile(project):
    with open(project, encoding="utf-8") as handle:
        sources = handle.read()
    for name in files:
        if re.match(r"^example-app/ios/App/(App|AppTests|SallaPushNotificationService)/[^/]+\.swift$", name) \
                and f"/* {os.path.basename(name)} in Sources */" not in sources:
            problems.append(f"{name} is in no Sources phase of example-app/ios/App/App.xcodeproj, so it is never "
                            "compiled: add it to its target")
uses = re.compile(r"^\s*(?:-\s+)?uses:\s*(['\"]?)([^\s'\"#]+)\1\s*(?:#.*)?$")
pinned = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[^@\s]+)?@[0-9a-f]{40}$")
allowed = re.compile(r"^(SallaApp/\.CI/[A-Za-z0-9_./-]+@master|\./\.github/[A-Za-z0-9_./-]+)$")
for name in files:
    if re.match(r"^\.github/workflows/[^/]+\.ya?ml$", name) and os.path.isfile(os.path.join(root, name)):
        with open(os.path.join(root, name), encoding="utf-8") as handle:
            for number, line in enumerate(handle, 1):
                match = uses.match(line)
                if match and not (pinned.match(match.group(2)) or allowed.match(match.group(2))):
                    problems.append(f"{name}:{number}: uses {match.group(2)}; pin it to a full commit id (owner/repo@<40 hex> # vX.Y.Z)")
listed = set(files)
for name in required.split() + executable.split():
    if name not in listed:
        problems.append(f"{name} is missing from what a commit takes (absent, or ignored by .gitignore)")
for name in executable.split():
    path = os.path.join(root, name)
    if name in listed and not os.access(path, os.X_OK):
        problems.append(f"{name} is not executable (chmod +x {name})")
    if modes.get(name, "100755") != "100755":
        problems.append(f"{name} is staged with mode {modes[name]}; stage it as executable (git update-index --chmod=+x {name})")
for problem in problems:
    print(problem)
if problems:
    sys.exit(f"verify.sh: {len(problems)} problem(s) in what a commit takes")
print(f"{len(files)} files: no credential, secret, personal path, team id or ticket key; every action pinned; every required file present; every script executable; every Swift file of the example compiled")
PY
}

step_shell() {
  local script shellcheck="${SHELLCHECK:-shellcheck}"
  for script in "$scripts"/*.sh; do
    bash -n "$script" || fail "${script#"$root"/} does not parse (bash -n)"
  done
  echo "bash -n: every script parses"
  if command -v "$shellcheck" >/dev/null 2>&1 &&
    "$shellcheck" --version | grep -qx "version: $SP_SHELLCHECK_VERSION"; then
    (cd "$root" && "$shellcheck" -x -S style scripts/*.sh)
  elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    (cd "$root" && docker run --rm -v "$root:/mnt:ro" -w /mnt "$SP_SHELLCHECK_IMAGE" -x -S style scripts/*.sh)
  else
    fail "shellcheck $SP_SHELLCHECK_VERSION was not found: install it or set SHELLCHECK, or run Docker for $SP_SHELLCHECK_IMAGE"
  fi
  echo "shellcheck $SP_SHELLCHECK_VERSION: no findings"
  "$scripts/self-test.sh"
}

# ---------------------------------------------------------------------------------------------------------------------
# Native steps

step_swiftlint() {
  local swiftlint="${SWIFTLINT:-swiftlint}" version
  command -v "$swiftlint" >/dev/null 2>&1 ||
    fail "SwiftLint is not installed: install $SP_SWIFTLINT_VERSION, or set SWIFTLINT"
  version="$("$swiftlint" version)"
  [ "$version" = "$SP_SWIFTLINT_VERSION" ] ||
    fail "SwiftLint $version found; the rules are pinned to $SP_SWIFTLINT_VERSION (set SWIFTLINT)"
  (cd "$root" && "$swiftlint" lint --strict --quiet --config .swiftlint.yml)
  echo "SwiftLint $version: no violations"
}

# example_sync <ios|android>: the example's web build and npx cap sync, which must leave every committed file of the
# platform as it is and write nothing that the ignore files don't cover: the committed CapApp-SPM/Package.swift,
# capacitor.settings.gradle and app/capacitor.build.gradle are what the CLI writes.
example_sync() {
  local platform="$1" changes
  (cd "$root" && sp_yarn workspace @salla.sa/sallapush-capacitor-example build)
  (cd "$root/example-app" && npx --no-install cap sync "$platform")
  changes="$(git -C "$root" status --porcelain -- "example-app/$platform")"
  [ -z "$changes" ] || fail "npx cap sync $platform changed or added these files of the example, which must be" \
    "committed as the CLI writes them or ignored: $(printf '%s\n' "$changes" | cut -c 4- | tr '\n' ' ')"
  echo "npx cap sync $platform left every committed file of example-app/$platform as it is"
}

# keep_example_project: restores the example's Xcode project when the step ends, as local_ios_sdk changes it.
keep_example_project() {
  local project="$root/example-app/ios/App/App.xcodeproj/project.pbxproj"
  cp -p "$project" "$work/example.pbxproj"
  on_exit "cp -p '$work/example.pbxproj' '$project'"
}

# local_ios_sdk <app>/ios/App: with VERIFY_IOS_SDK_CHECKOUT, a clean checkout of the pinned tag (sp_ios_sdk_checkout),
# adds that local package to the app's Xcode project, so that it replaces the remote sallapush-ios-sdk package; does
# nothing without it.
local_ios_sdk() {
  local ios="$1" checkout pin
  [ -n "${VERIFY_IOS_SDK_CHECKOUT:-}" ] || return 0
  pin="$(sp_pins "$root" current ios)" || fail "the iOS pins name no version"
  checkout="$(sp_ios_sdk_checkout "$pin")" || fail "VERIFY_IOS_SDK_CHECKOUT can't replace SallaPush iOS $pin"
  python3 - "$ios/App.xcodeproj/project.pbxproj" "$checkout" <<'PY'
import re, sys

path, checkout = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
reference = "5A11A9000000000000000001"
if reference not in text:
    group = re.search(r"mainGroup = ([0-9A-F]{24})", text)
    children = group and re.search(re.escape(group.group(1)) + r"(?: /\*[^*]*\*/)? = \{\s*isa = PBXGroup;\s*children = \(\n",
                                    text)
    anchor = "/* End PBXFileReference section */"
    if not children or anchor not in text:
        sys.exit(f"cannot find the main group of {path}")
    text = (text[:children.end()] + f"\t\t\t\t{reference} /* sallapush-ios-sdk */,\n" + text[children.end():])
    text = text.replace(anchor, f'\t\t{reference} /* sallapush-ios-sdk */ = {{isa = PBXFileReference; lastKnownFileType = '
                                f'wrapper; name = "sallapush-ios-sdk"; path = "{checkout}"; sourceTree = "<absolute>"; }};\n'
                                + anchor, 1)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)
PY
  echo "Swift Package Manager builds use SallaPush iOS $pin from $checkout: the tag $pin, commit" \
    "$(git -C "$checkout" rev-parse HEAD), with no changes (VERIFY_IOS_SDK_CHECKOUT)"
  note "SallaPush iOS from a clean checkout of its tag"
}

# Asserts on an APK's manifest: SallaPush's init provider at initOrder -1, after Firebase's and androidx.startup's
# providers (higher values run first), and SallaPush's FCM service at priority -450. With a service class, also that
# app's forwarding service at priority 1, which outranks the FCM services of other plugins (0).
assert_manifest() {
  local apk="$1" forwarding="${2:-}" aapt2
  aapt2="$(find "$ANDROID_HOME/build-tools" -maxdepth 2 -name aapt2 -type f | sort | tail -n 1)"
  [ -n "$aapt2" ] || fail "aapt2 was not found under $ANDROID_HOME/build-tools"
  "$aapt2" dump xmltree --file AndroidManifest.xml "$apk" >"$work/manifest.txt"
  python3 - "$work/manifest.txt" "$forwarding" <<'PY'
import re, sys

nodes, stack = [], []
for line in open(sys.argv[1], encoding="utf-8"):
    indent = len(line) - len(line.lstrip())
    element = re.match(r"\s*E: ([\w.-]+)", line)
    attribute = re.match(r"\s*A: (?:http://schemas\.android\.com/apk/res/android:)?([\w]+)(?:\(0x[0-9a-f]+\))?=(.*)$", line)
    if element:
        while stack and stack[-1]["indent"] >= indent:
            stack.pop()
        node = {"tag": element.group(1), "indent": indent, "attributes": {}, "parent": stack[-1] if stack else None}
        nodes.append(node)
        stack.append(node)
    elif attribute and stack:
        value = attribute.group(2).strip()
        quoted = re.match(r'^"((?:[^"\\]|\\.)*)"', value)
        stack[-1]["attributes"][attribute.group(1)] = quoted.group(1) if quoted else value.split(" ")[0]

def named(tag, name):
    return [node for node in nodes if node["tag"] == tag and node["attributes"].get("name") == name]

def init_order(node):
    return int(node["attributes"].get("initOrder", "0"), 0)

def priorities(service):
    filters = [node for node in nodes if node["tag"] == "intent-filter" and node["parent"] in service]
    return sorted(int(node["attributes"].get("priority", "0"), 0) for node in filters)

problems = []
provider = named("provider", "sa.salla.sallapush.capacitor.SallaPushInitProvider")
if len(provider) != 1:
    sys.exit("the manifest must hold SallaPushInitProvider once")
ours = init_order(provider[0])
if ours != -1:
    problems.append(f"SallaPushInitProvider has initOrder {ours}, not -1")
for name in ("com.google.firebase.provider.FirebaseInitProvider", "androidx.startup.InitializationProvider"):
    for node in named("provider", name):
        if init_order(node) <= ours:
            problems.append(f"{name} (initOrder {init_order(node)}) must run before SallaPushInitProvider")
        print(f"{name}: initOrder {init_order(node)}")
service = priorities(named("service", "com.salla.push.SallaPushFirebaseMessagingService"))
if service != [-450]:
    problems.append(f"SallaPush's FCM service has the intent-filter priorities {service}, not [-450]")
forwarding = sys.argv[2]
if forwarding:
    found = priorities(named("service", forwarding))
    if found != [1]:
        problems.append(f"the forwarding service {forwarding} has the intent-filter priorities {found}, not [1]")
    else:
        print(f"{forwarding}: priority 1")
for problem in problems:
    print(problem)
if problems:
    sys.exit("the merged manifest is not the one SallaPush needs")
print(f"SallaPushInitProvider: initOrder {ours}; SallaPushFirebaseMessagingService: priority {service[0]}")
PY
}

step_android() {
  local apk
  sp_android_env || fail "the Android setup is incomplete"
  example_sync android
  (cd "$root/example-app/android" && ./gradlew --quiet :salla.sa-sallapush-capacitor:testDebugUnitTest \
    :salla.sa-sallapush-capacitor:lintDebug assembleRelease)
  assert_tests_ran "$root/android/build/test-results/testDebugUnitTest"
  apk="$root/example-app/android/app/build/outputs/apk/release/app-release.apk"
  [ -f "$apk" ] || fail "assembleRelease made no $apk"
  assert_manifest "$apk"
}

# example_build <name> <configuration> [settings...]: the example's build for the simulator, into $work/derived-<name>.
example_build() {
  local name="$1" configuration="$2"
  shift 2
  (cd "$root/example-app/ios/App" && xcodebuild -quiet -project App.xcodeproj -scheme "$SP_EXAMPLE" \
    -configuration "$configuration" -sdk iphonesimulator -destination "id=$udid" \
    -derivedDataPath "$work/derived-$name" -scmProvider system "$@" build) || fail "the $name build of the example failed"
  [ -d "$work/derived-$name/Build/Products/$configuration-iphonesimulator/$SP_EXAMPLE.app/PlugIns/SallaPushNotificationService.appex" ] ||
    fail "the $name build of the example does not embed SallaPushNotificationService.appex"
  echo "$name: $configuration build succeeded, with SallaPushNotificationService.appex embedded"
}

step_ios() {
  local picked
  require_macos
  picked="$(sp_simulator "$work")" || fail "no simulator to build for"
  udid="${picked%%$'\t'*}"
  echo "simulator ${picked#*$'\t'} $udid"
  example_sync ios
  keep_example_project
  local_ios_sdk "$root/example-app/ios/App"
  example_build ios Release
  # Serially, on the chosen simulator: parallel testing would make Xcode clone it.
  (cd "$root/example-app/ios/App" && xcodebuild -quiet test -project App.xcodeproj -scheme "$SP_EXAMPLE" \
    -configuration Debug -destination "id=$udid" -derivedDataPath "$work/derived-ios" -scmProvider system \
    -parallel-testing-enabled NO -only-testing:AppTests -resultBundlePath "$work/AppTests.xcresult") ||
    fail "the example's XCTest suite failed"
  rm -rf "$work/derived-ios"
  assert_xctests_ran "$work/AppTests.xcresult" || fail "AppTests ran no test"
  echo "AppTests passed"
}

# marker_value <log> <marker> [<after>]: prints the JSON after "<marker> " in the first line of <log> that holds it,
# among the lines after the first line that holds "<after> {" when <after> is given; fails while there is none.
marker_value() {
  python3 - "$@" <<'PY'
import json, sys

log, marker = sys.argv[1], sys.argv[2]
after = sys.argv[3] if len(sys.argv) > 3 else None
with open(log, encoding="utf-8", errors="replace") as handle:
    lines = handle.readlines()
if after:
    starts = [index for index, line in enumerate(lines) if after + " {" in line]
    lines = lines[starts[0] + 1:] if starts else []
for line in lines:
    start = line.find(marker + " {")
    if start >= 0:
        value, _ = json.JSONDecoder().raw_decode(line[start + len(marker) + 1:])
        print(json.dumps(value))
        sys.exit(0)
sys.exit(1)
PY
}

# marker_count <log> <marker> <after>: how many lines hold "<marker> {" after the first line that holds "<after> {".
marker_count() {
  python3 - "$@" <<'PY'
import sys

log, marker, after = sys.argv[1:4]
with open(log, encoding="utf-8", errors="replace") as handle:
    lines = handle.readlines()
starts = [index for index, line in enumerate(lines) if after + " {" in line]
print(sum(1 for line in lines[starts[0] + 1:] if marker + " {" in line) if starts else 0)
PY
}

# await_marker <log> <marker> <seconds> [<after>]: marker_value, once a second until it finds the line; a marker counts
# wherever it is in the stream, as lines arrive close together. $refresh, when set, names a function that rewrites <log>
# before each look.
await_marker() {
  local log="$1" marker="$2" seconds="$3" after="${4:-}" waited=0
  while [ "$waited" -lt "$seconds" ]; do
    [ -z "${refresh:-}" ] || "$refresh"
    if marker_value "$log" "$marker" ${after:+"$after"}; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

# Fails unless the self-test passed; prints "waiting" when it awaits the test push, else why it skipped it.
selftest_result() {
  python3 - "$1" <<'PY'
import json, sys
result = json.loads(sys.argv[1])
if result.get("failed") != 0 or not result.get("passed"):
    print(f"self-test: {result.get('passed')} passed, {result.get('failed')} failed: {result.get('failures')}", file=sys.stderr)
    sys.exit(1)
skipped = "; ".join(result.get("skipped") or [])
print(f"self-test: {result['passed']} passed, 0 failed{'; skipped: ' + skipped if skipped else ''}", file=sys.stderr)
print(result.get("willDisplay", "skipped: no will-display result"))
PY
}

# Fails unless the reloaded page's probe passed; prints "waiting" when it awaits the second test push, else why not.
reload_result() {
  python3 - "$1" <<'PY'
import json, sys
result = json.loads(sys.argv[1])
if result.get("ok") is not True:
    print(f"reload: {result.get('failures')}", file=sys.stderr)
    sys.exit(1)
print("reload: the reloaded page's calls work", file=sys.stderr)
print(result.get("willDisplay", "skipped: no will-display result"))
PY
}

will_display_result() {
  python3 - "$1" <<'PY'
import json, sys
result = json.loads(sys.argv[1])
if result.get("ok") is not True:
    sys.exit("will-display: " + json.dumps(result.get("failures")))
PY
}

# stop_streams: ends the log streams that log_stream started.
stop_streams() {
  local stream
  for stream in ${streams:-}; do
    kill "$stream" 2>/dev/null || true
  done
  streams=""
}

# Ends the log streams, and removes the smoke apps from the simulator and the emulator.
smoke_cleanup() {
  stop_streams
  if [ -n "${udid:-}" ]; then
    xcrun simctl terminate "$udid" "$SP_EXAMPLE_ID" >/dev/null 2>&1 || true
    xcrun simctl uninstall "$udid" "$SP_EXAMPLE_ID" >/dev/null 2>&1 || true
  fi
  if [ -n "${serial:-}" ]; then
    "$ADB" -s "$serial" uninstall "$SP_EXAMPLE_ID" >/dev/null 2>&1 || true
  fi
}

# log_stream <predicate> <log>: the simulator's unified log lines that match, from now on, until smoke_cleanup.
log_stream() {
  xcrun simctl spawn "$udid" log stream --level info --style compact --predicate "$1" >"$2" 2>&1 &
  streams="${streams:-} $!"
}

# wrapper_problems <log>: fails, printing them, when the plugin logged an error, or one of the first-activation check's
# lines that say SallaPush's delegate was not installed or was replaced. Compact lines give the type second: E or F.
wrapper_problems() {
  python3 - "$1" <<'PY'
import re, sys
found = [line.rstrip("\n") for line in open(sys.argv[1], encoding="utf-8", errors="replace")
         if re.match(r"^\S+ \S+ +(E|F) ", line) or "was not called" in line
         or "replaced SallaPush's notification-center delegate" in line]
if found:
    print("\n".join(found))
    sys.exit(1)
PY
}

# await_text <log> <text> <seconds>: waits until a line of <log> holds <text>, and prints it.
await_text() {
  local waited=0
  until grep -F -- "$2" "$1"; do
    [ "$waited" -lt "$3" ] || return 1
    sleep 1
    waited=$((waited + 1))
  done
}

smoke_ios() {
  local picked app log wrapper result display reload count
  picked="$(sp_simulator "$work")" || fail "no simulator to run on"
  udid="${picked%%$'\t'*}"
  echo "simulator ${picked#*$'\t'} $udid"
  xcrun simctl bootstatus "$udid" -b >/dev/null
  example_sync ios
  keep_example_project
  local_ios_sdk "$root/example-app/ios/App"
  # The example's own bundle id, whatever SallaPush.local.xcconfig sets: every call below names it. The push service is
  # a closed port of the Mac, so no request leaves it.
  example_build smoke Release SALLAPUSH_APP_ID=example_smoke \
    SALLAPUSH_API_BASE_URL=http://localhost:9/notifications/v1/sallapush SALLAPUSH_EXAMPLE_BUNDLE_ID="$SP_EXAMPLE_ID"
  app="$work/derived-smoke/Build/Products/Release-iphonesimulator/$SP_EXAMPLE.app"
  xcrun simctl terminate "$udid" "$SP_EXAMPLE_ID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$udid" "$SP_EXAMPLE_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$udid" "$app"
  rm -rf "$work/derived-smoke"
  if command -v applesimutils >/dev/null 2>&1; then
    applesimutils --byId "$udid" --bundle "$SP_EXAMPLE_ID" --setPermissions notifications=YES >/dev/null
    echo "iOS: applesimutils granted notifications"
  fi
  log="$work/smoke-ios.log"
  wrapper="$work/smoke-ios-wrapper.log"
  log_stream "subsystem == \"$SP_EXAMPLE_ID\" AND category == \"smoke\"" "$log"
  log_stream 'subsystem == "com.salla.push" AND category == "wrapper"' "$wrapper"
  sleep 2
  xcrun simctl launch "$udid" "$SP_EXAMPLE_ID" >/dev/null
  result="$(await_marker "$log" SALLAPUSH_SELFTEST 120)" || fail "iOS: no SALLAPUSH_SELFTEST line within 120 s"
  display="$(selftest_result "$result")" || fail "iOS: the self-test failed"
  # start() ran before Capacitor's bridge, and the plugin took the delegate back from Capacitor's router.
  await_text "$wrapper" "Capacitor's notification router." 30 ||
    fail "iOS: no first-activation line naming Capacitor's notification router within 30 s"
  wrapper_problems "$wrapper" || fail "iOS: the plugin logged an error (above)"
  if [ "$display" = waiting ]; then
    xcrun simctl push "$udid" "$SP_EXAMPLE_ID" "$root/example-app/ios/TestPayloads/native.apns" >/dev/null
    result="$(await_marker "$log" SALLAPUSH_SELFTEST_WILL_DISPLAY 60)" ||
      fail "iOS: no SALLAPUSH_SELFTEST_WILL_DISPLAY line within 60 s of the test push"
    will_display_result "$result" || fail "iOS: the foreground notification differs from the test push"
    echo "iOS: the test push reached the will-display listener with the payload's values"
  else
    echo "iOS: will-display SKIPPED ($display)"
    note "iOS will-display SKIPPED ($display)"
  fi
  # The reload probe: Capacitor's listener reset (a nil call into the plugin's override), and the new page's calls.
  result="$(await_marker "$log" SALLAPUSH_SELFTEST_RELOAD 60)" || fail "iOS: no SALLAPUSH_SELFTEST_RELOAD line within 60 s"
  reload="$(reload_result "$result")" || fail "iOS: the reloaded page's probe failed"
  if [ "$reload" = waiting ]; then
    xcrun simctl push "$udid" "$SP_EXAMPLE_ID" "$root/example-app/ios/TestPayloads/native.apns" >/dev/null
    result="$(await_marker "$log" SALLAPUSH_SELFTEST_WILL_DISPLAY 60 SALLAPUSH_SELFTEST_RELOAD)" ||
      fail "iOS: no SALLAPUSH_SELFTEST_WILL_DISPLAY line after the reload within 60 s of the second test push"
    will_display_result "$result" || fail "iOS: the second foreground notification differs from the test push"
    sleep 5
    count="$(marker_count "$log" SALLAPUSH_SELFTEST_WILL_DISPLAY SALLAPUSH_SELFTEST_RELOAD)"
    [ "$count" = 1 ] || fail "iOS: $count SALLAPUSH_SELFTEST_WILL_DISPLAY lines after the reload, not 1"
    echo "iOS: after the reload, the second test push reached the new page's listener once"
  else
    echo "iOS: will-display after the reload SKIPPED ($reload)"
    note "iOS will-display after the reload SKIPPED ($reload)"
  fi
  wrapper_problems "$wrapper" || fail "iOS: the plugin logged an error (above)"
  smoke_cleanup
  udid=""
}

# Rewrites the Android smoke log: the example's SallaPushSmoke lines since its launch.
android_smoke_log() {
  "$ADB" -s "$serial" logcat -d --pid="$pid" -s SallaPushSmoke:I >"$work/smoke-android.log" || true
}

# Broadcasts the test push to the example's TestPushReceiver, which hands it to SallaPush as FCM would.
android_test_push() {
  "$ADB" -s "$serial" shell am broadcast -n "$SP_EXAMPLE_ID/$SP_EXAMPLE_ID.TestPushReceiver" \
    --es payload "'$(tr -d '\n' <"$root/example-app/android/TestPayloads/native.json")'" >/dev/null
}

smoke_android() {
  local apk log result display reload count waited=0
  sp_android_env || fail "the Android setup is incomplete"
  serial="$(sp_emulator)" || fail "no emulator to run on"
  echo "emulator $serial"
  example_sync android
  # The example's own application id, whatever sallapush.properties sets: every call below names it. Google services
  # stay out: a google-services.json for another application id has no client for this one.
  (cd "$root/example-app/android" && ORG_GRADLE_PROJECT_sallapushAppId=example_smoke \
    ORG_GRADLE_PROJECT_sallapushApiBaseUrl=http://10.0.2.2:9/notifications/v1/sallapush \
    ORG_GRADLE_PROJECT_sallapushApplicationId="$SP_EXAMPLE_ID" \
    ORG_GRADLE_PROJECT_sallapushSkipGoogleServices=true ./gradlew --quiet assembleRelease)
  apk="$root/example-app/android/app/build/outputs/apk/release/app-release.apk"
  "$ADB" -s "$serial" uninstall "$SP_EXAMPLE_ID" >/dev/null 2>&1 || true
  "$ADB" -s "$serial" install -r "$apk" >/dev/null
  "$ADB" -s "$serial" shell pm grant "$SP_EXAMPLE_ID" android.permission.POST_NOTIFICATIONS
  "$ADB" -s "$serial" shell am start -W -n "$SP_EXAMPLE_ID/$SP_EXAMPLE_ID.MainActivity" >/dev/null
  pid=""
  while [ -z "$pid" ] && [ "$waited" -lt 20 ]; do
    pid="$("$ADB" -s "$serial" shell pidof "$SP_EXAMPLE_ID" | tr -d '\r')" || pid=""
    [ -n "$pid" ] || sleep 1
    waited=$((waited + 1))
  done
  [ -n "$pid" ] || fail "Android: the app is not running; it may have crashed at launch (adb logcat -b crash)"
  log="$work/smoke-android.log"
  refresh=android_smoke_log
  result="$(await_marker "$log" SALLAPUSH_SELFTEST 120)" || fail "Android: no SALLAPUSH_SELFTEST line within 120 s"
  display="$(selftest_result "$result")" || fail "Android: the self-test failed"
  if [ "$display" = waiting ]; then
    android_test_push
    result="$(await_marker "$log" SALLAPUSH_SELFTEST_WILL_DISPLAY 60)" ||
      fail "Android: no SALLAPUSH_SELFTEST_WILL_DISPLAY line within 60 s of the test push"
    will_display_result "$result" || fail "Android: the foreground notification differs from the test push"
    echo "Android: the test push reached the will-display listener with the payload's values"
  else
    echo "Android: will-display SKIPPED ($display)"
    note "Android will-display SKIPPED ($display)"
  fi
  result="$(await_marker "$log" SALLAPUSH_SELFTEST_RELOAD 60)" ||
    fail "Android: no SALLAPUSH_SELFTEST_RELOAD line within 60 s"
  [ "$("$ADB" -s "$serial" shell pidof "$SP_EXAMPLE_ID" | tr -d '\r')" = "$pid" ] ||
    fail "Android: the app's process changed across the page reload"
  reload="$(reload_result "$result")" || fail "Android: the reloaded page's probe failed"
  if [ "$reload" = waiting ]; then
    android_test_push
    result="$(await_marker "$log" SALLAPUSH_SELFTEST_WILL_DISPLAY 60 SALLAPUSH_SELFTEST_RELOAD)" ||
      fail "Android: no SALLAPUSH_SELFTEST_WILL_DISPLAY line after the reload within 60 s of the second test push"
    will_display_result "$result" || fail "Android: the second foreground notification differs from the test push"
    sleep 5
    android_smoke_log
    count="$(marker_count "$log" SALLAPUSH_SELFTEST_WILL_DISPLAY SALLAPUSH_SELFTEST_RELOAD)"
    [ "$count" = 1 ] || fail "Android: $count SALLAPUSH_SELFTEST_WILL_DISPLAY lines after the reload, not 1"
    echo "Android: after the reload, the second test push reached the new page's listener once"
  else
    echo "Android: will-display after the reload SKIPPED ($reload)"
    note "Android will-display after the reload SKIPPED ($reload)"
  fi
  refresh=""
  "$ADB" -s "$serial" shell am force-stop "$SP_EXAMPLE_ID"
  smoke_cleanup
  serial=""
}

step_smoke() {
  require_macos
  on_exit smoke_cleanup
  smoke_ios
  smoke_android
}

# ---------------------------------------------------------------------------------------------------------------------
# Consumer apps: each made as an existing app is before it adds SallaPush, then given only what the README shows,
# applied from the snippet sources the README is checked against, then built and removed (they take several GB).

# snippet <source>[#<region>]: a snippet source as the README shows it. Assign it (name="$(snippet ...)") before passing
# it on: errexit ignores a failed substitution that is only an argument.
snippet() {
  node "$scripts/check-readme-snippets.mjs" --print "$1" || fail "the snippet $1 can't be read (above)"
}

# ruby_with_xcodeproj <arguments...>: ruby with the xcodeproj gem, from the load path, else from the gem home of a
# Homebrew CocoaPods (its pod launcher sets GEM_HOME).
ruby_with_xcodeproj() {
  local pod gem_home
  if ruby -e 'require "xcodeproj"' >/dev/null 2>&1; then
    ruby "$@"
    return
  fi
  pod="$(command -v pod)" || fail "neither ruby's gems nor CocoaPods have the xcodeproj gem: install CocoaPods"
  gem_home="$(sed -nE 's/^GEM_HOME="([^"]+)".*/\1/p' "$pod")"
  [ -n "$gem_home" ] || fail "cannot find the gems of CocoaPods ($pod) for the xcodeproj gem"
  GEM_HOME="$gem_home" GEM_PATH="$gem_home" ruby "$@"
}

# consumer_new <name> <capacitor version> [<package>@<version>...]: a fresh Capacitor app in $work/<name> without
# SallaPush: package.json (exact versions), a page, capacitor.config.json (webDir dist), the install and the web build,
# then both native platforms; with $pods, iOS with CocoaPods.
consumer_new() {
  local name="$1" capacitor="$2" app="$work/$1"
  shift 2
  mkdir -p "$app/src"
  python3 -I - "$app" "$name" "$capacitor" "$SP_VITE_VERSION" "$@" <<'PY'
import json, os, sys

app, name, capacitor, vite, extras = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:]
dependencies = {f"@capacitor/{part}": capacitor for part in ("android", "core", "ios")}
for extra in extras:
    package, version = extra.rsplit("@", 1)
    dependencies[package] = version
package = {"name": name, "version": "1.0.0", "private": True, "type": "module", "dependencies": dependencies,
           "devDependencies": {"@capacitor/cli": capacitor, "vite": vite}}
config = {"appId": f"sa.salla.sallapush.consumer.{name.split('-', 1)[1]}", "appName": name, "webDir": "dist"}
for file, value in (("package.json", package), ("capacitor.config.json", config)):
    with open(os.path.join(app, file), "w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")
PY
  printf '<!doctype html>\n<html>\n  <head><meta charset="utf-8" /><title>%s</title></head>\n  <body>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n' \
    "$name" >"$app/index.html"
  printf "document.body.textContent = '%s';\n" "$name" >"$app/src/main.ts"
  (cd "$app" && npm install --no-audit --no-fund --loglevel=error)
  (cd "$app" && node_modules/.bin/vite build --logLevel error)
  if [ -n "${pods:-}" ]; then
    (cd "$app" && node_modules/.bin/cap add ios --packagemanager cocoapods)
  else
    (cd "$app" && node_modules/.bin/cap add ios)
  fi
  (cd "$app" && node_modules/.bin/cap add android)
  echo "$name: a Capacitor $capacitor app with both platforms, without SallaPush"
}

# consumer_install <app> [git]: the README's install, of the package as npm would publish it ($dist_tarball); with git,
# the setup guide's git fallback instead, at the dry-run dist commit, with npm 12's allow-git=root. Then the app imports
# SallaPush.
consumer_install() {
  local app="$1" dependency="file:$dist_tarball" from="the package as npm would publish it"
  if [ "${2:-}" = git ]; then
    dependency="git+file://$dist_repo#$dist_commit"
    from="git, at the dist commit"
    printf 'allow-git=root\n' >"$app/.npmrc"
  fi
  python3 -I - "$app/package.json" "$dependency" <<'PY'
import json, sys

path, dependency = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as handle:
    package = json.load(handle)
package["dependencies"]["@salla.sa/sallapush-capacitor"] = dependency
with open(path, "w", encoding="utf-8") as handle:
    json.dump(package, handle, indent=2)
    handle.write("\n")
PY
  (cd "$app" && npm install --no-audit --no-fund --loglevel=error)
  [ -f "$app/node_modules/@salla.sa/sallapush-capacitor/dist/plugin.cjs.js" ] ||
    fail "${app##*/}: the install lacks the built dist/"
  cat >"$app/src/main.ts" <<'EOF'
import { SallaPush } from '@salla.sa/sallapush-capacitor';

void SallaPush.getSdkVersion().then((version) => {
  document.body.textContent = `SallaPush ${version}`;
});
EOF
  (cd "$app" && node_modules/.bin/vite build --logLevel error)
  echo "${app##*/}: installed @salla.sa/sallapush-capacitor from $from; the page imports it"
}

# consumer_app_delegate <app>: the README's AppDelegate regions in the template's own AppDelegate.swift: imports after
# its imports, start as the first statement of application(_:didFinishLaunchingWithOptions:), and the forwarding methods
# before the class's closing brace; everything the template has stays.
consumer_app_delegate() {
  local source="example-app/ios/App/App/AppDelegate.swift" imports start forwarding
  imports="$(snippet "$source#imports")"
  start="$(snippet "$source#start")"
  forwarding="$(snippet "$source#forwarding")"
  python3 -I - "$1/ios/App/App/AppDelegate.swift" "$imports" "$start" "$forwarding" <<'PY'
import re, sys

path, imports, start, forwarding = sys.argv[1:5]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
lines = text.split("\n")
last_import = max((index for index, line in enumerate(lines) if re.match(r"^import \w+", line)), default=None)
if last_import is None:
    sys.exit(f"{path}: no import line to add SallaPush's after")
lines[last_import + 1:last_import + 1] = imports.split("\n")
text = "\n".join(lines)
launch = re.search(r"func application\(_ application: UIApplication,\s*didFinishLaunchingWithOptions launchOptions: "
                   r"\[UIApplication\.LaunchOptionsKey: Any\]\?\) -> Bool \{\n", text)
if not launch:
    sys.exit(f"{path}: no application(_:didFinishLaunchingWithOptions:) to start SallaPush in")
indent = re.match(r"[ \t]*", text[launch.end():]).group(0)
text = text[:launch.end()] + "".join(f"{indent}{line}\n" for line in start.split("\n")) + text[launch.end():]
if not re.search(r"^class AppDelegate\b", text, re.MULTILINE):
    sys.exit(f"{path}: no class AppDelegate")
close = text.rstrip("\n").rfind("\n}")
if close < 0:
    sys.exit(f"{path}: no closing brace of the class AppDelegate")
methods = "\n".join(f"    {line}" if line else "" for line in forwarding.split("\n"))
text = text[:close].rstrip("\n") + "\n\n" + methods + text[close:]
with open(path, "w", encoding="utf-8") as handle:
    handle.write(text)
PY
  echo "${1##*/}: the README's imports, start and forwarding regions are in the template's AppDelegate.swift"
}

# consumer_info_plist <app> [<push service URL>]: the README's Info.plist key (the app id from the build setting
# SALLAPUSH_APP_ID), and for a run, the push service on a closed port of the Mac.
consumer_info_plist() {
  local app_id
  app_id="$(snippet example-app/ios/App/App/Info.plist#app-id)"
  python3 -I - "$1/ios/App/App/Info.plist" "$app_id" "${2:-}" <<'PY'
import plistlib, sys

path, region, url = sys.argv[1:4]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
end = text.rfind("</dict>")
if end < 0:
    sys.exit(f"{path}: no top-level dict")
lines = region.split("\n")
if url:
    lines += ["<key>SallaPushAPIBaseURL</key>", f"<string>{url}</string>"]
text = text[:end] + "".join(f"\t{line}\n" for line in lines) + text[end:]
values = plistlib.loads(text.encode("utf-8"))
if values.get("SallaPushAppId") != "$(SALLAPUSH_APP_ID)":
    sys.exit(f"{path}: SallaPushAppId is not $(SALLAPUSH_APP_ID) after the README's lines")
with open(path, "w", encoding="utf-8") as handle:
    handle.write(text)
PY
}

# consumer_android <app> [forwarding]: the README's Android lines: the manifest meta-data, the icon they name, the
# placeholder in app/build.gradle; with forwarding, also the FCM forwarding service in the app's package, its manifest
# entry, and a placeholder google-services.json, as an app with @capacitor/push-notifications has one.
consumer_android() {
  local app="$1" forwarding="${2:-}" main="$1/android/app/src/main" meta_data service="" placeholders activity package
  meta_data="$(snippet example-app/android/app/src/main/AndroidManifest.xml#meta-data)"
  [ -z "$forwarding" ] || service="$(snippet docs/snippets/AndroidManifest-forwarding.xml)"
  placeholders="$(snippet docs/snippets/app-build.gradle#placeholders)"
  mkdir -p "$main/res/drawable"
  cp "$root/example-app/android/app/src/main/res/drawable/ic_stat_sallapush.xml" "$main/res/drawable/"
  python3 -I - "$main/AndroidManifest.xml" "$meta_data" "$service" <<'PY'
import sys

path, meta_data, service = sys.argv[1:4]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
end = text.find("</application>")
if end < 0:
    sys.exit(f"{path}: no </application>")
block = "\n".join(line for line in (meta_data, service) if line)
text = text[:end].rstrip(" ") + "".join(f"        {line}\n" if line else "\n" for line in block.split("\n")) + \
    "    " + text[end:]
with open(path, "w", encoding="utf-8") as handle:
    handle.write(text)
PY
  python3 -I - "$app/android/app/build.gradle" "$placeholders" <<'PY'
import re, sys

path, placeholders = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
config = re.search(r"^([ \t]*)defaultConfig \{\n", text, re.MULTILINE)
if not config:
    sys.exit(f"{path}: no defaultConfig block")
indent = config.group(1) + "    "
text = text[:config.end()] + "".join(f"{indent}{line}\n" for line in placeholders.split("\n")) + text[config.end():]
with open(path, "w", encoding="utf-8") as handle:
    handle.write(text)
PY
  [ -n "$forwarding" ] || return 0
  activity="$(find "$main/java" -name MainActivity.java | head -n 1)"
  [ -n "$activity" ] || fail "${app##*/}: no MainActivity.java to put the forwarding service beside"
  package="$(sed -nE 's/^package ([A-Za-z0-9_.]+);$/\1/p' "$activity")"
  snippet docs/snippets/SallaPushMessagingService.java |
    sed "1s/^package com\.example\.app;\$/package $package;/" >"$(dirname "$activity")/SallaPushMessagingService.java"
  grep -qx "package $package;" "$(dirname "$activity")/SallaPushMessagingService.java" ||
    fail "${app##*/}: docs/snippets/SallaPushMessagingService.java does not start with its package line"
  python3 -I - "$app/android/app/google-services.json" "$package" <<'PY'
import json, sys

path, package = sys.argv[1:3]
with open(path, "w", encoding="utf-8") as handle:
    json.dump({
        "project_info": {"project_number": "100000000000", "project_id": "placeholder-project",
                         "storage_bucket": "placeholder-project.appspot.com"},
        "client": [{
            "client_info": {"mobilesdk_app_id": "1:100000000000:android:0000000000000000",
                            "android_client_info": {"package_name": package}},
            "oauth_client": [], "api_key": [{"current_key": "placeholder-key"}],
            "services": {"appinvite_service": {"other_platform_oauth_client": []}},
        }],
        "configuration_version": "1",
    }, handle, indent=2)
PY
}

# consumer_extension <app> [--spm <version>]: the README's Notification Service Extension, the example's sources.
consumer_extension() {
  local app="$1"
  shift
  ruby_with_xcodeproj "$scripts/add-nse-target.rb" "$app/ios/App" "$root/example-app/ios/App/SallaPushNotificationService" "$@"
}

# consumer_sync <app>: npx cap sync, which must list the plugin, and the files it writes for it.
consumer_sync() {
  local app="$1" name="${1##*/}"
  (cd "$app" && node_modules/.bin/cap sync) 2>&1 | tee "$work/$name-sync.log"
  grep -q '@salla.sa/sallapush-capacitor@' "$work/$name-sync.log" || fail "$name: npx cap sync lists no SallaPush plugin"
  python3 -I - "$app" <<'PY'
import json, os, sys

app = sys.argv[1]
problems = []
config = json.load(open(os.path.join(app, "ios/App/App/capacitor.config.json"), encoding="utf-8"))
if "SallaPushPlugin" not in config.get("packageClassList", []):
    problems.append(f"ios/App/App/capacitor.config.json's packageClassList is {config.get('packageClassList')}")
plugins = json.load(open(os.path.join(app, "android/app/src/main/assets/capacitor.plugins.json"), encoding="utf-8"))
if "sa.salla.sallapush.capacitor.SallaPushPlugin" not in [plugin.get("classpath") for plugin in plugins]:
    problems.append(f"android/app/src/main/assets/capacitor.plugins.json lists {plugins}")
spm = os.path.join(app, "ios/App/CapApp-SPM/Package.swift")
podfile = os.path.join(app, "ios/App/Podfile")
if os.path.isfile(spm):
    if '.package(name: "Salla.saSallapushCapacitor"' not in open(spm, encoding="utf-8").read():
        problems.append("ios/App/CapApp-SPM/Package.swift has no .package(name: \"Salla.saSallapushCapacitor\"")
elif "pod 'Salla.saSallapushCapacitor', :path =>" not in open(podfile, encoding="utf-8").read():
    problems.append("ios/App/Podfile has no pod 'Salla.saSallapushCapacitor'")
for problem in problems:
    print(problem)
sys.exit(1 if problems else 0)
PY
  echo "$name: npx cap sync added SallaPushPlugin to packageClassList and capacitor.plugins.json"
}

# consumer_ios_build <app> [settings...]: a Debug build for the simulator, which must embed the extension.
consumer_ios_build() {
  local app="$1" name="${1##*/}" container
  shift
  if [ -d "$app/ios/App/App.xcworkspace" ]; then
    container=(-workspace App.xcworkspace)
  else
    container=(-project App.xcodeproj)
  fi
  (cd "$app/ios/App" && xcodebuild -quiet "${container[@]}" -scheme App -configuration Debug -sdk iphonesimulator \
    -destination "id=$udid" -derivedDataPath "$app/derived" -scmProvider system "$@" build) ||
    fail "$name: the iOS build failed"
  [ -d "$app/derived/Build/Products/Debug-iphonesimulator/App.app/PlugIns/SallaPushNotificationService.appex" ] ||
    fail "$name: the app does not embed SallaPushNotificationService.appex"
  echo "$name: iOS Debug build succeeded, with SallaPushNotificationService.appex embedded"
}

# consumer_run <app>: installs the Debug build, launches it, and requires the first-activation line naming Capacitor's
# notification router within 30 s, and no error line of the plugin.
consumer_run() {
  local app="$1" name="${1##*/}" bundle wrapper="$work/${1##*/}-wrapper.log"
  bundle="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["appId"])' "$app/capacitor.config.json")"
  xcrun simctl uninstall "$udid" "$bundle" >/dev/null 2>&1 || true
  xcrun simctl install "$udid" "$app/derived/Build/Products/Debug-iphonesimulator/App.app"
  log_stream 'subsystem == "com.salla.push" AND category == "wrapper"' "$wrapper"
  sleep 2
  xcrun simctl launch "$udid" "$bundle" >/dev/null
  await_text "$wrapper" "Capacitor's notification router" 30 ||
    fail "$name: no first-activation line naming Capacitor's notification router within 30 s of the launch"
  wrapper_problems "$wrapper" || fail "$name: the plugin logged an error (above)"
  xcrun simctl terminate "$udid" "$bundle" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$udid" "$bundle" >/dev/null 2>&1 || true
  stop_streams
  echo "$name: launched; SallaPush's delegate hands other notifications to Capacitor's notification router"
}

# consumer_android_build <app> [forwarding service class]: assembleDebug and the merged manifest.
consumer_android_build() {
  local app="$1"
  (cd "$app/android" && ./gradlew --quiet assembleDebug) || fail "${app##*/}: the Android build failed"
  assert_manifest "$app/android/app/build/outputs/apk/debug/app-debug.apk" "${2:-}"
  echo "${app##*/}: Android build succeeded"
}

# consumer-spm: Capacitor 8.5's Swift Package Manager app (the UIScene template); Node loads the installed package.
consumer_spm() {
  local app="$work/consumer-spm"
  echo "== consumer-spm: Capacitor $SP_CAPACITOR_VERSION, Swift Package Manager, the UIScene template"
  consumer_new consumer-spm "$SP_CAPACITOR_VERSION"
  consumer_install "$app"
  consumer_app_delegate "$app"
  consumer_info_plist "$app"
  consumer_android "$app"
  consumer_extension "$app" --spm "$ios_pin"
  local_ios_sdk "$app/ios/App"
  consumer_sync "$app"
  consumer_ios_build "$app"
  rm -rf "$app/derived"
  consumer_android_build "$app"
  (cd "$app" && node --input-type=module -e "await import('@salla.sa/sallapush-capacitor')") ||
    fail "consumer-spm: Node's import() can't load the installed package"
  (cd "$app" && node -e "require('@salla.sa/sallapush-capacitor')") ||
    fail "consumer-spm: Node's require() can't load the installed package"
  echo "consumer-spm: Node loads the installed package with import() and require()"
  rm -rf "$app"
}

# consumer-pods: CocoaPods with @capacitor/push-notifications: the README's Podfile lines are required, its AppDelegate
# with the other plugin's posts compiles, and the FCM forwarding service outranks the other plugin's.
consumer_pods() {
  local app="$work/consumer-pods" app_pods extension_pods
  echo "== consumer-pods: Capacitor $SP_CAPACITOR_VERSION, CocoaPods, @capacitor/push-notifications $SP_PUSH_NOTIFICATIONS_VERSION"
  # The iOS platform comes before the plugin: with the plugin, cap add's sync would fail before the Podfile has the
  # SallaPush pods.
  pods=1 consumer_new consumer-pods "$SP_CAPACITOR_VERSION" "@capacitor/push-notifications@$SP_PUSH_NOTIFICATIONS_VERSION"
  consumer_install "$app"
  if (cd "$app" && node_modules/.bin/cap sync ios) >"$work/consumer-pods-first-sync.log" 2>&1; then
    fail "consumer-pods: npx cap sync ios passed without the SallaPush pods in the Podfile"
  fi
  # CocoaPods names the pod and its requirement in backticks: `SallaPush (= <version>)`.
  # shellcheck disable=SC2016
  grep -qF 'Unable to find a specification for `SallaPush' "$work/consumer-pods-first-sync.log" || {
    tail -n 20 "$work/consumer-pods-first-sync.log"
    fail "consumer-pods: the first npx cap sync ios failed for another reason than the missing SallaPush pods"
  }
  echo "consumer-pods: without the README's Podfile lines, npx cap sync ios fails: Unable to find a specification for SallaPush"
  app_pods="$(snippet docs/snippets/Podfile#podfile-app)"
  extension_pods="$(snippet docs/snippets/Podfile#podfile-extension)"
  python3 -I - "$app/ios/App/Podfile" "$app_pods" "$extension_pods" <<'PY'
import re, sys

path, app_pods, extension = sys.argv[1:4]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
call = re.search(r"^target 'App' do\n(?:.*\n)*?([ \t]*)capacitor_pods\n", text, re.MULTILINE)
if not call:
    sys.exit(f"{path}: no capacitor_pods in target 'App'")
text = text[:call.end()] + "".join(f"{call.group(1)}{line}\n" for line in app_pods.split("\n")) + text[call.end():]
with open(path, "w", encoding="utf-8") as handle:
    handle.write(text.rstrip("\n") + "\n\n" + extension + "\n")
PY
  consumer_extension "$app"
  snippet docs/snippets/CapacitorPushAppDelegate.swift >"$app/ios/App/App/AppDelegate.swift"
  consumer_info_plist "$app" http://localhost:9/notifications/v1/sallapush
  consumer_android "$app" forwarding
  consumer_sync "$app"
  consumer_ios_build "$app" SALLAPUSH_APP_ID=consumer_check
  consumer_run "$app"
  rm -rf "$app/derived"
  consumer_android_build "$app" "sa.salla.sallapush.consumer.pods.SallaPushMessagingService"
  rm -rf "$app"
}

# consumer-min: the oldest Capacitor 8 the plugin supports, whose template is a storyboard app without scenes, with the
# package from git, as the setup guide's fallback installs it with npm: the README's regions go into its AppDelegate,
# which keeps its ApplicationDelegateProxy methods.
consumer_min() {
  local app="$work/consumer-min"
  echo "== consumer-min: Capacitor $SP_CAPACITOR_MIN, Swift Package Manager, the storyboard template, from git"
  consumer_new consumer-min "$SP_CAPACITOR_MIN"
  consumer_install "$app" git
  consumer_app_delegate "$app"
  consumer_info_plist "$app" http://localhost:9/notifications/v1/sallapush
  consumer_android "$app"
  consumer_extension "$app" --spm "$ios_pin"
  local_ios_sdk "$app/ios/App"
  consumer_sync "$app"
  consumer_ios_build "$app" SALLAPUSH_APP_ID=consumer_check
  [ ! -e "$app/ios/App/App/SceneDelegate.swift" ] || fail "consumer-min: the app has a SceneDelegate.swift"
  ! grep -q '<key>UIApplicationSceneManifest</key>' "$app/ios/App/App/Info.plist" ||
    fail "consumer-min: the app's Info.plist has a UIApplicationSceneManifest"
  echo "consumer-min: no SceneDelegate.swift and no UIApplicationSceneManifest: a storyboard app without scenes"
  consumer_run "$app"
  rm -rf "$app/derived"
  consumer_android_build "$app"
  rm -rf "$app"
}

# yarn_install <app> <log>: yarn install, once more after a network error of the registry.
yarn_install() {
  local attempt
  for attempt in 1 2; do
    if (cd "$1" && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack yarn install) >"$2" 2>&1; then
      return 0
    fi
    grep -qE 'ERR_SOCKET_|ECONNRESET|ETIMEDOUT|EAI_AGAIN' "$2" || return 1
    echo "yarn install: a network error (attempt $attempt)"
  done
  return 1
}

# consumer-yarn: the Yarn install of the dist commit, served by a local git daemon (Yarn's git protocol needs a host):
# Yarn 4.14 and later refuse it until approvedGitRepositories names the repository, and Yarn's pack must keep every
# file the plugin needs.
consumer_yarn() {
  local app="$work/consumer-yarn" port repository waited=0
  echo "== consumer-yarn: Capacitor $SP_CAPACITOR_VERSION with $CONSUMER_YARN"
  mkdir -p "$app"
  port="$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
  git daemon --reuseaddr --listen=127.0.0.1 --port="$port" --base-path="$work" --export-all "$dist_repo" \
    >"$work/git-daemon.log" 2>&1 &
  daemon=$!
  repository="git://127.0.0.1:$port/${dist_repo#"$work"/}"
  until git ls-remote "$repository" >/dev/null 2>&1; do
    [ "$waited" -lt 20 ] || fail "consumer-yarn: the git daemon does not serve $repository"
    sleep 1
    waited=$((waited + 1))
  done
  python3 -I - "$app/package.json" "$CONSUMER_YARN" "$SP_CAPACITOR_VERSION" "$repository#$dist_commit" <<'PY'
import json, sys

path, manager, capacitor, dependency = sys.argv[1:5]
package = {"name": "consumer-yarn", "version": "1.0.0", "private": True, "packageManager": manager,
           "dependencies": {"@capacitor/core": capacitor, "@salla.sa/sallapush-capacitor": dependency}}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(package, handle, indent=2)
    handle.write("\n")
PY
  : >"$app/yarn.lock"
  # Capacitor's newest releases can be younger than Yarn's default one-day age gate, which is no concern here.
  printf 'nodeLinker: node-modules\nnpmMinimalAgeGate: 0\n' >"$app/.yarnrc.yml"
  if yarn_install "$app" "$work/consumer-yarn-refused.log"; then
    fail "consumer-yarn: Yarn installed a git dependency that approvedGitRepositories does not name"
  fi
  grep -q "doesn't match any of the patterns in 'approvedGitRepositories'" "$work/consumer-yarn-refused.log" || {
    tail -n 20 "$work/consumer-yarn-refused.log"
    fail "consumer-yarn: Yarn failed for another reason than approvedGitRepositories"
  }
  echo "consumer-yarn: without approvedGitRepositories, Yarn refuses the git dependency"
  printf 'approvedGitRepositories:\n  - "%s"\n' "$repository" >>"$app/.yarnrc.yml"
  yarn_install "$app" "$work/consumer-yarn-install.log" || {
    tail -n 40 "$work/consumer-yarn-install.log"
    fail "consumer-yarn: yarn install of the dist commit failed"
  }
  git -C "$root" ls-files -- 'ios/Sources/SallaPushCapacitorPlugin/*.swift' 'android/src/main' >"$work/plugin-files"
  python3 -I - "$app/node_modules/@salla.sa/sallapush-capacitor" "$work/plugin-files" <<'PY'
import json, os, sys

package, listing = sys.argv[1:3]
needed = ["dist/esm/index.js", "dist/esm/index.d.ts", "dist/plugin.cjs.js", "dist/plugin.js", "Package.swift",
          "Salla.saSallapushCapacitor.podspec", "android/build.gradle", "android/consumer-rules.pro"]
needed += [line.strip() for line in open(listing, encoding="utf-8") if line.strip()]
problems = [f"Yarn's install lacks {name}" for name in needed if not os.path.isfile(os.path.join(package, name))]
manifest = json.load(open(os.path.join(package, "package.json"), encoding="utf-8"))
if manifest.get("capacitor") != {"ios": {"src": "ios"}, "android": {"src": "android"}}:
    problems.append(f"the installed package.json's capacitor is {manifest.get('capacitor')}")
for problem in problems:
    print(problem)
if problems:
    sys.exit(1)
print(f"Yarn's install holds dist/, the {len(needed) - 8} Swift and Android sources, the podspec and Package.swift, "
      "and package.json keeps capacitor")
PY
  kill "$daemon"
  daemon=""
  echo "consumer-yarn: with approvedGitRepositories, Yarn installs the dist commit with every file the plugin needs"
  rm -rf "$app"
}

consumer_cleanup() {
  [ -z "${daemon:-}" ] || kill "$daemon" 2>/dev/null || true
  stop_streams
}

step_consumer() {
  local picked version npm_bin
  require_macos
  on_exit consumer_cleanup
  sp_android_env || fail "the Android setup is incomplete"
  picked="$(sp_simulator "$work")" || fail "no simulator to build for"
  udid="${picked%%$'\t'*}"
  echo "simulator ${picked#*$'\t'} $udid"
  ios_pin="$(sp_pins "$root" current ios)" || fail "the iOS pins name no version"
  version="$(sp_package_version "$root")"
  RELEASE_DIST_DIR="$work/dist" "$scripts/release-dist.sh" "$version" --dry-run | tee "$work/dist.out"
  dist_repo="$(sed -n 's/^dist_repo=//p' "$work/dist.out")"
  dist_commit="$(sed -n 's/^dist_commit=//p' "$work/dist.out")"
  [ -n "$dist_repo" ] && [ -n "$dist_commit" ] || fail "release-dist.sh --dry-run printed no dist commit"
  # What npm publishes: the dist commit's tree, packed. Its package.json has no scripts, so packing builds nothing.
  mkdir -p "$work/dist-tree" "$work/tarball"
  git -C "$dist_repo" archive "$dist_commit" | tar -x -C "$work/dist-tree"
  (cd "$work/dist-tree" && npm pack --json --pack-destination "$work/tarball") >"$work/tarball.json" ||
    fail "npm pack of the dist commit failed"
  dist_tarball="$work/tarball/$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))[0]["filename"].split("/")[-1])' \
    "$work/tarball.json")"
  [ -f "$dist_tarball" ] || fail "npm pack of the dist commit made no tarball"
  echo "the package as npm would publish it: ${dist_tarball##*/}"
  npm install --prefix "$work/npm" --no-audit --no-fund --loglevel=error "$CONSUMER_NPM" >/dev/null
  npm_bin="$work/npm/node_modules/.bin"
  echo "consumer apps install with npm $("$npm_bin/npm" --version)"
  PATH="$npm_bin:$PATH" consumer_spm
  PATH="$npm_bin:$PATH" consumer_pods
  PATH="$npm_bin:$PATH" consumer_min
  consumer_yarn
}

# ---------------------------------------------------------------------------------------------------------------------
# Runner

case "${1:-}" in -h | --help) usage ;; esac
steps="$*"
[ -n "$steps" ] || steps="$STEPS"
for step in $steps; do
  case " $STEPS " in
    *" $step "*) ;;
    *) fail "unknown step '$step' (steps: $STEPS)" ;;
  esac
done

logs="${VERIFY_LOG_DIR:-$work/logs}"
mkdir -p "$logs"
summary="$logs/summary.tsv"
# The commit this run verifies, +dirty when the tree has changes. summary.tsv holds the runs of one commit, named in its
# first line and in every row, so an attestation can't quote another commit's results.
commit="$(git -C "$root" rev-parse -q --verify HEAD 2>/dev/null)" || commit=none
state=clean
[ "$commit" != none ] && [ -z "$(git -C "$root" status --porcelain 2>/dev/null)" ] || state=dirty
revision="$commit"
[ "$state" = clean ] || revision="$commit+dirty"
if [ -f "$summary" ]; then
  recorded="$(sed -nE '1s/^# ([^ ]+) .*/\1/p' "$summary")"
  [ "$recorded" = "$commit" ] ||
    fail "$summary holds the runs of ${recorded:-another commit}, not of $commit: use a VERIFY_LOG_DIR for each commit"
else
  printf '# %s %s\nstep\tresult\tcommit\n' "$commit" "$state" >"$summary"
fi
grouped=false
[ "${GITHUB_ACTIONS:-}" != true ] || [ "$steps" = "${steps%% *}" ] || grouped=true

for step in $steps; do
  function_name="step_$step"
  log="$logs/$step.log"
  rm -f "$work/note"
  ! $grouped || echo "::group::verify.sh $step"
  echo "==> verify.sh $step"
  started="$(date +%s)"
  # A subshell with errexit, outside any if/!/&& context, so a failing command inside a step can never be ignored.
  set +e
  (
    set -e
    "$function_name"
  ) 2>&1 | tee "$log"
  status="${PIPESTATUS[0]}"
  set -e
  seconds=$(($(date +%s) - started))
  ! $grouped || echo "::endgroup::"
  if [ "$status" -ne 0 ]; then
    printf '%s\tfailed\t%s\n' "$step" "$revision" >>"$summary"
    fail "$step: failed (exit $status) after ${seconds}s${VERIFY_LOG_DIR:+; log: $log}"
  fi
  result=passed
  [ ! -s "$work/note" ] || result="passed ($(awk '!seen[$0]++' "$work/note" | paste -sd ';' - | sed 's/;/; /g'))"
  printf '%s\t%s\t%s\n' "$step" "$result" "$revision" >>"$summary"
  echo "verify.sh: $step: ok (${seconds}s)${result#passed}"
done
# A run that started on a clean tree ends on one: a file that a step writes and no ignore file covers would make every
# later run +dirty, and release-dist.sh would refuse the tree.
if [ "$state" = clean ]; then
  left="$(git -C "$root" status --porcelain)"
  if [ -n "$left" ]; then
    printf 'clean-tree\tfailed\t%s\n' "$revision" >>"$summary"
    fail "the run started on a clean tree and left these changes, which a file of .gitignore must cover or no step" \
      "may write: $(printf '%s\n' "$left" | cut -c 4- | tr '\n' ' ')"
  fi
fi
echo "verify.sh: all passed ($steps)"
