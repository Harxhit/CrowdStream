import mongoose from "mongoose";
import dotenv from "dotenv";
import ApiError from "../utils/apiError";
import logger from "../utils/logging";

dotenv.config();

const connectToDataBase = async () => {
  const connectionString = process.env.MONGO_DB_URL;

  if (!connectionString) {
    throw new ApiError(404, "Wrong connection string");
  }
  console.log(
    "Connecting to DB:",
    connectionString,
    "DB Name:",
    process.env.DATABASE_NAME
  );

  try {
    const connection = await mongoose.connect(connectionString, {
      dbName: process.env.DATA_BASE_NAME,
    });
    logger.info("Database connected successfully", connection.connection.host);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

export default connectToDataBase;
