import mongoose from "mongoose";
import apiError from "../utils/apiError";
import logger from "../utils/logging";
import config from "../config";


const connectToDataBase = async ():Promise<void> => {
  const connectionString = config.mongoUrl;

  if (connectionString === undefined || connectionString.trim() === '') {
    throw new apiError(404, "Wrong connection string");
  }

  try {
    const connection = await mongoose.connect(connectionString, {
      dbName: config.databaseName,
    });
    logger.info("Database connected successfully", connection.connection.host);
  } catch (error) {
    logger.error(error);
    throw new apiError(500,'Database connection failed')
  }
};

export default connectToDataBase;
