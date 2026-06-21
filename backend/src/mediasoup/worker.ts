import * as mediasoup from "mediasoup";
import type { WorkerLogTag, WorkerSettings } from "mediasoup/node/lib/types";
import type { Worker } from "mediasoup/node/lib/types";
import logger from "../utils/logging";
import apiError from '../utils/apiError'
import {config} from '../index'
import { deleteRoom, getRoom } from "../rooms/room.store";

interface WorkerInfo {
  worker: Worker;
  routerIds: Set<string>;
  associatedRooms: Set<string>;
}

const workerLogs = new Map<string, WorkerInfo>()

const mediaSoupConfig: WorkerSettings = {
  logLevel: "warn",
  logTags: ["info", "ice", "dtls", "srtp", "rtcp"] as WorkerLogTag[],
  rtcMinPort: config.rtcMinPort,
  rtcMaxPort: config.rtcMaxPort,
};

const handleWorkerDeath = (worker:Worker, workerId: string) => {
  const startTime = Date.now()
  try {
    const workerInfo = workerLogs.get(workerId); 
    logger.info('MediaSoup worker died', {
      workerId: workerId, 
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

    workerLogs.delete(workerId)

    logger.log('Worker death handled successfully',{
      durationMs: Date.now() - startTime
    })

    return 'Worker died closing room'
    
  } catch (error:any) {
    logger.error({
      message: (error as Error).message, 
      stack: (error as Error).stack
    })
    throw new error
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

    worker.observer.on('close' , () => {
      handleWorkerClose()
    })

    logger.info('Worker created successfully',{
      duration_ms: Date.now() - startTime, 
      workerPid: worker.pid
    })

    workerLogs.set(workerId, {
      worker,
      routerIds: new Set(), 
      associatedRooms: new Set()
    })

    return{ 
      worker, 
      workerId
    }

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

const workerHealthCheck = async(worker: Worker, workerId:string) => {
  worker.on('died', (error) => {
    logger.error('Mediasoup worker died',{
      error: error, 
      workerPid: worker.pid, 
      timeStamp: Date.now()
    })
    console.error('Mediasoup worker died')
    handleWorkerDeath(worker, workerId)
  })

}

export { initWorker, workerLogs, workerHealthCheck};
