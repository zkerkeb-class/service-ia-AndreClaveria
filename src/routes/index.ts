import { Router } from "express";
import aiRoutes from "./ai.route";
const router = Router();

// Add your routes here
router.use("/ai", aiRoutes);

export default router;
