# Week 3 — SFU Scaling Foundation

**Theme:** Make the media plane use the whole machine, and make the signaling plane
runnable on more than one process.

**Why now:** `docs/ARCHITECTURE.md` §0 flags "single worker" (caps ~1 core / ~500
consumers) and "stateful signaling" (can't load-balance without Redis adapter +
sticky sessions) as blockers. Today `worker.ts` spawns one worker per room.

## Days
- [x] Day 1 — MediaSoup worker pool (1 per vCPU)
- [x] Day 2 — Router placement on least-loaded worker
- [x] Day 3 — Redis + Socket.IO Redis adapter
- [ ] Day 4 — Sticky sessions & multi-pod signaling
- [ ] Day 5 — Load test & weekly review

## Notes:
- The current setup is intended for local development. When deploying to the cloud, I'll use `redis-cli` on the deployment host (or the platform's initialization workflow) instead of executing it inside a Redis container.

## Reference
- `docs/ARCHITECTURE.md` §2 (scaling strategy), §6 (per-worker math), §8, §16
- `ARCHITECTURE.md` §3.2 (worker-per-room note), §3.3
