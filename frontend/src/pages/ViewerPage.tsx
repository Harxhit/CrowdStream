import { useRef, useState } from "react";

import Viewer from "../viewer";

import ViewerVideo from "../components/viewer/ViewerVideo";
import StreamInfo from "../components/viewer/StreamInfo";
import ViewerControls from "../components/viewer/ViewerControls";
import LiveChat from "../components/broadcaster/LiveChat";

const viewer = new Viewer();

export default function ViewerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [roomId, setRoomId] = useState("");

  const [connected, setConnected] = useState(false);

  const [viewerCount] = useState(0);

  const [_logs, setLogs] = useState<string[]>([]);

  function log(message: string) {
    console.log(message);

    setLogs((prev) => [...prev, message]);
  }

  async function joinRoom(e: React.FormEvent) {
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

      log("Successfully connected.");
    } catch (err: any) {
      log(`ERROR: ${err.message}`);
    }
  }

  function leaveRoom() {
    /**
     * We'll implement cleanup later.
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

          {/* LEFT */}

          <div className="space-y-6 lg:col-span-2">

            <ViewerVideo
              videoRef={videoRef}
              connected={connected}
            />

            <ViewerControls
              connected={connected}
              roomId={roomId}
              setRoomId={setRoomId}
              onJoin={joinRoom}
              onLeave={leaveRoom}
            />

          </div>

          {/* RIGHT */}

          <div className="space-y-6">

            <StreamInfo
              roomId={roomId}
              viewers={viewerCount}
              connected={connected}
            />

            <LiveChat />

          </div>

        </div>

      </div>
    </main>
  );
}