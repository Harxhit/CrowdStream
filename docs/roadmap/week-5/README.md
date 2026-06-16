# Week 5 — Real-Time Messaging (Chat, Reactions, Presence)

**Theme:** Build the interactive layer — chat, reactions, and live viewer counts —
on the Redis backplane, with rate limiting and moderation so it survives abuse.

**Why now:** `docs/ARCHITECTURE.md` §8 formalizes the current `notifyViewerStateChange`
stub and raw `io` broadcast into dedicated Redis channels. This is the evolution of
the existing presence stub into a scalable messaging tier.

## Days
- [Day 1 — Chat gateway (persist → publish → fanout)](day-1/)
- [Day 2 — Reaction fanout (batched + aggregated)](day-2/)
- [Day 3 — Presence tracking (Redis sets + TTL)](day-3/)
- [Day 4 — Rate limiting & moderation](day-4/)
- [Day 5 — Abuse/load test & weekly review](day-5/)

## Week goal
Viewers can chat and react in real time across pods, see an accurate live count,
and the system resists spam via token-bucket rate limits and a moderation pipeline.

## Reference
- `docs/ARCHITECTURE.md` §4c/§4d (flows), §7 (chat/reactions schemas), §8, §10 (moderation/rate limit), §16
- `ARCHITECTURE.md` §3.4 (`notifyViewerStateChange`)
