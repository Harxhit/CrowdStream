import {
  Play,
  Square,
  Camera,
  Mic,
  Monitor,
} from "lucide-react";

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
  function handleCameraToggle() {
    /**
     * TODO:
     * Implement camera toggle.
     *
     * Responsibilities:
     * - Enable/disable the local camera.
     * - Pause/resume the MediaSoup video producer.
     * - Update the camera button state.
     * - Notify the backend if required.
     */
  }

  function handleMicrophoneToggle() {
    /**
     * TODO:
     * Implement microphone toggle.
     *
     * Responsibilities:
     * - Mute/unmute the microphone.
     * - Pause/resume the MediaSoup audio producer.
     * - Update the microphone button state.
     */
  }

  function handleScreenShare() {
    /**
     * TODO:
     * Implement screen sharing.
     *
     * Responsibilities:
     * - Request display media using getDisplayMedia().
     * - Replace the current video producer track.
     * - Restore the camera track when screen sharing ends.
     * - Update the UI state.
     */
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-lg font-semibold">
          Stream Controls
        </h2>

        <p className="mt-1 text-sm text-neutral-400">
          Manage your broadcast.
        </p>
      </div>

      <div className="space-y-6 p-6">
        {/* Main Controls */}

        <div className="flex flex-wrap gap-4">
          {!isLive ? (
            <button
              onClick={onStart}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-semibold transition hover:bg-red-700"
            >
              <Play size={18} />
              Start Streaming
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center gap-2 rounded-xl bg-neutral-800 px-6 py-3 font-semibold transition hover:bg-neutral-700"
            >
              <Square size={18} />
              Stop Stream
            </button>
          )}
        </div>

        {/* Secondary Controls */}

        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={handleCameraToggle}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-blue-500"
          >
            <Camera size={22} />
            <span className="text-sm">Camera</span>
          </button>

          <button
            onClick={handleMicrophoneToggle}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-blue-500"
          >
            <Mic size={22} />
            <span className="text-sm">Microphone</span>
          </button>

          <button
            onClick={handleScreenShare}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-blue-500"
          >
            <Monitor size={22} />
            <span className="text-sm">Share Screen</span>
          </button>
        </div>
      </div>
    </section>
  );
}