import React, { useRef, useState } from "react";
import Broadcaster from "./broadcaster";
import Viewer from "./viewer";

const broadcaster = new Broadcaster();
const viewer = new Viewer();

export default function App() {
  const hostVideo = useRef<HTMLVideoElement>(null);
  const viewerVideo = useRef<HTMLVideoElement>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [viewerRoomId, setViewerRoomId] = useState("");

  const [logs, setLogs] = useState<string[]>([]);
  const [hostReady, setHostReady] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);

  const log = (msg: string) => {
    console.log(msg);
    setLogs(l => [...l, msg]);
  };

  /* ================= HOST ================= */

  const startHost = async () => {
    try {
      log("Creating room...");
      const room = await broadcaster.createRoom();
      setRoomId(room.id);

      log("Fetching RTP caps...");
      const caps = await broadcaster.getRouterCapabilities(room.id);

      log("Loading device...");
      await broadcaster.loadDevice(caps);

      log("Creating send transport...");
      await broadcaster.createBroadcasterTransport(room.id);

      log("Getting camera...");
      const stream = await broadcaster.getUserMedia();
      hostVideo.current!.srcObject = stream;

      log("Producing media...");
      await broadcaster.startProducing();

      
      setHostReady(true);
      log("HOST LIVE");


    } catch (e: any) {
      log("HOST ERROR: " + e.message);
    }
  };

  /* ================= VIEWER ================= */

  const joinViewer = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!viewerRoomId) return;

      log("Viewer joining room...");
      await viewer.joinRoom(viewerRoomId);

      const room = viewer["room"];

      log("Loading device...");
      await viewer.loadDevice(room!.rtpCapabilities);

      log("Creating recv transport...");
      await viewer.createViewerTransport(viewerRoomId);


      log('Consume media')
      await viewer.consumeMedia(viewerRoomId , room?.rtpCapabilities)

      log("Resume consumer")
      await viewer.resumeConsumer(viewerRoomId); 

      log('Rendering media')
      await viewer.renderMedia(viewerRoomId, viewerVideo )

      log('ICE State')
      await viewer.connectionState(viewerRoomId)
      
      setViewerReady(true);
      log("VIEWER CONNECTED");
    } catch (e: any) {
      log("VIEWER ERROR: " + e.message);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", height: "100vh", background: "#000", color: "#0f0" }}>

      {/* BROADCASTER */}
      <div style={{ padding: 10 }}>
        <h2>Broadcaster</h2>
        <video ref={hostVideo} autoPlay muted playsInline style={{ width: "100%", background: "#111" }} />
        <button onClick={startHost}>Go Live</button>

        {roomId && (
          <>
            <div>Room ID:</div>
            <input value={roomId} readOnly style={{ width: "100%" }} />
          </>
        )}

        {hostReady && <div style={{ color: "lime" }}>LIVE</div>}
      </div>

      {/* LOGS */}
      <div style={{ padding: 10, overflow: "auto", background: "#050505" }}>
        <h2>System Log</h2>
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>

      {/* VIEWER */}
      <div style={{ padding: 10 }}>
        <h2>Viewer</h2>
        <video ref={viewerVideo} autoPlay playsInline style={{ width: "100%", background: "#111" }} />

        <form onSubmit={joinViewer}>
          <input
            type="text"
            placeholder="Paste Room ID"
            value={viewerRoomId}
            onChange={e => setViewerRoomId(e.target.value)}
            style={{ width: "100%" }}
          />
          <button type="submit">Join Room</button>
        </form>

        {viewerReady && <div style={{ color: "cyan" }}>CONNECTED</div>}
      </div>

    </div>
  );
}
