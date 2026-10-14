#!/usr/bin/env bash
# Moves the wrapper to other native SallaPush releases: fetches their API files, rewrites every pin of scripts/common.sh,
# adds the CHANGELOG line, then runs the pin and parity checks, which name each native symbol that needs a mapping
# decision. A platform already at its version is left out of every step. It never commits, pushes or prints a
# credential.
#
#   scripts/bump-native.sh <version>                           SallaPush iOS and Android to <version>
#   scripts/bump-native.sh --ios <version> --android <version>
#   scripts/bump-native.sh --check                             every pin agrees (scripts/verify.sh pins)
set -euo pipefail

scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(cd "$scripts/.." && pwd -P)"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=common.sh
. "$scripts/common.sh"

fail() {
  printf 'bump-native.sh: %s\n' "$*" >&2
  exit 1
}

usage() {
  echo "usage: scripts/bump-native.sh <version> | --ios <version> --android <version> | --check" >&2
  exit 2
}

ios=""
android=""
case "${1:-}" in
  --check)
    [ "$#" -eq 1 ] || usage
    sp_pins "$root" check || fail "the pins disagree; set them together with scripts/bump-native.sh <version>"
    exit 0
    ;;
  --ios | --android)
    while [ "$#" -gt 0 ]; do
      [ "$#" -ge 2 ] || usage
      case "$1" in
        --ios) ios="$2" ;;
        --android) android="$2" ;;
        *) usage ;;
      esac
      shift 2
    done
    [ -n "$ios" ] && [ -n "$android" ] || usage
    ;;
  -* | '') usage ;;
  *)
    [ "$#" -eq 1 ] || usage
    ios="$1"
    android="$1"
    ;;
esac

readonly RELEASE_RE='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'
[[ "$ios" =~ $RELEASE_RE ]] || fail "'$ios' is not a SallaPush iOS release (X.Y.Z or X.Y.Z-<pre-release>)"
[[ "$android" =~ $RELEASE_RE ]] || fail "'$android' is not a SallaPush Android release (X.Y.Z or X.Y.Z-<pre-release>)"
[ "$ios" != 1.0.1 ] || fail "SallaPush iOS 1.0.1 is a stray tag, not a release"

# Every pin is checked before anything is written. A platform already at its version is left as it is, and out of the
# CHANGELOG line; a bump that moves neither changes nothing.
sp_pins "$root" check >/dev/null || fail "the pins disagree already; fix them first (scripts/bump-native.sh --check)"
pinned_ios="$(sp_pins "$root" current ios)" || fail "the iOS pins name no version"
pinned_android="$(sp_pins "$root" current android)" || fail "the Android pins name no version"
entry=""
if [ "$ios" = "$pinned_ios" ]; then
  echo "SallaPush iOS already at $ios"
else
  entry="SallaPush iOS $ios"
fi
if [ "$android" = "$pinned_android" ]; then
  echo "SallaPush Android already at $android"
else
  entry="${entry:+$entry and }SallaPush Android $android"
fi
[ -n "$entry" ] || exit 0

command -v gh >/dev/null 2>&1 ||
  fail "gh was not found: install GitHub's CLI and log in with an account that reads the SallaPush SDKs (gh auth login)"
command -v node >/dev/null 2>&1 || fail "node was not found: the parity check needs Node 24"

work="$(mktemp -d "${TMPDIR:-/tmp}/sallapush-bump.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# fetch <repository> <path> <tag> <file>: one file of a native repository at a tag, through gh's own credentials.
fetch() {
  gh api -H 'Accept: application/vnd.github.raw' "repos/SallaApp/$1/contents/$2?ref=$3" >"$4" 2>"$work/gh.log" || {
    sed 's/^/  gh: /' "$work/gh.log" >&2
    fail "cannot read $2 at $3 from SallaApp/$1: the tag does not exist, or gh cannot read the repository"
  }
  [ -s "$4" ] || fail "$2 at $3 from SallaApp/$1 is empty"
}

if [ "$ios" != "$pinned_ios" ]; then
  fetch sallapush-ios-sdk API.txt "$ios" "$work/ios.txt"
fi
if [ "$android" != "$pinned_android" ]; then
  fetch sallapush-android-sdk sallapush/api/sallapush.api "$android" "$work/android.api"
fi
if [ "$ios" != "$pinned_ios" ]; then
  cp "$work/ios.txt" "$root/tool/api-parity/native-ios-API.txt"
  echo "fetched API.txt at iOS $ios"
fi
if [ "$android" != "$pinned_android" ]; then
  cp "$work/android.api" "$root/tool/api-parity/native-android-sallapush.api"
  echo "fetched sallapush.api at Android $android"
fi

sp_pins "$root" rewrite "$ios" "$android" || fail "a pin is missing (above); fix scripts/common.sh or the file"

python3 - "$root/CHANGELOG.md" "- $entry." <<'PY'
import sys

path, entry = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as handle:
    lines = handle.read().split("\n")
starts = [index for index, line in enumerate(lines) if line.strip() == "## [Unreleased]"]
if len(starts) != 1:
    sys.exit("CHANGELOG.md needs exactly one '## [Unreleased]' section")
start = starts[0]
end = next((index for index in range(start + 1, len(lines)) if lines[index].startswith("## ")), len(lines))
if entry in lines[start:end]:
    print(f"CHANGELOG.md already says: {entry}")
    sys.exit(0)
changed = next((index for index in range(start + 1, end) if lines[index].strip() == "### Changed"), None)
if changed is None:
    # Keep a Changelog's order: Added, Changed, Deprecated, Removed, Fixed, Security.
    later = ("### Deprecated", "### Removed", "### Fixed", "### Security")
    before = next((index for index in range(start + 1, end) if lines[index].strip() in later), end)
    while before > start + 1 and lines[before - 1].strip() == "":
        before -= 1
    lines[before:before] = ["", "### Changed", "", entry]
else:
    last = next((index for index in range(changed + 1, end) if lines[index].startswith("### ")), end)
    while last > changed + 1 and lines[last - 1].strip() == "":
        last -= 1
    lines[last:last] = [entry] if last > changed + 1 else ["", entry]
with open(path, "w", encoding="utf-8") as handle:
    handle.write("\n".join(lines))
print(f"CHANGELOG.md: {entry}")
PY

sp_pins "$root" check || fail "the pins still disagree after the rewrite"
git -C "$root" --no-pager diff --stat -- tool/api-parity/native-ios-API.txt tool/api-parity/native-android-sallapush.api
git -C "$root" --no-pager diff -- tool/api-parity/native-ios-API.txt tool/api-parity/native-android-sallapush.api
node "$scripts/check-api-parity.mjs" || fail "map each native symbol named above in tool/api-parity/mapping.json, wrap the new API, then run scripts/verify.sh"
echo "bump-native.sh: SallaPush iOS $ios and Android $android are pinned everywhere; review the diff, then open the pull request"
