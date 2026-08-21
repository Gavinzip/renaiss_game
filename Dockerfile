# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/client ./apps/client
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
COPY ops ./ops
COPY tools/audit_static_assets.mjs tools/manage_static_asset_release.mjs ./tools/

ARG VITE_GAME_SERVER_URL
ENV VITE_GAME_SERVER_URL=${VITE_GAME_SERVER_URL}

# The checked-in release manifest is the single source of truth. Deriving the
# build-time CDN base here prevents a stale provider variable from pinning a
# deployment to an older immutable asset release.
RUN VITE_STATIC_ASSET_BASE_URL="$(node -p "require('./apps/client/src/game/assets/staticAssetReleaseManifest.json').publicBaseUrl")" \
    pnpm --filter @renaiss-game/client build
RUN pnpm --filter @renaiss-game/server typecheck
RUN node tools/audit_static_assets.mjs
RUN node tools/manage_static_asset_release.mjs --assert-build
RUN pnpm --filter @renaiss-game/server deploy --prod --legacy /runtime/server

FROM node:24-bookworm-slim AS runtime

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV GAME_SERVER_PORT=8787
ENV RENAISS_GAME_DATA_DIR=/data/renaiss-game
ENV RENAISS_RPG_DB_PATH=/data/renaiss-game/rpg-profile.sqlite

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates nginx \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && mkdir -p /data/renaiss-game

COPY --from=build /runtime/server ./server
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/ops ./ops
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
COPY ops/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["node", "ops/start-production.mjs"]
