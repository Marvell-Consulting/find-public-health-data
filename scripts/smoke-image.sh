#!/usr/bin/env bash
# Starts a production image and checks it comes up: a server logs `Listening` once bound, the
# operations CLI prints its usage and exits 2. Either outcome means every module the app imports
# at runtime resolved out of the tree `pnpm deploy --prod` pruned — the failure this catches is a
# runtime import declared as a devDependency, which compiles everywhere and is missing only here.
#
# Both workflows run it: ci.yml against the image it builds for the pull request,
# publish-images.yml against the exact image it is about to push. Runnable by hand against any
# local tag, which is the point of it living here rather than inline in the YAML:
#
#   scripts/smoke-image.sh public-web fphd-ci/public-web:ci
set -euo pipefail

app=${1:-}
image=${2:-}
if [ -z "${app}" ] || [ -z "${image}" ]; then
  echo "usage: smoke-image.sh <app> <image>" >&2
  exit 1
fi

# GitHub renders `::error::` as an annotation on the job; running by hand, the prefix is noise.
fail() {
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::error::${1}" >&2
  else
    echo "${1}" >&2
  fi
  exit 1
}

# Enough to satisfy every app's schema; unknown keys are ignored by the one reading it. DB_HOST is
# deliberately unroutable — the servers connect lazily, so a reachable database would prove nothing
# more and a service container would cost a minute an image.
env_args=(
  -e APP_ENV=dev
  -e DB_HOST=127.0.0.1
  -e DB_TLS=false
  -e POSTGRES_DB=fphd
  -e POSTGRES_USER=fphd
  -e POSTGRES_PASSWORD=smoke-test-only
  -e PUBLIC_API_PASSWORD=smoke-test-only
  -e INTERNAL_API_PASSWORD=smoke-test-only
  -e SESSION_JWT_SECRET=smoke-test-only-jwt-secret-at-least-32-bytes
)

if [ "${app}" = 'operations' ]; then
  # Bare, the CLI prints its usage and exits 2. Reaching that means config.ts and every module
  # behind it resolved out of the pruned tree. Detached and polled rather than run in the
  # foreground: an image that starts something long-running instead would otherwise hang here
  # until the job's own timeout, half an hour later.
  cid=$(docker run -d "${env_args[@]}" "${image}")
  status=''
  for _ in $(seq 1 30); do
    status=$(docker inspect -f '{{if .State.Running}}{{else}}{{.State.ExitCode}}{{end}}' "${cid}")
    if [ -n "${status}" ]; then break; fi
    sleep 1
  done
  logs=$(docker logs "${cid}" 2>&1)
  docker rm -f "${cid}" > /dev/null
  echo "${logs}"
  [ -n "${status}" ] || fail "${app} was still running after 30s, expected the usage and exit 2"
  [ "${status}" -eq 2 ] || fail "${app} exited ${status}, expected 2 (usage)"
  grep -q 'Usage: operations' <<<"${logs}" || fail "${app} did not print its usage"
  exit 0
fi

# A module missing from the pruned tree fails well before the bind, with ERR_MODULE_NOT_FOUND.
cid=$(docker run -d "${env_args[@]}" "${image}")
for _ in $(seq 1 30); do
  if docker logs "${cid}" 2>&1 | grep -q '"msg":"Listening"'; then break; fi
  sleep 1
done
logs=$(docker logs "${cid}" 2>&1)
docker rm -f "${cid}" > /dev/null
echo "${logs}"
grep -q '"msg":"Listening"' <<<"${logs}" || fail "${app} did not start"
