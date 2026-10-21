# This Dockerfile builds the backend API server.
# The React Native / Expo mobile app is not containerised — run it with `npm start` on a dev machine.
# For local dev with Postgres + Redis, use docker-compose.yml at the repo root.
#
# Build: docker build -f Dockerfile -t pocketbank-api ./backend
# Or:    docker compose up --build

FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS release
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated ./src/generated
COPY backend/package*.json ./
COPY backend/prisma ./prisma

RUN mkdir -p uploads

EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4001/health || exit 1

CMD ["node", "dist/server.js"]
