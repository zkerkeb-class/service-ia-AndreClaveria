import express, { Application, Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";

import helmet from "helmet";
import morgan from "morgan";
import config from "./config";
import route from "./routes/index";
import { errorMiddleware } from "./middlewares/error.middleware";
import { logger } from "./utils/logger";
import { setupSwagger } from "./config/swagger.config";

const app: Application = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(
  morgan("combined", {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  })
);

app.use("/api", route);
setupSwagger(app);
app.get("/health", async (req: Request, res: Response) => {
  const status = {
    status: "UP",
    timestamp: new Date().toISOString(),
    service: config.discord.service_name
  };

  res.status(200).json(status);
});

app.use(errorMiddleware);

export { app };
