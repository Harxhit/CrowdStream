# Week 4 · Day 3 — Room→Node Placement Map in Redis (Coordinator)

> Roadmap: [index](../../README.md) · [Week 4](../README.md)
> Refs: `docs/ARCHITECTURE.md` §2 (Room Coordinator), §4a, §16 (Reliability)

## Goal
Persist the `room → SFU node/worker` mapping in Redis so every signaling pod agrees
on where a room lives.

## Why this matters
With multi-pod signaling (Week 3) and the worker pool (Week 3 Day 1–2), a pod that
didn't create the room still needs to know which node/worker hosts it. The Room
Coordinator owns this placement decision (`docs/ARCHITECTURE.md` §2).

## Tasks
- [ ] Add a Coordinator module that, on room creation, picks a node/worker and writes `SET room:{id}:node`
- [ ] Write `room:{id}:meta` (status, hostUserId, startedAt) to Redis
- [ ] On join/produce/consume, look up `room:{id}:node` to route correctly
- [ ] Clear the mapping when the room ends
- [ ] Handle the "room not found / node gone" case explicitly (client gets a clear error → re-create)
- [ ] Add a TTL or reconciliation so stale mappings don't linger after a crash

## Acceptance criteria
- [ ] A pod that didn't create the room can still resolve its node from Redis
- [ ] Mapping is removed on room end
- [ ] Stale mappings are reconciled (no orphan room→node entries)

## Notes
> This is the multi-pod prerequisite for graceful SFU drain in Week 7 Day 4.
