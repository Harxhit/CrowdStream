import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Viewer from "../viewer";

import SystemLogs from "../components/broadcaster/SystemLogs";
import ViewerVideo from "../components/viewer/ViewerVideo";
import StreamInfo from "../components/viewer/StreamInfo";
import ViewerControls from "../components/viewer/ViewerControls";
import LiveChat from "../components/broadcaster/LiveChat";
import ReactionOverlay from "../components/reactions/ReactionOverlay";
import { startHeartBeat } from "../socket";


interface Log {
  message: string;
  timestamp: Date;
}

const viewer = new Viewer();

export default function ViewerPage() {
  const [searchParams] = useSearchParams();

  const videoRef = useRef<HTMLVideoElement>(null);

  const [roomId, setRoomId] = useState(
    () => searchParams.get("roomId") ?? ""
  );

  const [connected, setConnected] = useState(false);


  const [logs, setLogs] = useState<Log[]>([]);
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
  async function joinRoom(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!roomId.trim()) return;

    try {
      log("Joining room...");

      const caps = await viewer.joinRoom(roomId);

      // log("Loading MediaSoup device...");

      // await viewer.loadDevice(caps);

      // log("Creating receive transport...");

      // await viewer.createViewerTransport(roomId);

      // log("Consuming media...");

      // await viewer.consumeMedia(roomId, caps);

      // log("Resuming consumers...");

      // await viewer.resumeConsumer(roomId);

      // log("Rendering media...");

      // await viewer.renderMedia(roomId, videoRef);

      // log("Listening for ICE state...");

      // await viewer.connectionState(roomId);

      setConnected(true);

      startHeartBeat()

      log("Successfully connected.");
    } catch (err: any) {
      log(`ERROR: ${err.message}`);
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

    /**
     * TODO:
     * Reset any viewer-specific state.
     *
     * Examples:
     * - Clear chat messages.
     * - Reset viewer count.
     * - Reset stream statistics.
     * - Clear connection state.
     */

    setConnected(false);

    log("Disconnected.");
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-7xl p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              Crowd<span className="text-blue-500">Stream</span>
            </h1>

            <p className="mt-2 text-neutral-400">
              Viewer Dashboard
            </p>
          </div>

          {connected && (
            <span className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold">
              ● LIVE
            </span>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left */}

          <div className="space-y-6 lg:col-span-2">
            <ViewerVideo
              videoRef={videoRef}
              connected={connected}
            />
            <ReactionOverlay roomId={roomId} />

            <ViewerControls
              connected={connected}
              roomId={roomId}
              setRoomId={setRoomId}
              onJoin={joinRoom}
              onLeave={leaveRoom}
            />
            <SystemLogs
              logs={logs}
            />
          </div>

          {/* Right */}

          <div className="space-y-6">
            <StreamInfo
              roomId={roomId}
              connected={connected}
            />

            <LiveChat roomId={roomId}/>
          </div>
        </div>
      </div>
    </main>
  );
}