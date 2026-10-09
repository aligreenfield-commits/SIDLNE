#!/usr/bin/env bash
set -euo pipefail

# migrate.sh - apply the SIDLNE schema to a Supabase Postgres database.
#
# Usage:
#   export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
#   ./infra/scripts/migrate.sh
#
# Every migration is idempotent, so re-running is safe.

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: SUPABASE_DB_URL is not set." >&2
  echo "Find it in Supabase: Project Settings > Database > Connection string (URI)." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is required. Install the PostgreSQL client and try again." >&2
  exit 1
fi

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "Applying $(basename "$f")"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "Migrations complete."
