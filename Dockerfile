FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

COPY tsconfig*.json ./

COPY . .
RUN npm run build && npm prune --production

FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000
USER node
CMD ["node", "dist/src/main"]
