# Week 7 · Day 4 — Canary, SFU Drain & DR Baseline

> Roadmap: [index](../../README.md) · [Week 7](../README.md)
> Refs: `docs/ARCHITECTURE.md` §12 (canary/drain), §13 (DR), §16 (Delivery & DR)

## Goal
Deploy stateless tiers safely with canary, drain SFU nodes without killing live
streams, and document a DR baseline.

## Why this matters
§12: "never hard-kill a node with live streams" — use **connection draining**
(cordon → route new rooms elsewhere → wait for streams to end → replace). Stateful
media can't blue/green like stateless pods. §13 defines the DR baseline.

## Tasks
- [ ] Configure canary/blue-green for stateless tiers (API/signaling/chat) — CodeDeploy or Argo Rollouts: shift 5–10%, watch error rate + p99, auto-promote/rollback
- [ ] Implement SFU **drain**: mark node `cordoned` (no new rooms via Coordinator), wait for active streams to end or hit max drain timeout, then replace
- [ ] Document rollback: keep previous task def/image; one-click revert
- [ ] DR baseline: enable Mongo Atlas PITR + daily snapshots; S3 versioning + lifecycle to Glacier
- [ ] Document **RTO/RPO** and the SFU-failover reality (media non-durable; clients reconnect, Coordinator re-places — §13)
- [ ] Confirm multi-AZ for ALB/NLB, ASGs, Redis, Atlas

## Acceptance criteria
- [ ] A canary deploy promotes on healthy metrics and rolls back on induced errors
- [ ] Draining an SFU node ends no live stream early (new rooms route elsewhere)
- [ ] DR doc exists with RTO/RPO; backups/versioning verified

## Notes
> The Coordinator (Week 4 Day 3) is what makes cordon/drain possible — it controls placement.
