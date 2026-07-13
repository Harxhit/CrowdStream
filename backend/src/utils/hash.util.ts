import crypto from "node:crypto";
import { Socket } from "socket.io";

export const ipHash = (socket:Socket) => {
   return  crypto
  .createHash("sha256")
  .update(socket.handshake.address)
  .digest("hex");
}
export const userAgentHash = (socket: Socket)  => {
   return crypto
  .createHash("sha256")
  .update(socket.handshake.headers["user-agent"] ?? "")
  .digest("hex");
}