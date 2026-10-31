#!/usr/bin/env bash
# Run only on an approved staging host with Docker, DNS and managed Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${FAMILY_STAGING_ENV_FILE:-/srv/family-os/.env.staging}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Staging environment file missing; no deployment attempted." >&2
  exit 1
fi
MODE="$(stat -c %a "$ENV_FILE")"
if (( (8#$MODE & 8#077) != 0 )); then
  echo "Private env file requires chmod 600." >&2
  exit 1
fi
if [[ "${FAMILY_STAGING_MIGRATION_APPROVED:-}" != "YES" ]]; then
  echo "Migrations require explicit approval after managed DB snapshot." >&2
  exit 1
fi
node "$ROOT/infra/staging/preflight.mjs" "$ENV_FILE"
compose=(docker compose --project-name family-os-staging
  --env-file "$ENV_FILE" -f "$ROOT/infra/staging/compose.yaml")
"${compose[@]}" config --quiet

# The migration container holds administrator credentials only for this run.
"${compose[@]}" build family-api
"${compose[@]}" --profile migration run --rm family-migrate

# Existing Keycloak realms are NOT overwritten by later import file changes.
"${compose[@]}" up -d family-identity family-api https
for attempt in $(seq 1 12); do
  if node "$ROOT/infra/staging/verify-live.mjs" "$ENV_FILE"; then
    echo "Family OS staging live public-boundary checks passed."
    exit 0
  fi
  sleep 10
done
echo "Staging live verification failed; do not claim activation." >&2
exit 1
