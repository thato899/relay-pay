FROM node:20.11-alpine AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN npm install --global pnpm@12.3.4

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @mmp/contracts build && pnpm --filter @mmp/api build

FROM node:20.11-alpine AS runtime
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN npm install --global pnpm@12.3.4 \
  && addgroup -S relay && adduser -S relay -G relay

COPY --from=build --chown=relay:relay /app/package.json ./package.json
COPY --from=build --chown=relay:relay /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build --chown=relay:relay /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build --chown=relay:relay /app/.npmrc ./.npmrc
COPY --from=build --chown=relay:relay /app/node_modules ./node_modules
COPY --from=build --chown=relay:relay /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=relay:relay /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=relay:relay /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=relay:relay /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build --chown=relay:relay /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts
COPY --from=build --chown=relay:relay /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=relay:relay /app/packages/contracts/dist ./packages/contracts/dist

USER relay
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @mmp/api db:migrate && node apps/api/dist/index.js"]
