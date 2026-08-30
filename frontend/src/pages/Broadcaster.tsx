import { useRef, useState } from "react";
import {
  CameraOff,
  Camera,
  Mic,
  MicOff,
  Play,
  Square,
  Monitor,
  Copy,
  MessageSquare,
  Info,
  BarChart3,
  X,
} from "lucide-react";

import Broadcaster from "../broadcaster";
import SystemLogs from "../components/broadcaster/SystemLogs";
import LiveChat from "../components/broadcaster/LiveChat";
import ReactionOverlay from "../components/reactions/ReactionOverlay";

declare global {
  interface Window {
    __csRoomId?: string;
    __csLiveAt?: number;
  }
}

interface Log {
  message: string;
  timestamp: Date;
}

const broadcaster = new Broadcaster();

export default function BroadcasterPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLive, setIsLive] = useState(false);

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // Panel is closed by default. When open it takes a real column in the
  // flex layout below, so the video shrinks to make room — it does not
  // float on top of the video.
  const [panelOpen, setPanelOpen] = useState(false);
  const [panel, setPanel] = useState<"info" | "stats" | "chat">("chat");

  // Separate from the info/stats/chat panel — its own collapsible section
  // under the video, easy to comment out as one block if you don't want it.
  const [logsOpen, setLogsOpen] = useState(false);

  const log = (message: string) => {
    console.log(message);
    setLogs((prev) => [...prev, { message, timestamp: new Date() }]);
  };

  async function startBroadcast() {
    try {
      log("Creating room...");

      const room = await broadcaster.createRoom();

      setRoomId(room.id);
      window.__csRoomId = room.id

      log("Fetching RTP capabilities...");

      const caps = await broadcaster.getRouterCapabilities(room.id);

      log("Loading MediaSoup device...");

      await broadcaster.loadDevice(caps);

      log("Creating send transport...");

      await broadcaster.createBroadcasterTransport(room.id);

      log("Accessing camera...");

      const stream = await broadcaster.getUserMedia();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      log("Producing media...");

      await broadcaster.startProducing(stream);

      setIsLive(true);
      window.__csLiveAt = Date.now();

      log("Broadcast started successfully.");
    } catch (err: any) {
      log(`ERROR: ${err.message}`);
    }
  }

  async function stopBroadcast() {
    log("Stopping broadcast...");

    /**
     * TODO:
     * Implement broadcaster.stopBroadcast()
     *
     * Backend responsibilities:
     * - Emit a `stopBroadcast` event to the server.
     * - Close all MediaSoup producers.
     * - Close the send transport.
     * - Stop producing audio and video.
     * - Remove the broadcaster from the frontend room store.
     * - Release all allocated resources.
     * - Stop listening to socket events.
     * - Close/delete the room if this is the last broadcaster.
     */

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;

      stream.getTracks().forEach((track) => {
        track.stop();
      });

      videoRef.current.srcObject = null;
    }

    /**
     * TODO:
     * Reset broadcaster-specific state.
     *
     * Examples:
     * - Reset viewer count.
     * - Clear chat messages.
     * - Reset stream statistics.
     * - Clear connection state.
     * - Reset any cached MediaSoup state.
     */

    setRoomId(null);
    setIsLive(false);

    log("Broadcast stopped.");
  }

  function toggleCam() {
    // TODO: producer.pause()/resume() on the video producer — don't close it.
    setCamOn((v) => !v);
  }

  function toggleMic() {
    // TODO: producer.pause()/resume() on the audio producer.
    setMicOn((v) => !v);
  }


  function handleScreenShare() {
    // TODO: getDisplayMedia() → replace video producer track → restore camera on end.
  }

  function openPanel(tab: "info" | "stats" | "chat") {
    if (panelOpen && panel === tab) {
      setPanelOpen(false);
      return;
    }
    setPanel(tab);
    setPanelOpen(true);
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#0a0f0c] text-white">

      {/* HEADER */}
      <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Crowd<span className="text-[#3fcf9e]">Stream</span>
          </h1>
          <span className="hidden text-sm text-white/35 sm:inline">broadcaster</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              isLive ? "bg-[#ff5c5c] animate-pulse" : "bg-white/20"
            }`}
          />
          <span className="text-white/60">{isLive ? "On air" : "Offline"}</span>
        </div>
      </header>

      {/* BODY — flex row. Video is flex-1 so it genuinely resizes when the
          panel opens, instead of the panel floating on top of it. */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 sm:gap-5 sm:px-6 sm:pb-6 lg:gap-6 lg:px-8 lg:pb-8">

        {/* LEFT: video + logs — shrinks smoothly as the panel width comes in */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 transition-all duration-300">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            {!camOn || !isLive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0f0c]">
                <CameraOff size={28} className="text-white/25" />
                <p className="text-sm text-white/40">
                  {isLive ? "Camera is off" : "Start streaming to activate your camera"}
                </p>
              </div>
            ) : null}

            {/* top-left: live/room chip */}
            <div className="absolute left-4 top-4 flex items-center gap-2">
              {isLive && (
                <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ff5c5c]" />
                  LIVE
                </span>
              )}
              <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs text-white/60 backdrop-blur">
                {roomId ?? "room pending"}
              </span>
            </div>

            {/* top-right: icon triggers with hover tooltips, replacing text pills.
                Tooltips open DOWNWARD here (position="bottom") because these
                buttons sit close to the top edge of an overflow-hidden
                container — a tooltip popping upward gets clipped and never
                becomes visible. */}
            <div className="absolute right-4 top-4 flex items-center gap-2">
              <IconTrigger
                label="Room info"
                active={panelOpen && panel === "info"}
                onClick={() => openPanel("info")}
                icon={<Info size={16} />}
              />
              <IconTrigger
                label="Stream stats"
                active={panelOpen && panel === "stats"}
                onClick={() => openPanel("stats")}
                icon={<BarChart3 size={16} />}
              />
              <IconTrigger
                label="Live chat"
                active={panelOpen && panel === "chat"}
                onClick={() => openPanel("chat")}
                icon={<MessageSquare size={16} />}
              />
            </div>

            {/* floating control dock — sits near the bottom edge, so there's
                room above it and the tooltip can safely open upward. */}
            <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
              <div className="flex items-center gap-1.5 rounded-2xl bg-black/60 p-1.5 backdrop-blur-md ring-1 ring-white/10">
                <DockButton active={micOn} onClick={toggleMic} label="Microphone" onIcon={<Mic size={17} />} offIcon={<MicOff size={17} />} />
                <DockButton active={camOn} onClick={toggleCam} label="Camera" onIcon={<Camera size={17} />} offIcon={<CameraOff size={17} />} />

                <div className="mx-1 h-6 w-px bg-white/10" />

                {!isLive ? (
                  <button
                    onClick={startBroadcast}
                    id="live-start-button"
                    className="flex items-center gap-1.5 rounded-xl bg-[#3fcf9e] px-4 py-2 text-sm font-semibold text-[#04241a] transition hover:bg-[#5fdcb2]"
                  >
                    <Play size={15} /> Go live
                  </button>
                ) : (
                  <button
                    onClick={stopBroadcast}
                    className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    <Square size={15} /> End
                  </button>
                )}

                <div className="group relative flex h-9 w-9 items-center justify-center">
                  <button
                    onClick={handleScreenShare}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10"
                    aria-label="Share screen"
                  >
                    <Monitor size={16} />
                  </button>
                  <Tooltip text="Share screen" />
                </div>
              </div>
            </div>

            <ReactionOverlay roomId={roomId} />
          </div>

          {/*
            SYSTEM LOGS — standalone section, separate from the info/stats/chat
            panel. Kept as its own self-contained block on purpose: comment out
            this whole <div>...</div> if you want to drop logs from the UI
            entirely, nothing else here depends on it.

            The inner content is height-capped with its own scroll (max-h-48
            overflow-y-auto) so a growing log list can never squeeze the video
            preview down toward zero height — without a cap, the video's
            min-h-0/flex-1 lets it keep shrinking to absorb whatever the logs
            block grows to.
          */}
          <div className="shrink-0 rounded-xl bg-white/[0.03]">
            <button
              onClick={() => setLogsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-white/40"
            >
              System logs
              <span className="text-white/25">{logsOpen ? "hide" : "show"}</span>
            </button>
            {logsOpen && (
              <div className="max-h-48 overflow-y-auto border-t border-white/5">
                <SystemLogs logs={logs} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: panel — only takes space in the layout when open, so video
            reflows around it instead of being covered. */}
        {panelOpen && (
          <div className="flex w-full max-w-[360px] shrink-0 flex-col rounded-2xl bg-[#0f1512] ring-1 ring-white/10">
            <div className="flex items-center justify-between border-b border-white/5 p-2">
              <div className="flex flex-1 gap-1">
                {(["info", "stats", "chat"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPanel(tab)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition ${
                      panel === tab
                        ? "bg-[#3fcf9e]/15 text-[#3fcf9e]"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white/80"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              {panel === "info" && (
                <div className="space-y-4 p-4">
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wide text-white/35">Room ID</p>
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span className="flex-1 truncate text-sm text-white/70">
                        {roomId ?? "created when you go live"}
                      </span>
                      {roomId && (
                        <button className="text-white/40 hover:text-white/80">
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-white/35">
                    Once live, viewers can join with this Room ID — including viewers
                    connected to a different pod than this broadcast.
                  </p>
                </div>
              )}

              {panel === "stats" && (
                <div className="grid grid-cols-2 gap-px bg-white/5 p-px">
                  {[
                    ["Viewers", "0"],
                    ["Status", isLive ? "Live" : "Offline"],
                    ["Duration", "00:00"],
                    ["Resolution", "1280×720"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[#0f1512] p-3">
                      <p className="text-[11px] uppercase tracking-wide text-white/35">{label}</p>
                      <p className="mt-1 text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {panel === "chat" && (
                <div className="flex h-full flex-col">
                  <LiveChat roomId={roomId} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Tooltip({
  text,
  position = "top",
}: {
  text: string;
  position?: "top" | "bottom";
}) {
  return (
    <span
      className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 ${
        position === "top" ? "-top-8" : "top-full mt-2"
      }`}
    >
      {text}
    </span>
  );
}

function IconTrigger({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        aria-label={label}
        className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition ${
          active ? "bg-[#3fcf9e] text-[#04241a]" : "bg-black/40 text-white/70 hover:bg-black/60"
        }`}
      >
        {icon}
      </button>
      {/* Opens downward — these buttons sit at the top edge of an
          overflow-hidden container, so an upward tooltip gets clipped. */}
      <Tooltip text={label} position="bottom" />
    </div>
  );
}

function DockButton({
  active,
  onClick,
  onIcon,
  offIcon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        aria-label={label}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
          active ? "text-white/80 hover:bg-white/10" : "bg-[#ff5c5c] text-white"
        }`}
      >
        {active ? onIcon : offIcon}
      </button>
      <Tooltip text={active ? label : `${label} off`} />
    </div>
  );
}