import * as mediasoup from "mediasoup";
import type { WorkerLogTag, WorkerSettings } from "mediasoup/node/lib/types";
import logger from "../utils/logging";
import apiError from '../utils/apiError'
import {config} from '../index'

const mediaSoupConfig: WorkerSettings = {
  logLevel: "warn",
  logTags: ["info", "ice", "dtls", "srtp", "rtcp"] as WorkerLogTag[],
  rtcMinPort: config.rtcMinPort,
  rtcMaxPort: config.rtcMaxPort,
};

//Creates a mediasoup worker(core process for media)
const initWorker = async () => {
  const startTime = Date.now()
 try {
  logger.info('Creating worker started')

  const worker = await mediasoup.createWorker(mediaSoupConfig)
  if(!worker){
    logger.error('Error in the creation of worker')
    return; 
  }
  logger.info('Worker created successfully', Date.now() - startTime)
  return worker; 

 } catch (error:any) {
  logger.error('Creating worker error', {
    message: (error as Error).message, 
    stack : (error as Error).stack
  })

  throw new apiError(
    500,
    'Worker creation failed'
  );
 }
};

export { initWorker };
