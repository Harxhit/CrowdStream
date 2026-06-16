# Week 2 — Authentication & Access Control

**Theme:** Stop running an open WebSocket. Authenticate every connection and issue
secure, time-limited TURN credentials.

**Why now:** With NAT traversal working (Week 1), the next blocker is that signaling
is wide open (`docs/ARCHITECTURE.md` §0: "No auth / no JWT, open WS"). Anyone can
create rooms, join, and exhaust resources.

## Days
- [Day 1 — Auth service & user model design](day-1/)
- [Day 2 — JWT on the Socket.IO handshake](day-2/)
- [Day 3 — Refresh token rotation](day-3/)
- [Day 4 — Time-limited HMAC TURN credentials](day-4/)
- [Day 5 — Access enforcement & weekly review](day-5/)

## Week goal
Every signaling connection is authenticated with a verified JWT; TURN credentials
are short-lived HMAC tokens; banned users are rejected at join.

## Reference
- `docs/ARCHITECTURE.md` §7 (`users` collection), §10 (Security), §16 (Security)
- `ARCHITECTURE.md` §3.4, §9 (no auth today)
