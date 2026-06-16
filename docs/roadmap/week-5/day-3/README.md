# Week 5 · Day 3 — Presence Tracking (Redis Sets + TTL)

> Roadmap: [index](../../README.md) · [Week 5](../README.md)
> Refs: `docs/ARCHITECTURE.md` §4b, §8 (presence) · `ARCHITECTURE.md` §3.4 (`notifyViewerStateChange`)

## Goal
Replace the `notifyViewerStateChange` stub with real, cross-pod presence: accurate
live viewer counts backed by Redis.

## Why this matters
§8: `SADD room:{id}:viewers {socketId}` with per-member TTL refreshed by heartbeat;
`SCARD` for the live count; `SREM` on disconnect; periodic reconciliation removes
stale members. This makes counts correct even across pods and crashes.

## Tasks
- [ ] On join: `SADD room:{id}:viewers {socketId}` and set/refresh a per-member TTL
- [ ] Client heartbeat refreshes TTL; gateway renews membership
- [ ] On disconnect (Week 4 Day 4 hook): `SREM` the member
- [ ] Live count via `SCARD`; `PUBLISH room:{id}:presence { count }` on change (debounced)
- [ ] Periodic reconciliation sweep removes stale members (expired heartbeats)
- [ ] Update `streams.peakViewers` when a new high count is observed

## Acceptance criteria
- [ ] Live count is accurate with viewers spread across ≥2 pods
- [ ] A hard-killed client is removed from the count within the TTL window
- [ ] `peakViewers` reflects the true peak

## Notes
> Presence is ephemeral → Redis only. Durable peak/aggregates → Mongo (Week 4 / analytics).
