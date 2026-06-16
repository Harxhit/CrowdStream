# Week 7 · Day 2 — Dashboards, Alerts & Error Tracking

> Roadmap: [index](../../README.md) · [Week 7](../README.md)
> Refs: `docs/ARCHITECTURE.md` §11 (alerts thresholds), §16 (Observability)

## Goal
Build Grafana dashboards, wire actionable alerts, and add Sentry for exceptions.

## Why this matters
Metrics without dashboards/alerts are noise. §11 names the exact alert thresholds
that map to user pain; §16 requires Grafana dashboards + Sentry.

## Tasks
- [ ] Build Grafana dashboards: media quality, SFU load, signaling, realtime (chat/reaction fanout)
- [ ] Wire Prometheus Alertmanager → Slack/PagerDuty
- [ ] Alerts: **packet loss > 2–3%**, **RTT > 250ms**, **worker CPU > 80%**, **port exhaustion** (§11/§16)
- [ ] Add infra alerts (Redis evictions, ALB/NLB target health, ASG capacity) from CloudWatch
- [ ] Integrate **Sentry** in backend (and frontend) for exception tracking, release-tagged
- [ ] Validate an alert actually fires (induce high packet loss or CPU in staging)

## Acceptance criteria
- [ ] Dashboards show live media/SFU/signaling health
- [ ] At least one alert proven to fire and notify
- [ ] Exceptions appear in Sentry with release context

## Notes
> Tie alert links back to the relevant Grafana panel for fast triage.
