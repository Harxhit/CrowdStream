# Week 3 · Day 3 — Redis + Socket.IO Redis Adapter

> Roadmap: [index](../../README.md) · [Week 3](../README.md)
> Refs: `docs/ARCHITECTURE.md` §8 (Redis adapter), §16 (Blockers)

## Goal
Introduce Redis and attach the Socket.IO Redis adapter so events broadcast across
multiple signaling processes.

## Why this matters
Today signaling is single-process. To run >1 pod, a viewer connected to pod B must
receive events emitted from pod A — that's what `@socket.io/redis-adapter` provides
via Redis Pub/Sub.

## Tasks
- [ ] Provision Redis (local Docker for dev; ElastiCache cluster-mode for prod per §5)
- [ ] Add a Redis client module (`backend/src/redis/index.ts`) reading connection from env
- [ ] Install and attach `@socket.io/redis-adapter` to the Socket.IO server in `utils/socket.util.ts`
- [ ] Verify cross-process broadcast with two local backend instances
- [ ] Add Redis health to the readiness check
- [ ] Handle Redis reconnects gracefully (don't crash on transient disconnect)

## Acceptance criteria
- [ ] Two backend instances share room broadcasts (emit on A → received on B)
- [ ] Redis connection failure is logged and retried, not fatal after boot
- [ ] Readiness check reflects Redis status

## Notes
> Redis becomes the backbone for presence, room→node map, rate limits, and pub/sub
> in Weeks 4–5 — this is the foundational piece.
