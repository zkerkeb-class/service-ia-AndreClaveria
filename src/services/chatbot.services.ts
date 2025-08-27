// src/services/chatbot.service.ts

import config from "../config";

// Types pour le chatbot
export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  metadata?: {
    navigationType?: "route" | "feature" | "action";
    suggestedRoute?: string;
    relatedPages?: string[];
  };
}

export interface NavigationContext {
  currentRoute?: string;
  userRole?: string;
  availableFeatures?: string[];
  recentActions?: string[];
}

export interface ChatbotResponse {
  message: string;
  suggestedActions?: {
    label: string;
    route: string;
    description: string;
  }[];
  navigationHelp?: {
    currentLocation: string;
    howToGet: string;
    steps: string[];
  };
  relatedFeatures?: string[];
}

// Interface pour la structure CRM mise à jour selon votre arborescence
interface CRMModule {
  route: string;
  description: string;
  features: string[];
  subPages?: Record<string, string>;
  keywords: string[]; // Mots-clés pour améliorer la recherche
}

// Structure CRM mise à jour selon votre arborescence de fichiers
const CRM_STRUCTURE: Record<string, CRMModule> = {
  dashboard: {
    route: "/dashboard",
    description: "Tableau de bord principal avec vue d'ensemble",
    features: ["Statistiques", "Graphiques", "KPI", "Activité récente"],
    keywords: [
      "tableau",
      "bord",
      "accueil",
      "dashboard",
      "statistiques",
      "overview",
      "vue",
      "ensemble"
    ]
  },

  // Module Pipeline (contient clients, contacts, opportunities)
  pipeline: {
    route: "/dashboard/pipeline",
    description: "Pipeline commercial - Vue d'ensemble du processus de vente",
    features: ["Kanban", "Étapes", "Progression", "Prévisions"],
    keywords: ["pipeline", "entonnoir", "processus", "vente", "commercial"]
  },

  clients: {
    route: "/dashboard/pipeline/clients",
    description: "Gestion des clients et prospects",
    features: [
      "Liste clients",
      "Ajouter client",
      "Modifier client",
      "Historique"
    ],
    subPages: {
      list: "/dashboard/pipeline/clients",
      add: "/dashboard/pipeline/clients/add",
      edit: "/dashboard/pipeline/clients/edit/[id]",
      view: "/dashboard/pipeline/clients/[id]"
    },
    keywords: [
      "client",
      "clients",
      "prospect",
      "prospects",
      "entreprise",
      "société",
      "customer"
    ]
  },

  contacts: {
    route: "/dashboard/pipeline/contacts",
    description: "Gestion des contacts personnels",
    features: ["Annuaire", "Ajouter contact", "Groupes", "Communication"],
    subPages: {
      list: "/dashboard/pipeline/contacts",
      add: "/dashboard/pipeline/contacts/add",
      edit: "/dashboard/pipeline/contacts/edit/[id]"
    },
    keywords: [
      "contact",
      "contacts",
      "personne",
      "personnes",
      "annuaire",
      "répertoire"
    ]
  },

  opportunities: {
    route: "/dashboard/pipeline/opportunities",
    description: "Gestion des opportunités commerciales",
    features: ["Deals", "Suivi ventes", "Prévisions", "Conversion"],
    subPages: {
      list: "/dashboard/pipeline/opportunities",
      add: "/dashboard/pipeline/opportunities/add",
      edit: "/dashboard/pipeline/opportunities/edit/[id]"
    },
    keywords: [
      "opportunité",
      "opportunités",
      "deal",
      "deals",
      "vente",
      "ventes",
      "affaire",
      "affaires"
    ]
  },

  // Autres modules
  health: {
    route: "/dashboard/health",
    description: "Santé et monitoring du système",
    features: ["Monitoring", "Alertes", "Performance", "Logs"],
    keywords: ["santé", "health", "monitoring", "performance", "système"]
  },

  mail: {
    route: "/dashboard/mail",
    description: "Centre de messagerie intégré",
    features: ["Emails", "Templates", "Campagnes", "Suivi ouvertures"],
    keywords: [
      "email",
      "emails",
      "mail",
      "mails",
      "message",
      "messagerie",
      "courrier"
    ]
  },

  metrics: {
    route: "/dashboard/metrics",
    description: "Métriques et analytics",
    features: ["KPI", "Rapports", "Analytics", "Tableaux de bord"],
    keywords: [
      "métrique",
      "métriques",
      "analytics",
      "rapport",
      "rapports",
      "kpi",
      "performance"
    ]
  },

  user: {
    route: "/dashboard/user",
    description: "Gestion utilisateur et profil",
    features: ["Profil", "Préférences", "Sécurité", "Notifications"],
    keywords: [
      "utilisateur",
      "user",
      "profil",
      "compte",
      "paramètres",
      "préférences"
    ]
  },

  stripe: {
    route: "/dashboard/stripe",
    description: "Intégration et gestion Stripe",
    features: ["Paiements", "Abonnements", "Facturation", "Webhooks"],
    keywords: [
      "stripe",
      "paiement",
      "paiements",
      "facturation",
      "abonnement",
      "billing"
    ]
  },

  // Pages d'authentification
  auth: {
    route: "/auth",
    description: "Authentification et gestion de compte",
    features: ["Connexion", "Inscription", "Mot de passe", "Profil"],
    subPages: {
      login: "/auth/login",
      register: "/auth/register",
      forgot: "/auth/forgot-password",
      reset: "/auth/reset-password"
    },
    keywords: [
      "connexion",
      "login",
      "mot de passe",
      "password",
      "compte",
      "auth",
      "authentification"
    ]
  },

  // Autres pages
  components: {
    route: "/components",
    description: "Bibliothèque de composants UI",
    features: ["Composants", "UI", "Design System", "Documentation"],
    keywords: ["composant", "composants", "ui", "interface", "design"]
  },

  contexts: {
    route: "/contexts",
    description: "Gestion des contextes React",
    features: ["Contexts", "State", "Providers"],
    keywords: ["context", "contexts", "état", "state"]
  }
};

// Prompts optimisés pour une navigation précise
const CHATBOT_PROMPTS = {
  systemPrompt: `Tu es un assistant virtuel expert pour la navigation dans un CRM moderne.

MISSION PRINCIPALE :
- Aider l'utilisateur à trouver rapidement la bonne page/fonctionnalité
- Fournir des liens de navigation précis et directs
- Guider étape par étape si nécessaire

STRUCTURE CRM DISPONIBLE :
${Object.entries(CRM_STRUCTURE)
  .map(([key, module]) => `- ${key}: ${module.route} (${module.description})`)
  .join("\n")}

RÈGLES DE RÉPONSE :
1. TOUJOURS fournir un lien direct (href) vers la page demandée
2. Être concis et aller droit au but
3. Suggérer des alternatives pertinentes
4. Expliquer brièvement ce qu'on trouve sur la page
5. Répondre en français de manière naturelle

FORMAT DE RÉPONSE :
- Message clair avec explication
- Lien direct href vers la page
- Actions suggérées si pertinentes`,

  navigationPrompt: (userQuestion: string, context: NavigationContext) => {
    return `
DEMANDE UTILISATEUR : "${userQuestion}"

CONTEXTE :
- Page actuelle : ${context.currentRoute || "Non spécifiée"}
- Actions récentes : ${context.recentActions?.join(", ") || "Aucune"}

STRUCTURE DISPONIBLE :
${JSON.stringify(CRM_STRUCTURE, null, 2)}

TÂCHE :
1. Identifier ce que l'utilisateur cherche
2. Trouver la route exacte correspondante
3. Fournir une réponse JSON avec le format suivant :

{
  "message": "Explication claire avec le lien direct",
  "suggestedActions": [
    {
      "label": "Nom de l'action",
      "route": "/route/exacte",
      "description": "Ce qu'on trouve sur cette page"
    }
  ],
  "navigationHelp": {
    "currentLocation": "Où vous êtes actuellement",
    "howToGet": "Instructions pour y aller",
    "steps": ["Étape 1", "Étape 2"]
  },
  "relatedFeatures": ["Fonctionnalité connexe 1", "Fonctionnalité connexe 2"]
}

Analyse la demande et fournis une réponse JSON structurée.`;
  }
};

class ChatbotService {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor() {
    this.apiKey = config.openai.apiKey;
    this.baseURL = "https://api.openai.com/v1";
    this.model = "gpt-3.5-turbo";
  }

  // Fonction principale d'analyse - Version améliorée
  async analyzeUserQuery(
    question: string,
    context: NavigationContext = {}
  ): Promise<ChatbotResponse> {
    try {
      // Recherche rapide par mots-clés avant l'appel IA
      const quickMatch = this.quickKeywordSearch(question);

      if (quickMatch) {
        return this.createDirectResponse(quickMatch, question);
      }

      // Si pas de correspondance directe, utiliser l'IA
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: CHATBOT_PROMPTS.systemPrompt
            },
            {
              role: "user",
              content: CHATBOT_PROMPTS.navigationPrompt(question, context)
            }
          ],
          temperature: 0.2, // Plus déterministe pour la navigation
          max_tokens: 600,
          presence_penalty: 0.1,
          frequency_penalty: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      // Parser la réponse JSON de l'IA
      let parsedResponse: ChatbotResponse;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (parseError) {
        // Fallback avec recherche approximative
        const fuzzyMatch = this.fuzzySearch(question);
        parsedResponse = fuzzyMatch || this.getFallbackResponse(question);
      }

      return parsedResponse;
    } catch (error) {
      console.error("Erreur dans analyzeUserQuery:", error);
      return this.getFallbackResponse(question);
    }
  }

  // Recherche rapide par mots-clés exacts
  private quickKeywordSearch(
    question: string
  ): { key: string; module: CRMModule } | null {
    const normalizedQuestion = question.toLowerCase();

    // Recherche directe dans les noms de modules
    for (const [key, module] of Object.entries(CRM_STRUCTURE)) {
      if (normalizedQuestion.includes(key)) {
        return { key, module };
      }

      // Recherche dans les mots-clés
      if (
        module.keywords.some((keyword) => normalizedQuestion.includes(keyword))
      ) {
        return { key, module };
      }
    }

    return null;
  }

  // Créer une réponse directe pour les correspondances rapides
  private createDirectResponse(
    match: { key: string; module: CRMModule },
    question: string
  ): ChatbotResponse {
    return {
      message: `Pour "${question}", je vous dirige vers **${match.key}** : ${match.module.description}`,
      suggestedActions: [
        {
          label: `Aller à ${match.key}`,
          route: match.module.route,
          description: match.module.description
        },
        ...(match.module.subPages
          ? Object.entries(match.module.subPages)
              .slice(0, 2)
              .map(([action, route]) => ({
                label: `${action.charAt(0).toUpperCase()}${action.slice(1)} ${match.key}`,
                route: route,
                description: `${action} dans la section ${match.key}`
              }))
          : [])
      ],
      navigationHelp: {
        currentLocation: "Assistant de navigation",
        howToGet: `Cliquez sur le lien : ${match.module.route}`,
        steps: [
          `Cliquer sur "${match.key}"`,
          "Explorer les fonctionnalités disponibles"
        ]
      },
      relatedFeatures: match.module.features.slice(0, 3)
    };
  }

  // Recherche approximative (fuzzy search)
  private fuzzySearch(question: string): ChatbotResponse | null {
    const normalizedQuestion = question.toLowerCase();
    const matches: Array<{ key: string; module: CRMModule; score: number }> =
      [];

    for (const [key, module] of Object.entries(CRM_STRUCTURE)) {
      let score = 0;

      // Score basé sur les mots-clés
      module.keywords.forEach((keyword) => {
        if (normalizedQuestion.includes(keyword)) {
          score += keyword.length; // Plus le mot-clé est long, plus le score est élevé
        }
      });

      // Score basé sur la description
      const descWords = module.description.toLowerCase().split(" ");
      descWords.forEach((word) => {
        if (word.length > 3 && normalizedQuestion.includes(word)) {
          score += 2;
        }
      });

      if (score > 0) {
        matches.push({ key, module, score });
      }
    }

    if (matches.length > 0) {
      // Trier par score décroissant
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];

      return this.createDirectResponse(bestMatch, question);
    }

    return null;
  }

  // Amélioration de la recherche de fonctionnalités
  async searchFeatures(searchTerm: string): Promise<ChatbotResponse> {
    const results: Array<{
      module: string;
      route: string;
      description: string;
      relevance: "high" | "medium" | "low";
      score: number;
    }> = [];

    const lowerSearchTerm = searchTerm.toLowerCase();

    Object.entries(CRM_STRUCTURE).forEach(([key, module]) => {
      let score = 0;
      let relevance: "high" | "medium" | "low" = "low";

      // Recherche dans le nom du module (score le plus élevé)
      if (key.toLowerCase().includes(lowerSearchTerm)) {
        score += 10;
        relevance = "high";
      }

      // Recherche dans les mots-clés
      module.keywords.forEach((keyword) => {
        if (keyword.includes(lowerSearchTerm)) {
          score += 8;
          if (relevance === "low") relevance = "high";
        }
      });

      // Recherche dans la description
      if (module.description.toLowerCase().includes(lowerSearchTerm)) {
        score += 5;
        if (relevance === "low") relevance = "medium";
      }

      // Recherche dans les fonctionnalités
      module.features.forEach((feature) => {
        if (feature.toLowerCase().includes(lowerSearchTerm)) {
          score += 3;
          if (relevance === "low") relevance = "medium";
        }
      });

      if (score > 0) {
        results.push({
          module: key,
          route: module.route,
          description: module.description,
          relevance,
          score
        });
      }
    });

    // Trier par score décroissant
    results.sort((a, b) => b.score - a.score);

    if (results.length > 0) {
      const topResults = results.slice(0, 5);

      return {
        message: `J'ai trouvé ${results.length} résultat(s) pour "${searchTerm}". Voici les plus pertinents :`,
        suggestedActions: topResults.map((result) => ({
          label: result.module.charAt(0).toUpperCase() + result.module.slice(1),
          route: result.route,
          description: result.description
        })),
        navigationHelp: {
          currentLocation: "Résultats de recherche",
          howToGet: "Cliquez sur l'un des résultats ci-dessus",
          steps: [
            "Choisissez le résultat le plus pertinent",
            "Cliquez pour naviguer directement",
            "Explorez les fonctionnalités disponibles"
          ]
        },
        relatedFeatures: topResults.slice(0, 3).map((r) => r.module)
      };
    }

    // Suggestions alternatives si aucun résultat
    return {
      message: `Aucun résultat pour "${searchTerm}". Voulez-vous explorer ces sections populaires ?`,
      suggestedActions: [
        {
          label: "Pipeline Commercial",
          route: "/dashboard/pipeline",
          description: "Clients, contacts et opportunités"
        },
        {
          label: "Tableau de bord",
          route: "/dashboard",
          description: "Vue d'ensemble de votre activité"
        },
        {
          label: "Messagerie",
          route: "/dashboard/mail",
          description: "Centre de communication"
        }
      ],
      navigationHelp: {
        currentLocation: "Recherche",
        howToGet: "Essayez des termes plus généraux",
        steps: [
          "Utilisez des mots simples comme 'client', 'vente', 'contact'",
          "Ou naviguez via le menu principal",
          "Consultez le tableau de bord pour une vue d'ensemble"
        ]
      }
    };
  }

  // Réponse de fallback améliorée
  private getFallbackResponse(question: string): ChatbotResponse {
    return {
      message: `Je n'ai pas trouvé de correspondance exacte pour "${question}". Voici les principales sections de votre CRM :`,
      suggestedActions: [
        {
          label: "Pipeline Commercial",
          route: "/dashboard/pipeline",
          description: "Clients, contacts et opportunités"
        },
        {
          label: "Tableau de bord",
          route: "/dashboard",
          description: "Vue d'ensemble et statistiques"
        },
        {
          label: "Messagerie",
          route: "/dashboard/mail",
          description: "Communication et emails"
        },
        {
          label: "Métriques",
          route: "/dashboard/metrics",
          description: "Analytics et rapports"
        }
      ],
      navigationHelp: {
        currentLocation: "Assistant CRM",
        howToGet: "Choisissez une section dans la liste",
        steps: [
          "Cliquez sur la section qui vous intéresse",
          "Utilisez le menu de navigation une fois sur la page",
          "Reformulez votre question si nécessaire"
        ]
      },
      relatedFeatures: ["Navigation", "Recherche", "Support", "Menu principal"]
    };
  }

  // Aide contextuelle basée sur la route actuelle
  async getContextualHelp(currentRoute: string): Promise<ChatbotResponse> {
    const moduleKey = this.getModuleFromRoute(currentRoute);

    if (moduleKey) {
      const module = CRM_STRUCTURE[moduleKey];

      return {
        message: `Vous êtes dans la section **${moduleKey}**. ${module.description}`,
        suggestedActions: this.getModuleActions(moduleKey, module),
        navigationHelp: {
          currentLocation: module.description,
          howToGet: `Vous y êtes ! (${module.route})`,
          steps: [
            "Explorez les fonctionnalités disponibles",
            "Utilisez la navigation locale",
            "Consultez les sous-sections"
          ]
        },
        relatedFeatures: module.features
      };
    }

    return this.getFallbackResponse("aide contextuelle");
  }

  // Identifier le module depuis la route
  private getModuleFromRoute(route: string): string | null {
    // Recherche exacte d'abord
    for (const [key, module] of Object.entries(CRM_STRUCTURE)) {
      if (route === module.route || route.startsWith(module.route + "/")) {
        return key;
      }
    }

    // Recherche approximative
    for (const [key, module] of Object.entries(CRM_STRUCTURE)) {
      if (route.includes(key)) {
        return key;
      }
    }

    return null;
  }

  // Actions disponibles pour un module
  private getModuleActions(
    moduleKey: string,
    module: CRMModule
  ): Array<{ label: string; route: string; description: string }> {
    const actions = [
      {
        label: `Accueil ${moduleKey}`,
        route: module.route,
        description: module.description
      }
    ];

    // Ajouter les sous-pages
    if (module.subPages) {
      Object.entries(module.subPages).forEach(([action, route]) => {
        actions.push({
          label: `${action.charAt(0).toUpperCase() + action.slice(1)}`,
          route: route,
          description: `${action} - ${moduleKey}`
        });
      });
    }

    return actions.slice(0, 4); // Limiter à 4 actions
  }
}

export default new ChatbotService();
