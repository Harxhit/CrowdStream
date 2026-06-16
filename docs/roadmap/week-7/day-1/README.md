# Week 7 · Day 1 — Metrics & Log Aggregation

> Roadmap: [index](../../README.md) · [Week 7](../README.md)
> Refs: `docs/ARCHITECTURE.md` §11 · `utils/sendMetrics.ts`, `utils/logging.ts`

## Goal
Expose MediaSoup media-quality metrics to Prometheus and ship Winston logs to a
central store.

## Why this matters
§11: wire `getStats()` into a Prometheus exporter (packet loss, RTT, bitrate, jitter,
NACK/PLI) and ship the existing Winston logs (`logs/combined.log`, `logs/error.log`)
to Loki/OpenSearch. `sendMetrics.ts` is already scaffolded for this.

## Tasks
- [ ] Implement `sendMetrics.ts`: periodically pull `transport.getStats()` / `consumer.getStats()`
- [ ] Expose a `/metrics` Prometheus endpoint with media + SFU + signaling metrics
- [ ] Export per-worker CPU, router count, consumer count, port usage (§11 SFU health)
- [ ] Export signaling metrics: active WS connections, msg rate, auth failures
- [ ] Configure Winston to emit structured JSON; ship to Loki/OpenSearch
- [ ] Add correlation fields (`roomId`, `socketId`) to logs for tracing

## Acceptance criteria
- [ ] `/metrics` exposes packet loss, RTT, bitrate per consumer/transport
- [ ] Per-worker and signaling metrics are scrapeable
- [ ] Logs are centralized and queryable by `roomId`/`socketId`

## Notes
> Packet loss and RTT are the metrics that correlate with viewer pain (§11) — prioritize them.
