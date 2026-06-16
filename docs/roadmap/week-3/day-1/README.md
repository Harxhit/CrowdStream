# Week 3 · Day 1 — MediaSoup Worker Pool (1 per vCPU)

> Roadmap: [index](../../README.md) · [Week 3](../README.md)
> Refs: `docs/ARCHITECTURE.md` §2, §6 · `ARCHITECTURE.md` §3.2 (worker-per-room note)

## Goal
Replace the "one worker per room" model with a fixed pool of workers sized to the
number of CPU cores.

## Why this matters
`worker.ts` calls `initWorker()` per room. The canonical model is **1 worker per
vCPU**, created once at boot. A worker is a separate C++ process; over-spawning
them wastes memory and breaks the per-core scaling math (~500 consumers/core).

## Tasks
- [ ] Refactor `backend/src/mediasoup/worker.ts` to create `os.cpus().length` workers at startup
- [ ] Expose `getNextWorker()` / `getLeastLoadedWorker()` from the pool module
- [ ] Track per-worker load (router count, consumer count) in memory
- [ ] Handle worker `died` event: log, alert, and recreate the worker
- [ ] Update `createRoom` (in `rooms/room.store.ts`) to request a worker from the pool instead of `initWorker()` per room
- [ ] Make pool size configurable via env (override for small instances)

## Acceptance criteria
- [ ] Exactly N workers exist at boot (N = vCPUs or env override), regardless of room count
- [ ] Creating 10 rooms does **not** create 10 workers
- [ ] A killed worker is detected and recreated

## Notes
> Routers are pinned to a worker for their lifetime — placement (Day 2) decides which.
