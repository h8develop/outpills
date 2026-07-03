# outpills API — multi-stage Dockerfile
# target: dev  — hot-reload для docker compose (dev)
# target: prod — оптимизированный production-образ

# ── Базовый слой с зависимостями ──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate

# ── DEV: исходники монтируются томом, hot-reload ──
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

# ── Сборка ──
FROM deps AS build
COPY . .
RUN npm run build

# ── PROD: только прод-зависимости + dist ──
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=build /app/dist ./dist

# Непривилегированный пользователь
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 4000
# SIGTERM → NestJS enableShutdownHooks → graceful shutdown
CMD ["node", "dist/main.js"]
