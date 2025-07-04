// controllers/ai.controller.ts
import { Request, Response } from "express";
import { aiService } from "../services/ai.services";
import { logger } from "../utils/logger";

export class AIController {
  /**
   * Analyser un client
   * GET /api/ai/analyze/:clientId
   */
  async analyzeClient(req: Request, res: Response) {
    try {
      const { clientId } = req.params;

      if (!clientId) {
        return res.status(400).json({
          error: "Client ID requis"
        });
      }

      logger.info(`🎯 Demande analyse IA pour client: ${clientId}`);

      // Analyser le client
      const analysis = await aiService.analyzeClient(clientId);

      logger.info(
        `✅ Analyse terminée pour ${clientId} - Score: ${analysis.score}`
      );

      res.json({
        success: true,
        clientId,
        analysis,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`❌ Erreur analyse client ${req.params.clientId}:`, error);

      res.status(500).json({
        error: "Erreur lors de l'analyse",
        message: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  /**
   * Test de santé du service IA
   * GET /api/ai/health
   */
  async healthCheck(req: Request, res: Response) {
    try {
      logger.info(`🔍 Health check service IA`);

      const bddConnected = await aiService.testConnection();

      res.json({
        status: "OK",
        service: "AI Service",
        timestamp: new Date(),
        connections: {
          bddService: bddConnected,
          openaiConfigured: !!process.env.OPENAI_API_KEY
        }
      });
    } catch (error) {
      logger.error(`❌ Erreur health check IA:`, error);

      res.status(500).json({
        status: "ERROR",
        message: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }
}

export const aiController = new AIController();
