# Week 4 — Review & Retrospective

**Theme:** State, persistence & reliability.

## Did you complete this week?
- [x] **Day 1** — Mongo connection wired into boot with health gating
- [x] **Day 2** — Stream & viewer-session lifecycle persisted (start/end, watch duration, peak)
- [x] **Day 3** — Room→node placement map in Redis (Coordinator), cleaned up on end
- [x] **Day 4** — `handleDisconnect` wired in; zombie transport sweep; leak fixed
- [ ] **Day 5** — Failover + leak soak test passed

## Deliverable verification
- [x] Server connects to Mongo at boot; readiness reflects DB status
- [x] Completed stream has accurate `streams` + `viewer_sessions` docs
- [x] A non-creating pod resolves room→node from Redis
- [ ] Connect/disconnect soak shows flat resource counts (no leak)
- [ ] Clean client recovery after a simulated node loss

## Backlog (carry-over)

- [ ] **Week 5** — Run connect/disconnect soak tests and failover testing to validate resource cleanup, verify no MediaSoup leaks, and confirm clean client recovery after simulated node loss.
- [ ] 
**Decisions/changes to the plan:**
- Deferred comprehensive soak testing and failover validation to Week 5 after all reliability changes were completed, so testing can be performed against the finalized implementation.
