# Week 1 · Day 4 — Wire iceServers Into the Client

> Roadmap: [index](../../README.md) · [Week 1](../README.md)
> Refs: `docs/ARCHITECTURE.md` §3 (ICE config note) · `ARCHITECTURE.md` §4

## Goal
Supply STUN/TURN `iceServers` to the client `mediasoup-client` Device / transports
so the browser actually uses the Coturn deployed on Day 3.

## Why this matters
Per `docs/ARCHITECTURE.md` §3, iceServers are configured on the **client**, not the
server transport. The frontend already references Coturn but with hardcoded URLs;
this wires it correctly from env and verifies relay actually engages.

## Tasks
- [ ] In `frontend/src/room.ts`, build `iceServers` from Vite env (`VITE_TURN_URL`, `VITE_STUN_URL`, credentials)
- [ ] Pass `iceServers` into the send transport (`broadcaster.ts`) and recv transport (`viewer.ts`) creation
- [ ] Keep `iceTransportPolicy: "all"` for normal use; add a dev toggle for `"relay"` to force/verify TURN
- [ ] Confirm `socket.ts` points at `VITE_SIGNALING_URL` (from Day 1)
- [ ] Manual test: with policy `"relay"`, confirm media still flows (proves TURN works end-to-end)

## Acceptance criteria
- [ ] With `iceTransportPolicy: "relay"`, broadcaster→viewer media still renders (relay path proven)
- [ ] With `"all"`, the connection prefers direct/UDP but falls back when blocked
- [ ] `chrome://webrtc-internals` shows relay candidates from the Coturn IP

## Notes
> This is the payoff of Days 1–3: a client on a hostile network can now connect.
