# Stage 1: Install dependencies and generate Prisma client
FROM node:20-alpine AS deps

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --ignore-scripts
RUN npx prisma generate --generator client

# Stage 2: Build application and prune to production deps
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package*.json ./
COPY --from=deps /usr/src/app/prisma ./prisma/

COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/

RUN npx nest build
RUN npm prune --omit=dev --ignore-scripts

# Stage 3: Production runtime
FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy built app, production deps, and Prisma schema + migrations
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=deps /usr/src/app/prisma ./prisma/

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh && chown -R node:node /usr/src/app

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api || exit 1

EXPOSE 3000

USER node

ENTRYPOINT ["./entrypoint.sh"]
