# CrowdStream

Open-source real-time live streaming infrastructure built for interactive, multi-host experiences at scale. Extracted from production use in [Croudly](https://github.com/Harxhit/croudly), CrowdStream combines WebRTC, MediaSoup SFU routing, TURN/STUN networking, and HLS delivery into a modular, self-hostable backend.

---

## Overview

Most open-source streaming solutions either rely on RTMP (high latency) or peer-to-peer WebRTC (does not scale). CrowdStream bridges that gap — low-latency WebRTC for broadcasters and co-hosts, SFU routing for efficient media distribution, and an HLS pipeline for large-scale viewer delivery from a single backend.

---

## Features

- WebRTC-based low-latency live streaming for broadcasters
- MediaSoup SFU routing — no peer-to-peer mesh required
- Multi-host and co-host session support
- Real-time chat and audience interaction over WebSocket
- TURN/STUN connectivity via Coturn for NAT traversal
- HLS pipeline (FFmpeg) for scalable viewer delivery
- CDN and Nginx-ready media serving
- Modular Node.js and TypeScript backend
- AWS EC2 deployment with Nginx reverse proxy

---

## Architecture

```
                ┌────────────────────┐
                │   Web Frontend     │
                │  (WebRTC Client)   │
                └──────────┬─────────┘
                           │
                     WebSocket Signaling
                           │
                           ▼
                ┌────────────────────┐
                │  Node.js Backend   │
                │  + Express API     │
                └──────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │MediaSoup │ │ Coturn   │ │ FFmpeg   │
        │   SFU    │ │TURN/STUN │ │ HLS Pipe │
        └────┬─────┘ └──────────┘ └────┬─────┘
             │                         │
             │                   .m3u8 + .ts segments
             │                         │
             ▼                         ▼
      Real-time WebRTC           Nginx / CDN
         Streaming                 Delivery
             │                         │
             └──────────────┬──────────┘
                            ▼
                         Viewers
```

---

## How It Works

### Low-Latency Streaming

Broadcasters connect via WebRTC. Media is routed through MediaSoup SFU, which forwards streams to consumers without requiring a peer-to-peer mesh. This significantly reduces per-host bandwidth and enables sessions with multiple active senders.

### NAT Traversal

Many users are behind NATs or corporate firewalls. Coturn (TURN/STUN) acts as a relay to establish WebRTC media paths in cases where direct ICE connectivity fails, improving connection success rates across network environments.

### HLS Pipeline

For large-scale viewer delivery, CrowdStream pipes media through FFmpeg, which transcodes and segments the stream into HLS format:

```
WebRTC / RTMP / File Input
          ↓
    FFmpeg Processing
          ↓
 HLS Segments (.ts files)
 Playlist     (.m3u8)
          ↓
 Nginx / CDN Delivery
          ↓
       Viewers
```

HLS enables CDN integration, recording, replay support, and reliable delivery at viewer counts that WebRTC alone cannot support.

---

## Tech Stack

| Technology   | Role                                      |
|--------------|-------------------------------------------|
| Node.js      | Backend runtime                           |
| TypeScript   | Type safety across the codebase           |
| Express.js   | REST API and signaling endpoints          |
| MediaSoup    | SFU media routing                         |
| WebRTC       | Low-latency real-time media transport     |
| Coturn       | TURN/STUN NAT traversal                   |
| FFmpeg       | Media transcoding and HLS generation      |
| WebSocket    | Real-time signaling between peers         |
| AWS EC2      | Backend hosting                           |
| Nginx        | Media serving and reverse proxy           |
| HLS          | Scalable viewer-side stream delivery      |

---

## Deployment

Backend services are deployed on AWS EC2:

- **MediaSoup workers** handle SFU media routing
- **Coturn** manages TURN relay traffic on its own port range
- **Node.js** handles REST API and WebSocket signaling
- **FFmpeg** runs as a child process generating HLS segments
- **Nginx** serves `.m3u8` playlists and `.ts` segments, and acts as reverse proxy for the API

A sample `docker-compose.yml` and Nginx configuration are included for local development and self-hosted deployments.

---

## Roadmap

- [ ] WHIP/WHEP ingest support
- [ ] Recording storage to S3
- [ ] Horizontal MediaSoup worker scaling
- [ ] Viewer analytics endpoint
- [ ] Docker Compose production profile
