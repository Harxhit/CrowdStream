# Week 1 — Review & Retrospective

**Theme:** NAT traversal & configuration foundation.

## Did you complete this week?

* [x] **Day 1** — All hardcoded IPs/ports/origins externalized to validated env config
* [x] **Day 2** — TCP fallback enabled (`enableTcp: true`, `preferUdp: true`)
* [x] **Day 3** — Coturn (STUN + TURN) deployed and verified
* [x] **Day 4** — Client `iceServers` wired from env; relay path proven
* [ ] **Day 5** — Cross-network integration test passed

## Deliverable verification

* [x] `grep -rn "13.232.120.1\|65.0.239.130" backend/src frontend/src` → no matches
* [x] Backend fails fast on missing required env var
* [x] STUN + TURN both verified (binding + allocation)
* [x] `iceTransportPolicy: "relay"` test renders media
* [ ] CORS allowlist enforced (unknown origin rejected)

## Backlog (carry-over)

* [ ] **Day 5:** Run a cross-network integration test (e.g. broadcaster on laptop over Wi-Fi, viewer on phone over cellular) to validate direct and TURN relay paths.
* [ ] **Day 5:** Validate fallback behaviour when one peer is behind a restrictive or UDP-blocked network.
* [ ] **Day 5:** Verify the CORS allowlist rejects requests from an unknown origin.

## Retrospective notes

### What went well

* Successfully externalized networking configuration into environment variables, removing hardcoded addresses from the client.
* Deployed and configured Coturn with STUN and TURN support, including authentication, relay port restrictions, and TLS support.
* Introduced a local network load-balancer architecture to mirror production deployments.
* Validated TCP proxying through HAProxy.
* Implemented and validated UDP proxying through Envoy.
* Verified STUN Binding Requests and TURN allocations end-to-end.
* Confirmed relay media flow using `iceTransportPolicy: "relay"`.
* Used `about:webrtc`, Coturn logs, Envoy, HAProxy, and packet captures (`tcpdump`) to verify the media path and ICE behaviour.

### What was harder than expected

* Finding a local UDP-capable proxy that accurately represents a production Network Load Balancer.
* Understanding the differences between TCP and UDP proxying in Envoy.
* Debugging listener bindings, upstream routing, and port ownership while integrating Envoy with Coturn.
* Verifying end-to-end media flow required combining browser diagnostics, packet captures, and server logs rather than relying on a single tool.

### Decisions/changes to the plan
* As discussed in one of the issues, the implementation had become too AWS-centric, particularly around the networking infrastructure. Due to cloud credit constraints and to keep the architecture portable, I shifted the implementation toward a cloud-agnostic design. The networking stack was first validated locally using Envoy and HAProxy to emulate a production Layer 4 load balancer, ensuring the same architecture can be deployed on AWS, Google Cloud, Azure, or Kubernetes with minimal changes.
* Adopted **Envoy** for UDP proxying because HAProxy's UDP capabilities were insufficient for the desired development workflow.
* Kept **HAProxy** for TCP during the transition while validating Envoy independently.
* Structured the proxy layer to remain cloud-agnostic so it can later be deployed behind any UDP/TCP-capable load balancer.
* Identified **STUNner** as a potential Kubernetes-native option for future evaluation while keeping the primary deployment compatible with a standard Coturn setup.

### Local NAT Traversal Architecture
```text

                    WebRTC Client (Browser)
                             │
                 ICE (STUN/TURN Negotiation)
                             │
              ┌──────────────┴──────────────┐
              │                             │
      TCP TURN (3480)               UDP STUN/TURN (3478)
              │                             │
          HAProxy                        Envoy
        (TCP Proxy)                  (UDP Proxy)
              │                             │
              └──────────────┬──────────────┘
                             │
                         Coturn Server
                  STUN + TURN Relay Service
                             │
                     Relay Media Traffic
                             │
                     mediasoup / Peers
```

### Cloud deployment architecture

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
          |     Network Load Balancer (L4)            |
          |-------------------------------------------|
          | AWS  : Network Load Balancer (NLB)        |
          | GCP  : Network Load Balancer              |
          | Azure: Azure Load Balancer                |
          | K8s  : LoadBalancer Service / STUNner     |
          +-------------------+-----------------------+
                              |
                              |
                              ▼
                    +----------------------+
                    |      Coturn          |
                    | STUN + TURN Server   |
                    +----------+-----------+
                               |
                   Relay Allocation / Media
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
