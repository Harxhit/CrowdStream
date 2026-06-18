import type {
  Router,
} from "mediasoup/node/lib/types";
import logger from "../utils/logging";
import {config} from '../index'


//Creates webRtc transport
const createWebRtcTransport = async (
  router: Router,
) => {
  const starTime = Date.now()
  try {
    logger.info('Creation of webRTC transport started')
    
    const transport = await router.createWebRtcTransport({
      listenIps : [
        {
          ip: config.publicIp,
          announcedIp : config.announcedIp
        },
      ],
      enableUdp: true,
      enableTcp: false,
      preferUdp: true,
    });
    
    if(!transport){
      logger.info('Transport creation failed')
      return
    }
    logger.info(`WebRTC Transport created : ${transport.id}`, Date.now() - starTime);
    
    return transport;
    
  } catch (error) {
      logger.error('Server error', {
      message : (error as Error).message, 
      stack : (error as Error).stack
    })
  }
};

export {createWebRtcTransport}