import type { Device } from "mediasoup-client";
import type {
  Transport,
  Producer,
  Consumer
} from "mediasoup-client/types";

export type TransportType = "producer" | "consumer";

export type FrontendBroadcaster = {
  transports: Map<TransportType, Transport>;
  producers: Map<string, Producer>;
  joinedAt: number;
  role: "host" | "co-host";
};

export type FrontendViewer = {
  transports: Map<TransportType, Transport>;
  rtpCapabilities?: any;
  consumers: Map<string, Consumer>;
  joinedAt: number;
  role: "viewer" | "co-host";
};

export type FrontendRoom = {
  id: string;
  device: Device;
  broadcasters: Map<string, FrontendBroadcaster>;
  viewers: Map<string, FrontendViewer>;
};
