import logger from "../utils/logging";
import canConsume from "../utils/canConsumer.util";
import type {
  RtpCapabilities,
  Consumer,
} from "mediasoup/node/lib/types";
import { getErrorDetails } from "../utils/error.util";
import { getRoom } from "../rooms/room.store";

// Pause viewer consumer
const pauseConsumer = async (
  roomId: string,
  socketId: string,
  consumerId: string
): Promise<void> => {
  const startTime = Date.now();

  try {
    const room = getRoom(roomId)
    const viewer = room?.viewers.get(socketId);
    if (!viewer) {
      logger.error("Viewer not found",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Viewer not found");
    }

    const consumer: Consumer | undefined = viewer.consumers.get(consumerId);

    if (consumer === undefined) {
      logger.error("Consumer not found",{
        consumerId: consumerId, 
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Consumer not found");
    }

    logger.info("Viewer consumer paused",{
      consumerId: consumerId, 
      roomId: roomId, 
      socketId: socketId, 
      durationMs: Date.now() - startTime
    });

    return await consumer.pause();

  } catch (error: unknown) {
    logger.error(
      "Internal server error",
      getErrorDetails(error)
    );

    throw error
  }
};

// Resume viewer consumer
const resumeConsumer = async(
  roomId: string,
  socketId: string,
  consumerId: string
): Promise<void> => {
  const startTime = Date.now()
  try {
    const room = getRoom(roomId);
    const viewer = room?.viewers.get(socketId);
    if (!viewer) {
      logger.error("Viewer not found",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Viewer not found");
    }
    console.log('ConsumerId frontend',consumerId)
    console.log("Viewer details",viewer)
    const consumer: Consumer | undefined = viewer.consumers.get(consumerId)
    if (consumer === undefined) {
      logger.error("Consumer not found",{
        consumerId: consumerId, 
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Consumer not found");
    }
    logger.info("Viewer consumer resumed",{
      consumerId: consumerId, 
      roomId: roomId, 
      socketId: socketId, 
      durationMs: Date.now() - startTime
    });

    return await consumer.resume()

  } catch (error: unknown) {
    logger.error(
      "Internal server error",
      getErrorDetails(error)
    );

    throw error
  }
};

// Close viewer consumer
const closeConsumer = (
  roomId: string,
  socketId: string,
  consumerId: string
): void => {
  const startTime = Date.now();
  try {
    const room = getRoom(roomId)
    const viewer = room?.viewers.get(socketId);
    if (!viewer) {
      logger.error("Viewer not found",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Viewer not found");
    }
    const consumer: Consumer | undefined = viewer.consumers.get(consumerId);
    if (consumer === undefined) {
      logger.error("Consumer not found",{
        consumerId: consumerId, 
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Consumer not found");
    }

    consumer.close();
    viewer.consumers.delete(consumerId);

    logger.info("Viewer consumer closed and deleted",{
      consumerId: consumerId, 
      roomId: roomId, 
      socketId: socketId, 
      durationMs: Date.now() - startTime
    });
  } catch (error: unknown) {
    logger.error(
      "Internal server error",
      getErrorDetails(error)
    );

    throw error
  }
};

// Multi-stream consumer manager
const manageMultiStreamConsumers = (
  roomId: string,
  socketId: string,
  producerId: string,
  rtpCapabilities: RtpCapabilities
): void => {
  const startTime = Date.now()
  try {
    const room = getRoom(roomId)
    const viewer = room?.viewers.get(socketId);
    if (!viewer) {
      logger.error("Viewer not found",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Viewer not found");
    }

    //TODO: Need to add a fallback
    const viewerConsumers = viewer.consumers;
    if (viewerConsumers.size === 0) {
      logger.warn(
        "Viewer consumers do not exist,Creating"
      );
    }

    const canConsumeResult = canConsume(
      roomId,
      producerId,
      rtpCapabilities
    );

    if (canConsumeResult !== true) {
      logger.error("Router capabilities do not allow consuming this stream",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error('Router capabilities do not allow consuming this stream')
    }
  } catch (error: unknown) {
    logger.error(
      "Internal server error",
      getErrorDetails(error)
    );
    throw error
  }
};

export {
  pauseConsumer,
  closeConsumer,
  resumeConsumer,
  manageMultiStreamConsumers,
};