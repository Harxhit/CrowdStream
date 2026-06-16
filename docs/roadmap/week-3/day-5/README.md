# Week 3 · Day 5 — Load Test & Weekly Review

> Roadmap: [index](../../README.md) · [Week 3](../README.md)
> Refs: `docs/ARCHITECTURE.md` §6 (per-worker math)

## Goal
Validate that media spreads across workers and signaling scales across pods, then
run the [weekly review](../review.md).

## Tasks
- [ ] Spin up multiple rooms and confirm routers land on different workers
- [ ] Simulate many viewers on one room; observe per-worker CPU/consumer counts
- [ ] Run a basic signaling load test across ≥2 pods (e.g. with `artillery`/`k6` against the WS endpoint)
- [ ] Record the approximate consumer count where a single worker's CPU saturates (baseline for §6 math)
- [ ] Note any scaling limits hit (NIC, CPU, WS/pod) in the review
- [ ] Fill in [`review.md`](../review.md) and move unfinished work to its Backlog

## Acceptance criteria
- [ ] Demonstrated multi-worker distribution and multi-pod signaling
- [ ] Captured a rough per-worker consumer ceiling
- [ ] Week 3 review completed; backlog captured

## Then
Open the [Week 3 review](../review.md).
