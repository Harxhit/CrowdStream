# Long-Duration Steady-State Soak

> Authored by Claude (Anthropic), via Claude Code — 2026-08-27.

A multi-hour, **steady-state** soak for CrowdStream's signaling layer. It holds a
fixed population of authenticated socket.io clients connected for hours, gently
churning a small fraction each minute, and periodically samples client-side
health while prompting the operator to record backend process metrics.

## Roadmap gap this fills

The existing `load-test/sfu-capacity.js` (and the signaling latency probe) are
**short and rapid**: they ramp viewers up, measure connect/join/first-frame
latency, and tear down. That surfaces capacity ceilings and connect-storm
behavior, but it says nothing about what happens when a normal-sized crowd just
*stays connected for hours*. Slow leaks — RSS creeping up, file descriptors not
being released, mediasoup workers/threads accumulating, presence keys never
expiring — only show up over **time under flat load**. This soak is the
**long & steady** counterpart to that **short & rapid** churn test.

## What it tests

- A constant connected population (`--clients`) held for `--durationMin`.
- Light maintenance churn: every `--churnIntervalMs`, a random `--churnFraction`
  of clients is disconnected and immediately replaced with fresh connections, so
  the population size stays flat but sockets are continuously recycled (exercises
  connect/teardown paths without a connect storm).
- Optional room participation (`--join`): each client calls `joinRoom` and then
  emits `viewer:heartBeat` every `--heartbeatMs` to keep its Redis presence TTL
  alive, exercising the presence set + TTL machinery over the full window.
- Client-side stability over time: connected count, cumulative errors, connect /
  join failures, unexpected disconnects, and churn reconnects, sampled every
  `--sampleIntervalMs`.

It does **not** measure media, and it is **not** the leak oracle by itself — the
authoritative signal comes from sampling the backend process externally (below).

## Prerequisites

- Node with `socket.io-client` available (reuse `load-test/node_modules`, e.g.
  run from that directory or set `NODE_PATH` to it). Global `fetch` (Node 18+)
  is used for `--metricsUrl`; the script guards `typeof fetch` and skips if absent.
- A valid JWT for the `accessToken` cookie, passed via `--token`. **Never**
  hardcode it. Export it and reference the variable:
  ```bash
  export CS_TOKEN="<your-jwt>"
  ```
- If using `--join`, a live room id (start a broadcast first) passed via `--room`.
- Shell access to the **backend host/container** to sample the server process
  (see methodology). Know the backend PID.

## How to run

Connection-only soak (no room), 200 clients for 2 hours:

```bash
NODE_PATH=../load-test/node_modules \
node long-duration-soak.js \
  --url http://localhost:3000 \
  --token "$CS_TOKEN" \
  --clients 200 \
  --durationMin 120
```

Room-joined soak with heartbeats and a metrics endpoint:

```bash
NODE_PATH=../load-test/node_modules \
node long-duration-soak.js \
  --url http://localhost:3000 \
  --token "$CS_TOKEN" \
  --join true \
  --room <roomId> \
  --clients 200 \
  --durationMin 240 \
  --heartbeatMs 15000 \
  --sampleIntervalMs 60000 \
  --metricsUrl http://localhost:3000/metrics
```

`Ctrl-C` (SIGINT) stops early, prints the final summary, and disconnects cleanly.

### Arguments

| Arg                  | Default                 | Description |
|----------------------|-------------------------|-------------|
| `--url`              | `http://localhost:3000` | Signaling server base URL. |
| `--token`            | *(required)*            | JWT for the `accessToken` cookie (sent via `extraHeaders`). |
| `--room`             | *(none)*                | Room id. Required when `--join true`. |
| `--join`             | `false`                 | If `true`, each client calls `joinRoom` and heartbeats. Requires `--room`. |
| `--clients`          | `200`                   | Steady connected population to hold. |
| `--durationMin`      | `120`                   | How long to hold steady state, in minutes. |
| `--churnIntervalMs`  | `60000`                 | How often to recycle a fraction of clients. |
| `--churnFraction`    | `0.1`                   | Fraction of clients replaced each churn interval (0.1 = 10%). |
| `--heartbeatMs`      | `15000`                 | `viewer:heartBeat` interval per client (only when `--join`). |
| `--sampleIntervalMs` | `60000`                 | How often to log client-side health + metrics + record reminder. |
| `--metricsUrl`       | *(none)*                | Optional health/metrics endpoint; GET each sample, trimmed body logged. |
| `--timeout`          | `8000`                  | Connect / ack / metrics-fetch timeout (ms). |

## Leak-over-time methodology

This script watches the *clients*. The leak lives in the *server*, so the pass
signal must be sampled **externally** against the backend process for the full
window. At every sample the script prints a `RECORD BACKEND NOW` reminder; wire
that same measurement into a background logger so you get a time series.

1. Find the backend PID (the Node/mediasoup process; if workers are separate
   processes, track each, since mediasoup worker leaks show up there).

2. Sample RSS, thread count, and open FD count once a minute into a log:

   ```bash
   PID=<backend-pid>
   while true; do
     ts=$(date +%s)
     rss_nlwp=$(ps -o rss=,nlwp= -p "$PID")
     fds=$(ls /proc/"$PID"/fd | wc -l)
     echo "$ts rss_kb_nlwp=$rss_nlwp fds=$fds" >> soak-backend.log
     sleep 60
   done
   ```

   - `ps -o rss,nlwp -p <pid>` → resident memory (KB) and number of threads.
   - `ls /proc/<pid>/fd | wc -l` → open file descriptors (sockets count here).

3. Optionally also capture Redis footprint over the window (presence keys should
   plateau, not grow unbounded, once population + churn are steady):

   ```bash
   redis-cli info memory | grep used_memory_human >> soak-redis.log
   redis-cli dbsize >> soak-redis.log
   ```

4. If the backend exposes a metrics/health endpoint, pass `--metricsUrl` so the
   script also snapshots it inline each sample (event-loop lag, active handles,
   worker counts, etc., depending on what the endpoint reports).

5. Plot `rss_kb`, `nlwp`, and `fds` over the whole run.

**Interpretation:** load (connected count) is held flat by design, so under a
healthy server the backend series are **flat / bounded** — they may rise during
ramp, then plateau. A **slow, monotonic upward slope while connected-count stays
constant** is the leak signature: memory not reclaimed, FDs/sockets not closed
on churn teardown, threads/workers accumulating, or presence keys outliving their
TTL. Sawtooth that returns to baseline after GC is normal; a rising floor is not.

## Interpretation & caveats

- **The script is not the oracle.** Zero client-side errors with a rising backend
  RSS still fails the soak. Always read the external time series.
- **Baseline after ramp, not at t+0.** Compare the plateau to itself over hours;
  the initial climb during ramp is expected.
- **Auto-reconnect is disabled** (`reconnection: false`) so that dropped sockets
  are visible as `unexpDisc` / falling connected count rather than being silently
  healed — degradation should surface, not hide.
- **Churn is maintenance, not a storm.** Keep `--churnFraction` small; the goal is
  to recycle sockets under steady load, not to benchmark connect throughput (that
  is what the short/rapid tests are for).
- **Client-side resource use matters too.** 200 sockets + timers run for hours in
  this process; if you suspect the client is the thing leaking, sample this
  process's RSS/FDs as well and split runs across machines.
- **Long timers.** With `--durationMin 120+` the process is intentionally
  long-lived; run it under `nohup`/`tmux`/systemd and tee stdout to a file.

## Results

_Pending execution — not fabricated._

Record the run here as a time series (one row per sample), e.g.:

| t (min) | connected | errors | unexpDisc | reconnects | backend RSS (KB) | nlwp | open FDs |
|---------|-----------|--------|-----------|------------|------------------|------|----------|
|         |           |        |           |            |                  |      |          |

Verdict (fill in after a real run): connected-count stability, total
errors/reconnects, and — decisively — whether backend RSS / FD / thread counts
stayed **flat** across the window.
