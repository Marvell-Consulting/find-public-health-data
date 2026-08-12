#!/bin/bash
# Dev-only: create the fphd_owner group that owns every migrated object, plus a login role per
# API so each connects with its own user. No table grants — those are explicit per-table
# statements in the drizzle migrations (packages/db/drizzle), applied by pnpm db:migrate.
# Runs once, as the owner role ($POSTGRES_USER), when the data volume is first initialised;
# `operations db bootstrap` is the equivalent for a managed server, and for a volume that
# predates this script.
set -euo pipefail

# No fallback passwords: if a password is missing, fail rather than create a login role with a
# well-known default. compose.yaml also requires these, so this is a guard for any other caller.
public_api_password="${PUBLIC_API_PASSWORD:?PUBLIC_API_PASSWORD is not set (see .env.example)}"
internal_api_password="${INTERNAL_API_PASSWORD:?INTERNAL_API_PASSWORD is not set (see .env.example)}"

# Passwords are passed as psql variables and quoted by psql itself (:'var' emits a safe SQL
# literal). Interpolating them into the SQL text here would break on a quote character and
# would let the env var inject arbitrary SQL.
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v database="$POSTGRES_DB" \
  -v public_api_password="$public_api_password" \
  -v internal_api_password="$internal_api_password" <<-'EOSQL'
	CREATE ROLE fphd_owner NOLOGIN;
	GRANT fphd_owner TO CURRENT_USER;
	GRANT CREATE ON DATABASE :"database" TO fphd_owner;
	GRANT CREATE, USAGE ON SCHEMA public TO fphd_owner;

	CREATE ROLE public_api LOGIN PASSWORD :'public_api_password';
	CREATE ROLE internal_api LOGIN PASSWORD :'internal_api_password';
EOSQL
