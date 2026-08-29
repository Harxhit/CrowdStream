# Connect / Disconnect Soak Test

> **Authored by Claude (Anthropic), via Claude Code --- 2026-08-27.**
>
> The test script (`load-test/connect-disconnect-soak.js`) and this
> document were written by Claude.

Roadmap item: **Week 4 (State & reliability) --- Day 5**

*"Connect/disconnect soak shows flat resource counts (no leak)"* and

*"Clean client recovery after a simulated node loss."*

## What this tests

The soak driver hammers the signaling server with a large number of
connect → optional `joinRoom` → disconnect cycles:

``` text
        ┌─────────────────────────────────────────┐
        │  repeat CYCLES times, CONCURRENCY at a  │
        │  time:                                  │
        │                                         │
        │   connect (cookie: accessToken=<jwt>)   │
        │        ↓                                │
        │   joinRoom(roomId)       (if --join)    │
        │        ↓                                │
        │   hold HOLD_MS           (if > 0)       │
        │        ↓                                │
        │   disconnect → server handleDisconnect  │
        └─────────────────────────────────────────┘
```

It exercises the exact server paths that must clean up on disconnect:

`handleDisconnect(socket)`, viewer/room map removal, and (with `--join`)
the mediasoup viewer transport/consumer teardown.

**What the script measures (client-side):** connect latency, `joinRoom`
ack latency, cycle success/failure counts, and churn throughput
(cycles/sec).

**What you measure (server-side):** the actual leak signal. The script
cannot directly read the server's internal resource state, so backend
RSS and resource counts should be captured before and after the test.

## Prerequisites

-   `socket.io-client` (already in `load-test/node_modules`).
-   A valid JWT `accessToken` (the socket auth middleware rejects
    anonymous connections).
-   **Only if using `--join true`:** a live room id --- start a
    broadcast, then use its room id.

## How to run

``` bash
cd load-test

# Pure connection-lifecycle churn
node connect-disconnect-soak.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --cycles 2000 \
  --concurrency 100

# Full churn including join/leave cleanup
node connect-disconnect-soak.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --room "<ROOM_UUID>" \
  --join true \
  --cycles 2000 \
  --concurrency 100 \
  --holdMs 250
```

### Arguments

  -------------------------------------------------------------------------
  Flag                    Default                   Meaning
  ----------------------- ------------------------- -----------------------
  `--url`                 `http://localhost:3000`   Signaling server URL

  `--token`               *(required)*              JWT set as
                                                    `accessToken` cookie

  `--room`                `null`                    Live room id (required
                                                    when `--join true`)

  `--cycles`              `1000`                    Total
                                                    connect/disconnect
                                                    cycles

  `--concurrency`         `50`                      Cycles in flight at
                                                    once

  `--holdMs`              `0`                       Time to stay connected
                                                    before disconnecting

  `--join`                `false`                   Also `joinRoom` each
                                                    cycle (exercises viewer
                                                    cleanup)

  `--settleMs`            `5000`                    Wait after churn for
                                                    server cleanup before
                                                    final metrics

  `--metricsUrl`          `null`                    Optional health/metrics
                                                    endpoint sampled at
                                                    start & end

  `--timeout`             `8000`                    Per-op ack/connect
                                                    timeout (ms)
  -------------------------------------------------------------------------

## Detecting a leak

The pass/fail signal is **server-side resource counts returning to
baseline**.

Recommended procedure:

1.  **Baseline** --- with the server idle, record:

    -   Backend RSS
    -   Socket count
    -   Viewer count
    -   Room count
    -   WebRTC transport count
    -   Producer count
    -   Consumer count
    -   Mediasoup worker count
    -   Mediasoup router count

2.  **Run** the soak test.

3.  **After the settle window**, record the same numbers again.

4.  **Repeat the test 3--5 times without restarting the backend.**

5.  **Interpretation:** resource counts should return approximately to
    baseline after each run. RSS may remain temporarily elevated because
    of Node.js garbage collection, so a small RSS increase alone is not
    sufficient evidence of a leak. A persistent or monotonic increase in
    live resource counts across repeated runs is the stronger leak
    signal.

## Test results

### Run 1 --- 100 cycles / 10 concurrency

Command:

``` bash
node connect-disconnect-soak.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --room "bf4d5323-1ff8-4187-b21d-9039f824f09c" \
  --join true \
  --cycles 100 \
  --concurrency 10
```

Results:

  Metric                          Result
  ---------------- ---------------------
  Cycles                   **100 / 100**
  Concurrency                     **10**
  Join                          **true**
  Hold time                     **0 ms**
  Connect errors                   **0**
  Join errors                      **0**
  Connect avg                **55.7 ms**
  Connect p50                **50.0 ms**
  Connect p90                **70.2 ms**
  Connect p95               **106.7 ms**
  Connect p99               **123.6 ms**
  Connect max               **137.5 ms**
  Join avg                   **46.3 ms**
  Join p50                   **42.0 ms**
  Join p90                   **52.3 ms**
  Join p95                   **95.9 ms**
  Join p99                  **109.7 ms**
  Join max                  **112.9 ms**
  Throughput         **91.2 cycles/sec**
  Duration                   **1.1 sec**

**Result:** All 100 connect → join → disconnect cycles completed
successfully with zero connection or join errors.

### Run 2 --- 1,000 cycles / 50 concurrency

Command:

``` bash
node connect-disconnect-soak.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --room "bf4d5323-1ff8-4187-b21d-9039f824f09c" \
  --join true \
  --cycles 1000 \
  --concurrency 50
```

Results:

  Metric                           Result
  ---------------- ----------------------
  Cycles                  **1000 / 1000**
  Concurrency                      **50**
  Join                           **true**
  Hold time                      **0 ms**
  Connect errors                    **0**
  Join errors                       **0**
  Connect avg                **339.7 ms**
  Connect p50                **330.2 ms**
  Connect p90                **452.5 ms**
  Connect p95                **513.6 ms**
  Connect p99                **575.0 ms**
  Connect max                **588.7 ms**
  Join avg                    **40.1 ms**
  Join p50                    **31.4 ms**
  Join p90                    **51.7 ms**
  Join p95                   **101.6 ms**
  Join p99                   **171.1 ms**
  Join max                   **255.1 ms**
  Throughput         **128.3 cycles/sec**
  Duration                    **7.8 sec**

**Result:** All 1,000 connect → join → disconnect cycles completed
successfully with zero connection or join errors.

### Run 3 --- 1,000 cycles / 50 concurrency / 5-second hold

Command:

``` bash
node connect-disconnect-soak.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --room "bf4d5323-1ff8-4187-b21d-9039f824f09c" \
  --join true \
  --cycles 1000 \
  --concurrency 50 \
  --holdMs 5000
```

Results:

  Metric                         Result
  ---------------- --------------------
  Cycles                **1000 / 1000**
  Concurrency                    **50**
  Join                         **true**
  Hold time                 **5000 ms**
  Connect errors                  **0**
  Join errors                     **0**
  Connect avg              **249.4 ms**
  Connect p50              **281.8 ms**
  Connect p90              **447.3 ms**
  Connect p95              **504.1 ms**
  Connect p99              **536.5 ms**
  Connect max              **546.2 ms**
  Join avg                  **48.1 ms**
  Join p50                  **24.0 ms**
  Join p90                 **148.3 ms**
  Join p95                 **221.3 ms**
  Join p99                 **288.4 ms**
  Join max                 **355.2 ms**
  Throughput         **9.3 cycles/sec**
  Duration                **107.2 sec**

**Result:** All 1,000 connect → join → 5-second hold → disconnect cycles
completed successfully with zero connection or join errors.

The lower throughput compared with the previous run is expected because
each connection remains active for 5 seconds before disconnecting.

## Overall test status

  -----------------------------------------------------------------------
  Test                                Status
  ----------------------------------- -----------------------------------
  100 cycles / 10 concurrency         **PASS**

  1,000 cycles / 50 concurrency       **PASS**

  1,000 cycles / 50 concurrency / 5s  **PASS**
  hold                                

  Connection failures                 **0**

  `joinRoom` failures                 **0**

  Server-side leak verification       **PENDING resource-count baseline
                                      comparison**
  -----------------------------------------------------------------------

### Conclusion

The client-side soak tests completed successfully across all three runs.
The signaling server handled **2,100 total connect/join/disconnect
cycles** with **zero connection errors and zero `joinRoom` errors**.

The 5-second hold test additionally exercises cleanup after connections
remain established instead of disconnecting immediately.

**The leak claim remains pending until backend RSS and live resource
counts are captured before and after repeated runs.** In particular,
socket, viewer, room, WebRTC transport, producer/consumer, mediasoup
worker, and router counts should return approximately to their baseline
after the settle window.

## Simulating node loss

To validate *clean client recovery after a simulated node loss*, run a
small number of long-lived clients:

``` bash
node connect-disconnect-soak.js \
  --url http://localhost:3000 \
  --token "<JWT>" \
  --room "<ROOM_UUID>" \
  --join true \
  --cycles 5 \
  --concurrency 5 \
  --holdMs 60000
```

Then kill one signaling pod/server while the clients are connected and
verify that the frontend reconnects and re-joins correctly.

This script intentionally uses `reconnection: false` for deterministic
churn accounting, so the node-loss recovery scenario should be driven
separately or tested with a dedicated client configured with
`reconnection: true`.
