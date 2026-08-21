#!/usr/bin/env bash
# Starts the Docker services local development needs and waits for them to report healthy.
# Every `dev` script runs this first, so `pnpm dev` works on a cold machine without a
# separate `docker compose up`.
#
# No service is named: this starts exactly the services with no `profiles:` key (today just
# the database). The four app containers are profile-gated and belong to scripts/dev.sh
# (mixed local/Docker development), so a service added to compose.yaml without a profile
# joins the dev prerequisites by existing rather than by being listed here too.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running — start Docker Desktop (or your daemon) and try again." >&2
  exit 1
fi

# --wait blocks until each healthcheck passes. Without it `up --detach` returns as soon as
# the container is created, and the APIs that follow race Postgres's startup: the first
# query fails with ECONNREFUSED and the page renders the error boundary.
exec docker compose up --detach --wait
