# 📡 HLS Streaming Backend – Node.js + TypeScript

> Backend system for scalable HTTP Live Streaming (HLS) using FFmpeg, built with Node.js and TypeScript.

---

## 🎯 What is HLS?

**HLS (HTTP Live Streaming)** is a media streaming protocol developed by Apple that breaks video into small `.ts` segments and serves them with a `.m3u8` playlist file over regular HTTP.

### 🔁 How It Works

1. Video is ingested (via webcam, RTMP, or WebRTC).
2. It is transcoded into `.ts` chunks using **FFmpeg**.
3. A `.m3u8` manifest is generated.
4. Frontend plays it using an HLS player (like `hls.js`).

HLS supports adaptive bitrate and is **scalable to 10K+ viewers** using CDNs or simple HTTP servers.

---

## 🏗️ Backend Architecture

Input (WebRTC/RTMP/File)
↓
FFmpeg (spawned in Node.js)
↓
HLS Segments (.ts + .m3u8)
↓
Served via Express/Nginx/CDN

---

## 🧱 Tech Stack

| Tool       | Purpose                            |
| ---------- | ---------------------------------- |
| Node.js    | Server runtime                     |
| TypeScript | Type safety and dev experience     |
| Express.js | Optional API/segment server        |
| FFmpeg     | Media transcoding to HLS format    |
| Multer     | (optional) Accepting uploads       |
| WebSocket  | (optional) Realtime status updates |

---

