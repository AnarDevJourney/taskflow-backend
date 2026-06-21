# ─────────────────────────────────────────────────────────────────
# Stage 1: Build
# Installs ALL dependencies (including devDependencies) and compiles
# TypeScript into JavaScript using the NestJS build command.
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────
# Stage 2: Development
# Used by docker-compose.dev.yml only. Installs ALL dependencies
# (including devDependencies like @nestjs/cli) and runs the app
# in watch mode. Source code is mounted as a volume — this stage
# never copies src/ itself, the compose file does that at runtime.
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

RUN apk add --no-cache curl


COPY package*.json ./
RUN npm ci

# source code is NOT copied here — docker-compose.dev.yml mounts it
# this keeps the image small and means rebuilds are rarely needed

CMD ["npm", "run", "start:dev"]

# ─────────────────────────────────────────────────────────────────
# Stage 3: Production
# Starts fresh with a clean Node image. Only copies the compiled
# dist/ folder and installs production dependencies only.
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/modules/notifications/templates ./dist/modules/notifications/templates

EXPOSE 3000

CMD ["node", "dist/main.js"]