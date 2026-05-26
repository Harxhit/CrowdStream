// import logger from "./logging";
// import { getRoom } from "../rooms/room.store";

// export const adaptStreamQuality = async (
//   roomId: string,
//   socketId: string,
//   metrics: any
// ) => {
//   const room = getRoom(roomId);
//   if (!room) {
//     return logger.log("error", {
//       message: `Room does not exist with roomId : ${roomId}`,
//     });
//   }

//   const viewer = room.viewers[socketId];
//   if (!viewer) {
//     return logger.log("error", {
//       message: `Viewer does not exist with socketId : ${socketId}`,
//     });
//   }

//   const consumers = viewer.consumers || {};

//   // Defined thresholds
//   const BANDWIDTH_THRESHOLD = 800; // kbps
//   const PACKETLOSS_THRESHOLD = 5; // %
//   const JITTER_THRESHOLD = 30; // ms
//   const FPS_THRESHOLD = 20; // fps

//   for (const consumerId in consumers) {
//     const consumer = (consumers as any)[consumerId];

//     if (metrics.bandwidth < BANDWIDTH_THRESHOLD && consumer.kind === "video") {
//       if (!consumer.paused) {
//         consumer.pause();
//         logger.info("info", {
//           message: `Paused consumer ${consumerId} for socket ${socketId} due to low bandwidth`,
//         });
//       }
//     } else if (metrics.bandwidth >= BANDWIDTH_THRESHOLD && consumer.paused) {
//       consumer.resume();
//       logger.info("info", {
//         message: `Resumed consumer ${consumerId} for socket ${socketId} as bandwidth recovered`,
//       });
//     }

//     if (
//       metrics.packetLoss > PACKETLOSS_THRESHOLD &&
//       consumer.kind === "video"
//     ) {
//       if (!consumer.paused) {
//         consumer.pause();
//         logger.info("info", {
//           message: `Paused consumer ${consumerId} due to high packet loss`,
//         });
//       }
//     } else if (metrics.packetLoss <= PACKETLOSS_THRESHOLD && consumer.paused) {
//       consumer.resume();
//       logger.info("info", {
//         message: `Resumed consumer ${consumerId} as packet loss improved`,
//       });
//     }

//     if (metrics.jitter > JITTER_THRESHOLD && consumer.kind === "video") {
//       if (consumer.setPreferredLayers) {
//         consumer.setPreferredLayers({ spatialLayer: 0 });
//         logger.info("info", {
//           message: `Lowered consumer ${consumerId} quality due to high jitter`,
//         });
//       }
//     } else if (
//       metrics.jitter <= JITTER_THRESHOLD &&
//       consumer.kind === "video"
//     ) {
//       if (consumer.setPreferredLayers) {
//         consumer.setPreferredLayers({ spatialLayer: 2 });
//         logger.info("info", {
//           message: `Restored consumer ${consumerId} quality as jitter improved`,
//         });
//       }
//     }

//     if (
//       metrics.frameRate.decoded < FPS_THRESHOLD &&
//       consumer.kind === "video"
//     ) {
//       if (!consumer.paused) {
//         consumer.pause();
//         logger.info("info", {
//           message: `Paused consumer ${consumerId} due to low FPS`,
//         });
//       }
//     } else if (metrics.frameRate.decoded >= FPS_THRESHOLD && consumer.paused) {
//       consumer.resume();
//       logger.info("info", {
//         message: `Resumed consumer ${consumerId} as FPS recovered`,
//       });
//     }
//   }
// };
