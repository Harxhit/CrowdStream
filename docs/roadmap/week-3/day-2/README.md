# Week 3 · Day 2 — Router Placement on Least-Loaded Worker

> Roadmap: [index](../../README.md) · [Week 3](../README.md)
> Refs: `docs/ARCHITECTURE.md` §2 (hard rule for MediaSoup), §6

## Goal
When a room is created, place its router on the least-loaded worker in the pool.

## Why this matters
"A router is pinned to a worker; you scale by **placing new rooms** on the
least-loaded worker — never by migrating live media" (`docs/ARCHITECTURE.md` §2).
Good placement keeps load balanced across cores.

## Tasks
- [ ] In `router.ts`, accept a `worker` argument and create the router on it
- [ ] Implement least-loaded selection (fewest routers/consumers) in the pool module
- [ ] Record `room → worker` association in the room store
- [ ] Add a guard: refuse new rooms when all workers exceed a load threshold (backpressure)
- [ ] Log placement decisions (which worker got the room, current load)

## Acceptance criteria
- [ ] Rooms distribute across workers (not all on worker 0)
- [ ] Each router stays on its assigned worker for its whole lifetime
- [ ] When workers are saturated, new room creation is rejected gracefully

## Notes
> This sets up the cross-node Room Coordinator in Week 4 Day 3 (placement persisted in Redis).
