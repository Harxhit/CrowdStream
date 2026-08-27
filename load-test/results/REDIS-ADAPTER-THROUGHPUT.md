# Redis Adapter Cross-Pod Pub/Sub Throughput Test

> Authored by Claude (Anthropic), via Claude Code — 2026-08-27.

**Roadmap gap this closes:** CrowdStream scales horizontally by running many
pods behind a load balancer, with Socket.IO rooms glued together by
`@socket.io/redis-adapter` (sharded across 3 Redis ports). Every chat broadcast
to a room whose members are spread across pods must fan out through Redis
pub/sub. At high cross-pod fan-out (`receivers × senders × rate`), **Redis pub/sub
ops and CPU become the bottleneck** — and that ceiling is currently **untested**.
This test drives that path directly so we can watch Redis fall over before users
do.

---

## What it tests

- Spreads `--receivers` socket.io clients **round-robin across `>=2` pod URLs**,
  each joining the same live room.
- A subset (`--senders`) emit `chat:message` at `--rate` msg/s for
  `--durationMs`. Because senders and receivers sit on *different* pods, the
  server cannot deliver a broadcast locally — it **must publish to Redis**, and
  every other pod's adapter must receive and re-emit to its local room members.
- Each message body carries an in-payload send timestamp + per-run nonce
  (`cslt|<runId>-<senderIdx>-<seq>|<Date.now()>`). Receivers parse it and compute
  **fan-out latency = `Date.now() - sentAt`**. Single process = one shared clock,
  so no clock-skew correction is needed.
- Only messages tagged with this run's `runId` are counted, so unrelated chat
  already flowing in the live room does not pollute the numbers.

### Why `>=2` pods sharing one Redis is required

If all receivers land on a single pod, Socket.IO delivers broadcasts **in-process**
and Redis is never touched for fan-out — you would be load-testing one Node event
loop, not the adapter. To exercise the adapter you need **at least two pods that
share the same Redis (sharded) cluster**, so that a broadcast originating on pod A
has to travel A → Redis → pod B to reach B's receivers. Pass every pod URL to
`--urls`; the receivers are distributed round-robin so a large fraction of every
broadcast crosses a pod boundary. If you pass only one URL the script **warns**
that it is not exercising cross-pod fan-out.

---

## Prerequisites

- **`socket.io-client`** must be resolvable. The repo's `load-test/` directory
  already has it installed (`socket.io-client ^4.8.3`), so either:
  - copy `redis-adapter-throughput.js` into `load-test/` and run it there, or
  - point Node at that `node_modules` via `NODE_PATH` (see below).
- **A live room.** Start a broadcast first and grab its room UUID for `--room`.
- **A valid JWT** for an authenticated user, passed via `--token` (sent as the
  `accessToken` cookie). Never hardcode it.
- **`>=2` pod URLs** that share the same Redis, reachable from the test host
  (e.g. individual pod addresses / node-ports, bypassing sticky-session LB so you
  control the distribution).
- Read access to the Redis host(s) for the sampling commands below.

---

## How to run

```bash
# Option A: from the load-test directory (socket.io-client already installed)
node redis-adapter-throughput.js \
  --urls "http://pod-a:3000,http://pod-b:3000,http://pod-c:3000" \
  --token "$CS_JWT" \
  --room "<live-room-uuid>" \
  --receivers 300 --senders 30 --rate 5 --durationMs 30000

# Option B: run in place, borrowing the installed dependency
NODE_PATH=/home/harshit/CrowdStream/load-test/node_modules \
node /tmp/cs-tests/redis-adapter-throughput/redis-adapter-throughput.js \
  --urls "http://pod-a:3000,http://pod-b:3000" \
  --token "$CS_JWT" --room "<live-room-uuid>"
```

Pass the JWT via an environment variable (as above) rather than typing it inline,
so it does not leak into your shell history.

### Arguments

| Arg            | Default                 | Description |
|----------------|-------------------------|-------------|
| `--urls`       | *(required for x-pod)*  | Comma-separated pod URLs. Receivers connect round-robin. Use `>=2` pods sharing one Redis for a real cross-pod test. |
| `--url`        | —                       | Fallback single URL if `--urls` is omitted. One URL only → warns it is not exercising cross-pod fan-out. |
| `--token`      | *(required)*            | JWT for an authenticated user; sent as the `accessToken` cookie. |
| `--room`       | *(required)*            | Live room UUID. Receivers/senders join it; must be a UUID. |
| `--receivers`  | `300`                   | Total receiver sockets (fan-out targets), spread across `--urls`. |
| `--senders`    | `30`                    | How many receivers also send (subset of receivers). Clamped to `--receivers`. |
| `--rate`       | `5`                     | Messages/sec **per sender**. |
| `--durationMs` | `30000`                 | Active send window. |
| `--rampMs`     | `10000`                 | Spread receiver connect+join over this window to avoid a thundering herd. |
| `--timeout`    | `8000`                  | Connect/ack timeout; also used as the post-send drain window for in-flight deliveries. |

### What it reports

Fan-out latency percentiles (p50/p90/p95/p99/max), messages sent, expected vs
actual deliveries (`sent × receivers`) and **delivery %**, the computed
**aggregate broadcast rate (deliveries/sec)** — i.e. the load Redis carried —
plus rate-limited / moderated event counts and connect / join error counts.

---

## Redis-side sampling (run while the test is in flight)

The client-side deliveries/sec is the demand; these commands show what Redis is
actually paying to serve it. Sample each Redis shard (the sharded adapter spreads
traffic across the 3 ports) once per second or so during the run:

```bash
# Ops throughput + bytes pushed to subscribers — the core adapter cost signal.
# Watch: instantaneous_ops_per_sec, total_net_output_bytes, expired/keyspace churn.
redis-cli -h <host> -p <port> INFO stats

# CPU burned by the Redis event loop serving PUBLISH/SUBSCRIBE fan-out.
# Watch: used_cpu_sys, used_cpu_user (delta per second).
redis-cli -h <host> -p <port> INFO cpu

# Connected clients / subscriber channels — one adapter connection per pod.
# Watch: connected_clients, blocked_clients, pubsub_channels, pubsub_patterns.
redis-cli -h <host> -p <port> INFO clients

# See the actual PUBLISH firehose. USE SPARINGLY — MONITOR itself is a heavy
# load on Redis and will distort your measurement. Sample for a second, not the
# whole run; pipe through head so you don't drown.
redis-cli -h <host> -p <port> MONITOR | head -n 200
```

Repeat against each of the 3 sharded Redis ports; the sharded adapter distributes
channels across them, so no single port sees the full firehose.

---

## Interpretation

- **Fan-out latency and Redis CPU climb together as `receivers × senders × rate`
  grows.** Low fan-out: p99 latency is a few ms and `used_cpu` barely moves. As
  you scale receivers and senders, `instantaneous_ops_per_sec` and
  `total_net_output_bytes` rise, Redis CPU approaches a core's ceiling, and p95/p99
  fan-out latency inflates — that inflection is the **adapter ceiling**.
- **Delivery % dropping below ~100%** while Redis CPU is saturated (or the pod
  event loops are backed up) indicates the fan-out pipeline can no longer keep up
  with offered load — messages are delayed past the drain window or dropped.
- **The sharded adapter spreads publish/subscribe load across the 3 Redis ports.**
  If one port shows disproportionately higher ops/CPU, channel distribution is
  skewed and that shard becomes the true bottleneck — worth noting separately.
- Cross-reference the client-side **aggregate broadcast rate (deliveries/sec)**
  with the sum of `instantaneous_ops_per_sec` across shards: they should track
  each other. A growing gap means Redis is the constraint, not the clients.

---

## Caveats

- **The chat rate limiter is active** (per-user + per-IP token buckets). Many
  emitted messages will be rejected server-side and surface as `chat:rateLimited`
  rather than broadcasts — so **delivery % can be well below 100% for reasons
  unrelated to Redis**. Read the rate-limited count alongside delivery %.
- **A shared `--token` means a shared user bucket.** All senders authenticated
  with the same JWT draw from one per-user token bucket, which throttles
  aggregate send throughput hard. For a true Redis stress test use **distinct
  tokens per sender** (or raise/disable the limiter in a staging environment) so
  the offered load actually reaches the adapter. As-is, you are partly measuring
  the rate limiter, not Redis.
- Per-IP limiting means running all clients from one host also shares an IP
  bucket; distribute load generators if that becomes the binding constraint.
- Single-process design keeps one shared clock (accurate latency) but caps how
  much load one machine can generate; scale out with multiple test hosts for
  higher fan-out.

---

## Results

_Pending execution — not fabricated._

| Pods | Receivers | Senders | Rate (msg/s) | Sent | Deliveries | Delivery % | Fan-out p50 | Fan-out p95 | Fan-out p99 | Aggregate broadcast rate (del/s) | Redis ops/s (sum shards) | Redis CPU | Rate-limited |
|------|-----------|---------|--------------|------|------------|------------|-------------|-------------|-------------|----------------------------------|--------------------------|-----------|--------------|
|      |           |         |              |      |            |            |             |             |             |                                  |                          |           |              |
