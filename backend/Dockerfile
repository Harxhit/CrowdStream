# syntax=docker/dockerfile:1
#
# Multi-stage backend image for CrowdStream (mediasoup SFU, Node/TS).
#   - target `dev`  : nodemon + ts-node hot reload (source bind-mounted by compose)
#   - target `prod` : TypeScript compiled to dist/, lean runtime, no build tools
#
# Build deps (python3/build-essential/pkg-config) are required to compile the
# mediasoup native worker and ffmpeg-static during `npm install`.

# ---- base: toolchain shared by dev and build ----
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- dev: hot reload; real source comes from a bind mount in compose ----
FROM base AS dev
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- build: compile TS -> dist, then drop dev dependencies ----
FROM base AS build
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci
COPY . .
# `npm run build` = tsc + `cp -r src/scripts dist/scripts` (rateLimit.lua is read
# at runtime via __dirname and is NOT emitted by tsc). Then prune dev deps while
# keeping the already-built mediasoup worker + ffmpeg-static binaries.
RUN npm run build \
    && npm prune --omit=dev

# ---- prod: minimal runtime image ----
FROM node:20-slim AS prod
ENV NODE_ENV=production
WORKDIR /app
# recording/sdp.ts writes `src/recording/<room>.sdp` relative to the working dir.
RUN mkdir -p src/recording
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/index.js"]
