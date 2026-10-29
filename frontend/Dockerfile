# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
# next.config.ts does not use `output: "standalone"`, so the app runs with
# `next start` from the full build directory.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY --from=builder --chown=node:node /app ./
USER node

EXPOSE 3000

# Listens on all interfaces inside the container (required for the published
# port to work); docker-compose.yaml publishes it on 127.0.0.1 only.
# `npm start` binds 127.0.0.1, which is right on a host but not in a container.
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
