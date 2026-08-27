/*
 * ---------------------------------------------------------
 * CrowdStream — MULTI-ROOM SCALE LOAD TEST
 * ---------------------------------------------------------
 *
 * Creates M concurrent rooms, each with 1 broadcaster + V viewers,
 * to exercise mediasoup worker placement (least-loaded router
 * placement) and dynamic worker scaling ACROSS rooms — as opposed
 * to sfu-capacity.js, which piles many viewers into a SINGLE room.
 *
 * Rooms are launched sequentially with a ramp delay and then kept
 * alive concurrently (all pages stay open) so the worker pool is
 * under simultaneous multi-room load.
 *
 * Measures:
 *   - broadcaster setup latency (Go live -> window.__csLiveAt)
 *   - viewer join success + join latency (submit -> window.__csJoinedAt)
 *   - broadcaster / viewer failure counts
 *
 * Style mirrors load-test/sfu-capacity.js (arg(), percentile(),
 * CHROME_FLAGS, window.__cs* markers, progressive CSV).
 *
 * NEVER hardcode secrets: credentials come from --email/--password,
 * --emails/--passwords (comma lists, round-robin per room), or the
 * CROWDSTREAM_TEST_EMAIL / CROWDSTREAM_TEST_PASSWORD env vars. The
 * process errors + exits if none are supplied.
 *
 * Authored by Claude (Anthropic), via Claude Code — 2026-08-27.
 * ---------------------------------------------------------
 */

const puppeteer = require("puppeteer");
const fs = require("fs");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

function list(name) {
  const raw = arg(name, null);
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const BASE_URL = arg("baseUrl", "http://localhost");

const ROOMS = parseInt(arg("rooms", "10"), 10);
const VIEWERS_PER_ROOM = parseInt(
  arg("viewersPerRoom", "5"),
  10
);
const ROOM_RAMP_MS = parseInt(
  arg("roomRampMs", "2000"),
  10
);

const OUT_CSV = arg("out", "multi-room-results.csv");

const WAIT_TIMEOUT_MS = 20000;

/*
 * ---------------------------------------------------------
 * CREDENTIALS
 * ---------------------------------------------------------
 *
 * Creating a room may require a broadcaster-permitted account, and a
 * single account often cannot hold multiple concurrent rooms. Supply
 * a pool via --emails / --passwords (comma-separated, paired by
 * index) and it is round-robined across rooms. Otherwise we fall
 * back to a single --email / --password (or the env vars). Each
 * room's viewers reuse that room's account.
 */

const EMAILS = list("emails");
const PASSWORDS = list("passwords");

const SINGLE_EMAIL = arg(
  "email",
  process.env.CROWDSTREAM_TEST_EMAIL || null
);
const SINGLE_PASSWORD = arg(
  "password",
  process.env.CROWDSTREAM_TEST_PASSWORD || null
);

const emailPool =
  EMAILS && EMAILS.length
    ? EMAILS
    : SINGLE_EMAIL
      ? [SINGLE_EMAIL]
      : [];

const passwordPool =
  PASSWORDS && PASSWORDS.length
    ? PASSWORDS
    : SINGLE_PASSWORD
      ? [SINGLE_PASSWORD]
      : [];

if (!emailPool.length || !passwordPool.length) {
  console.error(
    "Missing credentials. Provide --email/--password, or --emails/--passwords " +
      "(comma-separated lists), or set CROWDSTREAM_TEST_EMAIL / CROWDSTREAM_TEST_PASSWORD."
  );
  process.exit(1);
}

/*
 * Pair emails with passwords by index. A shorter password list reuses
 * its last entry (e.g. many accounts sharing one password).
 */
const ACCOUNTS = emailPool.map((email, i) => ({
  email,
  password:
    passwordPool[i] || passwordPool[passwordPool.length - 1],
}));

function pickAccount(index) {
  return ACCOUNTS[index % ACCOUNTS.length];
}

const CHROME_FLAGS = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--disable-gpu",
  "--no-sandbox",
  "--mute-audio",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (!values.length) return null;

  const index = Math.ceil((p / 100) * values.length) - 1;

  return values[
    Math.min(Math.max(index, 0), values.length - 1)
  ];
}

function pctl(values, p) {
  const sorted = values
    .filter(Number.isFinite)
    .slice()
    .sort((a, b) => a - b);
  return percentile(sorted, p);
}

/*
 * ---------------------------------------------------------
 * LOGIN
 * ---------------------------------------------------------
 */

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/signin`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await page.waitForSelector("#email", {
    timeout: WAIT_TIMEOUT_MS,
  });

  await page.type("#email", email);
  await page.type("#password", password);

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
 * BROADCASTER
 * ---------------------------------------------------------
 */

async function launchBroadcaster(browser, account, roomIndex) {
  const page = await browser.newPage();

  page.on("console", (msg) => {
    console.log(
      `[ROOM ${roomIndex} BROADCASTER ${msg.type()}] ${msg.text()}`
    );
  });

  page.on("pageerror", (error) => {
    console.error(
      `[ROOM ${roomIndex} BROADCASTER PAGE ERROR] ${error.message}`
    );
  });

  try {
    await login(page, account.email, account.password);

    await page.goto(`${BASE_URL}/broadcaster`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    /*
     * Wait for the "Go live" button to exist.
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

    /*
     * Click Go live and start the setup-latency clock.
     * page Date.now() and node Date.now() share the system clock.
     */
    const goLiveAt = Date.now();

    await page.evaluate(() => {
      const button = Array.from(
        document.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Go live"));

      if (!button) {
        throw new Error("Go live button disappeared");
      }

      button.click();
    });

    /*
     * BroadcasterPage sets window.__csRoomId after createRoom()
     * succeeds, then window.__csLiveAt once the stream is live.
     */
    await page.waitForFunction(
      () => Boolean(window.__csRoomId),
      { timeout: WAIT_TIMEOUT_MS }
    );

    const roomId = await page.evaluate(
      () => window.__csRoomId
    );

    let liveAt = null;
    try {
      await page.waitForFunction(
        () => Boolean(window.__csLiveAt),
        { timeout: WAIT_TIMEOUT_MS }
      );
      liveAt = await page.evaluate(
        () => window.__csLiveAt
      );
    } catch {
      console.warn(
        `[ROOM ${roomIndex}] Room exists, but __csLiveAt was not detected.`
      );
    }

    const setupMs = liveAt ? liveAt - goLiveAt : null;

    return {
      page,
      roomId,
      setupMs,
      // A room only counts as fully set up once it is live.
      ok: Boolean(roomId && liveAt),
      error: null,
    };
  } catch (error) {
    return {
      page,
      roomId: null,
      setupMs: null,
      ok: false,
      error: error.message,
    };
  }
}

/*
 * ---------------------------------------------------------
 * VIEWER
 * ---------------------------------------------------------
 */

async function launchViewer(browser, roomId, index, account) {
  const page = await browser.newPage();

  page.on("pageerror", (error) => {
    console.error(
      `[VIEWER ${index} PAGE ERROR] ${error.message}`
    );
  });

  try {
    await login(page, account.email, account.password);

    const startTime = Date.now();

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
     * Submit the viewer form to join.
     */
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
  console.log("CrowdStream MULTI-ROOM SCALE TEST");
  console.log("========================================");
  console.log(`Frontend:         ${BASE_URL}`);
  console.log(`Rooms (M):        ${ROOMS}`);
  console.log(`Viewers/room (V): ${VIEWERS_PER_ROOM}`);
  console.log(`Room ramp:        ${ROOM_RAMP_MS}ms`);
  console.log(`Accounts:         ${ACCOUNTS.length}`);
  console.log(`Output:           ${OUT_CSV}`);
  console.log("Backend workers:  watch server logs (see README)");
  console.log("");

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000,
    args: CHROME_FLAGS,
  });

  // Broadcasters need camera/microphone; grant on the default context.
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(BASE_URL, [
    "camera",
    "microphone",
  ]);

  const csvRows = [
    [
      "timestamp",
      "rooms",
      "totalViewers",
      "broadcasterSetupP50",
      "broadcasterSetupP99",
      "viewerJoinP50",
      "viewerJoinP99",
      "broadcasterFailures",
      "viewerFailures",
    ].join(","),
  ];

  // Keep every page open so all rooms load the workers concurrently.
  const openPages = [];

  const broadcasterSetupLatencies = [];
  const viewerJoinLatencies = [];
  let broadcasterFailures = 0;
  let viewerFailures = 0;
  let totalViewers = 0;

  try {
    for (let r = 0; r < ROOMS; r++) {
      const account = pickAccount(r);

      console.log("\n========================================");
      console.log(
        `LAUNCHING ROOM ${r + 1}/${ROOMS} (account: ${account.email})`
      );
      console.log("========================================");

      const broadcaster = await launchBroadcaster(
        browser,
        account,
        r
      );
      openPages.push(broadcaster.page);

      if (broadcaster.roomId) {
        console.log(`Room ID: ${broadcaster.roomId}`);
      }

      if (broadcaster.ok && Number.isFinite(broadcaster.setupMs)) {
        broadcasterSetupLatencies.push(broadcaster.setupMs);
        console.log(
          `Broadcaster setup: ${broadcaster.setupMs} ms`
        );
      } else {
        broadcasterFailures += 1;
        console.error(
          `Broadcaster FAILED (room ${r + 1}): ${
            broadcaster.error || "no __csLiveAt marker"
          }`
        );
      }

      /*
       * Add this room's viewers concurrently (only if the room
       * actually came up). Viewers reuse the room's account.
       */
      if (broadcaster.roomId) {
        const batch = await Promise.all(
          Array.from(
            { length: VIEWERS_PER_ROOM },
            (_, v) =>
              launchViewer(
                browser,
                broadcaster.roomId,
                totalViewers + v,
                account
              )
          )
        );

        for (const viewer of batch) {
          openPages.push(viewer.page);
          totalViewers += 1;

          if (viewer.joined && Number.isFinite(viewer.joinLatencyMs)) {
            viewerJoinLatencies.push(viewer.joinLatencyMs);
          } else {
            viewerFailures += 1;
          }
        }

        const joinedCount = batch.filter((v) => v.joined).length;
        const framedCount = batch.filter(
          (v) => Number.isFinite(v.firstFrameLatencyMs)
        ).length;
        console.log(
          `Viewers joined: ${joinedCount}/${VIEWERS_PER_ROOM} ` +
            `(first frame: ${framedCount}/${VIEWERS_PER_ROOM})`
        );
      } else {
        // Room never came up; count its viewers as failed attempts.
        totalViewers += VIEWERS_PER_ROOM;
        viewerFailures += VIEWERS_PER_ROOM;
        console.error(
          `Skipping ${VIEWERS_PER_ROOM} viewers — room ${
            r + 1
          } was not created.`
        );
      }

      /*
       * Progressive CSV: one row per room, cumulative percentiles.
       */
      const bSetupP50 = pctl(broadcasterSetupLatencies, 50);
      const bSetupP99 = pctl(broadcasterSetupLatencies, 99);
      const vJoinP50 = pctl(viewerJoinLatencies, 50);
      const vJoinP99 = pctl(viewerJoinLatencies, 99);

      console.log(
        `\n[CUMULATIVE] rooms=${r + 1} viewers=${totalViewers} ` +
          `bSetupP50=${bSetupP50 ?? "n/a"} bSetupP99=${
            bSetupP99 ?? "n/a"
          } vJoinP50=${vJoinP50 ?? "n/a"} vJoinP99=${
            vJoinP99 ?? "n/a"
          } bFail=${broadcasterFailures} vFail=${viewerFailures}`
      );

      csvRows.push(
        [
          new Date().toISOString(),
          r + 1,
          totalViewers,
          bSetupP50 ?? "n/a",
          bSetupP99 ?? "n/a",
          vJoinP50 ?? "n/a",
          vJoinP99 ?? "n/a",
          broadcasterFailures,
          viewerFailures,
        ].join(",")
      );

      fs.writeFileSync(OUT_CSV, csvRows.join("\n"));

      /*
       * Ramp: stagger room launches (skip the wait after the last).
       */
      if (r < ROOMS - 1) {
        console.log(
          `\nWaiting ${ROOM_RAMP_MS}ms before next room...`
        );
        await sleep(ROOM_RAMP_MS);
      }
    }

    console.log("\n========================================");
    console.log("MULTI-ROOM SCALE TEST COMPLETE");
    console.log("========================================");
    console.log(`Rooms launched:       ${ROOMS}`);
    console.log(`Total viewers:        ${totalViewers}`);
    console.log(
      `Broadcaster setup P50: ${
        pctl(broadcasterSetupLatencies, 50) ?? "n/a"
      } ms`
    );
    console.log(
      `Broadcaster setup P99: ${
        pctl(broadcasterSetupLatencies, 99) ?? "n/a"
      } ms`
    );
    console.log(
      `Viewer join P50:       ${
        pctl(viewerJoinLatencies, 50) ?? "n/a"
      } ms`
    );
    console.log(
      `Viewer join P99:       ${
        pctl(viewerJoinLatencies, 99) ?? "n/a"
      } ms`
    );
    console.log(`Broadcaster failures:  ${broadcasterFailures}`);
    console.log(`Viewer failures:       ${viewerFailures}`);
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
