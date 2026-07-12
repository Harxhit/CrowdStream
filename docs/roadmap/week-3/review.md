# Week 3 — Review & Retrospective

**Theme:** SFU scaling foundation.

## Did you complete this week?

* [x] **Day 1** — Worker pool (1 per vCPU) replaces per-room workers; dead-worker recovery
* [x] **Day 2** — Routers placed on least-loaded worker; placement logged
* [x] **Day 3** — Redis + Socket.IO Redis adapter; cross-process broadcast works
* [x] **Day 4** — Sticky sessions; ≥2 signaling pods behind LB
* [ ] **Day 5** — Load test confirms distribution; per-worker ceiling captured *(deferred)*

## Deliverable verification

* [x] Fixed-size worker pool created at startup regardless of room count
* [x] Rooms are assigned to existing workers instead of creating new workers
* [x] Worker recovery implemented for unexpected worker death
* [x] Routers are placed on the least-loaded worker and remain pinned for their lifetime
* [x] Cross-process Socket.IO events verified using the Redis adapter
* [x] Client remains pinned to one signaling instance using cookie-based sticky sessions
* [x] WebSocket upgrade verified through the load balancer
* [x] Automatic client reconnection verified after signaling node failure
* [ ] Approximate consumers-per-worker ceiling documented *(deferred until comprehensive performance testing)*

## Backlog (carry-over)

* [ ] Perform end-to-end load testing and document approximate consumers-per-worker capacity.
* [ ] Benchmark signaling and media performance under concurrent broadcaster/viewer workloads.
* [ ] Validate worker scaling thresholds under sustained load.

## Local Signaling and Media Architecture

It will be same for cloud to we are going to use there respective LB. 

```text
                              Browser
                                 │
               ┌─────────────────┴─────────────────┐
               │                                   │
        HTTP / WebSocket                     STUN / TURN
        (Control Plane)                     (Media Plane)
               │                                   │
             ngrok                          Network Load Balancer(Envoy UDP/ HAProxy TCP)
               │                                  
             Nginx                       
               │                                   │
            HAProxy                               Coturn
      (Application LB)                             │
               │                                   │
      ┌────────┴────────┐                          │
      │                 │                          │
 Node.js #1        Node.js #2                      │
 (Socket.IO)       (Socket.IO)                     │
      │                 │                          │
      └────── Redis Pub/Sub ──────┐               │
                                  │               │
                           mediasoup Workers ◄────┘
                                  │
                                  ▼
                             RTP / RTCP
```
