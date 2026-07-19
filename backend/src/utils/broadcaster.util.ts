import logger from "./logging";
import { getRoom } from "../rooms/room.store";
import apiError from './apiError'
import { transportRegistry } from "../stores/maps";

//Registers the broadcaster(user who streams) into the room
const addBroadcaster = async (roomId: string, socketId: string) => {
  try {
    const room = getRoom(roomId);
    room?.broadcasters.set(socketId, {
      socketId: socketId,
      transports : new Map(), 
      producers: new Map(), 
      joinedAt : Date.now(), 
      role : 'host'
    })
    logger.info('Broadcaster added to the room',socketId)
  } catch (error) {
    logger.error("Internal server error", {
      message: (error as Error).message, 
      stack : (error as Error).stack
    })

    throw new apiError(500,'Internal server error')
  }
};

//Saves the broadcaster channels
const saveBroadcasterTransport = async (
  roomId: string,
  socketId: string,
  transport: any
) => {
  try {
    const room = getRoom(roomId)

    const broadcaster = room?.broadcasters.get(socketId)

    if(!broadcaster){
      logger.error("Broadcaster not found")
      throw new apiError(404,'Broadcaster not found')
    }

    broadcaster.transports.set('producer', transport)

  } catch (error : any) {
    logger.error('Internal server error', {
      message : (error as Error).message, 
      stack:  (error as Error).stack
    })

    throw new apiError(500,'Internal server error')
  }
};

const removeBroadcasterTransport = (roomId:string, socketId:string) => {
  const room = getRoom(roomId); 
  
  const broadcaster = room.broadcasters.get(socketId); 
  if(!broadcaster){
    logger.warn('broadcaster not found'); 
    throw new Error('broadcaster not found')
  }

  broadcaster.transports?.forEach((t) => {
    transportRegistry.delete(t.id); 
    t.close()
  })
  broadcaster.transports?.clear()
}


const removeBroadcasterProducer = (roomId:string, socketId:string) => {
  const room = getRoom(roomId); 
  
  const broadcaster = room.broadcasters.get(socketId); 
  if(!broadcaster){
    logger.warn('broadcaster not found'); 
    throw new Error('broadcaster not found')
  }

  broadcaster.producers?.forEach((p) => p.close())
  broadcaster.producers?.clear()
}

export {addBroadcaster, saveBroadcasterTransport, removeBroadcasterProducer,removeBroadcasterTransport}