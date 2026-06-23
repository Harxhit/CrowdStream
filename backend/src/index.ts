import cors from "cors";
import {server} from './utils/socket.util'
import app from "./app";
import type { Request , Response } from "express";
import config from "./config";

app.use(cors());


app.get("/__ping", (_req :Request, res : Response) => {
  res.send("PING OK");
});

  
server.listen(config.port,config.publicIp, () => {
  console.log(`Server is listening on: ${config.port}`);
});

