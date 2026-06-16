# Week 7 — Observability, CI/CD & Disaster Recovery

**Theme:** Make the system operable and shippable: metrics, alerts, a deploy
pipeline, safe SFU drains, and a DR baseline. Then sign off MVP production readiness.

**Why last:** With the system functionally complete (Weeks 1–6), this week makes it
*operable* — you can see when it hurts, ship safely, and recover. Closes the
Observability + Delivery & DR sections of `docs/ARCHITECTURE.md` §16.

## Days
- [Day 1 — Metrics & log aggregation](day-1/)
- [Day 2 — Dashboards, alerts & error tracking](day-2/)
- [Day 3 — CI/CD pipeline](day-3/)
- [Day 4 — Canary, SFU drain & DR baseline](day-4/)
- [Day 5 — Production-readiness sign-off & final review](day-5/)

## Week goal
MediaSoup media stats and logs flow to dashboards with alerts; CI/CD builds, scans,
and deploys with canary + safe SFU drain; DR basics (backups, RTO/RPO) are documented.

## Reference
- `docs/ARCHITECTURE.md` §11 (monitoring), §12 (CI/CD), §13 (DR), §16 (Observability, Delivery & DR)
- `ARCHITECTURE.md` §6 (logging), `utils/sendMetrics.ts` (scaffold)
