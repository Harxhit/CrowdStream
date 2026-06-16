# Week 2 · Day 5 — Access Enforcement & Weekly Review

> Roadmap: [index](../../README.md) · [Week 2](../README.md)
> Refs: `docs/ARCHITECTURE.md` §10 · `verifyViewerAccess.ts` (TODO stub)

## Goal
Enforce per-room access and ban checks at join, then run the [weekly review](../review.md).

## Why this matters
`backend/src/utils/verifyViewerAccess.ts` is a stub. With identity now verified
(Days 1–2), we can gate room access and reject banned users.

## Tasks
- [ ] Implement `verifyViewerAccess.ts`: check `banned` flag and room visibility (`public`/`private`/`unlisted`) before `joinAsViewer`
- [ ] Reject join for banned users with a clear error event
- [ ] Gate `createRoom` to users with the `broadcaster` role
- [ ] Add an end-to-end auth smoke test (login → connect → join → produce/consume)
- [ ] Fill in [`review.md`](../review.md) and move unfinished work to its Backlog

## Acceptance criteria
- [ ] Banned user cannot join any room
- [ ] Non-broadcaster cannot create a room
- [ ] Full authenticated path works end to end
- [ ] Week 2 review completed; backlog captured

## Then
Open the [Week 2 review](../review.md).
