import {Cluster, Redis} from "ioredis";
import config from "../config";
import { ChatMessage } from "./chat.util";
import { Server } from "socket.io";
import { increaseCount, Reaction } from "./emoji.util";
import logger from "./logging";

const startUpNodes = [
    {
        host: config.redisHost, 
        port: config.redisPort1
    },
    {
        host: config.redisHost, 
        port: config.redisPort2
    }, 
    {
        host: config.redisHost, 
        port: config.redisPort3
    }
]

export const redis = new Cluster(startUpNodes, {shardedSubscribers: true}); 


redis.on("connect", () => {
  console.info("Connected to Redis Cluster");
});

redis.on("ready", () => {
  console.info("Redis Cluster is ready");
});

redis.on("error", (err) => {
  console.error("Redis Cluster error:", err);
});

redis.on("close", () => {
  console.info("Redis Cluster connection closed");
});

redis.on("reconnecting", () => {
  console.info("Redis Cluster reconnecting...");
});

//Used by socket.io handler
export const subClient = redis.duplicate(); 
subClient.on('ready', async() => {
  console.log('Subscriber ready')
})

subClient.on("error" , (error) => {
  console.error('Redis subscriber error',error)
})

//Used by chat pub/sub 
export const chatSubscriber = redis.duplicate(); 
chatSubscriber.on('ready', async() => {
  console.log('Chat subscriber is ready')
})

chatSubscriber.on("error" , (error) => {
  console.error('Chat subscriber error',error)
})


export function initializeSubscribers(io: Server) {
  try {
    chatSubscriber.on("smessage", (channel, payload) => {
      console.log("Redis message:", channel, payload);
      switch (true) {
        case channel.endsWith(":chat"): {
          const message: ChatMessage = JSON.parse(payload);
          io.to(`room:${message.roomId}`).emit("chat:message", message);
          break;
        }
  
        case channel.endsWith(":reactions"): {
          const reaction: Reaction = JSON.parse(payload);
          increaseCount(io, reaction.roomId, reaction.emoji)
          break;
        }
  
        default:
          logger.warn(`Unknown Redis channel: ${channel}`);
      }
    });
    logger.info("Redis subscribers initialized");
    
  } catch (error) {
    logger.error('Failed to process redis message',{
      error: (error as Error).message, 
      stack: (error as Error).stack
    })
  }

}

export async function subscribeToRoomChat(roomId: string) {
  await chatSubscriber.ssubscribe(`room:${roomId}:chat`);
}

export async function subscribeToRoomReactions(roomId: string) {
  await chatSubscriber.ssubscribe(`room:${roomId}:reactions`);
}

export const createRedisRoomKey = (roomId:string):string => {
  const roomKey = `room:${roomId}`
  return roomKey; 
}