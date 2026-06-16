# Week 4 · Day 4 — Wire Disconnect Cleanup + Zombie Transport Sweep

> Roadmap: [index](../../README.md) · [Week 4](../README.md)
> Refs: `ARCHITECTURE.md` §3.4 (disconnect not wired) · `docs/ARCHITECTURE.md` §16 (Reliability)

## Goal
Fix the known resource leak: actually invoke `handleDisconnect` on socket
disconnect, and add a sweep for zombie transports.

## Why this matters
`ARCHITECTURE.md` §3.4/§9 documents that `handleDisconnect` exists in
`disconnect.handlers.ts` but is **not wired** into the `disconnect` event in
`socket.util.ts` (which only logs). MediaSoup transports/producers/consumers leak
on every disconnect.

## Tasks
- [ ] In `utils/socket.util.ts`, call `handleDisconnect(socket)` on the `disconnect` event (replace the log-only stub)
- [ ] Verify `cleanupViewer` / `cleanUpBroadcaster` close transports, producers, consumers and delete Map entries
- [ ] Update `viewer_sessions.leftAt` on disconnect (ties to Day 2)
- [ ] Decrement presence / room counts (sets up Week 5)
- [ ] Add a periodic **TTL sweep** for transports with no activity (zombie cleanup) per §16
- [ ] Confirm no leak: open/close many viewers and watch transport/consumer counts return to baseline

## Acceptance criteria
- [ ] Disconnect closes all MediaSoup resources for that socket
- [ ] Repeated connect/disconnect cycles do not grow resource counts (no leak)
- [ ] Zombie transports are reaped by the sweep

## Notes
> This single wiring fix is the highest-value reliability change of the week.
