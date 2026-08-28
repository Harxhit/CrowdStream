import config from "../config";
import { podRequestHandleMap, roomToRouter } from "../stores/maps";
import logger from "./logging"
import { redis } from "./redis.util";
import { getRouter } from "../mediasoup/router";
import { getRoom } from "../rooms/room.store";
import type { RequestStatus } from "../types/mediasoup";

export interface PodCommandPayload {
  type: string;       
  requestId: string;   
  args: Record<string, unknown>;  
  replyTo: string;  
  date: number   
}

export interface PodResponsePayload {
  requestId: string;    
  result: Record<string, unknown>;  
  error?: string;        
}

interface JoinRoomArgs {
    roomId: string; 
    socketId: string; 
}

export const handleIncomingRequest = async(payload: PodCommandPayload) => {
    try {
        const {type, requestId , args, replyTo, date} = payload;

        let result: Record<string, unknown> = {}; 
        let error: string | undefined; 

        switch(true){
            case (type === 'joinRoom'): {
                const {roomId, socketId} = args as unknown as JoinRoomArgs; 

                const room = getRoom(roomId)

                const routerId = roomToRouter.get(roomId); 
                if(!routerId){
                    logger.error('RouterId not found')
                    throw new Error('RouterId not found')
                }

                const router = getRouter(routerId); 
                const rtpCapabilities = router.rtpCapabilities; 

                const broadcasters = Array.from(room.broadcasters.entries()).map(
                    ([socketId, broadcaster]) => ({
                        socketId,
                        role: broadcaster.role,
                    })
                );

                result = {rtpCapabilities, broadcasters}; 
                error = 'resolved'

                const payload: PodResponsePayload = {
                    requestId, 
                    result, 
                }

                await publishResponse(payload, replyTo)
                break; 
            }
            
            case type === '': {}

            case type === '': {}
            
            case type === '': {}
            
            case type === '': {}
            
            case type === '': {}
            
            default: throw new Error(`Unkown pod command type: ${type}`)
        }


    } catch (error) {
        logger.error('Incoming request failed',{
            name: (error as Error).name, 
            error: (error as Error).message, 
            stack: (error as Error).stack
        })
    }
}

export const handleIncomingResponse = async(payload: PodResponsePayload) => {
    const entry = podRequestHandleMap.get(payload.requestId); 
    if(!entry){
        logger.error('Entry not found')
        return; 
    }
    entry.status = payload.error ? 'error' : 'resolved'; 
    entry.onComplete(payload.result, payload.error); 
    podRequestHandleMap.delete(payload.requestId)
}

export const publishCommand = async(payload: PodCommandPayload, targetNode:string) => {
    const channel = `pod:${targetNode}:cmd`
    const receivers = await redis.spublish(channel , JSON.stringify(payload))

    logger.info("Redis delivered to", receivers, "subscribers")
}

export const publishResponse = async(payload: PodResponsePayload, channel:string) => {
    const receivers = await redis.spublish(channel, JSON.stringify(payload))
    logger.info('Redis delivered to:', receivers, 'subsribers')
}