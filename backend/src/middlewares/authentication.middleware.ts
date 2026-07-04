import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/verifyJwt";

export default function authenticate(
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