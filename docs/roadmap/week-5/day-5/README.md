# Week 5 · Day 5 — Abuse/Load Test & Weekly Review

> Roadmap: [index](../../README.md) · [Week 5](../README.md)
> Refs: `docs/ARCHITECTURE.md` §8 (backpressure)

## Goal
Stress the messaging tier and confirm it degrades gracefully, then run the
[weekly review](../review.md).

## Tasks
- [ ] Load test chat: many senders across ≥2 pods; confirm fanout latency stays acceptable
- [ ] Confirm outbound emit batching engages under load (no per-message storm)
- [ ] Burst reactions; confirm aggregation + 10s rollups hold (no write storm)
- [ ] Verify rate limits reject abusive clients without harming normal ones
- [ ] Verify presence stays accurate under churn (mass join/leave)
- [ ] Confirm backpressure behavior (coalesce/drop) under extreme load per §8
- [ ] Fill in [`review.md`](../review.md) and move unfinished work to its Backlog

## Acceptance criteria
- [ ] Chat/reaction/presence remain correct and bounded under load
- [ ] Rate limiting and moderation hold under abuse
- [ ] Week 5 review completed; backlog captured

## Then
Open the [Week 5 review](../review.md).
