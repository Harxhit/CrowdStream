import { Server } from "socket.io";
import { createServer } from "node:http";
import app from "../app";
import logger from "./logging";
import registerBroadcasterHandler from "../handlers/registerBroadcaster.handler";
import registerViewerHanlder from "../handlers/registerViewer.handler";
import config from "../config/index";
import { socketAuth } from "../middlewares/authentication.middleware";
import cookie from 'cookie-parser'
import { createShardedAdapter } from "@socket.io/redis-adapter";
import { redis } from "./redis.util";
import { handleDisconnect } from "./disconnect.util";

const subClient = redis.duplicate(); 

subClient.on('ready', () => {
  console.log('Subscriber ready')
})

subClient.on("error" , (error) => {
  console.error('Redis subscriber error',error)
})

const server = createServer(app);
const io = new Server (server, {
  adapter: createShardedAdapter(redis, subClient),
  cors: {
    origin: config.corsOrigin?.split(",").map(o => o.trim()),
    methods: ["GET", "POST"],
  },
});
 
io.engine.use(cookie())
io.use(socketAuth);

io.on("connection", (socket) => {
  logger.info(`[${config.instanceId}] Client connected: ${socket.id}`);

  socket.emit('debug:instance' , {
    instanceId: config.instanceId
  })

  registerBroadcasterHandler(socket);
  registerViewerHanlder(socket);

  socket.on("disconnect", async (reason) => {
    logger.info(`User disconnected ${socket.id} beacuse of ${reason}`)
    handleDisconnect(socket)
  });
});
  

export {server , io}