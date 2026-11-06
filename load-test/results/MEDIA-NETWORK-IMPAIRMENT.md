# Media Network Impairment Load Test

> Authored by Claude (Anthropic), via Claude Code — 2026-08-27.
> (This harness — both scripts and this document — was written by Claude.)

## Why this exists (roadmap gap)

CrowdStream's existing load tests (`sfu-capacity.js`, `signaling-latency.js`)
measure how many viewers can join and how fast the first frame arrives on a
**healthy** network. They say nothing about what happens when the network is
**bad**. Media resilience under packet loss, jitter, and constrained bandwidth
currently has **zero coverage** — yet that is exactly the condition real viewers
hit on mobile and congested Wi‑Fi.

This harness fills that gap: it deterministically degrades the network with
`tc netem`, then measures the resulting WebRTC receive quality (bitrate, packet
loss, jitter, frame rate) from real Chromium viewers.

## What it tests

For each network profile, it:

1. Launches N puppeteer viewers into an **existing LIVE room** (log in →
   `/viewer?roomId=…` → submit the join form → wait for `__csJoinedAt` and
   `__csFirstFrameAt`).
2. Hooks `RTCPeerConnection` (via `evaluateOnNewDocument`, before page scripts
   run) so every PeerConnection is captured into `window.__csPCs`.
3. Samples `getStats()` `inbound-rtp` **video** reports once per second for the
   run duration, deriving:
   - **meanBitrateKbps** — from the `bytesReceived` delta over wall-clock time.
   - **lossPct** — `packetsLost / (packetsLost + packetsReceived) * 100`.
   - **jitterMs** — mean of the `jitter` field (seconds → ms).
   - **meanFps** — mean of `framesPerSecond`.
   - (frame width/height sampled too, reported as a stderr diagnostic.)
4. Emits a single-line JSON summary on stdout that the bash harness captures.

## The netem profiles

| Profile | `tc netem` args | Simulates |
|---|---|---|
| baseline | *(qdisc removed — no shaping)* | Healthy control run |
| loss 1% | `loss 1%` | Mild packet loss |
| loss 3% | `loss 3%` | Moderate packet loss |
| loss 5% | `loss 5%` | Heavy packet loss |
| jitter | `delay 100ms 20ms distribution normal` | 100 ms RTT ± 20 ms normal jitter |
| rate 1mbit | `rate 1mbit` | Bandwidth-constrained link |

Each profile is applied with `tc qdisc replace dev $IFACE root netem …`
(baseline uses `tc qdisc del dev $IFACE root`), followed by a short settle
delay before the measurement run.

## ROOT + safety warning

**This harness shapes a REAL network interface.** `tc netem` degrades *all*
traffic on the chosen `$IFACE` — every socket on that NIC gets the added delay,
dropped packets, or throttled bandwidth.

- The script **refuses to run unless it is root** (it needs `CAP_NET_ADMIN`).
- Run it **only on a disposable test box or throwaway container**.
- Prefer shaping the **loopback / a dedicated test NIC** (e.g. `IFACE=lo`) so
  you don't cut your own SSH session or disrupt unrelated work.
- **Never** run it against a production host or a shared interface.
- An `EXIT`/`INT`/`TERM` trap always tears the qdisc down. A hard `kill -9` can
  still leave the interface shaped — recover manually with:
  `tc qdisc del dev <IFACE> root`.

## Prerequisites

- Node with `puppeteer` resolvable from where `impairment-measure.js` runs.
  The repo's copy lives in `load-test/node_modules`, so run from there or set
  `NODE_PATH=/home/harshit/CrowdStream/load-test/node_modules` (these harness
  files live in `/tmp` for review and are not wired into that `node_modules`).
- `iproute2` (`tc`) installed.
- An **existing LIVE room** (start a broadcaster first, e.g. via
  `sfu-capacity.js`, and note the room id).
- Test credentials in the environment:
  `CROWDSTREAM_TEST_EMAIL`, `CROWDSTREAM_TEST_PASSWORD`.

## How to run

```bash
# From a DISPOSABLE test box, as root. Shape loopback to stay safe.
sudo IFACE=lo ROOM_ID=<liveRoomId> BASE_URL=http://localhost \
     CROWDSTREAM_TEST_EMAIL=you@example.com \
     CROWDSTREAM_TEST_PASSWORD=secret \
     ./media-impairment.sh
```

Optional knobs (flags or env): `--viewers N` (`VIEWERS`),
`--durationMs MS` (`DURATION_MS`), `--iface NIC` (`IFACE`),
`--baseUrl URL` (`BASE_URL`).

You can also run the measurer standalone (no shaping) to sanity-check it:

```bash
CROWDSTREAM_TEST_EMAIL=… CROWDSTREAM_TEST_PASSWORD=… \
  node impairment-measure.js --roomId <liveRoomId> --durationMs 15000 --viewers 1
# -> {"meanBitrateKbps":..,"lossPct":..,"jitterMs":..,"meanFps":..,"samples":..}
```

## How to interpret the results

- **Always compare each profile against the baseline row**, not against
  absolute expectations — the fake media source and box capacity set the
  ceiling. What matters is the *delta*: how far bitrate/fps fall and how far
  loss/jitter climb as the network worsens.
- Rising `lossPct` and `jitterMs` with falling `meanFps` under the loss/jitter
  profiles is the expected signature of a stream with no recovery mechanism.
- **Simulcast / adaptive layer switching is currently OFF.** The backend's
  `backend/src/utils/adaptStreamQuality.ts` is **entirely commented out**
  (including the `consumer.setPreferredLayers({ spatialLayer: 0 })` downgrade
  path). So do **not** expect the SFU to drop viewers to a lower spatial layer
  under impairment — you should see **flat quality degradation**, not a clean
  step-down to a lower resolution. That flat degradation *is* the finding.
  **Recommended follow-up:** re-enable `adaptStreamQuality.ts` (and the
  encoder-side simulcast layers) and re-run this sweep to confirm adaptive
  downgrade actually kicks in — the baseline captured here becomes the
  before/after reference.

## Tooling alternatives

`tc netem` is the lightest-weight option but shapes a whole interface and needs
root. Alternatives worth considering for CI or safer isolation:

- **[toxiproxy](https://github.com/Shopify/toxiproxy)** — a TCP proxy with a
  control API; add latency/bandwidth/loss "toxics" per proxied connection
  without touching kernel qdiscs. Great for scripted, per-connection faults
  (note: proxies the signaling/TCP path; raw UDP media needs a UDP-capable
  path).
- **[comcast](https://github.com/tylertreat/comcast)** — a friendly wrapper
  over `tc`/`ipfw` with simple `--latency/--packet-loss/--target-bw` flags;
  still shapes a real interface, so the same root/safety caveats apply.
- Per-container **network namespaces** (`ip netns`) or Docker `--network`
  isolation to keep shaping off the host NIC entirely.

## Results

_Pending execution — not fabricated._

| profile | bitrateKbps | loss% | jitterMs | fps |
|---|---|---|---|---|
| baseline (none) | _pending_ | _pending_ | _pending_ | _pending_ |
| loss 1% | _pending_ | _pending_ | _pending_ | _pending_ |
| loss 3% | _pending_ | _pending_ | _pending_ | _pending_ |
| loss 5% | _pending_ | _pending_ | _pending_ | _pending_ |
| jitter (delay 100ms 20ms normal) | _pending_ | _pending_ | _pending_ | _pending_ |
| rate 1mbit | _pending_ | _pending_ | _pending_ | _pending_ |
