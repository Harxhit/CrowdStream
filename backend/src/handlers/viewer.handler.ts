import { getRoom, memoryRoom } from "../rooms/room.store";
import ApiError from "../utils/apiError";
import logger from "../utils/logging";
import {
  createWebRtcTransport,
} from "../mediasoup/transport";
import { initWorker } from "../mediasoup/worker";
import canConsume from "../utils/canConsumer.util";



//Join room as viewer and gets router capabilities
const joinAsViewer = async (roomId: string, socketId: string) => {
  try {
    logger.info("Join as viewer started")

    const room = getRoom(roomId);
    
    if (!room) {
      logger.error(`Room does not exist with ${roomId}`);
      return
    }
    
    room.viewers.set(socketId , {
      transport : new Map(), 
      consumers: new Map(),
      joinedAt : Date.now(), 
      role : 'viewer'
    })
  
    logger.info('Join as viewer completed successfully')
    
  } catch (error) {
    logger.error('Internal server error',{
      message : (error as Error).message, 
      stack: (error as Error).stack
    } )
  }
};

//Creates a webRtcTransport for the viwer , which will be used to receive audio/video from the broadcaster(to become a consumer)
const createConsumerTransport = async (roomId: string, socketId: string ) => {
  const startTime  = Date.now()
  try {
    logger.info('Create viewer transport started')
    const room = getRoom(roomId);
    
    const viewer = room?.viewers.get(socketId)

    if(!viewer){
      logger.error('Viewer not found not in the room')
      return; 
    }
    

    const router = room?.router; 
    if(!router){
      logger.error('Router not found for the room')
      return
    }

    const worker = room.worker
    if(!worker){
      logger.info('Room worker not found')
      return;
    }

    //Creates transport for the viewer 
    const transport = await createWebRtcTransport(router)
  
    viewer.transport?.set('consumer',transport!)

    logger.info('Create viewer transport successfully executed',Date.now() - startTime)

    return {
      id: transport?.id,
      iceParameters: transport?.iceParameters,
      iceCandidates: transport?.iceCandidates,
      dtlsParameters: transport?.dtlsParameters,
    };
  } catch (error) {
    logger.error('Internal server error',{
      message:  (error as Error).message, 
      stack: (error as Error).stack
    })
  }
};

//This completes the (DTLS Handshake) between the user and the browser .
const connectConsumerTransport = async (
  roomId: string,
  socketId: string,
  dtlsParameters: any
) => {
  const startTime = Date.now()
  try {
    logger.info('Connect consumer started')
    const room = getRoom(roomId);
  
    const viewer = room?.viewers.get(socketId)
    if(!viewer){
      logger.error('Viewer not found in the room')
      return
    }
    const transport = viewer.transport?.get('consumer')
    if(!transport){
      logger.error('Viewer consumer transport not found',Date.now() - startTime)
      return;
    }
    
    logger.info('Connect consumer executed successfully')

    return await transport.connect({ dtlsParameters });
  
  } catch (error) {
   logger.error('Internal server error',{
    message : (error as Error).message, 
    stack: (error as Error).stack
   }) 
  }
};

//It lets the viewer starts receiving(consuming) media(audio/video) from a producer(broadcaster).
const consume = async (
  roomId: string,
  socketId: string,
  rtpCapabilities: any
) => {
  const startTime = Date.now()
  try {
    
    logger.info('Consume media started')
    const room = getRoom(roomId);
  
    if (!room) {
      throw new ApiError(404, "Room does not exist");
    }
  
    const viewer = room.viewers.get(socketId)
    if (!viewer) {
      logger.error("Viewer not found in the room")
    }
  
    const transport = viewer?.transport?.get('consumer');
    if (!transport) {
      logger.error('Viewer transport not found')
      return;
    }
  
    const consumerParams:any[] = []

    for(const broadcaster of room.broadcasters.values()){
      for(const producer of broadcaster.producers.values()){

        if(!canConsume(roomId,producer.id , rtpCapabilities)){
          logger.warn('Cannot consume this media')
          continue; 
        }

        const consumer = await transport?.consume({
          producerId : producer.id, 
          rtpCapabilities : rtpCapabilities, 
          paused : true
        })
        
        viewer?.consumers.set(producer.id , consumer)

        consumerParams.push({
          id: consumer.id,
          producerId: producer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });

      }
    }
    logger.info('Viewer media consume successfully executed',Date.now() - startTime)
    return consumerParams

  } catch (error) {
    logger.error('Internal server error',{
      message : (error as Error).message, 
      stack: (error as Error).stack
    })
  }

  
};


export {
  joinAsViewer,
  createConsumerTransport,
  connectConsumerTransport,
  consume,
};
