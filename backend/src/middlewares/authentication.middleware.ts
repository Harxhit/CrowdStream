import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import ApiError from "../utils/apiError";

export default function authenticate(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const token = request.cookies.accessToken;

    if (!token) {
      throw new ApiError(401, "Unauthorized");
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as { id: string };

    request.user = {
      id: payload.id,
    };

    next();
  } catch (error) {
    return response.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
}