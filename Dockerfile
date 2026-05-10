# syntax=docker/dockerfile:1

# --- Build stage: compile both the SPA (vite build) and the server (tsc) ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm ci
COPY . .
# `npm run build` runs both `vite build` (→ dist/) and `tsc -p
# tsconfig.server.json` (→ dist-server/).
RUN npm run build

# --- Runtime stage: production deps + compiled server + built SPA ---
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

USER node
EXPOSE 3000

CMD ["node", "dist-server/index.js"]
