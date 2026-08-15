import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X, Circle } from "lucide-react";

import Viewer from "../viewer";

import SystemLogs from "../components/broadcaster/SystemLogs";
import ViewerVideo from "../components/viewer/ViewerVideo";
import StreamInfo from "../components/viewer/StreamInfo";
import LiveChat from "../components/broadcaster/LiveChat";
import ReactionOverlay from "../components/reactions/ReactionOverlay";
import { getSocket,startHeartBeat } from "../socket";

interface Log {
  message: string;
  timestamp: Date;
}

const viewer = new Viewer();

export default function ViewerPage() {
  const socket = getSocket()
  const [searchParams] = useSearchParams();

  const videoRef = useRef<HTMLVideoElement>(null);

  const [roomId, setRoomId] = useState(
    () => searchParams.get("roomId") ?? ""
  );

  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);

  const [logs, setLogs] = useState<Log[]>([]);

  const [logsOpen, setLogsOpen] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panel, setPanel] = useState<"info" | "chat">("chat");

  const log = (message: string) => {
    console.log(message);

    setLogs((prev) => [
      ...prev,
      {
        message,
        timestamp: new Date(),
      },
    ]);
  };

  async function joinRoom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!roomId.trim()) return;

    try {
      log("Joining room...");

      const caps = await viewer.joinRoom(roomId);

      log("Loading MediaSoup device...");

      await viewer.loadDevice(caps);

      log("Creating receive transport...");

      await viewer.createViewerTransport(roomId);

      log("Consuming media...");

      await viewer.consumeMedia(roomId, caps);

      log("Resuming consumers...");

      await viewer.resumeConsumer(roomId);

      log("Rendering media...");

      await viewer.renderMedia(roomId, videoRef);

      log("Listening for ICE state...");

      await viewer.connectionState(roomId);

      setConnected(true);

      startHeartBeat();

      log("Successfully connected.");
    } catch (err: any) {
      if (err.code === "RATE_LIMITED") {
        const seconds = Math.ceil((err.retryAt ?? 0) / 1000);
        log(`ERROR: You're joining too fast. Try again in ${seconds}s.`);
      } else {
        log(`ERROR: ${err.message}`);
      }
    }
  }

  async function leaveRoom() {
    /**
     * TODO:
     * Implement viewer.leaveRoom()
     *
     * Responsibilities:
     * - Emit `leaveRoom` to the backend.
     * - Close all MediaSoup consumers.
     * - Close the receive transport.
     * - Remove the viewer from the frontend room store.
     * - Release any allocated resources.
     * - Stop listening to socket events.
     * - Add stop heartbeat
     */

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;

      stream.getTracks().forEach((track) => {
        track.stop();
      });

      videoRef.current.srcObject = null;
    }

    setRecording(false);
    setConnected(false);

    log("Disconnected.");
  }

  function toggleRecord() {
    if (!connected || !roomId) return;

    if (recording) {
      socket.emit("stop-recording", roomId);
      setRecording(false);
      log("Stopping recording...");
    } else {
      socket.emit("start-recording", roomId);
      setRecording(true);
      log("Starting recording...");
    }
  }

  function openPanel(tab: "info" | "chat") {
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

          <span className="hidden text-sm text-white/35 sm:inline">
            viewer
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              connected
                ? "bg-[#ff5c5c] animate-pulse"
                : "bg-white/20"
            }`}
          />

          <span className="text-white/60">
            {connected ? "Watching" : "Not connected"}
          </span>
        </div>
      </header>

      {/* BODY */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 sm:gap-5 sm:px-6 sm:pb-6 lg:gap-6 lg:px-8 lg:pb-8">
        {/* LEFT: video + logs */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 transition-all duration-300">
          <ViewerVideo
            videoRef={videoRef}
            connected={connected}
            roomId={roomId}
            setRoomId={setRoomId}
            onJoin={joinRoom}
            onLeave={leaveRoom}
            panelOpen={panelOpen}
            panel={panel}
            onOpenPanel={openPanel}
          />

          {/* RECORDING CONTROL */}
          <div className="flex justify-center">
            <div
              className="group relative flex h-9 w-9 items-center justify-center"
              title="Record"
            >
              <button
                onClick={toggleRecord}
                disabled={!connected}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition disabled:opacity-30 ${
                  recording
                    ? "bg-[#ff5c5c] text-white"
                    : "text-white/70 hover:bg-white/10"
                }`}
                aria-label={recording ? "Stop recording" : "Record"}
              >
                <Circle
                  size={15}
                  fill={recording ? "currentColor" : "none"}
                />
              </button>

              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[11px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                {recording ? "Stop recording" : "Record"}
              </span>
            </div>
          </div>

          <ReactionOverlay roomId={roomId} />

          {/* SYSTEM LOGS */}
          <div className="shrink-0 rounded-xl bg-white/[0.03]">
            <button
              onClick={() => setLogsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-white/40"
            >
              System logs

              <span className="text-white/25">
                {logsOpen ? "hide" : "show"}
              </span>
            </button>

            {logsOpen && (
              <div className="max-h-48 overflow-y-auto border-t border-white/5">
                <SystemLogs logs={logs} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: panel */}
        {panelOpen && (
          <div className="flex w-full max-w-[360px] shrink-0 flex-col rounded-2xl bg-[#0f1512] ring-1 ring-white/10">
            <div className="flex items-center justify-between border-b border-white/5 p-2">
              <div className="flex flex-1 gap-1">
                {(["info", "chat"] as const).map((tab) => (
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

            <div className="min-h-0 flex-1 overflow-y-auto">
              {panel === "info" && (
                <div className="p-4">
                  <StreamInfo
                    roomId={roomId}
                    connected={connected}
                  />
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