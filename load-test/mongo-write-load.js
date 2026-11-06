// mongo-write-load.js
//
// CrowdStream MongoDB write-load test.
//
// Drives high join/leave churn against a live room to stress MongoDB writes and
// measure how joinRoom ack latency degrades under sustained write pressure.
//
// WHY joins create write pressure (see backend registerViewer.handler.ts):
//   Each successful joinRoom triggers ~2 Mongo writes:
//     1. Viewer.create({...})                          -> insert a viewer doc
//     2. LiveRoom.updateOne({experienceRoomId}, {$inc: -> increment counters
//                            {totalViewersJoined: 1}})
//   Viewer-session lifecycle + peak-viewer bookkeeping are also persisted.
//   So high connect/join/disconnect churn = sustained write pressure.
//
// This is a load generator only. Sample Mongo concurrently (see the printed
// reminder / MONGO-WRITE-LOAD.md) to correlate ack latency with DB pressure.
//
// Authored by Claude (Anthropic), via Claude Code -- 2026-08-27.

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
const CYCLES = parseInt(arg("cycles", "2000"), 10);
const CONCURRENCY = parseInt(arg("concurrency", "50"), 10);
const HOLD_MS = parseInt(arg("holdMs", "0"), 10);
const RAMP_MS = parseInt(arg("rampMs", "0"), 10);
const ACK_TIMEOUT_MS = parseInt(arg("timeout", "8000"), 10);

// ---------- arg validation ----------
if (!TOKEN) {
  console.error(
    "Missing --token <jwt>. The server's JWT middleware rejects unauthenticated " +
      "sockets (auth cookie accessToken via extraHeaders). NEVER hardcode this."
  );
  process.exit(1);
}

if (!ROOM_ID) {
  console.error(
    "Missing --room <roomId>. Start a broadcast to create a LIVE room, then pass " +
      "its id so joinRoom resolves (otherwise every join returns ROOM_NOT_FOUND)."
  );
  process.exit(1);
}

if (!Number.isFinite(CYCLES) || CYCLES <= 0) {
  console.error("Invalid --cycles: must be a positive integer.");
  process.exit(1);
}

if (!Number.isFinite(CONCURRENCY) || CONCURRENCY <= 0) {
  console.error("Invalid --concurrency: must be a positive integer.");
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
    `${label.padEnd(32)} ` +
      `n=${clean.length.toString().padEnd(5)} ` +
      `avg=${avg.toFixed(1)}ms  ` +
      `p50=${percentile(clean, 50).toFixed(1)}ms  ` +
      `p90=${percentile(clean, 90).toFixed(1)}ms  ` +
      `p95=${percentile(clean, 95).toFixed(1)}ms  ` +
      `p99=${percentile(clean, 99).toFixed(1)}ms  ` +
      `max=${clean[clean.length - 1].toFixed(1)}ms`
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

// ---------- shared state ----------
const results = {
  joinRoomMs: [],
  joinSuccess: 0,
  joinFail: 0,
  connectErrors: 0,
  cyclesCompleted: 0,
  errors: [],
};

let nextCycle = 0; // shared cursor consumed by the worker pool

// ---------- one join/leave cycle ----------
// connect -> joinRoom (measure ack latency) -> optional hold -> disconnect
async function runCycle(cycleIdx) {
  const socket = io(URL, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    extraHeaders: {
      cookie: `accessToken=${TOKEN}`,
    },
  });

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
  } catch (err) {
    results.connectErrors++;
    results.errors.push(
      `cycle ${cycleIdx}: connect: ${err?.message || String(err)}`
    );
    socket.disconnect();
    return;
  }

  try {
    // 2. JOIN ROOM (this is what forces the Mongo writes)
    const {
      response: joinRes,
      latencyMs: joinLatency,
    } = await ackWithTimeout(socket, "joinRoom", ROOM_ID);

    results.joinRoomMs.push(joinLatency);

    if (joinRes?.success) {
      results.joinSuccess++;
    } else {
      results.joinFail++;
      results.errors.push(
        `cycle ${cycleIdx}: joinRoom failed: ${
          joinRes?.code || "unknown error"
        }`
      );
    }

    // 3. OPTIONAL HOLD (keep the viewer session alive before churning out)
    if (HOLD_MS > 0) {
      await sleep(HOLD_MS);
    }
  } catch (err) {
    results.joinFail++;
    results.errors.push(
      `cycle ${cycleIdx}: joinRoom: ${err?.message || String(err)}`
    );
  } finally {
    // 4. DISCONNECT (leave) -> next cycle
    socket.disconnect();
  }
}

// ---------- worker pool ----------
// CONCURRENCY workers each pull the next cycle index off the shared cursor
// until CYCLES total join/leave cycles are done (same pattern as a soak).
async function worker(workerIdx) {
  if (RAMP_MS > 0) {
    // Stagger worker startup across the ramp window (0 => start immediately).
    await sleep((RAMP_MS / CONCURRENCY) * workerIdx);
  }

  for (;;) {
    const idx = nextCycle++;
    if (idx >= CYCLES) break;

    await runCycle(idx);
    results.cyclesCompleted++;
  }
}

// ---------- main ----------
async function main() {
  console.log(
    `Starting Mongo write-load test: ` +
      `${CYCLES} join/leave cycles, ` +
      `concurrency=${CONCURRENCY}, ` +
      `holdMs=${HOLD_MS}, ` +
      `rampMs=${RAMP_MS}, ` +
      `room=${ROOM_ID}, ` +
      `url=${URL}`
  );

  console.log(
    "\n>>> REMINDER: sample MongoDB CONCURRENTLY while this runs so you can\n" +
      ">>> correlate join-ack latency with DB write pressure. In another shell:\n" +
      ">>>   mongostat --rowcount 0            # watch insert / update / dirty %\n" +
      ">>>   mongosh> db.serverStatus().opcounters        # insert & update deltas\n" +
      ">>>   mongosh> db.currentOp({ active: true })       # in-flight write ops\n" +
      ">>> Each join = Viewer.create (insert) + LiveRoom $inc (update). See README.\n"
  );

  const wallStart = performance.now();

  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(worker(w));
  }

  await Promise.allSettled(workers);

  const elapsedMs = performance.now() - wallStart;
  const elapsedSec = elapsedMs / 1000;

  console.log("\n=== Results ===");

  summarize("joinRoom ack", results.joinRoomMs);

  console.log(
    `\ncycles completed:  ${results.cyclesCompleted}/${CYCLES}`
  );
  console.log(`join successes:    ${results.joinSuccess}`);
  console.log(`join failures:     ${results.joinFail}`);
  console.log(`connect errors:    ${results.connectErrors}`);
  console.log(
    `wall time:         ${elapsedSec.toFixed(2)}s`
  );

  // Throughput of successful joins == sustained Mongo write pressure driven.
  const joinsPerSec =
    elapsedSec > 0 ? results.joinSuccess / elapsedSec : 0;

  console.log(
    `throughput:        ${joinsPerSec.toFixed(1)} joins/sec ` +
      `(~${(joinsPerSec * 2).toFixed(1)} Mongo writes/sec: insert + $inc)`
  );

  if (results.errors.length > 0) {
    console.log(
      `\nSample errors (${results.errors.length} total):`
    );
    console.log(results.errors.slice(0, 10).join("\n"));

    if (results.errors.length > 10) {
      console.log(
        `...and ${results.errors.length - 10} more`
      );
    }
  }
}

main();
