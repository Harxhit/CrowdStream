import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Wifi,
  Video,
  Mic,
  Link2,
  Layers,
  Heart,
  Info,
} from "lucide-react";

type RTCStat = Record<string, any>;

interface MediaStats {
  jitter: number;
  packetLoss: number;
  rtt: number;
  bitrate: number;
  audioBitrate: number;
  audioJitter: number;
  audioPacketLoss: number;
  fps: number;
  resolution: string;
}

const HISTORY_LEN = 30;
const RANGES = ["1 min", "5 min", "15 min", "1 hour"] as const;

function pushHistory(prev: number[], value: number) {
  const next = [...prev, value];
  if (next.length > HISTORY_LEN) next.shift();
  return next;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-10" />;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 32;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BitrateChart({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="h-40" />;

  const max = Math.max(...data, 1) * 1.15;
  const w = 600;
  const h = 160;

  const linePoints = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="bitrateFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3fcf9e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3fcf9e" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={w}
          y1={h * f}
          y2={h * f}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}
      <polygon points={areaPoints} fill="url(#bitrateFill)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="#3fcf9e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AudioBars({ level }: { level: number }) {
  const bars = 10;
  const active = Math.round((level / 100) * bars);
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`h-4 w-[3px] rounded-full ${
            i < active ? "bg-[#3fcf9e]" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

function HealthGauge({ score }: { score: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#3fcf9e"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-semibold text-white">{score}</span>
        <span className="text-xs text-white/40">/100</span>
      </div>
    </div>
  );
}

export default function StatsDashBoard() {
  const [roomId, setRoomId] = useState("-");
  const [socketId, setSocketId] = useState("-");

  const [report, setReport] = useState<RTCStat[]>([]);
  const [range, setRange] = useState<(typeof RANGES)[number]>("1 min");

  const [stats, setStats] = useState<MediaStats>({
    jitter: 0,
    packetLoss: 0,
    rtt: 0,
    bitrate: 0,
    audioBitrate: 0,
    audioJitter: 0,
    audioPacketLoss: 0,
    fps: 0,
    resolution: "Unknown",
  });

  const [jitterHistory, setJitterHistory] = useState<number[]>([]);
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [rttHistory, setRttHistory] = useState<number[]>([]);
  const [bitrateHistory, setBitrateHistory] = useState<number[]>([]);

  // Cumulative counters from getStats() need a previous-sample + previous-timestamp
  // pair to turn into an actual rate. Tracking a previous *rate* (as the old code
  // did via prevRef.current.bitrate) mixes units and drifts unboundedly.
  const prevVideoBytesRef = useRef(0);
  const prevVideoTimestampRef = useRef(0);
  const prevAudioBytesRef = useRef(0);
  const prevAudioTimestampRef = useRef(0);

  useEffect(() => {
    const channel = new BroadcastChannel("crowdstream-stats");

    channel.onmessage = (event) => {
      if (event.data.type === "stats") {
        setReport(event.data.report);

        if (event.data.roomId) setRoomId(event.data.roomId);
        if (event.data.socketId) setSocketId(event.data.socketId);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  useEffect(() => {
    let jitter = 0;
    let packetLoss = 0;
    let rtt = 0;
    let bitrate = 0;
    let audioBitrate = 0;
    let audioJitter = 0;
    let audioPacketLoss = 0;
    let fps = 0;
    let width = 0;
    let height = 0;

    report.forEach((entry: any) => {
      if (entry.type === "inbound-rtp" && entry.kind === "video") {
        jitter = (entry.jitter ?? 0) * 1000;
        packetLoss = entry.packetsLost
          ? (entry.packetsLost / (entry.packetsReceived + entry.packetsLost)) * 100
          : 0;
        fps = entry.framesPerSecond ?? fps;
        width = entry.frameWidth ?? width;
        height = entry.frameHeight ?? height;

        if (entry.bytesReceived != null && entry.timestamp != null) {
          const deltaBytes = entry.bytesReceived - prevVideoBytesRef.current;
          const deltaSeconds =
            (entry.timestamp - prevVideoTimestampRef.current) / 1000;

          if (prevVideoTimestampRef.current > 0 && deltaSeconds > 0) {
            bitrate = (deltaBytes * 8) / 1_000_000 / deltaSeconds;
          }

          prevVideoBytesRef.current = entry.bytesReceived;
          prevVideoTimestampRef.current = entry.timestamp;
        }
      }

      if (entry.type === "inbound-rtp" && entry.kind === "audio") {
        audioJitter = (entry.jitter ?? 0) * 1000;
        audioPacketLoss = entry.packetsLost
          ? (entry.packetsLost / (entry.packetsReceived + entry.packetsLost)) * 100
          : 0;

        if (entry.bytesReceived != null && entry.timestamp != null) {
          const deltaBytes = entry.bytesReceived - prevAudioBytesRef.current;
          const deltaSeconds =
            (entry.timestamp - prevAudioTimestampRef.current) / 1000;

          if (prevAudioTimestampRef.current > 0 && deltaSeconds > 0) {
            audioBitrate = (deltaBytes * 8) / 1000 / deltaSeconds;
          }

          prevAudioBytesRef.current = entry.bytesReceived;
          prevAudioTimestampRef.current = entry.timestamp;
        }
      }

      if (entry.type === "candidate-pair" && entry.state === "succeeded") {
        rtt = (entry.currentRoundTripTime ?? 0) * 1000;

        console.log("ICE Candidate Pair:", {
          state: entry.state,
          nominated: entry.nominated,
          selected: entry.selected,
          writable: entry.writable,
          rtt,
          localCandidateId: entry.localCandidateId,
          remoteCandidateId: entry.remoteCandidateId,
        });
      }

      if (entry.type === "candidate-pair" && entry.state === "failed") {
        console.error("ICE CANDIDATE PAIR FAILED:", {
          localCandidateId: entry.localCandidateId,
          remoteCandidateId: entry.remoteCandidateId,
        });
      }
    });

    const next: MediaStats = {
      jitter: Number(jitter.toFixed(1)),
      packetLoss: Number(packetLoss.toFixed(1)),
      rtt: Number(rtt.toFixed(0)),
      bitrate: Number(Math.max(bitrate, 0).toFixed(2)),
      audioBitrate: Number(Math.max(audioBitrate, 0).toFixed(0)),
      audioJitter: Number(audioJitter.toFixed(1)),
      audioPacketLoss: Number(audioPacketLoss.toFixed(1)),
      fps: Math.round(fps),
      resolution: width && height ? `${width} x ${height}` : "Unknown",
    };

    setStats(next);

    setJitterHistory((h) => pushHistory(h, next.jitter));
    setLossHistory((h) => pushHistory(h, next.packetLoss));
    setRttHistory((h) => pushHistory(h, next.rtt));
    setBitrateHistory((h) => pushHistory(h, next.bitrate));
  }, [report]);

  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          stats.packetLoss * 4 -
          Math.max(0, stats.jitter - 20) * 0.5 -
          Math.max(0, stats.rtt - 80) * 0.2
      )
    )
  );

  const quality =
    healthScore >= 90 ? "Excellent" : healthScore >= 70 ? "Good" : healthScore >= 45 ? "Fair" : "Poor";

  return (
    <div className="min-h-screen bg-[#0a0f0c] px-4 py-6 text-white sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3fcf9e]/15 text-[#3fcf9e]">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Stream statistics</h1>
            <p className="text-sm text-white/40">Real-time performance metrics for your connection</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-white/[0.03] p-1 ring-1 ring-white/10">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* TOP METRIC CARDS */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7f77dd]/15 text-[#a29bf0]">
              <Activity size={15} />
            </div>
            <span className="text-sm text-white/60">Jitter</span>
            <Info size={13} className="ml-auto text-white/20" />
          </div>
          <p className="text-2xl font-semibold">{stats.jitter} ms</p>
          <div className="mt-3">
            <Sparkline data={jitterHistory} color="#a29bf0" />
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff5c5c]/15 text-[#ff8080]">
              <AlertTriangle size={15} />
            </div>
            <span className="text-sm text-white/60">Packet loss</span>
            <Info size={13} className="ml-auto text-white/20" />
          </div>
          <p className="text-2xl font-semibold">{stats.packetLoss}%</p>
          <div className="mt-3">
            <Sparkline data={lossHistory} color="#ff8080" />
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#378add]/15 text-[#6fb0ee]">
              <Wifi size={15} />
            </div>
            <span className="text-sm text-white/60">RTT</span>
            <Info size={13} className="ml-auto text-white/20" />
          </div>
          <p className="text-2xl font-semibold">{stats.rtt} ms</p>
          <div className="mt-3">
            <Sparkline data={rttHistory} color="#6fb0ee" />
          </div>
        </div>

        <div className="rounded-2xl bg-[#3fcf9e]/10 p-5 ring-1 ring-[#3fcf9e]/20">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3fcf9e]/20 text-[#3fcf9e]">
              <Wifi size={15} />
            </div>
            <span className="text-sm text-white/60">Connection quality</span>
          </div>
          <p className="text-2xl font-semibold text-[#3fcf9e]">
            {quality}
            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#3fcf9e] align-middle" />
          </p>
          <p className="mt-3 text-sm text-white/40">
            {healthScore >= 70 ? "Stable connection" : "Watch this connection"}
          </p>
        </div>
      </div>

      {/* VIDEO + AUDIO */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/70">
                <Video size={15} />
              </div>
              <span className="font-medium">Video statistics</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-[#3fcf9e]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3fcf9e]" />
              Live
            </span>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-white/40">Bitrate</p>
              <p className="text-lg font-semibold text-[#6fb0ee]">{stats.bitrate} Mbps</p>
            </div>
            <div>
              <p className="text-xs text-white/40">FPS</p>
              <p className="text-lg font-semibold">{stats.fps || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Resolution</p>
              <p className="text-lg font-semibold">{stats.resolution}</p>
            </div>
          </div>

          <BitrateChart data={bitrateHistory} />
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/70">
                <Mic size={15} />
              </div>
              <span className="font-medium">Audio statistics</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-[#3fcf9e]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3fcf9e]" />
              Live
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40">Bitrate</p>
                <p className="text-lg font-semibold">{stats.audioBitrate} kbps</p>
              </div>
              <AudioBars level={70} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40">Jitter</p>
                <p className="text-lg font-semibold text-[#3fcf9e]">{stats.audioJitter} ms</p>
              </div>
              <AudioBars level={55} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40">Packet loss</p>
                <p className="text-lg font-semibold text-[#3fcf9e]">{stats.audioPacketLoss}%</p>
              </div>
              <AudioBars level={90} />
            </div>
          </div>
        </div>
      </div>

      {/* DETAILS ROW */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/70">
              <Link2 size={15} />
            </div>
            <span className="font-medium">Connection details</span>
          </div>
          <dl className="space-y-2.5 text-sm">
            <Row k="Transport" v="WebRTC (mediasoup)" />
            <Row k="RTT" v={`${stats.rtt} ms`} />
            <Row k="Room" v={roomId || "-"} />
            <Row k="Socket" v={socketId || "-"} />
          </dl>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/70">
              <Layers size={15} />
            </div>
            <span className="font-medium">Codec information</span>
          </div>
          <dl className="space-y-2.5 text-sm">
            <Row k="Video codec" v="VP8" />
            <Row k="Audio codec" v="Opus" />
            <Row k="NACK" v="Enabled" accent />
            <Row k="PLI" v="Enabled" accent />
          </dl>
        </div>

        <div className="rounded-2xl bg-[#ff5c5c]/[0.04] p-5 ring-1 ring-white/10">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff5c5c]/15 text-[#ff8080]">
              <Heart size={15} />
            </div>
            <span className="font-medium">Stream health</span>
          </div>
          <div className="flex items-center justify-center py-2">
            <HealthGauge score={healthScore} />
          </div>
          <p className="mt-2 text-center text-sm text-white/40">
            {healthScore >= 70 ? "Your stream is performing well." : "Some metrics need attention."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-white/40">{k}</dt>
      <dd className={accent ? "font-medium text-[#3fcf9e]" : "font-medium"}>{v}</dd>
    </div>
  );
}