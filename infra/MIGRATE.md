# Supabase migrations & infra README

This folder contains SQL migrations, RLS policies, and helper scripts to set up the Supabase schema for SIDLNE.

Files added:
- infra/supabase/migrations/001_init_tables.sql  -- initial schema
- infra/supabase/policies.sql                    -- Row Level Security policies
- infra/supabase/seed.sql                        -- optional seed/demo data
- infra/scripts/migrate.sh                       -- helper script to run migrations via psql

How to run (local):
1. Create a Supabase project at https://app.supabase.com/
2. Export your Postgres connection string (use the Database > Connection string in project settings):

   export SUPABASE_DB_URL="postgresql://..."

3. Run the migration script:

   chmod +x infra/scripts/migrate.sh
   ./infra/scripts/migrate.sh

Or run the SQL files directly from the Supabase SQL editor (copy/paste the files in order).

CI / automated migration notes:
- For CI, prefer running migrations from a dedicated service account (service_role key) or via a CI runner that has access to the project's DB connection string.
- Do NOT commit service_role keys to the repo. Store them as GitHub Actions secrets (e.g. SUPABASE_DB_URL or SUPABASE_SERVICE_ROLE_KEY) and reference them in workflows.
