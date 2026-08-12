import logger from "./logging"
import { chatPayloadValidator } from "../validation/chat.validation";
import { getRoom } from "../rooms/room.store";
import { redis } from "./redis.util";
import { PROFANITY_LIST } from "../config/profanity.list";


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

interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

const MAX_MESSAGE_LENGTH = 500;
const REPEATED_CHAR_THRESHOLD = 8; // e.g. "aaaaaaaaaa" spam
const URL_REGEX = /(https?:\/\/|www\.)\S+/i;


const containsProfanity = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return PROFANITY_LIST.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(normalized);
  });
};

const isRepeatedCharSpam = (message: string): boolean => {
  return /(.)\1{7,}/.test(message); // same char repeated 8+ times in a row
};

const isExcessiveCaps = (message: string): boolean => {
  const letters = message.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 10) return false;
  const upper = letters.replace(/[^A-Z]/g, '');
  return upper.length / letters.length > 0.8;
};

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

const moderateMessage = (message: string): ModerationResult => {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { allowed: false, reason: 'MESSAGE_TOO_LONG' };
  }

  if (containsProfanity(message)) {
    return { allowed: false, reason: 'PROFANITY' };
  }

  if (isRepeatedCharSpam(message)) {
    return { allowed: false, reason: 'SPAM_REPEATED_CHARS' };
  }

  if (isExcessiveCaps(message)) {
    return { allowed: false, reason: 'SPAM_EXCESSIVE_CAPS' };
  }

  if (URL_REGEX.test(message)) {
    return { allowed: false, reason: 'LINK_NOT_ALLOWED' };
  }

  return { allowed: true };
};

const publishMessage = async(payload: ChatMessage) => {
    const channel = `room:${payload.roomId}:chat`;
    const receivers  = await redis.spublish(channel, JSON.stringify(payload));

    console.log("Redis delivered to", receivers, "subscribers");
}

export {authenticateUser, validateMessage, moderateMessage, publishMessage}