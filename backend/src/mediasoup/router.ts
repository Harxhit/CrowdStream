import type { Router , RouterOptions , Worker} from "mediasoup/node/lib/types";
import logger from "../utils/logging";

//Stores router for all user
const routers = new Map<string, Router>();

//Media codecs
const mediaCodecs: NonNullable<RouterOptions["mediaCodecs"]> = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
    },
  },
];

//Creates a central mediasoup router for the specific rooms
const createRouter = async (roomId:string, worker:Worker) => {
  const startTime = Date.now()
  try {
    logger.info('Creation of router started')

    const router = await worker?.createRouter({ 
      mediaCodecs, 
    });

    if(!router){
      logger.error('Error creating router')
      throw new Error('Error in creation of router')
    }
  
    routers.set(roomId, router);
  
    logger.info(`Router created for room: ${roomId}`, Date.now() - startTime);
    
    return router;
    
  } catch (error:any) {
    logger.error('Internal server error',{
      message : (error as Error).message, 
      stack: (error as Error).stack
    })
  }
};


//Fetches the  router for a specific room
const getRouter = (roomId: string) => {
  const startTime = Date.now()
  try {
    logger.info('Fetching of router started')

    const router = routers.get(roomId);

    if (!router){ 
      logger.error('Error founding the router')
      throw new Error("Router not found");
    }

    logger.info('Fetching of router executed successfully', Date.now() - startTime)

    return router;
    
  } catch (error: any) {
    logger.error('Internal server error', {
      message: (error as Error).message, 
      stack : (error as Error).stack
    })
  }
};

export { createRouter, getRouter };
