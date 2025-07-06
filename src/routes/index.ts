import { Router } from "express";
import aiRoutes from "./ai.route";
import chatRoutes from "./chatbot.route";
const router = Router();

// Add your routes here
router.use("/ai", aiRoutes);
router.use("/chatbot", chatRoutes);

export default router;
