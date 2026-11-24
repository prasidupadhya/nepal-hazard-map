#!/usr/bin/env bash
# One-time GitHub settings for prasidupadhya/nepal-hazard-map.
# Run on your own computer, logged in to the GitHub CLI as the repo owner (`gh auth login`):
#   bash scripts/github-settings.sh
# Every step runs on its own and prints ✓ or ✗ with GitHub's reason; running it again is safe.
set -uo pipefail
R=prasidupadhya/nepal-hazard-map
step() { local name=$1; shift; local out; if out=$("$@" 2>&1); then echo "✓ $name"; else echo "✗ $name: $(echo "$out" | tr '\n' ' ' | cut -c1-300)"; fi; }

# 1. About box, tidy merges, unused tabs off
step "description, merge settings, wiki/projects off" gh api -X PATCH repos/$R \
  -f description="Flood, glacial lake outburst and earthquake map of Nepal: daily official data on a 3D map, what-if scenarios, English and Nepali. Not an official warning." \
  -f homepage="https://nepal-hazard-map.vercel.app" \
  -F has_wiki=false -F has_projects=false -F delete_branch_on_merge=true -F allow_rebase_merge=false
step "topics" gh api -X PUT repos/$R/topics \
  -f 'names[]=nepal' -f 'names[]=flood' -f 'names[]=glof' -f 'names[]=glacial-lakes' -f 'names[]=earthquake' \
  -f 'names[]=hazard-map' -f 'names[]=disaster-risk-reduction' -f 'names[]=threejs' -f 'names[]=webassembly' \
  -f 'names[]=rust' -f 'names[]=open-data'

# 2. Security: Dependabot alerts + fixes, private vulnerability reports, secret scanning with push protection
step "Dependabot alerts" gh api -X PUT repos/$R/vulnerability-alerts
step "Dependabot security fixes" gh api -X PUT repos/$R/automated-security-fixes
step "private vulnerability reporting" gh api -X PUT repos/$R/private-vulnerability-reporting
step "secret scanning + push protection" gh api -X PATCH repos/$R --input - <<'JSON'
{"security_and_analysis": {"secret_scanning": {"status": "enabled"}, "secret_scanning_push_protection": {"status": "enabled"}}}
JSON

# 3. Actions: workflows get a read-only token unless they ask for more (the daily data job asks for write);
#    Actions can't approve pull requests; workflows from outside contributors wait for your approval
step "Actions: read-only token by default" gh api -X PUT repos/$R/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
step "Actions: approve outside contributors' runs" gh api -X PUT repos/$R/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors

# 4. Protect main: it can't be deleted or force-pushed (history can't be rewritten).
#    You are the only one with write access, so only you can change main; everyone else can only
#    open pull requests that you decide to merge. A "require a pull request" rule is left out on purpose:
#    on a personal repository GitHub can't exempt the daily data job, so it would stop the daily data copy.
if [ "$(gh api repos/$R/rulesets --jq '[.[] | select(.name=="Protect main")] | length' 2>/dev/null)" = "1" ]; then
  echo "✓ main protection (already there)"
else
  step "main protection (no deletion, no force-push)" gh api -X POST repos/$R/rulesets --input - <<'JSON'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" } ]
}
JSON
fi

echo "Check: https://github.com/$R/settings/rules"
