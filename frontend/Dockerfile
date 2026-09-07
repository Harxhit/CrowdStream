# syntax=docker/dockerfile:1
#
# Multi-stage frontend image for CrowdStream (React + Vite).
#   - target `dev`  : Vite dev server with HMR (source bind-mounted by compose)
#   - target `prod` : static build served by nginx, which also reverse-proxies
#                     /backend and /socket.io to the backend (acts as ingress).

# ---- dev: Vite dev server; real source comes from a bind mount in compose ----
FROM node:20-slim AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# package.json "dev" = `vite --host`
CMD ["npm", "run", "dev"]

# ---- build: produce static assets. Vite inlines import.meta.env.VITE_* at
#      build time, so they must be present as env before `vite build`. ----
FROM node:20-slim AS build
WORKDIR /app
ARG VITE_API_URL=
ARG VITE_SIGNALING_URL=
ARG VITE_TURN_USERNAME=
ARG VITE_TURN_CREDENTIAL=
ARG VITE_TURN_UDP_URL=
ARG VITE_TURN_TCP_URL=
ARG VITE_TURNS_TCP_URL=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SIGNALING_URL=$VITE_SIGNALING_URL \
    VITE_TURN_USERNAME=$VITE_TURN_USERNAME \
    VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL \
    VITE_TURN_UDP_URL=$VITE_TURN_UDP_URL \
    VITE_TURN_TCP_URL=$VITE_TURN_TCP_URL \
    VITE_TURNS_TCP_URL=$VITE_TURNS_TCP_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- prod: nginx serves the SPA and proxies the API/socket to the backend ----
FROM nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
