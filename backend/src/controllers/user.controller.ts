import User from "../models/user.model";
import type {Request, Response} from 'express'
import logger from "../utils/logging";
import { signInSchema, signUpSchema } from "../validation/auth.validation";
import { checkPassWordCorrect, generateAccessToken, hashPassword } from "../utils/auth.util";
import ApiError from "../utils/apiError";

const signUp = async (request: Request, response: Response) => {
  const startTime = Date.now();
  try {
    logger.info("SignUp started", {
      ip: request.ip,
      userAgent: request.get("User-Agent"),
      method: request.method,
      route: request.originalUrl,
    });

    const { error, value } = signUpSchema.validate(request.body);

    if (error) {
      logger.error('Validation error',{
        path: error.details[0].path, 
        message: error.details[0].message
      })
      return response.status(403).json({
        success: false, 
        message: error.details[0].message, 
        path: error.details[0].path
      })
    }

    const { username, email, password } = value;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      logger.error('User already exists')
      return response.status(403).json({
        success: false
      })
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      username,
      email,
      passwordHash: hashedPassword,
    });

    const accessToken = generateAccessToken(user._id.toString());

    const isProduction = process.env.NODE_ENV === "production";

    response.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    logger.info("SignUp completed", {
      durationMs: Date.now() - startTime,
      userId: user._id,
    });

    return response.status(201).json({
      success: true,
      message: "SignUp completed",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("SignUp Error", {
      message: (error as Error).message,
      stack: (error as Error).stack,
    });

    if (error instanceof ApiError) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return response.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const signIn = async(request: Request, response: Response) => {
    const startTime = Date.now()
    try {
        logger.info("SignIn started", {
            ip: request.ip,
            userAgent: request.get("User-Agent"),
            method: request.method,
            route: request.originalUrl,
        });

        const {error, value} = signInSchema.validate(request.body); 
        if(error){
          logger.error("Validation error", {
              path: error.details[0].path,
              message: error.details[0].message
          })
          return response.status(403).json({
            success: false, 
            message: error.details[0].message,
            path: error.details[0].path
          })
        }

        const {email , password} = value; 
        const user = await User.findOne({email}).select("+passwordHash")
        if(!user){
          logger.error('User does not exist'); 
          return response.status(403).json({
            success: false, 
            message: 'User does not exist'
          })
        }

        const hashedPassword = user.passwordHash; 
        
        const passwordValidation = await checkPassWordCorrect(password, hashedPassword)
        if(!passwordValidation){
            logger.error('Password validation failed', {
              ip: request.ip,
              userAgent: request.get("User-Agent"),
              route: request.originalUrl,
            })
          return response.status(403).json({
            success: false, 
            message: 'Incorrect password'
          })
        }

        const userId = user._id.toString(); 
        const accessToken = generateAccessToken(userId)
               
        const isProduction = process.env.NODE_ENV === "production";

        response.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        logger.info('SignIn completed', {
            durationMs: Date.now() - startTime, 
            userId
        })
        
        response.status(200).json({
          success: true, 
          message: 'SignIn completed', 
          user, 
        })


    } catch (error) {
        logger.error('SignIn Error',{
          message: (error as Error).message, 
          stack: (error as Error).stack
        })

      return response.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
    }
}

export {signUp, signIn}