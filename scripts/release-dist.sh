#!/usr/bin/env bash
# Makes the release that apps install with git: the package as npm packs it, with the built dist/ and a package.json
# reduced to what an install needs, committed as a child of HEAD and tagged <version>, so nothing builds at install time.
# It never pushes.
#
#   scripts/release-dist.sh <version>             a commit signed with your git signing key, and the tag, in this repository;
#                                                 HEAD must be on origin's master
#   scripts/release-dist.sh <version> --dry-run   the same, unsigned, in a temporary clone (RELEASE_DIST_DIR, else a new
#                                                 temporary folder), for scripts/verify.sh consumer; prints
#                                                 dist_repo=<clone> and dist_commit=<commit>
set -euo pipefail

scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(cd "$scripts/.." && pwd -P)"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=common.sh
. "$scripts/common.sh"

# What the dist package.json keeps. capacitor is load-bearing: Capacitor's CLI treats a package as a plugin only with it;
# and the podspec reads version, description and homepage.
readonly KEPT_KEYS="name version description private license repository homepage main module types unpkg files
peerDependencies capacitor"
readonly PACKED_FILES="dist/esm/index.js dist/esm/index.d.ts dist/plugin.cjs.js dist/plugin.js Package.swift
Salla.saSallapushCapacitor.podspec android/build.gradle android/src/main/AndroidManifest.xml
android/src/main/java/sa/salla/sallapush/capacitor/SallaPushPlugin.kt
ios/Sources/SallaPushCapacitorPlugin/SallaPushPlugin.swift"

fail() {
  printf 'release-dist.sh: %s\n' "$*" >&2
  exit 1
}

usage() {
  echo "usage: scripts/release-dist.sh <version> [--dry-run]" >&2
  exit 2
}

version="${1:-}"
dry_run=false
case "$#:${2:-}" in
  1:) ;;
  2:--dry-run) dry_run=true ;;
  *) usage ;;
esac
case "$version" in '' | -*) usage ;; esac

[ -z "$(git -C "$root" status --porcelain)" ] ||
  fail "the working tree has changes: release from a clean checkout of the commit to release"
declared="$(sp_package_version "$root")"
[ "$declared" = "$version" ] || fail "package.json declares $declared, not $version"
if ! $dry_run; then
  sp_changelog_heading "$root" "$version" >/dev/null || fail "add the '## [$version]' entry to CHANGELOG.md first"
  if git -C "$root" rev-parse -q --verify "refs/tags/$version" >/dev/null; then
    fail "the tag $version exists already"
  fi
fi
head="$(git -C "$root" rev-parse HEAD)"
# A tag publishes its commit's history to every app, so a release is made only from a commit that master has.
if ! $dry_run; then
  git -C "$root" fetch --quiet origin master || fail "can't fetch master from origin to check that HEAD is merged"
  git -C "$root" merge-base --is-ancestor "$head" FETCH_HEAD ||
    fail "HEAD $head isn't on origin's master: release a merged commit"
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/sallapush-release.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# A fresh build, so that no file of an older build ships.
rm -rf "${root:?}/dist"
(cd "$root" && sp_yarn install --immutable && sp_yarn build)
(cd "$root" && npm pack --json --pack-destination "$work") >"$work/pack.json" || fail "npm pack failed"
tarball="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))[0]["filename"])' "$work/pack.json")"
tarball="$work/${tarball##*/}"
[ -f "$tarball" ] || fail "npm pack made no tarball"
tar -xzf "$tarball" -C "$work"

# npm packs the folders files names as they are on disk, the files .gitignore hides included, which the clean-tree
# check doesn't see: a credential left in android/ would ship. Only committed files and the fresh build may.
git -C "$root" -c core.quotePath=false ls-tree -r --name-only HEAD >"$work/committed"
(cd "$work/package" && find . -type f ! -path './dist/*' | sed 's|^\./||' | sort) >"$work/packed"
stray="$(grep -vxF -f "$work/committed" "$work/packed" || true)"
[ -z "$stray" ] || fail "the package would ship files that aren't committed, such as files .gitignore hides:
$stray
Remove them, or release from a fresh clone."

python3 - "$work/package" "$KEPT_KEYS" "$PACKED_FILES" <<'PY'
import json, os, re, sys

directory, kept, packed = sys.argv[1], sys.argv[2].split(), sys.argv[3].split()
path = os.path.join(directory, "package.json")
with open(path, encoding="utf-8") as handle:
    package = json.load(handle)
dist = {key: value for key, value in package.items() if key in kept}
problems = [f"the packed package lacks {name}" for name in packed if not os.path.isfile(os.path.join(directory, name))]
capacitor = dist.get("capacitor") if isinstance(dist.get("capacitor"), dict) else {}
for platform in ("ios", "android"):
    entry = capacitor.get(platform)
    if not isinstance(entry, dict) or entry.get("src") != platform:
        problems.append(f"package.json's capacitor.{platform}.src is not \"{platform}\": Capacitor's CLI would not "
                        f"find the {platform} plugin")
# Yarn's pack, which a git install runs, drops a nested folder that files names without a glob.
for entry in dist.get("files", []):
    folder = entry.rstrip("/")
    if "/" in folder and not entry.startswith("!") and not re.search(r"[*?\[]", entry) and \
            os.path.isdir(os.path.join(directory, folder)):
        problems.append(f"files lists the folder {entry}, which Yarn's pack drops: write {folder}/**")
podspec = os.path.join(directory, "Salla.saSallapushCapacitor.podspec")
if os.path.isfile(podspec):
    with open(podspec, encoding="utf-8") as handle:
        for key in sorted(set(re.findall(r"package\[[\"']([^\"']+)[\"']\]", handle.read()))):
            if key not in dist:
                problems.append(f"the podspec reads package.json's {key}, which the dist package.json lacks")
if problems:
    sys.exit("\n".join(problems))
with open(path, "w", encoding="utf-8") as handle:
    json.dump(dist, handle, indent=2)
    handle.write("\n")
print(f"package.json keeps {', '.join(dist)}; drops {', '.join(sorted(set(package) - set(dist))) or 'nothing'}")
PY

if $dry_run; then
  target="${RELEASE_DIST_DIR:-}"
  [ -n "$target" ] || target="$(mktemp -d "${TMPDIR:-/tmp}/sallapush-dist.XXXXXX")"
  [ ! -e "$target" ] || [ -z "$(ls -A "$target")" ] || fail "RELEASE_DIST_DIR $target is not empty"
  git clone --quiet --no-checkout "$root" "$target"
  git -C "$target" fetch --quiet "$root" HEAD
  sign=()
else
  target="$root"
  sign=(-S)
fi
git_dir="$(git -C "$target" rev-parse --absolute-git-dir)"
(cd "$work/package" && GIT_DIR="$git_dir" GIT_WORK_TREE="$work/package" GIT_INDEX_FILE="$work/index" git add -A -f .)
tree="$(GIT_DIR="$git_dir" GIT_INDEX_FILE="$work/index" git write-tree)"
commit="$(GIT_DIR="$git_dir" git commit-tree ${sign[@]+"${sign[@]}"} "$tree" -p "$head" \
  -m "feat: release $version with the built library")" || fail "git commit-tree failed: the dist commit was not made"
GIT_DIR="$git_dir" git tag "$version" "$commit"

if $dry_run; then
  echo "dry run: the dist commit and the tag $version are in the temporary clone $target; this repository is untouched"
  echo "dist_repo=$target"
  echo "dist_commit=$commit"
else
  echo "released $version: the signed commit $commit, a child of $head, tagged $version"
  echo "push the tag when the release is approved: git push origin $version"
fi
