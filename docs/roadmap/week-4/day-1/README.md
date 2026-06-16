# Week 4 · Day 1 — Wire the MongoDB Connection Into Boot

> Roadmap: [index](../../README.md) · [Week 4](../README.md)
> Refs: `ARCHITECTURE.md` §7 (persistence scaffolded) · `docs/ARCHITECTURE.md` §7

## Goal
Actually connect to MongoDB at startup using the existing `database/index.ts`, with
health gating.

## Why this matters
`backend/src/database/index.ts` provides `connectToDataBase()` but it's **never
invoked** — no model is touched at runtime today. Everything in Week 4 depends on a
live connection.

## Tasks
- [ ] Call `connectToDataBase()` during boot in `index.ts` (await before listening, or gate readiness on it)
- [ ] Read `MONGO_DB_URL` / `DATA_BASE_NAME` from the Week 1 config loader
- [ ] Add connection event handlers (connected/error/disconnected) with Winston logging
- [ ] Add Mongo status to the `/__ping` / readiness check
- [ ] Add a retry/backoff on initial connect failure
- [ ] Verify the existing models (`LiveRoom`, `Broadcaster`, `Viewer`, `Producer`, `Transport`) register against the connection

## Acceptance criteria
- [ ] Server connects to Mongo at boot and logs it
- [ ] Readiness check fails while Mongo is down, recovers when it returns
- [ ] No runtime errors from model registration

## Notes
> Don't persist hot per-frame state in Mongo — only durable lifecycle/history (Day 2).
> Hot ephemeral state stays in Redis.
