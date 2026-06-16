# Week 3 — SFU Scaling Foundation

**Theme:** Make the media plane use the whole machine, and make the signaling plane
runnable on more than one process.

**Why now:** `docs/ARCHITECTURE.md` §0 flags "single worker" (caps ~1 core / ~500
consumers) and "stateful signaling" (can't load-balance without Redis adapter +
sticky sessions) as blockers. Today `worker.ts` spawns one worker per room.

## Days
- [Day 1 — MediaSoup worker pool (1 per vCPU)](day-1/)
- [Day 2 — Router placement on least-loaded worker](day-2/)
- [Day 3 — Redis + Socket.IO Redis adapter](day-3/)
- [Day 4 — Sticky sessions & multi-pod signaling](day-4/)
- [Day 5 — Load test & weekly review](day-5/)

## Week goal
Media is spread across a worker pool sized to the CPU; signaling runs on ≥2 pods
that share events via a Redis adapter with sticky sessions.

## Reference
- `docs/ARCHITECTURE.md` §2 (scaling strategy), §6 (per-worker math), §8, §16
- `ARCHITECTURE.md` §3.2 (worker-per-room note), §3.3
