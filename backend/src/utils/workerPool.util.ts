import os from "node:os";
import config from "../config";
import { initWorker } from "../mediasoup/worker";
import logger from "./logging";
import { workerPool, workerLoadMap } from "../stores/maps";
import { getRoom } from "../rooms/room.store";
import type {Worker} from "mediasoup/node/lib/types"
import { workerMutex } from "./mutix.util";


export const workerPoolCreation = async() => {
    const totalCpuCores  = os.availableParallelism(); 
    console.info('Available CPU cores', totalCpuCores); 

    const workerPoolSize = config.mediasoupWorkers; 

    await Promise.all(
        Array.from({ length: workerPoolSize }, () => initWorker())
    );

    logger.info("Worker pool initialized", {workerPoolSize});
}

export const workerLoad = () => {
    const startTime = Date.now()
    try {
        for(const [workerId, WorkerInfo] of workerPool){
            let viewers = 0; 
            let broadcasters = 0; 
            WorkerInfo.associatedRooms.forEach((id) => {
                const room = getRoom(id); 
    
                viewers += room.viewers.size; 
                broadcasters += room.broadcasters.size; 
                
            })
            workerLoadMap.set(workerId, {
                workerPid: WorkerInfo.pid, 
                worker: WorkerInfo.worker, 
                routerCount: WorkerInfo.routerIds.size, 
                roomCount: WorkerInfo.associatedRooms.size, 
                viewers: viewers, 
                broadcasters: broadcasters, 
                totalUsers: viewers + broadcasters  
            })
        }
        logger.info('Woker loads loaded successfully',{
            durationMs: Date.now() - startTime
        })
    } catch (error) {
        logger.error('Internal server error',{
            message: (error as Error).message, 
            stack: (error as Error).stack
        })

        throw error
    }
}

export const assignWorker = async() => {
    workerLoad()

    if(scaleWorkerCheck()){
        await scaleWorkerPool()
        workerLoad()
    }

    return leastLoadedWorker()

}

export const scaleWorkerCheck = () => {
    try {
        for(const [_ , workerLoad] of workerLoadMap){
            if(workerLoad.totalUsers < config.WORKER_THRESHOLD){
                return false; 
            }
        }
        return true; 
    } catch (error) {
        logger.error('Internal server error',{
            message: (error as Error).message,
            stack: (error as Error).stack
        })
        throw error
    }
}

export const canCreateWorker = () => {
    return workerPool.size < config.MEDIASOUP_MAX_WORKERS; 
}

export const scaleWorkerPool = async() => {
    await workerMutex.runExclusive(async () => {
        if(!canCreateWorker()){
            logger.error('Maximum worker count reached')
return;
    
        }
        logger.info("Creating overflow worker");
        await initWorker();
    })
}

export const leastLoadedWorker = () => {
    const startTime = Date.now()
    try {
        let selectedWorkerId: string | null = null;
        let selectedWorker: Worker | null = null;
        let minLoad = Number.MAX_SAFE_INTEGER;

        for(const [workerId, workerLoads] of workerLoadMap){
            if(minLoad > workerLoads.totalUsers){
                minLoad = workerLoads.totalUsers; 
                selectedWorkerId = workerId; 
                selectedWorker = workerLoads.worker
            }
        }
        if(!selectedWorker || !selectedWorkerId){
            logger.error('No workers are avaiable'); 
            throw new Error('No worker are available')
        }
        
        logger.info('Woker assigned succesfully',{
            workerId: selectedWorkerId, 
            durationMs: Date.now() - startTime
        })
        return{
            selectedWorker, 
            selectedWorkerId
        }
        
    } catch (error) {
        logger.error('Internal server error',{
            message: (error as Error).message, 
            stack : (error as Error).stack
        })
        throw error
    }
}