import { RedisRoom } from "../types/mediasoup";
import logger from "./logging";
import { redis } from "./redis.util";

export const getRedisRoom = async(roomKey:string):Promise<RedisRoom>=> {
    const redisRoom = await redis.hgetall(roomKey); 

    if(Object.keys(redisRoom).length === 0){
        logger.error('No redis room exists'); 
        throw new Error('Redis room does not exists')
    }

    return {
        roomId: redisRoom.roomId, 
        workerPid: redisRoom.workerPid, 
        workerId: redisRoom.workerId, 
        nodeId: redisRoom.nodeId, 
        broadcasterId: redisRoom.broadcasterId, 
        routerId: redisRoom.routerId,
        status: redisRoom.status as RedisRoom['status']
    }
}

export const removeRedisRoom = async(roomKey:string) => {
    const deletedRoom = await redis.del(roomKey); 

    if(deletedRoom === 0){
        logger.warn(`Redis ${roomKey} does not exist`)
    }
    logger.info(`${roomKey} room deleted successfully`)
}