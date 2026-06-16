# Week 7 · Day 5 — Production-Readiness Sign-Off & Final Review

> Roadmap: [index](../../README.md) · [Week 7](../README.md)
> Refs: `docs/ARCHITECTURE.md` §15 (MVP target), §16 (full checklist)

## Goal
Walk the entire Production Readiness Checklist (§16), sign off the MVP, and run the
[final review](../review.md).

## Why this matters
This is the moment the 7 weeks converge on the §15 MVP definition: single region,
multi-AZ, TURN + JWT + Redis-backed signaling, durable lifecycle, messaging,
recording, and baseline observability + CI/CD.

## Tasks
- [ ] Walk **every** box in `docs/ARCHITECTURE.md` §16 and mark done / backlog
- [ ] Re-run the Week 1 cross-network connect test (regression)
- [ ] Confirm auth, rate limits, and moderation still hold end to end
- [ ] Confirm dashboards, alerts, and a clean CI/CD deploy
- [ ] Do a full dry-run: deploy via pipeline → broadcast → viewers chat/react → record → play VOD → drain a node
- [ ] Write the consolidated **backlog** across all 7 weeks into [`review.md`](../review.md)
- [ ] Decide the next milestone (Growth tier, §15) and what carries over

## Acceptance criteria
- [ ] §16 checklist reviewed; every item done or explicitly backlogged with an owner/date
- [ ] Full dry-run passes end to end
- [ ] MVP signed off; Growth-tier backlog captured

## Then
Open the [Week 7 / final review](../review.md).
