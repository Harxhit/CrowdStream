# Week 3 — Review & Retrospective

**Theme:** SFU scaling foundation.

## Did you complete this week?

* [x] **Day 1** — Worker pool (1 per vCPU) replaces per-room workers; dead-worker recovery
* [ ] **Day 2** — Routers placed on least-loaded worker; placement logged
* [ ] **Day 3** — Redis + Socket.IO Redis adapter; cross-process broadcast works
* [ ] **Day 4** — Sticky sessions; ≥2 signaling pods behind LB
* [ ] **Day 5** — Load test confirms distribution; per-worker ceiling captured

## Deliverable verification

* [x] Fixed-size worker pool created at startup regardless of room count
* [x] Rooms are assigned to existing workers instead of creating new workers
* [x] Worker recovery implemented for unexpected worker death
* [ ] Routers distribute across workers under load; placement strategy validated
* [ ] Emit on pod A received on pod B (Redis adapter)
* [ ] Client stays pinned to one pod (sticky); WS upgrade works through LB
* [ ] Document approximate consumers-per-worker ceiling through load testing

## Backlog (carry-over)

* [ ] Validate least-loaded router distribution under load and add worker saturation/backpressure guard (Day 2)
* [ ] Redis + Socket.IO Redis adapter for multi-process signaling (Day 3)
* [ ] Configure sticky sessions behind the load balancer (Day 4)
* [ ] Perform load testing and document approximate consumers-per-worker capacity (Day 5)

## Retrospective notes

**What went well:**

* Successfully migrated from the per-room worker model to a shared worker pool.
* Implemented least-loaded worker assignment for room placement.
* Implemented worker lifecycle handling, including automatic replacement after unexpected worker failure.
* Added worker load tracking and health monitoring utilities, laying the groundwork for future observability.
* Introduced configurable worker pool sizing through environment variables.

**What was harder than expected:**

**Decisions/changes to the plan:**

* Used an environment variable to configure the worker pool size instead of deriving it directly from CPU count, allowing easier testing on smaller instances.
* Implemented worker health monitoring utilities now and deferred periodic scheduling until the remaining SFU functionality is in place.
* Chose load-based worker assignment over simple round-robin to better support future scaling work.
* Kept worker load metrics separate from the worker pool so they can later power an operational dashboard and monitoring tools.
