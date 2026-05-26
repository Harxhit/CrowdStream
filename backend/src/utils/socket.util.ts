import { Server } from "socket.io";
import { createServer } from "node:http";
import app from "../app";
import logger from "./logging";
import registerBroadcasterHandler from "../handlers/registerBroadcaster.handler";
import registerViewerHanlder from "../handlers/registerViewer.handler";


const server = createServer(app);
const io = new Server (server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});


io.on("connection", (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    registerBroadcasterHandler(socket);
    registerViewerHanlder(socket);

    socket.on("disconnect", async (reason) => {
        logger.info(`User disconnected ${socket.id} beacuse of ${reason}`)

    });
});
  

export {server , io}