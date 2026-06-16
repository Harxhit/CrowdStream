# Week 2 · Day 2 — JWT on the Socket.IO Handshake

> Roadmap: [index](../../README.md) · [Week 2](../README.md)
> Refs: `docs/ARCHITECTURE.md` §10 · `ARCHITECTURE.md` §3.1, §3.4

## Goal
Reject any signaling connection that doesn't present a valid access JWT.

## Why this matters
`utils/socket.util.ts` currently accepts every connection and immediately wires
broadcaster/viewer handlers. An open WS lets anyone create rooms and produce media.

## Tasks
- [ ] Add a Socket.IO **auth middleware** (`io.use(...)`) that reads the token from `socket.handshake.auth.token`
- [ ] Verify the JWT (Day 1 helper); attach `socket.data.user = { id, roles }` on success
- [ ] Reject with an auth error on missing/invalid/expired token (`next(new Error(...))`)
- [ ] Frontend `socket.ts`: pass the access token in the `auth` option of the client
- [ ] Add token-refresh handling on the client when the socket is rejected for expiry
- [ ] Ensure all handlers (`registerBroadcaster`, `registerViewer`) can rely on `socket.data.user`

## Acceptance criteria
- [ ] A connection without a token is rejected before any handler runs
- [ ] A valid token connects and `socket.data.user` is populated
- [ ] An expired token is rejected; client refreshes and reconnects successfully

## Notes
> This is the core "reject unauthenticated signaling" blocker in §16.
