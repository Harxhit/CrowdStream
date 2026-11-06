/*
 * ---------------------------------------------------------
 * CrowdStream - WebRTC media impairment measurer
 * ---------------------------------------------------------
 *
 * Launches N puppeteer viewers into an EXISTING LIVE room, hooks
 * RTCPeerConnection.getStats(), samples the inbound-rtp video stats
 * every ~1s for --durationMs, and prints exactly ONE line of JSON to
 * stdout:
 *
 *   {"meanBitrateKbps":..,"lossPct":..,"jitterMs":..,"meanFps":..,"samples":..}
 *
 * Every diagnostic/progress message is written to stderr so the final
 * (and only) stdout line stays pure JSON. media-impairment.sh applies
 * tc/netem shaping around each run and captures that JSON line to build
 * a per-profile comparison table.
 *
 * Style intentionally mirrors load-test/sfu-capacity.js (arg(), the
 * login() flow, CHROME_FLAGS, percentile()).
 *
 * > Authored by Claude (Anthropic), via Claude Code - 2026-08-27.
 * ---------------------------------------------------------
 */

const puppeteer = require("puppeteer");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const BASE_URL = arg("baseUrl", "http://localhost");
const ROOM_ID = arg("roomId", null);
const DURATION_MS = parseInt(arg("durationMs", "15000"), 10);
const VIEWERS = parseInt(arg("viewers", "1"), 10);

// Credentials: explicit flags win, otherwise env. NEVER hardcoded.
const TEST_EMAIL = arg("email", process.env.CROWDSTREAM_TEST_EMAIL);
const TEST_PASSWORD = arg("password", process.env.CROWDSTREAM_TEST_PASSWORD);

const WAIT_TIMEOUT_MS = 20000;

if (!ROOM_ID) {
  console.error("Missing --roomId <existing LIVE room id>");
  process.exit(1);
}

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error(
    "Missing credentials. Pass --email/--password or set " +
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mean(values) {
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

// Kept to mirror sfu-capacity.js; used only for a stderr diagnostic.
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function round(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return null;
  return Math.round(x * 100) / 100;
}

async function login(page) {
  console.error("Opening signin page...");

  await page.goto(`${BASE_URL}/signin`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await page.waitForSelector("#email", { timeout: WAIT_TIMEOUT_MS });

  await page.type("#email", TEST_EMAIL);
  await page.type("#password", TEST_PASSWORD);

  await page.click('button[type="submit"]');

  // SignInPage navigates to /dashboard after a successful sign-in.
  await page.waitForFunction(
    () => window.location.pathname === "/dashboard",
    { timeout: WAIT_TIMEOUT_MS }
  );

  await page.waitForFunction(
    () => window.__csSocket && window.__csSocket.connected === true,
    { timeout: WAIT_TIMEOUT_MS }
  );

  console.error("Login + socket connected.");
}

/*
 * Wrap window.RTCPeerConnection BEFORE any page script runs (via
 * evaluateOnNewDocument) so every PeerConnection the viewer creates is
 * captured into window.__csPCs. A Proxy preserves the prototype, static
 * methods and instanceof semantics of the native class.
 */
async function installStatsHook(page) {
  await page.evaluateOnNewDocument(() => {
    window.__csPCs = [];
    const Native = window.RTCPeerConnection;
    if (!Native) return;

    window.RTCPeerConnection = new Proxy(Native, {
      construct(target, args) {
        const pc = new target(...args);
        try {
          window.__csPCs.push(pc);
        } catch (e) {
          /* ignore */
        }
        return pc;
      },
    });

    if (window.webkitRTCPeerConnection) {
      window.webkitRTCPeerConnection = window.RTCPeerConnection;
    }
  });
}

async function launchViewer(browser, index) {
  const page = await browser.newPage();

  page.on("pageerror", (error) => {
    console.error(`[VIEWER ${index} PAGE ERROR] ${error.message}`);
  });

  // Hook must be installed before login() navigates.
  await installStatsHook(page);
  await login(page);

  console.error(`[VIEWER ${index}] joining room ${ROOM_ID}...`);

  await page.goto(`${BASE_URL}/viewer?roomId=${ROOM_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await page.waitForSelector("form", { timeout: WAIT_TIMEOUT_MS });
  await page.$eval("form", (form) => form.requestSubmit());

  try {
    await page.waitForFunction(() => Boolean(window.__csJoinedAt), {
      timeout: WAIT_TIMEOUT_MS,
    });
  } catch (e) {
    console.error(`[VIEWER ${index}] __csJoinedAt not detected.`);
  }

  try {
    await page.waitForFunction(() => Boolean(window.__csFirstFrameAt), {
      timeout: WAIT_TIMEOUT_MS,
    });
    console.error(`[VIEWER ${index}] first frame received.`);
  } catch (e) {
    console.error(`[VIEWER ${index}] __csFirstFrameAt not detected.`);
  }

  return page;
}

/*
 * Snapshot inbound-rtp video stats across every viewer page's captured
 * PeerConnections. getStats() runs in the browser context so it can
 * reach the live PC objects; we return plain data to Node.
 */
async function sampleViewers(pages) {
  const all = [];

  for (const page of pages) {
    let reports;
    try {
      reports = await page.evaluate(async () => {
        const out = [];
        const pcs = window.__csPCs || [];

        for (const pc of pcs) {
          let stats;
          try {
            stats = await pc.getStats();
          } catch (e) {
            continue;
          }

          stats.forEach((report) => {
            const isVideo =
              report.kind === "video" || report.mediaType === "video";

            if (report.type === "inbound-rtp" && isVideo) {
              out.push({
                id: report.id,
                bytesReceived: report.bytesReceived || 0,
                packetsReceived: report.packetsReceived || 0,
                packetsLost: report.packetsLost || 0,
                jitter:
                  typeof report.jitter === "number" ? report.jitter : null,
                framesPerSecond:
                  typeof report.framesPerSecond === "number"
                    ? report.framesPerSecond
                    : null,
                frameWidth: report.frameWidth || null,
                frameHeight: report.frameHeight || null,
              });
            }
          });
        }

        return out;
      });
    } catch (e) {
      reports = [];
    }

    all.push(...reports);
  }

  return all;
}

async function main() {
  console.error("========================================");
  console.error("CrowdStream MEDIA IMPAIRMENT MEASURER");
  console.error("========================================");
  console.error(`Base URL:  ${BASE_URL}`);
  console.error(`Room ID:   ${ROOM_ID}`);
  console.error(`Viewers:   ${VIEWERS}`);
  console.error(`Duration:  ${DURATION_MS}ms`);

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000,
    args: CHROME_FLAGS,
  });

  try {
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(BASE_URL, ["camera", "microphone"]);

    const pages = [];
    for (let i = 0; i < VIEWERS; i++) {
      pages.push(await launchViewer(browser, i));
    }

    // Give mediasoup / the decoder a moment to stabilize before sampling.
    await sleep(2000);

    const startedAt = Date.now();

    let prevSumBytes = null;
    let prevT = null;

    const bitrates = [];
    const jitters = [];
    const fpsVals = [];
    const widths = [];
    const heights = [];

    // RTP counters are cumulative; the last sample holds the run totals.
    let lastTotals = { received: 0, lost: 0 };
    let samples = 0;

    while (Date.now() - startedAt < DURATION_MS) {
      const reports = await sampleViewers(pages);
      const now = Date.now();

      const sumBytes = reports.reduce((a, r) => a + r.bytesReceived, 0);
      const sumReceived = reports.reduce((a, r) => a + r.packetsReceived, 0);
      const sumLost = reports.reduce((a, r) => a + r.packetsLost, 0);

      for (const r of reports) {
        if (r.jitter !== null) jitters.push(r.jitter * 1000); // s -> ms
        if (r.framesPerSecond !== null && r.framesPerSecond > 0) {
          fpsVals.push(r.framesPerSecond);
        }
        if (r.frameWidth) widths.push(r.frameWidth);
        if (r.frameHeight) heights.push(r.frameHeight);
      }

      // Aggregate bitrate from the byte delta over wall-clock time.
      if (prevSumBytes !== null && now > prevT) {
        const dtSec = (now - prevT) / 1000;
        const kbps = ((sumBytes - prevSumBytes) * 8) / dtSec / 1000;
        if (kbps >= 0) bitrates.push(kbps);
      }

      prevSumBytes = sumBytes;
      prevT = now;
      lastTotals = { received: sumReceived, lost: sumLost };
      samples++;

      await sleep(1000);
    }

    const denom = lastTotals.received + lastTotals.lost;
    const lossPct = denom > 0 ? (lastTotals.lost / denom) * 100 : null;

    // Diagnostics (stderr only) - the frame dimensions we sampled and a
    // percentile view of bitrate, so the getStats fields are not wasted.
    const maxW = widths.length ? Math.max(...widths) : null;
    const maxH = heights.length ? Math.max(...heights) : null;
    console.error(`resolution (diag, max): ${maxW}x${maxH}`);
    console.error(`bitrate p95 (diag): ${round(percentile(bitrates, 95))} kbps`);

    const summary = {
      meanBitrateKbps: round(mean(bitrates)),
      lossPct: round(lossPct),
      jitterMs: round(mean(jitters)),
      meanFps: round(mean(fpsVals)),
      samples,
    };

    // The ONLY stdout line - keep it pure JSON for the bash harness.
    console.log(JSON.stringify(summary));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("\nMEASURE FAILED:");
  console.error(error);
  process.exit(1);
});
