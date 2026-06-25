import type { Device } from "mediasoup-client";
import type {
  Transport,
  Consumer, 
  RtpCapabilities,
} from "mediasoup-client/types";

export type TransportType = "producer" | "consumer";
export type ProducerKind = "audio" | "video";

export type FrontendProducer = {
  kind: ProducerKind;
  appData: any;
};


export type FrontendBroadcaster = {
  transports: Map<TransportType, Transport>;
  rtpCapabilities?: RtpCapabilities;
  producers: Map<string, FrontendProducer>;
  device: Device | null;
  joinedAt: Date;
  role: "host" | "co-host";
};

export type FrontendViewer = {
  transports: Map<TransportType, Transport>;
  device: Device | null;
  rtpCapabilities?: RtpCapabilities;
  consumers: Map<string, Consumer>;
  joinedAt: Date;
  role: "viewer" | "co-host";
};

export type FrontendRoom = {
  id: string;
  broadcasters: Map<string, FrontendBroadcaster>;
  viewers: Map<string, FrontendViewer>;
};
