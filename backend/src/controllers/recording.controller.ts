import logger from "../utils/logging";
import { Request, Response } from "express";
import { recordingValidator } from "../validation/downloadRecording.validator";
import { activeRecordings } from "../stores/maps";
import { releasePorts } from "../recording/portAllocator";

export const downloadRecording = async(request: Request, response: Response) => {
    try {
        const {error, value} = recordingValidator.validate(request.body); 
        if(error){
            logger.error('Validation error',{
                path: error.details[0].path, 
                message: error.details[0].message
            })
            return response.status(400).json({
                success: false, 
                message: error.details[0].message
            })
        }

        const {recordingId, socketId , roomId} = value;
        
        const recordingDetails = [...activeRecordings.values()].find((recording) => recording.recordingId === recordingId); 
        
        
        if(!recordingDetails){
            logger.error('Recording not found error',{
                message: "Invalid recording id"
            })
            return response.status(400).json({
                success: false, 
                message: 'Invalid recording id'
            })
        }
        if(recordingDetails?.roomId !== roomId || recordingDetails?.socketId !== socketId){
            logger.error('Validation error', {
                message: "Invalid roomId or socketId"
            })
            return response.status(400).json({
                success: false, 
                message: 'Invalid roomId or socketId'
            })
        }

        activeRecordings.delete(recordingDetails.socketId)
        releasePorts(recordingDetails!.audioPort, recordingDetails!.videoPort)

        return response.download(recordingDetails.recordingPath);

    } catch (error) {
     logger.error('Recording failed', {
        erorr: (error as Error).message,
        stack: (error as Error).stack
     })   
    }
}