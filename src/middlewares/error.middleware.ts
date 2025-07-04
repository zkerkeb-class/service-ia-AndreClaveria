import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import config from "../config";
export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error("Global error handler", error);
  res.status(500).json({
    message: "Une erreur est survenue",
    error: config.server.env === "development" ? error.message : undefined
  });
};
