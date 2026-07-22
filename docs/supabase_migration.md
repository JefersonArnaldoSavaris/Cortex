# Supabase / PostgreSQL migration

The Cortex API supports SQLite for local development and PostgreSQL for production through SQLAlchemy and psycopg.

## Connection choice

For a persistent API server, use the Supabase Direct connection when IPv6 is available. On IPv4-only networks, use the Shared Pooler in **Session mode** on port `5432`. Include `sslmode=require` in the URL.

Copy the database URI from **Supabase Dashboard → Connect**. Store it only in `.env` or the deployment secret manager:

```env
CORTEX_SUPABASE_DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

Do not use the Supabase `anon` key or service-role key as a PostgreSQL password.

## Dry run

```powershell
.venv-win\Scripts\python.exe scripts\migrate_sqlite_to_postgres.py --source cortex_app.db --dry-run
```

## Copy data

The migration creates the schema and copies data in dependency order. Existing rows are left untouched, so the script can be safely retried.

```powershell
.venv-win\Scripts\python.exe scripts\migrate_sqlite_to_postgres.py --source cortex_app.db
```

Confirm every table reports `OK`, then configure the API runtime:

```env
CORTEX_DATABASE_URL=${CORTEX_SUPABASE_DATABASE_URL}
```

Restart the API and verify `/health`, authentication, analyses, broker connections, and the MT5 stream. Keep the SQLite file as a rollback copy until production verification is complete.
