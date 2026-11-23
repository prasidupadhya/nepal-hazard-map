#!/usr/bin/env bash
# One-time GitHub settings for prasidupadhya/nepal-hazard-map.
# Run on your own computer, logged in to the GitHub CLI as the repo owner (`gh auth login`).
set -euo pipefail
R=prasidupadhya/nepal-hazard-map

# 1. About box, tidy merges, unused tabs off
gh api -X PATCH repos/$R \
  -f description="Flood, glacial lake outburst and earthquake map of Nepal: daily official data on a 3D map, what-if scenarios, English and Nepali. Not an official warning." \
  -f homepage="https://nepal-hazard-map.vercel.app" \
  -F has_wiki=false -F has_projects=false \
  -F delete_branch_on_merge=true -F allow_rebase_merge=false > /dev/null
gh api -X PUT repos/$R/topics \
  -f 'names[]=nepal' -f 'names[]=flood' -f 'names[]=glof' -f 'names[]=glacial-lakes' -f 'names[]=earthquake' \
  -f 'names[]=hazard-map' -f 'names[]=disaster-risk-reduction' -f 'names[]=threejs' -f 'names[]=webassembly' \
  -f 'names[]=rust' -f 'names[]=open-data' > /dev/null

# 2. Security: Dependabot alerts + fixes, private vulnerability reports, secret scanning with push protection
gh api -X PUT repos/$R/vulnerability-alerts
gh api -X PUT repos/$R/automated-security-fixes
gh api -X PUT repos/$R/private-vulnerability-reporting
gh api -X PATCH repos/$R --input - > /dev/null <<'JSON'
{"security_and_analysis": {"secret_scanning": {"status": "enabled"}, "secret_scanning_push_protection": {"status": "enabled"}}}
JSON

# 3. Actions: workflows get a read-only token unless they ask for more (the daily job asks for write);
#    Actions can't approve pull requests; workflows from every outside contributor wait for your approval
gh api -X PUT repos/$R/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
gh api -X PUT repos/$R/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors

# 4. Protect main: no deleting, no force-push; changes only by pull request with the
#    code owner's (your) approval and a green CI "test" check.
#    Bypass: you (repository admin) and GitHub Actions (the daily data commit).
gh api -X POST repos/$R/rulesets --input - > /dev/null <<'JSON'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" },
    { "actor_id": 15368, "actor_type": "Integration", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge", "squash"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "test", "integration_id": 15368 } ] } }
  ]
}
JSON

echo "Done. Check: https://github.com/$R/settings/rules"
