#!/usr/bin/env bash
#
# =============================================================================
# CrowdStream - WebRTC media impairment load-test harness (tc/netem driver)
# =============================================================================
#
# Applies a series of network-impairment profiles to a network interface with
# `tc netem`, runs impairment-measure.js (puppeteer viewers + getStats) under
# each profile, captures the single-line JSON summary, and prints a comparison
# table (profile | bitrateKbps | loss% | jitter | fps).
#
# !!  DANGER - THIS SHAPES A REAL NETWORK INTERFACE  !!
# -----------------------------------------------------------------------------
# `tc qdisc ... netem` degrades ALL traffic on the chosen $IFACE (added delay,
# dropped packets, throttled bandwidth). Run this ONLY on a disposable test box
# or throwaway container. Prefer shaping the loopback / a dedicated test NIC
# (e.g. IFACE=lo) so you do not knock yourself off SSH or disrupt other work.
# NEVER run this against a production host or a shared interface. The script
# installs an EXIT/INT/TERM trap that always tears the qdisc back down, but a
# hard kill (kill -9) can still leave the interface shaped - if that happens,
# recover manually with:  tc qdisc del dev <IFACE> root
# -----------------------------------------------------------------------------
#
# > Authored by Claude (Anthropic), via Claude Code - 2026-08-27.
# =============================================================================

# Resolve where this script (and the measurer next to it) live.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEASURE="$SCRIPT_DIR/impairment-measure.js"

# -----------------------------------------------------------------------------
# Config: flags override env; env overrides defaults.
# -----------------------------------------------------------------------------
IFACE="${IFACE:-eth0}"
ROOM_ID="${ROOM_ID:-}"
BASE_URL="${BASE_URL:-http://localhost}"
DURATION_MS="${DURATION_MS:-15000}"
VIEWERS="${VIEWERS:-1}"
SETTLE_SECS="${SETTLE_SECS:-2}"

# Credentials are read from the environment and passed through to the measurer.
CROWDSTREAM_TEST_EMAIL="${CROWDSTREAM_TEST_EMAIL:-}"
CROWDSTREAM_TEST_PASSWORD="${CROWDSTREAM_TEST_PASSWORD:-}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --iface)     IFACE="$2"; shift 2 ;;
    --roomId|--room) ROOM_ID="$2"; shift 2 ;;
    --baseUrl)   BASE_URL="$2"; shift 2 ;;
    --durationMs) DURATION_MS="$2"; shift 2 ;;
    --viewers)   VIEWERS="$2"; shift 2 ;;
    --email)     CROWDSTREAM_TEST_EMAIL="$2"; shift 2 ;;
    --password)  CROWDSTREAM_TEST_PASSWORD="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: sudo IFACE=<nic> ROOM_ID=<liveRoom> BASE_URL=<url> \\"
      echo "            CROWDSTREAM_TEST_EMAIL=... CROWDSTREAM_TEST_PASSWORD=... \\"
      echo "            $0 [--iface eth0] [--roomId ID] [--baseUrl URL] \\"
      echo "               [--durationMs 15000] [--viewers 1]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Export creds so the child `node` process inherits them (sudo may scrub env,
# so we re-export whatever we resolved from flags/env here).
export CROWDSTREAM_TEST_EMAIL
export CROWDSTREAM_TEST_PASSWORD

# -----------------------------------------------------------------------------
# Preconditions.
# -----------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: this harness shapes a real NIC with tc/netem and must run as root." >&2
  echo "" >&2
  echo "Re-run with sudo, passing config + credentials through the environment:" >&2
  echo "" >&2
  echo "  sudo IFACE=lo ROOM_ID=<liveRoomId> BASE_URL=http://localhost \\" >&2
  echo "       CROWDSTREAM_TEST_EMAIL=you@example.com \\" >&2
  echo "       CROWDSTREAM_TEST_PASSWORD=secret \\" >&2
  echo "       $0" >&2
  exit 1
fi

if [ -z "$ROOM_ID" ]; then
  echo "ERROR: ROOM_ID is required (an existing LIVE room). Set ROOM_ID=... or --roomId ID." >&2
  exit 1
fi

if [ ! -f "$MEASURE" ]; then
  echo "ERROR: cannot find measurer at $MEASURE" >&2
  exit 1
fi

if ! command -v tc >/dev/null 2>&1; then
  echo "ERROR: 'tc' not found. Install iproute2 (e.g. apt-get install iproute2)." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: 'node' not found on PATH." >&2
  exit 1
fi

# -----------------------------------------------------------------------------
# Cleanup: ALWAYS remove the netem qdisc, however we exit.
# -----------------------------------------------------------------------------
cleanup() {
  tc qdisc del dev "$IFACE" root 2>/dev/null || true
}
trap cleanup EXIT INT TERM

apply_profile() {
  # $1 = netem args ("" => baseline / no shaping)
  local netem="$1"
  if [ -z "$netem" ]; then
    # Baseline: ensure the interface is completely unshaped.
    tc qdisc del dev "$IFACE" root 2>/dev/null || true
  else
    # `replace` is idempotent whether or not a root qdisc already exists.
    # shellcheck disable=SC2086  # intentional word-splitting of netem args
    tc qdisc replace dev "$IFACE" root netem $netem
  fi
}

# Pull a numeric (or null) field out of the measurer's JSON line.
jval() {
  # $1 = json, $2 = key
  echo "$1" | sed -n "s/.*\"$2\":\([^,}]*\).*/\1/p" | tr -d ' '
}

# -----------------------------------------------------------------------------
# Profiles: "human label|netem args".  Empty netem args == baseline.
# -----------------------------------------------------------------------------
PROFILES=(
  "baseline (none)|"
  "loss 1%|loss 1%"
  "loss 3%|loss 3%"
  "loss 5%|loss 5%"
  "jitter (delay 100ms 20ms normal)|delay 100ms 20ms distribution normal"
  "rate 1mbit|rate 1mbit"
)

echo "=============================================================="
echo "CrowdStream media impairment sweep"
echo "  Interface : $IFACE   (WARNING: real traffic on this NIC is shaped)"
echo "  Room ID   : $ROOM_ID"
echo "  Base URL  : $BASE_URL"
echo "  Viewers   : $VIEWERS"
echo "  Duration  : ${DURATION_MS}ms per profile"
echo "=============================================================="

ROWS=()

for entry in "${PROFILES[@]}"; do
  name="${entry%%|*}"
  netem="${entry#*|}"

  echo ""
  echo ">>> Profile: $name"
  if [ -z "$netem" ]; then
    echo "    netem: (none / baseline)"
  else
    echo "    netem: $netem"
  fi

  apply_profile "$netem"

  # Let the shaping take effect before measuring.
  sleep "$SETTLE_SECS"

  # Run the measurer. Diagnostics -> stderr (dropped here); the pure JSON
  # summary is the only stdout line, so tail -n 1 grabs it reliably.
  json="$(node "$MEASURE" \
    --baseUrl "$BASE_URL" \
    --roomId "$ROOM_ID" \
    --durationMs "$DURATION_MS" \
    --viewers "$VIEWERS" 2>/dev/null | tail -n 1)"

  if [ -z "$json" ]; then
    echo "    result: (no JSON captured - measurer failed; see run without 2>/dev/null)"
    bitrate="ERR"; loss="ERR"; jitter="ERR"; fps="ERR"
  else
    echo "    result: $json"
    bitrate="$(jval "$json" meanBitrateKbps)"
    loss="$(jval "$json" lossPct)"
    jitter="$(jval "$json" jitterMs)"
    fps="$(jval "$json" meanFps)"
    [ -z "$bitrate" ] && bitrate="n/a"
    [ -z "$loss" ] && loss="n/a"
    [ -z "$jitter" ] && jitter="n/a"
    [ -z "$fps" ] && fps="n/a"
  fi

  ROWS+=("$(printf '%-38s %14s %10s %10s %8s' "$name" "$bitrate" "$loss" "$jitter" "$fps")")

  # Reset to unshaped between profiles.
  tc qdisc del dev "$IFACE" root 2>/dev/null || true
done

# -----------------------------------------------------------------------------
# Comparison table.
# -----------------------------------------------------------------------------
echo ""
echo "=============================================================="
echo "RESULTS (compare each profile vs. baseline)"
echo "=============================================================="
printf '%-38s %14s %10s %10s %8s\n' "profile" "bitrateKbps" "loss%" "jitterMs" "fps"
printf '%-38s %14s %10s %10s %8s\n' "--------------------------------------" "--------------" "----------" "----------" "--------"
for row in "${ROWS[@]}"; do
  echo "$row"
done
echo "=============================================================="
echo "Note: simulcast/layer switching is DISABLED in the backend"
echo "(adaptStreamQuality.ts is fully commented out), so expect flat"
echo "quality degradation - no adaptive layer downgrade under loss."
