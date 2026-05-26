import * as mediasoup from "mediasoup";
import type { WorkerLogTag, WorkerSettings } from "mediasoup/node/lib/types";
import logger from "../utils/logging";

const mediaSoupConfig: WorkerSettings = {
  logLevel: "warn",
  logTags: ["info", "ice", "dtls", "srtp", "rtcp"] as WorkerLogTag[],
  rtcMinPort: 40000,
  rtcMaxPort: 49999,
};

//Creates a mediasoup worker(core process for media)
const initWorker = async () => {
  const startTime = Date.now()
 try {
  logger.info('Creating worker started')

  const worker = await mediasoup.createWorker(mediaSoupConfig)
  if(!worker){
    logger.warn('Error in the creation of worker')
    return; 
  }
  logger.info('Creation of worker successfully executed', Date.now() - startTime)

  return worker; 

 } catch (error:any) {
  logger.error('Creating worker error', {
    message: (error as Error).message, 
    stack : (error as Error).stack
  })
 }
};
export { initWorker };
