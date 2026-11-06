// recording-concurrency.js — CrowdStream server-side recording load test
//
// Ramps N concurrent server-side recordings against a single LIVE room to find
// the saturation point. Each recording makes the server spawn an FFmpeg process,
// create an audio+video mediasoup PlainTransport pair, and allocate 2 RTP UDP
// ports — so this is CPU / disk / file-descriptor / port heavy. The true ceiling
// is the host, not this client: sample the server externally (see README).
//
// Protocol (verified against backend/src/utils/socket.util.ts):
//   - auth: JWT cookie `accessToken` via extraHeaders
//   - joinRoom(roomId, ack) -> { success, data:{...} }   (must join before recording)
//   - start-recording(roomId)  -> emit with roomId as the single payload arg, NO ack;
//                                  server replies with a `recording-started {recordingId}`
//                                  event to this socket on success. On failure the server
//                                  only logs — the client just never hears back (timeout).
//   - stop-recording(roomId, ack) -> server stops FFmpeg / closes transports / releases
//                                  ports, then calls ack(). No active recording or an
//                                  error means ack never fires (timeout).
//
// Authored by Claude (Anthropic), via Claude Code — 2026-08-27.

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
const NUM_RECORDERS = parseInt(arg("recorders", "20"), 10);
const RAMP_MS = parseInt(arg("rampMs", "10000"), 10);
const RECORD_MS = parseInt(arg("recordMs", "30000"), 10);
const ACK_TIMEOUT_MS = parseInt(arg("timeout", "15000"), 10);

if (!TOKEN) {
  console.error(
    "Missing --token <jwt>. The server's JWT middleware rejects unauthenticated sockets."
  );
  process.exit(1);
}

if (!ROOM_ID) {
  console.error(
    "Missing --room <roomId>. Pass a LIVE room that has a broadcaster producing audio+video — " +
      "recordings consume the room's producers, so an empty room records nothing."
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

// ---------- start-recording helper ----------
// start-recording has NO ack: we emit the roomId and wait for the server to emit
// a `recording-started` event back to this socket. The gap between the emit and
// that event is the "start latency" — the cost of spawning FFmpeg + building the
// PlainTransport pair + allocating RTP ports under whatever load already exists.
function startRecordingAndWait(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("recording-started", onStarted);
      reject(
        new Error(
          "recording-started timeout (server likely saturated: CPU/disk/FD/ports)"
        )
      );
    }, ACK_TIMEOUT_MS);

    const t0 = performance.now();

    const onStarted = (payload) => {
      clearTimeout(timer);
      resolve({
        latencyMs: performance.now() - t0,
        recordingId: payload?.recordingId,
      });
    };

    socket.once("recording-started", onStarted);
    socket.emit("start-recording", ROOM_ID);
  });
}

const results = {
  connectMs: [],
  joinRoomMs: [],
  startRecordingMs: [],
  stopAckMs: [],
  errors: [],
};

// ---------- per-recorder ----------
async function runRecorder(idx) {
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
    const connectStart = performance.now();

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

    results.connectMs.push(performance.now() - connectStart);

    // 2. JOIN ROOM (must be a viewer before recording)
    const {
      response: joinRes,
      latencyMs: joinLatency,
    } = await ackWithTimeout(socket, "joinRoom", ROOM_ID);

    results.joinRoomMs.push(joinLatency);

    if (!joinRes?.success) {
      throw new Error(
        `joinRoom failed: ${joinRes?.code || "unknown error"}`
      );
    }

    // 3. START RECORDING (spawns FFmpeg + PlainTransport pair + 2 RTP ports)
    const { latencyMs: startLatency } =
      await startRecordingAndWait(socket);

    results.startRecordingMs.push(startLatency);

    // 4. HOLD the recording open so concurrent FFmpeg load overlaps
    await new Promise((resolve) =>
      setTimeout(resolve, RECORD_MS)
    );

    // 5. STOP RECORDING (stops FFmpeg, closes transports/consumers, frees ports)
    const { latencyMs: stopLatency } = await ackWithTimeout(
      socket,
      "stop-recording",
      ROOM_ID
    );

    results.stopAckMs.push(stopLatency);
  } catch (err) {
    results.errors.push(
      `recorder ${idx}: ${err?.message || String(err)}`
    );
  } finally {
    socket.disconnect();
  }
}

// ---------- main ----------
async function main() {
  console.log(
    `Starting recording-concurrency load test: ` +
      `${NUM_RECORDERS} recorders, ` +
      `ramped over ${RAMP_MS}ms, ` +
      `hold ${RECORD_MS}ms, ` +
      `room=${ROOM_ID}`
  );
  console.log(
    `Each recording = 1 FFmpeg process + 1 PlainTransport pair + 2 RTP UDP ports on the server.`
  );

  const delayBetween =
    NUM_RECORDERS > 0 ? RAMP_MS / NUM_RECORDERS : 0;

  const runs = [];

  for (let i = 0; i < NUM_RECORDERS; i++) {
    runs.push(runRecorder(i));

    if (delayBetween > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, delayBetween)
      );
    }
  }

  await Promise.allSettled(runs);

  console.log("\n=== Results ===");

  console.log(
    `start-recording success: ${results.startRecordingMs.length}/${NUM_RECORDERS}`
  );
  console.log(
    `stop-recording ack success: ${results.stopAckMs.length}/${NUM_RECORDERS}`
  );

  summarize("socket connect", results.connectMs);
  summarize("joinRoom ack", results.joinRoomMs);
  summarize("start-recording latency", results.startRecordingMs);
  summarize("stop-recording ack", results.stopAckMs);

  const timeouts = results.errors.filter((e) =>
    e.includes("timeout")
  ).length;

  console.log(
    `\nFailures: ${results.errors.length}/${NUM_RECORDERS} ` +
      `(of which timeouts: ${timeouts})`
  );

  if (results.errors.length > 0) {
    console.log(results.errors.slice(0, 10).join("\n"));

    if (results.errors.length > 10) {
      console.log(`...and ${results.errors.length - 10} more`);
    }
  }

  console.log(
    "\nNOTE: these are client-observed numbers only. The real recording ceiling is " +
      "server-side — FFmpeg CPU, disk write throughput, open file descriptors, and RTP " +
      "UDP port exhaustion. Start latency climbing and start/stop timeouts appearing are " +
      "the client-visible symptoms; sample the server externally to find the true limit " +
      "(see RECORDING-CONCURRENCY.md)."
  );
}

main();
