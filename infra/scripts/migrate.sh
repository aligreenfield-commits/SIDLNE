#!/usr/bin/env bash
set -euo pipefail

# migrate.sh - apply Supabase SQL migrations and policies
# Requirements:
# - psql CLI installed and accessible, OR supabase CLI installed
# - SUPABASE_DB_URL (Postgres connection string) OR SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

MIGRATIONS_DIR="infra/supabase/migrations"
POLICIES_FILE="infra/supabase/policies.sql"
SEED_FILE="infra/supabase/seed.sql"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. Attempting to use supabase CLI (requires supabase project login)."
  if command -v supabase >/dev/null 2>&1; then
    echo "Using supabase db push is recommended for structured migrations; falling back to running individual SQL files."
    echo "Please run: supabase db push --project-ref <your-ref>"
    exit 1
  else
    echo "Error: SUPABASE_DB_URL not set and supabase CLI not available. Export SUPABASE_DB_URL or install the supabase CLI."
    exit 1
  fi
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but not found. Install libpq (psql) and try again."
  exit 1
fi

echo "Running migrations from $MIGRATIONS_DIR against $SUPABASE_DB_URL"

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "Applying $f"
  psql "$SUPABASE_DB_URL" -f "$f"
done

if [ -f "$POLICIES_FILE" ]; then
  echo "Applying policies: $POLICIES_FILE"
  psql "$SUPABASE_DB_URL" -f "$POLICIES_FILE"
fi

if [ -f "$SEED_FILE" ]; then
  echo "Applying seed data: $SEED_FILE"
  psql "$SUPABASE_DB_URL" -f "$SEED_FILE"
fi

echo "Migrations complete."
