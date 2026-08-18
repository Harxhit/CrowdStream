const { io } = require("socket.io-client");

// ---------- CLI args ----------
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const URL = arg("url", "http://localhost:3000");
const ROOM_ID = arg("room", null);
console.log("ROOMID", ROOM_ID);

const TOKEN = arg("token", null);
const NUM_VIEWERS = parseInt(arg("viewers", "100"), 10);
const RAMP_MS = parseInt(arg("rampMs", "5000"), 10);
const WITH_CONSUME = arg("withConsume", "true") === "true";
const ACK_TIMEOUT_MS = parseInt(arg("timeout", "8000"), 10);

if (!ROOM_ID) {
  console.error(
    "Missing --room <roomId>. Create a room first (start a broadcast), then pass its id."
  );
  process.exit(1);
}

if (!TOKEN) {
  console.error(
    "Missing --token <jwt>. Your server's JWT middleware rejects unauthenticated sockets."
  );
  process.exit(1);
}

// ---------- fake DTLS ----------
function fakeDtlsParameters() {
  const hex = () =>
    Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
    ).join(":");

  return {
    role: "client",
    fingerprints: [
      {
        algorithm: "sha-256",
        value: hex(),
      },
    ],
  };
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

const results = {
  connectMs: [],
  joinRoomMs: [],
  createTransportMs: [],
  connectTransportMs: [],
  consumeMs: [],
  resumeMs: [],
  totalSignalingMs: [],
  errors: [],
};

// ---------- per-viewer ----------
async function runViewer(idx) {
  const overallStart = performance.now();

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

    results.connectMs.push(
      performance.now() - connectStart
    );

    // 2. JOIN ROOM
    const {
      response: joinRes,
      latencyMs: joinLatency,
    } = await ackWithTimeout(
      socket,
      "joinRoom",
      ROOM_ID
    );

    results.joinRoomMs.push(joinLatency);

    if (!joinRes?.success) {
      throw new Error(
        `joinRoom failed: ${joinRes?.code || "unknown error"}`
      );
    }

    const rtpCapabilities =
      joinRes?.data?.rtpCapabilities;

    if (!rtpCapabilities) {
      throw new Error(
        "joinRoom succeeded but no rtpCapabilities returned"
      );
    }

    // 3. CREATE VIEWER TRANSPORT
    const {
      response: transportRes,
      latencyMs: createLatency,
    } = await ackWithTimeout(
      socket,
      "createViewerTransport",
      ROOM_ID
    );

    results.createTransportMs.push(createLatency);

    if (!transportRes?.success) {
      throw new Error(
        `createViewerTransport failed: ${
          transportRes?.code || "unknown error"
        }`
      );
    }

    // 4. CONNECT CONSUMER TRANSPORT
    const {
      latencyMs: connectTLatency,
      response: connectRes,
    } = await ackWithTimeout(
      socket,
      "connectConsumerTransport",
      {
        dtlsParameters: fakeDtlsParameters(),
      }
    );

    results.connectTransportMs.push(connectTLatency);

    if (!connectRes?.success) {
      throw new Error(
        `connectConsumerTransport failed: ${
          connectRes?.code || "unknown error"
        }`
      );
    }

    // 5. CONSUME
    if (WITH_CONSUME) {
      const {
        response: consumeRes,
        latencyMs: consumeLatency,
      } = await ackWithTimeout(
        socket,
        "consume",
        ROOM_ID,
        rtpCapabilities
      );

      results.consumeMs.push(consumeLatency);

      if (!consumeRes?.success) {
        throw new Error(
          `consume failed: ${
            consumeRes?.code || "unknown error"
          }`
        );
      }

      const consumers =
        consumeRes?.data?.consumers || [];

      // 6. RESUME EACH CONSUMER
      for (const consumer of consumers) {
        if (!consumer?.id) {
          continue;
        }

        const {
          response: resumeRes,
          latencyMs: resumeLatency,
        } = await ackWithTimeout(
          socket,
          "resumeConsumer",
          ROOM_ID,
          consumer.id
        );

        results.resumeMs.push(resumeLatency);

        if (!resumeRes?.success) {
          throw new Error(
            `resumeConsumer failed for ${consumer.id}: ${
              resumeRes?.code || "unknown error"
            }`
          );
        }
      }
    }

    results.totalSignalingMs.push(
      performance.now() - overallStart
    );
  } catch (err) {
    results.errors.push(
      `viewer ${idx}: ${err?.message || String(err)}`
    );
  } finally {
    socket.disconnect();
  }
}

// ---------- main ----------
async function main() {
  console.log(
    `Starting signaling load test: ` +
      `${NUM_VIEWERS} viewers, ` +
      `ramped over ${RAMP_MS}ms, ` +
      `room=${ROOM_ID}, ` +
      `withConsume=${WITH_CONSUME}`
  );

  const delayBetween =
    NUM_VIEWERS > 0
      ? RAMP_MS / NUM_VIEWERS
      : 0;

  const runs = [];

  for (let i = 0; i < NUM_VIEWERS; i++) {
    runs.push(runViewer(i));

    if (delayBetween > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, delayBetween)
      );
    }
  }

  await Promise.allSettled(runs);

  console.log("\n=== Results ===");

  summarize(
    "socket connect",
    results.connectMs
  );

  summarize(
    "joinRoom ack",
    results.joinRoomMs
  );

  summarize(
    "createViewerTransport ack",
    results.createTransportMs
  );

  summarize(
    "connectConsumerTransport ack",
    results.connectTransportMs
  );

  if (WITH_CONSUME) {
    summarize(
      "consume ack",
      results.consumeMs
    );

    summarize(
      "resumeConsumer ack",
      results.resumeMs
    );
  }

  summarize(
    "TOTAL signaling handshake",
    results.totalSignalingMs
  );

  console.log(
    `\nErrors: ${results.errors.length}/${NUM_VIEWERS}`
  );

  if (results.errors.length > 0) {
    console.log(
      results.errors.slice(0, 10).join("\n")
    );

    if (results.errors.length > 10) {
      console.log(
        `...and ${results.errors.length - 10} more`
      );
    }
  }
}

main();