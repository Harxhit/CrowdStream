# Week 3 · Day 4 — Sticky Sessions & Multi-Pod Signaling

> Roadmap: [index](../../README.md) · [Week 3](../README.md)
> Refs: `docs/ARCHITECTURE.md` §2 (Signaling row), §8, §16

## Goal
Run signaling behind a load balancer with sticky sessions so a client stays pinned
to one pod for its WebSocket lifetime.

## Why this matters
Socket.IO holds soft per-connection state; without sticky sessions the long-polling
handshake and upgrade can land on different pods and break. Sticky + Redis adapter
together unlock horizontal signaling.

## Tasks
- [ ] Configure the load balancer (ALB) with **sticky sessions** (cookie-based) for the signaling target group
- [ ] Confirm WebSocket upgrade works through the LB (not just HTTP polling)
- [ ] Document the local equivalent (e.g. nginx `ip_hash` or sticky upstream) for dev/staging
- [ ] Add a `pod`/instance id to logs and to a debug event so you can confirm pinning
- [ ] Run ≥2 signaling pods behind the LB and verify a client stays on one pod
- [ ] Confirm reconnect after pod drain lands cleanly on a healthy pod

## Acceptance criteria
- [ ] A client's repeated requests hit the same pod (sticky proven via instance id)
- [ ] WS upgrade succeeds through the LB
- [ ] Cross-pod room events still work (Redis adapter from Day 3)

## Notes
> Sticky sessions are about *connection affinity*, not room placement. Room→node
> placement (media) is handled separately by the Coordinator (Week 4 Day 3).
