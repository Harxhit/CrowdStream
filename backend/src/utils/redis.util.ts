import {Cluster, Redis} from "ioredis";
import config from "../config";

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