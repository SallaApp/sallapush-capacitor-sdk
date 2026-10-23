#!/usr/bin/env bash
# Tests of this repository's shell tooling, on throwaway copies in a temporary directory, with stand-ins for every
# network or build tool: Yarn's resolution, the JDK selection and the VERIFY_IOS_SDK_CHECKOUT check in common.sh,
# verified-label.sh, bump-native.sh, release-dist.sh, and the tree and pack steps, the summary and the clean-run check
# of verify.sh. It needs bash, git and python3. Scratch commits use an isolated git configuration, so they are never
# signed, and nothing is pushed.
#
#   scripts/self-test.sh
set -euo pipefail

scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(cd "$scripts/.." && pwd -P)"
work="$(mktemp -d "${TMPDIR:-/tmp}/sallapush-self-test.XXXXXX")"
trap 'rm -rf "$work"' EXIT
trap 'exit 130' INT TERM

mkdir -p "$work/home"
export HOME="$work/home" XDG_CONFIG_HOME="$work/home/.config" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=self-test GIT_AUTHOR_EMAIL=self-test@example.invalid
export GIT_COMMITTER_NAME=self-test GIT_COMMITTER_EMAIL=self-test@example.invalid
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE YARN VERIFY_LOG_DIR GITHUB_ACTIONS SALLAPUSH_JAVA_HOME VERIFY_IOS_SDK_CHECKOUT

passed=0
failed=0
out="$work/out"

section() { printf '\n== %s\n' "$1"; }

# check <label> <ok|fails> <command...>: runs the command, its output into $out, and expects it to pass or fail.
check() {
  local label="$1" want="$2" status=0
  shift 2
  "$@" >"$out" 2>&1 || status=$?
  if { [ "$want" = ok ] && [ "$status" -eq 0 ]; } || { [ "$want" = fails ] && [ "$status" -ne 0 ]; }; then
    passed=$((passed + 1))
    echo "ok   $label"
  else
    failed=$((failed + 1))
    echo "FAIL $label (exit $status, expected $want)"
    sed 's/^/       /' "$out"
  fi
}

# says <label> <text>: a line of the last check's output holds the text.
says() {
  if grep -qF -- "$2" "$out"; then
    passed=$((passed + 1))
    echo "ok   $1"
  else
    failed=$((failed + 1))
    echo "FAIL $1: the output does not say '$2'"
    sed 's/^/       /' "$out"
  fi
}

# stand_in <path>: an executable shell script, its body read from standard input.
stand_in() {
  mkdir -p "$(dirname "$1")"
  { echo '#!/bin/sh'; cat; } >"$1"
  chmod 0755 "$1"
}

# edit <file> <old> <new>: replaces the first <old>; stops the self-test when <old> is missing.
edit() {
  python3 - "$1" "$2" "$3" <<'PY'
import sys
path, old, new = sys.argv[1:4]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
if old not in text:
    sys.exit(f"self-test.sh: {path} does not contain {old!r}; update the case")
with open(path, "w", encoding="utf-8") as handle:
    handle.write(text.replace(old, new, 1))
PY
}

# ---------------------------------------------------------------------------------------------------------------------
# common.sh

test_yarn_resolution() {
  local with_yarn="$work/bin-with-yarn" with_corepack="$work/bin-with-corepack" none="$work/bin-none"
  section "common.sh: Yarn's resolution"
  stand_in "$with_yarn/yarn" <<'EOF'
echo "yarn on PATH: $*"
EOF
  stand_in "$with_corepack/corepack" <<'EOF'
echo "corepack: $*"
EOF
  stand_in "$work/custom-yarn" <<'EOF'
echo "YARN: $*"
EOF
  mkdir -p "$none"
  # The stand-ins are the whole PATH, so no installed Yarn or Corepack can answer.
  resolve() { env PATH="$1" ${2:+YARN="$2"} "$BASH" -c ". \"\$0\"; sp_yarn --version" "$scripts/common.sh"; }
  check "YARN wins over yarn on PATH" ok resolve "$with_yarn" "$work/custom-yarn"
  says "it runs YARN" "YARN: --version"
  check "without YARN, yarn on PATH" ok resolve "$with_yarn"
  says "it runs yarn" "yarn on PATH: --version"
  check "without yarn, Corepack's" ok resolve "$with_corepack"
  says "it runs corepack yarn" "corepack: yarn --version"
  check "without any, it fails" fails resolve "$none"
  says "it says what to install" "install Node 24 (it ships Corepack), or set YARN"
}

test_xctest_results() {
  local bin="$work/bin-xcrun"
  section "common.sh: the XCTest results"
  # Stands in for xcrun xcresulttool: prints FAKE_SUMMARY's file, and refuses any other command.
  stand_in "$bin/xcrun" <<'EOF'
[ "$1 $2 $3 $4 $5" = "xcresulttool get test-results summary --path" ] || exit 64
cat "$FAKE_SUMMARY"
EOF
  results() {
    printf '%s\n' "$1" >"$work/summary.json"
    env PATH="$bin:$PATH" FAKE_SUMMARY="$work/summary.json" \
      "$BASH" -c ". \"\$0\"; assert_xctests_ran \"\$1\"" "$scripts/common.sh" "$work/Tests.xcresult"
  }
  check "results with passed tests pass" ok results '{"passedTests": 112, "totalTestCount": 112, "failedTests": 0}'
  says "it counts them" "112 of 112 tests passed"
  check "results without a test fail" fails results '{"passedTests": 0, "totalTestCount": 0, "failedTests": 0}'
  says "it says so" "no XCTest ran"
}

# common.sh: the JDK 21 of the Android steps. macOS's java_home answers with another JDK when none is 21, so each
# candidate's release file decides.

test_java_home() {
  local jdks="$work/jdks" tools="$work/home-with-jdk"
  section "common.sh: the JDK of the Android steps"
  # fake_jdk <home> <JAVA_VERSION>: what makes a folder a JDK home here: bin/java and the release file.
  fake_jdk() {
    stand_in "$1/bin/java" <<'EOF'
exit 0
EOF
    printf 'IMPLEMENTOR="Eclipse Adoptium"\nJAVA_VERSION="%s"\n' "$2" >"$1/release"
  }
  fake_jdk "$jdks/21" 21.0.12.1
  fake_jdk "$jdks/17" 17.0.14
  fake_jdk "$jdks/8" 1.8.0_402
  mkdir -p "$jdks/empty"
  fake_jdk "$tools/.sallapush-tools/jdk-21/Contents/Home" 21.0.4
  # java_home_of <home> [<java_home's answer>]: sp_java_home with that HOME, and java_home standing in.
  java_home_of() {
    env HOME="$1" FAKE_MACOS="${2:-}" "$BASH" -c \
      ". \"\$0\"; sp_macos_java_home() { printf '%s\\n' \"\$FAKE_MACOS\"; }; sp_java_home" "$scripts/common.sh"
  }
  major() { "$BASH" -c ". \"\$0\"; sp_java_major \"\$1\"" "$scripts/common.sh" "$1"; }
  check "SALLAPUSH_JAVA_HOME wins when it is a JDK 21" ok env SALLAPUSH_JAVA_HOME="$jdks/21" "$BASH" -c \
    ". \"\$0\"; sp_java_home" "$scripts/common.sh"
  says "it prints it" "$jdks/21"
  check "a SALLAPUSH_JAVA_HOME of another major is refused" fails env SALLAPUSH_JAVA_HOME="$jdks/17" "$BASH" -c \
    ". \"\$0\"; sp_java_home" "$scripts/common.sh"
  says "it names it" "SALLAPUSH_JAVA_HOME=$jdks/17 is not a JDK 21"
  check "a SALLAPUSH_JAVA_HOME that is no JDK home is refused" fails env SALLAPUSH_JAVA_HOME="$jdks/empty" "$BASH" -c \
    ". \"\$0\"; sp_java_home" "$scripts/common.sh"
  check "without it, the JDK 21 in ~/.sallapush-tools, before java_home's" ok java_home_of "$tools" "$jdks/21"
  says "it prints it" "$tools/.sallapush-tools/jdk-21/Contents/Home"
  check "else java_home's JDK 21" ok java_home_of "$work/home" "$jdks/21"
  says "it prints it" "$jdks/21"
  check "java_home's answer of another major is refused" fails java_home_of "$work/home" "$jdks/17"
  says "it says how to install JDK 21" "temurin21-binaries/releases/download/jdk-21.0.12.1%2B1"
  says "  ... and its checksum" "3623232f33a9c3baadf304480b2535f9a3cba8a58d42ecbb438ba267315d9998"
  check "a JDK 21 home reads as 21" ok test "$(major "$jdks/21")" = 21
  check "a JDK 1.8 home reads as 8" ok test "$(major "$jdks/8")" = 8
}

# common.sh: sp_ios_sdk_checkout, the check before a local clone replaces the remote SallaPush iOS package

test_ios_sdk_checkout() {
  local clone="$work/ios-sdk/sallapush-ios-sdk" copy="$work/ios-sdk/copy/sallapush-ios-sdk" version
  local file=Sources/SallaPushCore/SallaPushVersion.swift script="$work/ios-sdk-checkout.sh"
  section "common.sh: sp_ios_sdk_checkout (VERIFY_IOS_SDK_CHECKOUT)"
  version="$("$BASH" -c ". \"\$0\"; sp_pins \"\$1\" current ios" "$scripts/common.sh" "$root")"
  cat >"$script" <<EOF
#!/usr/bin/env bash
set -euo pipefail
. "$scripts/common.sh"
sp_ios_sdk_checkout "$version"
EOF
  checkout_of() { env VERIFY_IOS_SDK_CHECKOUT="$1" bash "$script"; }
  in_clone() { git -C "$clone" "$@"; }
  # A scratch SallaPush iOS: its version file, committed and tagged as the native SDK tags a release.
  mkdir -p "$clone/${file%/*}"
  printf 'package let sallaPushSDKVersion = "%s"\n' "$version" >"$clone/$file"
  in_clone init -q
  in_clone add -A
  in_clone commit -q -m "SallaPush iOS $version"
  in_clone tag -a -m "SallaPush iOS $version" "$version"

  check "a clean clone at the pinned tag passes" ok checkout_of "$clone"
  says "it prints the clone's path" "$(cd "$clone" && pwd -P)"
  printf '// A local change.\n' >>"$clone/$file"
  check "a change to a file of the tag is refused" fails checkout_of "$clone"
  says "it says why" "VERIFY_IOS_SDK_CHECKOUT has changes, so it is not SallaPush iOS $version exactly"
  in_clone checkout -q -- "$file"
  printf 'let added = 1\n' >"$clone/${file%/*}/Added.swift"
  check "a file that the tag does not have is refused" fails checkout_of "$clone"
  says "it says why" "VERIFY_IOS_SDK_CHECKOUT has changes"
  in_clone add -A
  in_clone commit -q -m "a commit after the release, at the same version"
  check "a later commit with the same version is refused" fails checkout_of "$clone"
  says "it says which tag to check out" "VERIFY_IOS_SDK_CHECKOUT is not at the tag $version"
  in_clone checkout -q "$version"
  check "  ... and passes once the tag is checked out" ok checkout_of "$clone"
  mkdir -p "${copy%/*}"
  cp -R "$clone" "$copy"
  rm -rf "${copy:?}/.git"
  check "a copy of the release that is no git clone is refused" fails checkout_of "$copy"
  says "it says why" "VERIFY_IOS_SDK_CHECKOUT is not a git clone"
  in_clone tag -d "$version" >/dev/null
  check "a clone without the pinned tag is refused" fails checkout_of "$clone"
  says "it names the tag" "VERIFY_IOS_SDK_CHECKOUT has no tag $version"
  printf 'package let sallaPushSDKVersion = "0.0.0"\n' >"$clone/$file"
  in_clone commit -q -a -m "another version"
  in_clone tag -a -m "SallaPush iOS $version" "$version"
  check "a tag of another version is refused" fails checkout_of "$clone"
  says "it names the version" "VERIFY_IOS_SDK_CHECKOUT is not SallaPush iOS $version"
  mv "$clone" "$work/ios-sdk/sallapush"
  check "a folder with another name is refused" fails checkout_of "$work/ios-sdk/sallapush"
  says "it says why" "VERIFY_IOS_SDK_CHECKOUT must be a folder named sallapush-ios-sdk"
  check "a folder that does not exist is refused" fails checkout_of "$clone"
  says "it names it" "VERIFY_IOS_SDK_CHECKOUT=$clone does not exist"
}

# ---------------------------------------------------------------------------------------------------------------------
# verified-label.sh

test_verified_label() {
  local bin="$work/bin-api" api="$work/github-api" head=1111111111111111111111111111111111111111
  local newer=2222222222222222222222222222222222222222 older=3333333333333333333333333333333333333333 label
  section "verified-label.sh (ci.yml, job Native verified)"
  mkdir -p "$api"
  # Stands in for curl against GitHub's REST API: serves $FAKE_API/<path>.json, with / ? & = in the path turned into
  # _; a missing file is a 404, which --fail turns into exit 22. Every call's arguments are recorded.
  stand_in "$bin/curl" <<'EOF'
printf "%s\n" "$*" >>"$FAKE_RECORD"
cat >/dev/null
for url; do :; done
path="${url#*://*/}"
file="$FAKE_API/$(printf "%s" "$path" | tr "/?&=" "____").json"
[ -f "$file" ] || { echo "curl: (22) The requested URL returned error: 404" >&2; exit 22; }
cat "$file"
EOF
  gate() {
    env PATH="$bin:$PATH" FAKE_API="$api" FAKE_RECORD="$work/api-curl.args" GITHUB_API_URL=https://api.example.invalid \
      GITHUB_REPOSITORY=o/r GH_TOKEN=api-token-value PR_NUMBER="$1" HEAD_SHA="$2" "$scripts/verified-label.sh"
  }
  # fixture <live head> <labels JSON> <events JSON> <comments JSON>: one page of each.
  fixture() {
    rm -f "${api:?}"/*.json
    printf '{"head": {"sha": "%s"}, "labels": [%s]}\n' "$1" "$2" >"$api/repos_o_r_pulls_5.json"
    printf '%s\n' "$3" >"$api/repos_o_r_issues_5_events_per_page_100_page_1.json"
    printf '%s\n' "$4" >"$api/repos_o_r_issues_5_comments_per_page_100_page_1.json"
  }
  labeled() { printf '{"id": 1, "event": "labeled", "actor": {"login": "%s"}, "label": {"name": "native-verified-locally"}, "created_at": "%s"}' "$1" "$2"; }
  unlabeled() { printf '{"id": 2, "event": "unlabeled", "actor": {"login": "%s"}, "label": {"name": "native-verified-locally"}, "created_at": "%s"}' "$1" "$2"; }
  comment() {
    python3 -c 'import json, sys; print(json.dumps({"id": 9, "user": {"login": sys.argv[1]}, "created_at": sys.argv[2], "updated_at": sys.argv[4] or sys.argv[2], "body": sys.argv[3], "html_url": "https://github.example.invalid/o/r/pull/5#issuecomment-9"}))' \
      "$1" "$2" "$3" "${4:-}"
  }
  label='{"name": "native-verified-locally"}'

  check "a push without a pull request passes with a warning" ok gate "" "$head"
  says "it warns" "::warning::"
  fixture "$head" "" "[]" "[]"
  check "a pull request without the label fails" fails gate 5 "$head"
  says "it says what to do" "Add the label native-verified-locally"
  says "  ... and which comment attests the head" "comment 'native-verified-locally $head'"
  fixture "$head" "$label" "[$(labeled alice 2026-10-03T10:00:00Z)]" \
    "[$(comment alice 2026-10-03T10:05:00Z "$(printf 'native-verified-locally %s\nstep\tresult\nlint\tpassed' "$head")")]"
  check "the labeler's comment that names the head, with the run's summary, passes" ok gate 5 "$head"
  says "it names the commit and the person" "The SDK at $head was verified locally: @alice"
  fixture "$head" "$label" "[$(labeled alice 2026-10-01T10:00:00Z)]" \
    "[$(comment alice 2026-10-01T10:05:00Z "native-verified-locally $older"), $(comment alice 2026-10-03T10:05:00Z "native-verified-locally $head")]"
  check "after a push, a new comment that names the new head passes, the label untouched" ok gate 5 "$head"
  fixture "$head" "$label" "[$(labeled alice 2026-10-03T10:00:00Z)]" "[$(comment alice 2026-10-03T10:05:00Z "native-verified-locally $older")]"
  check "a comment that names another commit fails" fails gate 5 "$head"
  says "it names both commits" "names 333333333333, not this run's head 111111111111"
  fixture "$head" "$label" "[$(labeled alice 2026-10-03T10:00:00Z)]" \
    "[$(comment alice 2026-10-03T10:05:00Z "native-verified-locally $head"), $(comment alice 2026-10-03T10:06:00Z "native-verified-locally $older")]"
  check "only the latest attestation counts" fails gate 5 "$head"
  fixture "$head" "$label" "[$(labeled alice 2026-10-03T10:00:00Z)]" "[]"
  check "a label without an attestation fails" fails gate 5 "$head"
  says "it says who must say which commit" "@alice added the label native-verified-locally but has not said which commit they verified"
  fixture "$head" "$label" "[$(labeled alice 2026-10-03T10:00:00Z)]" "[$(comment bob 2026-10-03T10:05:00Z "native-verified-locally $head")]"
  check "someone else's comment does not attest for the person who added the label" fails gate 5 "$head"
  fixture "$head" "$label" "[$(labeled alice 2026-10-03T09:00:00Z), $(unlabeled alice 2026-10-03T09:30:00Z), $(labeled bob 2026-10-03T10:00:00Z)]" \
    "[$(comment alice 2026-10-03T10:05:00Z "native-verified-locally $head")]"
  check "once someone else adds the label again, they attest" fails gate 5 "$head"
  says "it names them" "@bob added the label"
  fixture "$head" "$label" "[$(labeled alice 2026-10-03T10:00:00Z)]" \
    "[$(comment alice 2026-10-03T10:05:00Z "native-verified-locally $head" 2026-10-03T11:00:00Z)]"
  check "an edited or hidden attestation fails" fails gate 5 "$head"
  says "it says why" "was changed after it was posted (edited or hidden), so it attests nothing"
  fixture "$head" "$label" "[$(labeled alice 2026-10-03T10:00:00Z)]" \
    "[$(comment alice 2026-10-03T10:05:00Z "native-verified-locally $(printf '%s' "$head" | cut -c1-12)")]"
  check "an abbreviated commit id does not count" fails gate 5 "$head"
  says "it says what the comment must read" "does not read 'native-verified-locally <the full 40-character commit id>'"
  fixture "$newer" "$label" "[$(labeled alice 2026-10-03T10:00:00Z)]" "[$(comment alice 2026-10-03T10:05:00Z "native-verified-locally $head")]"
  check "a run of a commit that is no longer the head fails" fails gate 5 "$head"
  says "it names the newer head" "the pull request's head is now 222222222222"
  fixture "$head" "$label" "[]" "[$(comment alice 2026-10-03T10:05:00Z "native-verified-locally $head")]"
  check "a label without a labeled event fails" fails gate 5 "$head"
  # More than 100 events and comments: the second pages are read.
  fixture "$head" "$label" \
    "[$(python3 -c 'import json; print(", ".join(json.dumps({"id": n, "event": "referenced", "created_at": "2026-10-03T09:%02d:00Z" % (n % 60)}) for n in range(100)))')]" \
    "[$(python3 -c 'import json; print(", ".join(json.dumps({"id": n, "user": {"login": "carol"}, "created_at": "2026-10-03T09:00:00Z", "updated_at": "2026-10-03T09:00:00Z", "body": "LGTM"}) for n in range(100)))')]"
  printf '[%s]\n' "$(labeled alice 2026-10-03T10:00:00Z)" >"$api/repos_o_r_issues_5_events_per_page_100_page_2.json"
  printf '[%s]\n' "$(comment alice 2026-10-03T10:05:00Z "native-verified-locally $head")" >"$api/repos_o_r_issues_5_comments_per_page_100_page_2.json"
  check "a label and an attestation on second pages pass" ok gate 5 "$head"
  rm "${api:?}/repos_o_r_issues_5_comments_per_page_100_page_2.json"
  check "a page GitHub does not serve fails the gate" fails gate 5 "$head"
  says "it says why" "404"
  check "the token never reaches curl's command line" fails grep -q api-token-value "$work/api-curl.args"
  check "no redirect is followed with the token" fails grep -qE -- '(^| )(--location|-L)( |$)' "$work/api-curl.args"
}

# ---------------------------------------------------------------------------------------------------------------------
# A copy of this repository's files (what a commit would take), for the cases that change files; each case starts from
# a fresh copy. The copy is a git repository without commits, so every file is untracked and not ignored.

pristine="$work/pristine"
case_dir="$work/case"

make_pristine() {
  local name
  mkdir -p "$pristine"
  git -C "$root" ls-files -z --cached --others --exclude-standard >"$work/files"
  while IFS= read -r -d '' name; do
    [ -f "$root/$name" ] || continue
    mkdir -p "$pristine/$(dirname "$name")"
    cp -p "$root/$name" "$pristine/$name"
  done <"$work/files"
  git -C "$pristine" init -q
}

fresh() {
  rm -rf "${case_dir:?}"
  cp -Rp "$pristine" "$case_dir"
}

# ---------------------------------------------------------------------------------------------------------------------
# bump-native.sh

test_bump_native() {
  local bin="$work/bin-bump" served="$work/gh-served" version target missing line ios_pins android_pins
  section "bump-native.sh (verify.sh pins, and native bumps)"
  # Stands in for gh api: serves $FAKE_GH/<repository>/<tag>/<path>; anything else is GitHub's 404.
  stand_in "$bin/gh" <<'EOF'
for argument; do :; done
request="${argument#repos/SallaApp/}"
repository="${request%%/*}"
file="${request#*/contents/}"
file="${file%%\?*}"
tag="${request##*ref=}"
[ -f "$FAKE_GH/$repository/$tag/$file" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
cat "$FAKE_GH/$repository/$tag/$file"
EOF
  # Stands in for node: records the script it runs, and exits with FAKE_NODE_STATUS.
  stand_in "$bin/node" <<'EOF'
printf "%s\n" "$*" >>"$FAKE_NODE_RECORD"
exit "${FAKE_NODE_STATUS:-0}"
EOF
  # node_status: what the parity check exits with.
  bump() {
    (cd "$case_dir" && env PATH="$bin:$PATH" FAKE_GH="$served" FAKE_NODE_RECORD="$work/node.args" \
      FAKE_NODE_STATUS="${node_status:-0}" scripts/bump-native.sh "$@")
  }
  version="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["nativeVersions"]["ios"])' "$pristine/tool/api-parity/mapping.json")"
  # The next minor release after the pinned one, whose API files gh serves, and the one after it, which gh doesn't
  # serve: a bump to either always moves the pins.
  target="$(python3 -c 'import sys; v = sys.argv[1].split("-")[0].split("."); print(f"{v[0]}.{int(v[1]) + 1}.0")' "$version")"
  missing="$(python3 -c 'import sys; v = sys.argv[1].split("-")[0].split("."); print(f"{v[0]}.{int(v[1]) + 2}.0")' "$version")"
  mkdir -p "$served/sallapush-ios-sdk/$target" "$served/sallapush-android-sdk/$target/sallapush/api"
  printf 'SallaPush | swift.class | SallaPush | @objc(SallaPush) final class SallaPush\n' >"$served/sallapush-ios-sdk/$target/API.txt"
  printf 'public final class com/salla/push/SallaPush {\n}\n' >"$served/sallapush-android-sdk/$target/sallapush/api/sallapush.api"

  fresh
  check "this repository's pins agree" ok bump --check
  # The docs name the versions as often as they need to, so the counts come from this check; a bump must set them all.
  ios_pins="$(sed -nE "s/^ios $version: ([0-9]+) pins agree$/\1/p" "$out")"
  android_pins="$(sed -nE "s/^android $version: ([0-9]+) pins agree$/\1/p" "$out")"
  # The code's 8 iOS pins (the podspec, Package.swift, the example's Xcode project, docs/snippets/Podfile's four, and
  # mapping.json) and 2 Android pins, and at least one of each kind the README must hold: the versions it names, its
  # versions table, its Podfile lines (iOS) and its links to the native docs.
  check "  ... every iOS pin of the code and the README" ok test "${ios_pins:-0}" -ge 12
  check "  ... every Android pin of the code and the README" ok test "${android_pins:-0}" -ge 5
  fresh; edit "$case_dir/Package.swift" "exact: \"$version\"" "exact: \"9.9.9\""
  line="$(grep -n 'exact: "9.9.9"' "$case_dir/Package.swift" | cut -d : -f 1)"
  check "a pin that disagrees fails" fails bump --check
  says "it names the pin" "Package.swift:$line 9.9.9"
  fresh; edit "$case_dir/README.md" "SallaPush Android $version" "SallaPush Android 9.9.9"
  line="$(grep -n "SallaPush Android 9.9.9" "$case_dir/README.md" | cut -d : -f 1)"
  check "a version the README names is a pin" fails bump --check
  says "it names the line" "README.md:$line 9.9.9"
  fresh; edit "$case_dir/android/build.gradle" "com.salla.push:sallapush:$version" "com.salla.push:sallapush:+"
  check "a file that lost its pin fails" fails bump --check
  says "it names the file" "android/build.gradle has no android pin"
  check "a version that isn't a release is refused" fails bump v1.0.3
  says "it says why" "'v1.0.3' is not a SallaPush iOS release"
  check "iOS 1.0.1, a stray tag, is refused" fails bump --ios 1.0.1 --android 1.0.3
  says "it says why" "SallaPush iOS 1.0.1 is a stray tag, not a release"
  check "one platform alone is a usage error" fails bump --ios 1.0.3

  fresh
  : >"$work/node.args"
  check "a bump to a tag gh can't read stops" fails bump "$missing"
  says "it says which file and tag" "cannot read API.txt at $missing from SallaApp/sallapush-ios-sdk"
  check "  ... and changes no pin" ok grep -qF "s.dependency \"SallaPush\", \"$version\"" "$case_dir/Salla.saSallapushCapacitor.podspec"
  check "a bump to the next minor release passes" ok bump "$target"
  says "it sets every iOS pin" "ios: $ios_pins pins set to $target"
  says "it sets every Android pin" "android: $android_pins pins set to $target"
  check "  ... and they agree" ok bump --check
  says "  ... on $target" "ios $target: $ios_pins pins agree"
  check "  ... in docs/snippets/Podfile, four times" ok \
    test "$(grep -cF ":tag => '$target'" "$case_dir/docs/snippets/Podfile")" -eq 4
  check "  ... in Package.swift" ok grep -qF "exact: \"$target\"" "$case_dir/Package.swift"
  check "  ... in the extension's package requirement" ok \
    grep -qE "^[[:space:]]*version = $target;\$" "$case_dir/example-app/ios/App/App.xcodeproj/project.pbxproj"
  check "  ... in android/build.gradle" ok grep -qF "com.salla.push:sallapush:$target" "$case_dir/android/build.gradle"
  check "  ... in mapping.json" ok grep -qF "\"android\": \"$target\"" "$case_dir/tool/api-parity/mapping.json"
  check "  ... in the README" ok grep -qF "SallaPush iOS $target and SallaPush Android $target" "$case_dir/README.md"
  check "  ... in the README's versions table" ok grep -qF "| $target | $target |" "$case_dir/README.md"
  check "  ... in the README's Podfile lines" ok grep -qF ":tag => '$target'" "$case_dir/README.md"
  check "  ... in the README's links to the native docs" ok grep -qF "sallapush-android-sdk/blob/$target/" "$case_dir/README.md"
  check "  ... and to the iOS ones" ok grep -qF "sallapush-ios-sdk/blob/$target/" "$case_dir/README.md"
  check "  ... in docs/SETUP.md's Podfile lines" ok grep -qF ":tag => '$target'" "$case_dir/docs/SETUP.md"
  check "  ... in docs/SETUP.md's links to the native docs" ok grep -qF "sallapush-android-sdk/blob/$target/" \
    "$case_dir/docs/SETUP.md"
  check "  ... and to the iOS ones" ok grep -qF "sallapush-ios-sdk/blob/$target/" "$case_dir/docs/SETUP.md"
  check "  ... in docs/REFERENCE.md" ok grep -qF "SallaPush iOS $target and SallaPush Android $target" \
    "$case_dir/docs/REFERENCE.md"
  check "  ... in docs/TROUBLESHOOTING.md's CocoaPods message" ok grep -qF "SallaPush (= $target)" \
    "$case_dir/docs/TROUBLESHOOTING.md"
  check "  ... with the API files of the new tags" ok cmp -s "$served/sallapush-ios-sdk/$target/API.txt" \
    "$case_dir/tool/api-parity/native-ios-API.txt"
  # The line joins the Changed lines that [Unreleased] already has, or starts that section.
  check "  ... and the CHANGELOG line under Changed" ok python3 -c '
import sys
text = open(sys.argv[1], encoding="utf-8").read()
unreleased = text.split("## [Unreleased]", 1)[1].split("\n## ", 1)[0]
version = sys.argv[2]
assert unreleased.count("### Changed\n") == 1, unreleased
changed = unreleased.split("### Changed\n", 1)[1].split("\n### ", 1)[0]
assert changed.startswith("\n- "), unreleased
assert f"\n- SallaPush iOS {version} and SallaPush Android {version}.\n" in changed, unreleased
assert "### Added" not in unreleased or unreleased.index("### Added") < unreleased.index("### Changed"), unreleased' \
    "$case_dir/CHANGELOG.md" "$target"
  check "  ... and it ran the parity check" ok grep -q 'check-api-parity.mjs' "$work/node.args"
  check "the same bump again adds no second CHANGELOG line" ok bump "$target"
  check "  ... so the line is there once" ok test "$(grep -cF "SallaPush iOS $target and SallaPush Android $target" "$case_dir/CHANGELOG.md")" -eq 1
  fresh
  node_status=1 check "a bump whose parity check fails, fails" fails bump "$target"
  says "it says what to do" "map each native symbol named above in tool/api-parity/mapping.json"

  # gh serves no API file at the pinned version, so these pass only without fetching it.
  fresh
  check "a bump to the versions already pinned passes" ok bump "$version"
  says "it says so for iOS" "SallaPush iOS already at $version"
  says "  ... and for Android" "SallaPush Android already at $version"
  check "  ... and changes nothing" ok diff -rq --exclude=.git "$pristine" "$case_dir"
  fresh
  check "a bump that moves one of the two platforms passes" ok bump --ios "$version" --android "$target"
  says "it keeps iOS" "SallaPush iOS already at $version"
  says "  ... and sets every Android pin" "android: $android_pins pins set to $target"
  check "  ... the CHANGELOG line names Android only" ok grep -qxF -- "- SallaPush Android $target." "$case_dir/CHANGELOG.md"
  check "  ... and the iOS API file is unchanged" ok cmp -s "$pristine/tool/api-parity/native-ios-API.txt" \
    "$case_dir/tool/api-parity/native-ios-API.txt"
}

# ---------------------------------------------------------------------------------------------------------------------
# release-dist.sh

test_release_dist() {
  local repo="$work/release" bin="$work/bin-release" clone commit
  section "release-dist.sh (releases, and verify.sh consumer)"
  # Stand-ins for Yarn (the build writes dist/) and npm pack (packs a fixed list into the npm layout).
  stand_in "$bin/yarn" <<'EOF'
case " $* " in
  *" build "*) mkdir -p dist/esm
    for file in dist/esm/index.js dist/esm/index.d.ts dist/plugin.cjs.js dist/plugin.js; do echo "export {};" >"$file"; done ;;
esac
EOF
  stand_in "$bin/npm" <<'EOF'
destination="$4"
rm -rf "$destination/package"
mkdir -p "$destination/package"
cp -R package.json dist android ios Package.swift Salla.saSallapushCapacitor.podspec "$destination/package/"
(cd "$destination" && tar -czf salla.sa-sallapush-capacitor-1.0.0.tgz package && rm -rf package)
echo "[{\"filename\": \"salla.sa-sallapush-capacitor-1.0.0.tgz\"}]"
EOF
  mkdir -p "$repo/scripts" "$repo/android/src/main/java/sa/salla/sallapush/capacitor" \
    "$repo/ios/Sources/SallaPushCapacitorPlugin" "$repo/src"
  cp "$scripts/release-dist.sh" "$scripts/common.sh" "$repo/scripts/"
  python3 - "$repo/package.json" <<'PY'
import json, sys
package = {
    "name": "@salla.sa/sallapush-capacitor", "version": "1.0.0", "description": "SallaPush.", "license": "MIT",
    "author": "Salla",
    "repository": {"type": "git", "url": "git+https://github.com/SallaApp/sallapush-capacitor-sdk.git"},
    "bugs": {"url": "https://github.com/SallaApp/sallapush-capacitor-sdk/issues"},
    "homepage": "https://github.com/SallaApp/sallapush-capacitor-sdk#readme", "keywords": ["capacitor"],
    "main": "dist/plugin.cjs.js", "module": "dist/esm/index.js", "types": "dist/esm/index.d.ts",
    "unpkg": "dist/plugin.js", "files": ["dist/**", "android/build.gradle", "android/src/main/**", "ios/Sources/**",
                                         "Package.swift", "Salla.saSallapushCapacitor.podspec"],
    "capacitor": {"ios": {"src": "ios"}, "android": {"src": "android"}}, "publishConfig": {"access": "public"},
    "scripts": {"build": "tsc && rollup -c rollup.config.mjs", "prepack": "tsc && rollup -c rollup.config.mjs"},
    "peerDependencies": {"@capacitor/core": "^8.0.0"},
    "devDependencies": {"typescript": "6.0.3"}, "workspaces": ["example-app"], "packageManager": "yarn@4.11.0",
    "jest": {"testEnvironment": "node"},
}
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump(package, handle, indent=2)
PY
  printf 'export {};\n' >"$repo/src/index.ts"
  printf '// swift-tools-version: 5.9\n' >"$repo/Package.swift"
  printf 's.version = package["version"]\ns.summary = package["description"]\ns.homepage = package["homepage"]\n' \
    >"$repo/Salla.saSallapushCapacitor.podspec"
  printf 'apply plugin: "com.android.library"\n' >"$repo/android/build.gradle"
  printf '<manifest />\n' >"$repo/android/src/main/AndroidManifest.xml"
  printf 'class SallaPushPlugin\n' >"$repo/android/src/main/java/sa/salla/sallapush/capacitor/SallaPushPlugin.kt"
  printf 'final class SallaPushPlugin {}\n' >"$repo/ios/Sources/SallaPushCapacitorPlugin/SallaPushPlugin.swift"
  printf '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- The SDK.\n' >"$repo/CHANGELOG.md"
  printf 'dist/\n' >"$repo/.gitignore"
  g() { git -C "$repo" "$@"; }
  g init -q
  g symbolic-ref HEAD refs/heads/master
  g add -A
  g commit -q -m "feat: the package"
  release() { (cd "$repo" && env PATH="$bin:$PATH" YARN="$bin/yarn" scripts/release-dist.sh "$@"); }
  # dry_run <folder>: a dry run into <folder>, as verify.sh consumer makes one.
  dry_run() {
    env RELEASE_DIST_DIR="$1" bash -c \
      "cd '$repo' && PATH='$bin':\"\$PATH\" YARN='$bin/yarn' scripts/release-dist.sh 1.0.0 --dry-run"
  }

  check "no version is a usage error" fails release
  check "an unknown option is a usage error" fails release 1.0.0 --push
  : >"$repo/stray.txt"
  check "a working tree with changes is refused" fails release 1.0.0 --dry-run
  says "it says why" "the working tree has changes"
  rm "$repo/stray.txt"
  check "another version than package.json's is refused" fails release 1.0.1 --dry-run
  says "it names both" "package.json declares 1.0.0, not 1.0.1"
  check "a release without its CHANGELOG entry is refused" fails release 1.0.0
  says "it says which" "add the '## [1.0.0]' entry to CHANGELOG.md first"
  mkdir -p "$work/not-empty"
  : >"$work/not-empty/file"
  check "a dry run into a folder that isn't empty is refused" fails dry_run "$work/not-empty"
  says "it says why" "is not empty"

  check "a dry run passes" ok dry_run "$work/dist"
  says "it prints the clone" "dist_repo=$work/dist"
  clone="$(sed -n 's/^dist_repo=//p' "$out")"
  commit="$(sed -n 's/^dist_commit=//p' "$out")"
  check "  ... a commit whose parent is HEAD" ok test "$(git -C "$clone" rev-parse "$commit^")" = "$(g rev-parse HEAD)"
  check "  ... tagged 1.0.0 in the clone" ok test "$(git -C "$clone" rev-parse 1.0.0)" = "$commit"
  check "  ... unsigned" fails bash -c "git -C '$clone' cat-file -p '$commit' | grep -q '^gpgsig'"
  check "  ... with the built library" ok git -C "$clone" cat-file -e "$commit:dist/plugin.cjs.js"
  check "  ... and the native sources" ok git -C "$clone" cat-file -e \
    "$commit:ios/Sources/SallaPushCapacitorPlugin/SallaPushPlugin.swift"
  check "  ... and a package.json reduced to the allowlist, capacitor and publishConfig kept, no scripts" ok python3 -c '
import json, subprocess, sys
package = json.loads(subprocess.check_output(["git", "-C", sys.argv[1], "show", sys.argv[2] + ":package.json"]))
assert list(package) == ["name", "version", "description", "license", "repository", "bugs", "homepage", "keywords",
                         "main", "module", "types", "unpkg", "files", "capacitor", "publishConfig",
                         "peerDependencies"], list(package)
assert package["capacitor"] == {"ios": {"src": "ios"}, "android": {"src": "android"}}, package["capacitor"]
assert package["publishConfig"] == {"access": "public"}, package["publishConfig"]' \
    "$clone" "$commit"
  check "  ... and this repository has no tag" fails g rev-parse -q --verify refs/tags/1.0.0
  check "  ... and a clean working tree" ok test -z "$(g status --porcelain)"

  # Ignored files pass the clean-tree check, and npm packs them when they sit in a folder that files names.
  mkdir -p "$repo/dist"
  printf 'module.exports = "stale";\n' >"$repo/dist/stale.js"
  check "a dry run builds afresh" ok dry_run "$work/dist-stale"
  commit="$(sed -n 's/^dist_commit=//p' "$out")"
  check "  ... so stale build output doesn't ship" fails git -C "$work/dist-stale" cat-file -e "$commit:dist/stale.js"
  printf 'google-services.json\n' >>"$repo/.gitignore"
  g commit -q -am "chore: ignore the firebase configuration"
  printf '{}\n' >"$repo/android/google-services.json"
  check "a file that .gitignore hides in a packed folder is refused" fails dry_run "$work/dist-ignored"
  says "it names the file" "android/google-services.json"
  says "it says what to do" "release from a fresh clone"
  check "  ... and makes no dist commit" fails test -e "$work/dist-ignored"
  check "  ... and no tag" fails g rev-parse -q --verify refs/tags/1.0.0
  rm "$repo/android/google-services.json"

  python3 - "$repo/package.json" <<'PY'
import json, sys
package = json.load(open(sys.argv[1], encoding="utf-8"))
del package["capacitor"]["ios"]
json.dump(package, open(sys.argv[1], "w", encoding="utf-8"), indent=2)
PY
  g commit -q -am "feat: no ios plugin"
  check "a package whose capacitor key lacks a platform is refused" fails dry_run "$work/dist-2"
  says "it says why" "package.json's capacitor.ios.src is not \"ios\": Capacitor's CLI would not find the ios plugin"
  g revert --no-edit HEAD >/dev/null
  python3 - "$repo/package.json" <<'PY'
import json, sys
package = json.load(open(sys.argv[1], encoding="utf-8"))
package["files"] = ["dist/**", "android/src/main", "ios/Sources/**"]
json.dump(package, open(sys.argv[1], "w", encoding="utf-8"), indent=2)
PY
  g commit -q -am "feat: a nested folder in files"
  check "a nested folder in files without a glob is refused" fails dry_run "$work/dist-4"
  says "it says what to write" "files lists the folder android/src/main, which Yarn's pack drops: write android/src/main/**"
  g revert --no-edit HEAD >/dev/null
  printf 's.authors = package["author"]\n' >>"$repo/Salla.saSallapushCapacitor.podspec"
  g commit -q -am "feat: a podspec that reads author"
  check "a podspec that reads a key the dist drops is refused" fails dry_run "$work/dist-3"
  says "it names the key" "the podspec reads package.json's author, which the dist package.json lacks"
  g revert --no-edit HEAD >/dev/null
  printf '\n## [1.0.0] - 2026-10-20\n\n- The SDK.\n' >>"$repo/CHANGELOG.md"
  g commit -q -am "docs: release 1.0.0"
  check "a release without an origin to check master on is refused" fails release 1.0.0
  says "it says why" "can't fetch master from origin"
  # origin's master stops at the commit above, as if the next one were never merged.
  git clone -q --bare "$repo" "$work/release-origin.git"
  g remote add origin "$work/release-origin.git"
  printf 'An unreviewed change.\n' >"$repo/unreviewed.txt"
  g add unreviewed.txt
  g commit -q -m "feat: an unreviewed change"
  check "a release of a commit that isn't on origin's master is refused" fails release 1.0.0
  says "it names the commit" "HEAD $(g rev-parse HEAD) isn't on origin's master: release a merged commit"
  check "  ... and makes no tag" fails g rev-parse -q --verify refs/tags/1.0.0
  check "  ... while a dry run of it passes, as verify.sh consumer makes one" ok dry_run "$work/dist-unmerged"
  git -C "$work/release-origin.git" fetch -q "$repo" master:master
  check "a merged release that can't be signed (no signing key here) fails" fails release 1.0.0
  says "it makes no dist commit" "the dist commit was not made"
  check "  ... and no tag" fails g rev-parse -q --verify refs/tags/1.0.0
}

# ---------------------------------------------------------------------------------------------------------------------
# verify.sh tree

test_verify_tree() {
  local checkout_pin
  section "verify.sh: steps and the tree step"
  run() { (cd "$case_dir" && scripts/verify.sh "$@"); }
  g() { git -C "$case_dir" "$@"; }

  fresh
  check "this repository's files pass" ok run tree
  check "an unknown step is refused" fails run everything
  says "it lists the steps" "steps: lint typecheck test build pack api parity snippets pins tree shell"
  fresh; printf '{}\n' >"$case_dir/example-app/android/app/google-services.json"
  g add -f example-app/android/app/google-services.json
  check "a Firebase configuration added past .gitignore fails" fails run tree
  says "it names it" "example-app/android/app/google-services.json: a file of credentials"
  fresh; printf 'TOKEN=x\n' >"$case_dir/.env.local"; g add -f .env.local
  check "a .env file added past .gitignore fails" fails run tree
  says "it names it" ".env.local: a file of credentials"
  fresh; : >"$case_dir/Release.P12"; g add -f Release.P12
  check "a signing key fails, whatever its case" fails run tree
  says "it names it" "Release.P12: a file of credentials"
  # The secrets are assembled at run time, so that this file never holds one.
  fresh; printf 'const token = "%s%s";\n' 'ghp_' 'abcdefghijklmnopqrstuvwxyz0123456789' >"$case_dir/src/token.ts"
  check "a GitHub token in any file fails" fails run tree
  says "it names the file" "src/token.ts: holds a GitHub token"
  cp "$out" "$work/token.out"
  check "  ... and never prints the token" fails grep -q 'abcdefghijklmnopqrstuvwxyz0123456789' "$work/token.out"
  fresh; printf 'GITHUB_TOKEN=%s%s\n' 'gho_' 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij' >"$case_dir/scripts/notes.txt"
  check "a GitHub OAuth token, as gh auth token prints it, fails" fails run tree
  says "it names the file" "scripts/notes.txt: holds a GitHub token"
  fresh; printf '%s%s\n' '-----BEGIN RSA ' 'PRIVATE KEY-----' >"$case_dir/example-app/key.txt"
  check "a private key in any file fails" fails run tree
  says "it names the file" "example-app/key.txt: holds a private key"
  fresh; printf '%s%s\n' '-----BEGIN PGP ' 'PRIVATE KEY BLOCK-----' >"$case_dir/example-app/key.asc"
  check "a PGP private key fails" fails run tree
  says "it names the file" "example-app/key.asc: holds a private key"
  fresh; printf 'url = https://%s%s@github.com\n' 'x-access' '-token:abc' >"$case_dir/notes.txt"
  check "a token in a git URL fails" fails run tree
  says "it names the file" "notes.txt: holds a token in a git URL"
  fresh; printf 'url = https://%s%s{TOKEN}@github.com\n' 'x-access' '-token:$' >"$case_dir/notes.txt"
  check "a git URL with a variable in place of the token passes" ok run tree
  fresh; printf 'NODE_BINARY = %s%s/someone/node\n' '/Us' 'ers' >"$case_dir/example-app/ios/App/Config/Node.xcconfig"
  check "a personal home path fails" fails run tree
  says "it names the file" "example-app/ios/App/Config/Node.xcconfig: holds a personal home path"
  fresh; edit "$case_dir/example-app/ios/App/App.xcodeproj/project.pbxproj" \
    "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;" \
    "CODE_SIGN_ENTITLEMENTS = App/App.entitlements; $(printf 'DEVELOPMENT_%s = %s;' TEAM ABCDE12345)"
  check "an Apple team id fails" fails run tree
  says "it names the file and where the team goes" \
    "example-app/ios/App/App.xcodeproj/project.pbxproj: holds an Apple team id; set DEVELOPMENT_TEAM in the ignored"
  fresh; printf '// The fix for %s-%s.\n' TD 12345 >"$case_dir/src/notes.ts"
  check "a ticket key fails" fails run tree
  says "it names the file" "src/notes.ts: holds a ticket key"
  fresh; printf 'import XCTest\n' >"$case_dir/example-app/ios/App/AppTests/RegressionTests.swift"
  check "an example Swift file that no target compiles fails" fails run tree
  says "it names it" "example-app/ios/App/AppTests/RegressionTests.swift is in no Sources phase"
  checkout_pin="$(grep -m 1 -oE 'actions/checkout@[0-9a-f]{40}' "$pristine/.github/workflows/ci.yml")"
  fresh; edit "$case_dir/.github/workflows/ci.yml" "$checkout_pin" "actions/checkout@v7"
  check "an action pinned to a tag fails" fails run tree
  says "it says what to do" "uses actions/checkout@v7; pin it to a full commit id"
  fresh; rm "$case_dir/api/sallapush-capacitor.api"
  check "a missing required file fails" fails run tree
  says "it names it" "api/sallapush-capacitor.api is missing from what a commit takes"
  fresh; rm "$case_dir/docs/snippets/AndroidManifest-forwarding.xml"
  check "a missing snippet source fails" fails run tree
  says "it names it" "docs/snippets/AndroidManifest-forwarding.xml is missing from what a commit takes"
  fresh; printf 'CHANGELOG.md\n' >>"$case_dir/.gitignore"
  check "a required file that .gitignore hides fails" fails run tree
  says "it names it" "CHANGELOG.md is missing from what a commit takes"
  fresh; chmod -x "$case_dir/scripts/release-dist.sh"
  check "a script that lost its executable bit fails" fails run tree
  says "it names it" "scripts/release-dist.sh is not executable"
  fresh; g add scripts/bump-native.sh; g update-index --chmod=-x scripts/bump-native.sh
  check "a script staged without the executable mode fails" fails run tree
  says "it names it" "scripts/bump-native.sh is staged with mode 100644"
  fresh
  check "a fresh copy passes again" ok run tree
}

# ---------------------------------------------------------------------------------------------------------------------
# verify.sh pack: what npm would publish, from a stand-in npm pack --dry-run --json listing.

test_verify_pack() {
  local bin="$work/bin-pack" listing="$work/pack-listing.json"
  section "verify.sh: the pack step (what npm would publish)"
  # Stands in for npm pack --dry-run --json: prints $FAKE_PACK, and refuses any other command.
  stand_in "$bin/npm" <<'EOF'
[ "$1 $2 $3" = "pack --dry-run --json" ] || exit 64
cat "$FAKE_PACK"
EOF
  # pack_listing [--without <path>] [<extra path>...]: the listing of a correct package, built from the copy's files.
  pack_listing() {
    python3 - "$case_dir" "$listing" "$@" <<'PY'
import json, os, subprocess, sys

case, listing, args = sys.argv[1], sys.argv[2], sys.argv[3:]
without = {args[index + 1] for index, arg in enumerate(args) if arg == "--without"}
extra = [arg for index, arg in enumerate(args) if arg != "--without" and (index == 0 or args[index - 1] != "--without")]
native = subprocess.check_output(["git", "-C", case, "ls-files", "--cached", "--others", "--exclude-standard", "--",
                                  "ios/Sources", "android/src/main"], text=True).split()
paths = ["LICENSE", "README.md", "package.json", "Package.swift", "Salla.saSallapushCapacitor.podspec",
         "android/build.gradle", "android/consumer-rules.pro", "dist/esm/index.js", "dist/esm/index.d.ts",
         "dist/plugin.cjs.js", "dist/plugin.js", "dist/plugin.js.map"] + native + extra
with open(listing, "w", encoding="utf-8") as handle:
    json.dump([{"files": [{"path": path} for path in paths if path not in without]}], handle)
PY
  }
  packed() { (cd "$case_dir" && env PATH="$bin:$PATH" FAKE_PACK="$listing" scripts/verify.sh pack); }

  fresh; pack_listing
  check "the built library, the native sources and the manifests pass" ok packed
  says "it says what npm would publish" "the built library, the native sources, Package.swift, the podspec"
  fresh; pack_listing android/src/test/java/sa/salla/sallapush/capacitor/MappingTest.kt
  check "an Android unit test in the package fails" fails packed
  says "it names it" "npm would publish android/src/test/java/sa/salla/sallapush/capacitor/MappingTest.kt"
  fresh; pack_listing dist/esm/internal/__mocks__/native.js
  check "a mock in the built library fails" fails packed
  says "it names it" "npm would publish dist/esm/internal/__mocks__/native.js"
  fresh; pack_listing .github/workflows/publish.yml
  check "a dotfile fails" fails packed
  says "it names it" "npm would publish .github/workflows/publish.yml"
  fresh; pack_listing --without dist/plugin.cjs.js
  check "a package without the CommonJS build fails" fails packed
  says "it names it" "npm would not publish dist/plugin.cjs.js"
  fresh; pack_listing --without ios/Sources/SallaPushCapacitorPlugin/SallaPushPlugin.swift
  check "a package without a native source fails" fails packed
  says "it names it" "npm would not publish ios/Sources/SallaPushCapacitorPlugin/SallaPushPlugin.swift"
  fresh; pack_listing
  edit "$case_dir/package.json" '"license": "MIT",' '"private": true, "license": "MIT",'
  check "a private package.json fails" fails packed
  says "it says why" "package.json is private, so npm refuses to publish it"
  fresh; pack_listing
  edit "$case_dir/package.json" '"access": "public"' '"access": "restricted"'
  check "a package.json without public access fails" fails packed
  says "it says why" "npm would publish the scoped package as restricted"
}

# ---------------------------------------------------------------------------------------------------------------------
# verify.sh summary.tsv, the evidence an attestation quotes, and the clean run: in a copy that is committed, as a run's
# would be.

test_verify_summary() {
  local logs="$work/summary-logs" head next bin="$work/bin-leftover"
  section "verify.sh: summary.tsv and the clean run"
  logged() { (cd "$case_dir" && VERIFY_LOG_DIR="$logs" scripts/verify.sh "$@"); }
  commit_case() { git -C "$case_dir" add -A && git -C "$case_dir" commit -q -m "$1"; }
  # row <step> <commit> [<result> [<summary>]]: the summary has a row of <step> that names <commit>, with that result.
  row() { awk -F '\t' -v step="$1" -v commit="$2" -v result="${3:-}" \
    '$1 == step && $3 == commit && (result == "" || $2 == result) { found = 1 } END { exit !found }' \
    "${4:-$logs/summary.tsv}"; }

  fresh
  rm -rf "$logs"
  commit_case "the copy"
  head="$(git -C "$case_dir" rev-parse HEAD)"
  check "a run of a clean tree passes" ok logged tree
  check "  ... its summary names the commit and a clean tree first" ok test "$(head -n 1 "$logs/summary.tsv")" = "# $head clean"
  check "  ... and its row names the commit" ok row tree "$head"
  printf '\nA change.\n' >>"$case_dir/README.md"
  check "a run of the same commit with changes adds its row" ok logged tree
  check "  ... marked +dirty" ok row tree "$head+dirty"
  commit_case "another commit"
  next="$(git -C "$case_dir" rev-parse HEAD)"
  check "a run of another commit into the same summary is refused" fails logged tree
  says "it names both commits" "holds the runs of $head, not of $next"
  check "  ... and adds no row" fails grep -q "$next" "$logs/summary.tsv"

  # Stands in for node: the snippets step's check passes, and leaves a file in the working directory, the repository's.
  stand_in "$bin/node" <<'EOF'
: >leftover.txt
EOF
  leaves() { (cd "$case_dir" && env PATH="$bin:$PATH" VERIFY_LOG_DIR="$1" scripts/verify.sh snippets); }
  check "a run that started on a clean tree and leaves a file fails" fails leaves "$work/clean-logs"
  says "it names the file" "the run started on a clean tree and left these changes"
  says "  ... by its path" "leftover.txt"
  check "  ... and its summary says so" ok row clean-tree "$next" failed "$work/clean-logs/summary.tsv"
  check "  ... after the step's own row" ok row snippets "$next" passed "$work/clean-logs/summary.tsv"
  check "a run that started with changes may leave more" ok leaves "$work/dirty-logs"
  check "  ... its rows are +dirty" ok row snippets "$next+dirty" passed "$work/dirty-logs/summary.tsv"
}

test_yarn_resolution
test_xctest_results
test_java_home
test_ios_sdk_checkout
test_verified_label
make_pristine
test_bump_native
test_release_dist
test_verify_tree
test_verify_pack
test_verify_summary

printf '\nself-test: %d passed, %d failed\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
