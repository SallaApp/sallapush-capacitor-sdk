#!/usr/bin/env bash
# The gate of ci.yml's job "Native verified": CI can't build the native code (the SallaPush SDKs are private and no macOS
# runner exists), so a pull request passes only when a human ran scripts/verify.sh on a Mac at its head commit and says
# which commit, by its full id. The person who added the label native-verified-locally attests: their latest comment in
# the pull request's conversation (a review comment is not one) whose first line reads exactly
#
#   native-verified-locally <the full 40-character id of the verified commit>
#
# must name this run's head commit; the rest of the comment is that run's summary.tsv. So the attestation names one
# commit, and a push needs a new comment: the label stays. A comment changed after it was posted (edited or hidden)
# counts for nothing, because people with write access can edit anyone's comment; post a new one instead.
#
#   scripts/verified-label.sh    (in GitHub Actions; reads the live pull request, never the replayed event)
#
# Environment: PR_NUMBER and HEAD_SHA (the event's pull request and head commit), GH_TOKEN (pull-requests and issues
# read), and the variables Actions sets: GITHUB_API_URL and GITHUB_REPOSITORY. Without a pull request (a push to master,
# which only merged pull requests reach) it warns and passes.
set -euo pipefail

readonly label=native-verified-locally
readonly max_pages=30

if [ -z "${PR_NUMBER:-}" ]; then
  echo "::warning::CI did not build the native code of this commit; its pull request was gated by the $label label."
  exit 0
fi
for name in HEAD_SHA GH_TOKEN GITHUB_REPOSITORY; do
  [ -n "${!name:-}" ] || { echo "::error::verified-label.sh needs $name"; exit 1; }
done
api_url="${GITHUB_API_URL:-https://api.github.com}"

work="$(mktemp -d "${TMPDIR:-/tmp}/verified-label.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# One GitHub REST response body. The token reaches curl through its configuration on standard input, never on the
# command line, and redirects are not followed: curl would send the header to any host a redirect names.
api() {
  curl --silent --show-error --fail --config - \
    -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' "$api_url/$1" <<EOF
header = "Authorization: Bearer $GH_TOKEN"
EOF
}

# Every page of a list of the pull request (events or comments), oldest first, 100 per page; a short page is the last
# one. Prints the number of pages.
pages() {
  local kind="$1" page=1 count
  while :; do
    # Explicit returns: errexit does not apply inside the command substitution that calls this function.
    api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/$kind?per_page=100&page=$page" >"$work/$kind-$page.json" || return 1
    count="$(python3 -c 'import json, sys; print(len(json.load(open(sys.argv[1]))))' "$work/$kind-$page.json")" || return 1
    [ "$count" -eq 100 ] || break
    page=$((page + 1))
    [ "$page" -le "$max_pages" ] || {
      echo "::error::pull request #$PR_NUMBER has more than $((max_pages * 100)) $kind; verified-label.sh reads at most that many" >&2
      return 1
    }
  done
  echo "$page"
}

api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER" >"$work/pull.json"
event_pages="$(pages events)"
comment_pages="$(pages comments)"

python3 - "$label" "$HEAD_SHA" "$work" "$event_pages" "$comment_pages" <<'PY'
import json, os, re, sys
from datetime import datetime

label, head_sha, work, event_pages, comment_pages = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
attestation = re.compile(r"^" + re.escape(label) + r" ([0-9a-fA-F]{40})$")

def load(name):
    with open(os.path.join(work, name)) as handle:
        return json.load(handle)

def moment(text):
    for layout in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ"):
        try:
            return datetime.strptime(text, layout)
        except ValueError:
            pass
    sys.exit(f"::error::unexpected GitHub timestamp {text!r}")

pull = load("pull.json")
events = [event for page in range(1, event_pages + 1) for event in load(f"events-{page}.json")]
comments = [comment for page in range(1, comment_pages + 1) for comment in load(f"comments-{page}.json")]
live_head = pull["head"]["sha"]
short = head_sha[:12]
howto = (f"Run scripts/verify.sh on a Mac at {head_sha}, then comment '{label} {head_sha}' in this pull request's "
         f"conversation (as the person who added the label {label}; a review comment does not count), and re-run this job.")

if live_head != head_sha:
    print(f"::error::This run checks {short}, but the pull request's head is now {live_head[:12]}; the run of that commit decides.")
    sys.exit(1)
if label not in [entry["name"] for entry in pull.get("labels", [])]:
    print(f"::error::CI cannot build the native code (the SallaPush SDKs are private), so a local run of scripts/verify.sh "
          f"verifies it. Add the label {label} to this pull request. {howto}")
    sys.exit(1)
added = [event for event in events
         if event.get("event") == "labeled" and (event.get("label") or {}).get("name") == label]
if not added:
    print(f"::error::The label {label} is on the pull request, but GitHub lists no event that added it; remove it and add it back. {howto}")
    sys.exit(1)
latest_label = max(added, key=lambda event: (moment(event["created_at"]), event.get("id") or 0))
attester = (latest_label.get("actor") or {}).get("login")
if not attester:
    print(f"::error::GitHub does not say who added the label {label}; remove it and add it back. {howto}")
    sys.exit(1)

# The attester's comments whose first line starts with the label, oldest first. The latest one decides, and it must be
# an attestation exactly: one that is malformed fails instead of letting an older one count.
attestations = []
for comment in comments:
    if (comment.get("user") or {}).get("login") != attester:
        continue
    first = ((comment.get("body") or "").strip().splitlines() or [""])[0].strip()
    if first.startswith(label):
        attestations.append((moment(comment["created_at"]), comment, first))
if not attestations:
    print(f"::error::@{attester} added the label {label} but has not said which commit they verified. {howto}")
    sys.exit(1)
posted, comment, first = max(attestations, key=lambda item: (item[0], item[1].get("id") or 0))
where = comment.get("html_url") or f"comment {comment.get('id')}"
match = attestation.match(first)
if not match:
    print(f"::error::@{attester}'s latest {label} comment ({where}) does not read '{label} <the full 40-character commit "
          f"id>'. {howto}")
    sys.exit(1)
verified = match.group(1).lower()
if comment.get("updated_at") != comment.get("created_at"):
    print(f"::error::@{attester}'s latest {label} comment ({where}) was changed after it was posted (edited or hidden), so it "
          f"attests nothing: people with write access can edit anyone's comment. {howto}")
    sys.exit(1)
if verified != head_sha.lower():
    print(f"::error::@{attester}'s latest {label} comment ({where}) names {verified[:12]}, not this run's head {short}. {howto}")
    sys.exit(1)
print(f"::notice::The SDK at {head_sha} was verified locally: @{attester} added the label {label} "
      f"({latest_label['created_at']}) and attested this commit in {where} ({comment['created_at']}).")
PY
