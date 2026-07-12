import mongoose from "mongoose";
import apiError from "../utils/apiError";
import config from "../config";
import logger from "../utils/logging";

const delay = (ms: number)  => {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const isProduction = process.env.NODE_ENV === "production";

const MAX_RETRIES = isProduction ? 5 : Infinity;
const INITIAL_DELAY_MS = 1000;


const connectToDataBase = async (): Promise<void> => {
  const connectionString = config.mongoUrl;
  
  if (!connectionString?.trim()) {
    throw new apiError(404, "Wrong connection string");
  }

  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  mongoose.connection.on("error", (error) => {
    logger.error("MongoDB connection error:", error);
  });

  let attempt = 0; 
  while(attempt < MAX_RETRIES){
      try {
        const connection = await mongoose.connect(connectionString, {
          dbName: config.databaseName,
        });
    
        logger.info(
          `Database connected successfully to ${connection.connection.host}`
        );
        return; 
      } catch (error) {
        attempt++; 
        const backOff = Math.min(INITIAL_DELAY_MS * 2 ** (attempt - 1), 30000);
        
        logger.warn(
          `MongoDB connection failed (${attempt}/${MAX_RETRIES === Infinity ? "∞" : MAX_RETRIES}). Retrying in ${backOff}ms`
        );
        if(attempt >= MAX_RETRIES){
          logger.error('Max retries exceeded')
          throw error
        }
        await delay(backOff)
      }
  }
};

export default connectToDataBase;