#!/usr/bin/env bash
# Runs the schema rule tests against a throwaway Postgres database.
# Usage: PGHOST=... PGPORT=... PGUSER=... ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=daliapply_test_$$
createdb "$DB"
trap 'dropdb "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/supabase_stub.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/migrations/0001_init.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/migrations/0002_launch.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rules_test.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/launch_test.sql
