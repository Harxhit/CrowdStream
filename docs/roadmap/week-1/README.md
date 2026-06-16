# Week 1 — NAT Traversal & Configuration Foundation

**Theme:** Close the highest-impact production blockers so that *any* client, behind
any NAT, can actually connect — and so the server stops being pinned to a hardcoded IP.

**Why first:** Per `docs/ARCHITECTURE.md` §0, "No TURN/STUN" and the hardcoded
`announcedIp: 13.232.120.1` are the top blockers. Nothing else matters if viewers
behind symmetric NAT can't establish a media connection.

## Days
- [Day 1 — Externalize configuration & secrets](day-1/)
- [Day 2 — Enable TCP fallback in transports](day-2/)
- [Day 3 — Deploy Coturn (STUN + TURN)](day-3/)
- [Day 4 — Wire iceServers into the client](day-4/)
- [Day 5 — Integration test & weekly review](day-5/)

## Week goal
A broadcaster and viewer on **different restrictive networks** can connect and
exchange media, with **zero hardcoded IPs** in the codebase.

## Reference
- `docs/ARCHITECTURE.md` §0 (gaps), §3 (ICE config), §10 (TURN creds), §16 (Blockers)
- `ARCHITECTURE.md` §3.2, §4, §6
