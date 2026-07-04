import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/verifyJwt";
import logger from "../utils/logging";
import type { Socket } from "socket.io";


function authenticate(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const token = request.cookies.accessToken;

    if (!token) {
      throw new Error("Unauthorized");
    }

    const payload = verifyAccessToken(token);

    request.user = {
      id: payload.sub,
    };

    next();
  } catch {
    return response.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
}

function socketAuth(socket:Socket, next: (err?: Error) => void){
  try {
    const request = socket.request as Request; 
    const token = request?.cookies?.accessToken; 
    console.log('Token from cookie:', token ? 'Received' : 'Missing');

    const payload = verifyAccessToken(token); 

    socket.data.user = {
      id : payload.sub
    }

    next()
  } catch (error) {
    logger.error('Socket auth error',{
      message: (error as Error).message,
      stack: (error as Error).stack
    })

    next(new Error("Unauthorized"))
  }
}

export{authenticate, socketAuth}