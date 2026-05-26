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

```
      Client
        |
        | WebSocket (Signaling) + WebRTC (Media)
        |
Node.js Signaling Server  <------->  MongoDB
        |                            (Room state, viewer sessions)
        |
MediaSoup SFU (Workers per CPU core)
        |
   [Broadcaster Producer]
        |
   [Viewer Consumers] 
        |
     Coturn
  (TURN/STUN Relay)
```

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
