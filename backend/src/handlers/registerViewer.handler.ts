import { Socket } from "socket.io";
import {  createConsumerTransport, joinAsViewer } from "./viewer.handler";
import { getRoom } from "../rooms/room.store";
import logger from "../utils/logging";
import { connectConsumerTransport, consume } from "./viewer.handler";
import {
  resumeConsumer,
  pauseConsumer,
} from "../consumer/consumer.handler";

const registerViewerHanlder = async (socket: Socket) => {

  // Handles viewer joining a room and emitting router capabilties
  socket.on("joinRoom", async ({ roomId },cb) => {
    try {
      logger.info("Join as viewer listner started")

      //Joim the viewer
      await joinAsViewer(roomId, socket.id);

      //Gets the room details
      const room = getRoom(roomId);

      //Sets the roomId to socket data
      socket.data.roomId = roomId;

      //Gets room router
      const router = room?.router;
      if (!router) {
        logger.error('Room router not found')
        return
      }
      
      //Gets rtp capabilities
      const rtpCapabilities = router.rtpCapabilities;


      
      //Emits rtp capabilities
      cb({rtpCapabilities: rtpCapabilities});

      logger.info('Join viewer listner successfully executed')
    } catch (error) {
      logger.error('Join viewer error',{
        message:  (error as Error).message, 
        stack  : (error as Error).stack
      })
    }
  });

  //Creates reciever transport for the viewer and emit transport info
  socket.on("createViewerTransport", async ({ roomId }) => {
    try {
      logger.info('Create viewer transport listner started')

      //Get the room
      const room = getRoom(roomId);

      //Find the viewer inside the room
      const viewer = room?.viewers.get(socket.id);
      if (!viewer) {
        logger.error('Viewer not found in the room')
        return 
      }


      const viewerTransport = await createConsumerTransport(roomId , socket.id)

      console.log('ICE candaidates being sent to veiwer', viewerTransport?.iceCandidates)

      socket.emit("viewerTransportCreated", {
        id: viewerTransport?.id,
        iceParameters: viewerTransport?.iceParameters,
        dtlsParameters: viewerTransport?.dtlsParameters,
        iceCandidates: viewerTransport?.iceCandidates ,
      });
     
      logger.info('Create viewer transport listner successfully executed')
    } catch (error) {
      logger.error('Viewer transport creation error',{
        message: (error as Error).message, 
        stack: (error as Error).stack
      })
    }
  });


  // Connects the viewer's transport by setting DTLS parameters for secure media flow
  socket.on("connectConsumerTransport", async (payload) => {
    try {
      logger.info('Connect consumer listner started')

      const roomId = socket.data.roomId;
  
      const { dtlsParameters } = payload; 

      await connectConsumerTransport(roomId, socket.id, dtlsParameters);

      socket.emit('consumerTransportConnected')

      logger.info('Connect consumer listner executed successfully')
    } catch (error) {
      logger.error('Connect conusmer transport error',{
        message: (error as Error).message, 
        stack : (error as Error).stack
      })
    }
  });


  // Handles a viewer requesting to consume a specific stream.
  socket.on("consume", async ({ roomId, rtpCapabilities }) => {
    try {
      logger.info('Consume lister started')

      const consumers = await consume(roomId, socket.id, rtpCapabilities);
      const room = getRoom(roomId)

      console.log('Consumers' , consumers)
      console.log('Room' ,room?.viewers)
      
      socket.emit("consumerCreated", consumers);
      
      logger.info('Consume lister executed successfully')
    } catch (error) {
     logger.error("Consume listner error",{
      message: (error as Error).message, 
      stack : (error as Error).stack
     })
    }
  });
  // Pauses a specific media consumer (e.g., video or audio) for the viewer
  socket.on("pauseConsumer", async (roomId, socketId, consumerId) => {
    pauseConsumer(roomId, socketId, consumerId);
    socket.emit("paused", { message: "Consumer paused for the viewer" });
  });

  // Resumes a previously paused media consumer for the viewer
  socket.on("resumeConsumer", async ({ roomId }) => {
      try {
        logger.info('Resume consumer listener started');

        const socketId = socket.id;
        const room = getRoom(roomId);
        
        if (!room) {
          logger.error('Room not found');
          return socket.emit('error', { message: 'Room not found' });
        }

        const viewer = room.viewers.get(socketId);
        if (!viewer) {
          logger.error('Viewer not found');
          return socket.emit('error', { message: 'Viewer not found' });
        }

        const resumedConsumers: string[] = [];
        
        for (const [consumerId, consumer] of viewer.consumers.entries()) {
          try {
            if (consumer.paused) {
              await consumer.resume();
              resumedConsumers.push(consumerId);
              logger.info(`Consumer ${consumerId} resumed`);
            }
          } catch (err) {
            logger.error(`Failed to resume consumer ${consumerId}:`, err);
          }
        }

        socket.emit("resumed", {
          message: "Consumers resumed",
          resumedConsumers
        });

        logger.info(`Resume consumer listener executed successfully. Resumed: ${resumedConsumers.length}`);
      } catch (error) {
        logger.error('Resume consumer error', {
          message: (error as Error).message, 
          stack: (error as Error).stack
        });
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
