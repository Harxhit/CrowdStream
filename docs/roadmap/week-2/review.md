# Week 2 — Review & Retrospective

**Theme:** Authentication & access control.

## Did you complete this week?
- [ ] **Day 1** — `users` model + register/login + access & refresh token issuance
- [ ] **Day 2** — JWT verified on the Socket.IO handshake; unauthenticated rejected
- [ ] **Day 3** — Refresh token rotation (hashed, reuse-detection, logout)
- [ ] **Day 4** — Time-limited HMAC TURN credentials wired into client
- [ ] **Day 5** — Access/ban enforcement at join; auth smoke test green

## Deliverable verification
- [ ] Connection without a valid token is rejected before handlers run
- [ ] Passwords and refresh tokens stored only as hashes
- [ ] Rotated/expired refresh token cannot be reused
- [ ] Coturn rejects expired HMAC credentials
- [ ] Banned user blocked at join; non-broadcaster cannot create rooms

## Backlog (carry-over)
> Move every unchecked item above into this list with a one-line reason and the
> day/week you'll tackle it.

- [ ] _(none yet — add items here if anything slipped)_

## Retrospective notes
- What went well:
- What was harder than expected:
- Decisions/changes to the plan:
