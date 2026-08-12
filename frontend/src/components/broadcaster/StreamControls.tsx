import { useState } from "react";
import { Play, Square, Camera, CameraOff, Mic, MicOff, Monitor, Circle } from "lucide-react";

interface StreamControlsProps {
  isLive: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function StreamControls({
  isLive,
  onStart,
  onStop,
}: StreamControlsProps) {
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [recording, setRecording] = useState(false);

  function handleCameraToggle() {
    /**
     * TODO: pause/resume the MediaSoup video producer here.
     * producer.pause() / producer.resume() — do NOT close the producer,
     * that forces renegotiation. Pausing is instant and keeps the transport alive.
     */
    setCamOn((v) => !v);
  }

  function handleMicrophoneToggle() {
    /**
     * TODO: pause/resume the MediaSoup audio producer here.
     */
    setMicOn((v) => !v);
  }

  function handleRecordToggle() {
    /**
     * TODO: start/stop the FFmpeg recording pipeline.
     * Decide: capture local track directly, or pipe the mixed room
     * output via a PlainTransport off the router — changes where this hooks in.
     */
    setRecording((v) => !v);
  }

  function handleScreenShare() {
    /**
     * TODO: getDisplayMedia() → replace video producer track →
     * restore camera track when screen sharing ends.
     */
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">Stream controls</h2>
          <p className="mt-1 hidden text-sm text-neutral-400 sm:block">
            Manage your broadcast.
          </p>
        </div>

        {recording && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#E24B4A]/15 px-2.5 py-1 text-xs font-medium text-[#f0a0a0] ring-1 ring-inset ring-[#E24B4A]/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E24B4A]" />
            Recording
          </span>
        )}
      </div>

      <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
        {/* Primary action — full width on mobile, inline on larger screens */}
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {!isLive ? (
            <button
              onClick={onStart}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-6 py-3 font-semibold text-[#04342C] transition hover:bg-[#5DCAA5] sm:w-auto"
            >
              <Play size={18} />
              Start streaming
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-800 px-6 py-3 font-semibold transition hover:bg-neutral-700 sm:w-auto"
            >
              <Square size={18} />
              Stop stream
            </button>
          )}

          {/* Record sits next to start/stop on tablet+, full width stacked on mobile */}
          <button
            onClick={handleRecordToggle}
            disabled={!isLive}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${
              recording
                ? "bg-[#E24B4A] text-white hover:bg-[#c73f3e]"
                : "border border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-[#E24B4A]/60"
            }`}
          >
            <Circle size={14} fill="currentColor" />
            {recording ? "Stop recording" : "Record"}
          </button>
        </div>

        {/* Secondary controls — 2 columns on mobile, 3 on sm+ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <button
            onClick={handleCameraToggle}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition sm:p-5 ${
              camOn
                ? "border-neutral-800 bg-neutral-950 hover:border-[#1D9E75]/60"
                : "border-[#E24B4A]/40 bg-[#E24B4A]/10 text-[#f0a0a0]"
            }`}
          >
            {camOn ? <Camera size={22} /> : <CameraOff size={22} />}
            <span className="text-xs sm:text-sm">
              {camOn ? "Camera" : "Camera off"}
            </span>
          </button>

          <button
            onClick={handleMicrophoneToggle}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition sm:p-5 ${
              micOn
                ? "border-neutral-800 bg-neutral-950 hover:border-[#1D9E75]/60"
                : "border-[#E24B4A]/40 bg-[#E24B4A]/10 text-[#f0a0a0]"
            }`}
          >
            {micOn ? <Mic size={22} /> : <MicOff size={22} />}
            <span className="text-xs sm:text-sm">
              {micOn ? "Microphone" : "Mic off"}
            </span>
          </button>

          <button
            onClick={handleScreenShare}
            className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition hover:border-[#1D9E75]/60 sm:col-span-1 sm:p-5"
          >
            <Monitor size={22} />
            <span className="text-xs sm:text-sm">Share screen</span>
          </button>
        </div>
      </div>
    </section>
  );
}