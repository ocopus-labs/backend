# ─── Stage 1: Install ALL deps + generate Prisma client ───────────────────────
FROM node:20-alpine AS deps

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --ignore-scripts && \
    npx prisma generate --generator client

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package*.json ./
COPY --from=deps /usr/src/app/prisma ./prisma/
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

RUN npx nest build && \
    npm prune --omit=dev --ignore-scripts

# ─── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Prisma needs the query engine binary — copy only what's needed
COPY --from=builder --chown=node:node /usr/src/app/dist          ./dist
COPY --from=builder --chown=node:node /usr/src/app/node_modules  ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/package*.json ./
COPY --from=deps    --chown=node:node /usr/src/app/prisma        ./prisma/
COPY --chown=node:node entrypoint.sh ./

RUN chmod +x entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api || exit 1

EXPOSE 3000

USER node

ENTRYPOINT ["./entrypoint.sh"]