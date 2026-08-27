/*
 * CrowdStream — long-duration steady-state soak test (socket.io-client)
 *
 * Purpose: hold a STEADY-STATE population of connected clients for hours to
 * surface slow leaks and gradual degradation over TIME. This is deliberately
 * distinct from rapid connect/disconnect churn benchmarks: the load here is
 * meant to stay FLAT so that any upward drift in server RSS, open file
 * descriptors, or mediasoup worker/thread counts (sampled EXTERNALLY) is
 * attributable to a leak rather than to changing load.
 *
 * The pass signal is judged from external sampling of the backend process
 * (RSS / FD / nlwp staying flat), not from this script. See LONG-DURATION-SOAK.md.
 *
 * Style intentionally mirrors ../load-test/signaling-latency.js
 * (arg()/percentile()/ackWithTimeout(), websocket transport, JWT cookie auth).
 *
 * Secrets: the JWT is passed via --token and never hardcoded.
 *
 * Authored by Claude (Anthropic), via Claude Code — 2026-08-27.
 */

const { io } = require("socket.io-client");

// ---------- CLI args ----------
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const URL = arg("url", "http://localhost:3000");
const ROOM_ID = arg("room", null);
const TOKEN = arg("token", null);
const DO_JOIN = arg("join", "false") === "true";

const NUM_CLIENTS = parseInt(arg("clients", "200"), 10);
const DURATION_MIN = parseInt(arg("durationMin", "120"), 10);
const CHURN_INTERVAL_MS = parseInt(arg("churnIntervalMs", "60000"), 10);
const CHURN_FRACTION = parseFloat(arg("churnFraction", "0.1"));
const HEARTBEAT_MS = parseInt(arg("heartbeatMs", "15000"), 10);
const SAMPLE_INTERVAL_MS = parseInt(arg("sampleIntervalMs", "60000"), 10);
const METRICS_URL = arg("metricsUrl", null);
const ACK_TIMEOUT_MS = parseInt(arg("timeout", "8000"), 10);

const DURATION_MS = DURATION_MIN * 60 * 1000;

// Gentle initial ramp so we don't open the whole population in one tick.
const RAMP_STAGGER_MS = 15;

if (!TOKEN) {
  console.error(
    "Missing --token <jwt>. The server's JWT middleware rejects unauthenticated sockets."
  );
  process.exit(1);
}

if (DO_JOIN && !ROOM_ID) {
  console.error(
    "--join true requires --room <roomId>. Create a room first (start a broadcast), then pass its id."
  );
  process.exit(1);
}

// ---------- percentile ----------
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return NaN;

  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;

  return sortedArr[
    Math.min(Math.max(idx, 0), sortedArr.length - 1)
  ];
}

function summarize(label, samples) {
  const clean = samples
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (clean.length === 0) {
    console.log(`${label}: no samples`);
    return;
  }

  const avg =
    clean.reduce((a, b) => a + b, 0) / clean.length;

  console.log(
    `${label.padEnd(24)} ` +
      `n=${clean.length.toString().padEnd(5)} ` +
      `min=${clean[0]}  ` +
      `avg=${avg.toFixed(1)}  ` +
      `p50=${percentile(clean, 50)}  ` +
      `max=${clean[clean.length - 1]}`
  );
}

// ---------- Socket.IO ACK helper ----------
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

// ---------- state ----------
const pool = Array.from({ length: NUM_CLIENTS }, (_, slot) => ({
  slot,
  socket: null,
  joined: false,
  heartbeatTimer: null,
}));

const stats = {
  errors: 0,
  connectFailures: 0,
  joinFailures: 0,
  reconnects: 0,
  unexpectedDisconnects: 0,
  lastErrors: [],
};

// Connected-count captured at every sample — used for the stability summary.
const connectedSamples = [];

let lastPresence = null;
let startedAt = 0;
let running = true;
let finished = false;
let churnTimer = null;
let sampleTimer = null;

function pushError(msg) {
  stats.lastErrors.push(msg);
  if (stats.lastErrors.length > 50) {
    stats.lastErrors.shift();
  }
}

function liveCount() {
  return pool.reduce(
    (n, c) => n + (c.socket && c.socket.connected ? 1 : 0),
    0
  );
}

function joinedCount() {
  return pool.reduce(
    (n, c) => n + (c.joined && c.socket && c.socket.connected ? 1 : 0),
    0
  );
}

// ---------- client lifecycle ----------
function createSocket() {
  return io(URL, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    extraHeaders: {
      cookie: `accessToken=${TOKEN}`,
    },
  });
}

function startHeartbeat(client) {
  stopHeartbeat(client);

  client.heartbeatTimer = setInterval(() => {
    if (client.socket && client.socket.connected) {
      // viewer:heartBeat is fire-and-forget (no ack) — keeps Redis presence TTL alive.
      client.socket.emit("viewer:heartBeat");
    }
  }, HEARTBEAT_MS);
}

function stopHeartbeat(client) {
  if (client.heartbeatTimer) {
    clearInterval(client.heartbeatTimer);
    client.heartbeatTimer = null;
  }
}

async function connectClient(slot) {
  const client = pool[slot];
  const socket = createSocket();
  client.socket = socket;
  client.joined = false;

  let phase = "connect";

  try {
    // 1. CONNECT
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("connect timeout"));
      }, ACK_TIMEOUT_MS);

      socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });

      socket.once("connect_error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // Any disconnect reaching this handler is unintended: the intentional
    // teardown path (disconnectClient) removes listeners before disconnecting.
    socket.on("disconnect", (reason) => {
      stats.unexpectedDisconnects++;
      pushError(`slot ${slot}: unexpected disconnect (${reason})`);
    });

    socket.on("room:presence", (payload) => {
      const count =
        typeof payload === "number" ? payload : payload?.count;
      if (Number.isFinite(count)) {
        lastPresence = count;
      }
    });

    // 2. JOIN ROOM (optional)
    if (DO_JOIN) {
      phase = "join";

      const { response } = await ackWithTimeout(
        socket,
        "joinRoom",
        ROOM_ID
      );

      if (!response?.success) {
        throw new Error(
          `joinRoom failed: ${response?.code || "unknown error"}`
        );
      }

      client.joined = true;
      startHeartbeat(client);
    }
  } catch (err) {
    stats.errors++;
    if (phase === "connect") {
      stats.connectFailures++;
    } else {
      stats.joinFailures++;
    }
    pushError(`slot ${slot}: ${err?.message || String(err)}`);

    socket.removeAllListeners();
    socket.disconnect();
    client.socket = null;
    client.joined = false;
  }
}

function disconnectClient(slot) {
  const client = pool[slot];
  stopHeartbeat(client);

  if (client.socket) {
    // Remove listeners first so the intentional disconnect isn't counted as unexpected.
    client.socket.removeAllListeners();
    client.socket.disconnect();
    client.socket = null;
  }

  client.joined = false;
}

function shutdownAll() {
  for (let slot = 0; slot < pool.length; slot++) {
    disconnectClient(slot);
  }
}

// ---------- steady-state maintenance ----------
function pickRandomSlots(n) {
  const all = Array.from({ length: NUM_CLIENTS }, (_, i) => i);

  // Partial Fisher-Yates: shuffle just the first n positions.
  for (let i = 0; i < n && i < all.length; i++) {
    const j = i + Math.floor(Math.random() * (all.length - i));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(0, Math.min(n, all.length));
}

async function churnOnce() {
  const replaceCount = Math.max(
    1,
    Math.round(NUM_CLIENTS * CHURN_FRACTION)
  );

  const slots = pickRandomSlots(replaceCount);

  // Drop the selected slots, then bring fresh sockets up for the SAME slots so
  // the population size stays constant (steady state, not a ramp).
  for (const slot of slots) {
    disconnectClient(slot);
  }

  const pending = [];
  for (const slot of slots) {
    stats.reconnects++;
    pending.push(connectClient(slot));
  }

  await Promise.allSettled(pending);
}

async function rampUp() {
  const pending = [];

  for (let slot = 0; slot < NUM_CLIENTS; slot++) {
    pending.push(connectClient(slot));
    await sleep(RAMP_STAGGER_MS);
  }

  await Promise.allSettled(pending);
}

// ---------- sampling / metrics ----------
async function fetchMetrics() {
  if (!METRICS_URL) return;

  if (typeof fetch !== "function") {
    console.log(
      "  metrics: global fetch unavailable in this Node runtime — skipping"
    );
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ACK_TIMEOUT_MS);

    const res = await fetch(METRICS_URL, { signal: controller.signal });
    clearTimeout(timer);

    const body = await res.text();
    const trimmed = body.replace(/\s+/g, " ").trim().slice(0, 500);

    console.log(
      `  metrics [${res.status}] ${trimmed}` +
        (body.length > 500 ? " …(trimmed)" : "")
    );
  } catch (err) {
    console.log(
      `  metrics fetch error: ${err?.message || String(err)}`
    );
  }
}

async function sample() {
  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
  const live = liveCount();
  connectedSamples.push(live);

  console.log(
    `[t+${elapsedMin}min] ` +
      `connected=${live}/${NUM_CLIENTS}  ` +
      (DO_JOIN ? `joined=${joinedCount()}  ` : "") +
      `errors=${stats.errors}  ` +
      `reconnects=${stats.reconnects}  ` +
      `connFail=${stats.connectFailures}  ` +
      (DO_JOIN ? `joinFail=${stats.joinFailures}  ` : "") +
      `unexpDisc=${stats.unexpectedDisconnects}  ` +
      (lastPresence != null ? `serverPresence=${lastPresence}` : "")
  );

  await fetchMetrics();

  // The real leak signal lives in the backend process, not here — remind the operator.
  console.log(
    "  >> RECORD BACKEND NOW: " +
      "ps -o rss,nlwp -p <pid> ; ls /proc/<pid>/fd | wc -l " +
      "(watch RSS / thread / FD counts for upward drift)"
  );
}

// ---------- schedulers ----------
function scheduleChurn() {
  churnTimer = setTimeout(async () => {
    if (!running) return;

    try {
      await churnOnce();
    } catch (err) {
      stats.errors++;
      pushError(`churn: ${err?.message || String(err)}`);
    }

    if (running) scheduleChurn();
  }, CHURN_INTERVAL_MS);
}

function scheduleSample() {
  sampleTimer = setTimeout(async () => {
    if (!running) return;

    try {
      await sample();
    } catch (err) {
      pushError(`sample: ${err?.message || String(err)}`);
    }

    if (running) scheduleSample();
  }, SAMPLE_INTERVAL_MS);
}

// ---------- reporting ----------
function printFinalSummary() {
  const totalMin = ((Date.now() - startedAt) / 60000).toFixed(1);

  console.log("\n=== Long-duration soak summary ===");
  console.log(`Duration held:       ${totalMin} min (target ${DURATION_MIN} min)`);
  console.log(`Steady population:   ${NUM_CLIENTS}`);
  console.log(`Final connected:     ${liveCount()}/${NUM_CLIENTS}`);
  if (DO_JOIN) {
    console.log(`Final joined:        ${joinedCount()}/${NUM_CLIENTS}`);
  }

  summarize("connected over time", connectedSamples);

  console.log(`Total errors:        ${stats.errors}`);
  console.log(`  connect failures:  ${stats.connectFailures}`);
  if (DO_JOIN) {
    console.log(`  join failures:     ${stats.joinFailures}`);
  }
  console.log(`Unexpected drops:    ${stats.unexpectedDisconnects}`);
  console.log(`Churn reconnects:    ${stats.reconnects}`);
  console.log(`Samples taken:       ${connectedSamples.length}`);

  if (stats.lastErrors.length > 0) {
    console.log("\nRecent errors (last 10):");
    console.log(stats.lastErrors.slice(-10).join("\n"));
  }

  console.log(
    "\nPASS SIGNAL (judge from EXTERNAL backend sampling, not from this script):\n" +
      "  server RSS, open FD count, and worker/thread (nlwp) counts stay FLAT\n" +
      "  across the whole window while connected-count is held constant.\n" +
      "  A slow upward slope under this steady load indicates a leak over time."
  );
}

async function finish(reason) {
  if (finished) return;
  finished = true;
  running = false;

  if (churnTimer) clearTimeout(churnTimer);
  if (sampleTimer) clearTimeout(sampleTimer);

  console.log(`\n[soak] stopping — ${reason}`);

  await sample();
  printFinalSummary();
  shutdownAll();

  await sleep(200); // let stdout flush
  process.exit(0);
}

// ---------- main ----------
function printBanner() {
  console.log("=== CrowdStream long-duration steady-state soak ===");
  console.log(`url:              ${URL}`);
  console.log(`room:             ${ROOM_ID ?? "(none)"}`);
  console.log(`join rooms:       ${DO_JOIN}`);
  console.log(`steady clients:   ${NUM_CLIENTS}`);
  console.log(`duration:         ${DURATION_MIN} min`);
  console.log(
    `churn:            ${(CHURN_FRACTION * 100).toFixed(0)}% every ${CHURN_INTERVAL_MS}ms`
  );
  console.log(
    `heartbeat:        ${
      DO_JOIN ? `${HEARTBEAT_MS}ms` : "(disabled; --join false)"
    }`
  );
  console.log(`sample interval:  ${SAMPLE_INTERVAL_MS}ms`);
  console.log(`metrics url:      ${METRICS_URL ?? "(none)"}`);
  console.log(`ack timeout:      ${ACK_TIMEOUT_MS}ms`);
  console.log("");
}

async function main() {
  printBanner();

  console.log("Ramping up steady population...");
  await rampUp();

  startedAt = Date.now();

  console.log(
    `Ramp complete: ${liveCount()}/${NUM_CLIENTS} connected` +
      (DO_JOIN ? `, ${joinedCount()} joined` : "")
  );
  console.log(
    `Holding steady state for ${DURATION_MIN} min. Sampling every ${SAMPLE_INTERVAL_MS}ms.\n`
  );

  await sample(); // t+0 baseline

  scheduleChurn();
  scheduleSample();

  await sleep(DURATION_MS);

  await finish("duration reached");
}

process.on("SIGINT", () => {
  finish("SIGINT");
});

main().catch((err) => {
  console.error("\nSOAK FAILED:");
  console.error(err);
  process.exit(1);
});
