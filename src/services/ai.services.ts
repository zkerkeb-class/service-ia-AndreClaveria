// services/ai.service.ts

import config from "../config";
import { AI_CONFIG } from "../config/openia.config";
import { logger } from "../utils/logger";
import jwt from "jsonwebtoken";
interface AIAnalysisResult {
  score: number;
  recommendation: string;
  reasoning: string;
  priority: "low" | "medium" | "high";
  nextAction: string;
  timeframe: string;
}

class AIService {
  private baseURL: string;
  private serviceToken: string;

  constructor() {
    this.baseURL = config.server.bdd_service_url;
    // Créer un token de service interne
    this.serviceToken = this.createServiceToken();
  }

  /**
   * Créer un token JWT pour les appels internes
   */
  private createServiceToken(): string {
    const payload = {
      id: "ai-service",
      role: "service",
      service: "ai-analysis"
    };

    return jwt.sign(payload, config.jwt.secret, { expiresIn: "24h" });
  }

  /**
   * Récupérer un client depuis le service BDD avec authentification
   */
  async getClientById(clientId: string): Promise<any> {
    try {
      logger.info(`📡 Récupération client ${clientId} depuis BDD service`);

      const response = await fetch(`${this.baseURL}/clients/${clientId}`, {
        headers: {
          Authorization: `Bearer ${this.serviceToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Régénérer le token si expiré
          this.serviceToken = this.createServiceToken();
          logger.warn("🔄 Token service régénéré");

          // Retry avec nouveau token
          return this.getClientById(clientId);
        }
        throw new Error(`Client non trouvé: ${response.status}`);
      }

      const client = await response.json();
      logger.info(`✅ Client récupéré: ${client.name}`);

      return client;
    } catch (error) {
      logger.error(`❌ Erreur récupération client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Analyser un client avec OpenAI (version basique)
   */
  async analyzeClient(clientId: string): Promise<AIAnalysisResult> {
    try {
      logger.info(`🤖 Début analyse IA pour client ${clientId}`);

      // 1. Récupérer le client
      const client = await this.getClientById(clientId);

      // 2. Préparer les données
      const clientData = this.prepareClientData(client);
      logger.info(`📊 Données préparées pour ${client.name}`);

      // 3. Appeler OpenAI
      const analysis = await this.callOpenAI(clientData);
      logger.info(`✅ Analyse terminée - Score: ${analysis.score}/100`);

      return analysis;
    } catch (error) {
      logger.error(`❌ Erreur analyse client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Appel à OpenAI
   */
  private async callOpenAI(clientData: any): Promise<AIAnalysisResult> {
    try {
      logger.info(`🔗 Appel OpenAI pour ${clientData.name}`);

      const response = await fetch(
        `${AI_CONFIG.openai.baseURL}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AI_CONFIG.openai.apiKey}`
          },
          body: JSON.stringify({
            model: AI_CONFIG.openai.model,
            max_tokens: AI_CONFIG.openai.maxTokens,
            temperature: AI_CONFIG.openai.temperature,
            messages: [
              {
                role: "system",
                content: AI_CONFIG.prompts.systemPrompt
              },
              {
                role: "user",
                content: AI_CONFIG.prompts.analysisPrompt(clientData)
              }
            ]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `OpenAI API Error: ${response.status} - ${errorData.error?.message}`
        );
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      logger.info(`📝 Réponse OpenAI reçue`);

      // Parser la réponse JSON
      try {
        return JSON.parse(content);
      } catch (e) {
        logger.warn(`⚠️ Réponse OpenAI non-JSON, parsing manuel`);
        return this.parseAIResponse(content);
      }
    } catch (error) {
      logger.error(`❌ Erreur appel OpenAI:`, error);
      throw error;
    }
  }

  /**
   * Préparer les données client pour l'IA
   */
  private prepareClientData(client: any) {
    const daysSinceContact = client.lastContactDate
      ? Math.floor(
          (Date.now() - new Date(client.lastContactDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 999;

    return {
      name: client.name,
      sector: client.sector || "Non spécifié",
      description: client.description || "Aucune description",
      estimatedBudget: client.estimatedBudget || 0,
      companySize: client.companySize || "1-10",
      stage: client.stage || "prospect",
      urgency: client.urgency || "medium",
      daysSinceLastContact: daysSinceContact,
      currentScore: client.goodForCustomer || 50
    };
  }

  /**
   * Parser réponse IA si pas JSON
   */
  private parseAIResponse(content: string): AIAnalysisResult {
    const scoreMatch = content.match(/score[\":\s]*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;

    return {
      score,
      recommendation: "Analyse manuelle recommandée",
      reasoning: "Réponse IA non structurée",
      priority: score > 70 ? "high" : score > 50 ? "medium" : "low",
      nextAction: "Contacter le client",
      timeframe: "Cette semaine"
    };
  }

  /**
   * Test de connexion
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info(`🔍 Test connexion BDD service: ${this.baseURL}`);

      const response = await fetch(`${this.baseURL}/health`);
      const isConnected = response.ok;

      if (isConnected) {
        logger.info(`✅ BDD service connecté`);
      } else {
        logger.error(`❌ BDD service non disponible`);
      }

      return isConnected;
    } catch (error) {
      logger.error(`❌ Erreur test connexion:`, error);
      return false;
    }
  }
}

export const aiService = new AIService();
export { AIAnalysisResult };
