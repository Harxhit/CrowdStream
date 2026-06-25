import type { Socket } from "socket.io";
import {  createConsumerTransport, joinAsViewer } from "./viewer.handler";
import { getRoom } from "../rooms/room.store";
import logger from "../utils/logging";
import { connectConsumerTransport, consume } from "./viewer.handler";
import {
  resumeConsumer,
  pauseConsumer,
} from "../consumer/consumer.handler";
import { getRouter, routerToRoom } from "../mediasoup/router";

const registerViewerHanlder = async (socket: Socket) => {

  // Handles viewer joining a room and emitting router capabilties
  socket.on("joinRoom", async (roomId, ack) => {
    try {
      logger.info("Join as viewer listner started")

      await joinAsViewer(roomId, socket.id);

      socket.data.roomId = roomId;

      const routerId = routerToRoom.get(roomId); 
      if(!routerId){
        logger.error('Router not found')
          ack({
            success:false, 
            code: 'ROUTER_NOT_FOUND'
          })
        throw new Error("Router not found")
      }
      const router = getRouter(routerId)

      //Gets rtp capabilities
      const rtpCapabilities = router.rtpCapabilities

      ack({
        success: true, 
        data: {
          rtpCapabilities
        }
      })

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

  //Creates reciever transport for the viewer and emit transport info
  socket.on("createViewerTransport", async (roomId, ack) => {
    try {
      logger.info('Create viewer transport listner started')

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

      const consumers = await consume(roomId, socket.id, rtpCapabilities);

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
        
    } catch (error) {
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
    if (!room) {
      return socket.emit("error", { message: "Room does not exist" });
    }
    const payLoad = {
      type,
      viewerId,
      viewerCount: Object.keys(room.viewers).length,
    };
    socket.to("room").emit("viewerStateChange", payLoad);
  });

 
};

export default registerViewerHanlder;
