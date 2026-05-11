# syntax=docker/dockerfile:1

# --- Build stage: compile both the SPA (vite build) and the server (tsc) ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm ci
COPY . .
# Defensive: clear any TypeScript incremental-build cache that might have
# slipped past .dockerignore. With `composite: true` in tsconfig.server.json,
# a stale .tsbuildinfo will make tsc skip emitting dist/server/ entirely.
RUN find . -name '*.tsbuildinfo' -not -path './node_modules/*' -delete
# `npm run build` produces dist/client/ (Vite) and dist/server/ (tsc).
RUN npm run build
# Sanity check that both build outputs landed where Express expects them.
RUN test -f dist/server/index.js && test -f dist/client/index.html

# Build-time git info, served from /gitVersion.json by Express in production.
# The Makefile passes the real values via --build-arg in `make manual-deploy`;
# unknown is the fallback when building locally without those args.
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_TIME=unknown
RUN printf '{\n  "commit": "%s",\n  "branch": "%s",\n  "buildTime": "%s"\n}\n' \
    "$GIT_COMMIT" "$GIT_BRANCH" "$BUILD_TIME" > dist/client/gitVersion.json

# --- Runtime stage: production deps + compiled server + built SPA ---
FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/server/index.js"]
