/*
 * media-fanout-capacity.js
 *
 * Purpose:
 *   Measure the REAL media-plane ceiling of the CrowdStream SFU (mediasoup),
 *   not just the signaling / control path. One broadcaster streams fake media;
 *   viewers ramp up in batches. For every viewer we measure join and
 *   first-frame latency AND sample inbound video getStats (bitrate,
 *   packet-loss %, jitter, fps, resolution).
 *
 *   getStats is captured WITHOUT any frontend changes: we use
 *   evaluateOnNewDocument to wrap window.RTCPeerConnection in each headless
 *   tab so every PeerConnection the app constructs is pushed into
 *   window.__csPCs. We then iterate those PCs and read their inbound-rtp
 *   reports directly.
 *
 *   As viewers climb, the ceiling reveals itself as falling bitrate/fps,
 *   rising packet loss, or climbing join / first-frame failures.
 *
 * Authored by Claude (Anthropic), via Claude Code — 2026-08-27.
 */

const puppeteer = require("puppeteer");
const fs = require("fs");

/*
 * ---------------------------------------------------------
 * CLI ARGS
 * ---------------------------------------------------------
 */

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const BASE_URL = arg("baseUrl", "http://localhost");

const BATCH_SIZE = parseInt(arg("batchSize", "5"), 10);
const BATCH_INTERVAL_MS = parseInt(
  arg("batchIntervalMs", "10000"),
  10
);
const MAX_VIEWERS = parseInt(arg("maxViewers", "100"), 10);
const STATS_SETTLE_MS = parseInt(
  arg("statsSettleMs", "2000"),
  10
);

const OUT_CSV = arg("out", "media-fanout-results.csv");

const WAIT_TIMEOUT_MS = 20000;
let failures = 0;

/*
 * Credentials.
 *
 * Read from --email / --password OR the environment. NEVER hardcode
 * credentials in this file.
 */

const TEST_EMAIL = arg("email", process.env.CROWDSTREAM_TEST_EMAIL);
const TEST_PASSWORD = arg(
  "password",
  process.env.CROWDSTREAM_TEST_PASSWORD
);

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error(
    "Missing broadcaster credentials.\n" +
      "Pass --email <e> --password <p>, or set the environment variables\n" +
      "CROWDSTREAM_TEST_EMAIL and CROWDSTREAM_TEST_PASSWORD."
  );
  process.exit(1);
}

const CHROME_FLAGS = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--disable-gpu",
  "--no-sandbox",
  "--mute-audio",
];

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/*
 * ---------------------------------------------------------
 * PERCENTILE / MEAN
 * ---------------------------------------------------------
 */

function percentile(values, p) {
  if (!values.length) return null;

  const index = Math.ceil((p / 100) * values.length) - 1;

  return values[
    Math.min(Math.max(index, 0), values.length - 1)
  ];
}

function mean(values) {
  const clean = values.filter((n) => Number.isFinite(n));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

/*
 * ---------------------------------------------------------
 * LOGIN
 * ---------------------------------------------------------
 */

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

  // SignInPage navigates to /dashboard after successful sign-in.
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
 * getStats HOOK
 *
 * Wrap window.RTCPeerConnection so every PC the app constructs is pushed
 * into window.__csPCs. Installed via evaluateOnNewDocument so it runs before
 * any page script on every navigation of the tab (signin -> dashboard ->
 * viewer). No frontend changes required.
 * ---------------------------------------------------------
 */

async function installPeerConnectionHook(page) {
  await page.evaluateOnNewDocument(() => {
    window.__csPCs = [];

    const Native =
      window.RTCPeerConnection ||
      window.webkitRTCPeerConnection;

    if (!Native) return;

    const Wrapped = new Proxy(Native, {
      construct(target, args) {
        const pc = new target(...args);
        try {
          window.__csPCs.push(pc);
        } catch (e) {}
        return pc;
      },
    });

    window.RTCPeerConnection = Wrapped;
    window.webkitRTCPeerConnection = Wrapped;
  });
}

/*
 * Take one snapshot of inbound-rtp (video + audio) across every PC in the
 * tab. Returns { ts, reports } where ts is the in-page wall clock so bitrate
 * deltas are measured against the moment the sample was actually read.
 */

async function sampleInboundRtp(page) {
  return await page.evaluate(async () => {
    const pcs = window.__csPCs || [];
    const reports = [];

    for (const pc of pcs) {
      let stats;
      try {
        stats = await pc.getStats();
      } catch (e) {
        continue;
      }

      stats.forEach((report) => {
        if (
          report.type === "inbound-rtp" &&
          (report.kind === "video" ||
            report.kind === "audio")
        ) {
          reports.push({
            kind: report.kind,
            bytesReceived: report.bytesReceived || 0,
            packetsReceived: report.packetsReceived || 0,
            packetsLost: report.packetsLost || 0,
            jitter: report.jitter || 0,
            framesPerSecond: report.framesPerSecond || 0,
            frameWidth: report.frameWidth || 0,
            frameHeight: report.frameHeight || 0,
          });
        }
      });
    }

    return { ts: Date.now(), reports };
  });
}

/*
 * Two samples, STATS_SETTLE_MS apart, reduced to per-viewer video metrics.
 * bitrateKbps is the delta of bytesReceived across the two samples;
 * lossPct = packetsLost / (packetsLost + packetsReceived).
 */

async function measureVideoStats(page) {
  const empty = {
    bitrateKbps: null,
    lossPct: null,
    fps: null,
    frameWidth: null,
    frameHeight: null,
  };

  let sample1;
  try {
    sample1 = await sampleInboundRtp(page);
  } catch (e) {
    return empty;
  }

  await sleep(STATS_SETTLE_MS);

  let sample2;
  try {
    sample2 = await sampleInboundRtp(page);
  } catch (e) {
    return empty;
  }

  const video1 = sample1.reports.filter(
    (r) => r.kind === "video"
  );
  const video2 = sample2.reports.filter(
    (r) => r.kind === "video"
  );

  if (!video2.length) return empty;

  const bytes1 = video1.reduce(
    (a, r) => a + r.bytesReceived,
    0
  );
  const bytes2 = video2.reduce(
    (a, r) => a + r.bytesReceived,
    0
  );

  const deltaMs = sample2.ts - sample1.ts;

  // bytes * 8 = bits; bits / ms == kbits / s == kbps.
  const bitrateKbps =
    deltaMs > 0
      ? ((bytes2 - bytes1) * 8) / deltaMs
      : null;

  const packetsLost = video2.reduce(
    (a, r) => a + r.packetsLost,
    0
  );
  const packetsReceived = video2.reduce(
    (a, r) => a + r.packetsReceived,
    0
  );

  const lossDenom = packetsLost + packetsReceived;
  const lossPct =
    lossDenom > 0
      ? (packetsLost / lossDenom) * 100
      : null;

  const fps =
    video2.reduce(
      (a, r) => a + (r.framesPerSecond || 0),
      0
    ) / video2.length;

  // Largest reported frame wins as the "resolution" for this viewer.
  const main = video2
    .slice()
    .sort(
      (a, b) =>
        b.frameWidth * b.frameHeight -
        a.frameWidth * a.frameHeight
    )[0];

  return {
    bitrateKbps,
    lossPct,
    fps: Number.isFinite(fps) ? fps : null,
    frameWidth: main ? main.frameWidth : null,
    frameHeight: main ? main.frameHeight : null,
  };
}

/*
 * ---------------------------------------------------------
 * BROADCASTER
 * ---------------------------------------------------------
 */

async function launchBroadcaster(browser) {
  const context = browser.defaultBrowserContext();

  await context.overridePermissions(BASE_URL, [
    "camera",
    "microphone",
  ]);

  const page = await browser.newPage();

  page.on("pageerror", (error) => {
    console.error(
      `[BROADCASTER PAGE ERROR] ${error.message}`
    );
  });

  await login(page);

  console.log(
    `Opening broadcaster: ${BASE_URL}/broadcaster`
  );

  await page.goto(`${BASE_URL}/broadcaster`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  /*
   * Make sure the "Go live" button actually exists.
   */

  await page.waitForFunction(
    () =>
      Array.from(
        document.querySelectorAll("button")
      ).some((button) =>
        button.textContent?.includes("Go live")
      ),
    { timeout: WAIT_TIMEOUT_MS }
  );

  console.log('"Go live" button found.');

  /*
   * Click "Go live".
   */

  await page.evaluate(() => {
    const button = Array.from(
      document.querySelectorAll("button")
    ).find((button) =>
      button.textContent?.includes("Go live")
    );

    if (!button) {
      throw new Error("Go live button disappeared");
    }

    button.click();
  });

  console.log('Clicked "Go live".');

  /*
   * BroadcasterPage sets window.__csRoomId after createRoom() succeeds,
   * then window.__csLiveAt once media is flowing.
   */

  await page.waitForFunction(
    () => Boolean(window.__csRoomId),
    { timeout: WAIT_TIMEOUT_MS }
  );

  const roomId = await page.evaluate(
    () => window.__csRoomId
  );

  console.log(`ROOM CREATED. Room ID: ${roomId}`);

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
 * VIEWER
 * ---------------------------------------------------------
 */

async function launchViewer(browser, roomId, index) {
  const page = await browser.newPage();

  page.on("pageerror", (error) => {
    console.error(
      `[VIEWER ${index} PAGE ERROR] ${error.message}`
    );
  });

  // Hook must be installed BEFORE any navigation so it captures the
  // consumer PeerConnection the viewer page builds.
  await installPeerConnectionHook(page);

  await login(page);

  const startTime = Date.now();

  try {
    await page.goto(
      `${BASE_URL}/viewer?roomId=${roomId}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }
    );

    await page.waitForSelector("form", {
      timeout: WAIT_TIMEOUT_MS,
    });

    /*
     * Submit the viewer form.
     */

    await page.$eval("form", (form) => {
      form.requestSubmit();
    });

    /*
     * Wait for the ViewerPage join marker.
     */

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

    /*
     * Wait for the actual first video frame.
     */

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

    /*
     * Sample inbound video getStats under the CURRENT load.
     */

    const stats = await measureVideoStats(page);

    return {
      index,
      page,

      joined: Boolean(joinedAt),

      joinLatencyMs: joinedAt
        ? joinedAt - startTime
        : null,

      firstFrameLatencyMs: firstFrameAt
        ? firstFrameAt - startTime
        : null,

      bitrateKbps: stats.bitrateKbps,
      lossPct: stats.lossPct,
      fps: stats.fps,
      frameWidth: stats.frameWidth,
      frameHeight: stats.frameHeight,

      error: null,
    };
  } catch (error) {
    return {
      index,
      page,

      joined: false,

      joinLatencyMs: null,
      firstFrameLatencyMs: null,

      bitrateKbps: null,
      lossPct: null,
      fps: null,
      frameWidth: null,
      frameHeight: null,

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
  console.log(
    "========================================"
  );
  console.log("CrowdStream MEDIA-FANOUT CAPACITY TEST");
  console.log(
    "========================================"
  );
  console.log(`Frontend:       ${BASE_URL}`);
  console.log(`Batch size:     ${BATCH_SIZE}`);
  console.log(`Batch interval: ${BATCH_INTERVAL_MS}ms`);
  console.log(`Max viewers:    ${MAX_VIEWERS}`);
  console.log(`Stats settle:   ${STATS_SETTLE_MS}ms`);
  console.log("");

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000,
    args: CHROME_FLAGS,
  });

  try {
    /*
     * STEP 1: create a REAL broadcaster.
     */

    const broadcaster = await launchBroadcaster(browser);
    const roomId = broadcaster.roomId;

    /*
     * Give mediasoup a moment to stabilize.
     */

    console.log("\nWaiting 5 seconds for media...");
    await sleep(5000);

    /*
     * CSV.
     */

    const csvRows = [
      [
        "timestamp",
        "viewers",
        "joinP50",
        "joinP99",
        "firstFrameP50",
        "firstFrameP99",
        "meanBitrateKbps",
        "meanLossPct",
        "meanFps",
        "failures",
      ].join(","),
    ];

    const viewers = [];

    /*
     * STEP 2: add viewers in batches.
     */

    for (
      let target = BATCH_SIZE;
      target <= MAX_VIEWERS;
      target += BATCH_SIZE
    ) {
      console.log(
        `\n========================================`
      );
      console.log(`ADDING VIEWERS: ${target}`);
      console.log(
        `========================================`
      );

      const batch = await Promise.all(
        Array.from({ length: BATCH_SIZE }, (_, index) =>
          launchViewer(
            browser,
            roomId,
            viewers.length + index
          )
        )
      );

      viewers.push(...batch);

      /*
       * Join latency.
       */

      const joinLatencies = batch
        .map((viewer) => viewer.joinLatencyMs)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

      /*
       * First frame latency.
       */

      const firstFrameLatencies = batch
        .map((viewer) => viewer.firstFrameLatencyMs)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

      /*
       * Media-plane means for this batch.
       */

      const meanBitrate = mean(
        batch.map((viewer) => viewer.bitrateKbps)
      );
      const meanLoss = mean(
        batch.map((viewer) => viewer.lossPct)
      );
      const meanFps = mean(
        batch.map((viewer) => viewer.fps)
      );

      const failed = batch.filter(
        (viewer) => !viewer.joined
      ).length;

      failures += failed;

      const joinP50 = percentile(joinLatencies, 50);
      const joinP99 = percentile(joinLatencies, 99);
      const frameP50 = percentile(
        firstFrameLatencies,
        50
      );
      const frameP99 = percentile(
        firstFrameLatencies,
        99
      );

      console.log(`\nViewers: ${viewers.length}`);
      console.log(`Join P50: ${joinP50 ?? "n/a"} ms`);
      console.log(`Join P99: ${joinP99 ?? "n/a"} ms`);
      console.log(
        `First frame P50: ${frameP50 ?? "n/a"} ms`
      );
      console.log(
        `First frame P99: ${frameP99 ?? "n/a"} ms`
      );
      console.log(
        `Mean bitrate: ${
          meanBitrate != null
            ? meanBitrate.toFixed(1)
            : "n/a"
        } kbps`
      );
      console.log(
        `Mean loss: ${
          meanLoss != null
            ? meanLoss.toFixed(2)
            : "n/a"
        } %`
      );
      console.log(
        `Mean fps: ${
          meanFps != null ? meanFps.toFixed(1) : "n/a"
        }`
      );
      console.log(`Failures: ${failures}`);

      /*
       * Save results after every batch.
       */

      csvRows.push(
        [
          new Date().toISOString(),
          viewers.length,
          joinP50 ?? "n/a",
          joinP99 ?? "n/a",
          frameP50 ?? "n/a",
          frameP99 ?? "n/a",
          meanBitrate != null
            ? meanBitrate.toFixed(1)
            : "n/a",
          meanLoss != null
            ? meanLoss.toFixed(2)
            : "n/a",
          meanFps != null
            ? meanFps.toFixed(1)
            : "n/a",
          failures,
        ].join(",")
      );

      fs.writeFileSync(OUT_CSV, csvRows.join("\n"));

      /*
       * Wait before next batch.
       */

      if (target < MAX_VIEWERS) {
        console.log(
          `\nWaiting ${
            BATCH_INTERVAL_MS / 1000
          } seconds...`
        );
        await sleep(BATCH_INTERVAL_MS);
      }
    }

    console.log(
      `\n========================================`
    );
    console.log("MEDIA-FANOUT TEST COMPLETE");
    console.log(`Results: ${OUT_CSV}`);
    console.log(
      `========================================`
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("\nTEST FAILED:");
  console.error(error);
  process.exit(1);
});
