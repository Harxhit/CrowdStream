import logger from "./logging";
import { getRoom } from "../rooms/room.store";
import apiError from './apiError'

//Registers the broadcaster(user who streams) into the room
const addBroadcaster = async (roomId: string, socketId: string) => {
  try {
    const room = getRoom(roomId);
    room?.broadcasters.set(socketId, {
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

export {addBroadcaster, saveBroadcasterTransport}