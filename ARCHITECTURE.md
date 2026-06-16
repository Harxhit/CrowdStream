# CrowdStream — Architecture Overview

CrowdStream is a self-hosted, low-latency live-streaming platform. A broadcaster
publishes camera/microphone media over WebRTC, and many viewers consume that
media through a **MediaSoup SFU** (Selective Forwarding Unit) rather than a
peer-to-peer mesh. Signaling runs over **Socket.IO**; the media plane is handled
by MediaSoup worker processes in native C++ off the Node.js event loop.

---

## 1. System at a glance

```
                         ┌──────────────────────────────────────────┐
                         │                Browser                     │
                         │  React App (App.tsx)                       │
                         │   ├── Broadcaster (broadcaster.ts)         │
                         │   ├── Viewer      (viewer.ts)              │
                         │   ├── Room        (room.ts) — client state │
                         │   └── mediasoup-client Device              │
                         └───────────────┬───────────────┬───────────┘
                                         │               │
                       Socket.IO         │               │  WebRTC
                       (signaling)       │               │  (media: DTLS/SRTP/ICE)
                                         │               │
                         ┌───────────────▼───────────────▼───────────┐
                         │           Node.js Server (:3000)           │
                         │  Express (HTTP) + Socket.IO (ws)           │
                         │   ├── registerBroadcaster.handler          │
                         │   ├── registerViewer.handler               │
                         │   ├── viewer.handler / consumer.handler    │
                         │   └── disconnect.handlers                  │
                         │                                            │
                         │  In-memory room store (Map)                │
                         │   rooms → { router, broadcasters, viewers, │
                         │             worker }                       │
                         │                                            │
                         │  MediaSoup control plane                   │
                         │   Worker → Router → WebRtcTransport →      │
                         │            Producer / Consumer             │
                         └───────────────┬────────────────────────────┘
                                         │  (media relay path)
                                  ┌──────▼──────┐
                                  │   Coturn    │  TURN/STUN for NAT traversal
                                  │ (65.0.239…) │  (referenced from client ICE config)
                                  └─────────────┘

   MongoDB + Mongoose models exist (LiveRoom, Broadcaster, Viewer, Producer,
   Transport) but are NOT yet wired into the runtime — see §7.
```

**Two planes, kept separate:**

- **Signaling plane** — Socket.IO request/response (and callbacks) to set up
  rooms, exchange RTP capabilities, create/connect transports, and negotiate
  producers/consumers.
- **Media plane** — WebRTC (ICE + DTLS + SRTP) flowing directly between the
  browser and MediaSoup, relayed by Coturn when NAT requires it. Media never
  passes through the Node.js event loop.

---

## 2. Repository layout

```
CrowdStream/
├── README.md                  High-level product/architecture summary
├── backend/                   Node.js + TypeScript signaling + SFU control
│   ├── Dockerfile             node:20-slim + build tools for mediasoup
│   ├── src/
│   │   ├── index.ts           Entrypoint: listens on 0.0.0.0:3000, /__ping
│   │   ├── app.ts             Express app instance
│   │   ├── utils/socket.util  HTTP server + Socket.IO wiring, connection hub
│   │   ├── handlers/          Socket.IO event handlers (signaling)
│   │   │   ├── registerBroadcaster.handler.ts
│   │   │   ├── registerViewer.handler.ts
│   │   │   ├── viewer.handler.ts       (join/transport/consume logic)
│   │   │   └── disconnect.handlers.ts  (cleanup)
│   │   ├── consumer/consumer.handler.ts  pause/resume/close consumers
│   │   ├── mediasoup/         Worker / Router / Transport factories
│   │   ├── rooms/room.store.ts  In-memory room registry + lifecycle
│   │   ├── models/            Mongoose schemas (not yet used at runtime)
│   │   ├── database/index.ts  Mongoose connection (not yet invoked)
│   │   └── utils/             logging, apiError, canConsume, broadcaster utils
│   └── logs/                  Winston file output (combined.log, error.log)
└── frontend/                  React + Vite + mediasoup-client
    ├── src/
    │   ├── App.tsx            Single-page UI: host + viewer + log panel
    │   ├── broadcaster.ts     Broadcaster client orchestration
    │   ├── viewer.ts          Viewer client orchestration
    │   ├── room.ts            Client-side Room model (device/transports/etc.)
    │   ├── socket.ts          Socket.IO client singleton
    │   └── store/room.store.ts  Client-side room Map
    └── Dockerfile
```

---

## 3. Backend architecture

### 3.1 Process & server bootstrap

- `index.ts` imports the shared HTTP `server` (created in
  `utils/socket.util.ts`), mounts CORS and a `/__ping` health route, and listens
  on `0.0.0.0:3000`.
- `app.ts` is a bare Express instance — HTTP is effectively only a health check
  today; all real work is over Socket.IO.
- `utils/socket.util.ts` creates the Node `http` server around Express, attaches
  a Socket.IO `Server` (CORS `origin: "*"`), and on each `connection` registers
  the broadcaster and viewer handler sets, plus a `disconnect` logger.

### 3.2 MediaSoup control plane (`src/mediasoup/`)

MediaSoup's object hierarchy is **Worker → Router → Transport → Producer/Consumer**:

| File           | Responsibility |
|----------------|----------------|
| `worker.ts`    | `initWorker()` spawns a MediaSoup worker. RTC port range `40000–49999`, log level `warn`. **One worker is created per room** (see note below). |
| `router.ts`    | `createRouter(roomId, worker)` creates a router with the supported codecs (Opus audio; VP8 + H.264 video) and caches it in a module-level `routers` Map keyed by room. |
| `transport.ts` | `createWebRtcTransport(router)` creates a `WebRtcTransport` with `listenIps` `0.0.0.0` and **`announcedIp: '13.232.120.1'`** (the public EC2 IP used for ICE candidates). UDP enabled, TCP disabled, prefer UDP. |

> **Design note:** `createRoom` calls `initWorker()` per room, so today there is
> roughly one worker per room rather than the canonical "one worker per CPU
> core" pool the README describes. This is the natural place to introduce a
> shared worker pool later.

### 3.3 Room state — the in-memory store (`src/rooms/room.store.ts`)

All live session state lives in a single module-level `Map`:

```ts
memoryRoom: Map<roomId, {
  router: Router
  worker: Worker
  broadcasters: Map<socketId, Broadcaster>
  viewers:      Map<socketId, Viewer>
}>

Broadcaster = { transports: Map<string, WebRtcTransport>,
                producers:  Map<producerId, Producer>,
                joinedAt, role: "host" | "co-host" }

Viewer      = { transport:  Map<"producer"|"consumer", WebRtcTransport>,
                consumers:  Map<producerId, Consumer>,
                rtpCapabilities?, joinedAt, role: "viewer" | "co-host" }
```

Exposed lifecycle functions: `createRoomId`, `createRoom`, `getRoom`,
`saveProducer`, `addViewer`, `removeViewer`, `removeBroadcaster`. Cleanup paths
close MediaSoup transports/producers/consumers defensively (wrapped in
try/catch) before deleting Map entries.

> **Implication:** room state is **per-process and volatile**. A server restart
> drops all rooms, and horizontal scaling would require shared state or sticky
> sessions. This is the main scaling boundary today.

### 3.4 Signaling handlers

**Broadcaster (`handlers/registerBroadcaster.handler.ts`)** — events:

| Event (in) | Action | Event (out) |
|---|---|---|
| `createRoom` | mint roomId, `createRoom`, store `roomId` on `socket.data`, `addBroadcaster` | `roomCreated { roomId }` |
| `getRouterRtpCapabilities` | look up room router | `routerRtpCapabilities { … }` |
| `createBroadcasterTransport` | `createWebRtcTransport`, `saveBroadcasterTransport` (key `'producer'`) | `broadcasterTransportCreated { id, ice…, dtls…, routerRtpCapabilities }` |
| `connectBroadcasterTransport` | `transport.connect({ dtlsParameters })` (DTLS handshake) | `broadcasterTransportConnected` |
| `produce` | `transport.produce({ kind, rtpParameters, appData })`, save producer | `produced:${kind} { id }` |
| `rejectCoHost` | relay rejection to viewer socket | `requestRejected` (to viewer) |

Co-host *request/approve* handlers are stubbed (commented out), as is
`coHost.utils.ts`.

**Viewer (`handlers/registerViewer.handler.ts`) + logic in `viewer.handler.ts`:**

| Event (in) | Action | Response |
|---|---|---|
| `joinRoom` | `joinAsViewer` registers viewer in room | ack callback `{ rtpCapabilities }` |
| `createViewerTransport` | `createConsumerTransport` (recv transport, stored under key `'consumer'`) | `viewerTransportCreated { id, ice…, dtls… }` |
| `connectConsumerTransport` | `connectConsumerTransport` DTLS handshake | `consumerTransportConnected` |
| `consume` | for every producer in the room, `canConsume` check then `transport.consume({ paused: true })`; collect params | `consumerCreated [ … ]` |
| `resumeConsumer` | resume all paused consumers for the viewer | `resumed { resumedConsumers }` |
| `pauseConsumer` | pause a specific consumer | `paused` |
| `notifyViewerStateChange` | broadcast presence change | `viewerStateChange` |

Consumers are **created paused** and resumed after the client side is ready —
the standard MediaSoup pattern to avoid losing the first frames.

**Consumer lifecycle (`consumer/consumer.handler.ts`)** provides
`pauseConsumer`, `resumeConsumer`, `closeConsumer`, and
`manageMultiStreamConsumers`. Per `docs/todo/RESUME_CONSUMER_CONTRACT_CHANGE.md`,
the contract is moving toward **consumer-specific** pause/resume/close
(requiring `consumerId`), but the live `resumeConsumer` socket handler still does
resume-all by `roomId` — a known, documented inconsistency.

**Disconnect (`handlers/disconnect.handlers.ts`)** — `handleDisconnect` reads
`socket.data.roomId`, determines whether the socket was a viewer or broadcaster,
and runs `cleanupViewer` / `cleanUpBroadcaster` to close transports, producers,
and consumers and delete the entry.
> Note: this module is defined but is **not currently wired** into the
> `disconnect` event in `socket.util.ts` (which only logs). Wiring it in is the
> obvious next step to prevent resource leaks.

### 3.5 Cross-cutting utilities

- `utils/canConsumer.util.ts` — wraps `router.canConsume({ producerId, rtpCapabilities })`.
- `utils/apiError.ts` — `ApiError(statusCode, message)` custom error class.
- `utils/logging.ts` — Winston logger; file transports (`logs/error.log`,
  `logs/combined.log`) plus colorized console outside production.
- `utils/broadcaster.util.ts` — `addBroadcaster`, `saveBroadcasterTransport`.
- Stubbed/parked for later: `adaptStreamQuality.ts`, `autoRecovery.ts`,
  `sendMetrics.ts`, `verifyViewerAccess.ts` (all commented or TODO).

---

## 4. Frontend architecture

A single-page React app (`App.tsx`) drives both roles for testing: a
**Broadcaster** column, a **System Log** column, and a **Viewer** column.

- `socket.ts` — Socket.IO client singleton pointed at
  `http://13.232.120.1:3000`.
- `room.ts` — client `Room` model holding the `mediasoup-client` `Device`,
  `sendTransport`, `recTransport`, `producer` Map, and `consumers` Map.
- `store/room.store.ts` — client-side `Map<roomId, Room>` mirroring server rooms.

**Broadcaster flow (`broadcaster.ts`, orchestrated by `startHost`):**

1. `createRoom` → await `roomCreated`.
2. `getRouterCapabilities` → load a `Device`.
3. `createBroadcasterTransport` → build a **send** transport; wire its
   `connect` event (DTLS) and `produce` event (emit `produce`, await
   `produced:${kind}`).
4. `getUserMedia` (camera + mic) → render locally.
5. `startProducing` → `produce` video then audio tracks.

**Viewer flow (`viewer.ts`, orchestrated by `joinViewer`):**

1. `joinRoom` (ack returns `rtpCapabilities`) → load `Device`.
2. `createViewerTransport` → build a **recv** transport; wire `connect` (DTLS).
3. `consumeMedia` → emit `consume`, then for each returned param call
   `recTransport.consume(...)` and store the consumer.
4. `resumeConsumer` → tell the server to resume the paused consumers.
5. `renderMedia` → assemble a `MediaStream` from consumer tracks into the
   `<video>` element.

Both roles configure **ICE servers pointing at the Coturn instance**
(`turn:65.0.239.130:3478` UDP/TCP and `turns:…:5349`) with
`iceTransportPolicy: "all"`.

---

## 5. End-to-end sequence

```
BROADCASTER                      SERVER                         VIEWER
    |  createRoom  ───────────────► createRoom()                  |
    |  ◄─ roomCreated{roomId}                                     |
    |  getRouterRtpCapabilities ──► router.rtpCapabilities        |
    |  ◄─ routerRtpCapabilities                                   |
    |  createBroadcasterTransport ► createWebRtcTransport()       |
    |  ◄─ broadcasterTransportCreated                             |
    |  connectBroadcasterTransport► transport.connect (DTLS)      |
    |  produce(video/audio) ──────► transport.produce()           |
    |  ◄─ produced:video / produced:audio                         |
    |                                                             |
    |                          joinRoom ◄──────────────────────── |
    |                          rtpCapabilities (ack) ───────────► |
    |                          createViewerTransport ◄─────────── |
    |                          ─ viewerTransportCreated ────────► |
    |                          connectConsumerTransport ◄──────── |
    |                          consume ◄────────────────────────  |
    |                            canConsume + transport.consume   |
    |                            (paused) ─ consumerCreated[] ──► |
    |                          resumeConsumer ◄────────────────── |
    |                            consumer.resume() ─ resumed ───► |
    |                                                             |
    └────────── SRTP media via WebRTC / Coturn relay ──────────► render
```

---

## 6. Cross-cutting concerns

- **Logging** — Winston everywhere; handlers log start/finish with elapsed
  `Date.now()` deltas, useful for latency tracing.
- **Error handling** — `ApiError` plus broad try/catch that logs and (mostly)
  swallows, keeping a single bad socket from crashing the process. Cleanup paths
  intentionally ignore close() errors.
- **Configuration** — `dotenv` for `MONGO_DB_URL`, `DATA_BASE_NAME`. The public
  `announcedIp` and Coturn IPs are currently **hard-coded** (a deployment coupling
  worth externalizing).
- **CORS** — wide open (`*`) on both Express and Socket.IO; intended for dev.

---

## 7. Persistence (scaffolded, not yet active)

Mongoose models exist under `backend/src/models/` — `LiveRoom`, `Broadcaster`,
`Viewer`, `Producer`, `Transport` — and `database/index.ts` provides
`connectToDataBase()`. **Neither the connection nor the models are referenced by
the live signaling path**; all runtime state is in-memory today. These are the
foundation for future durable room history, viewer session tracking, and
analytics.

---

## 8. Deployment

- **Backend** — `Dockerfile` on `node:20-slim` installs `python3` +
  `build-essential` + `pkg-config` (MediaSoup compiles native code), exposes
  `3000`, runs `npm run dev` (ts-node + nodemon).
- **Frontend** — Vite app; `npm run build` → `tsc -b && vite build`.
- **Network** — runs on AWS EC2 for a **static public IP** (required so
  MediaSoup can advertise reachable ICE candidates) and a self-hosted **Coturn**
  for TURN/STUN relay.

---

## 9. Architectural characteristics & limitations

**Strengths**
- Clean signaling/media separation; media stays off the Node event loop.
- SFU (not mesh) — viewers scale without N² peer connections.
- Modular handler/util structure; consistent logging and error wrapping.

**Current limitations / next steps**
- In-memory room state → single-process, volatile, not horizontally scalable.
- `handleDisconnect` not wired into the socket `disconnect` event → resource leaks.
- One MediaSoup worker per room rather than a per-core worker pool.
- Hard-coded public IP and TURN credentials.
- `resumeConsumer` still resume-all vs. the documented per-consumer contract.
- No authentication / access control (`verifyViewerAccess` is a TODO).
- Co-host, adaptive quality, metrics, and persistence are scaffolded but inactive.

---

*Generated from source as of 2026-06-16.*
