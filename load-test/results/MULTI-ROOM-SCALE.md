# Multi-Room Scale Load Test

> Authored by Claude (Anthropic), via Claude Code — 2026-08-27.

A [`puppeteer`](https://pptr.dev/) load test that spins up **M concurrent rooms**,
each with **1 broadcaster + V viewers**, to exercise the CrowdStream SFU's
mediasoup worker pool across rooms.

## Roadmap gap this fills

The existing `load-test/sfu-capacity.js` piles **many viewers into ONE room**.
That stresses a single router on a single worker, but it does **not** exercise
the part of the system that actually scales horizontally: the worker pool.

Real production scale is **many ROOMS × many workers**. The server places each
room's router on the *least-loaded* worker and **spawns new workers** once a
worker crosses `WORKER_THRESHOLD` users (dynamic scaling, capped at
`MEDIASOUP_MAX_WORKERS`). None of that placement/scaling logic is currently
covered by a load test. This script closes that gap by creating many rooms so
routers spread across (and force the creation of) multiple workers.

## What it tests

- **Worker placement** — many rooms → many routers → the least-loaded-worker
  placement logic gets exercised, not just a single hot worker.
- **Dynamic worker scaling** — enough rooms should push a worker past
  `WORKER_THRESHOLD` and trigger new workers to spawn (up to
  `MEDIASOUP_MAX_WORKERS`).
- **Broadcaster setup latency** — time from clicking *Go live* to
  `window.__csLiveAt` (room created + router assigned + live), per room.
- **Viewer join success & latency** — time from form submit to
  `window.__csJoinedAt`, plus first-frame (`window.__csFirstFrameAt`) counts.
- **Failure counts** — rooms that never went live; viewers that never joined.

Load profile: rooms are launched sequentially with a ramp delay, then **kept
open concurrently** for the whole run, so the worker pool is under simultaneous
multi-room load rather than a rolling one-room-at-a-time load.

## Prerequisites

- **Node + puppeteer** installed (Chromium is downloaded by puppeteer). The
  script uses fake media (`--use-fake-device-for-media-stream`,
  `--use-fake-ui-for-media-stream`) so no real camera/mic is needed.
- **Broadcaster-permitted account(s).** Creating a room may require an account
  with broadcaster permissions. A *single* account frequently **cannot hold
  multiple concurrent rooms** (one live broadcast per account). For any real
  M > 1 run, provide a **pool of broadcaster accounts** via `--emails` /
  `--passwords`; they are round-robined across rooms. Each room's viewers reuse
  that room's account. **Credentials are never hardcoded** — the script exits if
  none are supplied.
- **Browser-fleet CPU.** A broadcaster **plus** V viewers per room is heavy:
  every page runs a real WebRTC pipeline (encode on the broadcaster, decode on
  each viewer). One machine will saturate quickly. For large M, **shard the
  rooms across multiple machines** (run the script on each with a slice of the
  account pool) and aggregate the CSVs. Treat this single-process runner as one
  fleet node.
- A running CrowdStream stack (frontend + signalling + mediasoup) reachable at
  `--baseUrl`.

## How to run

```bash
# Single account (small smoke test — may not sustain multiple live rooms):
export CROWDSTREAM_TEST_EMAIL="you@example.com"
export CROWDSTREAM_TEST_PASSWORD="••••••••"
node multi-room-scale.js --baseUrl http://localhost --rooms 3 --viewersPerRoom 5

# Account pool (recommended for M > 1) — round-robined across rooms:
node multi-room-scale.js \
  --baseUrl http://localhost \
  --rooms 10 --viewersPerRoom 5 --roomRampMs 2000 \
  --emails "a@x.com,b@x.com,c@x.com" \
  --passwords "pw1,pw2,pw3" \
  --out multi-room-results.csv
```

### Arguments

| Arg | Default | Description |
| --- | --- | --- |
| `--baseUrl` | `http://localhost` | CrowdStream frontend base URL. |
| `--rooms` | `10` | Number of rooms (M) to create. |
| `--viewersPerRoom` | `5` | Viewers (V) to add to each room. |
| `--roomRampMs` | `2000` | Delay in ms between successive room launches. |
| `--out` | `multi-room-results.csv` | Progressive CSV output path. |
| `--email` | — | Single account email. Falls back to `$CROWDSTREAM_TEST_EMAIL`. |
| `--password` | — | Single account password. Falls back to `$CROWDSTREAM_TEST_PASSWORD`. |
| `--emails` | — | Comma-separated email pool (round-robined per room). Overrides `--email`. |
| `--passwords` | — | Comma-separated password pool, paired by index with `--emails`. |

If neither an email/password pair nor a pool is provided (via args or env), the
script prints an error and exits `1`.

### Output CSV

One row is written **after each room** (progressive; cumulative percentiles):

```
timestamp,rooms,totalViewers,broadcasterSetupP50,broadcasterSetupP99,viewerJoinP50,viewerJoinP99,broadcasterFailures,viewerFailures
```

## Server-side sampling

The client-side numbers only tell you *whether* rooms came up and how fast. The
interesting scaling behaviour is on the **server**. While the test ramps, watch
the mediasoup/SFU process logs and confirm:

1. **Router placement is least-loaded.** As each room is created, the log should
   show its router being assigned to the currently least-loaded worker. Tail the
   worker-placement logs and note which worker (PID/index) each new room lands
   on. Placement should favour the emptiest worker, not always worker 0.
2. **New workers spawn at `WORKER_THRESHOLD`.** Track the per-worker user count.
   When a worker crosses `WORKER_THRESHOLD`, a **new worker should spawn** (until
   `MEDIASOUP_MAX_WORKERS`). Correlate the room number at which spawning kicks in
   with `WORKER_THRESHOLD × (workers so far)`.
3. **Even distribution.** After all M rooms are live, rooms/routers should be
   spread roughly evenly across the active workers, and CPU per worker process
   should be comparable.

Useful things to sample alongside the run: `WORKER_THRESHOLD`,
`MEDIASOUP_MAX_WORKERS`, active worker count over time, rooms-per-worker, and
per-worker CPU (e.g. `top -H` / `pidstat` on the SFU host).

## Interpretation

- **Healthy:** setup/join latencies stay flat as M grows; worker count climbs in
  step with `WORKER_THRESHOLD`; rooms are evenly distributed; failures ≈ 0.
- **Findings (what to flag):**
  - **Uneven placement** — new rooms keep landing on an already-hot worker while
    others sit idle ⇒ least-loaded placement is broken.
  - **Failure to scale** — worker count stays flat past `WORKER_THRESHOLD` (and
    below `MEDIASOUP_MAX_WORKERS`) while latency/failures climb ⇒ dynamic worker
    spawning isn't triggering.
  - **Cliff at the cap** — sharp latency/failure rise once `MEDIASOUP_MAX_WORKERS`
    is reached ⇒ capacity ceiling; document the room count at the cliff.
  - Rising `broadcasterFailures` = room creation is the bottleneck (often the
    single-account limitation — add accounts). Rising `viewerFailures` with
    healthy broadcasters points at router/transport capacity on a worker.

## Results

_Pending execution — not fabricated._

| rooms | totalViewers | broadcasterSetupP50 | broadcasterSetupP99 | viewerJoinP50 | viewerJoinP99 | broadcasterFailures | viewerFailures |
| --- | --- | --- | --- | --- | --- | --- | --- |
| _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |
