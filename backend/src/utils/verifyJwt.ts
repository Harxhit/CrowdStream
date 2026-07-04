import jwt from "jsonwebtoken";
import ApiError from "../utils/apiError";
import logger from "./logging";
export interface JwtPayload {
  sub: string;
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as JwtPayload;
  } catch(error) {
    logger.error('Internal server error',{
        message: (error as Error).message,
        stack: (error as Error).stack
    })
    throw new ApiError(401, "Unauthorized");
  }
}