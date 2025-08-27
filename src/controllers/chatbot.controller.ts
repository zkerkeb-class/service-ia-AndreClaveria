// src/controllers/chatbot.controller.ts

import { Request, Response } from "express";
import chatbotService, {
  ChatMessage,
  NavigationContext,
  ChatbotResponse
} from "../services/chatbot.services";
import { v4 as uuidv4 } from "uuid";

// Interface pour les requêtes du chatbot
interface ChatRequest extends Request {
  body: {
    message: string;
    sessionId?: string;
    context?: NavigationContext;
    conversationHistory?: ChatMessage[];
  };
}

interface ContextualHelpRequest extends Request {
  body: {
    currentRoute: string;
    userRole?: string;
    sessionId?: string;
  };
}

interface SearchRequest extends Request {
  body: {
    searchTerm: string;
    sessionId?: string;
  };
}

// Stockage temporaire des sessions (en production, utilisez Redis)
const chatSessions = new Map<
  string,
  {
    id: string;
    messages: ChatMessage[];
    context: NavigationContext;
    lastActivity: Date;
  }
>();

class ChatbotController {
  // Endpoint principal pour les conversations
  async chat(req: ChatRequest, res: Response) {
    try {
      const {
        message,
        sessionId,
        context = {},
        conversationHistory = []
      } = req.body;

      // Validation des données
      if (
        !message ||
        typeof message !== "string" ||
        message.trim().length === 0
      ) {
        return res.status(400).json({
          error: "Message requis",
          code: "INVALID_MESSAGE"
        });
      }

      // Gestion de la session
      const currentSessionId = sessionId || uuidv4();
      let session = chatSessions.get(currentSessionId);

      if (!session) {
        session = {
          id: currentSessionId,
          messages: [],
          context: context,
          lastActivity: new Date()
        };
        chatSessions.set(currentSessionId, session);
      }

      // Ajouter le message utilisateur à l'historique
      const userMessage: ChatMessage = {
        id: uuidv4(),
        content: message.trim(),
        role: "user",
        timestamp: new Date()
      };

      session.messages.push(userMessage);
      session.lastActivity = new Date();

      // Mettre à jour le contexte si fourni
      if (context && Object.keys(context).length > 0) {
        session.context = { ...session.context, ...context };
      }

      console.log(`[CHATBOT] Session ${currentSessionId}: "${message}"`);
      console.log(`[CHATBOT] Context:`, session.context);

      // Analyser la question avec le service
      const response = await chatbotService.analyzeUserQuery(
        message,
        session.context
      );

      // Créer la réponse de l'assistant
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        content: response.message,
        role: "assistant",
        timestamp: new Date(),
        metadata: {
          navigationType: response.suggestedActions?.length
            ? "route"
            : "feature",
          suggestedRoute: response.suggestedActions?.[0]?.route,
          relatedPages:
            response.suggestedActions?.map((action) => action.route) || []
        }
      };

      session.messages.push(assistantMessage);

      // Nettoyer les sessions anciennes (plus de 1 heure d'inactivité)
      this.cleanupOldSessions();

      // Réponse formatée
      const chatResponse = {
        sessionId: currentSessionId,
        response: response,
        conversation: {
          lastMessage: assistantMessage,
          messageCount: session.messages.length,
          context: session.context
        },
        metadata: {
          timestamp: new Date(),
          processingTime: Date.now() - userMessage.timestamp.getTime()
        }
      };

      console.log(`[CHATBOT] Response sent for session ${currentSessionId}`);

      res.status(200).json(chatResponse);
    } catch (error) {
      console.error("[CHATBOT] Erreur dans chat():", error);

      res.status(500).json({
        error: "Erreur lors du traitement de votre demande",
        code: "CHAT_ERROR",
        details: process.env.NODE_ENV === "development" ? error : undefined
      });
    }
  }

  // Aide contextuelle basée sur la route actuelle
  async getContextualHelp(req: ContextualHelpRequest, res: Response) {
    try {
      const { currentRoute, userRole, sessionId } = req.body;

      if (!currentRoute || typeof currentRoute !== "string") {
        return res.status(400).json({
          error: "Route actuelle requise",
          code: "INVALID_ROUTE"
        });
      }

      console.log(`[CHATBOT] Aide contextuelle pour route: ${currentRoute}`);

      const response = await chatbotService.getContextualHelp(currentRoute);

      // Mettre à jour le contexte de session si elle existe
      if (sessionId && chatSessions.has(sessionId)) {
        const session = chatSessions.get(sessionId)!;
        session.context.currentRoute = currentRoute;
        if (userRole) session.context.userRole = userRole;
        session.lastActivity = new Date();
      }

      res.status(200).json({
        route: currentRoute,
        help: response,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("[CHATBOT] Erreur dans getContextualHelp():", error);

      res.status(500).json({
        error: "Erreur lors de la récupération de l'aide contextuelle",
        code: "CONTEXTUAL_HELP_ERROR"
      });
    }
  }

  // Recherche de fonctionnalités
  async searchFeatures(req: SearchRequest, res: Response) {
    try {
      const { searchTerm, sessionId } = req.body;

      if (
        !searchTerm ||
        typeof searchTerm !== "string" ||
        searchTerm.trim().length === 0
      ) {
        return res.status(400).json({
          error: "Terme de recherche requis",
          code: "INVALID_SEARCH_TERM"
        });
      }

      console.log(`[CHATBOT] Recherche: "${searchTerm}"`);

      const response = await chatbotService.searchFeatures(searchTerm.trim());

      // Enregistrer la recherche dans la session si elle existe
      if (sessionId && chatSessions.has(sessionId)) {
        const session = chatSessions.get(sessionId)!;
        if (!session.context.recentActions) {
          session.context.recentActions = [];
        }
        session.context.recentActions.unshift(`Recherche: ${searchTerm}`);
        session.context.recentActions = session.context.recentActions.slice(
          0,
          5
        );
        session.lastActivity = new Date();
      }

      res.status(200).json({
        searchTerm,
        results: response,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("[CHATBOT] Erreur dans searchFeatures():", error);

      res.status(500).json({
        error: "Erreur lors de la recherche",
        code: "SEARCH_ERROR"
      });
    }
  }

  // Obtenir l'historique d'une session
  async getConversationHistory(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;

      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({
          error: "ID de session requis",
          code: "INVALID_SESSION_ID"
        });
      }

      const session = chatSessions.get(sessionId);

      if (!session) {
        return res.status(404).json({
          error: "Session non trouvée",
          code: "SESSION_NOT_FOUND"
        });
      }

      res.status(200).json({
        sessionId,
        messages: session.messages,
        context: session.context,
        lastActivity: session.lastActivity,
        messageCount: session.messages.length
      });
    } catch (error) {
      console.error("[CHATBOT] Erreur dans getConversationHistory():", error);

      res.status(500).json({
        error: "Erreur lors de la récupération de l'historique",
        code: "HISTORY_ERROR"
      });
    }
  }

  // Réinitialiser une session
  async resetSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;

      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({
          error: "ID de session requis",
          code: "INVALID_SESSION_ID"
        });
      }

      const session = chatSessions.get(sessionId);

      if (!session) {
        return res.status(404).json({
          error: "Session non trouvée",
          code: "SESSION_NOT_FOUND"
        });
      }

      // Réinitialiser la session
      session.messages = [];
      session.context = {};
      session.lastActivity = new Date();

      console.log(`[CHATBOT] Session ${sessionId} réinitialisée`);

      res.status(200).json({
        message: "Session réinitialisée avec succès",
        sessionId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("[CHATBOT] Erreur dans resetSession():", error);

      res.status(500).json({
        error: "Erreur lors de la réinitialisation de la session",
        code: "RESET_ERROR"
      });
    }
  }

  // Obtenir les statistiques du chatbot
  async getStats(req: Request, res: Response) {
    try {
      const now = new Date();
      const activeSessions = Array.from(chatSessions.values()).filter(
        (session) => now.getTime() - session.lastActivity.getTime() < 3600000 // 1 heure
      );

      const totalMessages = Array.from(chatSessions.values()).reduce(
        (total, session) => total + session.messages.length,
        0
      );

      const stats = {
        totalSessions: chatSessions.size,
        activeSessions: activeSessions.length,
        totalMessages,
        averageMessagesPerSession:
          chatSessions.size > 0
            ? Math.round(totalMessages / chatSessions.size)
            : 0,
        timestamp: new Date()
      };

      res.status(200).json(stats);
    } catch (error) {
      console.error("[CHATBOT] Erreur dans getStats():", error);

      res.status(500).json({
        error: "Erreur lors de la récupération des statistiques",
        code: "STATS_ERROR"
      });
    }
  }

  // Obtenir la structure CRM disponible
  async getCRMStructure(req: Request, res: Response) {
    try {
      // Importer la structure depuis le service
      const structure = {
        modules: {
          dashboard: {
            name: "Tableau de bord",
            route: "/dashboard",
            description: "Vue d'ensemble de votre activité",
            features: ["Statistiques", "Graphiques", "KPI", "Activité récente"]
          },
          clients: {
            name: "Clients",
            route: "/dashboard/clients",
            description: "Gestion des clients et prospects",
            features: [
              "Liste clients",
              "Ajouter client",
              "Modifier client",
              "Historique"
            ],
            subRoutes: {
              list: "/dashboard/clients",
              add: "/dashboard/clients/add",
              edit: "/dashboard/clients/edit/[id]"
            }
          },
          opportunities: {
            name: "Opportunités",
            route: "/dashboard/opportunities",
            description: "Gestion des opportunités commerciales",
            features: ["Pipeline", "Suivi deals", "Prévisions", "Conversion"]
          },
          contacts: {
            name: "Contacts",
            route: "/dashboard/contacts",
            description: "Gestion des contacts",
            features: [
              "Annuaire",
              "Ajouter contact",
              "Groupes",
              "Communication"
            ]
          },
          pipeline: {
            name: "Pipeline",
            route: "/dashboard/pipeline",
            description: "Visualisation du pipeline commercial",
            features: ["Kanban", "Étapes", "Progression", "Prévisions"]
          },
          mail: {
            name: "Messagerie",
            route: "/dashboard/mail",
            description: "Centre de messagerie intégré",
            features: ["Emails", "Templates", "Campagnes", "Suivi ouvertures"]
          }
        },
        navigation: {
          main: "/dashboard",
          auth: "/auth",
          settings: "/settings"
        }
      };

      res.status(200).json({
        structure,
        timestamp: new Date(),
        version: "1.0.0"
      });
    } catch (error) {
      console.error("[CHATBOT] Erreur dans getCRMStructure():", error);

      res.status(500).json({
        error: "Erreur lors de la récupération de la structure CRM",
        code: "STRUCTURE_ERROR"
      });
    }
  }

  // Nettoyer les sessions anciennes
  private cleanupOldSessions() {
    const now = new Date();
    const maxAge = 3600000; // 1 heure en millisecondes

    for (const [sessionId, session] of chatSessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > maxAge) {
        chatSessions.delete(sessionId);
        console.log(`[CHATBOT] Session expirée supprimée: ${sessionId}`);
      }
    }
  }

  // Health check pour le service chatbot
  async healthCheck(req: Request, res: Response) {
    try {
      const now = new Date();
      const activeSessions = Array.from(chatSessions.values()).filter(
        (session) => now.getTime() - session.lastActivity.getTime() < 3600000
      );

      const healthStatus = {
        status: "healthy",
        service: "chatbot",
        timestamp: now,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeSessions: activeSessions.length,
        totalSessions: chatSessions.size,
        openaiConnection: "ok", // À améliorer avec un vrai test
        version: "1.0.0"
      };

      res.status(200).json(healthStatus);
    } catch (error) {
      console.error("[CHATBOT] Erreur dans healthCheck():", error);

      res.status(503).json({
        status: "unhealthy",
        service: "chatbot",
        error: "Service indisponible",
        timestamp: new Date()
      });
    }
  }
}

export default new ChatbotController();
