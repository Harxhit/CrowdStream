# Week 3 — Review & Retrospective

**Theme:** SFU scaling foundation.

## Did you complete this week?
- [ ] **Day 1** — Worker pool (1 per vCPU) replaces per-room workers; dead-worker recovery
- [ ] **Day 2** — Routers placed on least-loaded worker; placement logged
- [ ] **Day 3** — Redis + Socket.IO Redis adapter; cross-process broadcast works
- [ ] **Day 4** — Sticky sessions; ≥2 signaling pods behind LB
- [ ] **Day 5** — Load test confirms distribution; per-worker ceiling captured

## Deliverable verification
- [ ] N workers at boot regardless of room count
- [ ] Rooms distribute across workers; routers stay pinned
- [ ] Emit on pod A received on pod B (Redis adapter)
- [ ] Client stays pinned to one pod (sticky); WS upgrade works through LB
- [ ] Documented approximate consumers-per-worker ceiling

## Backlog (carry-over)
> Move every unchecked item above into this list with a one-line reason and the
> day/week you'll tackle it.

- [ ] _(none yet — add items here if anything slipped)_

## Retrospective notes
- What went well:
- What was harder than expected:
- Decisions/changes to the plan:
