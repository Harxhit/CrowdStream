import ApiError from "../utils/apiError";
import { rooms } from "../rooms/room.store";
import { Socket } from "socket.io";
import logger from "../utils/logging";

const handleDisconnect = async (socket: Socket) => {
  try {
    const socketId = socket.id;
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (socketId in room.viewers) {
      await cleanupViewer(roomId, socketId);
      logger.log("info", { message: "All clean up for the viewer are done" });
    } else if (socketId in room.broadcasters) {
      await cleanUpBroadcaster(roomId, socketId);
      logger.log("info", {
        message: "All clean up for the broadcaster are done",
      });
    }
  } catch (error) {
    console.log("Error during cleanup", error);
  }
};

// Clean up broadcaster resources
const cleanUpBroadcaster = async (roomId: string, socketId: string) => {
  const room = rooms.get(roomId);
  if (!room) throw new ApiError(404, `Room not found: ${roomId}`);

  const broadcaster = room.broadcasters[socketId];
  if (!broadcaster)
    throw new ApiError(404, `Broadcaster not found: ${socketId}`);

  // Closes all transports
  for (const t of broadcaster.transports) {
    if (t?.broadcasterTransport?.close) {
      t.broadcasterTransport.close();
    }
  }

  // Closes all producers
  for (const producer of broadcaster.producers) {
    if (producer?.close) {
      producer.close();
    }
  }

  delete room.broadcasters[socketId];
  logger.log("info", {
    message: `Broadcaster with socketId: ${socketId} has left the live stream`,
  });
};

// Clean up viewer resources
const cleanupViewer = async (roomId: string, socketId: string) => {
  const room = rooms.get(roomId);
  if (!room) throw new ApiError(404, `Room not found: ${roomId}`);

  const viewer = room.viewers[socketId];
  if (!viewer) throw new ApiError(404, `Viewer not found: ${socketId}`);

  // Closes transport if exists
  if (viewer.transport?.close) {
    viewer.transport.close();
  }

  // Closes all consumers
  if (viewer.consumers) {
    for (const consumer of Object.values(viewer.consumers)) {
      if (consumer?.close) consumer.close();
    }
  }

  delete room.viewers[socketId];
  logger.log("info", {
    message: `Viewer with socketId: ${socketId} has left the live stream`,
  });
};

export { handleDisconnect, cleanUpBroadcaster, cleanupViewer };
