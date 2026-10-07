#!/bin/bash
# Create Secret Manager secrets for the MatchUp api-server from the local
# apps/api-server/.env file. Values are piped, never echoed.
#
# Usage (after gcloud auth login + correct project):
#   ./setup-secrets.sh
#
# Env overrides: GCP_PROJECT (default matchup-cs734), DOTENV (default
# apps/api-server/.env relative to the repo root).
set -euo pipefail

PROJECT="${GCP_PROJECT:-matchup-cs734}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOTENV="${DOTENV:-$REPO_ROOT/apps/api-server/.env}"
SECRETS="FIREBASE_PRIVATE_KEY FIREBASE_CLIENT_EMAIL FIREBASE_WEB_API_KEY"

if [ ! -f "$DOTENV" ]; then
  echo "Missing $DOTENV" >&2
  exit 1
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Print the dotenv value for $1 with surrounding quotes stripped.
dotenv_get() {
  python3 -c "
import sys
want = sys.argv[1]
for line in open(sys.argv[2], encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    if line.startswith('export '):
        line = line[len('export '):]
    k, _, v = line.partition('=')
    if k.strip() != want:
        continue
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ('\"', chr(39)):
        v = v[1:-1]
    sys.stdout.write(v)
    break
" "$1" "$DOTENV"
}

for name in $SECRETS; do
  value="$(dotenv_get "$name")"
  if [ -z "$value" ]; then
    echo "SKIP $name (empty/missing in .env)" >&2
    continue
  fi
  if gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --project="$PROJECT" --data-file=- >/dev/null
    echo "VERSION+ $name"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --project="$PROJECT" \
      --replication-policy=automatic --data-file=- >/dev/null
    echo "CREATE $name"
  fi
  gcloud secrets add-iam-policy-binding "$name" --project="$PROJECT" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
done
echo "Done. Secrets live only in Secret Manager + your local .env."
