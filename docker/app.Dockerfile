# Development-only image for running any one app as a container while others run
# locally (see scripts/dev.sh). Not a production image: it keeps the full workspace
# and devDependencies so one Dockerfile serves all four apps and layer caching is
# shared between them. Select the app with --build-arg APP=<public-web|internal-web|public-api|internal-api>.
FROM node:24-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Deps layer keyed on the lockfile alone, so source edits don't re-download packages.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --prefer-offline

ARG APP
RUN pnpm --filter "@fphd/${APP}..." build

ENV NODE_ENV=production
ENV APP=${APP}
CMD pnpm --filter "@fphd/${APP}" start
