/*
 * turn-relay-load.js
 * ---------------------------------------------------------
 * CrowdStream (WebRTC) — Coturn / TURN relay capacity load test.
 *
 * Ramps viewers in batches against a single live broadcaster, but
 * FORCES every viewer's media through the TURN relay path
 * (iceTransportPolicy: 'relay') and then PROVES the relay is actually
 * being used by inspecting getStats() candidate types. It records the
 * confirmed-relay count plus relay bitrate / loss / fps per batch so
 * the Coturn relay ceiling becomes visible as viewers scale up.
 *
 * Style mirrors load-test/sfu-capacity.js (arg(), percentile(),
 * fake-media Chrome flags, batched CSV, verbose console).
 *
 * NOTE: credentials are NEVER hardcoded — pass --email/--password or
 * set CROWDSTREAM_TEST_EMAIL / CROWDSTREAM_TEST_PASSWORD.
 *
 * > Authored by Claude (Anthropic), via Claude Code — 2026-08-27.
 * ---------------------------------------------------------
 */

const puppeteer = require("puppeteer");
const fs = require("fs");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const BASE_URL = arg("baseUrl", "http://localhost");

/*
 * Credentials: CLI flags win, then environment. Never hardcoded.
 */
const TEST_EMAIL = arg("email", process.env.CROWDSTREAM_TEST_EMAIL);
const TEST_PASSWORD = arg(
  "password",
  process.env.CROWDSTREAM_TEST_PASSWORD
);

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error(
    "Missing credentials. Pass --email <e> --password <p> " +
      "or set CROWDSTREAM_TEST_EMAIL / CROWDSTREAM_TEST_PASSWORD."
  );
  process.exit(1);
}

const BATCH_SIZE = parseInt(arg("batchSize", "5"), 10);
const BATCH_INTERVAL_MS = parseInt(
  arg("batchIntervalMs", "10000"),
  10
);
const MAX_VIEWERS = parseInt(arg("maxViewers", "100"), 10);

/*
 * How long we let media flow between the two getStats() samples that
 * yield the bitrate / loss deltas. Also acts as the settle window so
 * inbound-rtp counters are non-zero before we measure.
 */
const STATS_SETTLE_MS = parseInt(arg("statsSettleMs", "2000"), 10);

const OUT_CSV = arg("out", "turn-relay-results.csv");

const WAIT_TIMEOUT_MS = 20000;
let failures = 0;

const CHROME_FLAGS = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--disable-gpu",
  "--no-sandbox",
  "--mute-audio",
];

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, p) {
  if (!values.length) return null;

  const index = Math.ceil((p / 100) * values.length) - 1;

  return values[
    Math.min(Math.max(index, 0), values.length - 1)
  ];
}

function mean(values) {
  if (!values.length) return null;
  return (
    values.reduce((sum, v) => sum + v, 0) / values.length
  );
}

function fmt(value, digits) {
  return value === null || value === undefined
    ? "n/a"
    : value.toFixed(digits);
}

/*
 * ---------------------------------------------------------
 * RELAY FORCING (no frontend changes)
 * ---------------------------------------------------------
 *
 * Injected via evaluateOnNewDocument BEFORE any app script runs, so
 * the app's own `new RTCPeerConnection(config)` transparently gets
 * `iceTransportPolicy: 'relay'` merged into its config. Because relay
 * is the ONLY allowed transport policy, the browser will discard host
 * / srflx candidates and only gather TURN (relay) candidates — every
 * viewer<->SFU media path is pinned to Coturn.
 *
 * Each constructed PC is pushed to window.__csPCs so we can later call
 * getStats() on it to (a) confirm the selected local candidate really
 * is a 'relay' candidate and (b) read inbound-rtp video counters.
 */
async function installRelayForcing(page) {
  await page.evaluateOnNewDocument(() => {
    window.__csPCs = [];

    const Native = window.RTCPeerConnection;
    if (!Native) return;

    class RelayForcedPeerConnection extends Native {
      constructor(config, ...rest) {
        // Shallow-merge so existing iceServers etc. are preserved,
        // then hard-override the transport policy to relay-only.
        const merged = Object.assign({}, config, {
          iceTransportPolicy: "relay",
        });

        super(merged, ...rest);

        try {
          window.__csPCs.push(this);
        } catch (e) {
          // window.__csPCs may not exist across a same-page nav race;
          // recreate defensively.
          window.__csPCs = [this];
        }
      }
    }

    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      writable: true,
      value: RelayForcedPeerConnection,
    });

    if (window.webkitRTCPeerConnection) {
      window.webkitRTCPeerConnection = RelayForcedPeerConnection;
    }
  });
}

/*
 * Runs inside the viewer page. Aggregates video inbound-rtp counters
 * across every relay-forced PC and, crucially, PROVES relay use:
 *   succeeded candidate-pair -> its local-candidate -> candidateType.
 */
async function collectViewerStats(page) {
  return await page.evaluate(async () => {
    const pcs = window.__csPCs || [];

    const out = {
      hasPc: pcs.length > 0,
      sawInbound: false,
      relayConfirmed: false,
      bytesReceived: 0,
      packetsReceived: 0,
      packetsLost: 0,
      framesPerSecond: null,
      jitter: null,
      tsMs: null,
    };

    for (const pc of pcs) {
      let report;
      try {
        report = await pc.getStats();
      } catch (e) {
        continue;
      }

      /*
       * Find the active candidate-pair. Prefer a nominated/selected
       * succeeded pair, then transport.selectedCandidatePairId, then
       * any succeeded pair as a last resort.
       */
      let pair = null;

      report.forEach((s) => {
        if (
          s.type === "candidate-pair" &&
          s.state === "succeeded" &&
          (s.nominated || s.selected)
        ) {
          pair = s;
        }
      });

      if (!pair) {
        let selectedId = null;
        report.forEach((s) => {
          if (
            s.type === "transport" &&
            s.selectedCandidatePairId
          ) {
            selectedId = s.selectedCandidatePairId;
          }
        });
        if (selectedId) pair = report.get(selectedId);
      }

      if (!pair) {
        report.forEach((s) => {
          if (
            !pair &&
            s.type === "candidate-pair" &&
            s.state === "succeeded"
          ) {
            pair = s;
          }
        });
      }

      if (pair && pair.localCandidateId) {
        const local = report.get(pair.localCandidateId);
        if (local && local.candidateType === "relay") {
          out.relayConfirmed = true;
        }
      }

      /*
       * Video inbound-rtp counters (cumulative — deltas taken in Node).
       */
      report.forEach((s) => {
        if (
          s.type === "inbound-rtp" &&
          (s.kind === "video" || s.mediaType === "video")
        ) {
          out.sawInbound = true;

          if (typeof s.bytesReceived === "number") {
            out.bytesReceived += s.bytesReceived;
          }
          if (typeof s.packetsReceived === "number") {
            out.packetsReceived += s.packetsReceived;
          }
          if (typeof s.packetsLost === "number") {
            out.packetsLost += s.packetsLost;
          }
          if (typeof s.framesPerSecond === "number") {
            out.framesPerSecond = s.framesPerSecond;
          }
          if (typeof s.jitter === "number") {
            out.jitter = s.jitter;
          }
          if (typeof s.timestamp === "number") {
            out.tsMs = s.timestamp;
          }
        }
      });
    }

    return out;
  });
}

async function safeStats(viewer) {
  if (!viewer || !viewer.joined || !viewer.page) return null;
  try {
    return await collectViewerStats(viewer.page);
  } catch (e) {
    return null;
  }
}

async function login(page) {
  await page.goto(`${BASE_URL}/signin`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await page.waitForSelector("#email", {
    timeout: WAIT_TIMEOUT_MS,
  });

  await page.type("#email", TEST_EMAIL);
  await page.type("#password", TEST_PASSWORD);

  await page.click('button[type="submit"]');

  await page.waitForFunction(
    () => window.location.pathname === "/dashboard",
    { timeout: WAIT_TIMEOUT_MS }
  );

  await page.waitForFunction(
    () =>
      window.__csSocket &&
      window.__csSocket.connected === true,
    { timeout: WAIT_TIMEOUT_MS }
  );
}

/*
 * ---------------------------------------------------------
 * BROADCASTER (NOT relay-forced — only viewers relay)
 * ---------------------------------------------------------
 */
async function launchBroadcaster(browser) {
  const page = await browser.newPage();

  page.on("console", (msg) => {
    console.log(`[BROADCASTER ${msg.type()}] ${msg.text()}`);
  });

  page.on("pageerror", (error) => {
    console.error(`[BROADCASTER PAGE ERROR] ${error.message}`);
  });

  await login(page);

  console.log(`Opening broadcaster: ${BASE_URL}/broadcaster`);

  await page.goto(`${BASE_URL}/broadcaster`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some(
        (button) => button.textContent?.includes("Go live")
      ),
    { timeout: WAIT_TIMEOUT_MS }
  );

  await page.evaluate(() => {
    const button = Array.from(
      document.querySelectorAll("button")
    ).find((b) => b.textContent?.includes("Go live"));

    if (!button) {
      throw new Error("Go live button disappeared");
    }

    button.click();
  });

  console.log('Clicked "Go live".');

  await page.waitForFunction(
    () => Boolean(window.__csRoomId),
    { timeout: WAIT_TIMEOUT_MS }
  );

  const roomId = await page.evaluate(() => window.__csRoomId);

  console.log(`Room created: ${roomId}`);

  try {
    await page.waitForFunction(
      () => Boolean(window.__csLiveAt),
      { timeout: WAIT_TIMEOUT_MS }
    );
    console.log("Broadcaster is LIVE.");
  } catch {
    console.warn(
      "Room exists, but __csLiveAt was not detected."
    );
  }

  return { page, roomId };
}

/*
 * ---------------------------------------------------------
 * VIEWER (relay-forced)
 * ---------------------------------------------------------
 */
async function launchViewer(browser, roomId, index) {
  const page = await browser.newPage();

  // MUST run before any navigation so the app's PC is relay-forced.
  await installRelayForcing(page);

  page.on("pageerror", (error) => {
    console.error(
      `[VIEWER ${index} PAGE ERROR] ${error.message}`
    );
  });

  page.on("requestfailed", (request) => {
    console.error(
      `[VIEWER ${index} REQUEST FAILED] ${request.url()}`
    );
  });

  await login(page);

  const startTime = Date.now();

  try {
    await page.goto(`${BASE_URL}/viewer?roomId=${roomId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForSelector("form", {
      timeout: WAIT_TIMEOUT_MS,
    });

    await page.$eval("form", (form) => {
      form.requestSubmit();
    });

    let joinedAt = null;
    try {
      await page.waitForFunction(
        () => Boolean(window.__csJoinedAt),
        { timeout: WAIT_TIMEOUT_MS }
      );
      joinedAt = await page.evaluate(
        () => window.__csJoinedAt
      );
    } catch {}

    let firstFrameAt = null;
    try {
      await page.waitForFunction(
        () => Boolean(window.__csFirstFrameAt),
        { timeout: WAIT_TIMEOUT_MS }
      );
      firstFrameAt = await page.evaluate(
        () => window.__csFirstFrameAt
      );
    } catch {}

    return {
      index,
      page,
      joined: Boolean(joinedAt),
      joinLatencyMs: joinedAt ? joinedAt - startTime : null,
      firstFrameLatencyMs: firstFrameAt
        ? firstFrameAt - startTime
        : null,
      error: null,
    };
  } catch (error) {
    return {
      index,
      page,
      joined: false,
      joinLatencyMs: null,
      firstFrameLatencyMs: null,
      error: error.message,
    };
  }
}

/*
 * ---------------------------------------------------------
 * MAIN
 * ---------------------------------------------------------
 */
async function main() {
  console.log("========================================");
  console.log("CrowdStream TURN / Coturn RELAY LOAD TEST");
  console.log("========================================");
  console.log(`Frontend:        ${BASE_URL}`);
  console.log(`Batch size:      ${BATCH_SIZE}`);
  console.log(`Batch interval:  ${BATCH_INTERVAL_MS}ms`);
  console.log(`Max viewers:     ${MAX_VIEWERS}`);
  console.log(`Stats window:    ${STATS_SETTLE_MS}ms`);
  console.log(`Transport:       relay-only (forced via iceTransportPolicy)`);
  console.log("");

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000,
    args: CHROME_FLAGS,
  });

  // Auto-grant camera/mic across all pages in the default context.
  await browser
    .defaultBrowserContext()
    .overridePermissions(BASE_URL, ["camera", "microphone"]);

  try {
    const broadcaster = await launchBroadcaster(browser);
    const roomId = broadcaster.roomId;

    console.log("\nWaiting 5 seconds for media to stabilize...");
    await sleep(5000);

    const csvRows = [
      [
        "timestamp",
        "viewers",
        "relayConfirmed",
        "joinP50",
        "joinP99",
        "meanBitrateKbps",
        "meanLossPct",
        "meanFps",
        "failures",
      ].join(","),
    ];

    const viewers = [];

    for (
      let target = BATCH_SIZE;
      target <= MAX_VIEWERS;
      target += BATCH_SIZE
    ) {
      console.log("\n========================================");
      console.log(`RAMPING TO ${target} RELAY VIEWERS`);
      console.log("========================================");

      const batch = await Promise.all(
        Array.from({ length: BATCH_SIZE }, (_, i) =>
          launchViewer(browser, roomId, viewers.length + i)
        )
      );

      viewers.push(...batch);

      /*
       * Join latency percentiles are computed from THIS batch only —
       * they describe how newly-arriving relay viewers fared.
       */
      const joinLatencies = batch
        .map((v) => v.joinLatencyMs)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

      const failed = batch.filter((v) => !v.joined).length;
      failures += failed;

      const joinP50 = percentile(joinLatencies, 50);
      const joinP99 = percentile(joinLatencies, 99);

      /*
       * Media health + relay confirmation are sampled across the WHOLE
       * active population, because that is the real load on Coturn at
       * this ramp level. Two samples STATS_SETTLE_MS apart give us the
       * bytes/packets deltas needed for bitrate and loss.
       */
      const sample1 = await Promise.all(
        viewers.map((v) => safeStats(v))
      );

      await sleep(STATS_SETTLE_MS);

      const sample2 = await Promise.all(
        viewers.map((v) => safeStats(v))
      );

      const bitrates = [];
      const losses = [];
      const fpsList = [];
      let relayConfirmed = 0;

      for (let i = 0; i < viewers.length; i++) {
        const a = sample1[i];
        const b = sample2[i];
        if (!a || !b) continue;

        if (b.relayConfirmed) relayConfirmed++;

        if (a.sawInbound && b.sawInbound) {
          const dtMs =
            a.tsMs && b.tsMs ? b.tsMs - a.tsMs : STATS_SETTLE_MS;

          const dBytes = b.bytesReceived - a.bytesReceived;
          if (dtMs > 0 && dBytes >= 0) {
            // bits / ms === kbits / s
            bitrates.push((dBytes * 8) / dtMs);
          }

          const dRecv =
            b.packetsReceived - a.packetsReceived;
          const dLost = b.packetsLost - a.packetsLost;
          const denom = dRecv + dLost;
          if (denom > 0 && dLost >= 0) {
            losses.push((dLost / denom) * 100);
          }

          if (typeof b.framesPerSecond === "number") {
            fpsList.push(b.framesPerSecond);
          }
        }
      }

      const meanBitrateKbps = mean(bitrates);
      const meanLossPct = mean(losses);
      const meanFps = mean(fpsList);

      console.log(`\nActive viewers:   ${viewers.length}`);
      console.log(
        `Relay confirmed:  ${relayConfirmed}/${viewers.length}`
      );
      console.log(`Join P50:         ${joinP50 ?? "n/a"} ms`);
      console.log(`Join P99:         ${joinP99 ?? "n/a"} ms`);
      console.log(
        `Mean bitrate:     ${fmt(meanBitrateKbps, 1)} kbps`
      );
      console.log(
        `Mean loss:        ${fmt(meanLossPct, 2)} %`
      );
      console.log(`Mean fps:         ${fmt(meanFps, 1)}`);
      console.log(`Failures (total): ${failures}`);

      if (relayConfirmed < viewers.length) {
        console.warn(
          `WARNING: ${
            viewers.length - relayConfirmed
          } viewer(s) not confirmed on the relay path ` +
            "(no succeeded relay candidate-pair yet)."
        );
      }

      csvRows.push(
        [
          new Date().toISOString(),
          viewers.length,
          relayConfirmed,
          joinP50 ?? "n/a",
          joinP99 ?? "n/a",
          fmt(meanBitrateKbps, 1),
          fmt(meanLossPct, 2),
          fmt(meanFps, 1),
          failures,
        ].join(",")
      );

      fs.writeFileSync(OUT_CSV, csvRows.join("\n"));

      if (target < MAX_VIEWERS) {
        console.log(
          `\nWaiting ${BATCH_INTERVAL_MS / 1000}s before next batch...`
        );
        await sleep(BATCH_INTERVAL_MS);
      }
    }

    console.log("\n========================================");
    console.log("TURN RELAY LOAD TEST COMPLETE");
    console.log(`Results: ${OUT_CSV}`);
    console.log("========================================");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("\nTEST FAILED:");
  console.error(error);
  process.exit(1);
});
