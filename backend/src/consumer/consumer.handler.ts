import logger from "../utils/logging";
import { memoryRoom } from "../rooms/room.store";
import canConsume  from "../utils/canConsumer.util";

//Pauses a specific media consumer (e.g., video or audio) for the viewer
const pauseConsumer = async (
  roomId: string,
  socketId: string,
  consumerId: string
) => {
  const startTime = Date.now()
  try {
    logger.info('Pause consumer started')
    const room = memoryRoom.get(roomId)
    if (!room) {
      logger.error('Room not found')
      return 
    }
    const viewer = room.viewers.get(socketId)
    if (!viewer) {
      logger.error('Room not found')
      return
    }
    const viewerConsumers = viewer.consumers
  
    if (!viewerConsumers) {
      logger.error("Viewer consumers not found")
      return
    }

    const pauseConsumer = viewer.consumers.get(consumerId);
    pauseConsumer.pause()

    logger.info("Viewer specific consumer paused successfully", startTime)
    
  } catch (error:any) {
    logger.error('Internal server error',{
      message : (error as Error).message, 
      stack : (error as Error).stack
    })
  }
};

//Resume previously paused consumer for the viewer
const resumeConsumer = async (
  roomId: string,
  socketId: string,
) => {
  try {
    logger.info('Resume consumer started')

    const room = memoryRoom.get(roomId)

    if(!room){
      logger.error("Room not found")
      return
    }

    const viewer = room.viewers.get(socketId)

    if(!viewer){
      logger.error("Viewer not found")
      return;
    }


  } catch (error:any) {
    logger.error('Internal server error', {
      message : (error as Error).message, 
      stack :  (error as Error).stack
    })
  }
  
};

//Closes the consumer
const closeConsumer = async (
  roomId: string,
  socketId: string,
  consumerId: string
) => {
 const startTime = Date.now()
 try {
  logger.info('Close consumer started')

  const room = memoryRoom.get(roomId);
  if(!room){
    logger.error('Room not found')
    return;
  }

  const viewer = room.viewers.get(socketId)
  if(!viewer){
    logger.error('Viewer not found in the room')
    return;
  }

  const closeConsumer = viewer.consumers.get(consumerId)
  closeConsumer.close()

  logger.info('Close consumer successfully executed', Date.now() - startTime)

 } catch (error:any) {
  logger.error('Internal server error', {
    message: (error as Error).message, 
    stack : (error as Error).stack
  })
 }
};


const manageMultiStreamConsumers = async (
  roomId: string,
  socketId: string,
  producerId: string,
  rtpCapabilities: any
) => {
  const startTime = Date.now()
  try {
    const room = memoryRoom.get(roomId)
    if (!room) {
      logger.error('Room not found')
      return
    }
  
    const viewer = room.viewers.get(socketId)
    if (!viewer) {
      logger.error('Viewer not found')
      return 
    }
  
    const viewerConsumer = viewer.consumers; 
    if(viewerConsumer.size === 0){
      logger.warn('Viewer consumer dont exits creating one')
    }

    const canConsumeResult = canConsume(roomId , producerId , rtpCapabilities)
    if(canConsumeResult){
      'something'
    }else{
      logger.error('Your router capabilties dont allow you consume this stream')
      return;
    }


  } catch (error:any) {
    logger.error('Internal server error', {
      message:  (error as Error).message, 
      stack : (error as Error).stack
    })
  }
};

export {
  pauseConsumer,
  closeConsumer,
  resumeConsumer,
  manageMultiStreamConsumers,
};
