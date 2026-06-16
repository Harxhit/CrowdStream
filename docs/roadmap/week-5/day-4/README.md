# Week 5 · Day 4 — Rate Limiting & Moderation

> Roadmap: [index](../../README.md) · [Week 5](../README.md)
> Refs: `docs/ARCHITECTURE.md` §4d, §10 (rate limit + moderation), §7 (moderation_events), §16

## Goal
Protect the messaging tier with Redis token-bucket rate limits and a moderation
pipeline that enforces bans/mutes/deletes instantly across pods.

## Why this matters
§10: token-bucket per user/IP on chat, reactions, join, transport-create; moderation
filters chat ingest and fans actions out via Redis so all gateways enforce instantly.

## Tasks
- [ ] Implement a Redis **token-bucket** limiter; apply to `chat:message`, `reaction`, `joinRoom`, transport-create
- [ ] Reject over-limit actions with backoff feedback to the client
- [ ] Add the moderation filter at chat ingest (profanity/spam/ban check) → fill the Day 1 hook
- [ ] Create `moderation_events` model per §7; record mute/ban/delete/timeout/flag
- [ ] Moderator actions `PUBLISH` to a control channel so **all** gateways enforce immediately
- [ ] Enforce ban list at join (ties to Week 2 Day 5 `verifyViewerAccess`)

## Acceptance criteria
- [ ] Spamming chat/reactions trips the rate limit and is rejected with backoff
- [ ] A banned/muted user is blocked across all pods within moments of the action
- [ ] Moderation actions are recorded in `moderation_events`

## Notes
> Rate limits are also a DoS control (§10) — tune buckets per action class.
