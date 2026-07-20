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
import { redis , subClient, initializeSubscribers} from "./redis.util";
import { handleDisconnect } from "./disconnect.util";
import { validateMessage, authenticateUser, moderateMessage, ChatMessage, publishMessage } from "./chat.util";
import { publishReaction, Reaction, validateReactions } from "./emoji.util";

const server = createServer(app);
const io = new Server (server, {
  adapter: createShardedAdapter(redis, subClient),
  cors: {
    origin: config.corsOrigin?.split(",").map(o => o.trim()),
    methods: ["GET", "POST"],
  },
});
initializeSubscribers(io) 
io.engine.use(cookie())
io.use(socketAuth);

io.on("connection", (socket) => {
  logger.info(`[${config.instanceId}] Client connected: ${socket.id}`);

  socket.emit('debug:instance' , {
    instanceId: config.instanceId
  })

  registerBroadcasterHandler(socket);
  registerViewerHanlder(socket);

  socket.on('chat:message', async(payload) => {
    try {
      const validated = validateMessage(payload);

      const authorized = authenticateUser(validated.roomId, socket.id);
      if (!authorized) {
        logger.error("User is not authorized");
        return;
      }
      const allowed = moderateMessage(validated.message); 
      if(!allowed){
        logger.error('Moderation not passed')
        return 
      }

      const message: ChatMessage = {
        roomId: validated.roomId, 
        senderId: socket.id, 
        message: validated.message, 
        timestamp: Date.now()
      }

      await publishMessage(message)
    } catch (error) {
      logger.error('Chat message error',{
        error: (error as Error).message, 
        stack: (error as Error).stack, 
      })
    }
  })

  socket.on('chat:reactions', async(payload) => {
    try {
      const validated = validateReactions(payload); 

      const authorised = authenticateUser(validated.roomId, socket.id)

      if(!authorised){
        logger.error("User is not authorized");
        return;
      }

      const reaction:Reaction = {
        roomId: validated.roomId, 
        emoji: validated.emoji, 
        senderId: socket.id, 
        timeStamp: Date.now()
      }

      await publishReaction(reaction)

    } catch (error) {
      logger.error('Chat reactions error',{
        erorr: (error as Error).message,
        stack: (error as Error).stack
      })
      throw error
    }
  })

  socket.on("disconnect", async (reason) => {
    logger.info(`User disconnected ${socket.id} beacuse of ${reason}`)
    handleDisconnect(socket)
  });
});
  

export {server , io}