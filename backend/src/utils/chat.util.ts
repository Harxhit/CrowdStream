import logger from "./logging"
import { chatPayloadValidator } from "../validation/chat.validation";
import { getRoom } from "../rooms/room.store";
import { redis } from "./redis.util";

interface ChatMessagePayload {
    roomId: string;
    message: string;
}
export interface ChatMessage {
    roomId: string;
    senderId: string;
    message: string;
    timestamp: number;
}

const authenticateUser = (roomId:string, socketId: string) => {
    const room = getRoom(roomId);
    const isMember = room.viewers.has(socketId); 
    const isBroadcaster = room.broadcasters.has(socketId)
    if(!isMember && !isBroadcaster){
        logger.error('User did not joined the room'); 
        return false; 
    }
    return true
}

const validateMessage = (payload:ChatMessagePayload) => {
    const {error,value} = chatPayloadValidator.validate(payload); 
    if(error){
        logger.error('Validation error',{
            path: error.details[0].path, 
            message: error.details[0].message
        })
        throw new Error('Validation error')
    }
    const { roomId, message } = value;
    return {
        roomId,
        message
    }
}

const moderateMessage = (message:string) => {
    // TODO:
    // - Profanity filter
    // - Spam detection
    // - Rate limiting
    // - AI moderation
    return true
}

const publishMessage = async(payload: ChatMessage) => {
    const channel = `room:${payload.roomId}:chat`;
    const receivers  = await redis.spublish(channel, JSON.stringify(payload));

    console.log("Redis delivered to", receivers, "subscribers");
}

export {authenticateUser, validateMessage, moderateMessage, publishMessage}