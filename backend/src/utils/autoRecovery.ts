// import logger from "./logging";
// import { getRoom } from "../rooms/room.store";

// const autoRecovery = async (
//   roomId: string,
//   socketId: string,
//   transportId: string,
//   type: "consumer" | "producer"
// ) => {
//   const room = getRoom(roomId);
//   if (!room) {
//     return logger.log("error", {
//       message: `Room does not exist with roomId : ${roomId}`,
//     });
//   }

//   let oldTransport;

//   if (type === "consumer") {
//     oldTransport = room.viewers[socketId]?.transport[transportId];
//     oldTransport.close();

//     delete room.viewers[socketId]?.transport[transportId];
//   } else if (type === "producer") {
//     const broadcaster = room.broadcasters;
//     oldTransport = broadcaster[socketId].transports.find(
//       (t) => t.transport.id === transportId
//     );
//     oldTransport.close();
//     room.broadcasters[socketId].transports = broadcaster[
//       socketId
//     ].transports.filter((t) => t.transport.id !== transportId);
//   }

//   try {
//     const newTransport = await room.router.createWebRtcTransport({
//       listenIps: [{ ip: "0.0.0.0" }],
//       enableUdp: true,
//       enableTcp: true,
//       preferUdp: true,
//     });

//     if (type === "consumer") {
//       room.viewers[socketId].transport[newTransport.id] = newTransport;
//     } else if (type === "producer") {
//       room.broadcasters[socketId].transports.push({
//         transport: newTransport,
//         type: "producer",
//       });
//     }
//   } catch (error) {
//     logger.error(error);
//   }

//   logger.log("newTransportCreated", {
//     message: `New transport created for the viewer : ${socketId}`,
//   });
// };

// export default autoRecovery;
