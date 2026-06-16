# Week 4 — Review & Retrospective

**Theme:** State, persistence & reliability.

## Did you complete this week?
- [ ] **Day 1** — Mongo connection wired into boot with health gating
- [ ] **Day 2** — Stream & viewer-session lifecycle persisted (start/end, watch duration, peak)
- [ ] **Day 3** — Room→node placement map in Redis (Coordinator), cleaned up on end
- [ ] **Day 4** — `handleDisconnect` wired in; zombie transport sweep; leak fixed
- [ ] **Day 5** — Failover + leak soak test passed

## Deliverable verification
- [ ] Server connects to Mongo at boot; readiness reflects DB status
- [ ] Completed stream has accurate `streams` + `viewer_sessions` docs
- [ ] A non-creating pod resolves room→node from Redis
- [ ] Connect/disconnect soak shows flat resource counts (no leak)
- [ ] Clean client recovery after a simulated node loss

## Backlog (carry-over)
> Move every unchecked item above into this list with a one-line reason and the
> day/week you'll tackle it.

- [ ] _(none yet — add items here if anything slipped)_

## Retrospective notes
- What went well:
- What was harder than expected:
- Decisions/changes to the plan:
