#!/usr/bin/env bash
# Mixed local/Docker development: apps named as arguments run locally via pnpm;
# the rest run as Docker containers (built fresh, plus the database).
#
#   scripts/dev.sh internal-api                 # internal-api local, other three in containers
#   scripts/dev.sh internal-web internal-api    # internal pair local, public pair in containers
#   scripts/dev.sh public-web internal-web      # both webs local, both APIs in containers
#
# Ctrl-C stops the local apps and the app containers; the database stays up.
# All four local is `pnpm dev`; all four in containers is
# `docker compose --profile public-web --profile internal-web --profile public-api --profile internal-api up --build`.
set -euo pipefail
cd "$(dirname "$0")/.."

all_apps=(public-web internal-web public-api internal-api)

usage() {
  echo "usage: scripts/dev.sh <app>..." >&2
  echo "  apps: ${all_apps[*]}" >&2
  echo "  named apps run locally; the rest run as Docker containers" >&2
}

if (($# == 0)); then
  usage
  exit 1
fi

local_apps=()
for arg in "$@"; do
  found=0
  for app in "${all_apps[@]}"; do
    if [[ $arg == "$app" ]]; then
      found=1
      break
    fi
  done
  if ((found == 0)); then
    echo "unknown app: $arg" >&2
    usage
    exit 1
  fi
  local_apps+=("$arg")
done

container_apps=()
for app in "${all_apps[@]}"; do
  is_local=0
  for l in "${local_apps[@]}"; do
    [[ $app == "$l" ]] && is_local=1
  done
  ((is_local == 0)) && container_apps+=("$app")
done

if ((${#container_apps[@]} > 0)); then
  profile_flags=()
  for app in "${container_apps[@]}"; do
    profile_flags+=(--profile "$app")
  done

  echo "Starting containers: ${container_apps[*]} (+ db)" >&2
  docker compose "${profile_flags[@]}" up --detach --build

  stop_containers() {
    echo "Stopping containers: ${container_apps[*]}" >&2
    docker compose "${profile_flags[@]}" stop "${container_apps[@]}"
  }
  trap stop_containers EXIT
fi

filter_flags=()
for app in "${local_apps[@]}"; do
  filter_flags+=(--filter "@fphd/${app}")
done

echo "Running locally: ${local_apps[*]}" >&2
pnpm --parallel "${filter_flags[@]}" run dev
