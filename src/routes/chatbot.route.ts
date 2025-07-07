// src/routes/chatbot.route.ts

import { Router } from "express";
import ChatbotController from "../controllers/chatbot.controller";

const router = Router();

// Routes principales du chatbot
router.post("/chat", ChatbotController.chat);
router.post("/help", ChatbotController.getContextualHelp);
router.post("/search", ChatbotController.searchFeatures);

// Historique & session
router.get("/history/:sessionId", ChatbotController.getConversationHistory);
router.post("/reset/:sessionId", ChatbotController.resetSession);

// Structure et stats
router.get("/structure", ChatbotController.getCRMStructure);
router.get("/stats", ChatbotController.getStats);

// Health check
router.get("/health", ChatbotController.healthCheck);

export default router;
