# Week 3 · Day 2 — Router Placement on Least-Loaded Worker

> Roadmap: [index](../../README.md) · [Week 3](../README.md)
> Refs: `docs/ARCHITECTURE.md` §2 (hard rule for MediaSoup), §6

## Goal

When a room is created, place its router on the least-loaded worker in the pool.

## Why this matters

"A router is pinned to a worker; you scale by **placing new rooms** on the least-loaded worker — never by migrating live media" (`docs/ARCHITECTURE.md` §2). Good placement keeps load balanced across cores.

## Tasks

* [x] In `router.ts`, accept a `worker` argument and create the router on it
* [x] Implement least-loaded selection in the worker pool module
* [x] Record `room → worker` association in the room store
* [ ] Add a guard: refuse new rooms when all workers exceed a configurable load threshold (backpressure)
* [x] Log placement decisions (worker ID, PID, router ID, current load)

## Acceptance criteria

* [x] Rooms distribute across workers (not all on worker 0)
* [x] Each router stays on its assigned worker for its whole lifetime
* [ ] When workers are saturated, new room creation is rejected gracefully

## Remaining work (≈15–30 minutes)

* Add a configurable worker capacity threshold (for example, `MEDIASOUP_MAX_USERS_PER_WORKER` or `MEDIASOUP_MAX_CONSUMERS_PER_WORKER`).
* Before assigning a worker, verify that at least one worker is below the configured threshold.
* Return a `503 Service Unavailable` (or equivalent application error) when every worker is at capacity.
* Add a log entry indicating that room creation was rejected due to worker pool saturation.

## Notes

> This sets up the cross-node Room Coordinator in Week 4 Day 3 (placement persisted in Redis).
