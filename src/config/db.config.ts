import mongoose from "mongoose";
import { logger } from "../utils/logger";
import config from ".";

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = config.database.mongoUri;
    await mongoose.connect(mongoURI);
    logger.info("MongoDB connected successfully");
  } catch (error) {
    logger.error("MongoDB connection failed", error);
    process.exit(1);
  }
};

export default connectDB;
