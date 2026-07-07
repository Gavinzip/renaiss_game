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

COPY . .

ARG VITE_GAME_SERVER_URL
ARG VITE_STATIC_ASSET_BASE_URL=https://pub-043b57dfe27c4f7e9a469bbc5d7f33dc.r2.dev/renaiss-game
ENV VITE_GAME_SERVER_URL=${VITE_GAME_SERVER_URL}
ENV VITE_STATIC_ASSET_BASE_URL=${VITE_STATIC_ASSET_BASE_URL}

RUN pnpm --filter @renaiss-game/client build
RUN pnpm --filter @renaiss-game/server typecheck
RUN node tools/audit_static_assets.mjs

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

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/ops ./ops
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
COPY ops/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["node", "ops/start-production.mjs"]
