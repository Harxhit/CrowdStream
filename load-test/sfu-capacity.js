const puppeteer = require("puppeteer");
const fs = require("fs");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const BASE_URL = arg("baseUrl", "http://localhost");
// const TOKEN = arg("token", null);

const TEST_EMAIL = "harsxit04@gmail.com"
const TEST_PASSWORD = "@Harshit1308"

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error(
    "Set CROWDSTREAM_TEST_EMAIL and CROWDSTREAM_TEST_PASSWORD"
  );
  process.exit(1);
}


const BATCH_SIZE = parseInt(arg("batchSize", "5"), 10);
const BATCH_INTERVAL_MS = parseInt(
  arg("batchIntervalMs", "10000"),
  10
);
const MAX_VIEWERS = parseInt(
  arg("maxViewers", "100"),
  10
);

const OUT_CSV = arg(
  "out",
  "sfu-capacity-results.csv"
);

const WAIT_TIMEOUT_MS = 20000;
let failures = 0; 

// if (!TOKEN) {
//   console.error("Missing --token <jwt>");
//   process.exit(1);
// }

const CHROME_FLAGS = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--disable-gpu",
  "--no-sandbox",
  "--mute-audio",
];

async function login(page) {
  console.log("Opening signin page...");

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

  console.log("Login successful:", await page.url());
  await page.waitForFunction(
    () =>
      window.__csSocket &&
      window.__csSocket.connected === true,
    {
      timeout: WAIT_TIMEOUT_MS,
    }
  );

  console.log(
    "Socket connected:",
    await page.evaluate(() => ({
      connected: window.__csSocket.connected,
      id: window.__csSocket.id,
    }))
  );
}

async function withAuthCookie(page) {
  const hostname = new URL(BASE_URL).hostname;

  await page.setCookie({
    name: "accessToken",
    value: TOKEN,
    domain: hostname,
    path: "/",
  });
}

function percentile(values, p) {
  if (!values.length) return null;

  const index =
    Math.ceil((p / 100) * values.length) - 1;

  return values[
    Math.min(
      Math.max(index, 0),
      values.length - 1
    )
  ];
}

/*
 * ---------------------------------------------------------
 * BROADCASTER
 * ---------------------------------------------------------
 */

async function launchBroadcaster(browser) {
  const context =
    browser.defaultBrowserContext();

  await context.overridePermissions(
    BASE_URL,
    ["camera", "microphone"]
  );

  const page = await browser.newPage();
  await login(page);

  page.on("response", async (response) => {
  const request = response.request();

  await page.waitForFunction(
    () => window.__csSocket,
    { timeout: 10000 }
  );

  const socketState = await page.evaluate(() => ({
    connected: window.__csSocket.connected,
    id: window.__csSocket.id,
  }));

  console.log("SOCKET STATE:", socketState);

  if (
    request.method() !== "GET" ||
    response.status() >= 400
  ) {
    console.log(
      `[HTTP ${response.status()}] ${request.method()} ${response.url()}`
    );

    try {
      const body = await response.text();
      console.log(
        `[HTTP BODY] ${body.slice(0, 1000)}`
      );
    } catch {}
  }
  });

  /*
   * IMPORTANT:
   * Show us what the React application is actually doing.
   */

  page.on("console", (msg) => {
    console.log(
      `[BROADCASTER ${msg.type()}] ${msg.text()}`
    );
  });

  page.on("pageerror", (error) => {
    console.error(
      `[BROADCASTER PAGE ERROR] ${error.message}`
    );
  });

  page.on("requestfailed", (request) => {
    console.error(
      `[REQUEST FAILED] ${request.method()} ${request.url()}`
    );

    console.error(
      `Reason: ${request.failure()?.errorText}`
    );
  });

  // await withAuthCookie(page);

  console.log(
    `Opening broadcaster: ${BASE_URL}/broadcaster`
  );

  await page.goto(
    `${BASE_URL}/broadcaster`,
    {
      waitUntil: "networkidle2",
      timeout: 30000,
    }
  );

  console.log(
    "Broadcaster page loaded."
  );

  console.log("\n========== PAGE DEBUG ==========");

  const debug = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    body: document.body.innerText,
    buttons: Array.from(document.querySelectorAll("button")).map(
      (b) => ({
        text: b.innerText,
        disabled: b.disabled,
      })
    ),
  }));

  console.log("URL:", debug.url);
  console.log("TITLE:", debug.title);

  console.log("\nBUTTONS:");
  console.log(JSON.stringify(debug.buttons, null, 2));

  console.log("\nPAGE TEXT:");
  console.log(debug.body);

  console.log("========== END DEBUG ==========\n");

  /*
   * Make sure the Go Live button actually exists.
   */

  await page.waitForFunction(
    () =>
      Array.from(
        document.querySelectorAll("button")
      ).some((button) =>
        button.textContent?.includes("Go live")
      ),
    {
      timeout: WAIT_TIMEOUT_MS,
    }
  );

  console.log(
    '"Go live" button found.'
  );

  /*
   * Click Go Live.
   */

  await page.evaluate(() => {
    const button = Array.from(
      document.querySelectorAll("button")
    ).find((button) =>
      button.textContent?.includes("Go live")
    );

    if (!button) {
      throw new Error(
        "Go live button disappeared"
      );
    }

    button.click();
  });

  console.log(
    'Clicked "Go live".'
  );

  /*
   * Now wait for the room marker.
   *
   * Your BroadcasterPage does:
   *
   * setRoomId(room.id)
   * window.__csRoomId = room.id
   *
   * AFTER createRoom() succeeds.
   */

  try {
    await page.waitForFunction(
      () => Boolean(window.__csRoomId),
      {
        timeout: WAIT_TIMEOUT_MS,
      }
    );
  } catch (error) {
    console.error(
      "\n========================================"
    );

    console.error(
      "BROADCASTER DID NOT CREATE A ROOM"
    );

    console.error(
      "========================================"
    );

    console.error(
      "Current URL:",
      page.url()
    );

    /*
     * Print the visible logs from your broadcaster UI.
     */

    const logs = await page.evaluate(() => {
      const text = document.body.innerText;

      return text.slice(-5000);
    });

    console.error(
      "\nBrowser page text:\n"
    );

    console.error(logs);

    /*
     * Save a screenshot so we can see exactly
     * what Puppeteer saw.
     */

    await page.screenshot({
      path: "broadcaster-failure.png",
      fullPage: true,
    });

    console.error(
      "\nScreenshot saved as:"
    );

    console.error(
      "broadcaster-failure.png"
    );

    throw new Error(
      "Broadcaster did not expose window.__csRoomId"
    );
  }

  const roomId = await page.evaluate(
    () => window.__csRoomId
  );

  console.log(
    `\nROOM CREATED SUCCESSFULLY`
  );

  console.log(
    `Room ID: ${roomId}`
  );

  /*
   * Wait for your __csLiveAt marker.
   */

  try {
    await page.waitForFunction(
      () => Boolean(window.__csLiveAt),
      {
        timeout: WAIT_TIMEOUT_MS,
      }
    );

    console.log(
      "Broadcaster is LIVE."
    );
  } catch {
    console.warn(
      "Room exists, but __csLiveAt was not detected."
    );
  }

  return {
    page,
    roomId,
  };
}

/*
 * ---------------------------------------------------------
 * VIEWER
 * ---------------------------------------------------------
 */

async function launchViewer(
  browser,
  roomId,
  index
) {
  const page = await browser.newPage();

  page.on("console", (msg) => {
    console.log(
      `[VIEWER ${index} ${msg.type()}] ${msg.text()}`
    );
  });

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

  page.on("websocketcreated", (ws) => {
    console.error("[WS CREATED]", ws.url());
  });

  page.on("websocketclosed", (ws) => {
    console.error("[WS CLOSED]", ws.url());
  });

  page.on("websocketframereceived", (ws, frame) => {
    console.error("[WS RX]", frame.slice(0, 300));
  });

  page.on("websocketframesent", (ws, frame) => {
    console.error("[WS TX]", frame.slice(0, 300));
  });

  // await withAuthCookie(page);
  await login(page)

  const startTime = Date.now();

  try {
    await page.goto(
      `${BASE_URL}/viewer?roomId=${roomId}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }
    );

    await page.waitForSelector(
      "form",
      {
        timeout: WAIT_TIMEOUT_MS,
      }
    );

    /*
     * Submit the viewer form.
     */

    await page.$eval(
      "form",
      (form) => {
        form.requestSubmit();
      }
    );

    /*
     * Wait for your ViewerPage marker.
     */

    let joinedAt = null;

    try {
      await page.waitForFunction(
        () => Boolean(window.__csJoinedAt),
        {
          timeout: WAIT_TIMEOUT_MS,
        }
      );

      joinedAt = await page.evaluate(
        () => window.__csJoinedAt
      );
    } catch {}

    /*
     * Wait for actual first video frame.
     */

    let firstFrameAt = null;

    try {
      await page.waitForFunction(
        () =>
          Boolean(
            window.__csFirstFrameAt
          ),
        {
          timeout: WAIT_TIMEOUT_MS,
        }
      );

      firstFrameAt = await page.evaluate(
        () => window.__csFirstFrameAt
      );
    } catch {}

    return {
      index,
      page,

      joined: Boolean(joinedAt),

      joinLatencyMs: joinedAt
        ? joinedAt - startTime
        : null,

      firstFrameLatencyMs:
        firstFrameAt
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
  console.log(
    "========================================"
  );

  console.log(
    "CrowdStream REAL SFU MEDIA TEST"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Frontend:       ${BASE_URL}`
  );

  console.log(
    `Batch size:     ${BATCH_SIZE}`
  );

  console.log(
    `Batch interval: ${BATCH_INTERVAL_MS}ms`
  );

  console.log(
    `Max viewers:    ${MAX_VIEWERS}`
  );

  console.log(
    "Backend CPU:    not measured yet"
  );

  console.log("");

  /*
   * Launch Chromium.
   */

  const browser =
    await puppeteer.launch({
      headless: true,
      protocolTimeout: 120000,
      args: CHROME_FLAGS,
    });

  try {
    /*
     * STEP 1
     *
     * Create a REAL broadcaster.
     */

    const broadcaster =
      await launchBroadcaster(
        browser
      );

    const roomId =
      broadcaster.roomId;

    /*
     * Give mediasoup a moment to stabilize.
     */

    console.log(
      "\nWaiting 5 seconds for media..."
    );

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 5000)
    );

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
        "failures",
      ].join(","),
    ];

    const viewers = [];

    /*
     * STEP 2
     *
     * Add viewers in batches.
     */

    for (
      let target = BATCH_SIZE;
      target <= MAX_VIEWERS;
      target += BATCH_SIZE
    ) {
      console.log(
        `\n========================================`
      );

      console.log(
        `ADDING VIEWERS: ${target}`
      );

      console.log(
        `========================================`
      );

      const batch =
        await Promise.all(
          Array.from(
            {
              length: BATCH_SIZE,
            },
            (_, index) =>
              launchViewer(
                browser,
                roomId,
                viewers.length +
                  index
              )
          )
        );

      viewers.push(...batch);

      /*
       * Join latency.
       */

      const joinLatencies =
        batch
          .map(
            (viewer) =>
              viewer.joinLatencyMs
          )
          .filter(Number.isFinite)
          .sort(
            (a, b) => a - b
          );

      /*
       * First frame latency.
       */

      const firstFrameLatencies =
        batch
          .map(
            (viewer) =>
              viewer.firstFrameLatencyMs
          )
          .filter(Number.isFinite)
          .sort(
            (a, b) => a - b
          );

      const failed =
        batch.filter(
          (viewer) =>
            !viewer.joined
        ).length;
      
      failures += failed

      const joinP50 =
        percentile(
          joinLatencies,
          50
        );

      const joinP99 =
        percentile(
          joinLatencies,
          99
        );

      const frameP50 =
        percentile(
          firstFrameLatencies,
          50
        );

      const frameP99 =
        percentile(
          firstFrameLatencies,
          99
        );

      console.log(
        `\nViewers: ${viewers.length}`
      );

      console.log(
        `Join P50: ${joinP50 ?? "n/a"} ms`
      );

      console.log(
        `Join P99: ${joinP99 ?? "n/a"} ms`
      );

      console.log(
        `First frame P50: ${
          frameP50 ?? "n/a"
        } ms`
      );

      console.log(
        `First frame P99: ${
          frameP99 ?? "n/a"
        } ms`
      );

      console.log(
        `Failures: ${failures}`
      );

      /*
       * Save results.
       */

      csvRows.push(
        [
          new Date().toISOString(),
          viewers.length,
          joinP50 ?? "n/a",
          joinP99 ?? "n/a",
          frameP50 ?? "n/a",
          frameP99 ?? "n/a",
          failures,
        ].join(",")
      );

      fs.writeFileSync(
        OUT_CSV,
        csvRows.join("\n")
      );

      /*
       * Wait before next batch.
       */

      if (
        target < MAX_VIEWERS
      ) {
        console.log(
          `\nWaiting ${
            BATCH_INTERVAL_MS / 1000
          } seconds...`
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              BATCH_INTERVAL_MS
            )
        );
      }
    }

    console.log(
      `\n========================================`
    );

    console.log(
      "SFU TEST COMPLETE"
    );

    console.log(
      `Results: ${OUT_CSV}`
    );

    console.log(
      `========================================`
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    "\nTEST FAILED:"
  );

  console.error(error);

  process.exit(1);
});