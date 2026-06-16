# Week 5 — Review & Retrospective

**Theme:** Real-time messaging (chat, reactions, presence).

## Did you complete this week?
- [ ] **Day 1** — Chat gateway: persist → publish → cross-pod fanout + history
- [ ] **Day 2** — Reaction fanout: batched emits + 10s rollups, no per-tap writes
- [ ] **Day 3** — Presence via Redis sets + TTL; accurate cross-pod count; peakViewers
- [ ] **Day 4** — Token-bucket rate limits + moderation pipeline (instant cross-pod enforcement)
- [ ] **Day 5** — Abuse/load test passed; graceful degradation confirmed

## Deliverable verification
- [ ] Chat works across pods; history loads for late joiners
- [ ] Reaction burst → batched emits + few rollup docs (no storm)
- [ ] Live count accurate across pods; killed client drops within TTL
- [ ] Rate limits reject abuse with backoff; bans enforced everywhere fast
- [ ] Messaging stays bounded under load (batching/backpressure engage)

## Backlog (carry-over)
> Move every unchecked item above into this list with a one-line reason and the
> day/week you'll tackle it.

- [ ] _(none yet — add items here if anything slipped)_

## Retrospective notes
- What went well:
- What was harder than expected:
- Decisions/changes to the plan:
