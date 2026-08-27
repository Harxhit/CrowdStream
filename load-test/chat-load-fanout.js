/**
 * chat-load-fanout.js
 * -----------------------------------------------------------------------------
 * Week 5 (Real-time messaging) — chat fan-out load test.
 *
 * Spins up many viewers that join a room and listen for `chat:message`
 * broadcasts. A subset of them send messages. Measures end-to-end fan-out
 * latency (sender emit -> receiver delivery), delivery completeness, and how
 * often the server's rate limiter / moderation engage under load.
 *
 * Cross-pod: pass  --urls "http://pod1,http://pod2"  to spread clients across
 * signaling pods so fan-out exercises the Redis adapter (the Week 3/5 goal).
 *
 * Latency method: each message body embeds a nonce + the sender's wall-clock
 * send time  ("cslt|<nonce>|<sendEpochMs>").  Every receiver parses it on
 * delivery and computes (Date.now() - sendEpochMs). All sockets run in ONE
 * process, so Date.now() is a shared clock and the number is true end-to-end
 * fan-out latency (server validate + moderate + rate-limit + Redis publish +
 * broadcast). `chat:message` has no ack, which is why latency is carried in
 * the payload rather than measured with an ack round-trip.
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

const URLS = arg("urls", arg("url", "http://localhost:3000"))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const TOKEN = arg("token", null);
const ROOM_ID = arg("room", null);
const RECEIVERS = parseInt(arg("receivers", "200"), 10); // viewers that join + listen
const SENDERS = parseInt(arg("senders", "20"), 10); // subset that also send
const MESSAGES = parseInt(arg("messages", "10"), 10); // messages per sender
const SEND_INTERVAL_MS = parseInt(arg("sendIntervalMs", "1500"), 10); // spacing per sender (respects rate limit)
const RAMP_MS = parseInt(arg("rampMs", "10000"), 10); // ramp for connect+join
const ACK_TIMEOUT_MS = parseInt(arg("timeout", "8000"), 10);
const DRAIN_MS = parseInt(arg("drainMs", "5000"), 10); // wait for in-flight broadcasts after last send

if (!TOKEN) {
  console.error(
    "Missing --token <jwt>. The server's socket auth rejects unauthenticated connections."
  );
  process.exit(1);
}
if (!ROOM_ID) {
  console.error(
    "Missing --room <roomId>. Start a broadcast to create a room, then pass its id."
  );
  process.exit(1);
}
if (SENDERS > RECEIVERS) {
  console.error(
    `--senders (${SENDERS}) cannot exceed --receivers (${RECEIVERS}); senders are a subset of receivers.`
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
  joinMs: [],
  fanoutMs: [], // one sample per (message x receiver) delivery
  sent: 0,
  delivered: 0, // total deliveries observed during the send phase
  rateLimited: 0,
  moderated: 0,
  connectErrors: 0,
  joinErrors: 0,
  errors: [],
};

const nonceDeliveries = new Map(); // nonce -> how many receivers got it

let seq = 0;
function makeNonce(senderIdx, msgIdx) {
  return `s${senderIdx}-m${msgIdx}-${seq++}`;
}

// ---------- connect a receiver and join the room ----------
async function connectAndJoin(idx) {
  const url = URLS[idx % URLS.length];
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    extraHeaders: {
      cookie: `accessToken=${TOKEN}`,
    },
  });

  // Every joined socket is a receiver: measure fan-out latency + delivery count.
  socket.on("chat:message", (msg) => {
    results.delivered++;
    const body = typeof msg?.message === "string" ? msg.message : "";
    if (body.startsWith("cslt|")) {
      const parts = body.split("|");
      const nonce = parts[1];
      const sentAt = Number(parts[2]);
      if (Number.isFinite(sentAt)) {
        results.fanoutMs.push(Date.now() - sentAt);
      }
      if (nonce) {
        nonceDeliveries.set(nonce, (nonceDeliveries.get(nonce) || 0) + 1);
      }
    }
  });

  try {
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
          `client ${idx}: joinRoom failed: ${response?.code || "unknown"}`
        );
      }
      socket.disconnect();
      return null;
    }

    return socket;
  } catch (err) {
    results.connectErrors++;
    if (results.errors.length < 50) {
      results.errors.push(`client ${idx}: ${err?.message || String(err)}`);
    }
    socket.disconnect();
    return null;
  }
}

// ---------- sender loop ----------
async function runSender(socket, senderIdx) {
  socket.on("chat:rateLimited", () => {
    results.rateLimited++;
  });
  socket.on("chat:moderated", () => {
    results.moderated++;
  });

  for (let m = 0; m < MESSAGES; m++) {
    const nonce = makeNonce(senderIdx, m);
    const body = `cslt|${nonce}|${Date.now()}`;
    socket.emit("chat:message", { roomId: ROOM_ID, message: body });
    results.sent++;
    if (m < MESSAGES - 1) await sleep(SEND_INTERVAL_MS);
  }
}

// ---------- main ----------
async function main() {
  console.log(
    `Chat fan-out load test: receivers=${RECEIVERS}, senders=${SENDERS}, ` +
      `messages/sender=${MESSAGES}, sendInterval=${SEND_INTERVAL_MS}ms`
  );
  console.log(`pods=${URLS.length} (${URLS.join(", ")}), room=${ROOM_ID}`);

  // Ramp connect + join.
  const delayBetween = RECEIVERS > 0 ? RAMP_MS / RECEIVERS : 0;
  const conns = [];
  for (let i = 0; i < RECEIVERS; i++) {
    conns.push(connectAndJoin(i));
    if (delayBetween > 0) await sleep(delayBetween);
  }
  const sockets = await Promise.all(conns);
  const joined = sockets.filter(Boolean);
  console.log(
    `\nJoined ${joined.length}/${RECEIVERS} receivers. ` +
      `Starting ${Math.min(SENDERS, joined.length)} senders...`
  );

  if (joined.length === 0) {
    console.error(
      "No receivers joined — is the room live and the token valid? Aborting."
    );
    process.exit(1);
  }

  // Only count deliveries for the send phase (ignore anything before senders start).
  results.delivered = 0;
  results.fanoutMs.length = 0;
  nonceDeliveries.clear();

  const senderCount = Math.min(SENDERS, joined.length);
  const senderRuns = [];
  for (let s = 0; s < senderCount; s++) {
    senderRuns.push(runSender(joined[s], s));
  }
  await Promise.all(senderRuns);

  console.log(
    `\nAll messages sent (${results.sent}). Draining ${DRAIN_MS}ms for delivery...`
  );
  await sleep(DRAIN_MS);

  // Delivery completeness. Each message that passes the server gate should
  // reach every joined receiver. Rate-limited / moderated messages never
  // broadcast, so they simply won't appear in nonceDeliveries.
  const totalExpected = results.sent * joined.length;
  const totalReceived = results.delivered;
  let fullyDelivered = 0;
  for (const [, count] of nonceDeliveries) {
    if (count >= joined.length) fullyDelivered++;
  }

  console.log("\n=== Results ===");
  summarize("joinRoom ack", results.joinMs);
  summarize("chat fan-out (emit->deliver)", results.fanoutMs);
  console.log(`messages sent:          ${results.sent}`);
  console.log(`receivers joined:       ${joined.length}`);
  console.log(
    `deliveries received:    ${totalReceived} / ${totalExpected} expected  ` +
      `(${totalExpected ? ((100 * totalReceived) / totalExpected).toFixed(1) : "0"}%)`
  );
  console.log(
    `messages broadcast:     ${nonceDeliveries.size} / ${results.sent} sent ` +
      `(rest blocked by rate-limit/moderation)`
  );
  console.log(
    `fully fanned-out:       ${fullyDelivered} / ${nonceDeliveries.size} broadcast messages reached all receivers`
  );
  console.log(`rate-limited events:    ${results.rateLimited}`);
  console.log(`moderated events:       ${results.moderated}`);
  console.log(`connect errors:         ${results.connectErrors}`);
  console.log(`join errors:            ${results.joinErrors}`);

  if (results.rateLimited > 0) {
    console.log(
      `\nNote: ${results.rateLimited} messages were rate-limited by the server (expected under load).`
    );
    console.log(
      "Raise --sendIntervalMs or lower --senders/--messages to stay under the token bucket,"
    );
    console.log("or relax the limit server-side for a pure throughput test.");
  }

  if (results.errors.length > 0) {
    console.log(`\nSample errors (${results.errors.length}):`);
    console.log(results.errors.slice(0, 10).join("\n"));
    if (results.errors.length > 10) {
      console.log(`...and ${results.errors.length - 10} more`);
    }
  }

  for (const s of joined) s.disconnect();
  process.exit(0);
}

main();
