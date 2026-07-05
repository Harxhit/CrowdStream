import { randomUUID } from "crypto";
import logger from "../utils/logging";
import apiError from '../utils/apiError'
import { createRouter } from "../mediasoup/router";
import { memoryRoom, workerPool } from "../stores/maps";
import { assignWorker } from "../utils/workerPool.util";

//Creates roomId(temporary)
const createRoomId = async () => {
  const roomId = randomUUID();
  return roomId;
};

//Creates a room with a mediasoup router. 
const createRoom = async (roomId : string) => {
  const startTime = Date.now()
  try {
    logger.info('Create room started')

    const {selectedWorkerId , selectedWorker} = assignWorker()

    if(!selectedWorker){
      logger.error('Error creating worker')
      throw new apiError(404,'Worker not created'); 
    }

    //Creates router
    const router = await createRouter(roomId, selectedWorker, selectedWorkerId);

    //Memory room
    memoryRoom.set(roomId,{
      router,
      broadcasters: new Map(),
      viewers: new Map(),
      worker: selectedWorker, 
      health: 'healthy'
    });

    const newRoom = memoryRoom.get(roomId)

    const workerInfo = workerPool.get(selectedWorkerId); 
    workerInfo?.associatedRooms.add(roomId)

    logger.info("Creation of room successfully executed",{
      roomId, 
      durationMs: Date.now() - startTime,
      workerId: selectedWorkerId, 
      workerPid: workerInfo?.pid,
      routerId: router.id, 
    })
    return newRoom;

  } catch (error:any) {
    logger.error('Internal server error', {
      message: (error as Error).message, 
      stack: (error as Error).stack
    })

    throw new error

  }
};

//Fetches room with roomId
const getRoom = (roomId: string) => {
  const startTime = Date.now()
  try { 
    logger.info('Get room started')

    const room = memoryRoom.get(roomId);

    if (!room) {
      logger.error('Room not found')
      throw new apiError(404, 'Room not found')
    }

    logger.info('Get room executed successfully', Date.now() - startTime)
    return room;
    
  } catch (error:any) {
    logger.error('Internal server error', {
      message : (error as Error).message, 
      stack : (error as Error).stack
    })

    throw new apiError(500,'Room not found')
  }
};


const deleteRoom = (roomId: string) => {
  const startTime = Date.now()
  try {

    const _room = getRoom(roomId); 
    memoryRoom.delete(roomId)

    logger.log('Room delete successfully',{
      roomId,
      durationMs: Date.now() - startTime
    })
    
  } catch (error) {
    logger.error('Delete room error',{
      message: (error as Error).message, 
      stack: (error as Error).stack
    })
  }
}

//Saves broadcaster video/streams
const saveProducer = async (
  roomId: string,
  socketId: string,
  producer: any
) => {
  const startTime = Date.now()
  try {
    logger.info('Save producer started')

    const room = memoryRoom.get(roomId)

    if(!room){
      logger.error("Room not found")
      throw new Error
    }

    const broadcaster = room.broadcasters.get(socketId)

    if(!broadcaster){
      logger.error('Broadcaster not found')
      throw new Error
    }
    
    broadcaster.producers.set(producer.id,producer)

    logger.info('Broadcaster producer excuted successfully', Date.now() - startTime)
    return;

  } catch (error:any) {
    logger.error('Internal server error',{
      message : (error as Error), 
      stack : (error as Error).stack
    })
  }

};

//Sets up new viewer
const addViewer = async (roomId: string, socketId: string) => {
  const startTime = Date.now()
  try {
    logger.info('Add viewer started')

    const room = memoryRoom.get(roomId)

    if (!room) {
      logger.error("Room not found");
      throw new Error 
    }

    const roomBroadcasters = room.broadcasters;

    if (!roomBroadcasters) {
      logger.error('Not broadcaster found for the room')
      throw new Error
    }
  
    if(room.viewers.has(socketId)){
      logger.warn("Already a viewer")
      return; 
    }

    room.viewers.set(socketId,{
      consumers : new Map(), 
      transport : new Map(), 
      joinedAt : Date.now(), 
      role : 'viewer'
    })

    logger.info('Viewer added to the room', Date.now() - startTime)
    return
  } catch (error:any) {
    logger.error('Internal server error', {
      messsage: (error as Error).message, 
      stack: (error as Error).stack
    })
  }
};

//Clean up one viewer
const removeViewer = async (roomId: string, socketId: string) => {
  const startTime = Date.now()
  try {
    logger.info('Remove viewer started')

    const room = memoryRoom.get(roomId)

    if (!room) {
      logger.error('Room not found')
      throw Error('Room not found')
    }
    if(room.viewers.has(socketId)){
      const viewer = room.viewers.get(socketId)
      
      try{
        //Close its transport 
        const viewerConsumerTransport = viewer?.transport?.get('consumer')
        viewerConsumerTransport?.close()
      }catch{}

      //Close consumers
      viewer?.consumers.forEach((consumer) => {
        try {
          consumer.close()
        } catch{}
      })
      room.viewers.delete(socketId)

    }else{
      logger.error('Viewer not found in the memory room')
      throw new Error
    }

    logger.info('Viewer successfully removed', Date.now() - startTime)
    return;
  } catch (error:any) {
    logger.error('Internak server error', {
      message : (error as Error).message, 
      stack : (error as Error).stack
    })
  }
};

//Clean up everything
const removeBroadcaster = async (roomId: string, socketId: string) => {
  const starTime = Date.now()
  try {
    const room = memoryRoom.get(roomId)
    if (!room) {
      logger.error('Room not found')
      return;
    }

    const broadcaster = room.broadcasters.get(socketId)

    if (!broadcaster) {
      logger.error('Broadcaster not found')
      return;
    }

    //Close broadcaster transport
    broadcaster.producers.forEach((producer) =>
    {
      try {
        producer.close()
      } catch{}
    })

    //Close consumer 
    broadcaster.transports.forEach((transport) => {
      try {
        transport.close()
      } catch {}
    })

    logger.info('Removing broadcaster successfully executed', Date.now() - starTime)
    return;
  } catch (error : any) {
    logger.error('Internal server error', {
      message : (error as Error).message, 
      stack : (error as Error).stack
    })
  }
};

export {
  createRoom,
  getRoom,
  saveProducer,
  createRoomId,
  addViewer,
  removeViewer,
  removeBroadcaster,
  deleteRoom
};
