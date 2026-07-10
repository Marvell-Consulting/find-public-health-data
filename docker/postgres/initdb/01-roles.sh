#!/bin/bash
# Dev-only: create a login role per API so each connects with its own user.
# No grants yet — access rules will be defined later once the schema and plan exist.
# Runs once, as the owner role ($POSTGRES_USER), when the data volume is first initialised.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE public_api LOGIN PASSWORD '${PUBLIC_API_PASSWORD:-public_api}';
  CREATE ROLE internal_api LOGIN PASSWORD '${INTERNAL_API_PASSWORD:-internal_api}';
EOSQL
