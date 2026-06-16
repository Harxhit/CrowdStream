# CrowdStream

Real-time live streaming infrastructure built for scale. CrowdStream enables low-latency broadcaster-to-audience sessions with live chat, reactions, co-broadcasting, and viewer presence — self-hosted, no third-party streaming dependency.

---

## Features

- Live video and audio broadcasting over WebRTC
- Multi-viewer delivery via MediaSoup SFU (no peer-to-peer mesh)
- Real-time chat during live sessions
- Real-time emoji reactions
- Co-broadcasting (multiple active broadcasters in a single room)
- Live viewer count
- NAT traversal via Coturn (TURN/STUN)

---

## Architecture

CrowdStream is a **one-to-many live video streaming** system. A *broadcaster* captures
camera/mic and publishes media; many *viewers* subscribe and consume it. Media never flows
peer-to-peer — it routes through a **mediasoup SFU** on the backend. Socket.IO carries all
signaling; actual audio/video travels over WebRTC (UDP/DTLS), traversing a **TURN server**
when direct connectivity fails.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENTS (Browser)                               │
│                                                                                 │
│   ┌─────────────────────────┐                 ┌─────────────────────────┐       │
│   │  BROADCASTER (React)     │                 │   VIEWER (React)         │       │
│   │  App.tsx / main.tsx      │                 │   App.tsx / main.tsx     │       │
│   │  ─ broadcaster.ts        │                 │   ─ viewer.ts            │       │
│   │  ─ room.ts (Device,      │                 │   ─ room.ts (Device,     │       │
│   │     sendTransport,       │                 │      recvTransport,      │       │
│   │     producers)           │                 │      consumers)          │       │
│   │  ─ store/room.store.ts   │                 │   ─ store/room.store.ts  │       │
│   │  ─ mediasoup-client      │                 │   ─ mediasoup-client     │       │
│   └───────────┬─────────────┘                 └────────────┬────────────┘       │
└───────────────┼────────────────────────────────────────────┼──────────────────┘
                │                                              │
   ┌────────────┴──────────────┐                ┌──────────────┴───────────┐
   │  Socket.IO (signaling)     │                │  Socket.IO (signaling)    │
   │  WebRTC media (UDP/DTLS)   │                │  WebRTC media (UDP/DTLS)  │
   └────────────┬──────────────┘                └──────────────┬───────────┘
                │            ╲                  ╱                │
                │             ╲   ┌──────────────────┐         ╱
                │              ╲  │   TURN / STUN     │        ╱   (NAT traversal
                │               ╲ │ 65.0.239.130:3478 │       ╱     relay for media)
                │                 │ :5349 (turns/tcp) │
                │                 └──────────────────┘
                ▼                                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND  (Node.js + TypeScript, port 3000)                │
│                       announcedIp 13.232.120.1                                  │
│                                                                                 │
│   ┌───────────────────────────────────────────────────────────────────────┐   │
│   │  HTTP / Socket.IO Layer                                                  │   │
│   │  index.ts (listen :3000, /__ping)  ─  app.ts (express)                   │   │
│   │  utils/socket.util.ts → io.on("connection")                             │   │
│   │     ├─ registerBroadcaster.handler.ts                                    │   │
│   │     ├─ registerViewer.handler.ts                                         │   │
│   │     └─ disconnect.handlers.ts                                            │   │
│   └───────────────┬───────────────────────────────┬──────────────────────────┘  │
│                   │ signaling events               │                            │
│   ┌───────────────▼──────────────┐   ┌─────────────▼─────────────────────────┐  │
│   │  SIGNALING / DOMAIN LOGIC     │   │  MEDIA HANDLERS                        │  │
│   │  handlers/viewer.handler.ts   │   │  consumer/consumer.handler.ts          │  │
│   │  utils/broadcaster.util.ts    │   │  (pause/resume/close consumers)        │  │
│   │  utils/canConsumer.util.ts    │   └────────────────────────────────────────┘ │
│   └───────────────┬──────────────┘                                              │
│                   │                                                              │
│   ┌───────────────▼──────────────────────────────────────────────────────────┐ │
│   │  MEDIASOUP SFU (mediasoup ^3.18)                                           │ │
│   │   mediasoup/worker.ts  → Worker  (1 spawned per room, rtcPorts 40000-49999)│ │
│   │   mediasoup/router.ts  → Router  (per room; codecs: Opus, VP8, H264)       │ │
│   │   mediasoup/transport.ts → WebRtcTransport (send for broadcaster,          │ │
│   │                            recv for each viewer)                           │ │
│   │            Producers (broadcaster) ──────► Consumers (viewers)             │ │
│   └────────────────────────────────────────────────────────────────────────────┘│
│                   │                                                              │
│   ┌───────────────▼──────────────────────────────────────────────────────────┐ │
│   │  IN-MEMORY STATE (source of truth at runtime)                              │ │
│   │   rooms/room.store.ts → memoryRoom: Map<roomId, Room>                       │ │
│   │     Room = { router, worker, broadcasters:Map, viewers:Map }               │ │
│   └────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │  PERSISTENCE (defined, NOT yet wired into runtime flow)                   │    │
│   │   database/index.ts (Mongoose connect) · models/*.model.ts                │    │
│   │   connectToDataBase is never called; models never imported by handlers    │    │
│   └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│   Cross-cutting: utils/logging.ts (winston → logs/*.log) · apiError · error.util  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Flows

**Broadcast (publish):**
`createRoom` → server spins up Worker + Router → `getRouterRtpCapabilities` → client loads
`Device` → `createBroadcasterTransport` → `connectBroadcasterTransport` (DTLS) →
`produce` (video + audio) → **Producers** stored in `memoryRoom`.

**View (subscribe):**
`joinRoom` (acks rtpCapabilities) → load `Device` → `createViewerTransport` →
`connectConsumerTransport` (DTLS) → `consume` (creates paused **Consumers** for each
producer, gated by `canConsume`) → `resumeConsumer` → client builds a `MediaStream`
and renders.

**Teardown:** `disconnect` → `handleDisconnect` closes transports/producers/consumers
and deletes the entry from `memoryRoom`.

### Notes

- **SFU model:** the broadcaster uploads one stream; the SFU fans it out to N viewers
  (no transcoding, no P2P mesh).
- **Runtime state is in-memory only** (`memoryRoom`). The Mongoose layer exists but is not
  yet invoked, so room/session state does not survive a restart.
- **One mediasoup Worker per room** today (no worker pool); horizontal scaling across CPU
  cores is part of the roadmap.

---

## Tech Stack

### Backend
- **Node.js** — Signaling server, WebSocket handling, REST API
- **MediaSoup** — WebRTC SFU. Spawns one worker process per CPU core. Media plane runs in C++ off the Node.js event loop.
- **MongoDB** — Room documents, viewer session tracking, broadcaster metadata
- **Coturn** — Self-hosted TURN/STUN server for ICE relay and NAT traversal
- **FFmpeg** — Media processing pipeline (image/thumbnail handling, future recording)

### Infrastructure
- **AWS EC2** — Compute. Required for static public IP (MediaSoup ICE candidates) and consistent CPU core allocation for MediaSoup workers.

---

## Current Status

Broadcaster and viewer are functional on a local network. Cross-network WebRTC transport configuration (public IP announcement + Coturn relay path) is in progress.

---

## Roadmap

- [ ] Cross-network WebRTC (public transport configuration)
- [ ] Authentication and session tokens
- [ ] Co-broadcast (multi-producer rooms)
- [ ] Chat and reaction system
- [ ] Viewer count persistence
- [ ] Stream recording pipeline
- [ ] CDN delivery for large audiences

---
