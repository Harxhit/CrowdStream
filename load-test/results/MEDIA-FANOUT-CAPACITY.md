# Media-Fanout Capacity Testing

**Roadmap gap: media-plane capacity** (control-plane is already covered by the signaling load test — see `results/SIGNALING.MD`).

## What it tests

One broadcaster goes live with fake media. Viewers join in batches (real
headless Chrome tabs, each with its own isolated session, each actually
decoding video via WebRTC) until every viewer already connected is putting
load on the SFU at the same time. For every viewer we measure:

- **Join latency** and **first-frame latency** (form submit → joined → first
  decoded frame)
- **Inbound video** bitrate, packet loss %, fps, and resolution, read straight
  off each tab's real `RTCPeerConnection.getStats()`

Results are appended to CSV after every batch, one row per batch.

## Prerequisites

- Puppeteer (already in `load-test/node_modules`)
- A broadcaster-capable account via `--email`/`--password` or
  `CROWDSTREAM_TEST_EMAIL` / `CROWDSTREAM_TEST_PASSWORD` — never hardcoded
- A running CrowdStream frontend + backend at `--baseUrl`
- **Client CPU/RAM headroom.** Every viewer is a real Chrome tab decoding real
  video — the load generator itself is resource-bound. Large runs (100+
  viewers) need to be spread across multiple machines, or you're measuring
  your own laptop, not the SFU.

## How to run

```bash
cd load-test

export CROWDSTREAM_TEST_EMAIL="broadcaster@example.com"
export CROWDSTREAM_TEST_PASSWORD="••••••••"

node media-fanout-capacity.js \
  --baseUrl http://localhost \
  --batchSize 5 \
  --batchIntervalMs 10000 \
  --maxViewers 100 \
  --statsSettleMs 2000 \
  --out media-fanout-results.csv
```

| Arg | Default | Meaning |
|---|---|---|
| `--baseUrl` | `http://localhost` | Frontend base URL. |
| `--batchSize` | `5` | Viewers added per batch. |
| `--batchIntervalMs` | `10000` | Wait between batches (ms). |
| `--maxViewers` | `100` | Stop after this many total viewers. |
| `--statsSettleMs` | `2000` | Gap between the two getStats samples (ms). |
| `--out` | `media-fanout-results.csv` | CSV output path. |
| `--email` | env `CROWDSTREAM_TEST_EMAIL` | Broadcaster login email. |
| `--password` | env `CROWDSTREAM_TEST_PASSWORD` | Broadcaster login password. |

CSV columns: `timestamp,viewers,joinP50,joinP99,firstFrameP50,firstFrameP99,meanBitrateKbps,meanLossPct,meanFps,failures`.

## Interpreting results — spotting the ceiling

Watch for these moving together as `viewers` climbs: `meanBitrateKbps` falling,
`meanFps` dropping below source rate, `meanLossPct` rising above ~1–2%,
`firstFrameP99` climbing sharply, and `failures` increasing. The **knee**
where these start moving together is the practical capacity for the tested
hardware.

## Results

Single-machine run (broadcaster, all viewers, and backend on one host):

| viewers | joinP50 | joinP99 | firstFrameP50 | firstFrameP99 | meanBitrateKbps | meanLossPct | meanFps | failures |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 70 | 6853 ms | 8490 ms | 8529 ms | 10358 ms | 105.7 | 0.00% | 7.8 | 0 |

70 concurrent real viewers joined cleanly with 0% packet loss and 0 join
failures. The run was stopped attempting the next batch (80 viewers) by a
script bug (`ReferenceError: context is not defined` in a cleanup path added
after switching viewers to isolated browser contexts) — not a measured SFU or
backend failure. The host was visibly under load (high RAM/swap) at that
point per manual `htop` observation, but this was not confirmed via an OOM
kill or any Node/Chrome memory error in the logs, so whether 70–80 concurrent
Chrome tabs is this machine's real ceiling — versus just where the script
happened to crash — is still open.

**Two things worth flagging on the numbers themselves, not just the crash:**
- Join (~7–8.5s) and first-frame (~8.5–10.4s) latency are both high for a live
  stream by commercial standards; worth investigating independent of capacity.
- The 105.7 kbps bitrate reflects Chrome's fake-media-device test pattern,
  not real camera bitrate — it validates that media is flowing end-to-end,
  not real-world video quality.

**Next step:** fix the context-cleanup bug, rerun to `--maxViewers 100+`
while monitoring host RAM/swap directly, and confirm whether degradation
shows up as an actual knee (bitrate/fps dropping, loss/failures rising) or
whether the client host runs out of headroom first — per the caveat above,
that would mean re-running across multiple client machines to find the SFU's
real ceiling.

## Caveats

- **These are client-observed numbers**, not server-side truth. For
  authoritative bitrate/loss/jitter/fps, wire up the backend's own
  `getStats()` path — `backend/src/utils/sendMetrics.ts` already sketches this
  but is currently commented out in its entirety.
- **Per-batch means describe the newest viewers**, not a re-sample of every
  active viewer — a viewer that degrades after its own batch's measurement
  isn't re-counted.
- **Fake media** (`--use-fake-device-for-media-stream`) is a synthetic
  pattern; absolute bitrate figures depend on negotiated encoder settings,
  not real camera input.