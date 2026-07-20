import { reactionSchema } from "../validation/emoji.validation";
import logger from "./logging";
import { redis } from "./redis.util";

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