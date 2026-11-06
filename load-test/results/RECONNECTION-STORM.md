# Reconnection-Storm (Thundering-Herd) Load Test

> Authored by Claude (Anthropic), via Claude Code — 2026-08-27.

**Roadmap gap this closes:** recovery after node loss / thundering-herd reconnect was **untested**. The earlier 10k-in-2s spike test only measured *cold connect* (and recorded 8,139 failures) — it said nothing about how a fleet of already-connected clients recovers when a signaling pod dies underneath them and everyone reconnects at once.

CrowdStream runs sticky sessions + the Socket.IO Redis adapter, and clients are expected to auto-reconnect and re-join after a signaling pod dies. This test quantifies that **recovery**, not the initial connect.

## What it tests

- Bring `--clients` sockets up against the signaling layer with **auto-reconnection enabled** (`reconnection: true`, `reconnectionAttempts: Infinity`), and `joinRoom` each one.
- Let them settle into steady state, then **trigger a simultaneous mass drop** (the "storm").
- On every client's post-storm `connect`/`reconnect`, re-emit `joinRoom` and record **recovery time = successful re-join − storm trigger**.
- Report reconnect+re-join percentiles, the share of clients that recovered inside `--recoverWindowMs`, failures, and whether socket.io's backoff + jitter de-synchronised the herd.

## The two modes

| Mode | What the harness does | When to use |
|------|-----------------------|-------------|
| `forcedrop` (default) | Drops every connected client itself via `io.engine.close()` (falling back to `disconnect()`+`connect()`), triggering socket.io's automatic reconnection. No infra access needed. | Local / CI runs, or any environment where you cannot kill a real pod. Reproducible and self-contained. Note it drops *all* clients, not just one pod's share. |
| `killpod` | Does **not** drop clients. Prints a clear "kill a pod now" instruction and relies on socket.io's own disconnect detection; only the clients on the killed pod actually drop. | Staging/prod-like clusters where you can `kubectl delete pod` a signaling replica. This is the realistic test — it exercises sticky-session failover, the Redis adapter, and the LB re-routing survivors. |

Recovery `%` is always computed **only over clients that actually dropped**, so `killpod` (where non-victim clients stay connected) is scored fairly.

## Prerequisites

- `socket.io-client` v4 available on the module path (see `../../load-test/package.json`; run from a dir where `require("socket.io-client")` resolves).
- A live broadcast so a room exists — pass its id as `--room`.
- A valid JWT for the `accessToken` cookie — pass it as `--token`. **Never hardcode it.**
- For `--urls`, point at your LB VIP(s). On auto-reconnect socket.io reuses each client's own endpoint, so LB endpoints (not direct pod IPs) give realistic re-routing to healthy pods.
- For `killpod`, cluster access to kill a signaling replica during the run.

## How to run

```bash
# forcedrop (self-contained): 500 clients, storm at 15s, watch recovery for 30s
node reconnection-storm.js \
  --url https://signal.crowdstream.example \
  --room <ROOM_ID> \
  --token "$ACCESS_TOKEN" \
  --clients 500

# killpod against multiple LB endpoints — kill a pod when prompted
node reconnection-storm.js \
  --urls https://lb-a.example,https://lb-b.example \
  --room <ROOM_ID> \
  --token "$ACCESS_TOKEN" \
  --clients 500 \
  --mode killpod \
  --recoverWindowMs 45000
```

### Args

| Arg | Default | Meaning |
|-----|---------|---------|
| `--url` | `http://localhost:3000` | Single signaling endpoint. |
| `--urls` | *(unset)* | Comma-separated endpoints; clients are spread round-robin across them. Overrides `--url`. |
| `--token` | *(required)* | JWT sent as the `accessToken` cookie via `extraHeaders`. |
| `--room` | *(required)* | Room id to join / re-join. |
| `--clients` | `500` | Number of concurrent sockets. |
| `--rampMs` | `10000` | Initial connect ramp — spawns are paced over this window. |
| `--mode` | `forcedrop` | `forcedrop` or `killpod`. |
| `--triggerAfterMs` | `15000` | When the storm fires, measured from launch (defaults leave ~5s of steady state after the ramp). |
| `--recoverWindowMs` | `30000` | How long to watch for recovery after the trigger. |
| `--timeout` | `8000` | Per-ack timeout for `joinRoom` (ms). |

## Interpretation

- **Reconnect+re-join p50/p90/p99/max** — how long survivors take to be usable again. Watch **p99** and **max**: a fat tail means some users stare at a frozen stream for many seconds after a pod loss.
- **Recovery success % within window** — the headline SLO. Anything materially below 100% means clients are permanently stranded (exhausted attempts, auth rejected on re-join, or the surviving pods are saturated).
- **Herd smoothing** — the script prints a `p99/p50` spread ratio:
  - **Long tail (spread ≥ 3x)** ⇒ backoff + jitter is de-synchronising reconnects; the herd is being spread over time. Good, as long as p99 stays inside your SLO.
  - **Tight cluster (spread < 3x)** ⇒ everyone reconnected in one burst. If success % also dropped, the herd overwhelmed the survivors. Mitigations: enable/raise client `reconnectionDelayMax` and `randomizationFactor` (jitter), and set LB per-pod connection/accept limits so a spike is shed rather than amplified.
- **auto-reconnect attempts (post-trigger)** — high counts relative to `dropped` indicate repeated failed attempts (survivors saturated or slow to accept) before success.

## Caveats

- `forcedrop` drops **every** client, so it models a total outage / full rollout, not a single-pod loss. Use `killpod` to model losing one replica's share.
- `io.engine.close()` emulates a transport drop from the client side; it does **not** actually remove server-side room/producer state. Server-side cleanup and Redis-adapter fan-out behaviour are only truly exercised in `killpod`.
- On reconnect socket.io reuses the client's original endpoint URL — real LB re-routing is only observed when `--url`/`--urls` point at an LB VIP, not a pinned pod.
- Timing is client-side wall clock (`performance.now()`); it includes network RTT and the harness host's own scheduling under load. Run the harness off the cluster and with enough CPU that its event loop isn't the bottleneck.
- This measures **signaling recovery** (reconnect + `joinRoom`), not media (transport/consumer) re-establishment. A successful re-join does not by itself prove video resumed.

## Results

_Pending execution — not fabricated._

| Run (date / mode / clients / endpoints) | Dropped | Reconnect+re-join p50 | p90 | p99 | max | Success % in window | Failures | Notes |
|------------------------------------------|---------|-----------------------|-----|-----|-----|---------------------|----------|-------|
| _pending_ | | | | | | | | |
