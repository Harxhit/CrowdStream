import * as mediasoup from "mediasoup";
import type { WorkerLogTag, WorkerSettings, Worker } from "mediasoup/node/lib/types";
import logger from "../utils/logging";
import apiError from '../utils/apiError'
import config from "../config/index";
import { workerLoadMap, workerPool } from "../stores/maps";
import { deleteRoom, getRoom } from "../rooms/room.store";

const mediaSoupConfig: WorkerSettings = {
  logLevel: "warn",
  logTags: ["info", "ice", "dtls", "srtp", "rtcp"] as WorkerLogTag[],
  rtcMinPort: config.rtcMinPort,
  rtcMaxPort: config.rtcMaxPort,
};

const handleWorkerDeath = async(worker:Worker, workerId: string) => {
  const startTime = Date.now()
  try {
    const workerInfo = workerPool.get(workerId); 
    logger.info('MediaSoup worker died', {
      workerId, 
      workerPid: worker.pid, 
      affectedRooms: workerInfo?.associatedRooms, 
      affectedRouter: workerInfo?.routerIds, 
      timeStamp: Date.now()
    })

    const roomIds = workerInfo?.associatedRooms; 

    roomIds?.forEach((roomId) => {
      const room = getRoom(roomId);
      room.health = "unhealthy"

      room.broadcasters.forEach((br) => {
        br.producers.forEach((id) => {
          id?.close()
        }) 

        br.transports.forEach((id) => {
          id?.close()
        })
      })

      room.viewers.forEach((tr) => {
        tr.consumers.forEach((id) => {
          id?.close()
        })

        tr.transport?.forEach((id) =>{
          id?.close()
        })
      })

      deleteRoom(roomId)
    })

    const routers = workerInfo?.routerIds; 
    routers?.forEach((id) => {
      routers.delete(id)
    })

    workerPool.delete(workerId)
    workerLoadMap.delete(workerId)

    logger.log('Worker death handled successfully',{
      durationMs: Date.now() - startTime, 
      workerId
    })
    try {
      await initWorker()
      logger.info('Worker died new worker created')
    } catch (error) {
      logger.error('Worker replacement failed', {
        workerId,
        message: (error as Error).message,
        stack: (error as Error).stack
      })
    }
    
  } catch (error:any) {
    logger.error({
      message: (error as Error).message, 
      stack: (error as Error).stack
    })
    throw error
  }
}

const handleWorkerClose = async(worker:Worker, workerId: string) => {
  const startTime = Date.now(); 
  try {
    const workerInfo = workerPool.get(workerId)
    logger.log('Worker closed',{
      workerId, 
      workerPid: worker.pid, 
      affectedRooms: workerInfo?.associatedRooms, 
      affectedRouter: workerInfo?.routerIds, 
      timeStamp: Date.now()
    })
    const roomIds = workerInfo?.associatedRooms

    roomIds?.forEach((roomId) => {
    const room = getRoom(roomId);
      room.health = "unhealthy"
    })
    
    logger.log('Worker closed',{
      durationMs: Date.now() - startTime, 
      workerId
    })
    logger.info('Worker closed')
  } catch (error) {
    logger.log('Worker close',{
      message: (error as Error).message, 
      stack: (error as Error).stack
    })
    throw error
  }
}

//Creates a mediasoup worker(core process for media)
const initWorker = async () => {
  const startTime = Date.now()
  const workerId = crypto.randomUUID()
  try {
    logger.info('Creating worker started')
    
    const worker = await mediasoup.createWorker(mediaSoupConfig)

    worker.on('died', () => {
      handleWorkerDeath(worker, workerId)
    })

    logger.info('Worker created successfully',{
      duration_ms: Date.now() - startTime, 
      workerPid: worker.pid
    })
    workerPool.set(workerId, {
      worker,
      pid: worker.pid,
      health: "healthy",
      routerIds: new Set(), 
      associatedRooms: new Set()
    })
  }catch (error:any) {
  logger.error('Creating worker error', {
    message: (error as Error).message, 
    stack : (error as Error).stack
  })

  throw new apiError(
    500,
    'Worker creation failed'
  );
 }
};

const workerHealthCheck = () => {
  const expectedWorkers = config.mediasoupWorkers;
  const actualWorkers = workerPool.size;

  logger.info("Worker pool health check", {
      expectedWorkers,
      actualWorkers,
  });

  if (actualWorkers !== expectedWorkers) {
    logger.warn("Worker pool size mismatch", {
      expectedWorkers,
      actualWorkers,
    });
  }

  for (const [workerId, workerInfo] of workerPool) {
    logger.info("Worker status", {
      workerId,
      pid: workerInfo.pid,
      health: workerInfo.health,
      roomCount: workerInfo.associatedRooms.size,
      routerCount: workerInfo.routerIds.size,
    });

    if (workerInfo.health !== "healthy") {
      logger.warn("Worker marked unhealthy", {
        workerId,
        pid: workerInfo.pid,
      });
    }
  }
};

export { initWorker,workerHealthCheck, handleWorkerClose};
