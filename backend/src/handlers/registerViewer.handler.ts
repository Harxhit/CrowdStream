import { Socket } from "socket.io";
import {  createConsumerTransport, joinAsViewer } from "./viewer.handler";
import { getRoom } from "../rooms/room.store";
import logger from "../utils/logging";
import { connectConsumerTransport, consume } from "./viewer.handler";
import {
  resumeConsumer,
  pauseConsumer,
} from "../consumer/consumer.handler";
import { getRouter} from "../mediasoup/router";
import { routerToRoom, roomToRouter } from "../stores/maps";
import Viewer from "../models/viewer.model";
import LiveRoom from "../models/liveRoom.models";
import { ipHash, userAgentHash } from "../utils/hash.util";
import { heartBeat } from "../utils/roomCordinator";
import { rateLimiter } from "../utils/rateLimitingBucket";

const registerViewerHanlder = async (socket: Socket) => {

  // Handles viewer joining a room and emitting router capabilties
  socket.on("joinRoom", async (roomId, ack) => {
      try {
        logger.info("Join as viewer listner started")
        const viewerId = socket.data.user?.id

        const hashedIp = ipHash(socket)

        const userRateLimit = await rateLimiter(viewerId, 'user', 'join', roomId)
        if (!userRateLimit.allowed) {
          logger.warn('Join rate limit exceeded (user)', { viewerId, roomId, retryAt: userRateLimit.retryAt })
          ack({ success: false, code: 'RATE_LIMITED', retryAt: userRateLimit.retryAt })
          return
        }

        const ipRateLimit = await rateLimiter(hashedIp, 'ip', 'join', roomId)
        if (!ipRateLimit.allowed) {
          logger.warn('Join rate limit exceeded (ip)', { hashedIp, roomId, retryAt: ipRateLimit.retryAt })
          ack({ success: false, code: 'RATE_LIMITED', retryAt: ipRateLimit.retryAt })
          return
        }

        const room = getRoom(roomId); 
        if(!room){
          ack({
            success:false, 
            code: 'ROOM_NOT_FOUND'
          })
          return
        }
        const routerId = roomToRouter.get(roomId); 
        if(!routerId){
          logger.error('Router not found')
          ack({
            success:false, 
            code: 'ROUTER_NOT_FOUND'
          })
          return
        }
        const router = getRouter(routerId)
        const broadcasters = Array.from(room.broadcasters.entries()).map(
          ([socketId, broadcaster]) => ({
            socketId,
            role: broadcaster.role,
          })
        );
        socket.join(`room:${roomId}`)
        socket.data.roomId = roomId;

        await joinAsViewer(roomId, socket.id);
        const rtpCapabilities = router.rtpCapabilities
        ack({
          success: true, 
          data: {
            rtpCapabilities, 
            broadcasters
          }
        })

        const userAgentHashed = userAgentHash(socket)

        void Viewer.create({
          roomId: roomId, 
          viewerId: viewerId, 
          socketId: socket.id, 
          ipHash: hashedIp, 
          userAgentHash: userAgentHashed
        }).catch((error:any) => {
          logger.error("Failed to persist live room", error);
        })

        void LiveRoom.updateOne(
          { experienceRoomId: roomId },
          {
            $inc: {
              totalViewersJoined: 1,
            },
          }
        ).catch((error) => {
          logger.error('Increasing peak viewer count failed', error);
        });

        logger.info('Join viewer listner successfully executed')
      } catch (error) {
        logger.error('Join viewer error',{
          message:  (error as Error).message, 
          stack  : (error as Error).stack
        })

        ack({
          success: false,
          code: 'RTP_CAPABILITES_ERROR'
        })
      }
    });
  socket.on(`viewer:heartBeat`, () => {
    const roomId = socket.data.roomId; 
    const socketId = socket.id; 

    if(!roomId || !socketId){
      logger.error('Room not found')
    }

    const room = getRoom(roomId); 
    
    const isViewer = room.viewers.has(socketId)
    if(!isViewer){
      logger.error('Fake heartbeat')
      throw new Error('Viewer not is a room member')
    }

    heartBeat(roomId, socketId)
  })

  //Creates reciever transport for the viewer and emit transport info
  socket.on("createViewerTransport", async (roomId, ack) => {
    try {
      logger.info('Create viewer transport listner started')
      const viewerId = socket.data.user?.id
      const room = getRoom(roomId);

      //Find the viewer inside the room
      const viewer = room?.viewers.get(socket.id);
      if (!viewer) {
        logger.error('Viewer not found')
        ack({
          success: false, 
          code: 'VIEWER_NOT_FOUND'
        })
        throw new Error('Viewer not found')
      }

      const viewerTransport = await createConsumerTransport(roomId , socket.id)

      ack({
        success: true,
        data: {
          id: viewerTransport?.id,
          iceParameters: viewerTransport?.iceParameters,
          iceCandidates: viewerTransport?.iceCandidates,
          dtlsParameters: viewerTransport?.dtlsParameters,
        }
      });

      void Viewer.findOneAndUpdate(
        {
          roomId, 
          viewerId:viewerId
        },
        {
          $push: {
            transportId: viewerTransport?.id
          }
        }, 
        {new: true}
      ).catch((error) => {
        logger.error("Failed to update viewer transport", {
          viewerId,
          error: error,
        });
      });
     
      logger.info('Create viewer transport listner successfully executed')

    } catch (error) {
      logger.error('Viewer transport creation error',{
        message: (error as Error).message, 
        stack: (error as Error).stack
      })

      ack({
        success: false, 
        code: "TRANSPORT_CREATION_FAILED"
      })
    }
  });

  // Connects the viewer's transport by setting DTLS parameters for secure media flow
  socket.on("connectConsumerTransport", async (payload, ack) => {
    try {
      logger.info('Connect consumer listner started')

      const roomId = socket.data.roomId;
  
      const { dtlsParameters } = payload; 

      await connectConsumerTransport(roomId, socket.id, dtlsParameters);

      ack({
        success: true
      })

      logger.info('Connect consumer listner executed successfully')
    } catch (error) {
      logger.error('Connect conusmer transport error',{
        message: (error as Error).message, 
        stack : (error as Error).stack
      })

      ack({
        success: false, 
        code: "TRANSPORT_CONNECTION_FAILED"
      })
    }
  });

  // Handles a viewer requesting to consume a specific stream.
  socket.on("consume", async (roomId, rtpCapabilities, ack) => {
    try {
      logger.info('Consume lister started')
      const viewerId = socket.data.user?.id; 
      const consumers = await consume(roomId, socket.id, rtpCapabilities);
      void Viewer.updateOne(
        viewerId,
        {
          $push: {
            consumerIds: {
              $each: consumers.map((consumer) => consumer.id),
            },
          },
        }
      ).catch((error) => {
        logger.error("Failed to update consumer IDs", error);
      });

      logger.info('Consume lister executed successfully')
      ack({
        success: true, 
        data: {
          consumers
        }
      })
      
    } catch (error) {
     logger.error("Consume listner error",{
      message: (error as Error).message, 
      stack : (error as Error).stack
     })
     ack({
        success: false, 
        code: "CONSUME_ERROR"
     })
    }
  });

  // Pauses a specific media consumer (e.g., video or audio) for the viewer
  socket.on("pauseConsumer", async (roomId, socketId, consumerId,ack) => {
    try {
      pauseConsumer(roomId, socketId, consumerId);

      ack({
        success: true
      })
        
    }catch (error) {
      logger.error("Pause consumer error",{
        message: (error as Error).message, 
        stack: (error as Error).stack
      })

      ack({
        success: false, 
        code: 'PAUSE_CONSUMER_ERROR'
      })
    }
  });

  // Resumes a previously paused consumer for the viewer
  socket.on("resumeConsumer", async (roomId,consumerId, ack) => {
      try {
       resumeConsumer(roomId, socket.id, consumerId)
       ack({
        success: true, 
        data: {
          consumerId
        }
       })
       logger.info("Resume consumer listener executed successfully");
      }catch (error) {
        logger.error('Resume consumer error', {
          message: (error as Error).message, 
          stack: (error as Error).stack
        });

        ack({
            success: false, 
            code: "RESUME_CONSUMER_FAILED"
        })
      }
    });

  // Inform broadcasters and other viewers in real-time about viewers joining, leaving, or changing .
  socket.on("notifyViewerStateChange", (roomId, { type, viewerId }) => {
    const room = getRoom(roomId);
    const payLoad = {
      type,
      viewerId,
      viewerCount: Object.keys(room.viewers).length,
    };
    socket.to(`room:${roomId}`).emit("viewerStateChange", payLoad);
  });
 
};

export default registerViewerHanlder;
