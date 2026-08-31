# Running CrowdStream with Docker

Two top-level Compose files bring up the app plus its core dependencies:

| File | Purpose |
| --- | --- |
| `docker-compose.local.yml` | Local development — backend & frontend hot reload |
| `docker-compose.prod.yml`  | Production — compiled backend, static frontend built into nginx |

Each stack runs **backend + frontend + a 6-node Redis cluster + MongoDB + an nginx ingress**.
The NAT-traversal layers (Coturn, Envoy, HAProxy) are **not** included here — start those from
`infra/` as before when you need TURN/relay.

```
browser ──▶ nginx :80 ──/──────────▶ frontend   (local: Vite :5173 · prod: static in nginx)
                       ──/backend/──▶ backend :3000   (/backend/ prefix stripped → /api/v1, /db)
                       ──/socket.io/▶ backend :3000   (WebSocket)
backend :3000 ──▶ mongo 127.0.0.1:27017  +  redis cluster 127.0.0.1:6379-6384
```

> **Networking:** every service uses `network_mode: host`, matching the existing `infra/` setup.
> This is required so the Redis cluster can advertise `127.0.0.1:<port>` and mediasoup can bind
> the WebRTC/recording UDP ports directly. **Host networking is a Linux feature** — on Docker
> Desktop for macOS/Windows the port mapping semantics differ and this stack is not supported as-is.

## 1. Prerequisites

- Docker Engine + Compose v2 on **Linux**.
- The RTC port range (`RTC_MIN_PORT`–`RTC_MAX_PORT`, default `40000-40100` UDP/TCP) free on the host.

## 2. Environment

The backend requires ~25 env vars (all mandatory — it exits on any missing one). Seed them from the
template, then edit the secrets:

```bash
cp deploy/env.docker.template backend/.env
# edit backend/.env: set JWT_SECRET, TURN_SECRET, DATABASE_NAME, etc.
```

You don't need to get the infra endpoints right in `backend/.env` — the Compose files force-override
`MONGO_DB_URL`, `REDIS_HOST`/`REDIS_PORT*`, `PORT`, `INSTANCE_ID`, and the `*_IP` vars so the
containerized Mongo/Redis are always used.

For **local** frontend dev, Vite reads `frontend/.env` at runtime (it's bind-mounted) — put any
`VITE_*` values there. For **production**, `VITE_*` are baked in at build time; provide them via your
shell or a root `.env` that `docker compose` reads (see the `args:` in `docker-compose.prod.yml`).

## 3. Local development

```bash
docker compose -f docker-compose.local.yml up --build
```

- Waits for Mongo to be healthy and `redis-init` to form the cluster, then starts the backend.
- Open **http://localhost/** — the nginx ingress serves the Vite app and proxies the API/socket.
- Editing `backend/src/**` → `nodemon` restart; editing `frontend/src/**` → Vite HMR.

Health checks:

```bash
curl http://localhost/backend/db/__ping   # -> PING OK
curl http://localhost/backend/health      # -> HEALTH OK
```

## 4. Production

```bash
cp deploy/env.docker.template backend/.env   # set real secrets
export HOST_PUBLIC_IP=<your server public IP>   # so WebRTC reaches remote clients
docker compose -f docker-compose.prod.yml up --build -d
```

- Backend runs the compiled `node dist/index.js`.
- The frontend container is nginx serving the built SPA **and** proxying `/backend` + `/socket.io`
  to the backend — it is the :80 ingress (no separate nginx service in prod).
- Verify the runtime asset copied by the build (the Lua rate-limit script):

  ```bash
  docker compose -f docker-compose.prod.yml exec backend ls dist/scripts   # -> rateLimit.lua
  ```

## 5. Notes & caveats

- **Redis cluster** is created once by the `redis-init` one-shot service; it's idempotent (re-runs
  detect `cluster_state:ok` and exit). Data persists in the `redis-N-data` named volumes. Node configs
  are reused read-only from `infra/redis/redis-N/redis.conf`. The image is `redis:7-alpine` (Redis ≥7 is
  required for the sharded pub/sub the app uses; bump the tag if you want 8.x).
- **MongoDB** binds to `127.0.0.1` only (host networking) with data in the `mongo-data` volume. It has
  no auth by default — fine because it isn't reachable off-host, but enable auth for a hardened deploy.
- **Recordings** are written relative to the working dir (`recording<room><ts>.mp4` and
  `src/recording/<room>.sdp`). In local dev they land on the host via the bind mount. In production they
  live inside the container and are **ephemeral** — bind-mount a host path onto `/app` (or change the
  output path in `backend/src/recording/`) if you need them to persist.
- **TURN/relay:** for connectivity across restrictive NATs, run Coturn/Envoy/HAProxy from `infra/` and
  point the frontend `VITE_TURN_*` values at them.
