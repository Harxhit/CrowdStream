import {Cluster, Redis} from "ioredis";
import config from "../config";
import { ChatMessage, publishMessage } from "./chat.util";
import { Server } from "socket.io";
import { increaseCount, Reaction } from "./emoji.util";
import logger from "./logging";
import { error } from "winston";
import { Presence, publishPresence, removeViewerFromRedisRoom, viewerCountInRedisRoom } from "./roomCordinator";
import fs from "fs";
import path from "path";
import { handleIncomingRequest, handleIncomingResponse } from "./podConnection";

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

const rateLimiterScript = fs.readFileSync(
  path.join(__dirname, "../scripts/rateLimit.lua"), 
  "utf-8"
);

redis.defineCommand("rateLimitCheck", {
  numberOfKeys: 1,
  lua: rateLimiterScript,
});

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

export const presenceSubscriber  = redis.duplicate(); 
presenceSubscriber.on('ready', async() => {
  console.log('Presence subscriber is ready')
})

presenceSubscriber.on('error', async() => {
  console.error('Presence subscriber error', error)
})

//Used for POD interconnection
export const podConnectionSubscriber = redis.duplicate(); 
podConnectionSubscriber.on('ready', () => {
  console.log('POD connection subsriber is ready')
})

podConnectionSubscriber.on('error', () => {
  console.error('POD connection error',error)
})

//Used by chat pub/sub 
export const chatSubscriber = redis.duplicate(); 
chatSubscriber.on('ready', async() => {
  console.log('Chat subscriber is ready')
})

chatSubscriber.on("error" , (error) => {
  console.error('Chat subscriber error',error)
})

export const expiredSubsriber = redis.duplicate(); 
expiredSubsriber.on('ready', async() => {
  console.log('Expired subscriber is ready')
})

expiredSubsriber.on("error" , (error) => {
  console.error('Expired subscriber error',error)
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

    presenceSubscriber.on('smessage',(channel , payload) => {
      console.log("Redis message:", channel, payload);

      switch(true){
          case channel.endsWith(':presence'):{
            const {roomId, count} = JSON.parse(payload)
            io.to(`room:${roomId}`).emit('room:presence',count)
            break
          }

          default: logger.warn(`Unknown Redis channel: ${channel}`)
      }
    })

    expiredSubsriber.psubscribe('__keyevent@*__:expired');
    expiredSubsriber.on('pmessage', async(_payload,channel, key) => {
      try {
        console.log("Redis message:", channel, key);

        const [, roomId, , socketId] = key.split(':')

        await removeViewerFromRedisRoom(roomId, socketId)
        const count = await viewerCountInRedisRoom(roomId)

        if(count === undefined){
          throw new Error('Count is undefiend')
        }

        const presence:Presence = {
          roomId: roomId, 
          count: count
        }
        await publishPresence(presence)
      } catch (error) {
        logger.error('Expired presence cleanup failed', {
          error: (error as Error).message,
          stack: (error as Error).stack
        })
      }
    })
    logger.info("Redis subscribers initialized");


    podConnectionSubscriber.on('smessage', async(channel, payload) => {
      console.info('POD connection:',channel , payload); 

      try {
        switch(true){

          case channel.endsWith(':cmd'):{
            handleIncomingRequest(payload)
            break; 
          }

          case channel.endsWith(':response'): {
            handleIncomingResponse(payload);
            break; 
          }

          default: logger.warn(`Unkown redis channel: ${channel}`)
        }
        
      } catch (error) {
        logger.error('POD connection pmessage error',{
          error: (error as Error).message, 
          stack: (error as Error).stack
        })
      }
    })
    
  } catch (error) {
    logger.error('Failed to process redis message',{
      error: (error as Error).message, 
      stack: (error as Error).stack
    })
  }

}

export async function subscribeToRoomPresence(roomId:string){
  await presenceSubscriber.ssubscribe(`room:${roomId}:presence`)
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


// someone is asking ME to do something
export const subscribeToPodCommands = async() => {
  await podConnectionSubscriber.ssubscribe(`pod:${config.instanceId}:cmd`)
}

// someone is answering a request I made earlier
export const subscribeToPodResponses = async() => {
  await podConnectionSubscriber.ssubscribe(`pod:${config.instanceId}:response`)
}