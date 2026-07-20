import { Socket } from "socket.io";
import logger from "./logging";
import { removeBroadcaster, removeViewer } from "../rooms/room.store";
import { removeBroadcasterProducer, removeBroadcasterTransport } from "./broadcaster.util";
import { removeViewerConsumer, removeViewerTransport } from "../handlers/viewer.handler";
import Broadcaster from "../models/broadcaster.model";
import Viewer from "../models/viewer.model";
import LiveRoom from "../models/liveRoom.models";
import { memoryRoom } from "../stores/maps";

export const handleDisconnect = async(socket: Socket) => {
    const startTime = Date.now()
    try {
      logger.info('Handle disconnect started')  
    
      let roomId = socket.data.roomId; 
      if(!roomId){
        logger.error('RoomId not found')
        const [broadcaster, viewer] = await Promise.all([
            Broadcaster.findOne({socketId: socket.id}),
            Viewer.findOne({socketId: socket.id}),
        ]);
        if(broadcaster){
            roomId = broadcaster?.roomId; 
            removeBroadcasterTransport(roomId, socket.id)
            removeBroadcasterProducer(roomId, socket.id)
            await removeBroadcaster(roomId, socket.id)
            await dbCleanUp(socket.id)
        }else if(viewer){
            roomId = viewer?.roomId
            removeViewerTransport(roomId,socket.id)
            removeViewerConsumer(roomId,socket.id); 
            removeViewer(roomId,socket.id)
            await dbCleanUp(socket.id)
        }else if(!broadcaster || !viewer){
            logger.warn('IDK')
        }
      }

      const room = memoryRoom.get(roomId); 
      if(!room){
        await dbCleanUp(socket.id)
        return; 
      }

      const isBroadcaster = room?.broadcasters.has(socket.id)
      const isViewer = room?.viewers.has(socket.id)

      if(isBroadcaster){
        removeBroadcasterTransport(roomId, socket.id)
        removeBroadcasterProducer(roomId, socket.id)
        await removeBroadcaster(roomId, socket.id)
        dbCleanUp(socket.id)

      }else if(isViewer){
        removeViewerTransport(roomId, socket.id)
        removeViewerConsumer(roomId,socket.id); 
        removeViewer(roomId,socket.id)
        dbCleanUp(socket.id)
      }else if(!isBroadcaster || !isViewer){
        logger.error('Idk')
      }

      logger.info('Handle disconnect succesfully',{
        durationMs: Date.now() - startTime
      })
    
    } catch (error) {
        logger.error('Handle disconnect failed',{
            error: (error as Error).message, 
            stack: (error as Error).stack, 
            name: (error as Error).name
        })
    }
}

const dbCleanUp = async(socketId:string) => {
    try {
        const [broadcaster, viewer] = await Promise.all([
            Broadcaster.findOne({socketId: socketId}),
            Viewer.findOne({socketId: socketId}),
        ]);

        if(broadcaster){
            await Broadcaster.findByIdAndDelete(broadcaster.id)
            await LiveRoom.deleteOne({
                experienceRoomId: broadcaster.roomId
            })
        }else if(viewer){
            await Viewer.deleteOne({
                socketId: socketId
            })
            await LiveRoom.findOneAndUpdate(
                {
                    experienceRoomId: viewer.roomId
                },
                {
                    $inc: {
                        totalViewersJoined: -1
                    }
                }
            )
        }
    } catch (error) {
        logger.error('DB cleanup failed',{
            error: (error as Error).message, 
            stack: (error as Error).stack, 
            name: (error as Error).name
        })   
    }
} 