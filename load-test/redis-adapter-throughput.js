/**
 * redis-adapter-throughput.js
 *
 * CrowdStream — Redis adapter (cross-pod pub/sub) throughput load test.
 *
 * Purpose: stress the @socket.io/redis-adapter cross-pod fan-out path and
 * expose Redis pub/sub ops + CPU as the scaling bottleneck. Many receivers are
 * spread round-robin across >=2 pod URLs that share one (sharded) Redis, so
 * every chat broadcast MUST traverse Redis pub/sub to reach receivers on other
 * pods. Senders (a subset of receivers) emit chat:message at a fixed rate; each
 * body carries an in-payload send timestamp so receivers can compute fan-out
 * latency against the shared process clock.
 *
 * Style matches load-test/signaling-latency.js (socket.io-client, arg(),
 * percentile(), summarize(), ackWithTimeout()).
 *
 * SECURITY: never hardcode secrets. The JWT is passed via --token at runtime
 * and sent as the accessToken cookie, exactly like the signaling test.
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

const URLS_ARG = arg("urls", null);
const URL_SINGLE = arg("url", null);
const TOKEN = arg("token", null);
const ROOM_ID = arg("room", null);
const NUM_RECEIVERS = parseInt(arg("receivers", "300"), 10);
let NUM_SENDERS = parseInt(arg("senders", "30"), 10);
const RATE = parseFloat(arg("rate", "5"));
const DURATION_MS = parseInt(arg("durationMs", "30000"), 10);
const RAMP_MS = parseInt(arg("rampMs", "10000"), 10);
const ACK_TIMEOUT_MS = parseInt(arg("timeout", "8000"), 10);

// A per-run tag so receivers only count THIS run's broadcasts and ignore any
// unrelated chat traffic already flowing in the live room.
const RUN_ID = Math.random().toString(36).slice(2, 8);

// ---------- URL resolution ----------
function resolveUrls() {
  if (URLS_ARG) {
    return URLS_ARG.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (URL_SINGLE) {
    return [URL_SINGLE.trim()];
  }
  return [];
}

const URLS = resolveUrls();

// ---------- arg validation ----------
const argErrors = [];

if (URLS.length === 0) {
  argErrors.push(
    "Missing --urls <podA,podB,...> (or --url <single>). Provide >=2 pod " +
      "URLs sharing one Redis to exercise cross-pod fan-out."
  );
}

if (!TOKEN) {
  argErrors.push(
    "Missing --token <jwt>. The socket JWT middleware rejects " +
      "unauthenticated connections."
  );
}

if (!ROOM_ID) {
  argErrors.push(
    "Missing --room <uuid>. Must be a live room; senders join it to " +
      "broadcast chat. roomId must be a UUID."
  );
}

if (!Number.isFinite(NUM_RECEIVERS) || NUM_RECEIVERS < 1) {
  argErrors.push("--receivers must be a positive integer.");
}

if (!Number.isFinite(NUM_SENDERS) || NUM_SENDERS < 1) {
  argErrors.push("--senders must be a positive integer.");
}

if (!Number.isFinite(RATE) || RATE <= 0) {
  argErrors.push("--rate must be a positive number (messages/sec per sender).");
}

if (!Number.isFinite(DURATION_MS) || DURATION_MS < 1) {
  argErrors.push("--durationMs must be a positive integer.");
}

if (!Number.isFinite(RAMP_MS) || RAMP_MS < 0) {
  argErrors.push("--rampMs must be a non-negative integer.");
}

if (argErrors.length > 0) {
  console.error(
    "Argument errors:\n" + argErrors.map((e) => `  - ${e}`).join("\n")
  );
  process.exit(1);
}

// ---------- warnings (non-fatal) ----------
if (NUM_SENDERS > NUM_RECEIVERS) {
  console.warn(
    `--senders (${NUM_SENDERS}) > --receivers (${NUM_RECEIVERS}); clamping ` +
      `senders to ${NUM_RECEIVERS} (senders are a subset of receivers).`
  );
  NUM_SENDERS = NUM_RECEIVERS;
}

if (URLS.length === 1) {
  console.warn(
    "WARNING: only one pod URL supplied — this does NOT exercise cross-pod " +
      "Redis fan-out. Pass --urls with >=2 pod URLs that share the same " +
      "Redis for a real adapter test."
  );
}

// ---------- percentile ----------
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
      `n=${clean.length.toString().padEnd(8)} ` +
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- shared state ----------
const state = {
  connectErrors: [],
  joinErrors: [],
  rateLimited: 0,
  moderated: 0,
  totalSent: 0,
  totalDeliveries: 0,
  fanOutLatencyMs: [],
  firstDeliveryAt: null,
  lastDeliveryAt: null,
};

// Only count deliveries that belong to THIS run and carry our send timestamp.
// Body format: cslt|<runId>-<senderIdx>-<seq>|<Date.now()>
function onChatMessage(payload) {
  if (payload?.roomId && payload.roomId !== ROOM_ID) return;

  const body = payload?.message;
  if (typeof body !== "string" || !body.startsWith("cslt|")) return;

  const parts = body.split("|");
  if (parts.length < 3) return;

  const nonce = parts[1];
  if (!nonce.startsWith(`${RUN_ID}-`)) return;

  const sentAt = Number(parts[2]);
  if (!Number.isFinite(sentAt)) return;

  const now = Date.now();

  state.totalDeliveries += 1;
  state.fanOutLatencyMs.push(now - sentAt);

  if (state.firstDeliveryAt === null) state.firstDeliveryAt = now;
  state.lastDeliveryAt = now;
}

// ---------- receiver: connect (round-robin) + joinRoom + listen ----------
async function connectReceiver(idx) {
  const url = URLS[idx % URLS.length];

  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    extraHeaders: {
      cookie: `accessToken=${TOKEN}`,
    },
  });

  // Attach listeners immediately so we never miss an early broadcast.
  socket.on("chat:message", onChatMessage);
  socket.on("chat:rateLimited", () => {
    state.rateLimited += 1;
  });
  socket.on("chat:moderated", () => {
    state.moderated += 1;
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

    // 2. JOIN ROOM (required to send/receive that room's chat)
    const { response } = await ackWithTimeout(socket, "joinRoom", ROOM_ID);

    if (!response?.success) {
      throw new Error(`joinRoom failed: ${response?.code || "unknown error"}`);
    }

    return socket;
  } catch (err) {
    socket.disconnect();
    throw err;
  }
}

// ---------- sender: emit chat:message (NO ack) at --rate for --durationMs ----------
function startSender(socket, senderIdx) {
  let seq = 0;
  const intervalMs = 1000 / RATE;

  return setInterval(() => {
    seq += 1;

    // cslt|<runId>-<senderIdx>-<seq>|<sentAt>  (1..500 chars, well under cap)
    const message = `cslt|${RUN_ID}-${senderIdx}-${seq}|${Date.now()}`;

    socket.emit("chat:message", { roomId: ROOM_ID, message });
    state.totalSent += 1;
  }, intervalMs);
}

// ---------- report ----------
function report(senderCount, joinedReceivers) {
  console.log("\n=== Redis adapter cross-pod fan-out results ===");

  summarize("fan-out latency (recv-sent)", state.fanOutLatencyMs);

  const sendWindowSec = DURATION_MS / 1000;
  const expected = state.totalSent * joinedReceivers; // sent × receivers
  const deliveryPct =
    expected > 0 ? (state.totalDeliveries / expected) * 100 : 0;

  const spanMs =
    state.firstDeliveryAt !== null && state.lastDeliveryAt !== null
      ? Math.max(1, state.lastDeliveryAt - state.firstDeliveryAt)
      : null;

  const broadcastRate = spanMs
    ? state.totalDeliveries / (spanMs / 1000)
    : 0;

  const sendRate = sendWindowSec > 0 ? state.totalSent / sendWindowSec : 0;

  console.log("");
  console.log(`pods (Redis fan-out spread):     ${URLS.length}`);
  console.log(
    `receivers:                       ${joinedReceivers} joined / ` +
      `${NUM_RECEIVERS} requested`
  );
  console.log(`senders:                         ${senderCount} @ ${RATE} msg/s`);
  console.log(`messages sent (emit count):      ${state.totalSent}`);
  console.log(`send rate into system:           ${sendRate.toFixed(1)} msg/s`);
  console.log(`expected deliveries (sent×recv): ${expected}`);
  console.log(`actual deliveries:               ${state.totalDeliveries}`);
  console.log(`delivery ratio:                  ${deliveryPct.toFixed(1)}%`);
  console.log(
    `aggregate broadcast rate:        ${broadcastRate.toFixed(0)} deliveries/s` +
      (spanMs ? ` over ${(spanMs / 1000).toFixed(1)}s observed span` : "")
  );
  console.log(
    "  ^ cross-pod fan-out load Redis pub/sub carried (deliveries/sec)"
  );
  console.log("");
  console.log(`rate-limited events:             ${state.rateLimited}`);
  console.log(`moderated events:                ${state.moderated}`);
  console.log(`connect errors:                  ${state.connectErrors.length}`);
  console.log(`join errors:                     ${state.joinErrors.length}`);

  if (URLS.length === 1) {
    console.log(
      "\nNOTE: single pod — broadcasts did not traverse Redis between pods. " +
        "Re-run with --urls <podA,podB,...> for a real cross-pod test."
    );
  }

  const allErrs = [...state.connectErrors, ...state.joinErrors];
  if (allErrs.length > 0) {
    console.log("\nSample errors:");
    console.log(allErrs.slice(0, 10).join("\n"));
    if (allErrs.length > 10) {
      console.log(`...and ${allErrs.length - 10} more`);
    }
  }
}

// ---------- main ----------
async function main() {
  console.log(
    "=== CrowdStream Redis adapter (cross-pod pub/sub) throughput test ==="
  );
  console.log(`pods:        ${URLS.length} (${URLS.join(", ")})`);
  console.log(`room:        ${ROOM_ID}`);
  console.log(`receivers:   ${NUM_RECEIVERS} (round-robin across pods)`);
  console.log(`senders:     ${NUM_SENDERS} @ ${RATE} msg/s`);
  console.log(
    `duration:    ${DURATION_MS}ms  ramp: ${RAMP_MS}ms  ` +
      `timeout: ${ACK_TIMEOUT_MS}ms`
  );
  console.log(`run id:      ${RUN_ID}`);
  console.log("");

  // Phase 1 — ramped connect + join of all receivers.
  const receivers = new Array(NUM_RECEIVERS).fill(null);
  const delayBetween = NUM_RECEIVERS > 0 ? RAMP_MS / NUM_RECEIVERS : 0;
  const connectRuns = [];

  for (let i = 0; i < NUM_RECEIVERS; i++) {
    const run = connectReceiver(i)
      .then((socket) => {
        receivers[i] = socket;
      })
      .catch((err) => {
        const msg = err?.message || String(err);
        if (msg.startsWith("joinRoom")) {
          state.joinErrors.push(`receiver ${i}: ${msg}`);
        } else {
          state.connectErrors.push(`receiver ${i}: ${msg}`);
        }
      });

    connectRuns.push(run);

    if (delayBetween > 0) {
      await sleep(delayBetween);
    }
  }

  await Promise.allSettled(connectRuns);

  const connected = receivers.filter(Boolean);

  console.log(
    `Connected + joined ${connected.length}/${NUM_RECEIVERS} receivers ` +
      `across ${URLS.length} pod(s).`
  );

  if (connected.length === 0) {
    console.error("No receivers connected/joined; aborting.");
    report(0, 0);
    process.exit(1);
  }

  // Phase 2 — senders are the first N joined receivers.
  const senderSockets = connected.slice(
    0,
    Math.min(NUM_SENDERS, connected.length)
  );

  console.log(
    `Starting ${senderSockets.length} senders at ${RATE} msg/s for ` +
      `${DURATION_MS}ms ...`
  );

  const timers = senderSockets.map((socket, i) => startSender(socket, i));

  await sleep(DURATION_MS);
  timers.forEach((t) => clearInterval(t));

  // Phase 3 — drain: let in-flight cross-pod broadcasts land before tallying.
  console.log(
    `Send window closed; draining ${ACK_TIMEOUT_MS}ms for in-flight fan-out ...`
  );
  await sleep(ACK_TIMEOUT_MS);

  // Teardown.
  connected.forEach((socket) => socket.disconnect());

  report(senderSockets.length, connected.length);

  // Force exit — socket.io-client engine timers can otherwise keep the loop alive.
  process.exit(0);
}

main().catch((err) => {
  console.error("\nTEST FAILED:");
  console.error(err);
  process.exit(1);
});
