# Database migrations

The SIDLNE schema lives in `infra/supabase/migrations/` and is applied in filename order:

| File | Contents |
| --- | --- |
| `001_init_tables.sql` | Tables, columns, foreign keys and indexes |
| `002_security.sql` | Row Level Security policies, the signup trigger, household RPCs (`create_household`, `join_household`, `rotate_invite_code`, `delete_my_account`) and realtime publication |

Every statement is idempotent, so you can re-run the full set after pulling changes. Databases created from the earlier version of this schema are upgraded in place.

## Apply

```bash
export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
./infra/scripts/migrate.sh
```

You can also add `SUPABASE_DB_URL` as a repository secret and run the **Run Supabase migrations** workflow from the Actions tab, or paste the files into the Supabase SQL editor in order.

## Adding a migration

Create `003_<name>.sql` and keep it idempotent (`if not exists`, `create or replace`, `drop policy if exists`). Never commit the `service_role` key or database password. Keep them in GitHub Actions secrets.
