# Week 1 — NAT Traversal & Configuration Foundation

> Close the highest-impact production blockers so that any client, regardless of its NAT type, can establish a WebRTC connection while removing all networking assumptions from the application.

---

# Objectives

- Remove all hardcoded networking configuration.
- Externalize networking into validated environment variables.
- Enable TCP fallback for mediasoup transports.
- Deploy and configure Coturn.
- Configure STUN and TURN authentication.
- Wire ICE servers into the client.
- Validate ICE negotiation and relay behaviour.
- Build a production-like local networking stack.

---

# Completed Work

## ✅ Day 1 — Externalize Configuration

Implemented:

- Environment-based configuration
- Startup validation
- Removed hardcoded IP addresses
- Environment-specific announced IPs

Example:

```env
PUBLIC_IP=0.0.0.0
ANNOUNCED_IP=<deployment-ip>

TURN_USERNAME=...
TURN_PASSWORD=...
```

---

## ✅ Day 2 — TCP Fallback

Updated mediasoup transport configuration.

```ts
listenIps: [
  {
    ip: process.env.PUBLIC_IP,
    announcedIp: process.env.ANNOUNCED_IP
  }
],
enableUdp: true,
enableTcp: true,
preferUdp: true
```

Result:

- UDP preferred
- TCP fallback supported
- Dynamic deployment configuration

---

## ✅ Day 3 — Deploy Coturn

Configured:

- STUN
- TURN
- Authentication
- Relay port allocation
- Fingerprint support
- External IP mapping

Example configuration:

```conf
realm=crowdstream.local

fingerprint

lt-cred-mech

external-ip=<public-ip>/<private-ip>

min-port=49152
max-port=65535
```

---

## ✅ Day 4 — Wire ICE Servers

Client networking configuration now comes entirely from environment variables.

```ts
iceServers: [
  {
    urls: [
      process.env.TURN_UDP,
      process.env.TURN_TCP
    ],
    username,
    credential
  }
]
```

No networking configuration remains hardcoded inside the frontend.

---

## ✅ Day 5 — Integration Testing & Validation

Performed end-to-end networking validation.

### Verified

- Environment configuration
- Signaling
- Socket.IO communication
- STUN Binding Requests
- TURN Authentication
- TURN Allocations
- Relay Candidate generation
- ICE Candidate gathering
- DTLS negotiation
- mediasoup transport creation
- HAProxy TCP forwarding
- Envoy UDP forwarding

Debugging tools used:

- Chrome WebRTC Internals
- Firefox `about:webrtc`
- Coturn logs
- Envoy logs
- HAProxy logs
- tcpdump
- Browser console
- mediasoup transport logs

---

# Local Development Architecture

The production networking layer was reproduced locally.

```text
                    WebRTC Client
                           │
                 ICE (STUN / TURN)
                           │
           ┌───────────────┴───────────────┐
           │                               │
    TURN over TCP                   STUN/TURN over UDP
           │                               │
        HAProxy                         Envoy
      (TCP Proxy)                   (UDP Proxy)
           │                               │
           └───────────────┬───────────────┘
                           │
                        Coturn
                           │
                     Relay Media
                           │
                       mediasoup
```

This mirrors a production Layer 4 load balancer while remaining completely cloud-agnostic.

---

# Complete Networking Flow

```text
                  Broadcaster
                        │
                 HTTPS / Socket.IO
                        │
                        ▼
                     ngrok
                        │
                        ▼
                     Nginx
                ┌───────┴────────┐
                │                │
                ▼                ▼
         Frontend (Vite)   Node.js Backend
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
                  ▼                ▼                ▼
             Create Room     Exchange RTP     Create WebRTC
                              Capabilities      Transport
                                   │
                                   ▼
                           ICE + DTLS Parameters
                                   │
                                   ▼
                              mediasoup SFU
                                   │
                        Creates ICE Candidates
                                   │
                  STUN Binding / TURN Allocation
                                   │
                                   ▼
                                Coturn
                                   │
                      Relay Candidate Generated
                                   │
                                   ▼
                 Candidate Returned via Signaling
                                   │
                                   ▼
                    Viewer Receives ICE Candidates
                                   │
                                   ▼
                     ICE Connectivity Checks Begin
                                   │
                                   ▼
                     Selected Candidate Pair Found
                                   │
                                   ▼
                           DTLS Handshake
                                   │
                                   ▼
                            SRTP Media Flow
                                   │
                                   ▼
                                Viewer
```

---

# Cloud Deployment Architecture

```text
                    +----------------------+
                    |  WebRTC Client       |
                    | (Browser / Mobile)   |
                    +----------+-----------+
                               |
                     STUN / TURN Requests
                               |
                UDP 3478 / TCP 3478 / TLS 5349
                               |
                               ▼
          +-------------------------------------------+
          |     Layer 4 Load Balancer                 |
          |-------------------------------------------|
          | AWS   : Network Load Balancer             |
          | GCP   : Network Load Balancer             |
          | Azure : Azure Load Balancer               |
          | K8s   : LoadBalancer / STUNner            |
          +-------------------+-----------------------+
                              |
                              ▼
                    +----------------------+
                    |      Coturn          |
                    | STUN + TURN Server   |
                    +----------+-----------+
                               |
                     Relay Allocation
                               |
                               ▼
                    +----------------------+
                    |    mediasoup SFU     |
                    | (Node.js Backend)    |
                    +----------+-----------+
                               |
                               ▼
                    +----------------------+
                    | Other WebRTC Clients |
                    +----------------------+
```

---

# Results

Successfully completed:

- ✅ Removed hardcoded networking configuration.
- ✅ Dynamic deployment configuration.
- ✅ TCP fallback support.
- ✅ Coturn deployment.
- ✅ STUN validation.
- ✅ TURN validation.
- ✅ TURN authentication.
- ✅ TURN allocations.
- ✅ Relay candidate generation.
- ✅ Cloud-agnostic networking architecture.
- ✅ Production-like local networking stack.
- ✅ Complete ICE debugging workflow.

---

# Current Limitation

The entire networking stack has been validated in local and controlled environments.

Verified components include:

- Signaling
- STUN
- TURN authentication
- TURN allocations
- ICE candidate gathering
- TCP proxying
- UDP proxying
- Relay candidate generation

The remaining limitation is establishing TURN relay media while hosting the entire stack locally behind a mobile hotspot. Investigation indicates that the remaining failure is caused by public network behaviour (mobile carrier NAT/firewall characteristics) rather than the mediasoup or Coturn implementation.

The next validation step is to deploy the identical stack on a network with a dedicated publicly reachable IPv4 address (home broadband with port forwarding or a VPS). No application code changes are expected for that deployment.

---

# Learning Outcomes

This week provided practical experience with:

- NAT traversal
- STUN
- TURN
- ICE negotiation
- DTLS
- mediasoup transport configuration
- Coturn deployment
- UDP proxying with Envoy
- TCP proxying with HAProxy
- Browser WebRTC debugging
- Packet capture analysis using tcpdump
- Cloud-agnostic infrastructure design

These improvements establish a solid networking foundation for the remaining roadmap.
