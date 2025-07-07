// services/ai.services.ts

import config from "../config";
import {
  AI_CONFIG,
  ClientData,
  analyzeClientProfile,
  validateClientData,
  calculateEnhancedScore
} from "../config/openia.config";
import { logger } from "../utils/logger";
import jwt from "jsonwebtoken";

// 🔧 AJOUT DES TYPES MANQUANTS
type InteractionOutcome = "positive" | "neutral" | "negative" | "no_response";
type CompanySize = "1-10" | "11-50" | "51-200" | "200+";
type InteractionType =
  | "email"
  | "meeting"
  | "demo"
  | "proposal"
  | "call"
  | "phone";

interface AIAnalysisResult {
  score: number;
  category: string;
  priority: "haute" | "moyenne" | "basse";
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: {
    immediate: string;
    shortTerm: string;
    longTerm: string;
  };
  riskAssessment: {
    level: "low" | "medium" | "high";
    factors: string[];
    mitigation: string;
  };
  nextSteps: {
    action: string;
    timeframe: string;
    responsible: string;
    success_metrics: string;
  };
}

class AIService {
  private baseURL: string;
  private serviceToken: string;

  constructor() {
    this.baseURL = config.server.bdd_service_url;
    this.serviceToken = this.createServiceToken();
  }

  private createServiceToken(): string {
    const payload = {
      id: "ai-service",
      role: "service",
      service: "ai-analysis"
    };
    return jwt.sign(payload, config.jwt.secret, { expiresIn: "24h" });
  }

  private transformInteractions(
    rawInteractions: any[]
  ): ClientData["interactions"] {
    if (!Array.isArray(rawInteractions)) {
      logger.warn(`⚠️ Interactions invalides (pas un array):`, rawInteractions);
      return [];
    }

    const validInteractions = rawInteractions
      .filter((interaction, index) => {
        // Validation de base
        if (!interaction || typeof interaction !== "object") {
          logger.warn(`⚠️ Interaction invalide (null/undefined):`, interaction);
          return false;
        }

        if (!interaction.date || !interaction.type || !interaction.outcome) {
          logger.warn(`⚠️ Interaction avec champs manquants:`, interaction);
          return false;
        }

        // Validation des types
        const validTypes: InteractionType[] = [
          "email",
          "meeting",
          "demo",
          "proposal",
          "call",
          "phone"
        ];
        const validOutcomes: InteractionOutcome[] = [
          "positive",
          "neutral",
          "negative",
          "no_response"
        ];

        if (!validTypes.includes(interaction.type)) {
          logger.warn(`⚠️ Type d'interaction invalide: ${interaction.type}`);
          return false;
        }

        if (!validOutcomes.includes(interaction.outcome)) {
          logger.warn(
            `⚠️ Outcome d'interaction invalide: ${interaction.outcome}`
          );
          return false;
        }

        return true;
      })
      .map((interaction) => {
        const transformed = {
          _id: interaction._id,
          date: new Date(interaction.date),
          type: interaction.type as InteractionType,
          outcome: interaction.outcome as InteractionOutcome,
          notes: interaction.notes || ""
        };
        return transformed;
      })
      // Trier par date décroissante (plus récent en premier)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    logger.info(
      `🔧 Interactions transformées: ${validInteractions.length}/${rawInteractions.length} valides`
    );

    return validInteractions;
  }

  async getClientById(clientId: string): Promise<ClientData> {
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
          this.serviceToken = this.createServiceToken();
          logger.warn("🔄 Token service régénéré");
          return this.getClientById(clientId);
        }
        throw new Error(`Client non trouvé: ${response.status}`);
      }

      const rawResponse = await response.json();

      // 🚨 FIX CRITIQUE: Extraire les données du wrapper { success: true, data: {...} }
      const rawClient = rawResponse.data || rawResponse;
      logger.info(`✅ Client brut récupéré:`, rawClient);

      // 🔧 TRANSFORMATION DES DONNÉES MONGODB VERS FORMAT ATTENDU
      const client: ClientData = {
        _id: rawClient._id,
        name: rawClient.name,
        description: rawClient.description,
        sector: rawClient.sector,
        phone: rawClient.phone,
        email: rawClient.email,
        isActive: rawClient.isActive,
        createdAt: rawClient.createdAt
          ? new Date(rawClient.createdAt)
          : undefined,
        updatedAt: rawClient.updatedAt
          ? new Date(rawClient.updatedAt)
          : undefined,
        assignedTo: rawClient.assignedTo,

        // 🔧 FIX: Conversion explicite des nombres
        goodForCustomer: rawClient.goodForCustomer
          ? Number(rawClient.goodForCustomer)
          : undefined,

        estimatedBudget: rawClient.estimatedBudget
          ? Number(rawClient.estimatedBudget)
          : undefined,

        // 🔧 FIX: Conversion explicite des booléens
        hasWorkedWithUs:
          rawClient.hasWorkedWithUs === true ||
          rawClient.hasWorkedWithUs === "true",

        knowsUs: rawClient.knowsUs === true || rawClient.knowsUs === "true",

        // 🔧 FIX: Validation de la taille d'entreprise
        companySize: rawClient.companySize as CompanySize,

        // 🔧 FIX: Transformation des arrays
        contacts: Array.isArray(rawClient.contacts) ? rawClient.contacts : [],

        opportunities: Array.isArray(rawClient.opportunities)
          ? rawClient.opportunities
          : [],

        // 🔧 FIX: Transformation des interactions avec validation complète
        interactions: this.transformInteractions(rawClient.interactions)
      };

      const summary = {
        name: client.name,
        sector: client.sector,
        budget: client.estimatedBudget,
        budgetType: typeof client.estimatedBudget,
        companySize: client.companySize,
        goodForCustomer: client.goodForCustomer,
        goodForCustomerType: typeof client.goodForCustomer,
        hasWorkedWithUs: client.hasWorkedWithUs,
        hasWorkedWithUsType: typeof client.hasWorkedWithUs,
        knowsUs: client.knowsUs,
        interactionsCount: client.interactions?.length || 0,
        isActive: client.isActive
      };

      logger.info(`🔧 Données client transformées:`, summary);

      return client;
    } catch (error) {
      logger.error(`❌ Erreur récupération client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Analyser un client avec debug détaillé
   */
  async analyzeClient(clientId: string): Promise<AIAnalysisResult> {
    try {
      logger.info(`🤖 Début analyse IA pour client ${clientId}`);

      // 1. Récupérer et transformer le client
      const client = await this.getClientById(clientId);

      // 2. Validation des données
      const isValid = validateClientData(client);
      logger.info(
        `🔍 Validation données: ${isValid ? "✅ Valide" : "❌ Invalide"}`
      );

      // 3. Calcul du score
      const localScore = calculateEnhancedScore(client);

      // 4. Vérification critique du score
      if (localScore === 0) {
        logger.error(
          `❌ ERREUR CRITIQUE: Score = 0 pour client avec bonnes données!`
        );

        // Force un recalcul manuel pour debug
        let manualScore = 0;

        // Test budget
        if (
          client.estimatedBudget &&
          typeof client.estimatedBudget === "number" &&
          client.estimatedBudget >= 5000
        ) {
          manualScore += 8;
        }

        // Test ancien client
        if (client.hasWorkedWithUs === true) {
          manualScore += 25;
        } else if (client.knowsUs === true) {
          manualScore += 12;
        }

        if (manualScore > 0) {
          return {
            score: manualScore,
            category: "qualifier",
            priority: "moyenne",
            reasoning: `🚨 BUG CRITIQUE: calculateEnhancedScore retourne 0 mais calcul manuel donne ${manualScore}. Données: Budget=${client.estimatedBudget}, HasWorked=${client.hasWorkedWithUs}, KnowsUs=${client.knowsUs}`,
            strengths: ["Données client correctes"],
            weaknesses: ["Bug de calcul système"],
            recommendations: {
              immediate: "Débugger calculateEnhancedScore",
              shortTerm: "Corriger l'algorithme de scoring",
              longTerm: "Tests unitaires complets"
            },
            riskAssessment: {
              level: "high",
              factors: ["Bug système critique"],
              mitigation: "Correction immédiate du code de scoring"
            },
            nextSteps: {
              action: "Debug technique immédiat",
              timeframe: "Immédiat",
              responsible: "Équipe technique",
              success_metrics: "Score calculé correctement"
            }
          };
        }
      }

      // 5. Analyse locale complète
      const localAnalysis = analyzeClientProfile(client);
      logger.info(
        `🏷️ Catégorie: ${localAnalysis.category}, Priorité: ${localAnalysis.priority}`
      );

      // 6. Tentative d'analyse IA (optionnelle)
      let aiAnalysis: Partial<AIAnalysisResult> = {};
      let aiSuccess = false;

      try {
        aiAnalysis = await this.callOpenAI(client);
        aiSuccess = true;
        logger.info(`🤖 Analyse IA réussie`);
      } catch (error) {
        logger.warn(
          `⚠️ Analyse IA échouée, utilisation du scoring local:`,
          error
        );
      }

      // 7. Construction de la réponse finale
      const finalAnalysis: AIAnalysisResult = {
        score: localScore,
        category: localAnalysis.category,
        // 🔧 FIX: Utiliser directement la priorité de localAnalysis SANS conversion
        priority: (localAnalysis.priority === "high"
          ? "haute"
          : localAnalysis.priority === "medium"
            ? "moyenne"
            : localAnalysis.priority === "low"
              ? "basse"
              : localAnalysis.priority) as "haute" | "moyenne" | "basse",
        reasoning:
          aiAnalysis.reasoning ||
          this.generateLocalReasoning(client, localAnalysis, localScore),
        strengths: aiAnalysis.strengths || localAnalysis.strengths,
        weaknesses: aiAnalysis.weaknesses || localAnalysis.weaknesses,
        recommendations:
          aiAnalysis.recommendations ||
          this.generateLocalRecommendations(localAnalysis),
        riskAssessment: aiAnalysis.riskAssessment || {
          level: localAnalysis.riskLevel,
          factors: localAnalysis.riskFactors,
          mitigation: this.generateMitigation(localAnalysis.riskLevel)
        },
        nextSteps: aiAnalysis.nextSteps || this.generateNextSteps(localAnalysis)
      };

      // 8. Validation finale
      if (finalAnalysis.score === 0) {
        logger.error(`❌ ALERTE: Score final toujours à 0 pour ${client.name}`);
        finalAnalysis.score = 1;
        finalAnalysis.reasoning = `Score forcé à 1 - Erreur de calcul détectée. ${finalAnalysis.reasoning}`;
      }

      logger.info(
        `✅ Analyse terminée - Score: ${finalAnalysis.score}/100, Source: ${aiSuccess ? "IA+Local" : "Local uniquement"}`
      );

      return finalAnalysis;
    } catch (error) {
      logger.error(`❌ Erreur analyse client ${clientId}:`, error);
      return this.generateEmergencyAnalysis();
    }
  }

  /**
   * Appel OpenAI avec debug amélioré
   */
  private async callOpenAI(
    clientData: ClientData
  ): Promise<Partial<AIAnalysisResult>> {
    try {
      // Vérifier la configuration OpenAI
      if (
        !AI_CONFIG.openai.apiKey ||
        !AI_CONFIG.openai.apiKey.startsWith("sk-")
      ) {
        throw new Error("Clé API OpenAI invalide ou manquante");
      }

      const prompt = AI_CONFIG.prompts.clientAnalysisPrompt(clientData);
      logger.info(`📝 Prompt généré (${prompt.length} caractères)`);

      const requestBody = {
        model: AI_CONFIG.openai.model,
        max_tokens: AI_CONFIG.openai.maxTokens,
        temperature: AI_CONFIG.openai.temperature,
        presence_penalty: AI_CONFIG.openai.presence_penalty,
        frequency_penalty: AI_CONFIG.openai.frequency_penalty,
        messages: [
          {
            role: "system",
            content: AI_CONFIG.prompts.systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ]
      };

      logger.info(
        `🔗 Appel OpenAI pour ${clientData.name} (model: ${requestBody.model})`
      );

      const response = await fetch(
        `${AI_CONFIG.openai.baseURL}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AI_CONFIG.openai.apiKey}`
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`❌ Erreur OpenAI ${response.status}:`, errorText);
        throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Réponse OpenAI vide");
      }

      logger.info(`📝 Réponse OpenAI reçue (${content.length} caractères)`);
      logger.debug(
        `🔍 Début réponse OpenAI:`,
        content.substring(0, 200) + "..."
      );

      // Tentative de parsing JSON
      try {
        const cleanContent = content.trim();
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          logger.info(`✅ JSON OpenAI parsé avec succès`);
          return parsed;
        } else {
          throw new Error("Aucun JSON trouvé dans la réponse");
        }
      } catch (parseError) {
        logger.warn(`⚠️ Parsing JSON échoué:`, parseError);
        return this.parseAIResponse(content);
      }
    } catch (error) {
      logger.error(`❌ Erreur appel OpenAI:`, error);
      throw error;
    }
  }

  private parseAIResponse(content: string): Partial<AIAnalysisResult> {
    logger.info(`🔧 Parsing manuel de la réponse IA`);

    const scoreMatch = content.match(/score[\":\s]*(\d+)/i);
    const categoryMatch = content.match(/category[\":\s]*[\"']([^\"']+)[\"']/i);
    const priorityMatch = content.match(/priority[\":\s]*[\"']([^\"']+)[\"']/i);

    return {
      reasoning: `Parsing manuel de la réponse IA - Score détecté: ${scoreMatch?.[1] || "N/A"}`,
      recommendations: {
        immediate: "Vérifier la réponse IA et relancer l'analyse",
        shortTerm: "Améliorer la qualité des prompts",
        longTerm: "Optimiser l'intégration OpenAI"
      }
    };
  }

  private generateLocalReasoning(
    client: ClientData,
    analysis: any,
    actualScore: number
  ): string {
    const reasons = [];
    if (client.estimatedBudget) {
      reasons.push(
        `Budget de ${client.estimatedBudget.toLocaleString("fr-FR")}€`
      );
    }
    if (client.hasWorkedWithUs) {
      reasons.push("Ancien client - relation établie");
    }
    if (client.goodForCustomer) {
      reasons.push(`Fit produit de ${client.goodForCustomer}/100`);
    }
    if (client.interactions?.length) {
      reasons.push(`${client.interactions.length} interactions enregistrées`);
    }
    return `Analyse basée sur: ${reasons.join(", ")}. Score calculé: ${actualScore}/100 (${analysis.category})`;
  }

  private generateLocalRecommendations(analysis: any) {
    return {
      immediate: analysis.recommendation?.action || "Action immédiate",
      shortTerm: analysis.recommendation?.approach || "Approche court terme",
      longTerm: analysis.recommendation?.timeframe || "Stratégie long terme"
    };
  }

  private mapPriorityToFrench(priority: string): "haute" | "moyenne" | "basse" {
    switch (priority) {
      case "high":
        return "haute";
      case "medium":
        return "moyenne";
      case "low":
        return "basse";
      default:
        return "moyenne";
    }
  }

  private generateMitigation(riskLevel: string): string {
    switch (riskLevel) {
      case "high":
        return "Intervention immédiate requise";
      case "medium":
        return "Surveillance renforcée recommandée";
      case "low":
        return "Suivi standard";
      default:
        return "Évaluation approfondie nécessaire";
    }
  }

  private generateNextSteps(analysis: any) {
    return {
      action: analysis.recommendation?.action || "Action par défaut",
      timeframe: analysis.recommendation?.timeframe || "Délai par défaut",
      responsible: "Équipe commerciale",
      success_metrics: "Amélioration du score"
    };
  }

  private generateEmergencyAnalysis(): AIAnalysisResult {
    return {
      score: 0,
      category: "révision",
      priority: "basse",
      reasoning: "Erreur système - analyse manuelle requise",
      strengths: ["À déterminer"],
      weaknesses: ["Données indisponibles"],
      recommendations: {
        immediate: "Vérifier les données client",
        shortTerm: "Relancer l'analyse",
        longTerm: "Améliorer la qualité des données"
      },
      riskAssessment: {
        level: "high",
        factors: ["Système d'analyse indisponible"],
        mitigation: "Analyse manuelle immédiate"
      },
      nextSteps: {
        action: "Révision manuelle du dossier client",
        timeframe: "Immédiat",
        responsible: "Équipe technique",
        success_metrics: "Résolution du problème système"
      }
    };
  }

  async testConnection(): Promise<{
    bddService: boolean;
    openai: boolean;
    config: boolean;
    details: {
      bddUrl?: string;
      openaiModel?: string;
      configErrors?: string[];
    };
  }> {
    try {
      logger.info(`🔍 Test complet des connexions`);

      const details: any = {};
      const configErrors: string[] = [];

      // Test BDD service
      details.bddUrl = this.baseURL;
      const bddResponse = await fetch(`${this.baseURL}/health`).catch(
        () => null
      );
      const bddService = bddResponse?.ok || false;

      // Test OpenAI
      let openai = false;
      if (
        AI_CONFIG.openai.apiKey &&
        AI_CONFIG.openai.apiKey.startsWith("sk-")
      ) {
        try {
          const testResponse = await fetch(
            `${AI_CONFIG.openai.baseURL}/models`,
            {
              headers: {
                Authorization: `Bearer ${AI_CONFIG.openai.apiKey}`
              }
            }
          );
          openai = testResponse.ok;
          details.openaiModel = AI_CONFIG.openai.model;
        } catch (error) {
          logger.warn(`⚠️ Test OpenAI échoué:`, error);
        }
      } else {
        configErrors.push("Clé API OpenAI invalide ou manquante");
      }

      // Validation configuration
      if (!config.jwt.secret) configErrors.push("JWT secret manquant");
      if (!AI_CONFIG.openai.model)
        configErrors.push("Modèle OpenAI non configuré");

      const configValid = configErrors.length === 0;
      if (configErrors.length > 0) {
        details.configErrors = configErrors;
      }

      const results = {
        bddService,
        openai,
        config: configValid,
        details
      };

      logger.info(`✅ Tests terminés:`, results);
      return results;
    } catch (error) {
      logger.error(`❌ Erreur tests connexion:`, error);
      return {
        bddService: false,
        openai: false,
        config: false,
        details: { configErrors: ["Erreur système pendant les tests"] }
      };
    }
  }
}

export const aiService = new AIService();
export { AIAnalysisResult };
