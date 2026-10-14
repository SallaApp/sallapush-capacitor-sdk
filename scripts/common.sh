# shellcheck shell=bash disable=SC2034 # the constants are read by the scripts that source this file
# Shared by scripts/verify.sh, bump-native.sh, release-dist.sh and self-test.sh. Sourced, never run. The functions never
# exit: they print what is wrong to stderr and return 1.

# A native SallaPush release, as the native repositories tag them.
readonly SP_VERSION_RE='[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z]+(\.[0-9A-Za-z]+)*)?'

# Every pin of the native versions: <file or glob>|<regular expression whose first group is the version>|<platform>.
# scripts/bump-native.sh rewrites each match; the pins step requires one version per platform. A plain file must hold
# its pin; a glob checks the files that exist. The docs pin the versions they name, CocoaPods' message about the SallaPush
# pod that they quote, and their links to the native docs, which name the tag. The Xcode project's only version line is
# the requirement of the example extension's Swift package.
readonly SP_PINS=(
  "Salla.saSallapushCapacitor.podspec|s\\.dependency \"SallaPush\", \"($SP_VERSION_RE)\"|ios"
  "Package.swift|url: \"https://github\\.com/SallaApp/sallapush-ios-sdk\\.git\", exact: \"($SP_VERSION_RE)\"|ios"
  "example-app/ios/App/App.xcodeproj/project.pbxproj|^[ \\t]*version = ($SP_VERSION_RE);\$|ios"
  "docs/snippets/Podfile|:git => 'git@github\\.com:SallaApp/sallapush-ios-sdk\\.git', :tag => '($SP_VERSION_RE)'|ios"
  "tool/api-parity/mapping.json|\"ios\": \"($SP_VERSION_RE)\"|ios"
  "README.md|SallaPush iOS ($SP_VERSION_RE)|ios"
  "README.md|^\\| Capacitor [^|]*\\| ($SP_VERSION_RE) \\||ios"
  "README.md|:git => 'git@github\\.com:SallaApp/sallapush-ios-sdk\\.git', :tag => '($SP_VERSION_RE)'|ios"
  "README.md|github\\.com/SallaApp/sallapush-ios-sdk/blob/($SP_VERSION_RE)/|ios"
  "docs/*.md|SallaPush iOS ($SP_VERSION_RE)|ios"
  "docs/*.md|:git => 'git@github\\.com:SallaApp/sallapush-ios-sdk\\.git', :tag => '($SP_VERSION_RE)'|ios"
  "docs/*.md|SallaPush \\(= ($SP_VERSION_RE)\\)|ios"
  "docs/*.md|github\\.com/SallaApp/sallapush-ios-sdk/blob/($SP_VERSION_RE)/|ios"
  "android/build.gradle|api \"com\\.salla\\.push:sallapush:($SP_VERSION_RE)\"|android"
  "tool/api-parity/mapping.json|\"android\": \"($SP_VERSION_RE)\"|android"
  "README.md|SallaPush Android ($SP_VERSION_RE)|android"
  "README.md|^\\| Capacitor [^|]*\\| [^|]*\\| ($SP_VERSION_RE) \\||android"
  "README.md|github\\.com/SallaApp/sallapush-android-sdk/blob/($SP_VERSION_RE)/|android"
  "docs/*.md|SallaPush Android ($SP_VERSION_RE)|android"
  "docs/*.md|github\\.com/SallaApp/sallapush-android-sdk/blob/($SP_VERSION_RE)/|android"
)

# The example app, as scripts/verify.sh builds, tests and runs it: the Xcode scheme and product, and the bundle and
# application id.
readonly SP_EXAMPLE=App
readonly SP_EXAMPLE_ID=sa.salla.sallapush.example

# What the consumer apps of scripts/verify.sh install: the newest and the oldest Capacitor 8 the plugin supports,
# Capacitor's push plugin beside SallaPush, Vite for the web build, and the package managers whose git installs the
# README documents.
readonly SP_CAPACITOR_VERSION=8.5.3
readonly SP_CAPACITOR_MIN=8.0.2
readonly SP_PUSH_NOTIFICATIONS_VERSION=8.1.3
readonly SP_VITE_VERSION=7.3.7
readonly CONSUMER_NPM=npm@12.2.0
readonly CONSUMER_YARN=yarn@4.18.1

readonly SP_SHELLCHECK_VERSION=0.11.0
readonly SP_SHELLCHECK_IMAGE=koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d
readonly SP_SWIFTLINT_VERSION=0.63.2

# Capacitor 8 compiles Android with Java 21. Temurin 21 installs without admin rights: the archive below, checked against
# its SHA-256 and extracted with --strip-components 1 into $HOME/.sallapush-tools/jdk-21.
readonly SP_JAVA_MAJOR=21
readonly SP_JAVA_INSTALL="download https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.12.1_1.tar.gz, check its SHA-256 3623232f33a9c3baadf304480b2535f9a3cba8a58d42ecbb438ba267315d9998 and extract it with --strip-components 1 into \$HOME/.sallapush-tools/jdk-21, or set SALLAPUSH_JAVA_HOME to a JDK 21"

# Runs Yarn: $YARN, else yarn on PATH, else Corepack's. The repository pins Yarn with packageManager and yarnPath.
sp_yarn() {
  if [ -n "${YARN:-}" ]; then
    "$YARN" "$@"
  elif command -v yarn >/dev/null 2>&1; then
    yarn "$@"
  elif command -v corepack >/dev/null 2>&1; then
    corepack yarn "$@"
  else
    echo "Yarn not found: install Node 24 (it ships Corepack), or set YARN" >&2
    return 1
  fi
}

# Prints the version of package.json at <root>.
sp_package_version() {
  python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["version"])' "$1/package.json"
}

# Prints the heading of the single '## [<version>]' entry of CHANGELOG.md at <root>; fails without exactly one.
sp_changelog_heading() {
  local root="$1" version="$2" headings count
  headings="$(awk -v heading="## [$version]" 'index($0, heading) == 1' "$root/CHANGELOG.md")"
  count="$(printf '%s' "$headings" | grep -c '' || true)"
  [ "$count" -eq 1 ] || {
    echo "CHANGELOG.md must have exactly one '## [$version]' entry (found $count)" >&2
    return 1
  }
  printf '%s\n' "$headings"
}

# Checks every pin of SP_PINS at <root>, prints one platform's version, or rewrites them: sp_pins <root> check |
# sp_pins <root> current <ios|android> | sp_pins <root> rewrite <ios> <android>. check prints one line per platform with
# its version and fails, naming each pin, when a platform has several; current fails then too.
sp_pins() {
  python3 - "$@" "${SP_PINS[@]}" <<'PY'
import glob, os, re, sys

root, mode = sys.argv[1], sys.argv[2]
current = None
if mode == "rewrite":
    targets, entries = {"ios": sys.argv[3], "android": sys.argv[4]}, sys.argv[5:]
elif mode == "current":
    targets, current, entries = None, sys.argv[3], sys.argv[4:]
else:
    targets, entries = None, sys.argv[3:]
found = {"ios": [], "android": []}
problems = []
for entry in entries:
    pattern_file = entry.split("|", 1)[0]
    platform = entry.rsplit("|", 1)[1]
    regex = re.compile(entry[len(pattern_file) + 1 : len(entry) - len(platform) - 1], re.MULTILINE)
    if "*" in pattern_file:
        files = sorted(glob.glob(os.path.join(root, pattern_file)))
    elif os.path.isfile(os.path.join(root, pattern_file)):
        files = [os.path.join(root, pattern_file)]
    else:
        problems.append(f"{pattern_file} is missing; it pins the {platform} version")
        continue
    matched = 0
    for path in files:
        name = os.path.relpath(path, root)
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
        pieces, last = [], 0
        for match in regex.finditer(text):
            matched += 1
            line = text.count("\n", 0, match.start(1)) + 1
            found[platform].append((match.group(1), f"{name}:{line}"))
            if targets:
                pieces += [text[last : match.start(1)], targets[platform]]
                last = match.end(1)
        if targets and pieces:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("".join(pieces) + text[last:])
    if matched == 0 and "*" not in pattern_file:
        problems.append(f"{pattern_file} has no {platform} pin matching {regex.pattern}")
for platform in ("ios", "android"):
    versions = sorted({version for version, _ in found[platform]})
    if targets:
        print(f"{platform}: {len(found[platform])} pins set to {targets[platform]}")
    elif len(versions) > 1:
        places = ", ".join(f"{where} {version}" for version, where in found[platform])
        problems.append(f"the {platform} pins disagree: {places}")
    elif versions and not current:
        print(f"{platform} {versions[0]}: {len(found[platform])} pins agree")
if current and not problems:
    versions = sorted({version for version, _ in found.get(current, [])})
    if len(versions) == 1:
        print(versions[0])
    else:
        problems.append(f"no {current} pin names a version")
for problem in problems:
    print(problem, file=sys.stderr)
sys.exit(1 if problems else 0)
PY
}

# Fails unless the JUnit XML results under <dir> hold at least one test.
assert_tests_ran() {
  python3 - "$1" <<'PY'
import glob, os, sys
import xml.etree.ElementTree as ElementTree

directory = sys.argv[1]
total = 0
for path in glob.glob(os.path.join(directory, "**", "*.xml"), recursive=True):
    root = ElementTree.parse(path).getroot()
    suites = [root] if root.tag == "testsuite" else root.findall("testsuite")
    total += sum(int(suite.get("tests", "0")) for suite in suites)
if total == 0:
    sys.exit(f"no tests ran: the JUnit results under {directory} hold 0 tests")
print(f"{total} tests ran ({directory})")
PY
}

# Fails unless the XCTest results bundle <xcresult> holds a passed test: xcodebuild test also succeeds for a test target
# whose sources a project merge dropped.
assert_xctests_ran() {
  local summary
  summary="$(xcrun xcresulttool get test-results summary --path "$1" --compact)" || return 1
  python3 -c '
import json, sys
summary = json.loads(sys.argv[1])
passed, total = summary.get("passedTests", 0), summary.get("totalTestCount", 0)
if not passed:
    sys.exit(f"no XCTest ran: the results in {sys.argv[2]} hold {total} tests, and none passed")
print(f"{passed} of {total} tests passed ({sys.argv[2]})")
' "$summary" "$1"
}

# Prints the path of VERIFY_IOS_SDK_CHECKOUT when it is a clean clone of SallaApp/sallapush-ios-sdk at the tag
# <version>, in a folder named sallapush-ios-sdk, the remote package's name, so that Xcode uses it in place of the remote
# package; fails naming what is wrong.
sp_ios_sdk_checkout() {
  local version="$1" checkout="${VERIFY_IOS_SDK_CHECKOUT:-}" tag changes
  if [ -z "$checkout" ] || ! checkout="$(cd "$checkout" 2>/dev/null && pwd -P)"; then
    echo "VERIFY_IOS_SDK_CHECKOUT=${VERIFY_IOS_SDK_CHECKOUT:-} does not exist" >&2
    return 1
  fi
  if [ "${checkout##*/}" != sallapush-ios-sdk ]; then
    echo "VERIFY_IOS_SDK_CHECKOUT must be a folder named sallapush-ios-sdk, the remote package's name" >&2
    return 1
  fi
  if [ "$(git -C "$checkout" rev-parse --show-toplevel 2>/dev/null)" != "$checkout" ]; then
    echo "VERIFY_IOS_SDK_CHECKOUT is not a git clone of SallaApp/sallapush-ios-sdk" >&2
    return 1
  fi
  if ! tag="$(git -C "$checkout" rev-parse --verify --quiet "refs/tags/$version^{commit}")"; then
    echo "VERIFY_IOS_SDK_CHECKOUT has no tag $version, the pinned version" >&2
    return 1
  fi
  if [ "$(git -C "$checkout" rev-parse --verify --quiet HEAD)" != "$tag" ]; then
    echo "VERIFY_IOS_SDK_CHECKOUT is not at the tag $version: check the tag out (git checkout $version)" >&2
    return 1
  fi
  # --no-optional-locks: status never refreshes the clone's index, so the check writes nothing into it.
  if ! changes="$(git -C "$checkout" --no-optional-locks status --porcelain --untracked-files=normal)" ||
    [ -n "$changes" ]; then
    echo "VERIFY_IOS_SDK_CHECKOUT has changes, so it is not SallaPush iOS $version exactly (git status)" >&2
    return 1
  fi
  if ! grep -qxF "package let sallaPushSDKVersion = \"$version\"" \
    "$checkout/Sources/SallaPushCore/SallaPushVersion.swift"; then
    echo "VERIFY_IOS_SDK_CHECKOUT is not SallaPush iOS $version, the pinned version" >&2
    return 1
  fi
  echo "$checkout"
}

# Prints "<udid><TAB><description>" of the simulator to use: VERIFY_SIMULATOR_UDID, else a booted iPhone, else the newest
# stock iPhone on the newest iOS runtime the selected Xcode supports.
sp_simulator() {
  local work="$1"
  xcrun simctl list devices available -j >"$work/devices.json" || return 1
  xcrun simctl list runtimes available -j >"$work/runtimes.json" || return 1
  xcrun simctl list devicetypes -j >"$work/devicetypes.json" || return 1
  python3 - "$(xcrun --sdk iphonesimulator --show-sdk-version)" "$work" "${VERIFY_SIMULATOR_UDID:-}" <<'PY'
import json, os, sys

def version(text):
    return tuple(int(part) for part in text.split(".") if part.isdigit())

sdk, work, wanted = version(sys.argv[1]), sys.argv[2], sys.argv[3]
load = lambda name: json.load(open(os.path.join(work, name)))
devices = load("devices.json")["devices"]
runtimes = {runtime["identifier"]: runtime for runtime in load("runtimes.json")["runtimes"]}
types = load("devicetypes.json")["devicetypes"]
names = {kind["identifier"]: kind["name"] for kind in types}
generation = {kind["identifier"]: kind.get("minRuntimeVersion", 0) for kind in types}
candidates = []
for identifier, listed in devices.items():
    runtime = runtimes.get(identifier)
    if not runtime or runtime.get("platform", "iOS") != "iOS" or version(runtime["version"]) > sdk:
        continue
    for device in listed:
        if wanted and device["udid"] == wanted:
            print(f"{device['udid']}\t{device['name']} (iOS {runtime['version']}, VERIFY_SIMULATOR_UDID)")
            sys.exit(0)
        kind = device.get("deviceTypeIdentifier", "")
        if kind.startswith("com.apple.CoreSimulator.SimDeviceType.iPhone"):
            candidates.append((device.get("state") == "Booted", version(runtime["version"]), device["name"] == names.get(kind),
                               generation.get(kind, 0), device["udid"], device["name"], runtime["version"]))
if wanted:
    sys.exit(f"VERIFY_SIMULATOR_UDID {wanted} is not an available iOS simulator")
if not candidates:
    sys.exit(f"no available iPhone simulator for iOS {sys.argv[1]} or older; install a simulator runtime")
best = max(candidates)
print(f"{best[4]}\t{best[5]} (iOS {best[6]}{', booted' if best[0] else ''})")
PY
}

# Prints the major version of the JDK at <java home>, from its release file: 21 for JAVA_VERSION="21.0.12.1", 8 for
# JAVA_VERSION="1.8.0_402". Fails for a folder that is no JDK home. (macOS's java_home -v 21 prints another JDK when
# none is 21, and /usr/bin/java runs whatever JAVA_HOME names, so the release file decides.)
sp_java_major() {
  local version
  [ -x "$1/bin/java" ] && [ -f "$1/release" ] || return 1
  version="$(sed -nE 's/^JAVA_VERSION="([^"]+)".*/\1/p' "$1/release" | head -n 1)"
  [ -n "$version" ] || return 1
  case "$version" in
    1.*) version="${version#1.}" ;;
  esac
  printf '%s\n' "${version%%[.+_-]*}"
}

# Prints what macOS's java_home answers for Java 21, if anything: another JDK when none is 21, so callers check it.
sp_macos_java_home() {
  [ -x /usr/libexec/java_home ] || return 0
  /usr/libexec/java_home -v "$SP_JAVA_MAJOR" 2>/dev/null || true
}

# Prints the JDK 21 to build Android with: SALLAPUSH_JAVA_HOME, which must be one, else the one in
# $HOME/.sallapush-tools/jdk-21, else java_home's JDK 21 on macOS. Fails naming the install when none is Java 21.
sp_java_home() {
  local candidate macos
  if [ -n "${SALLAPUSH_JAVA_HOME:-}" ]; then
    [ "$(sp_java_major "$SALLAPUSH_JAVA_HOME" 2>/dev/null)" = "$SP_JAVA_MAJOR" ] || {
      echo "SALLAPUSH_JAVA_HOME=$SALLAPUSH_JAVA_HOME is not a JDK $SP_JAVA_MAJOR: Capacitor 8 builds Android with Java $SP_JAVA_MAJOR" >&2
      return 1
    }
    printf '%s\n' "$SALLAPUSH_JAVA_HOME"
    return 0
  fi
  macos="$(sp_macos_java_home)"
  for candidate in "$HOME/.sallapush-tools/jdk-21/Contents/Home" "$macos"; do
    if [ -n "$candidate" ] && [ "$(sp_java_major "$candidate" 2>/dev/null)" = "$SP_JAVA_MAJOR" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  echo "no JDK $SP_JAVA_MAJOR was found, which Capacitor 8 needs to build Android: $SP_JAVA_INSTALL" >&2
  return 1
}

# Sets ANDROID_HOME, JAVA_HOME and ADB for the Android steps: the SDK (ANDROID_HOME, else the default macOS location) and
# JDK 21 (sp_java_home). Checks that GitHub Packages credentials exist, without reading them.
sp_android_env() {
  local properties="${GRADLE_USER_HOME:-$HOME/.gradle}/gradle.properties"
  if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/Library/Android/sdk" ]; then
    ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
  [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ] || {
    echo "the Android SDK was not found: set ANDROID_HOME" >&2
    return 1
  }
  JAVA_HOME="$(sp_java_home)" || return 1
  export ANDROID_HOME JAVA_HOME
  ADB="$ANDROID_HOME/platform-tools/adb"
  if { [ -f "$properties" ] && grep -q '^gpr\.user=' "$properties" && grep -q '^gpr\.key=' "$properties"; } ||
    { [ -n "${GITHUB_ACTOR:-}" ] && [ -n "${GITHUB_TOKEN:-}" ]; }; then
    return 0
  fi
  echo "no GitHub Packages credentials for com.salla.push:sallapush: set gpr.user and gpr.key (a classic token with read:packages) in $properties, or GITHUB_ACTOR and GITHUB_TOKEN" >&2
  return 1
}

# Prints the serial of the emulator to use: VERIFY_EMULATOR_SERIAL, else the one running emulator.
sp_emulator() {
  local serials count
  if [ -n "${VERIFY_EMULATOR_SERIAL:-}" ]; then
    "$ADB" -s "$VERIFY_EMULATOR_SERIAL" get-state >/dev/null 2>&1 || {
      echo "VERIFY_EMULATOR_SERIAL $VERIFY_EMULATOR_SERIAL is not connected" >&2
      return 1
    }
    echo "$VERIFY_EMULATOR_SERIAL"
    return 0
  fi
  serials="$("$ADB" devices | awk '$1 ~ /^emulator-/ && $2 == "device" { print $1 }')"
  count="$(printf '%s' "$serials" | grep -c '' || true)"
  case "$count" in
    1) echo "$serials" ;;
    0)
      echo "no Android emulator is running: start one (API 33 or later), or set VERIFY_EMULATOR_SERIAL" >&2
      return 1
      ;;
    *)
      echo "several emulators are running: set VERIFY_EMULATOR_SERIAL to one of $(echo "$serials" | tr '\n' ' ')" >&2
      return 1
      ;;
  esac
}
