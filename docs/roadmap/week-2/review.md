# Week 2 — Review & Retrospective

**Theme:** Authentication & Access Control

## Did you complete this week?

- [x] **Day 1** — `users` model + register/login + access token issuance
- [ ] **Day 2** — JWT verified on the Socket.IO handshake; unauthenticated rejected
- [ ] **Day 3** — Refresh token rotation (hashed, reuse-detection, logout)
- [ ] **Day 4** — Time-limited HMAC TURN credentials wired into client
- [ ] **Day 5** — Access/ban enforcement at join; auth smoke test green

---

## Deliverable verification

- [x] User registration and login implemented
- [x] Passwords stored as secure hashes
- [x] HTTP-only JWT authentication integrated with the frontend
- [x] Protected routes implemented for authenticated pages
- [ ] Connection without a valid token is rejected before handlers run
- [ ] Rotated/expired refresh token cannot be reused
- [ ] Coturn rejects expired HMAC credentials
- [ ] Banned user blocked at join; non-broadcaster cannot create rooms

---

## Backlog (carry-over)

### Refresh Token Rotation

**Reason:** CrowdStream is a standalone infrastructure project focused on real-time streaming and MediaSoup. Full refresh-token rotation, reuse detection, and logout flows are important for production applications but are not required for demonstrating the streaming architecture. This functionality can be added later without affecting the core project goals.

**Planned:** Future enhancement (post-MVP)

- [ ] Implement refresh token storage
- [ ] Hash refresh tokens
- [ ] Token rotation
- [ ] Reuse detection
- [ ] Logout flow

---

### JWT Verification during Socket.IO Handshake

**Reason:** Authentication is already implemented for the HTTP API. The next step is extending authentication to Socket.IO so only authenticated users can establish real-time connections.

- [ ] Verify JWT during Socket.IO handshake
- [ ] Reject unauthenticated socket connections

---

### Time-limited HMAC TURN Credentials

**Reason:** Static TURN credentials are sufficient during local development. Temporary HMAC credentials are a production security enhancement and will be implemented when the TURN infrastructure is finalized.


- [ ] Generate temporary TURN credentials
- [ ] Wire credentials into the frontend
- [ ] Validate expiration through Coturn

---

### Access Control

**Reason:** Authentication is complete, but authorization rules (room ownership, bans, broadcaster permissions) are planned after the signaling layer is finalized.

**Planned:** Week 8

- [ ] Broadcaster-only room creation
- [ ] Ban enforcement
- [ ] Authorization middleware

---

## Retrospective Notes

### What went well

- Implemented complete user authentication using JWT and HTTP-only cookies.
- Built sign-up and sign-in flows from backend to frontend.
- Added protected routing for authenticated pages.
- Designed and implemented the broadcaster dashboard.
- Designed and implemented the viewer dashboard.
- Refactored the frontend into reusable components for future development.

### What was harder than expected

- Building the frontend took longer than expected due to the amount of UI work involved.
- Managing MediaSoup state between React components required additional architectural planning.
- Organizing reusable dashboard components while keeping business logic separated from UI.

### Decisions / Changes to the Plan

- Refresh-token rotation has been postponed. It is valuable for production systems but not essential for demonstrating CrowdStream's streaming infrastructure.
- The project will continue using short-lived JWT access tokens for the MVP.
- Socket.IO authentication and TURN HMAC credentials have been moved to Week 3 because they are directly related to the real-time communication layer currently under development.
- Current focus remains on completing the WebRTC signaling flow and production-ready streaming pipeline before implementing additional security enhancements.
