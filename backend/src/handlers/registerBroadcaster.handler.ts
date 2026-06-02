import logger from "../utils/logging";
import {
  createRoom,
  getRoom,
  createRoomId,
} from "../rooms/room.store";
import { addBroadcaster , saveBroadcasterTransport} from "../utils/broadcaster.util";
import type { Socket } from "socket.io";
import {  createWebRtcTransport } from "../mediasoup/transport";
import apiError from '../utils/apiError'


const registerBroadcasterHandler = async (socket: Socket) => {
  // Creates a new room
  socket.on("createRoom", async () => {
    try {
      logger.info('Create room listner started')

      //Creates the roomId
      const roomId = await createRoomId();

      //Creates the room
      const _room = await createRoom(roomId)

      //Saving roomId into socket data
      socket.data.roomId = roomId;

      //Adding broadcaster to the room
      await addBroadcaster(roomId, socket.id);

      logger.info('Broadcaster created successfully')

      //Emiting event
      socket.emit("roomCreated", { roomId });

      logger.info('Create room listner exceuted successfully')
    } catch (error:any) {
      logger.error('Live room creation error', {
        message: (error as Error).message,
        stack : (error as Error).stack
      })
    }
  });

  //Sends router capabilites
  socket.on("getRouterRtpCapabilities", ({ roomId }) => {
    try {
      logger.info("Get getRouterRtpCapabilities started",roomId)

      if (!roomId) {
        logger.error('RoomID not found:',roomId)
        throw new apiError(404,'RoomId not found')
      }
      
      //Gets the room
      const room = getRoom(roomId);

      //Gets the router
      const router = room?.router;

      if (!router) {
        logger.error('Error in room router')
        throw new apiError(404,'Room router not found')
      }
      //Emiting event
      socket.emit("routerRtpCapabilities", {
        routerRtpCapabilities: router.rtpCapabilities,
      });

      logger.info('Get getRouterRtpCapabilities socket lister executed successfully')
    } catch (error) {
      logger.error('Getting rtp capabilites error', {
        message : (error as Error).message, 
        stack: (error as Error).stack
      });
    }
  });

  //Creates transport for the broadcaster
  socket.on("createBroadcasterTransport", async ({ roomId }) => {
    try {
      logger.info('Create broadcaster transport started')

      //Fetches the room
      const room = getRoom(roomId);

      //Fetches the router
      const router = room?.router;
      if (!router) {
        logger.error("Error getting router")
        throw new apiError(404,'Router not found')
      }

      // Creates broadcaster transport
      const broadcasterTransport =  await createWebRtcTransport(router);

      await saveBroadcasterTransport(roomId, socket.id , broadcasterTransport)

      //Emits the broadcaster transport
      socket.emit("broadcasterTransportCreated", {
        id: broadcasterTransport?.id,
        iceParameters: broadcasterTransport?.iceParameters,
        iceCandidates: broadcasterTransport?.iceCandidates, 
        dtlsParameters: broadcasterTransport?.dtlsParameters,
        routerRtpCapabilities: router.rtpCapabilities,
      });
    } catch (error) {
      logger.error('Create broadcaster transport error',{
        message : (error as Error).message, 
        stack : (error as Error).stack
      })
    }
  });

  //Creates the connect
  socket.on(
    "connectBroadcasterTransport",
    async ({ transportId, dtlsParameters }) => {
      try {
        logger.info('Connect broadcaster transport lister started')

        const roomId = socket.data.roomId;
        if (!roomId) {
          logger.error('RoomId not found')
          throw new apiError(404,'RoomId not found')
        }
        const room = getRoom(roomId);
        const broadcaster = room?.broadcasters.get(socket.id)

        if (!broadcaster) {
          logger.error('Broadcaster does not exist')
          throw new apiError(404, 'Broadcaster not found')
        }
        //Get broadacaster producer transport
        const broadcasterTransport = broadcaster.transports.get('producer')

        if(!broadcasterTransport){
          logger.error(`Error finding transport with ${transportId}`)
          throw new apiError(404, `Error finding transport with ${transportId}`) 
        }

        await broadcasterTransport.connect({dtlsParameters});
        socket.emit('broadcasterTransportConnected')

        logger.info('Connect broadcaster transport executed successfully')

      } catch (error) {
        logger.error('Connect broadcaster transport error',{
          message : (error as Error).message, 
          stack : (error as Error).stack
        });
      }
    }
  );

  // Handles broadcaster sending media by creating a producer on the transport and saving it
  socket.on("produce", async (producerData) => {
    try {
      logger.info('Producer listener started', JSON.stringify(producerData))

      //Producer data
      const { _transportId, kind, rtpParameters, appData } = producerData;

      //RoomId in the socket data
      const roomId = socket.data.roomId;
      if (!roomId) {
        logger.error("Room Id not found")
        throw new apiError(404,'RoomId not found')
      }
  
      const room = getRoom(roomId);
  
      const broadcaster = room?.broadcasters.get(socket.id);
  
      if (!broadcaster) {
        logger.error('Broadcaster not found')
        throw new apiError(404,'Broadcaster not found')
      }
      
      //Finds broadcaster transport
      const broadcasterTransport = broadcaster.transports.get('producer')
      if (!broadcasterTransport) {
        logger.error('Broadcaster producer transport not found')
        throw new apiError(404,'Broadcaster producer transport not found'); 
      }

      //Create producer
      const producer = await broadcasterTransport.produce({
        kind, 
        rtpParameters, 
        appData : appData || {}
      })
  
      if (!broadcaster.producers) {
        logger.error('Error creating broadcaster producer')
        throw new apiError(404,'Error creating broadcaster producer');  
      }

      //Setting the producer
      broadcaster.producers.set(producer.id, producer)
      
      //Emit
      socket.emit(`produced:${kind}`, { id: producer.id });
      
      logger.info("Producer listener executed successfully:",{
        producerId : producer.id, 
        producerKind: producer.kind
      });
      
    } catch (error) {
      logger.error('Error creation in producer',{
        message : (error as Error).stack, 
        stack: (error as Error).stack
      })
    }
  });

  // socket.on("requestCoHost", ({ roomId, viewerId }) => {
  //   const hostSocketId = findHostSocketId(roomId);
  //   socket.to(hostSocketId as any).emit("coHostRequest", { roomId, viewerId });
  // });

  // socket.on("approveCoHost", ({ roomId, viewerId }) => {
  //   acceptRequest(roomId, viewerId);
  //   socket.to(viewerId).emit("youAreCoHost", { roomId });
  // });

  socket.on("rejectCoHost", ({ roomId, viewerId }) => {
    logger.log("info", {
      message: `Request rejected for the viewerId: ${viewerId} for being co-host`,
    });
    socket.to(viewerId).emit("requestRejected", { roomId });
  });
};

export default registerBroadcasterHandler;
