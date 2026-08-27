# Connect / Disconnect Soak Test

> **Authored by Claude (Anthropic), via Claude Code — 2026-08-27.**
> The test script (`load-test/connect-disconnect-soak.js`) and this document were written by Claude.

Roadmap item: **Week 4 (State & reliability) — Day 5**
_"Connect/disconnect soak shows flat resource counts (no leak)"_ and
_"Clean client recovery after a simulated node loss."_

## What this tests

The soak driver hammers the signaling server with a large number of
connect → (optional `joinRoom`) → disconnect cycles:

```
        ┌─────────────────────────────────────────┐
        │  repeat CYCLES times, CONCURRENCY at a   │
        │  time:                                   │
        │                                          │
        │   connect (cookie: accessToken=<jwt>)    │
        │        ↓                                 │
        │   joinRoom(roomId)        (if --join)    │
        │        ↓                                 │
        │   hold HOLD_MS            (if > 0)       │
        │        ↓                                 │
        │   disconnect  →  server handleDisconnect │
        └─────────────────────────────────────────┘
```

It exercises the exact server paths that must clean up on disconnect:
`handleDisconnect(socket)`, viewer/room map removal, and (with `--join`) the
mediasoup viewer transport/consumer teardown.

**What the script measures (client-side):** connect latency, `joinRoom` ack
latency, cycle success/failure counts, and churn throughput (cycles/sec).

**What you measure (server-side):** the actual leak signal. The script cannot
read the server's memory, so you capture the backend process RSS and resource
counts before/after — see [Detecting a leak](#detecting-a-leak).

## Prerequisites

- `socket.io-client` (already in `load-test/node_modules`).
- A valid JWT `accessToken` (the socket auth middleware rejects anonymous connections).
- **Only if using `--join true`:** a live room id — start a broadcast, then use its room id.
  Without `--join`, the test needs only a token and exercises the pure connection lifecycle.

## How to run

```bash
cd load-test

# Pure connection-lifecycle churn (no room needed): 2000 cycles, 100 in flight
node connect-disconnect-soak.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --cycles 2000 --concurrency 100

# Full churn incl. join/leave cleanup (needs a live room):
node connect-disconnect-soak.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --room "<ROOM_UUID>" \
  --join true --cycles 2000 --concurrency 100 --holdMs 250
```

### Arguments

| Flag | Default | Meaning |
|---|---|---|
| `--url` | `http://localhost:3000` | Signaling server URL |
| `--token` | _(required)_ | JWT set as `accessToken` cookie |
| `--room` | `null` | Live room id (required when `--join true`) |
| `--cycles` | `1000` | Total connect/disconnect cycles |
| `--concurrency` | `50` | Cycles in flight at once |
| `--holdMs` | `0` | Time to stay connected before disconnecting |
| `--join` | `false` | Also `joinRoom` each cycle (exercises viewer cleanup) |
| `--settleMs` | `5000` | Wait after churn for server cleanup before final metrics |
| `--metricsUrl` | `null` | Optional health/metrics endpoint sampled at start & end |
| `--timeout` | `8000` | Per-op ack/connect timeout (ms) |

## Detecting a leak

The pass/fail signal is **server-side resource counts returning to baseline**.
Recommended procedure:

1. **Baseline** — with the server idle, record:
   ```bash
   ps -o rss= -p "$(pgrep -f 'src/index.ts' | head -1)"   # RSS in KB
   ```
   plus, if you expose them, mediasoup worker count and the sizes of the
   socket/room/viewer maps.
2. **Run** the soak (e.g. `--cycles 5000 --concurrency 100 --join true`).
3. **After the settle window**, re-record the same numbers.
4. **Interpret:** RSS and resource counts should return to ~baseline (allowing
   for GC lag / connection keep-alive). Repeat the run 3–5×; a **monotonic
   climb across runs** is the leak signal — a single elevated sample is not.

If you wire up a `/metrics` or health endpoint that reports live counts, pass
`--metricsUrl` and the script prints it at start and end for a quick delta.

## Simulating node loss (recovery half of the roadmap item)

To validate _clean client recovery after a simulated node loss_, run a small
number of long-lived clients (`--concurrency 5 --cycles 5 --holdMs 60000`),
then kill one signaling pod mid-run and confirm clients reconnect and re-join
(the frontend uses Socket.IO auto-reconnect). This script intentionally uses
`reconnection: false` for deterministic churn accounting, so drive recovery
separately or add `reconnection: true` for that scenario.

## Results

> _Pending execution against a running backend. This environment had no live
> server (no Mongo/Redis/mediasoup), so no numbers are recorded here yet —
> they will be filled in after a real run rather than fabricated._

| Cycles | Concurrency | Join | Connect p50 | Connect p99 | Errors | RSS Δ (baseline→settled) |
|---:|---:|:---:|---:|---:|---:|---:|
| _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |
