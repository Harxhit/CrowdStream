# 📺 Croudly Live Streaming – Self-Hosted MediaSoup + HLS Setup

> Scalable livestreaming for Croudly using WebRTC + HLS (10K+ viewers)

---

## 🧠 Architecture

Broadcaster (WebRTC)
│
MediaSoup SFU (self-hosted)
│
FFmpeg (transcode to HLS)
│
Nginx/CDN (serve HLS viewers)

- **MediaSoup** handles real-time WebRTC for small rooms (<500 viewers).
- **FFmpeg** extracts the stream and transcodes to `.m3u8` & `.ts`.
- **HLS** is served via Nginx (or S3/CDN) to scale playback to thousands.

---

## 🛠 Stack

| Tool      | Purpose                              |
| --------- | ------------------------------------ |
| MediaSoup | SFU WebRTC routing                   |
| FFmpeg    | Convert WebRTC to HLS                |
| Nginx     | Serve HLS files (or RTMP for input)  |
| Node.js   | Signaling server + MediaSoup control |
| React     | Broadcaster / Viewer frontend        |

---

### Architecture

Browser (Broadcaster / Viewer)
│
│ Socket.IO (WebSocket signaling)
│
Node.js Signaling Server
│
│ mediasoup API
│
mediasoup Workers → Routers → WebRTC Transports → Producers / Consumers

- **Socket.IO** is used only for signaling (room creation, transport setup, consume/produce).
- **mediasoup** handles all real-time media routing.
- The **frontend** mirrors backend room state for debugging and UI sync.

---

## 🧩 Backend Data Model

Each live room is stored in backend memory:

```bash
Room {
router: Router,
webRtcServer: WebRtcServer,
broadcasters: Map<socketId, Broadcaster>,
viewers: Map<socketId, Viewer>
}

Broadcaster {
transports: Map<"producer", WebRtcTransport>,
producers: Map<producerId, Producer>
}

Viewer {
transports: Map<"consumer", WebRtcTransport>,
consumers: Map<consumerId, Consumer>
}
```

This allows:

- Multiple hosts per room
- Independent audio/video stream per host

🎬 Live Stream Lifecycle

1️⃣ Host creates a room

#### Frontend

```bash
socket.emit("createRoom")
```

#### Backend

```bash
- create roomId
- create mediasoup Router
- create WebRtcServer
- add broadcaster
- save room in memory
- socket.data.roomId = roomId
- emit "roomCreated"
```

#### Frontend

- receive roomId
- create local Room(roomId)
- store in frontend memory
- display roomId in UI

2️⃣ Router RTP Capability handshake

#### Frontend

```bash
socket.emit("getRouterRtpCapabilities", { roomId })
```

#### Backend

```bash
socket.emit("routerRtpCapabilities", router.rtpCapabilities)
```

#### Frontend

```bash
device = new mediasoup.Device()
device.load(routerRtpCapabilities)
```

This allows browser and mediasoup to agree on codecs (VP8, H264, Opus, etc).

3️⃣ Broadcaster transport

#### Frontend

```bash
socket.emit("createBroadcasterTransport", { roomId })
```

#### Backend

```bash
router.createWebRtcTransport()
save in room.broadcasters[hostId]
emit "broadcasterTransportCreated"
```

#### Frontend

```bash
sendTransport = device.createSendTransport(params)
sendTransport.on("connect") → socket.emit("connectBroadcasterTransport", dtls)
```

4️⃣ Host produces media

#### Frontend

```
getUserMedia()
sendTransport.produce(video)
sendTransport.produce(audio)
```

#### Backend

```
transport.produce()
save producer in room.broadcasters[hostId]
emit "produced"
```

Media is now flowing into mediasoup.

5️⃣ Viewer joins

#### Frontend

```
socket.emit("joinRoom", { roomId })
```

#### Backend

```
add viewer
emit routerRtpCapabilities
```

#### Frontend

```
device.load(routerRtpCapabilities)
```

6️⃣ Viewer transport

#### Frontend

```
socket.emit("createViewerTransport", { roomId })
```

#### Backend

```
create recv transport
save in room.viewers[viewerId]
emit "viewerTransportCreated"
```

#### Frontend

```
recvTransport = device.createRecvTransport()
recvTransport.on("connect") → socket.emit("connectConsumerTransport")
```

7️⃣ Viewer consumes

#### Frontend

```
socket.emit("consume", {
roomId,
rtpCapabilities: device.rtpCapabilities
})
```

#### Backend

```
for each producer:
router.canConsume()
transport.consume()
emit "consumerCreated"
```

#### Frontend

```
transport.consume()
attach tracks to <video>
socket.emit("resumeConsumer")
```

Viewer now sees and hears all broadcasters.

### Multi-Host Support

Backend memory allows:

```
room.broadcasters = {
hostId → { transports, producers },
coHost1 → { transports, producers },
coHost2 → { transports, producers }
}
```

Viewers consume all producers from all hosts.
