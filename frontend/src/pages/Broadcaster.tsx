import { useRef, useState } from "react";

import Broadcaster from "../broadcaster";

import VideoPreview from "../components/broadcaster/VideoPreview";
import RoomCard from "../components/broadcaster/RoomCard";
import StreamControls from "../components/broadcaster/StreamControls";
import StreamStats from "../components/broadcaster/StreamStats";
import SystemLogs from "../components/broadcaster/SystemLogs";
import LiveChat from "../components/broadcaster/LiveChat";

const broadcaster = new Broadcaster();

export default function BroadcasterPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [roomId, setRoomId] = useState<string | null>(null);

  const [logs, setLogs] = useState<string[]>([]);

  const [isLive, setIsLive] = useState(false);

  const [viewerCount] = useState(0);

  const log = (message: string) => {
    console.log(message);

    setLogs((prev) => [...prev, message]);
  };

  async function startBroadcast() {
    try {
      log("Creating room...");

      const room = await broadcaster.createRoom();

      setRoomId(room.id);

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

      await broadcaster.startProducing();

      setIsLive(true);

      log("Broadcast started successfully.");
    } catch (err: any) {
      log(`ERROR: ${err.message}`);
    }
  }

  async function stopBroadcast() {
    /**
     * We'll implement this later.
     */

    log("Stopping broadcast...");

    setIsLive(false);
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
              Broadcaster Dashboard
            </p>
          </div>

          {isLive && (
            <span className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold">
              ● LIVE
            </span>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* LEFT */}

          <div className="space-y-6 lg:col-span-2">

            <VideoPreview
              videoRef={videoRef}
              isLive={isLive}
            />

            <StreamControls
              isLive={isLive}
              onStart={startBroadcast}
              onStop={stopBroadcast}
            />

            <SystemLogs
              logs={logs}
            />

          </div>

          {/* RIGHT */}

          <div className="space-y-6">

            <RoomCard
              roomId={roomId}
            />

            <StreamStats
              isLive={isLive}
              viewers={viewerCount}
            />

            <LiveChat />

          </div>

        </div>

      </div>
    </main>
  );
}