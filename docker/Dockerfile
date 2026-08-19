# syntax=docker/dockerfile:1

# Production images, one per deployable app. The builder stage is shared, so the install and
# the workspace build are cached once across all of them. `--target` picks the runtime shape
# and `APP` picks the app, which is why five images come out of three targets — the two web
# apps have identical runtime stages, as do the two APIs:
#
#   docker build -f docker/Dockerfile --target web --build-arg APP=public-web    -t public-web    .
#   docker build -f docker/Dockerfile --target web --build-arg APP=internal-web  -t internal-web  .
#   docker build -f docker/Dockerfile --target api --build-arg APP=public-api    -t public-api    .
#   docker build -f docker/Dockerfile --target api --build-arg APP=internal-api  -t internal-api  .
#   docker build -f docker/Dockerfile --target operations --build-arg APP=operations -t operations .
#
# Two workflows build exactly this list, one matrix job per row: ci.yml builds, smoke-tests and
# scans them on every pull request, publish-images.yml scans and pushes them from main.
#
# docker/app.Dockerfile is the separate development image (see scripts/dev.sh); it keeps the
# whole workspace and devDependencies, which is exactly what these must not do.

# Pinned by digest, so a build is reproducible and so the base image has a version Dependabot
# can raise — see .github/dependabot.yml. The Debian release is named rather than left to the
# floating `24-slim` alias: Dependabot resolves the alias to raise the digest, so the day Node
# retargets it to a newer Debian, that bump would silently pair the new base with the
# `trixie-pgdg` repository the operations stage hard-codes.
#
# Trixie rather than bookworm: bookworm left regular security support on 2026-06-11, and on
# LTS fewer CVEs get fixes for the upgrade and scan to catch.
#
# The runtime stage runs `apt-get upgrade` so Debian security fixes apply at build time rather
# than waiting for the base image to be rebuilt with them — a red scan means a vulnerability
# apt could not deliver, not upstream rebuild lag. The builder stage skips it; nothing in it
# ships.
FROM node:24-trixie-slim@sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS builder

# Deps layer keyed on the lockfile alone, so source edits don't re-download packages. Both
# this and the install below sit before `ARG APP`, so all five images share them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --prefer-offline

ARG APP
RUN case "${APP}" in \
      public-web | internal-web | public-api | internal-api | operations) ;; \
      *) echo "APP build arg must be one of: public-web internal-web public-api internal-api operations (got '${APP}')" >&2; exit 1 ;; \
    esac

# `...` builds the app's workspace dependencies first: the packages the Node runtime consumes
# resolve to dist/ through their `default` export condition, so an unbuilt one is missing at
# runtime rather than at build time.
RUN pnpm --filter "@fphd/${APP}..." build

# Copies the app and only the workspace packages it actually depends on into a self-contained
# tree, with devDependencies pruned. --legacy because the non-legacy implementation requires
# injected workspace packages, which this workspace does not use.
RUN pnpm deploy --filter "@fphd/${APP}" --prod --legacy /out

FROM node:24-trixie-slim@sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d AS runtime
ENV NODE_ENV=production
# Container Apps stops a revision with SIGTERM, and the kernel discards a default-action
# signal sent to PID 1 unless that process installed a handler — which Node does not do for
# SIGTERM. Without an init, every stop would wait out the full grace period and then SIGKILL.
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]

FROM runtime AS api
COPY --from=builder --chown=node:node /out /app
# HOST and PORT come from the environment; the app defaults to 0.0.0.0 and its own port.
CMD ["node", "dist/server.js"]

FROM runtime AS web
COPY --from=builder --chown=node:node /out /app
# server.ts, not a compiled entrypoint: the web apps' server is run by Node's type stripping,
# which is why tsconfig.base.json sets erasableSyntaxOnly. Everything it imports from the
# workspace resolves to compiled dist/ output.
CMD ["node", "server.ts"]

FROM runtime AS operations
USER root
# The database has no public endpoint, so a container inside the VNet is the only path to it
# for ad-hoc work. psql is here for that; the CLI below covers the scripted jobs.
#
# Version 18 to match the server, from PostgreSQL's own repository because Debian 13 ships 17:
# psql itself would connect, but pg_dump refuses to run against a server newer than itself, so
# the stock package would give an image that cannot take a backup of the database it exists to
# reach. apt reads the ASCII-armoured key directly, which keeps gnupg out of the image.
#
# `trixie-pgdg` must track the base image's Debian release — see the pin at the top of the file.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && install -d /etc/apt/keyrings \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /etc/apt/keyrings/pgdg.asc \
  && echo 'deb [signed-by=/etc/apt/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt trixie-pgdg main' \
     > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && apt-get purge -y --auto-remove curl \
  && rm -rf /var/lib/apt/lists/*
USER node
COPY --from=builder --chown=node:node /out /app
# No default command worth running unattended — a job names the one it wants. Bare, this
# prints the usage and exits non-zero.
CMD ["node", "dist/cli.js"]
