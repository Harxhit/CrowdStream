# Week 5 · Day 1 — Chat Gateway (Persist → Publish → Fanout)

> Roadmap: [index](../../README.md) · [Week 5](../README.md)
> Refs: `docs/ARCHITECTURE.md` §4d, §7 (chat_messages), §8

## Goal
Implement room chat: persist each message, publish to a Redis channel, fan out to
all viewers across pods.

## Why this matters
Chat is the only high-frequency *persisted* write (§7). It must work across pods
(Redis adapter, Week 3) and be ready for the moderation gate (Day 4).

## Tasks
- [ ] Create the `chat_messages` model per §7 (`streamId`, `userId`, `username`, `text`, `createdAt`, `deleted`)
- [ ] Add a `chat:message` socket event (authenticated, from Week 2)
- [ ] Flow: validate → (moderation hook placeholder) → persist to Mongo → `PUBLISH room:{id}:chat`
- [ ] Subscribe gateways to `room:{id}:chat`; fan out to room members
- [ ] Implement chat history fetch (range scan on `{ streamId, createdAt }`) for late joiners
- [ ] Add index `{ streamId: 1, createdAt: 1 }`

## Acceptance criteria
- [ ] A message from a viewer on pod A appears for a viewer on pod B
- [ ] Messages persist and history loads in order for a late joiner
- [ ] Moderation hook point exists (filled in Day 4)

## Notes
> Under high volume, batch outbound emits (flush every 100–250ms) — see Day 5 / §8.
