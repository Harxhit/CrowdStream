import mongoose from "mongoose";
import dotenv from "dotenv";
import apiError from "../utils/apiError";
import logger from "../utils/logging";

dotenv.config();

const connectToDataBase = async ():Promise<void> => {
  const connectionString = process.env.MONGO_DB_URL;

  if (connectionString === undefined || connectionString.trim() === '') {
    throw new apiError(404, "Wrong connection string");
  }

  try {
    const connection = await mongoose.connect(connectionString, {
      dbName: process.env.DATA_BASE_NAME,
    });
    logger.info("Database connected successfully", connection.connection.host);
  } catch (error) {
    logger.error(error);
    throw new apiError(500,'Database connection failed')
  }
};

export default connectToDataBase;
