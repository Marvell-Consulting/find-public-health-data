#!/bin/bash
# Dev-only: create a login role per API so each connects with its own user.
# No grants yet — access rules will be defined later once the schema and plan exist.
# Runs once, as the owner role ($POSTGRES_USER), when the data volume is first initialised.
set -euo pipefail

public_api_password="${PUBLIC_API_PASSWORD:-public_api}"
internal_api_password="${INTERNAL_API_PASSWORD:-internal_api}"

# Passwords are passed as psql variables and quoted by psql itself (:'var' emits a safe SQL
# literal). Interpolating them into the SQL text here would break on a quote character and
# would let the env var inject arbitrary SQL.
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v public_api_password="$public_api_password" \
  -v internal_api_password="$internal_api_password" <<-'EOSQL'
	CREATE ROLE public_api LOGIN PASSWORD :'public_api_password';
	CREATE ROLE internal_api LOGIN PASSWORD :'internal_api_password';
EOSQL
