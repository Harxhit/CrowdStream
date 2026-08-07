# Week 5 — Review & Retrospective

**Theme:** Real-time messaging (chat, reactions, presence).

## Did you complete this week?

- [x] **Day 1** — Chat gateway: persist → publish → cross-pod fanout + history
- [x] **Day 2** — Reaction fanout: batched emits + 10s rollups, no per-tap writes
- [x] **Day 3** — Presence via Redis sets + TTL; accurate cross-pod count; peakViewers
- [ ] **Day 4** — Token-bucket rate limits + moderation pipeline (instant cross-pod enforcement)
- [ ] **Day 5** — Abuse/load test passed; graceful degradation confirmed

## Deliverable verification

- [x] Chat works across pods; history loads for late joiners
- [x] Reaction burst → batched emits + few rollup docs (no storm)
- [x] Live count accurate across pods; killed client drops within TTL
- [ ] Rate limits reject abuse with backoff; bans enforced everywhere fast
- [ ] Messaging stays bounded under load (batching/backpressure engage)

## Backlog (carry-over)

- [ ] Add a periodic cleanup routine to remove stale viewers whose heartbeat expired and republish the updated presence count. *(Week 6 — complements TTL expiry as an additional safety mechanism.)*
