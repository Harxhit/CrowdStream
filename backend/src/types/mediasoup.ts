import type { Router,  WebRtcTransport ,Producer ,Worker , Consumer, PlainTransport} from "mediasoup/node/lib/types";

export type TransportType = "producer" | "consumer" | "recording-audio" | "recording-video";
export type Health = "healthy" | "unhealthy"
import { ChildProcess } from "node:child_process";

export interface Broadcaster {
  socketId: string; 
  transports: Map<string, WebRtcTransport>;
  producers: Map<string,Producer>;
  joinedAt: number;
  role: "host" | "co-host";
}

export interface Viewer {
  socketId: string; 
  transport?: Map<TransportType, WebRtcTransport | PlainTransport>;
  rtpCapabilities?: any;
  consumers: Map<string, Consumer>;
  joinedAt: number;
  role: "viewer" | "co-host";
}

export interface Room {
  router: Router;
  broadcasters: Map<string, Broadcaster>;
  viewers: Map<string, Viewer>;
  worker: Worker; 
  health: Health
}

export interface WorkerInfo{
  pid: number;  
  worker: Worker;
  health: Health
  routerIds: Set<string>;
  associatedRooms: Set<string>;
}

export interface TransportInfo {
  roomId: string;
  socketId: string;
  role: TransportType
}

export interface WorkerLoad {
  workerPid: number;
  worker: Worker;

  routerCount: number;
  roomCount: number;

  viewers: number;
  broadcasters: number;
  totalUsers: number;
}

export interface RedisRoom {
  roomId: string;
  nodeId?: string;
  workerPid?: string;
  workerId?: string;
  routerId?: string;
  broadcasterId?: string;
  status: "creating" | "live" | "ended";
}

export interface RecordingSession {
  ffmpeg: ChildProcess;
  recordingId: string; 
  socketId: string; 
  roomId: string;
  audioTransportId:string; 
  videoTransportId: string; 
  audioConsumerId?: string;
  videoConsumerId?: string;
  audioPort: number; 
  videoPort: number; 
  recordingPath: string; 
}