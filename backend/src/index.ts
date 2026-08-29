import cors from "cors";
import {server} from './utils/socket.util'
import app from "./app";
import type { Request , Response } from "express";
import config from "./config";
import cookie from 'cookie-parser'; 
import axios from "axios";
import https from "node:https"
import express from 'express'
import connectToDataBase from "./database";
import { workerPoolCreation } from "./utils/workerPool.util";
import {redis, subscribeToPodCommands, subscribeToPodResponses, podConnectionSubscriber} from "./utils/redis.util"
import './models'
import { verifyModelRegistration } from "./utils/modelsRegistration.util";
import { userRouter } from "./routes/user.route";
import { turnRouter } from "./routes/turn.route";
import {authRouter} from "./routes/auth.route"
import { dbRouter } from "./routes/db.routes";
import { recordingRouter } from "./routes/recording.routes";
app.use(cors());

app.use(cookie()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

redis.on("ready" ,async() => {
  try {
    await redis.ping()
    
    const masters = redis.nodes("master");
    const replicas = redis.nodes("slave");

    console.info(`Masters: ${masters.length}`);
    console.info(`Replicas: ${replicas.length}`);
    await subscribeToPodCommands(); 
    await subscribeToPodResponses(); 
  } catch (error) {
    console.error("Redis ready handler failed:", error);
  }
})

redis.on("close", async () => {
  try {
    await podConnectionSubscriber.sunsubscribe(`pod:${config.instanceId}:cmd`);
    await podConnectionSubscriber.sunsubscribe(`pod:${config.instanceId}:response`);
  } catch (error) {
    console.error("Failed to unsubscribe on redis close", error);
  }
});


axios.defaults.httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  keepAliveMsecs: 30000,
});

app.use((req, _res, next) => {
  console.log(req.method, req.originalUrl);
  next();
});

app.use('/api/v1', authRouter)
app.use('/api/v1/auth',userRouter);
app.use('/api/v1/turn',turnRouter);
app.use('/db', dbRouter)
app.use('/api/v1/recording', recordingRouter)

app.get("/__ping", (_req: Request, res : Response) => {
  res.send("PING OK");
});

app.get("/health", (_req: Request, res: Response) => {
  res.send("HEALTH OK");
})

connectToDataBase()
  .then(async() => {
    await workerPoolCreation()
    verifyModelRegistration()
    server.listen(config.port, config.publicIp, () => {
      console.info(`Server is running at http://localhost:${config.port}`);
    });
  })
  .catch((error) => {
    console.info('MongoDB connection error', error);
  });



