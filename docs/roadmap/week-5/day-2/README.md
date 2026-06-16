# Week 5 · Day 2 — Reaction Fanout (Batched + Aggregated)

> Roadmap: [index](../../README.md) · [Week 5](../README.md)
> Refs: `docs/ARCHITECTURE.md` §4c, §7 (reactions), §8

## Goal
Implement emoji reactions that fan out in near-real-time but are **never persisted
per-tap** — only aggregated into time buckets.

## Why this matters
Reactions are a write-storm risk. §8 mandates: client → gateway → publish → gateways
**batch + aggregate** over a 100–250ms window → single emit; persist only 10s rollups.

## Tasks
- [ ] Add a `reaction` socket event (`{ emoji }`, rate-limited placeholder for Day 4)
- [ ] `PUBLISH room:{id}:reactions { emoji, ts }`
- [ ] Gateway-side **batch+aggregate** counts over a 100–250ms window → single emit to room
- [ ] Create the `reactions` model per §7 (aggregated: `bucketTs` 10s bucket, `counts: {emoji: n}`)
- [ ] Write only 10s rollups to Mongo (not per-tap); index `{ streamId, bucketTs }`
- [ ] Confirm a burst of taps produces one batched client emit and one rollup row

## Acceptance criteria
- [ ] 100 reactions in 1s → batched emits (not 100 individual emits) and one/few rollup docs
- [ ] No per-tap Mongo writes
- [ ] Reactions visible across pods

## Notes
> This pattern is the difference between "fun feature" and "DB on fire at scale."
