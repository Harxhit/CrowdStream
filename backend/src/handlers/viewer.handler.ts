import { getRoom } from "../rooms/room.store";
import logger from "../utils/logging";
import {
  createWebRtcTransport,
} from "../mediasoup/transport";
import canConsume from "../utils/canConsumer.util";

//Join room as viewer
const joinAsViewer = async (roomId: string, socketId: string) => {
  const startTime = Date.now()
  try {
    const room = getRoom(roomId);
    room.viewers.set(socketId , {
      socketId: socketId,
      transport : new Map(), 
      consumers: new Map(),
      joinedAt : Date.now(), 
      role : 'viewer'
    })
  
    logger.info('Viewer joined the room',{
      socketId: socketId, 
      roomId: roomId, 
      durationMs: Date.now() - startTime
    })
  }catch(error){
    logger.error('Internal server error',{
      message : (error as Error).message, 
      stack: (error as Error).stack
    })
    throw error
  }
};

//Creates a webRtcTransport for the viwer,which will be used to receive audio/video from the broadcaster(to become a consumer)
const createConsumerTransport = async (roomId: string, socketId: string ) => {
  const startTime  = Date.now()
  try {
    const room = getRoom(roomId);
    
    const viewer = room.viewers.get(socketId)

    if (!viewer) {
      logger.error("Viewer not found",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Viewer not found");
    }
    
    const router = room.router; 
    if(!router){
      logger.error('Router not found for the room',{
        roomId: roomId, 
        routerId: room.router.id, 
        socketId: socketId, 
        durationMs: Date.now() - startTime
      })
     throw new Error('Router not found')
    }

    const worker = room.worker
    if(!worker){
      logger.info('Worker not found', {
        roomId: roomId, 
        routerId: room.router.id, 
        socketId: socketId, 
        workerPid: room.worker.pid,
        durationMs: Date.now() - startTime
      })
      throw new Error('Worker not found')
    }

    //Creates transport for the viewer 
    const transport = await createWebRtcTransport(router, roomId, socketId, 'viewer')
  
    viewer.transport?.set('consumer',transport!)

    logger.info('Viewer transport successfully created',{
        id: transport?.id, 
        iceParameter: transport?.iceParameters, 
        iceCandidates: transport?.iceCandidates, 
        sctpParameters: transport?.sctpParameters,
        dtlsParamaters: transport?.dtlsParameters, 
        roomId: roomId, 
        routerId: router.id, 
        durationMs: Date.now() - startTime
    })

    return {
      id: transport?.id,
      iceParameters: transport?.iceParameters,
      iceCandidates: transport?.iceCandidates,
      dtlsParameters: transport?.dtlsParameters,
      sctpParameters: transport?.sctpParameters
    };
  } catch (error) {
    logger.error('Internal server error',{
      message:  (error as Error).message, 
      stack: (error as Error).stack
    })
    throw error
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
    const room = getRoom(roomId);
  
    const viewer = room?.viewers.get(socketId)
    if (!viewer) {
      logger.error("Viewer not found",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Viewer not found");
    }
    const transport = viewer.transport?.get('consumer')
    if(!transport){
      logger.error('Viewer consumer transport not found',{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      })
      throw new Error('Viewer consumer transport not found')
    }
    
    logger.info('Consumer transport connected successfully',{
        durationMs: Date.now() - startTime, 
        roomId: roomId
    })

    return await transport.connect({ dtlsParameters });
  
  } catch (error) {
   logger.error('Internal server error',{
    message : (error as Error).message, 
    stack: (error as Error).stack
   }) 
   throw error
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
    const room = getRoom(roomId);
  
    const viewer = room.viewers.get(socketId)
    if (!viewer) {
      logger.error("Viewer not found",{
        roomId: roomId, 
        socketId: socketId,
        durationMs: Date.now() - startTime
      });
      throw new Error("Viewer not found");
    }
    const transport = viewer.transport?.get('consumer');
    if (!transport) {
      logger.error('Viewer transport not found',{
        roomId: roomId, 
        socketId: socketId, 
        durationMs: Date.now() - startTime
      })
      throw new Error('Viewer transport not found')
    }
  
    const consumerParams:any[] = []

    for(const broadcaster of room.broadcasters.values()){
      for(const producer of broadcaster.producers.values()){

        if(!canConsume(roomId, producer.id , rtpCapabilities)){
          logger.warn('Cannot consume this media')
          continue; 
        }

        const consumer = await transport?.consume({
          producerId : producer.id, 
          rtpCapabilities, 
          paused : true
        })
        
        viewer?.consumers.set(consumer.id , consumer)  
        
        consumerParams.push({
          id: consumer.id,
          producerId: producer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
      }
    }

    logger.info('Viewer media consume successfully executed',{
      durationMs: Date.now() - startTime, 
      roomId: roomId
    })
    return consumerParams
  } catch (error) {
    logger.error('Internal server error',{
      message : (error as Error).message, 
      stack: (error as Error).stack
    })
    throw error
  }
};

const removeViewerTransport = async(roomId:string, socketId:string) => {
  const room = getRoom(roomId); 
  
  const viewer = room.viewers.get(socketId); 
  if(!viewer){
    logger.warn('Viewer not found'); 
    throw new Error('Viewer not found')
  }

  viewer.transport?.forEach((t) => t.close())
  viewer.transport?.clear()
}

const removeViewerConsumer = async(roomId:string, socketId:string) => {
  const room = getRoom(roomId); 
  
  const viewer = room.viewers.get(socketId); 
  if(!viewer){
    logger.warn('Viewer not found'); 
    throw new Error('Viewer not found')
  }
  viewer.consumers?.forEach((c) => c.close())
  viewer.consumers?.clear()
}

export {
  joinAsViewer,
  createConsumerTransport,
  connectConsumerTransport,
  consume,
  removeViewerConsumer, 
  removeViewerTransport
};
