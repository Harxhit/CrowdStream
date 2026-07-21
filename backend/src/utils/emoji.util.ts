import { reactionSchema } from "../validation/emoji.validation";
import logger from "./logging";
import { redis } from "./redis.util";
import { Server } from "socket.io";

export interface ChatReactions{
    roomId: string; 
    emoji:string; 
}

export interface Reaction{
    roomId:string; 
    emoji: string; 
    senderId: string; 
    timeStamp: number
}

type ReactionBuffer = {
    counts: Map<string, number>; 
    timer: NodeJS.Timeout  | null
}

export const reactionBuffers = new Map<string, ReactionBuffer>()

export const getReactionBuffer = (roomId: string) => {
    let buffer = reactionBuffers.get(roomId); 

    if(!buffer){
        buffer = {
            counts: new Map(),
            timer: null
        }

        reactionBuffers.set(roomId,buffer)
    }
    return buffer
}

export const increaseCount = (io: Server, roomId:string, emoji:string) => {
    // console.log("Reaction received:", emoji);
    const buffer = getReactionBuffer(roomId)
    const hasEmoji = buffer.counts.get(emoji); 

    if(hasEmoji === undefined){
        buffer.counts.set(emoji, 1)
    }else{
        buffer.counts.set(emoji, Number(hasEmoji) + 1)
    }

    if(buffer.timer === null){
        buffer.timer = setTimeout(() => {

            const counts = Object.fromEntries(buffer.counts); 
            // console.log("Emitting batch:", Object.fromEntries(buffer.counts));
            io.to(`room:${roomId}`).emit('chat:reactions', {
                roomId, 
                counts
            })

            buffer.counts.clear(); 
            buffer.timer = null; 

        },200)
    }
}


export const validateReactions = (payload: ChatReactions) => {
    const {error ,value} = reactionSchema.validate(payload); 
    if(error){
        logger.error('Validation error',{
            message: error.details[0].message,
            path: error.details[0].path,
        })
        throw new Error('Validation error')
    }
    const {roomId, emoji} = value; 
    return {
        roomId, 
        emoji
    }
}

export const publishReaction = async(payload: Reaction) => {
    const channel = `room:${payload.roomId}:reactions`;
    const receivers  = await redis.spublish(channel, JSON.stringify(payload));

    console.log("Redis delivered to", receivers, "subscribers");
}