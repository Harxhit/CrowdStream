import type {
  Router,
  WebRtcTransport
} from "mediasoup/node/lib/types";
import logger from "../utils/logging";
import config from "../config/index";
import { handleRouterClose } from "./router";


type TransportRole = "broadcaster" | "viewer";

interface TransportInfo {
  roomId: string;
  socketId: string;
  role: TransportRole
}

export const transportRegistry = new Map<string, TransportInfo>();

//Creates webRtc transport
const createWebRtcTransport = async (
  router: Router,
  roomId: string, 
  socketId: string, 
  role: TransportRole
) => {
  const starTime = Date.now()
  try {
    const transport = await router.createWebRtcTransport({
      listenIps : [
        {
          ip: config.publicIp,
          announcedIp : config.announcedIp
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 600000
    });

    if(!transport){
      logger.info('Transport creation failed')
      return; 
    }

    transportRegistry.set(transport.id, {
      roomId, 
      socketId, 
      role,
    })

    transport.on("routerclose", () => {
      handleRouterClose(router)
    })

    transport.on("dtlsstatechange", (dtlsState) => {
      const info = transportRegistry.get(transport.id);

      logger.info("Transport DTLS state changed", {
        event: "TRANSPORT_DTLS_STATE_CHANGE",
        transportId: transport.id,
        roomId: info?.roomId,
        socketId: info?.socketId,
        role: info?.role,
        dtlsState,
        timestamp: Date.now()
      });
    });

    transport.on("icestatechange", (iceState) => {
      const info = transportRegistry.get(transport.id);

      logger.info("Transport ICE state changed", {
        event: "TRANSPORT_ICE_STATE_CHANGE",
        transportId: transport.id,
        roomId: info?.roomId,
        socketId: info?.socketId,
        role: info?.role,
        iceState,
        timestamp: Date.now()
      });
    });

    transport.on("sctpstatechange", (sctpState) => {
      const info = transportRegistry.get(transport.id);

      logger.info("Transport SCTP state changed", {
        event: "TRANSPORT_SCTP_STATE_CHANGE",
        transportId: transport.id,
        roomId: info?.roomId,
        socketId: info?.socketId,
        role: info?.role,
        sctpState,
        timestamp: Date.now()
      });
    });

    logger.info(`Transport created : ${transport.id}`,{
      durationMs: Date.now() - starTime,
      routerId: router.id
    });
    
    return transport;
    
  } catch (error) {
      logger.error('Server error', {
      message : (error as Error).message, 
      stack : (error as Error).stack
    })

    throw error
  }
};


const transportHealthCheck = async (
  transport: WebRtcTransport
) => {
  try {
    const info = transportRegistry.get(transport.id);

    const stats = await transport.getStats();

    logger.info("Transport health check", {
      event: "TRANSPORT_HEALTH_CHECK",
      transportId: transport.id,
      roomId: info?.roomId,
      socketId: info?.socketId,
      role: info?.role,
      stats,
      timestamp: Date.now()
    });

  } catch (error) {
    logger.error("Transport health check failed", {
      transportId: transport.id,
      message: (error as Error).message,
      stack: (error as Error).stack
    });

    throw error
  }
};

export {createWebRtcTransport, transportHealthCheck}