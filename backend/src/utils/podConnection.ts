import config from "../config";
import { podRequestHandleMap, roomToRouter } from "../stores/maps";
import logger from "./logging"
import { redis } from "./redis.util";
import { getRouter } from "../mediasoup/router";
import { getRoom } from "../rooms/room.store";
import type { RequestStatus } from "../types/mediasoup";
import { createConsumerTransport, joinAsViewer } from "../handlers/viewer.handler";
import { publishMessage } from "./chat.util";
import { heartBeat } from "./roomCordinator";

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

                const payload: PodResponsePayload = {
                    requestId, 
                    result, 
                }

                await publishResponse(payload, replyTo)
                await joinAsViewer(roomId, socketId)
                break; 
            }
            
            case type === 'heartBeat': {
                const {roomId, socketId} = args as unknown as JoinRoomArgs; 
                
                const room = getRoom(roomId); 

                const isViewer = room.viewers.get(socketId);
                if(!isViewer){
                    logger.error('Viewer is not the member of room'); 
                    throw new Error('Viewer is not the member of room'); 
                }

                result.status = 'completed'; 
                const payload: PodResponsePayload = {
                    requestId, 
                    result
                }

                await heartBeat(roomId, socketId)
                await publishResponse(payload, replyTo)

                break; 
            }

            case type === 'createViewerTransport': {
                const {roomId, socketId} = args as unknown as JoinRoomArgs; 

                const room = getRoom(roomId); 

                const isViewer = room.viewers.get(socketId); 
                if(!isViewer){
                    throw new Error('Viewer is not the member of room'); 
                }

                const viewerTransport = await createConsumerTransport(roomId, socketId); 
                result = {
                    id: viewerTransport.id, 
                    iceParameters: viewerTransport.iceParameters, 
                    iceCandidates: viewerTransport.iceCandidates, 
                    dtlsParameters: viewerTransport.dtlsParameters
                }

                const payLoad: PodResponsePayload = {
                    result, 
                    requestId
                }

                await publishResponse(payLoad, replyTo); 
                break; 
            }
            
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
        const {replyTo , requestId}  = payload; 
        const payLoad: PodResponsePayload = {
            requestId, 
            result: {}, 
            error: (error as Error).message 

        }
        await publishResponse(payLoad, replyTo)
    }
}

export const handleIncomingResponse = async(payload: PodResponsePayload) => {
    const entry = podRequestHandleMap.get(payload.requestId); 
    if(!entry){
        logger.error('Entry not found')
        return; 
    }
    entry.status = payload.error ? 'error' : 'resolved'; 
    try {
        await entry.onComplete(payload.result, payload.error); 
    } catch (error) {
        logger.error('Handle incoming request error',{
            error: (error as Error).message, 
            stack: (error as Error).stack,
        })
    }
    podRequestHandleMap.delete(payload.requestId)
}

export const publishCommand = async(payload: PodCommandPayload, targetNode:string) => {
    const channel = `pod:${targetNode}:cmd`
    const receivers = await redis.spublish(channel , JSON.stringify(payload))

    if(receivers === 0){
        logger.error(`No subscribers for ${channel} — pod may be down`, { requestId: payload.requestId });
    }

    logger.info("Redis delivered to", receivers, "subscribers"); 
    return receivers; 
}

export const publishResponse = async(payload: PodResponsePayload, channel:string) => {
    const receivers = await redis.spublish(channel, JSON.stringify(payload))
    logger.info('Redis delivered to:', receivers, 'subsribers')
}