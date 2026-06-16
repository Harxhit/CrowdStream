# Week 7 — Review, Retrospective & MVP Sign-Off

**Theme:** Observability, CI/CD & DR — and the final MVP gate.

## Did you complete this week?
- [ ] **Day 1** — MediaSoup `getStats()` → Prometheus; Winston logs centralized
- [ ] **Day 2** — Grafana dashboards + alerts (packet loss/RTT/CPU/ports) + Sentry
- [ ] **Day 3** — GitHub Actions CI: lint/typecheck/test → Docker build → Trivy → ECR
- [ ] **Day 4** — Canary deploys, SFU drain, DR baseline (PITR, versioning, RTO/RPO)
- [ ] **Day 5** — Full §16 checklist walked; MVP dry-run passed

## Deliverable verification
- [ ] `/metrics` exposes packet loss / RTT / bitrate; logs centralized
- [ ] At least one alert proven to fire; Sentry capturing exceptions
- [ ] CI blocks bad PRs; images scan + push to ECR
- [ ] SFU drain ends no live stream early; canary auto-rolls-back on errors
- [ ] DR doc with RTO/RPO; backups + S3 versioning verified

## MVP production-readiness gate (`docs/ARCHITECTURE.md` §16)
- [ ] **Blockers** — TURN, env'd announcedIp, TCP fallback, JWT auth, CORS, multi-worker, Redis adapter + sticky
- [ ] **Reliability** — room→node map, SFU drain, disconnect cleanup + TTL sweep, health checks, lifecycle persistence
- [ ] **Security** — refresh rotation, HMAC TURN creds, rate limits, WAF/Shield + secrets, moderation + ban enforcement
- [ ] **Observability** — Prometheus exporter, Grafana, logs to Loki/OpenSearch + Sentry, alerts
- [ ] **Delivery & DR** — CI + ECR + scan, canary/drain, PITR + versioning + RTO/RPO, recording → S3 → CloudFront

## Consolidated backlog (all 7 weeks)
> Pull forward every unchecked item from each week's review. This becomes the input
> to the **Growth tier** (`docs/ARCHITECTURE.md` §15): multi-node `pipeToRouter`
> fanout, separate realtime tier, EKS migration, full canary, RI/Savings Plans.

- [ ] _(consolidate carry-over items here)_

## Retrospective notes
- What shipped vs planned across the 7 weeks:
- Biggest surprises / re-scopes:
- Next milestone decision (Growth tier?):
