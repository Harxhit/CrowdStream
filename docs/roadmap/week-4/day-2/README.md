# Week 4 · Day 2 — Persist Stream & Viewer-Session Lifecycle

> Roadmap: [index](../../README.md) · [Week 4](../README.md)
> Refs: `docs/ARCHITECTURE.md` §4 (data flow), §7 (streams, viewer_sessions)

## Goal
Record the lifecycle of streams and viewer sessions in Mongo so history and
analytics exist.

## Why this matters
Per §4a/§4b, creating a room should insert a `streams` doc and a viewer join should
insert a `viewer_sessions` doc. Today none of this is recorded, so there's no
history, no peak-viewer count, nothing to analyze.

## Tasks
- [ ] On `createRoom`: insert/update a `streams` doc (`status: "live"`, `hostUserId`, `startedAt`, `sfuNodeId`)
- [ ] On viewer `joinRoom`: insert a `viewer_sessions` doc (`joinedAt`, `socketId`, `userId`, hashed IP/UA)
- [ ] On viewer leave/disconnect: set `leftAt` and compute `watchDurationSec`
- [ ] On stream end: set `streams.status = "ended"`, `endedAt`, `peakViewers`
- [ ] Add the indexes from §7 (`{ roomId, startedAt }`, `{ streamId }`, etc.)
- [ ] Keep writes off the hot media path (fire-and-forget / queue where appropriate)

## Acceptance criteria
- [ ] A completed stream has a `streams` doc with start/end and peak viewers
- [ ] Each viewer produces a `viewer_sessions` doc with a sane `watchDurationSec`
- [ ] Indexes exist and queries for stream history are fast

## Notes
> `viewer_sessions` extends the existing `viewer.model.ts`. Hash IPs before storing (privacy, §7).
