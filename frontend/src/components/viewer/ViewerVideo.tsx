import type { RefObject } from "react";
import { ArrowRight, Info, LogOut, MessageSquare, Radio, Tv } from "lucide-react";

interface ViewerVideoProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  connected: boolean;
  roomId: string;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  onJoin: (e: React.FormEvent<HTMLFormElement>) => void;
  onLeave: () => void;
  panelOpen: boolean;
  panel: "info" | "chat";
  onOpenPanel: (tab: "info" | "chat") => void;
}

export default function ViewerVideo({
  videoRef,
  connected,
  roomId,
  setRoomId,
  onJoin,
  onLeave,
  panelOpen,
  panel,
  onOpenPanel,
}: ViewerVideoProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls={false}
        className="h-full w-full object-cover"
          onPlaying={() => {
            if (!window.__csFirstFrameAt) {
              window.__csFirstFrameAt = Date.now();
              console.log("[LOAD TEST] First video frame playing");
            }
          }}
      />

      {!connected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0f0c]">
          <Tv size={28} className="text-white/25" />
          <p className="text-sm text-white/40">Enter a Room ID below to start watching</p>
        </div>
      )}

      {/* top-left: live/room chip */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        {connected && (
          <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium backdrop-blur">
            <Radio size={11} className="text-[#ff5c5c]" />
            LIVE
          </span>
        )}
        <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs text-white/60 backdrop-blur">
          {roomId || "no room joined"}
        </span>
      </div>

      {/* top-right: icon triggers with hover tooltips. These open DOWNWARD
          (position="bottom") because they sit close to the top edge of an
          overflow-hidden container — an upward tooltip would get clipped
          and never become visible. */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <IconTrigger
          label="Stream info"
          active={panelOpen && panel === "info"}
          onClick={() => onOpenPanel("info")}
          icon={<Info size={16} />}
        />
        <IconTrigger
          label="Live chat"
          active={panelOpen && panel === "chat"}
          onClick={() => onOpenPanel("chat")}
          icon={<MessageSquare size={16} />}
        />
      </div>

      {/* floating control dock — sits near the bottom edge, so there's room
          above it and tooltips can safely open upward. */}
      <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
        {!connected ? (
          <form
            onSubmit={onJoin}
            className="flex w-full max-w-md items-center gap-1.5 rounded-2xl bg-black/60 p-1.5 backdrop-blur-md ring-1 ring-white/10"
          >
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Paste Room ID"
              className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={!roomId.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-[#3fcf9e] px-4 py-2 text-sm font-semibold text-[#04241a] transition hover:bg-[#5fdcb2] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight size={15} /> Join
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5 rounded-2xl bg-black/60 p-1.5 backdrop-blur-md ring-1 ring-white/10">
            <span className="px-3 text-sm text-white/60">
              Connected to <span className="font-mono text-white/85">{roomId}</span>
            </span>
            <button
              onClick={onLeave}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <LogOut size={15} /> Leave
            </button>
          </div>
        )}
      </div>
    </div>
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
      <Tooltip text={label} position="bottom" />
    </div>
  );
}