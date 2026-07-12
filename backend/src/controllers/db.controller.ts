import logger from "../utils/logging";
import type { Request, Response } from "express";
import mongoose from "mongoose";

export const dbReadinessCheck = async(request: Request, response:Response) => {
    const startTime = Date.now()
    try {
        logger.info('MongoDB readiness check', {
            ip: request.ip, 
            userAgent: request.get("User-Agent")
        })

        //Driver connection state
        if(mongoose.connection.readyState !== 1){
            logger.error('Database connection is not open');
            return response.status(503).json({
                success: false, 
                message: 'Database connection is not opened'
            })
        }

        await mongoose.connection.db?.admin().ping()

        logger.info('Database UP',{
            durationMs: Date.now() - startTime
        })

        return response.status(200).json({
            success: true, 
            message: 'Database Up'
        })
    } catch (error) {
        logger.error('Internal server error',{
            message: (error as Error).message, 
            stack: (error as Error).stack
        })

        return response.status(500).json({
            success: false, 
            message: 'Database down'
        })
    }
}