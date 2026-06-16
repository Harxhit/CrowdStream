# Week 4 — State, Persistence & Reliability

**Theme:** Make state durable and leak-free. Wire up the Mongo models that already
exist, persist lifecycle, share room placement across pods, and fix the disconnect leak.

**Why now:** `docs/ARCHITECTURE.md` §0 flags "in-memory rooms (no failover)" and the
models being "defined but not actively persisted." `ARCHITECTURE.md` §3.6/§9 notes
`handleDisconnect` is **not wired** into the disconnect event — a live resource leak.

## Days
- [Day 1 — Wire the MongoDB connection into boot](day-1/)
- [Day 2 — Persist stream & viewer-session lifecycle](day-2/)
- [Day 3 — Room→node placement map in Redis (Coordinator)](day-3/)
- [Day 4 — Wire disconnect cleanup + zombie transport sweep](day-4/)
- [Day 5 — Failover test & weekly review](day-5/)

## Week goal
Stream/session lifecycle is persisted to Mongo, room placement is shared via Redis,
and disconnects reliably free MediaSoup resources with no leaks.

## Reference
- `docs/ARCHITECTURE.md` §4 (data flow), §7 (schemas), §13 (DR), §16 (Reliability)
- `ARCHITECTURE.md` §3.3, §3.4 (disconnect not wired), §7 (persistence scaffolded)
