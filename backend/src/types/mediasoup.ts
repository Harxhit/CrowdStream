import type { Router,  WebRtcTransport ,Producer ,Worker , Consumer} from "mediasoup/node/lib/types";

export type TransportType = "producer" | "consumer";
export type TransportRole = "broadcaster" | "viewer";
type Health = "healthy" | "unhealthy"

export interface Broadcaster {
  transports: Map<string, WebRtcTransport>;
  producers: Map<string,Producer>;
  joinedAt: number;
  role: "host" | "co-host";
}

export interface Viewer {
  transport?: Map<TransportType, WebRtcTransport>;
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
  role: TransportRole
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