import cors from "cors";
import {server} from './utils/socket.util'
import app from "./app";
import { Request , Response } from "express";

app.use(cors());

app.get("/__ping", (_req :Request, res : Response) => {
  res.send("PING OK");
});

  
server.listen(3000,'0.0.0.0', () => {
    console.log("Server listening on 3000");
});
