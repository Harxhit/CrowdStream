import {Cluster, Redis} from "ioredis";
import config from "../config";
import { ChatMessage } from "./chat.util";
import { Server } from "socket.io";

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

export async function intialiseSocketSubscriber(io:Server){
  await subClient.connect()
}

export async function initializeChatSubscriber(io: Server) {

  chatSubscriber.on('smessage', (channel, payload) => {
    const chatMessage: ChatMessage = JSON.parse(payload);
    io.to(`room:${chatMessage.roomId}`).emit("chat:message", chatMessage);
  })
  console.log("Chat subscriber initialized");
}

export async function subscribeToRoomChat(roomId: string) {
  await chatSubscriber.ssubscribe(`room:${roomId}:chat`);
}

export const createRedisRoomKey = (roomId:string):string => {
  const roomKey = `room:${roomId}`
  return roomKey; 
}