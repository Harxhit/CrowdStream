import { Server } from "socket.io";
import { RedisRoom } from "../types/mediasoup";
import logger from "./logging";
import { redis } from "./redis.util";

export interface Presence{
    roomId:string; 
    count: number;
}

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

export const addViewerInRedisRoom = async(roomId:string , socketId:string) => {
    try {
        await redis.sadd(`room:${roomId}:viewers`, socketId)
    } catch (error) {
        logger.error('Add viewer error',{
            error: (error as Error).message,
            stack: (error as Error).stack
        })
        throw error
    }
}

export const removeViewerFromRedisRoom = async(roomId: string , socketId:string) => {
    try {
        await redis.srem(`room:${roomId}:viewers`, socketId)
    } catch (error) {
        logger.error('Add viewer error',{
            error: (error as Error).message,
            stack: (error as Error).stack
        })
        throw error
    }
}

export const viewerCountInRedisRoom = async(roomId:string) => {
    try {
        return await redis.scard(`room:${roomId}:viewers`) 
    } catch (error) {
        logger.error('Viewer count error', {
            error: (error as Error).message,
            stack: (error as Error).stack
        })
    }
}

export const heartBeat = async(roomId: string , socketId:string) => {
    try {
        await redis.set(`room:${roomId}:presence:${socketId}`, 'true', 'EX' , 60);
    } catch (error) {
        logger.error('Heart beat failure',{
            error: (error as Error).message, 
            stack: (error as Error).stack
        })
        throw error
    }
}

export const publishPresence = async(payload:Presence) => {
    const channel = `room:${payload.roomId}:presence`;
    const receivers  = await redis.spublish(channel, JSON.stringify(payload));

    console.log("Redis delivered to", receivers, "subscribers");
}