#!/bin/bash
# Deploy the MatchUp api-server to Cloud Run (project matchup-cs734).
# Run from apps/api-server:  ./deploy-cloudrun.sh
#
# One-time setup (run once):
#   gcloud auth login
#   gcloud config set project matchup-cs734
#   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
#   # Create one secret per sensitive value (paste when prompted):
#   for s in FIREBASE_PRIVATE_KEY FIREBASE_CLIENT_EMAIL FIREBASE_WEB_API_KEY; do
#     gcloud secrets create "$s" --replication-policy=automatic --project=matchup-cs734
#   done
#   # Grant the Cloud Run runtime identity access to the secrets (first deploy
#   # creates the service account; re-run after the first deploy if needed):
#   PROJECT_NUMBER=$(gcloud projects describe matchup-cs734 --format='value(projectNumber)')
#   for s in FIREBASE_PRIVATE_KEY FIREBASE_CLIENT_EMAIL FIREBASE_WEB_API_KEY; do
#     gcloud secrets add-iam-policy-binding "$s" --project=matchup-cs734 \
#       --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
#       --role="roles/secretmanager.secretAccessor"
#   done
set -euo pipefail

PROJECT="${GCP_PROJECT:-matchup-cs734}"
REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-matchup-api}"

if [ -z "${CORS_ORIGINS:-}" ]; then
  echo "CORS_ORIGINS is required (e.g. https://your-app.vercel.app)" >&2
  exit 1
fi

cd "$(dirname "$0")"

# Prod guard: only deploy from main so work-in-progress on feature
# branches never reaches prod by accident. Override with ALLOW_NON_MAIN=1
# (e.g. to smoke-test a branch on a separate service via SERVICE=...).
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")
if [ "$BRANCH" != "main" ] && [ "${ALLOW_NON_MAIN:-}" != "1" ]; then
  echo "Refusing: on branch '$BRANCH', not main. Merge to main first" >&2
  echo "or re-run with ALLOW_NON_MAIN=1." >&2
  exit 1
fi
if ! git diff-index --quiet HEAD --; then
  echo "Warning: uncommitted changes will be included in this deploy." >&2
fi

# gcloud splits --set-env-vars values on commas, so use ';' as the pair
# separator instead (^;^ prefix) — our CORS list itself contains commas.
ENV_PAIRS="NODE_ENV=production;CORS_ORIGINS=${CORS_ORIGINS};FIREBASE_PROJECT_ID=matchup-cs734;FIREBASE_DATABASE_URL=https://matchup-cs734-default-rtdb.asia-southeast1.firebasedatabase.app;FIREBASE_STORAGE_BUCKET=matchup-cs734.firebasestorage.app"

gcloud run deploy "$SERVICE" \
  --source . \
  --project "$PROJECT" \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --set-env-vars "^;^${ENV_PAIRS}" \
  --set-secrets "FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_WEB_API_KEY=FIREBASE_WEB_API_KEY:latest"
