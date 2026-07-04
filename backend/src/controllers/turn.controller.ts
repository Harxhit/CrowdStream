import logger from "../utils/logging";
import {Request, Response} from 'express'
import crypto from "node:crypto"
import config from "../config";


export const getTurnCreds = async(request:Request, response: Response) => {
    try {
        const userId = request.user.id;
        if(!userId){
            logger.error('User is not authenticated')

            return response.status(401).json({
                success: false, 
                message: 'User is not authenticated'
            })
        }
        const ttl = config.turnTtl;   
        const expiry = Math.floor(Date.now() / 1000) + ttl;
        const username = `${expiry}:${userId}`;

        const credential = crypto.createHmac('sha1', config.turnSecret)
        .update(username)
        .digest('base64')

        return response.status(200).json({
            success: true, 
            data: {
                username, 
                ttl, 
                credential, 
            }
        })

    } catch (error) {
        logger.error('Internal server error', {
            message: (error as Error).message, 
            stack: (error as Error).stack
        })

        return response.status(500).json({
            success: false, 
            message: 'Internal server error'
        })
    }
}