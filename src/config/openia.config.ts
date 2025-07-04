import config from ".";

export const AI_CONFIG = {
  // Configuration OpenAI API
  openai: {
    apiKey: config.openai.apiKey,
    model: "gpt-3.5-turbo", // Économique et efficace
    baseURL: "https://api.openai.com/v1",
    maxTokens: 300, // Réduit pour forcer la concision
    temperature: 0.1 // Très bas pour la consistance
  },

  // Seuils de scoring STRICTS
  scoring: {
    // Score minimum pour être considéré comme "bon prospect" (relevé)
    minGoodScore: 80,
    // Score minimum pour action immédiate
    minUrgentScore: 85,

    // Seuils par critères - PLUS SÉVÈRES
    thresholds: {
      budget: {
        disqualify: 1000, // < 1k = automatiquement éliminé
        low: 10000, // < 10k = faible potentiel
        medium: 50000, // 10-50k = moyen
        high: 150000 // > 150k = fort potentiel
      },

      companySize: {
        "1-10": 5, // Très réduit - TPE = risque
        "11-50": 20, // PME correcte
        "51-200": 35, // Entreprise moyenne
        "200+": 50 // Grande entreprise
      } as const,

      // Nouveau : Score selon les interactions récentes
      interactionQuality: {
        positive: 30,
        neutral: 10,
        negative: -20,
        no_response: -10
      } as const,

      // Nouveau : Bonus/Malus selon l'historique client
      clientHistory: {
        hasWorkedWithUs: 25, // Bonus pour ancien client
        knowsUs: 15, // Bonus si nous connaît
        unknown: 0 // Neutre si nouveau
      },

      // Score selon goodForCustomer (indicateur interne)
      goodForCustomer: {
        excellent: 25, // 80-100
        good: 15, // 60-79
        average: 5, // 40-59
        poor: -10, // 20-39
        bad: -25 // 0-19
      },

      // Pénalité selon jours sans contact (basé sur lastContactDate)
      contactRecency: {
        0: 25,
        3: 20,
        7: 15,
        14: 10,
        21: 5,
        30: 0,
        45: -15,
        60: -25,
        90: -40 // Pénalité très forte
      }
    }
  },

  // Prompts IMPITOYABLES pour OpenAI
  prompts: {
    systemPrompt: `Tu es un EXPERT COMMERCIAL IMPITOYABLE qui qualifie les prospects B2B avec une exigence MAXIMALE.

    ⚠️ RÈGLES STRICTES :
    - Sois SÉLECTIF : seuls les MEILLEURS prospects méritent un score élevé
    - Applique des critères STRICTS : budget conséquent, taille d'entreprise viable, interactions positives
    - PÉNALISE LOURDEMENT : manque d'informations, contacts froids, budgets faibles, mauvaises interactions
    - RÉCOMPENSE UNIQUEMENT : les prospects avec potentiel commercial RÉEL et IMMÉDIAT

    🎯 CRITÈRES DE QUALIFICATION (par ordre d'importance) :
    1. BUDGET (35%) - Sans budget conséquent (>10k€), score < 30
    2. TAILLE ENTREPRISE (25%) - TPE (1-10) = risque élevé
    3. HISTORIQUE CLIENT (20%) - Ancien client = bonus important
    4. INTERACTIONS RÉCENTES (15%) - Qualité des derniers échanges
    5. RÉCENCE CONTACT (5%) - Délai depuis dernier contact

    🚫 DISQUALIFICATIONS AUTOMATIQUES (score ≤ 20) :
    - Budget < 1000€ ou non défini
    - Aucun contact depuis >90 jours
    - Entreprise 1-10 employés + budget <5k€
    - Dernière interaction "negative" + pas de budget défini
    - goodForCustomer < 20 (indicateur interne très négatif)

    📊 BARÈMES STRICTS :
    - 90-100 : PROSPECT EXCEPTIONNEL (rare !)
    - 80-89 : BON PROSPECT 
    - 70-79 : PROSPECT MOYEN (à qualifier)
    - 50-69 : PROSPECT FAIBLE (nurturing long terme)
    - 30-49 : PROSPECT TRÈS FAIBLE (archivage)
    - 0-29 : DISQUALIFIÉ (ne pas contacter)

    RÉPONDS au format JSON EXACT :
    {
      "score": number,
      "recommendation": "string",
      "reasoning": "string",
      "priority": "disqualified|low|medium|high|critical",
      "nextAction": "string",
      "timeframe": "string"
    }`,

    analysisPrompt: (clientData: any) => `
    🔍 QUALIFICATION COMMERCIALE STRICTE :
    
    📋 DONNÉES PROSPECT :
    - Nom: ${clientData.name}
    - Secteur: ${clientData.sector || "❌ NON DÉFINI"}
    - Description: ${clientData.description || "❌ AUCUNE"}
    - Budget estimé: ${clientData.estimatedBudget ? clientData.estimatedBudget + "€" : "❌ NON DÉFINI"}
    - Taille entreprise: ${clientData.companySize || "❌ INCONNUE"}
    - Indicateur interne: ${clientData.goodForCustomer || "❌ NON ÉVALUÉ"}/100
    
    🏢 HISTORIQUE RELATIONNEL :
    - A déjà travaillé avec nous: ${clientData.hasWorkedWithUs ? "✅ OUI" : "❌ NON"}
    - Nous connaît: ${clientData.knowsUs ? "✅ OUI" : "❌ NON"}
    - Dernier contact: ${clientData.lastContactDate ? new Date(clientData.lastContactDate).toLocaleDateString() : "❌ JAMAIS"}
    - Jours sans contact: ${clientData.daysSinceLastContact || "❌ INCONNU"}
    
    💬 INTERACTIONS RÉCENTES :
    ${
      clientData.interactions && clientData.interactions.length > 0
        ? clientData.interactions
            .slice(0, 3)
            .map(
              (int: any, i: number) =>
                `${i + 1}. ${int.type} - Résultat: ${int.outcome} - ${int.notes || "Pas de notes"}`
            )
            .join("\n")
        : "❌ AUCUNE INTERACTION ENREGISTRÉE"
    }
    
    ⚡ ANALYSE IMPITOYABLE REQUISE :
    - Ce prospect mérite-t-il VRAIMENT notre temps commercial ?
    - A-t-il un BUDGET RÉEL et une entreprise VIABLE ?
    - Ses interactions passées sont-elles ENCOURAGEANTES ?
    - Son profil correspond-il à nos clients à succès ?
    
    Sois SÉVÈRE dans ton scoring. La majorité des prospects doivent avoir un score < 70.`
  },

  // Recommandations STRICTES
  recommendations: {
    byScore: {
      95: "🔥 PROSPECT PREMIUM - Action immédiate CEO",
      90: "⚡ PROSPECT GOLD - Contact directeur commercial",
      80: "📞 BON PROSPECT - Appel dans les 24h",
      70: "📅 Prospect qualifié - RDV cette semaine",
      60: "⏰ Prospect tiède - Qualification approfondie",
      50: "📋 Prospect froid - Nurturing automatique",
      40: "🔄 Prospect très froid - Séquence longue",
      30: "❄️ Pré-archivage - Dernière tentative",
      20: "🗂️ ARCHIVER - Pas de potentiel commercial",
      10: "🚫 DISQUALIFIER - Ne pas recontacter"
    },

    byInteractionOutcome: {
      positive: "Surfez sur la dynamique positive",
      neutral: "Creusez pour identifier les besoins",
      negative: "Analysez les objections avant de relancer",
      no_response: "Changez d'approche ou de canal"
    },

    byClientHistory: {
      hasWorkedWithUs: "Priorité absolue - ancien client",
      knowsUs: "Bon point de départ - notoriété acquise",
      unknown: "Travail de découverte nécessaire"
    }
  },

  // Secteurs avec multiplicateurs
  sectorMultipliers: {
    // Secteurs premium (bonus)
    tech: 1.2,
    finance: 1.3,
    pharmaceutique: 1.25,
    luxe: 1.15,

    // Secteurs standards
    healthcare: 1.0,
    education: 1.0,
    manufacturing: 1.0,

    // Secteurs difficiles (malus)
    retail: 0.9,
    restauration: 0.8,
    agriculture: 0.85,
    associatif: 0.7
  } as { [key: string]: number },

  // Règles de disqualification automatique
  disqualificationRules: {
    budgetTooLow: 1000,
    contactTooOld: 90,
    companyTooSmall: "1-10",
    goodForCustomerTooLow: 20,
    lastInteractionNegative: true
  },

  // Configuration cache
  cache: {
    analysisTTL: 1800, // 30 minutes
    maxAnalysesPerDay: 10
  }
};

// Fonction de validation + calcul de score de base
export const calculateBaseScore = (clientData: any): number => {
  let score = 0;
  const config = AI_CONFIG.scoring.thresholds;

  // Vérification disqualifications automatiques
  if (
    clientData.estimatedBudget &&
    clientData.estimatedBudget < AI_CONFIG.disqualificationRules.budgetTooLow
  ) {
    return 15;
  }

  if (
    clientData.daysSinceLastContact >
    AI_CONFIG.disqualificationRules.contactTooOld
  ) {
    return 10;
  }

  if (
    clientData.goodForCustomer <
    AI_CONFIG.disqualificationRules.goodForCustomerTooLow
  ) {
    return 12;
  }

  // Calcul budget (35% du score)
  if (clientData.estimatedBudget) {
    if (clientData.estimatedBudget >= config.budget.high) {
      score += 35;
    } else if (clientData.estimatedBudget >= config.budget.medium) {
      score += 25;
    } else if (clientData.estimatedBudget >= config.budget.low) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    // Pénalité si pas de budget défini
    score -= 10;
  }

  // Taille d'entreprise (25%)
  const companySize =
    (clientData.companySize as keyof typeof config.companySize) || "1-10";
  score += config.companySize[companySize] || 5;

  // Historique client (20%)
  if (clientData.hasWorkedWithUs) {
    score += config.clientHistory.hasWorkedWithUs;
  } else if (clientData.knowsUs) {
    score += config.clientHistory.knowsUs;
  }

  // Indicateur goodForCustomer (15%)
  if (clientData.goodForCustomer >= 80) {
    score += config.goodForCustomer.excellent;
  } else if (clientData.goodForCustomer >= 60) {
    score += config.goodForCustomer.good;
  } else if (clientData.goodForCustomer >= 40) {
    score += config.goodForCustomer.average;
  } else if (clientData.goodForCustomer >= 20) {
    score += config.goodForCustomer.poor;
  } else {
    score += config.goodForCustomer.bad;
  }

  // Qualité des interactions récentes (10%)
  if (clientData.interactions && clientData.interactions.length > 0) {
    const lastInteraction = clientData.interactions[0];
    const outcome =
      lastInteraction.outcome as keyof typeof config.interactionQuality;
    score += config.interactionQuality[outcome] || 0;
  }

  // Application du multiplicateur sectoriel
  const sector = clientData.sector?.toLowerCase() as string;
  const sectorMultiplier = AI_CONFIG.sectorMultipliers[sector] || 1.0;
  score = Math.round(score * sectorMultiplier);

  return Math.max(0, Math.min(score, 100));
};

// Fonction pour calculer les jours depuis le dernier contact
export const calculateDaysSinceLastContact = (
  lastContactDate: Date | null
): number => {
  if (!lastContactDate) return 999; // Valeur très élevée si jamais contacté

  const now = new Date();
  const diffTime = Math.abs(
    now.getTime() - new Date(lastContactDate).getTime()
  );
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const validateAIConfig = (): boolean => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY manquante");
    return false;
  }

  console.log("✅ Configuration IA STRICTE validée - Adaptée au modèle Client");
  return true;
};
