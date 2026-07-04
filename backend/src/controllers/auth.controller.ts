import User from '../models/user.model'
import logger from '../utils/logging'
import {Request, Response} from 'express'

export const me = async (request: Request, response: Response) => {
    try {
        const userId = request.user.id;
    
        const user = await User.findById(userId).select(
            "_id username email"
        );

        if(!user){
            logger.error('User not found')
                
            return response.status(404).json({
                success: false,
                message: "User not found"
            });
        }
    
        return response.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        return response.status(500).json({
            success: false, 
            message: 'Internal server error'
        })
    }
};