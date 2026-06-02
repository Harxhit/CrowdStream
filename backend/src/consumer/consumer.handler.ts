import logger from "../utils/logging";
import { memoryRoom } from "../rooms/room.store";
import canConsume from "../utils/canConsumer.util";
import type {
  RtpCapabilities,
  Consumer,
} from "mediasoup/node/lib/types";
import { getErrorDetails } from "../utils/error.util";

// Pause viewer consumer
const pauseConsumer = async (
  roomId: string,
  socketId: string,
  consumerId: string
): Promise<void> => {
  const startTime = Date.now();

  try {
    logger.info("Pause consumer started");

    const room = memoryRoom.get(roomId);

    if (!room) {
      logger.error("Room not found");
      return;
    }

    const viewer = room.viewers.get(socketId);

    if (!viewer) {
      logger.error("Viewer not found");
      return;
    }

    const consumer: Consumer | undefined =
      viewer.consumers.get(consumerId);

    if (consumer === undefined) {
      logger.error("Consumer not found");
      return;
    }

    await consumer.pause();

    logger.info(
      "Viewer specific consumer paused successfully",
      Date.now() - startTime
    );
  } catch (error: unknown) {
    logger.error(
      "Internal server error",
      getErrorDetails(error)
    );
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
    logger.info("Resume consumer started");

    const room = memoryRoom.get(roomId);

    if (!room) {
      logger.error("Room not found");
      return;
    }

    const viewer = room.viewers.get(socketId);

    if (!viewer) {
      logger.error("Viewer not found");
      return;
    }

    const consumer: Consumer | undefined = viewer.consumers.get(consumerId)
    if(consumer === undefined){
      logger.error("Consumer not found");
      return;
    }

    await consumer.resume()

    logger.info(
      "Viewer specific consumer resumed successfully",
      Date.now() - startTime
    );
  } catch (error: unknown) {
    logger.error(
      "Internal server error",
      getErrorDetails(error)
    );
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
    logger.info("Close consumer started");

    const room = memoryRoom.get(roomId);

    if (!room) {
      logger.error("Room not found");
      return;
    }

    const viewer = room.viewers.get(socketId);

    if (!viewer) {
      logger.error("Viewer not found in room");
      return;
    }

    const consumer: Consumer | undefined =
      viewer.consumers.get(consumerId);

    if (consumer === undefined) {
      logger.error("Consumer not found");
      return;
    }

    consumer.close();

    logger.info(
      "Close consumer successfully executed",
      Date.now() - startTime
    );
  } catch (error: unknown) {
    logger.error(
      "Internal server error",
      getErrorDetails(error)
    );
  }
};

// Multi-stream consumer manager
const manageMultiStreamConsumers = (
  roomId: string,
  socketId: string,
  producerId: string,
  rtpCapabilities: RtpCapabilities
): void => {
  try {
    const room = memoryRoom.get(roomId);

    if (!room) {
      logger.error("Room not found");
      return;
    }

    const viewer = room.viewers.get(socketId);

    if (!viewer) {
      logger.error("Viewer not found");
      return;
    }

    const viewerConsumers = viewer.consumers;

    if (viewerConsumers.size === 0) {
      logger.warn(
        "Viewer consumers do not exist, creating one"
      );
    }

    const canConsumeResult = canConsume(
      roomId,
      producerId,
      rtpCapabilities
    );

    if (canConsumeResult !== true) {
      logger.error(
        "Router capabilities do not allow consuming this stream"
      );
      return;
    }

    logger.info("Consumer can be created");
  } catch (error: unknown) {
    logger.error(
      "Internal server error",
      getErrorDetails(error)
    );
  }
};

export {
  pauseConsumer,
  closeConsumer,
  resumeConsumer,
  manageMultiStreamConsumers,
};