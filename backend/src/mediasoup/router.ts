import type { Router , RouterOptions , Worker} from "mediasoup/node/lib/types";
import logger from "../utils/logging";
import { workerLogs } from "./worker";
import { handleWorkerClose } from "./worker";
import { getRoom } from "../rooms/room.store";

export const routers = new Map<string, Router>();
export const routerToWorker = new Map<string, string>();
export const routerToRoom = new Map<string, string>();

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
const createRouter = async (roomId:string, worker:Worker, workerId:string) => {
  const startTime = Date.now()
  try {
    logger.info('Creation of router started')

    const router = await worker.createRouter({ 
      mediaCodecs, 
    });

    if(!router){
      logger.error('Error in creation router')
      throw new Error('Error in creation router')
    }

    routers.set(router.id, router);
    
    logger.info(`Router created`,{
      roomId: roomId, 
      routerId: router.id, 
      worker: worker.pid, 
      durationMs: Date.now() - startTime
    });

    const workerInfo = workerLogs.get(workerId); 
    workerInfo?.routerIds.add(router.id)
    routerToWorker.set(router.id, workerId);
    routerToWorker.set(router.id, roomId);
    
    return router;
    
  } catch (error:any) {
    logger.error('Router error',{
      message : (error as Error).message, 
      stack: (error as Error).stack
    })
    throw error
  }
};

//Fetches the  router for a specific room
const getRouter = (routerId: string) => {
  const startTime = Date.now()
  try {
    logger.info('Fetching of router started')

    const router = routers.get(routerId);

    if (!router){ 
      logger.error('Error founding the router')
      throw new Error("Router not found");
    }

    logger.info('Fetching of router executed successfully',{
      routerId: router.id, 
      router: router, 
      durationMs: Date.now() - startTime
    })

    return router;
    
  } catch (error: any) {
    logger.error('Internal server error', {
      message: (error as Error).message, 
      stack : (error as Error).stack
    })

    throw new error
  }
};


const routerHealthCheck = (router: Router) => {
  router.on('workerclose', () => {
    console.log('Worker closed'); 
    const workerId = routerToWorker.get(router.id); 
    const workerInfo = workerLogs.get(workerId!); 
    const worker  = workerInfo?.worker; 
    handleWorkerClose(worker!, workerId!)
  })
}


const routerStats = (router:Router) => {
  try {
    const roomId = routerToRoom.get(router.id); 
    const workerId = routerToWorker.get(router.id)
    if(!roomId){
      logger.error('RoomId not found'); 
      throw new Error('RoomId not found')
    }
    const roomDetails = getRoom(roomId)

    const routerStats = {
      id: router.id, 
      roomId: roomId, 
      workerId: workerId, 
      broadCasterCount: roomDetails.broadcasters.size, 
      viewerCount : roomDetails.viewers.size, 
      roomHealth: roomDetails.health
    }
    return routerStats
  } catch (error) {
    logger.error('Router stats', {
      message: (error as Error).message, 
      stack: (error as Error).stack
    })
    throw error
  }
}

const handleRouterClose = (router:Router) => {
  const startTime = Date.now()
  try {

    const roomId = routerToRoom.get(router.id); 
    if(!roomId){
      logger.error('RoomId not found'); 
      throw new Error('Room not found')
    }
    const room = getRoom(roomId) 
    room.broadcasters.forEach((br) => {
      br.transports.forEach((t) => {
        t.close()
      })

      br.producers.forEach((p) => {
        p.close()
      })
    })

    room.viewers.forEach((view) => {
      view.transport?.forEach((t) => {
        t.close()
      })

      view.consumers.forEach((p) => {
        p.close()
      })
    })

    routers.delete(router.id);
    routerToRoom.delete(router.id);
    routerToWorker.delete(router.id);

    logger.info('Router closed',{
      durationMs: Date.now() - startTime, 
      routerId: router.id
    })
  } catch (error) {
    logger.error('Router closed',{
      message: (error as Error).message, 
      stack : (error as Error).stack
    })
    throw error
  }
}

export { createRouter, getRouter , routerHealthCheck, routerStats, handleRouterClose};
