import cors from "cors";
import {server} from './utils/socket.util'
import app from "./app";
import type { Request , Response } from "express";
import config from "./config";
import cookie from 'cookie-parser'; 
import axios from "axios";
import https from "node:https"
import { userRouter } from "./routes/user.route";
import {authRouter} from "./routes/auth.route"
import express from 'express'
import connectToDataBase from "./database";

app.use(cors());

app.use(cookie()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

axios.defaults.httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  keepAliveMsecs: 30000,
});

app.use('/api/v1', authRouter)
app.use('/api/v1/auth',userRouter);

app.get("/__ping", (_req :Request, res : Response) => {
  res.send("PING OK");
});

app.get("/health", (_req: Request, res: Response) => {
  res.send("HEALTH OK");
})

connectToDataBase()
  .then(() => {
    server.listen(config.port, config.publicIp, () => {
      console.info(`Server is running at http://localhost:${config.port}`);
    });
  })
  .catch((error) => {
    console.info('MongoDB connection error', error);
  });



