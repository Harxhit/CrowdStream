# Mongo Write-Load Test

> Authored by Claude (Anthropic), via Claude Code — 2026-08-27.

**Roadmap gap this closes:** MongoDB write throughput under viewer join churn is
currently **untested**. The signaling and SFU-capacity tests exercise mediasoup and
socket signaling, but nothing has yet driven the *database* to its write ceiling.
This test does exactly that and measures how join-ack latency degrades under sustained
write pressure.

---

## What it tests

Every successful `joinRoom` on the server (`backend/src/handlers/registerViewer.handler.ts`)
fans out into MongoDB writes. This test drives thousands of connect → join → disconnect
cycles to keep those writes saturated and watch what happens to ack latency.

Writes triggered **per join**:

| Write | Collection | Operation | Trigger |
|-------|-----------|-----------|---------|
| **Viewer doc** | `viewers` | `Viewer.create({...})` — insert | one insert per join (roomId, viewerId, socketId, ipHash, userAgentHash) |
| **LiveRoom `$inc` counter** | `liveRooms` | `LiveRoom.updateOne({ experienceRoomId }, { $inc: { totalViewersJoined: 1 } })` | one indexed update per join |
| **viewer_sessions / peak-viewer bookkeeping** | viewer-session lifecycle | insert/update on join + leave | the viewer-session lifecycle and peak-viewer counters are also persisted as viewers join and churn out |

So **each join ≈ 2 confirmed Mongo writes (one insert + one `$inc` update)**, plus
session-lifecycle persistence on join/leave. High connect/join/disconnect churn therefore
produces sustained, mostly write-heavy DB load — which is what this generator is for.

The client measures **`joinRoom` ack latency** (the round trip the real viewer feels) and
reports its distribution alongside join throughput. Because throughput of successful joins
maps directly onto insert+update volume, joins/sec is a proxy for write pressure.

---

## Prerequisites

- Node 18+ (uses the global `performance` API and `socket.io-client`).
- `socket.io-client` installed (the sibling `load-test/` folder already has it; run from
  there or `npm i socket.io-client`).
- The CrowdStream backend running and reachable at `--url`.
- A **LIVE** room id: start a broadcast first, then pass its id as `--room`. Joining a
  non-live / unknown room returns `{ success: false, code: 'ROOM_NOT_FOUND' }` and drives
  no viewer inserts.
- A valid JWT for the `accessToken` cookie, passed via `--token`. **Never hardcode the
  token** — export it from your environment and pass it on the command line.
- Access to the Mongo instance (a `mongosh` shell and/or `mongostat`) so you can sample the
  server **while the test runs** (see below).

---

## How to run

```bash
# from a directory where socket.io-client resolves (e.g. the load-test/ folder)
node /tmp/cs-tests/mongo-write-load/mongo-write-load.js \
  --url http://localhost:3000 \
  --token "$ACCESS_TOKEN" \
  --room <liveRoomId> \
  --cycles 2000 \
  --concurrency 50 \
  --holdMs 0 \
  --rampMs 0
```

### Arguments

| Arg | Default | Meaning |
|-----|---------|---------|
| `--url` | `http://localhost:3000` | Backend origin (Socket.IO endpoint). |
| `--token` | *(required)* | JWT for the `accessToken` cookie, sent via `extraHeaders`. Exit(1) if missing. |
| `--room` | *(required)* | Id of a **live** room to join. Exit(1) if missing. |
| `--cycles` | `2000` | Total join/leave cycles to run across the whole test. |
| `--concurrency` | `50` | Worker-pool size = number of simultaneous connect/join/disconnect cycles in flight. |
| `--holdMs` | `0` | Hold the viewer session open this long after a successful join before disconnecting. `0` = maximum churn. |
| `--rampMs` | `0` | Stagger worker startup across this window. `0` = start all workers immediately. |
| `--timeout` | `8000` | Per-connect and per-ack timeout in ms. |

The `--concurrency` workers each pull the next cycle off a shared cursor until `--cycles`
total cycles are done (a soak-style worker pool), so raising concurrency raises the
instantaneous write pressure while `--cycles` bounds the total work.

---

## Mongo-side sampling (do this WHILE it runs)

The client alone only shows you the *symptom* (ack latency). To find the *cause* you must
watch Mongo at the same time. Open a second terminal before you start the run.

**1. `mongostat` — live write rates and contention**

```bash
mongostat --rowcount 0            # or: mongostat -u <user> -p --authenticationDatabase admin
```
Watch the `insert`, `update`, `dirty`, `used` (WiredTiger cache), and `qrw` (queued
read/write) columns. Rising `qrw`/`dirty` while `insert`+`update` stop climbing = the write
path is the bottleneck.

**2. `opcounters` deltas — insert vs update volume**

```javascript
// in mongosh, sample twice ~10s apart and diff:
db.serverStatus().opcounters       // { insert, query, update, delete, ... }
```
Each join should add ~1 insert (`Viewer.create`) and ~1 update (`LiveRoom $inc`). Confirm
the deltas track your reported joins/sec.

**3. `db.currentOp()` — in-flight write ops and waits**

```javascript
db.currentOp({ active: true })
// or focus on slow/waiting ops:
db.currentOp({ active: true, secs_running: { $gte: 1 } })
```
Look for ops parked on `WriteConflict`, collection/global locks, or long `secs_running`.

**4. Write latency / lock %**

```javascript
db.serverStatus().wiredTiger.concurrentTransactions   // write ticket availability
db.serverStatus().globalLock                          // currentQueue.writers
db.viewers.stats().wiredTiger["block-manager"]        // I/O pressure on the hot collection
```
Write tickets pinned at 0 available, or a growing `globalLock.currentQueue.writers`, both
mean writes are queuing.

**5. Index check on the queried fields**

The `LiveRoom` `$inc` filters on `experienceRoomId`, and viewer inserts/queries key on
`roomId`. Verify supporting indexes actually exist in your deployment:

```javascript
db.liveRooms.getIndexes()   // expect an index whose prefix is experienceRoomId
db.viewers.getIndexes()     // expect indexes prefixed by roomId
```
The schemas declare `{ experienceRoomId: 1, status: 1 }` on `LiveRoom` (so `experienceRoomId`
is a usable index prefix) and `{ roomId: 1, viewerId: 1 }` / `{ roomId: 1, joinedAt: -1 }` on
`Viewer`. Confirm these are present — a missing index turns the per-join `$inc` update into a
collection scan and will dominate latency.

---

## Interpretation

- **`joinRoom` p99 climbing while `opcounters` insert/update deltas plateau** ⇒ you have hit
  the Mongo **write ceiling**: more offered load is queuing, not landing. Corroborate with
  rising `qrw`/`globalLock.currentQueue.writers` and shrinking write tickets. First thing to
  verify: the indexes above actually exist (an unindexed `$inc` filter is the usual culprit).
- **Latency flat while opcounters scale linearly with joins/sec** ⇒ Mongo is keeping up at
  this level; push `--concurrency` (and/or `--holdMs 0`) higher to find the real ceiling.
- **Many `connect errors` / `join failures` before Mongo saturates** ⇒ the bottleneck is
  upstream (socket accept, JWT middleware, mediasoup room lookup), not the database.
- Compare `joins/sec` here against the join-latency numbers from `signaling-latency.js` at
  the same concurrency to separate DB-write cost from the rest of the join path.

---

## Caveats

- **The join rate limiter is commented out server-side.** In
  `registerViewer.handler.ts` the per-user and per-IP `rateLimiter(...)` checks are disabled
  (commented out, per the signaling notes), so joins are **not throttled** — this test can
  drive the real write ceiling, but it also means production behaviour with the limiter
  enabled will differ.
- This is a load generator, not a benchmark harness: numbers depend on your hardware, Mongo
  deployment (standalone vs replica set), network, and whether other traffic is present.
- `--holdMs 0` maximises churn (fastest write turnover) but also maximises connect/disconnect
  overhead; use a non-zero `--holdMs` to model realistic viewer dwell time.

---

## Results

_Pending execution — not fabricated._

| Run | cycles | concurrency | holdMs | join p50 | p90 | p95 | p99 | max | joins/sec | join fails | connect errors | Mongo notes (mongostat/opcounters) |
|-----|--------|-------------|--------|----------|-----|-----|-----|-----|-----------|-----------|----------------|------------------------------------|
| _tbd_ | | | | | | | | | | | | |
