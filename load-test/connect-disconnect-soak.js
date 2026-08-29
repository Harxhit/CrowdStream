const { io } = require("socket.io-client");

// ---------- CLI args ----------
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const URL = arg("url", "http://localhost:3000");
const TOKEN = arg("token", null);
const ROOM_ID = arg("room", null);
const CYCLES = parseInt(arg("cycles", "1000"), 10); // total connect/disconnect cycles
const CONCURRENCY = parseInt(arg("concurrency", "50"), 10); // parallel workers
const HOLD_MS = parseInt(arg("holdMs", "0"), 10); // stay connected before disconnecting
const JOIN = arg("join", "false") === "true"; // also joinRoom each cycle (exercises viewer cleanup)
const SETTLE_MS = parseInt(arg("settleMs", "5000"), 10); // wait after churn for server cleanup
const ACK_TIMEOUT_MS = parseInt(arg("timeout", "8000"), 10);
const METRICS_URL = arg("metricsUrl", null); // optional health/metrics endpoint to sample

if (!TOKEN) {
  console.error(
    "Missing --token <jwt>. The server's socket auth rejects unauthenticated connections."
  );
  process.exit(1);
}

if (JOIN && !ROOM_ID) {
  console.error(
    "--join true requires --room <roomId>. Create a room by starting a broadcast first."
  );
  process.exit(1);
}

// ---------- percentile / summarize (same style as signaling-latency.js) ----------
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return NaN;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.min(Math.max(idx, 0), sortedArr.length - 1)];
}

function summarize(label, samples) {
  const clean = samples.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (clean.length === 0) {
    console.log(`${label}: no samples`);
    return;
  }
  const avg = clean.reduce((a, b) => a + b, 0) / clean.length;
  console.log(
    `${label.padEnd(32)} ` +
      `n=${clean.length.toString().padEnd(6)} ` +
      `avg=${avg.toFixed(1)}ms  ` +
      `p50=${percentile(clean, 50)}ms  ` +
      `p90=${percentile(clean, 90)}ms  ` +
      `p95=${percentile(clean, 95)}ms  ` +
      `p99=${percentile(clean, 99)}ms  ` +
      `max=${clean[clean.length - 1]}ms`
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
      resolve({ response, latencyMs: performance.now() - t0 });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const results = {
  connectMs: [],
  joinMs: [],
  cyclesDone: 0,
  connectErrors: 0,
  joinErrors: 0,
  errors: [],
};

// ---------- one connect -> (join) -> disconnect cycle ----------
async function oneCycle(workerId) {
  const socket = io(URL, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    extraHeaders: {
      cookie: `accessToken=${TOKEN}`,
    },
  });

  try {
    const connectStart = performance.now();

    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("connect timeout")),
        ACK_TIMEOUT_MS
      );
      socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("connect_error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    results.connectMs.push(performance.now() - connectStart);

    if (JOIN) {
      try {
        const { response, latencyMs } = await ackWithTimeout(
          socket,
          "joinRoom",
          ROOM_ID
        );
        results.joinMs.push(latencyMs);
        if (!response?.success) {
          results.joinErrors++;
          if (results.errors.length < 50) {
            results.errors.push(
              `worker ${workerId}: joinRoom failed: ${
                response?.code || "unknown"
              }`
            );
          }
        }
      } catch (e) {
        results.joinErrors++;
        if (results.errors.length < 50) {
          results.errors.push(`worker ${workerId}: join ${e.message}`);
        }
      }
    }

    if (HOLD_MS > 0) await sleep(HOLD_MS);
  } catch (err) {
    results.connectErrors++;
    if (results.errors.length < 50) {
      results.errors.push(`worker ${workerId}: ${err?.message || String(err)}`);
    }
  } finally {
    socket.disconnect();
    results.cyclesDone++;
  }
}

async function worker(workerId, cyclesForWorker) {
  for (let i = 0; i < cyclesForWorker; i++) {
    await oneCycle(workerId);
  }
}

async function sampleMetrics(tag) {
  if (!METRICS_URL) return;
  if (typeof fetch !== "function") {
    console.log(`[metrics @ ${tag}] fetch unavailable in this Node runtime — skipping`);
    return;
  }
  try {
    const res = await fetch(METRICS_URL, {
      headers: { cookie: `accessToken=${TOKEN}` },
    });
    const text = await res.text();
    console.log(
      `\n[metrics @ ${tag}] ${METRICS_URL} -> ${res.status}\n${text.slice(0, 2000)}`
    );
  } catch (e) {
    console.log(`[metrics @ ${tag}] fetch failed: ${e.message}`);
  }
}

// ---------- main ----------
async function main() {
  console.log(
    `Connect/disconnect soak: cycles=${CYCLES}, concurrency=${CONCURRENCY}, ` +
      `join=${JOIN}, holdMs=${HOLD_MS}, url=${URL}`
  );
  console.log(
    "Reminder: capture backend RSS + mediasoup worker / socket-map counts NOW (baseline). See the README."
  );

  await sampleMetrics("start");

  const start = performance.now();

  // distribute cycles as evenly as possible across the worker pool
  const base = Math.floor(CYCLES / CONCURRENCY);
  const extra = CYCLES % CONCURRENCY;
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    const c = base + (w < extra ? 1 : 0);
    if (c > 0) workers.push(worker(w, c));
  }
  await Promise.allSettled(workers);

  const elapsedSec = (performance.now() - start) / 1000;

  console.log(`\nSettling ${SETTLE_MS}ms so the server can finish disconnect cleanup...`);
  await sleep(SETTLE_MS);
  await sampleMetrics("end");

  console.log("\n=== Results ===");
  summarize("socket connect", results.connectMs);
  if (JOIN) summarize("joinRoom ack", results.joinMs);
  console.log(`cycles completed:      ${results.cyclesDone}/${CYCLES}`);
  console.log(`connect errors:        ${results.connectErrors}`);
  if (JOIN) console.log(`join errors:           ${results.joinErrors}`);
  console.log(
    `throughput:            ${(results.cyclesDone / elapsedSec).toFixed(1)} cycles/sec ` +
      `over ${elapsedSec.toFixed(1)}s`
  );

  console.log(
    "\nLEAK CHECK: compare backend RSS + mediasoup worker / socket-map counts to your baseline."
  );
  console.log(
    "They should return to ~baseline after the settle window. A monotonic climb across repeated runs indicates a leak."
  );

  if (results.errors.length > 0) {
    console.log(`\nSample errors (${results.errors.length}):`);
    console.log(results.errors.slice(0, 10).join("\n"));
    if (results.errors.length > 10) {
      console.log(`...and ${results.errors.length - 10} more`);
    }
  }

  process.exit(0);
}

main();
