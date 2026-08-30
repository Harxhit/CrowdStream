# Media-Fanout Capacity Testing

> **Authored by Claude (Anthropic), via Claude Code — 2026-08-27.**
> Both this document and the accompanying `media-fanout-capacity.js` script were written by Claude.

**Roadmap gap: media-plane capacity** (control-plane is already covered by the signaling load test — see `results/SIGNALING.MD`).

The signaling test proves the SFU can accept thousands of viewers through the
control path (`joinRoom` → `createViewerTransport` → `connectConsumerTransport`
→ `consume` → `resumeConsumer`). It does **not** prove that media actually
flows to those viewers at a usable bitrate. This test closes that gap: it
measures the real media plane.

## What it tests

One broadcaster streams fake media; viewers ramp up in batches. Each new batch
of viewers joins under the load created by every viewer already connected, so
the SFU's fan-out cost accumulates as the run progresses.

```
launchBroadcaster  (Go live -> __csRoomId -> __csLiveAt)
        |
        v
  ramp viewers in batches of --batchSize
        |
        v
  per viewer:  join  (__csJoinedAt)
               first frame  (__csFirstFrameAt)
               inbound-rtp getStats sample x2  (--statsSettleMs apart)
        |
        v
  aggregate per batch -> append CSV row -> wait --batchIntervalMs
```

For every viewer we capture:

- **Join latency** — form submit → `window.__csJoinedAt`.
- **First-frame latency** — form submit → `window.__csFirstFrameAt`.
- **Inbound video getStats** — bitrate (kbps), packet-loss %, jitter, fps, and
  resolution (frame width × height).

### The getStats hook (no frontend changes)

The frontend does not expose `getStats` output, and we do not modify it. Instead
the script uses Puppeteer's `page.evaluateOnNewDocument(...)` to wrap
`window.RTCPeerConnection` **before any page script runs**, on every navigation
of the tab (signin → dashboard → viewer). Every PeerConnection the app
constructs is pushed into `window.__csPCs`:

```js
const Wrapped = new Proxy(Native, {
  construct(target, args) {
    const pc = new target(...args);
    window.__csPCs.push(pc);
    return pc;
  },
});
window.RTCPeerConnection = Wrapped;
```

To sample, the script iterates `window.__csPCs`, calls `await pc.getStats()`,
and collects `inbound-rtp` reports (`kind: "video" | "audio"`), reading
`bytesReceived, packetsReceived, packetsLost, jitter, framesPerSecond,
frameWidth, frameHeight`.

- **Bitrate (kbps)** = delta of `bytesReceived` across two samples taken
  `--statsSettleMs` apart: `(deltaBytes * 8) / deltaMs`.
- **Packet-loss %** = `packetsLost / (packetsLost + packetsReceived) * 100`.
- **fps / resolution** are read from the latest (second) video report.

## Prerequisites

- **Puppeteer** — already installed in `load-test/node_modules`; no extra install.
- **A broadcaster-capable account** — the credentials must be able to open
  `/broadcaster` and click "Go live". Supplied via `--email`/`--password` or the
  environment variables `CROWDSTREAM_TEST_EMAIL` / `CROWDSTREAM_TEST_PASSWORD`.
  Credentials are never hardcoded; the script exits with an error if they are
  missing.
- **A running CrowdStream frontend + backend** reachable at `--baseUrl`.
- **CPU headroom on the client.** Each viewer is a real headless Chrome tab
  decoding real video. The client browser fleet is **CPU-bound**, so large runs
  (hundreds of viewers) must be spread across **multiple machines** — otherwise
  you are measuring the load generator, not the SFU.

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

Credentials may instead be passed inline with `--email` / `--password`.

### Arguments

| Arg | Default | Meaning |
|---|---|---|
| `--baseUrl` | `http://localhost` | Frontend base URL. |
| `--batchSize` | `5` | Viewers added per batch. |
| `--batchIntervalMs` | `10000` | Wait between batches (ms). |
| `--maxViewers` | `100` | Stop after this many total viewers. |
| `--statsSettleMs` | `2000` | Gap between the two getStats samples (ms) used for the bitrate delta. |
| `--out` | `media-fanout-results.csv` | CSV output path (rewritten after each batch). |
| `--email` | env `CROWDSTREAM_TEST_EMAIL` | Broadcaster login email. |
| `--password` | env `CROWDSTREAM_TEST_PASSWORD` | Broadcaster login password. |

### CSV output

One row per batch:

```
timestamp,viewers,joinP50,joinP99,firstFrameP50,firstFrameP99,meanBitrateKbps,meanLossPct,meanFps,failures
```

`viewers` and `failures` are cumulative; the latency percentiles and the
`meanBitrateKbps` / `meanLossPct` / `meanFps` columns describe the batch that
just joined (i.e. the newest viewers experiencing the current, highest load).

## Interpreting results — spotting the ceiling

The media-plane ceiling is **not** a single hard cliff; it shows up as
degradation across several columns as `viewers` climbs:

- **`meanBitrateKbps` falls** — the SFU (or the client) can no longer push full
  video to each viewer; per-viewer bitrate is being starved.
- **`meanFps` drops** below the source frame rate — frames are being dropped
  end-to-end.
- **`meanLossPct` rises** above ~1–2% — packets are being lost on the media
  path.
- **`firstFrameP99` climbs** sharply — new viewers wait longer (or time out)
  before the first decoded frame.
- **`failures` increases** — viewers no longer reach `__csJoinedAt` /
  `__csFirstFrameAt` at all.

The **knee** is the viewer count where bitrate/fps start dropping and loss/
failures start rising together. That is the practical media-plane capacity for
the tested hardware. If none of these degrade up to `--maxViewers`, raise
`--maxViewers` (and add client machines) until they do.

## Caveats

- **The client CPU is usually the bottleneck first.** These are real Chrome tabs
  decoding real video. Before trusting a ceiling, confirm the load-generator
  host is not CPU-saturated; if it is, the degradation is on the client, not the
  SFU. Spread viewers across multiple machines and re-run.
- **These are client-observed numbers.** For **authoritative server-side**
  bitrate / loss / jitter / fps, wire up the backend's own `getStats()` path —
  `backend/src/utils/sendMetrics.ts` already sketches exactly this
  (bandwidth, packet loss, jitter, frame rate, resolution) but is **currently
  commented out** in its entirety. Enabling it would let the server report the
  media plane directly rather than inferring it from headless clients.
- **Per-batch means describe the newest viewers**, not a re-sample of every
  active viewer. This is intentional (the newest viewers see the highest load),
  but it means a viewer that degrades after its batch measurement is not
  re-counted.
- **Fake media** (`--use-fake-device-for-media-stream`) is a synthetic pattern;
  absolute bitrate figures depend on the encoder settings the app negotiates.

## Results

_Pending execution against a running backend — not fabricated._

| viewers | joinP50 | joinP99 | firstFrameP50 | firstFrameP99 | meanBitrateKbps | meanLossPct | meanFps | failures |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ | _tbd_ |
