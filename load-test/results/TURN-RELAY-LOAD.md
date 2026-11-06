# TURN / Coturn Relay Load Test

> Authored by Claude (Anthropic), via Claude Code — 2026-08-27.

## Roadmap gap this closes

CrowdStream's media plane is exercised end-to-end by `load-test/sfu-capacity.js`,
but that test lets each client pick its cheapest ICE path — on a LAN that is
almost always a **host** or **server-reflexive** candidate, so the SFU talks to
viewers directly and **Coturn is never touched**.

In production, every client behind a symmetric NAT or a restrictive firewall
(corporate networks, mobile carriers, locked-down Wi-Fi) cannot use those paths
and is forced to **relay all of its media through Coturn**. That relay path is
the single most bandwidth-hungry, most easily saturated hop in the stack and it
is **currently untested**. This harness fills that gap: it pins every viewer to
relay-only transport and ramps load until the Coturn relay ceiling appears.

---

## What it tests

- Stands up one real broadcaster (`Go live`) and ramps **relay-only viewers**
  in batches against it.
- Every viewer's media is forced through the TURN relay (see below), so the
  measured bitrate / loss / fps reflect **the Coturn relay path**, not a direct
  SFU path.
- Per batch it records, across the whole active viewer population:
  - `relayConfirmed` — how many viewers are **provably** on a relay candidate.
  - `meanBitrateKbps` — mean inbound video bitrate (delta of `bytesReceived`).
  - `meanLossPct` — mean video packet loss over the sample window.
  - `meanFps` — mean decoded `framesPerSecond`.
  - `joinP50` / `joinP99` — join latency of the newly-added batch.
  - `failures` — cumulative viewers that never reached `__csJoinedAt`.
- As viewers scale, watch bitrate sag / loss climb / fps drop / joins fail — the
  point where relay throughput stops scaling is the **Coturn relay ceiling**.

---

## How relay is forced (no frontend changes) and how it is VERIFIED

**Forcing.** Before any application script executes, the script injects a shim
via Puppeteer's `page.evaluateOnNewDocument` that subclasses
`window.RTCPeerConnection`. Every time the CrowdStream app constructs a peer
connection, the shim shallow-merges `{ iceTransportPolicy: 'relay' }` into the
config (preserving the app's own `iceServers`). With relay-only policy the
browser discards host and `srflx` candidates and gathers **only TURN (relay)
candidates**, so the viewer↔SFU media path can only complete through Coturn.
No frontend, backend, or TURN config is modified. Each constructed peer
connection is also pushed to `window.__csPCs` for stats.

Only **viewer** pages are relay-forced; the broadcaster is left untouched.

**Verifying (this is the important part — forcing is not the same as proving).**
Setting the policy does not by itself prove a relay was used, so for each viewer
the script reads `pc.getStats()` and:

1. finds the **succeeded** `candidate-pair` (preferring a nominated/selected
   pair, then `transport.selectedCandidatePairId`, then any succeeded pair);
2. looks up the `local-candidate` referenced by that pair's `localCandidateId`;
3. asserts `local.candidateType === 'relay'`.

Only viewers that pass all three count toward `relayConfirmed`. If any active
viewer is not confirmed on the relay path, the run prints a `WARNING` — treat a
run where `relayConfirmed < viewers` as suspect (usually a missing/unreachable
TURN server, so the connection silently fell back or failed).

The inbound video metrics come from each viewer's `inbound-rtp` (video) report:
`bytesReceived` (→ bitrate delta), `packetsReceived` / `packetsLost` (→ loss%),
`jitter`, and `framesPerSecond`.

---

## Prerequisites

- Node.js with `puppeteer` installed (same dependency as `sfu-capacity.js`).
- A running CrowdStream stack (frontend + signaling/SFU) reachable at
  `--baseUrl`.
- **Coturn actually configured and reachable**, and the CrowdStream app's
  `iceServers` must include that TURN server with valid credentials — otherwise
  relay-only connections cannot complete and `relayConfirmed` will be 0.
- A valid CrowdStream login (broadcaster + viewer share the same account).
- Headless Chromium uses fake media devices, so no camera/mic hardware needed.

Credentials are **never hardcoded**. Provide them via flags or environment:

```bash
export CROWDSTREAM_TEST_EMAIL="you@example.com"
export CROWDSTREAM_TEST_PASSWORD="••••••••"
```

---

## How to run

```bash
# env creds
node turn-relay-load.js --baseUrl http://localhost --maxViewers 100

# or inline creds
node turn-relay-load.js \
  --email you@example.com --password '••••••••' \
  --baseUrl http://localhost \
  --batchSize 5 --batchIntervalMs 10000 \
  --maxViewers 100 --statsSettleMs 2000 \
  --out turn-relay-results.csv
```

### Arguments

| Flag                | Default                    | Meaning                                                                 |
| ------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `--baseUrl`         | `http://localhost`         | CrowdStream frontend origin.                                            |
| `--batchSize`       | `5`                        | Viewers added per ramp step.                                            |
| `--batchIntervalMs` | `10000`                    | Wait between batches (ms).                                              |
| `--maxViewers`      | `100`                      | Stop ramping at this many concurrent relay viewers.                     |
| `--statsSettleMs`   | `2000`                     | Gap between the two `getStats()` samples → bitrate/loss delta window.   |
| `--out`             | `turn-relay-results.csv`   | CSV output path (rewritten after every batch).                          |
| `--email`           | `$CROWDSTREAM_TEST_EMAIL`  | Login email (flag overrides env).                                       |
| `--password`        | `$CROWDSTREAM_TEST_PASSWORD` | Login password (flag overrides env).                                  |

CSV columns:
`timestamp,viewers,relayConfirmed,joinP50,joinP99,meanBitrateKbps,meanLossPct,meanFps,failures`

---

## Coturn-side sampling

Browser stats tell you what the *clients* see. To confirm what **Coturn** is
doing, sample the relay server itself in parallel while the test ramps:

- **Live relay allocations (UDP sockets).** Coturn opens a UDP socket per relay
  allocation inside its configured `min-port`/`max-port` range. Count them:

  ```bash
  # if min-port=49152 max-port=65535, watch the count climb with viewers
  ss -u -a | grep -E ':(49[1-9][0-9][0-9][0-9]|5[0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2})' | wc -l
  # simpler: watch total UDP sockets held by the turnserver process
  ss -u -a -p | grep turnserver | wc -l
  ```

- **Prometheus metrics.** Start Coturn with `--prometheus` and scrape
  `http://<coturn-host>:9641/metrics`. Useful series include allocation and
  session gauges and relayed traffic counters, e.g.:

  ```bash
  curl -s http://localhost:9641/metrics | grep -Ei 'turn_(total_allocations|traffic|sessions)'
  ```

- **Coturn logs — allocation counts.** With verbose logging (`--log-file` +
  `--verbose`) Coturn logs each allocation. Tail and count them:

  ```bash
  grep -c 'new (default) allocation' /var/log/turnserver/turnserver.log
  tail -f /var/log/turnserver/turnserver.log | grep -E 'allocation|refreshed|closed'
  ```

- **Manual allocation smoke check.** Independently confirm the TURN server
  actually grants relays with the same credentials the app uses:

  ```bash
  turnutils_uclient -v -u <user> -w <password> -y <coturn-host>
  # -v verbose, -y forces relay of peer-to-peer data through the TURN server
  ```

Line up the Coturn allocation count against the CSV's `relayConfirmed` — they
should track each other closely. A large gap means viewers are not really
relaying (misconfigured `iceServers`, exhausted ports, or auth failures).

---

## Interpreting the ceiling

Read the CSV row-by-row as viewers ramp:

- **Healthy / below ceiling:** `relayConfirmed == viewers`, `meanBitrateKbps`
  holds roughly flat per viewer, `meanLossPct` near zero, `meanFps` at the
  source rate, `failures` flat.
- **Approaching the ceiling:** `meanBitrateKbps` starts sagging and/or
  `meanLossPct` creeps up while `meanFps` dips — Coturn (or its NIC / CPU /
  port range) is running out of relay headroom.
- **At/over the ceiling:** loss climbs sharply, fps collapses, `joinP99`
  balloons, and `failures` begins incrementing. On the Coturn side you'll see
  the allocation count plateau, port-range exhaustion, or a saturated relay NIC.

The **last viewer count where the media metrics stay healthy AND
`relayConfirmed == viewers`** is the practical Coturn relay ceiling for this
hardware/config. Divide the aggregate relay bitrate at that point by the NIC
capacity to see whether you are bottlenecked on bandwidth, CPU, or ports.

---

## Caveats

- **Load generator is co-located.** Dozens of headless Chromium tabs decoding
  relayed video is CPU/RAM heavy; if the client machine saturates first you are
  measuring the *test box*, not Coturn. Watch for that and, ideally, run the
  generator on a separate host from Coturn.
- **`relayConfirmed < viewers` invalidates a row.** It means relay wasn't
  actually achieved for some viewers — fix `iceServers`/TURN reachability before
  trusting the numbers.
- **Bitrate is a two-sample delta** over `--statsSettleMs`; a very small window
  is noisy. Loss% is computed over the same window, not cumulative.
- **Symmetric client.** Only the browser side is pinned to relay; whether the
  full path double-relays depends on the SFU's own ICE config.
- **Fake media.** Chromium's synthetic video may differ from real-camera
  bitrate/complexity, so absolute kbps are indicative, not exact.
- **Single broadcaster, single room.** This isolates the relay fan-out path; it
  does not model many concurrent rooms.

---

## Results

_Pending execution — not fabricated._

| timestamp | viewers | relayConfirmed | joinP50 | joinP99 | meanBitrateKbps | meanLossPct | meanFps | failures |
| --------- | ------- | -------------- | ------- | ------- | --------------- | ----------- | ------- | -------- |
| _tbd_     | _tbd_   | _tbd_          | _tbd_   | _tbd_   | _tbd_           | _tbd_       | _tbd_   | _tbd_    |
