# Recording Concurrency Load Test

> Authored by Claude (Anthropic), via Claude Code — 2026-08-27.

Roadmap gap: **concurrent server-side recording load is untested.** CrowdStream can
record a room server-side, but every recording spawns an FFmpeg process — an expensive,
CPU/disk/FD/port-heavy operation. Nothing in the load-test suite has yet answered "how
many simultaneous recordings can one server node sustain before it falls over?" This test
fills that gap.

## What it tests

Ramps `--recorders` sockets, each of which joins a single LIVE room and asks the server to
record it. The point is to overlap many recordings at once and watch when the server stops
keeping up.

Per concurrent recording, the server pays (verified against `backend/src/utils/socket.util.ts`):

- **1 FFmpeg process** — spawned to mux the consumed RTP into an MP4 on disk (CPU + disk write).
- **1 mediasoup PlainTransport pair** — one audio, one video, each consuming the room's producers.
- **2 RTP UDP ports** — allocated from the server's port range (one per transport).

So N concurrent recordings ≈ N FFmpeg processes + N transport pairs + 2N UDP ports, all
writing MP4s to disk at once. That is the load this test generates.

The client measures what it can see:

- **start-recording latency** — from emitting `start-recording` to receiving the
  `recording-started {recordingId}` event (i.e. the time to spawn FFmpeg + build the
  transport pair + allocate ports).
- **stop-recording ack** — time for the server to stop FFmpeg, close transports/consumers,
  release ports, and `ack()`.
- **start/stop success counts and failures/timeouts.**

## Prerequisites

- A **LIVE room with an active broadcaster producing audio and video.** Recordings consume
  the room's producers; an empty room produces empty/zero-byte files and is not a meaningful test.
- A valid JWT for the `accessToken` cookie (the socket auth middleware rejects unauthenticated
  connections).
- `socket.io-client` installed (already present in `load-test/node_modules`).
- Enough **free disk** in the server's recording output directory to hold `--recorders`
  simultaneous MP4s for the full `--recordMs` hold (see caveats).

## How to run

```bash
node recording-concurrency.js \
  --url http://localhost:3000 \
  --token "$ACCESS_TOKEN" \
  --room <liveRoomId> \
  --recorders 20 \
  --rampMs 10000 \
  --recordMs 30000 \
  --timeout 15000
```

Never hardcode the token — pass it via an environment variable as shown.

### Arguments

| Arg           | Default                 | Description                                                      |
| ------------- | ----------------------- | ---------------------------------------------------------------- |
| `--url`       | `http://localhost:3000` | Server base URL.                                                 |
| `--token`     | _(required)_            | JWT for the `accessToken` cookie. Exits 1 if missing.            |
| `--room`      | _(required)_            | LIVE room id with a broadcaster producing. Exits 1 if missing.   |
| `--recorders` | `20`                    | Number of concurrent recordings to ramp.                         |
| `--rampMs`    | `10000`                 | Window over which recorders are started (spread evenly).         |
| `--recordMs`  | `30000`                 | How long each recorder holds its recording open before stopping. |
| `--timeout`   | `15000`                 | Per-operation timeout (connect, joinRoom ack, recording-started, stop ack). |

## Server-side saturation sampling

The client numbers only tell you when the server _stopped responding_. To find the real
ceiling and see _why_, sample the server host while the test holds its recordings open.

**FFmpeg CPU (per-process and aggregate):**

```bash
pidstat -C ffmpeg 2 5           # per-ffmpeg %CPU, sampled every 2s
top -b -n1 | grep -c ffmpeg     # count of live ffmpeg processes
top -b -n1 | grep ffmpeg        # their individual CPU/MEM
```

**Disk (fill + write throughput):**

```bash
df -h /path/to/recording/output   # watch free space shrink as MP4s grow
iostat -x 2 5                     # %util and w_await on the recording disk
```

**File descriptors held by the Node server** (transports, consumers, sockets, MP4 writers):

```bash
ls /proc/<node-pid>/fd | wc -l    # total open FDs; compare against `ulimit -n`
```

**RTP UDP port-range usage** (2 ports per recording — watch for exhaustion):

```bash
ss -u -a -n | wc -l                          # total UDP sockets
ss -u -a -n | grep -c ':4[0-9]{4}'           # count within your RTP port range (adjust regex)
```

Sample all of these once per second (or via `watch -n1`) across the ramp + hold window.

## Interpretation

At the ceiling the client-visible symptoms are:

- **start-recording latency climbs** — FFmpeg spawns and transport/port allocation queue
  behind a CPU/disk-bound server; p90/p95/p99 pull away from p50.
- **start/stop timeouts appear** — `recording-started` never arrives, or `stop-recording`
  never acks (the server errors out server-side and only logs). `Failures` and the timeout
  subcount rise.

Cross-reference the moment failures begin with the server samples above: if ffmpeg CPU is
pinned, you are CPU-bound; if `iostat` `%util` is ~100%, you are disk-bound; if FD count
approaches `ulimit -n` or the RTP port range is exhausted, you have hit a resource cap.
The saturation point is the highest `--recorders` at which start latency stays flat and
failures stay at zero.

## Caveats

- **Disk fills during long holds.** Every recorder writes a growing MP4 for the entire
  `--recordMs`. Large `--recorders` × long `--recordMs` can exhaust the recording disk and
  produce disk-full failures that look like server saturation but are just capacity — make
  sure the recording output directory has ample free space before a long run, and clean up
  MP4s between runs.
- Client-observed latency includes network + event-loop scheduling on the load generator;
  run the generator off-box from the server if the client machine is itself a bottleneck.
- Failed `start-recording` attempts emit no client-facing error event — the server only logs
  server-side — so a failure surfaces here purely as a `recording-started` timeout. Check
  server logs to distinguish causes.

## Results

_Pending execution — not fabricated._

| recorders | start success | stop success | start p50 (ms) | start p95 (ms) | stop p50 (ms) | failures | server bottleneck |
| --------- | ------------- | ------------ | -------------- | -------------- | ------------- | -------- | ----------------- |
| _TBD_     | _TBD_         | _TBD_        | _TBD_          | _TBD_          | _TBD_         | _TBD_    | _TBD_             |
