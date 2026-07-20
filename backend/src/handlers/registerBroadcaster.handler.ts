import logger from "../utils/logging";
import {
  createRoom,
  getRoom,
  createRoomId,
} from "../rooms/room.store";
import { addBroadcaster , saveBroadcasterTransport} from "../utils/broadcaster.util";
import type { Socket } from "socket.io";
import { createWebRtcTransport } from "../mediasoup/transport";
import apiError from '../utils/apiError'
import {roomToRouter } from "../stores/maps";
import { getRouter } from "../mediasoup/router";
import LiveRoom from "../models/liveRoom.models";
import config from "../config";
import Broadcaster from "../models/broadcaster.model";
import { ipHash, userAgentHash } from "../utils/hash.util";
import { getRedisRoom } from "../utils/roomCordinator";
import ApiError from "../utils/apiError";
import { subscribeToRoomChat } from "../utils/redis.util";


const registerBroadcasterHandler = async (socket: Socket) => {
  // Creates a memory room
  socket.on("createRoom", async (ack) => {
    const startTime = Date.now()
    try {
      const hostUserId = socket.data.user?.id;
      const roomId = await createRoomId();

      const _room = await createRoom(roomId, hostUserId)
      socket.join(`room:${roomId}`)
      socket.data.roomId = roomId;  //Stores roomId into socket data
      
      await subscribeToRoomChat(roomId)
      
      await addBroadcaster(roomId, socket.id);

      logger.info("Room created successfully",{
        event: 'ROOM_CREATED',
        roomId: roomId, 
        broadcasterSocketId: socket.id, 
        durationMs: Date.now() - startTime
      })

      ack({
        success: true, 
        data: {
          roomId
        }
      })

    void LiveRoom.create({
      experienceRoomId: roomId,
      hostUserId: hostUserId,
      status: "live",
      startedAt: new Date(),
      sfuNodeId: config.instanceId,
    }).catch((error) => {
      logger.error("Failed to persist live room", error);
    });

    const hashedIp = ipHash(socket); 
    const userAgentHashed = userAgentHash(socket)

    void Broadcaster.create({
      roomId: roomId, 
      socketId: socket.id, 
      broadcasterId: hostUserId, 
      ipHash: hashedIp, 
      userAgentHash: userAgentHashed
    }).catch((error) => {
      logger.error("Failed to persist broadcaster", error);
    });


    } catch (error:any) {
      logger.error('Live room creation error', {
        message: (error as Error).message,
        stack : (error as Error).stack
      })

      ack({
        success: false, 
        code: 'ROOM_CREATION_FAILED'
      })
    }
  });

  //Sends router capabilites
  socket.on("getRouterRtpCapabilities", async(roomId, ack) => {
    const startTime = Date.now(); 
    try {
      logger.info("Get getRouterRtpCapabilities started")

      if (!roomId) {
        logger.error('RoomID not found')
        throw new apiError(404,'RoomId not found')
      }
      const roomKey = `room:${roomId}`; 

      const redisRoom = await getRedisRoom(roomKey)
      //TODO: Implementation for different pod connections
      if(redisRoom.nodeId !== config.instanceId){
        logger.error('Different pod')
        throw new ApiError(409,"Room belongs to another node")
      }

      const routerId = roomToRouter.get(roomId); 
      const router = getRouter(routerId!)

      if (!router) {
        logger.error('Error in room router')
        ack({
          success:false, 
          code: 'ROUTER_NOT_FOUND'
        })
        throw new apiError(404,'Room router not found')

      } 

      const rtpCapabilites = router?.rtpCapabilities; 

      logger.info('Rtp capabilities fetched successfully',{
        roomId: roomId, 
        routerId: router.id, 
        rtpCapabilites: rtpCapabilites, 
        durationMs: Date.now() - startTime
      })

      ack({
        success: true, 
        data: {
          rtpCapabilites
        }
      })

    } catch (error) {
      logger.error('Getting rtp capabilites error', {
        message : (error as Error).message, 
        stack: (error as Error).stack
      });

      ack({
        success: false,
        code: 'RTP_CAPABILITES_ERROR'
      })
    }
  });

  //Creates transport for the broadcaster
  socket.on("createBroadcasterTransport", async (roomId, ack) => {
    try {
      const room = getRoom(roomId);
      const hostUserId = socket.data.user?.id; 
      const router = room.router;

      const roomKey = `room:${roomId}`; 
      const redisRoom = await getRedisRoom(roomKey)
      //TODO: Implementation for different pod connections
      if(redisRoom.nodeId !== config.instanceId){
        logger.error('Different pod')
        throw new ApiError(409,"Room belongs to another node")
      }
      

      const broadcasterTransport =
        await createWebRtcTransport(
          router,
          roomId,
          socket.id,
          "broadcaster"
        );

      await saveBroadcasterTransport(
        roomId,
        socket.id,
        broadcasterTransport
      );

      ack({
        success: true,
        data: {
          id: broadcasterTransport?.id,
          iceParameters: broadcasterTransport?.iceParameters,
          iceCandidates: broadcasterTransport?.iceCandidates,
          dtlsParameters: broadcasterTransport?.dtlsParameters,
        }
      });

    void Broadcaster.findOneAndUpdate(
      {
        broadcasterId: hostUserId,
        roomId,
      },
      {
        $push: {
          transportIds: broadcasterTransport?.id,
        },
      }
    ).catch((error) => {
      logger.error("Failed to update broadcaster transport", error);
    });

    } catch (error) {
      ack({
        success: false,
        code: "TRANSPORT_CREATION_FAILED"
      });
    }
  });

  //Creates the connect
  socket.on(
    "connectBroadcasterTransport",
    async (
      { transportId, dtlsParameters },
      ack
    ) => {
      try {
        logger.info(
          "Connect broadcaster transport listener started"
        );

        const roomId = socket.data.roomId;

        if (!roomId) {
          throw new apiError(
            404,
            "RoomId not found"
          );
        }

        const room = getRoom(roomId);

        const broadcaster =
          room.broadcasters.get(socket.id);

        if (!broadcaster) {
          throw new apiError(
            404,
            "Broadcaster not found"
          );
        }

        const roomKey = `room:${roomId}`; 
        const redisRoom = await getRedisRoom(roomKey)
        //TODO: Implementation for different pod connections
        if(redisRoom.nodeId !== config.instanceId){
          logger.error('Different pod')
          throw new ApiError(409,"Room belongs to another node")
        }
      
        const broadcasterTransport =
          broadcaster.transports.get(
            "producer"
          );

        if (!broadcasterTransport) {
          throw new apiError(
            404,
            `Transport ${transportId} not found`
          );
        }

        await broadcasterTransport.connect({
          dtlsParameters
        });

        ack({
          success: true
        });

        logger.info(
          "Connect broadcaster transport executed successfully"
        );

      } catch (error) {
        logger.error(
          "Connect broadcaster transport error",
          {
            message: (error as Error).message,
            stack: (error as Error).stack
          }
        );

        ack({
          success: false,
          code: "TRANSPORT_CONNECT_FAILED"
        });
      }
    }
  );
  // Handles broadcaster sending media by creating a producer on the transport and saving it
  socket.on(
    "produce",
    async (producerData, ack) => {
      try {
      logger.info('Producer listener started', JSON.stringify(producerData))

      const { _transportId, kind, rtpParameters, appData } = producerData;

      //RoomId in the socket data
      const roomId = socket.data.roomId;
      if (!roomId) {
        logger.error("Room Id not found")
        throw new apiError(404,'RoomId not found')
      }

      const roomKey = `room:${roomId}`; 
      const redisRoom = await getRedisRoom(roomKey)
      //TODO: Implementation for different pod connections
      if(redisRoom.nodeId !== config.instanceId){
        logger.error('Different pod')
        throw new ApiError(409,"Room belongs to another node")
      }
      

      
      const room = getRoom(roomId);
      const hostUserId = socket.data.user?.id; 
      const broadcaster = room?.broadcasters.get(socket.id);
  
      if (!broadcaster) {
        logger.error('Broadcaster not found')
        throw new apiError(404,'Broadcaster not found')
      }
      
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

      broadcaster.producers.set(producer.id, producer)

      void Broadcaster.findOneAndUpdate(
        {
          roomId,
          broadcasterId: hostUserId,
        },
        {
          $push: {
            producerIds: producer.id,
          },
        }
      ).catch((error) => {
        logger.error("Failed to update broadcaster producer", error);
      });
      
      logger.info("Producer listener executed successfully:",{
        producerId : producer.id, 
        producerKind: producer.kind
      });
      
      ack({
        success: true,
        data: {
          producerId: producer.id,
          producerKind: producer.kind
        }
      });
      
      
    } catch (error) {
      logger.error('Error creation in producer',{
        message : (error as Error).stack, 
        stack: (error as Error).stack
      })

      ack({
        success: false,
        code: "PRODUCER_CREATION_FAILED"
      });
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

  // socket.on("rejectCoHost", ({ roomId, viewerId }) => {
  //   logger.log("info", {
  //     message: `Request rejected for the viewerId: ${viewerId} for being co-host`,
  //   });
  //   socket.to(viewerId).emit("requestRejected", { roomId });
  // });
};

export default registerBroadcasterHandler;
