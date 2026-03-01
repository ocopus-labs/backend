# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# --include=dev: Coolify sets NODE_ENV=production at build time via secrets,
# which makes npm skip devDependencies. This flag overrides that.
RUN npm ci --include=dev --ignore-scripts && \
    npx prisma generate --generator client

COPY tsconfig*.json nest-cli.json prisma.config.ts ./
COPY src ./src/

RUN npx nest build

# ─── Production stage ────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# Install production deps + prisma CLI (needed for migrations at startup).
# prisma is a devDep so npm ci --omit=dev skips it; install it separately.
RUN npm ci --omit=dev --ignore-scripts && \
    npm install prisma --no-save

# Generated Prisma query-engine client from build stage
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Compiled application
COPY --from=build /app/dist ./dist

# Prisma schema, migrations, and config for runtime migrate deploy
COPY prisma ./prisma/
COPY prisma.config.ts entrypoint.sh ./

RUN chmod +x entrypoint.sh && chown -R node:node /app

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
  CMD wget -qO- http://localhost:3000/api || exit 1

EXPOSE 3000
USER node
ENTRYPOINT ["./entrypoint.sh"]
