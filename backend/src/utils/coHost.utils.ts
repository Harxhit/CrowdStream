// import logger from "./logging";
// import { getRoom } from "../rooms/room.store";

// export const findHostSocketId = (roomId: string): string | null => {
//   console.log("Gomu Gomu no", roomId);
//   const room = getRoom(roomId);
//   if (!room) {
//     logger.error("error", {
//       message: `Room does not exist with roomId: ${roomId}`,
//     });
//     return null;
//   }

//   for (const [socketId, broadcaster] of Object.entries(room.broadcasters)) {
//     if (broadcaster.role === "host") {
//       return socketId;
//     }
//   }

//   logger.error("error", { message: "No host found" });
//   return null;
// };

// export const acceptRequest = async (roomId: string, viewerId: string) => {
//   console.log("viewerId", viewerId);
//   console.log("roomId", roomId);
//   const room = getRoom(roomId);
//   if (!room) {
//     return logger.error("error", {
//       message: `Room does not exist with roomId: ${roomId}`,
//     });
//   }
//   for (const [socketId, viewer] of Object.entries(room.viewers)) {
//     if (viewerId === socketId) {
//       viewer.role = "co-host";
//       logger.log("info", {
//         message: `ViewerId: ${viewerId} role updated to co-host`,
//       });
//       return viewer;
//     }
//   }
//   logger.log("error", { message: "Viewer not found in the room" });
// };
