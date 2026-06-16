# CrowdStream — 7-Week Production Roadmap

A day-by-day execution plan to take CrowdStream from the current single-process
prototype to an MVP-grade, production-ready live-streaming platform.

This roadmap operationalizes the two architecture docs:
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — the **current** system as built.
- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — the **target** production architecture, the MVP plan (§15), and the Production Readiness Checklist (§16).

## How to use this plan

- Each working day has its own folder with a `README.md` containing a **goal**, a **task checklist**, and **acceptance criteria**.
- Work top-to-bottom. Check boxes off as you complete them (`- [x]`).
- At the **end of each week**, open that week's `review.md`, tick what you actually finished, and move anything unfinished into the **Backlog** section so it carries forward.
- 5 working days/week (Mon–Fri). 35 working days total.

## The 7 weeks at a glance

| Week | Theme | Outcome | Closes |
|---|---|---|---|
| [Week 1](week-1/) | **NAT traversal & config** | Clients behind any NAT can connect; no hardcoded IPs | Blockers §16 (TURN, announcedIp, TCP, CORS) |
| [Week 2](week-2/) | **Auth & access control** | No unauthenticated signaling; secure TURN creds | Security §16 |
| [Week 3](week-3/) | **SFU scaling foundation** | Multi-worker SFU + Redis-backed signaling | Blockers §16 (multi-worker, Redis adapter) |
| [Week 4](week-4/) | **State & persistence** | Durable lifecycle, room→node map, leak-free cleanup | Reliability §16 |
| [Week 5](week-5/) | **Real-time messaging** | Chat, reactions, presence at scale + rate limits | §8 Real-Time Messaging |
| [Week 6](week-6/) | **Recording & VOD** | FFmpeg → S3 → CloudFront pipeline | §9 Recording |
| [Week 7](week-7/) | **Observability, CI/CD & DR** | Metrics, alerts, pipeline, drain, DR | Observability + Delivery §16 |

## Definition of done (MVP)

By the end of Week 7 the system should satisfy the **MVP** target in `docs/ARCHITECTURE.md` §15:
single region, multi-AZ, TURN + JWT + Redis-backed signaling, durable lifecycle,
chat/reactions/presence, a working recording pipeline, and baseline observability + CI/CD.

## Weekly directories

- [Week 1 — NAT traversal & config](week-1/)
- [Week 2 — Auth & access control](week-2/)
- [Week 3 — SFU scaling foundation](week-3/)
- [Week 4 — State & persistence](week-4/)
- [Week 5 — Real-time messaging](week-5/)
- [Week 6 — Recording & VOD](week-6/)
- [Week 7 — Observability, CI/CD & DR](week-7/)
