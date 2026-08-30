import type {
  Router,
  WebRtcTransport
} from "mediasoup/node/lib/types";
import logger from "../utils/logging";
import config from "../config/index";
import { handleRouterClose } from "./router";
import { transportRegistry } from "../stores/maps";
import { getRoom } from "../rooms/room.store";
import { TransportType } from "../types/mediasoup";


//Creates webRtc transport
const createWebRtcTransport = async (
  router: Router,
  roomId: string, 
  socketId: string, 
  role: TransportType
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

      logger.info(`Transport ICE state changed: ${iceState}`, {
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

const createPlainTransport = async(  
  roomId: string, 
  socketId: string,
  role: TransportType
) => {
  const startTime = Date.now()
  try {
    const room = getRoom(roomId); 

    const viewer = room.viewers.get(socketId)

    if(!viewer){
      logger.error("Viewer not found",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Viewer not found");
    }

    const router = room.router; 
    if(!router){
      logger.error('Router not found for the room',{
        roomId: roomId, 
        routerId: room.router.id, 
        socketId: socketId, 
        durationMs: Date.now() - startTime
      })
     throw new Error('Router not found')
    }

    const plainTransport = await router.createPlainTransport({
      listenInfo : {protocol: "udp", ip: config.recordingIp}, 
      rtcpMux: true, 
      comedia: false
    });
  
    if(!plainTransport){
      logger.error('Plain transport creation failed')
      throw new Error('Plain transport creation failed'); 
    }
  
    transportRegistry.set(plainTransport.id, {
      roomId, 
      role, 
      socketId
    })

    viewer.transport?.set(role, plainTransport!)

    plainTransport.on('routerclose', () => {
      handleRouterClose(router)
    })

    return plainTransport; 

  } catch (error) {
    logger.error('Plain transport creation error',{
      error: (error as Error).message, 
      stack: (error as Error).stack
    })

    throw error
  }
}

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

export {createWebRtcTransport, transportHealthCheck, createPlainTransport}