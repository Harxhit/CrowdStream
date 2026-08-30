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
import { rateLimiter } from "./rateLimitingBucket";
import { ipHash } from "./hash.util";
import { getRoom } from "../rooms/room.store";
import { consumePlainTransportMedia, createAudioAndVideoPlainTranport } from "../recording/recording";
import { startFfmpegRecording, stopFfmpegRecording } from "../recording/ffmpeg";
import { activeRecordings } from "../stores/maps";
import { releasePorts } from "../recording/portAllocator";

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

      const userId = socket.data.user?.id
      const rateLimitResult = await rateLimiter(userId, 'user', 'chat', validated.roomId)
      if (!rateLimitResult.allowed) {
        logger.warn('Chat rate limit exceeded', { userId, roomId: validated.roomId, retryAt: rateLimitResult.retryAt })
        socket.emit('chat:rateLimited', { retryAt: rateLimitResult.retryAt })
        return
      }
      const hashedIp = ipHash(socket)
      const ipRateLimit = await rateLimiter(hashedIp, 'ip', 'chat', validated.roomId)
      if (!ipRateLimit.allowed) {
        logger.warn('Chat rate limit exceeded', { userId, roomId: validated.roomId, retryAt: rateLimitResult.retryAt })
        socket.emit('chat:rateLimited', { retryAt: ipRateLimit.retryAt })
        return
      }

      const moderation = moderateMessage(validated.message); 
      if(!moderation.allowed){
        logger.warn('Moderation blocked message', { userId, roomId: validated.roomId, reason: moderation.reason })
        socket.emit('chat:moderated', { reason: moderation.reason })
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

      const userId = socket.data.user?.id
      const rateLimitResult = await rateLimiter(userId, 'user', 'reactions', validated.roomId)
      if (!rateLimitResult.allowed) {
        logger.warn('Chat reactions limit exceeded', { userId, roomId: validated.roomId, retryAt: rateLimitResult.retryAt })
        socket.emit('chat:rateLimited', { retryAt: rateLimitResult.retryAt })
        return
      }

      const hashedIp =  ipHash(socket)
      const ipRateLimit = await rateLimiter(hashedIp, 'ip', 'reactions', validated.roomId)
      if (!ipRateLimit.allowed) {
        logger.warn('Chat reactions limit exceeded', { userId, roomId: validated.roomId, retryAt: rateLimitResult.retryAt })
        socket.emit('chat:rateLimited', { retryAt: ipRateLimit.retryAt })
        return
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
      return;
    }
  })

  socket.on("disconnect", async (reason) => {
    logger.info('[REASON]', reason)
    logger.info(`User disconnected ${socket.id} beacuse of ${reason}`)
    handleDisconnect(socket)
    await stopFfmpegRecording(socket.id)
  });

  socket.on('start-recording',async(payload) => {
    try {
      const roomId = payload; 
      if(!roomId){
        throw new Error('Room Id not found')
      }
      const room = getRoom(roomId); 
      if(!room){
        throw new Error('Room not found'); 
      }
      const socketId = socket.id; 
  
      const viewer = room.viewers.get(socketId);
      if(!viewer){
        throw new Error('Viewer not exist in room'); 
      }

      const {audioTransport, videoTransport, audioPort, videoPort} = await createAudioAndVideoPlainTranport(roomId, socketId)
      
      const {audioConsumer, videoConsumer} = await consumePlainTransportMedia(roomId, socketId, audioPort, videoPort)

      const ffmpeg = startFfmpegRecording(roomId, socketId); 

      const recordingId = crypto.randomUUID(); 

      activeRecordings.set(socketId, {
        ffmpeg: ffmpeg.ffmpeg, 
        roomId: roomId, 
        socketId: socketId, 
        recordingId: recordingId, 
        audioTransportId: audioTransport.id, 
        videoTransportId: videoTransport.id, 
        audioConsumerId: audioConsumer?.id, 
        videoConsumerId: videoConsumer?.id, 
        audioPort: audioPort, 
        videoPort: videoPort, 
        recordingPath: ffmpeg.recordingPath, 
      })

      audioConsumer?.resume(); 
      videoConsumer?.resume(); 

      socket.emit('recording-started', {recordingId})
      
    } catch (error) {
      logger.error('Recording failure',{
        error: (error as Error).message, 
        stack: (error as Error).stack
      })
    }
  })

  socket.on('stop-recording', async(roomId , ack) => {
    try {
      if(!roomId){
        throw new Error('Room Id not found')
      }
      const room = getRoom(roomId); 
      if(!room){
        throw new Error('Room not found'); 
      }
      const socketId = socket.id; 
  
      const viewer = room.viewers.get(socketId);
      if(!viewer){
        throw new Error('Viewer not exist in room'); 
      }
      
      const recordingsDetails = activeRecordings.get(socketId); 

      if (!recordingsDetails) {
        logger.warn(`No active recording to stop for room ${roomId}`);
        return; 
      }

      await stopFfmpegRecording(socketId)

      for(const transports of viewer.transport!.values()){
        if(transports.id === recordingsDetails?.audioTransportId || transports.id === recordingsDetails?.videoTransportId){
          transports.close()
        }
      }

      for(const consumer of viewer.consumers.values()){
        if(consumer.id === recordingsDetails?.videoConsumerId || consumer.id === recordingsDetails?.audioConsumerId){
          consumer.close()
        }
      }

      ack()
      
    } catch (error) {
      logger.error('Recording failure',{
        error: (error as Error).message, 
        stack: (error as Error).stack
      })
    }
  })
});
  

export {server , io}