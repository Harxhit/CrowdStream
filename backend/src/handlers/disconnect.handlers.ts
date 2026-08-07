import apiError from "../utils/apiError";
import { getRoom } from "../rooms/room.store";
import type { Socket } from "socket.io";
import logger from "../utils/logging";
import { getErrorDetails } from "../utils/error.util";
import { Presence, publishPresence, removeViewerFromRedisRoom, viewerCountInRedisRoom } from "../utils/roomCordinator";

// Clean up broadcaster
const cleanUpBroadcaster = (
  roomId: string,
  socketId: string
): void => {
  try {
    const room = getRoom(roomId);

    const broadcaster = room?.broadcasters.get(socketId);

    if (broadcaster === undefined) {
      logger.error("Broadcaster not found");
      throw new apiError(
        404,
        `Broadcaster not found: ${socketId}`
      );
    }

    broadcaster.transports.forEach((transport) => {
      transport.close();
    });

    broadcaster.producers.forEach((producer) => {
      producer.close();
    });

    room?.broadcasters.delete(socketId);

    logger.info("Cleanup", {
      message: "Broadcaster cleanup successful",
    });
  } catch (error: unknown) {
    logger.error(
      "Broadcaster cleanup failed",
      getErrorDetails(error)
    );
    throw new apiError(
      500,
      "Broadcaster cleanup failed"
    );
  }
};

// Clean up viewer
const cleanupViewer = async(
  roomId: string,
  socketId: string
) => {
  try {
    const room = getRoom(roomId);
    const viewer = room?.viewers.get(socketId);

    if (viewer === undefined) {
      logger.error("Viewer not found");
      throw new apiError(
        404,
        `Viewer not found: ${socketId}`
      );
    }

    viewer.transport?.forEach((transport) => {
      transport.close();
    });

    viewer.consumers.forEach((consumer) => {
      consumer.close();
    });

    await removeViewerFromRedisRoom(roomId, socketId)
    const count = await viewerCountInRedisRoom(roomId); 
    if(count === undefined){
      throw new Error('Viewer count not found')
    }
    const presence: Presence = {
      roomId: roomId, 
      count: count
    }
    publishPresence(presence)
    room?.viewers.delete(socketId);

    logger.info("Cleanup", {
      message: `Viewer ${socketId} cleanup successful`,
    });
  } catch (error: unknown) {
    logger.error(
      "Viewer cleanup failed",
      getErrorDetails(error)
    );
    throw new apiError(
      500,
      "Viewer cleanup failed"
    );
  }
};

// Handle disconnect
const handleDisconnect = async(
  socket: Socket
) => {
  try {
    const socketId = socket.id;

    const roomId =
      typeof socket.data.roomId === "string"
        ? socket.data.roomId
        : undefined;

    if (roomId === undefined || roomId === "") {
      logger.error("RoomId not found");
      return;
    }

    const room = getRoom(roomId);

    if (!room) {
      logger.error("Room not found");
      return;
    }

    if (room.viewers.has(socketId)) {
      await cleanupViewer(roomId, socketId);

      logger.info("Viewer", {
        message: "Viewer cleanup completed",
      });

      return;
    }

    if (room.broadcasters.has(socketId)) {
      cleanUpBroadcaster(roomId, socketId);

      logger.info("Broadcaster", {
        message:
          "Broadcaster cleanup completed",
      });
    }
  } catch (error: unknown) {
    logger.error(
      "Disconnect cleanup failed",
      getErrorDetails(error)
    );

    throw new apiError(
      500,
      "Cleanup failed"
    );
  }
};

export {
  handleDisconnect,
  cleanUpBroadcaster,
  cleanupViewer,
};