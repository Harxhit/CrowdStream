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



* [ ] Validate least-loaded router distribution under load (Day 2)

* [ ] Integrate periodic worker health monitoring (Day 2)

* [ ] Redis + Socket.IO Redis adapter for multi-process signaling (Day 3)

* [ ] Configure sticky sessions behind the load balancer (Day 4)

* [ ] Perform load testing and document worker capacity (Day 5)



## Retrospective notes



**What went well:**



* Successfully migrated from the per-room worker model to a shared worker pool.

* Added load-based worker selection for new room placement.

* Implemented worker lifecycle handling, including automatic replacement after unexpected worker failure.

* Established the foundation for worker health monitoring and future observability.



**What was harder than expected:**



* Designing worker load tracking without introducing duplicated state.

* Handling asynchronous worker recovery safely to avoid unhandled promise rejections.

* Ensuring worker assignment always used fresh load information.



**Decisions/changes to the plan:**



* Used an environment variable to configure the worker pool size instead of deriving it directly from CPU count, allowing easier testing on smaller instances.

* Implemented worker health monitoring utilities now and deferred periodic execution until the remaining SFU functionality is in place.

* Chose load-based worker assignment over simple round-robin to better support future scaling work. 
