# Chat Fan-out Load Test

> **Authored by Claude (Anthropic), via Claude Code — 2026-08-27.**
> The test script (`load-test/chat-load-fanout.js`) and this document were written by Claude.

Roadmap item: **Week 5 (Real-time messaging) — Day 5**
_"Load test chat: many senders across ≥2 pods; confirm fan-out latency stays
acceptable"_ and _"Messaging stays bounded under load."_

## What this tests

Many viewers join one room and listen for `chat:message` broadcasts; a subset
also send messages. The test measures how fast and how completely messages
fan out to everyone — optionally across multiple pods via the Redis adapter.

```
 senders ──emit chat:message {roomId, message}──►  pod
                                                     │ validate → moderate → rate-limit
                                                     │ publishMessage() → Redis pub/sub
                                                     ▼
                        io.to(room:<id>).emit("chat:message")  ──► every receiver
                        (fans out across ALL pods via @socket.io/redis-adapter)
```

### How latency is measured

`chat:message` is fire-and-forget (no ack), so latency is carried **in the
payload**. Each message body is `cslt|<nonce>|<sendEpochMs>`. On delivery every
receiver computes `Date.now() - sendEpochMs`. All sockets live in one Node
process, so the clock is shared and the result is true end-to-end fan-out
latency: server validate + moderate + rate-limit + Redis publish + broadcast.

### Metrics reported

- **chat fan-out (emit→deliver)** — latency percentiles across every delivery.
- **deliveries received / expected** — completeness (`sent × receivers`).
- **messages broadcast / sent** — how many passed the server gate (the rest
  were rate-limited or moderated and never broadcast).
- **fully fanned-out** — messages that reached *all* receivers (cross-pod check).
- **rate-limited / moderated events** — how often the server throttled senders.

## Prerequisites

- `socket.io-client` (already in `load-test/node_modules`).
- A valid JWT `accessToken`.
- A **live room** — start a broadcast, then pass its room id (viewers must
  join an existing room to receive its chat).
- For the cross-pod goal: **≥2 signaling pods** behind your load balancer,
  sharing Redis. Pass them via `--urls`.

## How to run

```bash
cd load-test

# Single pod: 300 receivers, 30 senders, 10 msgs each, spaced 1.5s
node chat-load-fanout.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --room "<ROOM_UUID>" \
  --receivers 300 --senders 30 --messages 10 --sendIntervalMs 1500

# Cross-pod fan-out (Week 5 goal): clients spread across two pods
node chat-load-fanout.js \
  --urls "http://localhost:3001,http://localhost:3002" \
  --token "<JWT>" \
  --room "<ROOM_UUID>" \
  --receivers 500 --senders 50
```

### Arguments

| Flag | Default | Meaning |
|---|---|---|
| `--url` | `http://localhost:3000` | Single signaling URL |
| `--urls` | _(uses `--url`)_ | Comma-separated pod URLs; clients spread round-robin |
| `--token` | _(required)_ | JWT set as `accessToken` cookie |
| `--room` | _(required)_ | Live room id |
| `--receivers` | `200` | Viewers that join and listen |
| `--senders` | `20` | Subset that also send (must be ≤ receivers) |
| `--messages` | `10` | Messages per sender |
| `--sendIntervalMs` | `1500` | Spacing between a sender's messages (respects rate limit) |
| `--rampMs` | `10000` | Ramp window for connect + join |
| `--drainMs` | `5000` | Wait after last send for in-flight broadcasts |
| `--timeout` | `8000` | Per-op ack/connect timeout (ms) |

## Interpreting results & caveats

- **Rate limiting is active** for `chat:message` (per-user and per-IP token
  buckets). Under load some messages *will* be throttled — that's the
  moderation/backpressure the Week 5 item wants to observe, not a bug. Watch
  `rate-limited events` and `messages broadcast / sent`. For a pure throughput
  number, raise `--sendIntervalMs` or relax the limit server-side.
- **Same token for all sockets:** by default every simulated client uses the
  same JWT, so the per-user bucket is shared. To test many *distinct* users,
  extend the script to accept a token list — noted as a follow-up.
- **"Bounded under load"** = fan-out latency percentiles stay flat and
  `deliveries received ≈ (broadcast messages × receivers)` as you scale
  receivers/senders up. A latency blow-up or delivery shortfall is the signal.

## Results

> _Pending execution against a running backend. This environment had no live
> server (no Mongo/Redis/mediasoup and no ≥2-pod deployment), so no numbers are
> recorded here yet — they will be filled in after a real run rather than
> fabricated._

| Pods | Receivers | Senders | Msgs/sender | Fan-out p50 | Fan-out p99 | Delivery % | Rate-limited |
|---:|---:|---:|---:|---:|---:|---:|---:|
| _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |
