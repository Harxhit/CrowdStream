# Week 4 · Day 5 — Failover Test & Weekly Review

> Roadmap: [index](../../README.md) · [Week 4](../README.md)
> Refs: `docs/ARCHITECTURE.md` §13 (DR — SFU failover)

## Goal
Verify durable state and clean recovery behavior, then run the [weekly review](../review.md).

## Tasks
- [ ] Kill a backend pod mid-stream; confirm clients get a clear error and can re-create/re-join (per §13: media is non-durable, RTO seconds)
- [ ] Verify `streams`/`viewer_sessions` docs reflect reality after the crash (statuses closed out or reconciled)
- [ ] Confirm room→node mapping is cleaned up for the dead node
- [ ] Run a leak soak: 100+ connect/disconnect cycles, confirm flat resource usage
- [ ] Confirm Mongo readiness gating behaves when Mongo is bounced
- [ ] Fill in [`review.md`](../review.md) and move unfinished work to its Backlog

## Acceptance criteria
- [ ] Clean client recovery after a node loss
- [ ] No resource leak across a soak test
- [ ] Persistence reflects post-crash reality
- [ ] Week 4 review completed; backlog captured

## Then
Open the [Week 4 review](../review.md).
