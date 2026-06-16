# Week 1 — Review & Retrospective

**Theme:** NAT traversal & configuration foundation.

## Did you complete this week?
- [ ] **Day 1** — All hardcoded IPs/ports/origins externalized to validated env config
- [ ] **Day 2** — TCP fallback enabled (`enableTcp: true`, `preferUdp: true`)
- [ ] **Day 3** — Coturn (STUN + TURN) deployed and verified
- [ ] **Day 4** — Client `iceServers` wired from env; relay path proven
- [ ] **Day 5** — Cross-network integration test passed

## Deliverable verification
- [ ] `grep -rn "13.232.120.1\|65.0.239.130" backend/src frontend/src` → no matches
- [ ] Backend fails fast on missing required env var
- [ ] STUN + TURN both verified (binding + allocation)
- [ ] `iceTransportPolicy: "relay"` test renders media
- [ ] CORS allowlist enforced (unknown origin rejected)

## Backlog (carry-over)
> Move every unchecked item above into this list with a one-line reason and the
> day/week you'll tackle it. Carry it into next week's planning.

- [ ] _(none yet — add items here if anything slipped)_

## Retrospective notes
- What went well:
- What was harder than expected:
- Decisions/changes to the plan:
