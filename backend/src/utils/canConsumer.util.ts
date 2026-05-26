import { getRoom } from "../rooms/room.store";
import logger from "./logging";


const canConsume = (
  roomId: string,
  producerId: string,
  rtpCapabilities: any
) => {
  try {
    const room = getRoom(roomId);
    if(!room){
      logger.error('Room not found')
      return false;
    }

    const router = room.router; 
    if(!router){
      logger.error('Router not found')
      return false;
    }

    if(router.canConsume({producerId, rtpCapabilities})){
      return true
    }else{
      return false
    }
  } catch (error) {
    logger.error('Internal server error',{
      message : (error as Error).message, 
      stack : (error as Error).stack
    })
  }
};


export default canConsume