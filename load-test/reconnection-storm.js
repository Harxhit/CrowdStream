/**
 * CrowdStream — Reconnection-Storm (Thundering-Herd) Load Test
 * ============================================================
 * Measures RECOVERY (not cold connect) when a whole signaling pod's clients
 * reconnect at once. socket.io auto-reconnection is ENABLED, so the client-side
 * backoff + jitter is exercised exactly as it would be in production behind
 * sticky sessions + the Socket.IO Redis adapter.
 *
 * A prior 10k/2s spike test saw 8,139 failures — but that only measured cold
 * connect. This test quantifies how the surviving clients recover after a mass
 * drop, i.e. the thundering-herd re-join.
 *
 * Two trigger modes:
 *   forcedrop (default) — the harness drops every connected client itself
 *                         (io.engine.close ⇒ socket.io auto-reconnect); no infra
 *                         access required.
 *   killpod             — you kill a real signaling pod by hand; the harness does
 *                         NOT drop clients and relies on socket.io's own disconnect
 *                         detection.
 *
 * Recovery time per client = (successful re-join ack) − (storm trigger).
 *
 * Never hardcodes secrets: the JWT is passed via --token and sent as the
 * `accessToken` cookie, matching CrowdStream's socket auth middleware.
 *
 * > Authored by Claude (Anthropic), via Claude Code — 2026-08-27.
 */

const { io } = require("socket.io-client");

// ---------- CLI args ----------
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const URL = arg("url", "http://localhost:3000");
const URLS_ARG = arg("urls", null);
const URLS = URLS_ARG
  ? URLS_ARG.split(",").map((s) => s.trim()).filter(Boolean)
  : [URL];

const ROOM_ID = arg("room", null);
const TOKEN = arg("token", null);
const NUM_CLIENTS = parseInt(arg("clients", "500"), 10);
const RAMP_MS = parseInt(arg("rampMs", "10000"), 10);
const MODE = arg("mode", "forcedrop");
const TRIGGER_AFTER_MS = parseInt(arg("triggerAfterMs", "15000"), 10);
const RECOVER_WINDOW_MS = parseInt(arg("recoverWindowMs", "30000"), 10);
const ACK_TIMEOUT_MS = parseInt(arg("timeout", "8000"), 10);

if (!ROOM_ID) {
  console.error(
    "Missing --room <roomId>. Start a broadcast first, then pass its id."
  );
  process.exit(1);
}

if (!TOKEN) {
  console.error(
    "Missing --token <jwt>. The socket auth middleware rejects unauthenticated sockets."
  );
  process.exit(1);
}

if (MODE !== "forcedrop" && MODE !== "killpod") {
  console.error(`Invalid --mode "${MODE}". Use "forcedrop" or "killpod".`);
  process.exit(1);
}

// ---------- percentile ---------- (identical to signaling-latency.js)
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return NaN;

  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;

  return sortedArr[Math.min(Math.max(idx, 0), sortedArr.length - 1)];
}

function summarize(label, samples) {
  const clean = samples
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (clean.length === 0) {
    console.log(`${label}: no samples`);
    return;
  }

  const avg = clean.reduce((a, b) => a + b, 0) / clean.length;

  console.log(
    `${label.padEnd(32)} ` +
      `n=${clean.length.toString().padEnd(5)} ` +
      `avg=${avg.toFixed(1)}ms  ` +
      `p50=${percentile(clean, 50)}ms  ` +
      `p90=${percentile(clean, 90)}ms  ` +
      `p95=${percentile(clean, 95)}ms  ` +
      `p99=${percentile(clean, 99)}ms  ` +
      `max=${clean[clean.length - 1]}ms`
  );
}

// ---------- Socket.IO ACK helper ---------- (same shape as signaling-latency.js)
function ackWithTimeout(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${event} ack timeout`));
    }, ACK_TIMEOUT_MS);

    const t0 = performance.now();

    socket.emit(event, ...args, (response) => {
      clearTimeout(timer);

      resolve({
        response,
        latencyMs: performance.now() - t0,
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- shared state ----------
const clients = [];
let stormTriggered = false;
let triggerAt = 0;
const recoverSamples = []; // recovery ms for clients that re-joined within the window
let connectErrors = 0;
let reconnectAttempts = 0; // manager-level auto-reconnect attempts after the trigger

function urlFor(idx) {
  return URLS[idx % URLS.length];
}

// ---------- per-client join ----------
async function joinRoomOnce(client) {
  try {
    const { response } = await ackWithTimeout(
      client.socket,
      "joinRoom",
      ROOM_ID
    );

    if (response?.success) return true;

    client.lastError = `joinRoom: ${response?.code || "unsuccessful ack"}`;
    return false;
  } catch (err) {
    client.lastError = err?.message || String(err);
    return false;
  }
}

async function onConnect(client) {
  if (!stormTriggered) {
    // Baseline join: initial connect (or a benign pre-trigger reconnect).
    client.baselineJoined = await joinRoomOnce(client);
    return;
  }

  // Post-trigger (re)connect — this is the recovery path we are measuring.
  if (client.recovered) return;

  const ok = await joinRoomOnce(client);

  if (ok && !client.recovered) {
    client.recovered = true;
    client.recoverMs = performance.now() - triggerAt;

    if (client.recoverMs <= RECOVER_WINDOW_MS) {
      recoverSamples.push(client.recoverMs);
    }
  }
}

function spawnClient(idx) {
  const url = urlFor(idx);

  // reconnection ENABLED so socket.io's own backoff + jitter drives recovery.
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    forceNew: true,
    extraHeaders: {
      cookie: `accessToken=${TOKEN}`,
    },
  });

  const client = {
    idx,
    url,
    socket,
    baselineJoined: false,
    droppedAfterTrigger: false,
    recovered: false,
    recoverMs: NaN,
    lastError: null,
  };

  clients.push(client);

  // socket.io re-emits "connect" on every successful (re)connection.
  socket.on("connect", () => {
    onConnect(client).catch((err) => {
      client.lastError = err?.message || String(err);
    });
  });

  socket.on("disconnect", () => {
    if (stormTriggered) client.droppedAfterTrigger = true;
  });

  socket.on("connect_error", () => {
    connectErrors += 1;
  });

  // Manager-level signal: how many auto-reconnect attempts the herd generated.
  socket.io.on("reconnect_attempt", () => {
    if (stormTriggered) reconnectAttempts += 1;
  });

  return client;
}

// ---------- storm triggers ----------
function triggerForcedrop() {
  for (const client of clients) {
    // Only drop clients that were actually in steady state; a client that never
    // connected was not part of the herd and should not count against recovery.
    if (!client.socket.connected) continue;

    client.droppedAfterTrigger = true;

    const engine = client.socket.io && client.socket.io.engine;

    if (engine) {
      // Abrupt transport close ⇒ socket.io's automatic reconnection (backoff +
      // jitter) re-establishes the socket. This is the path that actually
      // smooths — or fails to smooth — the reconnection herd.
      engine.close();
    } else {
      // Fallback if the engine is unavailable: manual bounce (immediate, no backoff).
      client.socket.disconnect();
      client.socket.connect();
    }
  }
}

function triggerKillpod() {
  console.log(
    "\n *** killpod mode: KILL ONE SIGNALING POD NOW ***\n" +
      " The harness will NOT drop clients; it relies on socket.io's own\n" +
      " disconnect detection. Recovery timing starts at this instant.\n"
  );
}

// ---------- main ----------
async function main() {
  console.log(
    `Reconnection-storm test: ${NUM_CLIENTS} clients, mode=${MODE}, ` +
      `ramp=${RAMP_MS}ms, triggerAfter=${TRIGGER_AFTER_MS}ms, ` +
      `recoverWindow=${RECOVER_WINDOW_MS}ms, room=${ROOM_ID}\n` +
      `endpoints: ${URLS.join(", ")}`
  );

  const t0 = performance.now();
  const delayBetween = NUM_CLIENTS > 0 ? RAMP_MS / NUM_CLIENTS : 0;

  for (let i = 0; i < NUM_CLIENTS; i++) {
    spawnClient(i);

    if (delayBetween > 0) {
      await sleep(delayBetween);
    }
  }

  // Hold until the scheduled trigger time (measured from launch) so the fleet
  // can connect, join, and settle into steady state before the storm hits.
  const elapsed = performance.now() - t0;
  const waitBeforeTrigger = Math.max(0, TRIGGER_AFTER_MS - elapsed);
  await sleep(waitBeforeTrigger);

  const stable = clients.filter(
    (c) => c.socket.connected && c.baselineJoined
  ).length;

  console.log(
    `\nPre-storm stability: ${stable}/${NUM_CLIENTS} connected+joined.`
  );

  if (stable < NUM_CLIENTS) {
    console.log(
      " (Not all clients reached steady state — raise --triggerAfterMs/--timeout " +
        "or lower --clients. Recovery % is measured only over clients that dropped.)"
    );
  }

  // ---- trigger the storm ----
  stormTriggered = true;
  triggerAt = performance.now();

  if (MODE === "forcedrop") {
    triggerForcedrop();
  } else {
    triggerKillpod();
  }

  console.log(
    `Storm triggered. Watching recovery for ${RECOVER_WINDOW_MS}ms...`
  );
  await sleep(RECOVER_WINDOW_MS);

  // ---- tally ----
  const dropped = clients.filter((c) => c.droppedAfterTrigger);
  const recovered = dropped.filter(
    (c) => c.recovered && c.recoverMs <= RECOVER_WINDOW_MS
  );
  const failed = dropped.filter(
    (c) => !(c.recovered && c.recoverMs <= RECOVER_WINDOW_MS)
  );
  const successPct = dropped.length
    ? (recovered.length / dropped.length) * 100
    : 0;

  console.log("\n=== Reconnection-storm results ===");
  console.log(
    `mode=${MODE}  clients=${NUM_CLIENTS}  dropped/affected=${dropped.length}`
  );

  summarize("reconnect + re-join", recoverSamples);

  console.log(
    `recovery success within ${RECOVER_WINDOW_MS}ms: ` +
      `${recovered.length}/${dropped.length} (${successPct.toFixed(1)}%)`
  );
  console.log(`failed to recover in window: ${failed.length}`);
  console.log(`auto-reconnect attempts (post-trigger): ${reconnectAttempts}`);
  console.log(`connect_error events (whole run): ${connectErrors}`);

  // Data-driven note on herd smoothing — computed from real samples, never fabricated.
  const clean = recoverSamples
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (clean.length >= 2) {
    const p50 = percentile(clean, 50);
    const p99 = percentile(clean, 99);
    const spread = p50 > 0 ? p99 / p50 : Infinity;

    if (spread >= 3) {
      console.log(
        `\nHerd note: recoveries are spread out (p99/p50=${spread.toFixed(1)}x) — ` +
          "backoff + jitter appears to be de-synchronising the herd."
      );
    } else {
      console.log(
        `\nHerd note: recoveries are tightly clustered (p99/p50=${spread.toFixed(1)}x) — ` +
          "clients reconnected in a near-simultaneous burst; verify " +
          "reconnectionDelayMax / randomizationFactor and LB connection limits."
      );
    }
  }

  if (failed.length > 0) {
    const samples = failed
      .slice(0, 10)
      .map(
        (c) =>
          `client ${c.idx}@${c.url}: ${
            c.lastError || "no successful re-join in window"
          }`
      );

    console.log("\nsample failures:");
    console.log(samples.join("\n"));

    if (failed.length > 10) {
      console.log(`...and ${failed.length - 10} more`);
    }
  }

  // Teardown: reconnection is on (attempts=Infinity), so we must close every
  // socket and exit explicitly or the process would never terminate.
  for (const client of clients) client.socket.disconnect();
  process.exit(0);
}

main();
