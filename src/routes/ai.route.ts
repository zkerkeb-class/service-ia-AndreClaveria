// routes/ai.routes.ts
import { Router } from "express";
import { aiController } from "../controllers/ai.controller";

const router = Router();

// Health check du service IA
router.get("/health", aiController.healthCheck.bind(aiController));

// Analyser un client spécifique
router.get("/analyze/:clientId", aiController.analyzeClient.bind(aiController));

export default router;
