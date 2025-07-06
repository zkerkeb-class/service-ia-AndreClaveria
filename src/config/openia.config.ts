import config from ".";

// Define types for better type safety
type InteractionOutcome = "positive" | "neutral" | "negative" | "no_response";
type CompanySize = "1-10" | "11-50" | "51-200" | "200+";
type InteractionType =
  | "email"
  | "meeting"
  | "demo"
  | "proposal"
  | "call"
  | "phone";

// Enhanced client data interface for microservice
export interface ClientData {
  _id: string;
  name: string;
  description?: string;
  sector?: string;
  phone?: string;
  email?: string;
  goodForCustomer?: number;
  contacts?: any[];
  opportunities?: any[];
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  assignedTo?: string;
  interactions?: Array<{
    _id: string;
    date: Date;
    type: InteractionType;
    outcome: InteractionOutcome;
    notes?: string;
  }>;
  companySize?: CompanySize;
  hasWorkedWithUs?: boolean;
  knowsUs?: boolean;
  estimatedBudget?: number;
}

export const AI_CONFIG = {
  // Configuration OpenAI API - Optimized for microservice calls
  openai: {
    apiKey: config.openai.apiKey,
    model: "gpt-4o-mini", // Better for complex client analysis
    baseURL: "https://api.openai.com/v1",
    maxTokens: 800, // Increased for detailed analysis
    temperature: 0.2, // Low for consistency
    presence_penalty: 0.1,
    frequency_penalty: 0.1
  },

  // Refined scoring thresholds based on your data
  scoring: {
    minGoodScore: 70,
    minUrgentScore: 85,

    thresholds: {
      budget: {
        disqualify: 5000,
        low: 20000,
        medium: 50000, // Your example client at 52152€
        high: 100000
      },

      companySize: {
        "1-10": 8,
        "11-50": 20, // Your example client
        "51-200": 30,
        "200+": 40
      } as Record<CompanySize, number>,

      interactionRecency: {
        today: 25,
        week: 20,
        month: 15,
        quarter: 10,
        older: -5
      },

      interactionType: {
        meeting: 20,
        email: 10,
        phone: 15,
        call: 15,
        demo: 25,
        proposal: 30
      } as Record<InteractionType, number>,

      interactionOutcome: {
        positive: 25,
        neutral: 5,
        negative: -10,
        no_response: -15
      } as Record<InteractionOutcome, number>,

      clientHistory: {
        hasWorkedWithUs: 30,
        knowsUs: 15,
        unknown: 0
      },

      goodForCustomer: {
        excellent: 25, // 80-100
        good: 20, // 60-79 (like your example at 71)
        average: 10, // 40-59
        poor: -5, // 20-39
        bad: -20 // 0-19
      },

      opportunities: {
        multiple: 20,
        single: 15,
        none: 0
      }
    }
  },

  // Enhanced prompts for microservice architecture
  prompts: {
    systemPrompt: `Tu es un expert en qualification commerciale B2B qui analyse des profils clients pour optimiser les actions commerciales.

    CONTEXTE MICROSERVICE :
    - Les données client proviennent d'un microservice séparé
    - Format MongoDB avec ObjectId et timestamps
    - Analyse basée sur interactions réelles et historique complet

    CRITÈRES D'ANALYSE (pondération) :
    1. BUDGET (30%) - Potentiel de revenus
    2. HISTORIQUE CLIENT (25%) - hasWorkedWithUs = priorité absolue
    3. INTERACTIONS (20%) - Récence + qualité des échanges
    4. TAILLE ENTREPRISE (15%) - Capacité décisionnelle
    5. FIT PRODUIT (10%) - goodForCustomer/100

    BARÈME DE SCORING :
    ✅ 90-100: PREMIUM (contact direction immédiat)
    🔥 80-89: PRIORITAIRE (action dans 48h)
    ⭐ 70-79: BON PROSPECT (suivi hebdomadaire)
    📊 60-69: POTENTIEL (nurturing ciblé)
    ⚠️ 50-59: À QUALIFIER (découverte approfondie)
    ❌ 0-49: RÉVISION STRATÉGIE

    RÈGLES CRITIQUES :
    - hasWorkedWithUs = true → BONUS +30 points minimum
    - Budget < 5000€ → Score plafonné à 40
    - Dernière interaction "negative" → Flag risque
    - Pas d'interaction récente → Pénalité temporelle
    - Secteur "Technologie" → Multiplicateur x1.2

    RÉPONSE OBLIGATOIRE EN JSON :
    {
      "score": number,
      "category": "premium|prioritaire|bon|potentiel|qualifier|révision",
      "priority": "haute|moyenne|basse",
      "reasoning": "Analyse détaillée des points clés",
      "strengths": ["Force 1", "Force 2", "Force 3"],
      "weaknesses": ["Faiblesse 1", "Faiblesse 2"],
      "recommendations": {
        "immediate": "Action prioritaire à faire",
        "shortTerm": "Actions semaine prochaine",
        "longTerm": "Stratégie à long terme"
      },
      "riskAssessment": {
        "level": "low|medium|high",
        "factors": ["Facteur risque 1", "Facteur risque 2"],
        "mitigation": "Stratégie de mitigation"
      },
      "nextSteps": {
        "action": "Action concrète",
        "timeframe": "Délai précis",
        "responsible": "Qui doit agir",
        "success_metrics": "Comment mesurer le succès"
      }
    }`,

    // Updated analysis prompt for microservice data
    clientAnalysisPrompt: (clientData: ClientData) => {
      const formatBudget = (budget?: number): string => {
        return budget ? `${budget.toLocaleString("fr-FR")}€` : "Non défini";
      };

      const formatDate = (date?: Date): string => {
        return date ? new Date(date).toLocaleDateString("fr-FR") : "N/A";
      };

      const formatInteractions = (
        interactions?: ClientData["interactions"]
      ): string => {
        if (!interactions || interactions.length === 0) {
          return "❌ Aucune interaction enregistrée";
        }

        return interactions
          .slice(0, 5)
          .map((int, i) => {
            const date = new Date(int.date).toLocaleDateString("fr-FR");
            const daysSince = Math.floor(
              (new Date().getTime() - new Date(int.date).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            const outcomeIcon =
              {
                positive: "✅",
                neutral: "➖",
                negative: "❌",
                no_response: "⏸️"
              }[int.outcome] || "❓";

            return `${i + 1}. ${date} (${daysSince}j) - ${int.type.toUpperCase()} ${outcomeIcon} ${int.outcome}
   Notes: ${int.notes || "Aucune note"}`;
          })
          .join("\n");
      };

      return `
🔍 ANALYSE PROFIL CLIENT - MICROSERVICE DATA

📊 DONNÉES CLIENT :
- ID : ${clientData._id}
- Nom : ${clientData.name}
- Description : ${clientData.description || "Non spécifiée"}
- Secteur : ${clientData.sector || "Non défini"}
- Taille : ${clientData.companySize || "Inconnue"}
- Budget estimé : ${formatBudget(clientData.estimatedBudget)}
- Évaluation interne : ${clientData.goodForCustomer ?? "N/A"}/100
- Ancien client : ${clientData.hasWorkedWithUs ? "✅ OUI" : "❌ NON"}
- Nous connaît : ${clientData.knowsUs ? "✅ OUI" : "❌ NON"}
- Opportunités actives : ${clientData.opportunities?.length ?? 0}
- Contacts : ${clientData.contacts?.length ?? 0}
- Compte actif : ${clientData.isActive !== false ? "✅ OUI" : "❌ NON"}
- Dernière MAJ : ${formatDate(clientData.updatedAt)}

📈 HISTORIQUE INTERACTIONS (${clientData.interactions?.length ?? 0} total) :
${formatInteractions(clientData.interactions)}

🎯 MISSION : 
Analyse ce profil client en profondeur et fournis un scoring précis avec plan d'action détaillé.
Prends en compte le format microservice et la richesse des données disponibles.

Focus sur :
- Potentiel de revenus immédiat vs long terme
- Qualité de la relation existante
- Momentum commercial actuel
- Risques et opportunités
- Actions concrètes à entreprendre`;
    },

    // Batch analysis prompt for multiple clients
    batchAnalysisPrompt: (clients: ClientData[]) => {
      const formatClientSummary = (
        client: ClientData,
        index: number
      ): string => {
        const budget = client.estimatedBudget
          ? `${client.estimatedBudget.toLocaleString("fr-FR")}€`
          : "N/A";

        const lastInteraction = client.interactions?.[0];
        const interactionSummary = lastInteraction
          ? `${lastInteraction.outcome} (${lastInteraction.type})`
          : "N/A";

        return `
📊 CLIENT ${index + 1} : ${client.name}
- Budget: ${budget}
- Secteur: ${client.sector ?? "N/A"}
- Taille: ${client.companySize ?? "N/A"}
- Ancien client: ${client.hasWorkedWithUs ? "✅" : "❌"}
- Fit produit: ${client.goodForCustomer ?? "N/A"}/100
- Dernière interaction: ${interactionSummary}
- Opportunités: ${client.opportunities?.length ?? 0}`;
      };

      return `
🔍 ANALYSE COMPARATIVE PORTFOLIO - ${clients.length} CLIENTS

Analyse et classe ces clients par priorité commerciale :

${clients.map(formatClientSummary).join("\n")}

Fournis un classement avec recommandations spécifiques pour chaque client.

RÉPONSE ATTENDUE :
- Top 3 clients prioritaires avec justification
- Actions immédiates pour chaque segment
- Allocation recommandée du temps commercial
- Stratégie différenciée par profil`;
    },

    // Risk assessment prompt
    riskAssessmentPrompt: (clientData: ClientData) => {
      const formatInteractionTrend = (): string => {
        if (!clientData.interactions || clientData.interactions.length === 0) {
          return "N/A";
        }
        return clientData.interactions
          .slice(0, 3)
          .map((i) => i.outcome)
          .join(" → ");
      };

      const formatLastUpdate = (): string => {
        return clientData.updatedAt
          ? new Date(clientData.updatedAt).toLocaleDateString("fr-FR")
          : "N/A";
      };

      const formatLastInteraction = (): string => {
        const lastInt = clientData.interactions?.[0];
        return lastInt ? `${lastInt.outcome} (${lastInt.type})` : "N/A";
      };

      const formatBudgetSector = (): string => {
        const budget = clientData.estimatedBudget
          ? `${clientData.estimatedBudget.toLocaleString("fr-FR")}€`
          : "N/A";
        const sector = clientData.sector ?? "N/A";
        return `${budget} en ${sector}`;
      };

      const formatSizeBudget = (): string => {
        const size = clientData.companySize ?? "N/A";
        const budget = clientData.estimatedBudget
          ? `${clientData.estimatedBudget.toLocaleString("fr-FR")}€`
          : "N/A";
        return `${size} pour ${budget}`;
      };

      return `
⚠️ ÉVALUATION RISQUES CLIENT : ${clientData.name}

Données pour analyse risque :
- Historique interactions: ${clientData.interactions?.length ?? 0} échanges
- Dernière interaction: ${formatLastInteraction()}
- Trend interactions: ${formatInteractionTrend()}
- Budget vs sector: ${formatBudgetSector()}
- Taille vs budget: ${formatSizeBudget()}
- Activité compte: ${clientData.isActive !== false ? "Actif" : "Inactif"}
- Dernière MAJ: ${formatLastUpdate()}

Identifie les signaux faibles et risques potentiels.
Propose des stratégies préventives.`;
    }
  },

  // Enhanced recommendations
  recommendations: {
    byCategory: {
      premium: {
        action: "Escalade direction + proposition premium",
        approach: "Négociation C-level avec offre sur-mesure",
        timeframe: "24h maximum",
        channels: ["phone", "meeting", "proposal"]
      },
      prioritaire: {
        action: "Contact commercial senior immédiat",
        approach: "Présentation solution complète",
        timeframe: "48h",
        channels: ["call", "meeting", "demo"]
      },
      bon: {
        action: "Suivi commercial structuré",
        approach: "Qualification approfondie + démo",
        timeframe: "7 jours",
        channels: ["email", "demo", "meeting"]
      },
      potentiel: {
        action: "Nurturing ciblé + éducation",
        approach: "Contenu à valeur ajoutée",
        timeframe: "Bi-mensuel",
        channels: ["email", "call"]
      },
      qualifier: {
        action: "Découverte besoins + budget",
        approach: "Questionnaire qualification",
        timeframe: "Mensuel",
        channels: ["email", "call"]
      },
      révision: {
        action: "Audit stratégie compte",
        approach: "Réévaluation complète",
        timeframe: "Trimestriel",
        channels: ["email"]
      }
    },

    byRisk: {
      low: "Suivi standard selon catégorie",
      medium: "Monitoring renforcé + actions préventives",
      high: "Intervention immédiate + plan de récupération"
    },

    byInteractionTrend: {
      improving: "Capitaliser sur la dynamique positive",
      stable: "Maintenir l'engagement actuel",
      declining: "Intervention corrective immédiate",
      critical: "Escalade + plan de sauvetage"
    }
  },

  // Sector-specific multipliers
  sectorMultipliers: {
    technologie: 1.2,
    finance: 1.3,
    santé: 1.25,
    conseil: 1.15,
    industrie: 1.1,
    éducation: 0.95,
    retail: 0.9,
    associatif: 0.8,
    logiciels: 1.25, // Added for your example
    it: 1.2
  } as Record<string, number>,

  // Validation rules for microservice data
  validationRules: {
    requiredFields: ["_id", "name"],
    recommendedFields: [
      "sector",
      "companySize",
      "estimatedBudget",
      "goodForCustomer"
    ],
    dataQualityChecks: {
      hasRecentInteraction: (data: ClientData) => {
        if (!data.interactions?.length) return false;
        const lastInteraction = new Date(data.interactions[0].date);
        const daysSince =
          (new Date().getTime() - lastInteraction.getTime()) /
          (1000 * 60 * 60 * 24);
        return daysSince <= 90;
      },
      hasBudgetInfo: (data: ClientData) => !!data.estimatedBudget,
      hasCompanySize: (data: ClientData) => !!data.companySize,
      isActiveAccount: (data: ClientData) => data.isActive !== false
    }
  }
};

// Enhanced score calculation for microservice data
// Remplacez votre fonction calculateEnhancedScore par cette version avec debug extrême
export const calculateEnhancedScore = (clientData: ClientData): number => {
  console.log(`\n🚨 === VERSION DEBUG EXTREME - DEBUT ===`);
  console.log(`🚨 Client: ${clientData.name}`);
  console.log(`🚨 Données brutes:`, JSON.stringify(clientData, null, 2));

  let score = 0;
  const config = AI_CONFIG.scoring.thresholds;

  console.log(`🚨 Config thresholds:`, JSON.stringify(config, null, 2));

  // 1. BUDGET TEST (30%)
  console.log(`\n🔍 === TEST BUDGET ===`);
  console.log(`Budget reçu: ${clientData.estimatedBudget}`);
  console.log(`Type budget: ${typeof clientData.estimatedBudget}`);
  console.log(
    `Budget est number: ${typeof clientData.estimatedBudget === "number"}`
  );
  console.log(`Budget existe: ${!!clientData.estimatedBudget}`);

  if (
    clientData.estimatedBudget &&
    typeof clientData.estimatedBudget === "number"
  ) {
    console.log(`✅ Budget validé: ${clientData.estimatedBudget}`);
    console.log(
      `Seuils: disqualify=${config.budget.disqualify}, low=${config.budget.low}, medium=${config.budget.medium}, high=${config.budget.high}`
    );

    let budgetScore = 0;
    if (clientData.estimatedBudget >= config.budget.high) {
      budgetScore = 30;
      console.log(`✅ Budget >= ${config.budget.high} -> +30 points`);
    } else if (clientData.estimatedBudget >= config.budget.medium) {
      budgetScore = 23;
      console.log(
        `✅ Budget >= ${config.budget.medium} -> +23 points (CLIENT CASE)`
      );
    } else if (clientData.estimatedBudget >= config.budget.low) {
      budgetScore = 15;
      console.log(`✅ Budget >= ${config.budget.low} -> +15 points`);
    } else if (clientData.estimatedBudget >= config.budget.disqualify) {
      budgetScore = 8;
      console.log(`✅ Budget >= ${config.budget.disqualify} -> +8 points`);
    } else {
      console.log(`❌ Budget trop faible: ${clientData.estimatedBudget}`);
    }

    score += budgetScore;
    console.log(`📊 Score après budget: ${score} (ajouté: ${budgetScore})`);
  } else {
    console.log(`❌ Budget invalide ou manquant`);
  }

  // 2. HISTORIQUE CLIENT TEST (25%)
  console.log(`\n🔍 === TEST HISTORIQUE CLIENT ===`);
  console.log(`hasWorkedWithUs: ${clientData.hasWorkedWithUs}`);
  console.log(`Type hasWorkedWithUs: ${typeof clientData.hasWorkedWithUs}`);
  console.log(
    `hasWorkedWithUs === true: ${clientData.hasWorkedWithUs === true}`
  );
  console.log(`knowsUs: ${clientData.knowsUs}`);
  console.log(`Type knowsUs: ${typeof clientData.knowsUs}`);

  if (clientData.hasWorkedWithUs === true) {
    score += 25;
    console.log(`✅ Ancien client confirmé -> +25 points`);
    console.log(`📊 Score après historique: ${score}`);
  } else if (clientData.knowsUs === true) {
    score += 12;
    console.log(`✅ Nous connaît -> +12 points`);
    console.log(`📊 Score après historique: ${score}`);
  } else {
    console.log(`❌ Pas d'historique client`);
  }

  // 3. INTERACTIONS TEST (20%)
  console.log(`\n🔍 === TEST INTERACTIONS ===`);
  console.log(`Interactions raw:`, clientData.interactions);
  console.log(
    `Interactions is array: ${Array.isArray(clientData.interactions)}`
  );
  console.log(`Interactions length: ${clientData.interactions?.length || 0}`);

  if (
    clientData.interactions &&
    Array.isArray(clientData.interactions) &&
    clientData.interactions.length > 0
  ) {
    console.log(`✅ Interactions trouvées: ${clientData.interactions.length}`);
    const recentInteractions = clientData.interactions.slice(0, 3);
    let interactionScore = 0;

    recentInteractions.forEach((interaction, index) => {
      console.log(`\n--- Interaction ${index + 1} ---`);
      console.log(`Interaction:`, interaction);

      if (
        !interaction ||
        !interaction.outcome ||
        !interaction.type ||
        !interaction.date
      ) {
        console.log(`❌ Interaction ${index} invalide`);
        return;
      }

      const outcomeScore = config.interactionOutcome[interaction.outcome] ?? 0;
      const typeScore = config.interactionType[interaction.type] ?? 0;

      console.log(`Outcome ${interaction.outcome}: ${outcomeScore} points`);
      console.log(
        `Type ${interaction.type}: ${typeScore} points (x0.3 = ${typeScore * 0.3})`
      );

      interactionScore += outcomeScore;
      interactionScore += typeScore * 0.3;

      // Recency
      const daysSince = Math.floor(
        (new Date().getTime() - new Date(interaction.date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      let recencyBonus = 0;
      if (daysSince <= 7) recencyBonus = 8;
      else if (daysSince <= 30) recencyBonus = 5;
      else if (daysSince <= 90) recencyBonus = 2;

      interactionScore += recencyBonus;
      console.log(`Recency ${daysSince} jours: +${recencyBonus} points`);
      console.log(
        `Total interaction ${index}: ${outcomeScore + typeScore * 0.3 + recencyBonus}`
      );
    });

    const finalInteractionScore = Math.min(20, Math.max(0, interactionScore));
    score += finalInteractionScore;
    console.log(
      `📊 Score interactions final: ${finalInteractionScore} (brut: ${interactionScore})`
    );
    console.log(`📊 Score après interactions: ${score}`);
  } else {
    console.log(`❌ Pas d'interactions valides`);
  }

  // 4. TAILLE ENTREPRISE TEST (15%)
  console.log(`\n🔍 === TEST TAILLE ENTREPRISE ===`);
  console.log(`Company size: ${clientData.companySize}`);
  console.log(`Type: ${typeof clientData.companySize}`);

  console.log(`Config company sizes:`, config.companySize);

  if (
    clientData.companySize &&
    typeof clientData.companySize === "string" &&
    clientData.companySize in config.companySize
  ) {
    const sizeScore = config.companySize[clientData.companySize] * 0.75;
    score += sizeScore;
    console.log(
      `✅ Taille ${clientData.companySize}: ${config.companySize[clientData.companySize]} * 0.75 = +${sizeScore} points`
    );
    console.log(`📊 Score après taille: ${score}`);
  } else {
    console.log(`❌ Taille entreprise invalide: ${clientData.companySize}`);
  }

  // 5. FIT PRODUIT TEST (10%)
  console.log(`\n🔍 === TEST FIT PRODUIT ===`);
  console.log(`Good for customer: ${clientData.goodForCustomer}`);
  console.log(`Type: ${typeof clientData.goodForCustomer}`);
  console.log(`Is number: ${typeof clientData.goodForCustomer === "number"}`);
  console.log(`Not NaN: ${!isNaN(clientData.goodForCustomer as number)}`);

  if (
    typeof clientData.goodForCustomer === "number" &&
    !isNaN(clientData.goodForCustomer)
  ) {
    let fitScore = 0;
    if (clientData.goodForCustomer >= 80) {
      fitScore = 10;
      console.log(`✅ Fit >= 80: +10 points`);
    } else if (clientData.goodForCustomer >= 60) {
      fitScore = 8;
      console.log(`✅ Fit >= 60: +8 points (CLIENT CASE)`);
    } else if (clientData.goodForCustomer >= 40) {
      fitScore = 5;
      console.log(`✅ Fit >= 40: +5 points`);
    } else if (clientData.goodForCustomer >= 20) {
      fitScore = 2;
      console.log(`✅ Fit >= 20: +2 points`);
    }

    score += fitScore;
    console.log(`📊 Score après fit: ${score} (ajouté: ${fitScore})`);
  } else {
    console.log(`❌ Fit produit invalide: ${clientData.goodForCustomer}`);
  }

  // 6. OPPORTUNITÉS TEST
  console.log(`\n🔍 === TEST OPPORTUNITÉS ===`);
  console.log(`Opportunities:`, clientData.opportunities);
  console.log(`Is array: ${Array.isArray(clientData.opportunities)}`);
  console.log(`Length: ${clientData.opportunities?.length || 0}`);

  if (
    clientData.opportunities &&
    Array.isArray(clientData.opportunities) &&
    clientData.opportunities.length > 0
  ) {
    const opportunityBonus = clientData.opportunities.length > 1 ? 5 : 3;
    score += opportunityBonus;
    console.log(
      `✅ Opportunités ${clientData.opportunities.length}: +${opportunityBonus} points`
    );
    console.log(`📊 Score après opportunités: ${score}`);
  } else {
    console.log(`❌ Pas d'opportunités`);
  }

  // 7. SECTEUR MULTIPLIER TEST
  console.log(`\n🔍 === TEST SECTEUR ===`);
  console.log(`Sector: ${clientData.sector}`);
  console.log(`Type: ${typeof clientData.sector}`);

  let multiplier = 1.0;
  if (clientData.sector && typeof clientData.sector === "string") {
    const sectorKey = clientData.sector.toLowerCase().trim();
    console.log(`Sector key normalized: "${sectorKey}"`);
    console.log(`Available multipliers:`, AI_CONFIG.sectorMultipliers);

    for (const [key, value] of Object.entries(AI_CONFIG.sectorMultipliers)) {
      console.log(`Testing if "${sectorKey}" includes "${key.toLowerCase()}"`);
      if (sectorKey.includes(key.toLowerCase())) {
        multiplier = value;
        console.log(`✅ Match found! Multiplier: ${multiplier}`);
        break;
      }
    }
  }

  console.log(`🔢 Score avant multiplier: ${score}`);
  score = Math.round(score * multiplier);
  console.log(`🔢 Score après multiplier x${multiplier}: ${score}`);

  // 8. ACTIVITÉ TEST
  console.log(`\n🔍 === TEST ACTIVITÉ ===`);
  console.log(`Is active: ${clientData.isActive}`);
  console.log(`Is active === false: ${clientData.isActive === false}`);

  if (clientData.isActive === false) {
    const beforePenalty = score;
    score = Math.round(score * 0.8);
    console.log(`❌ Compte inactif: ${beforePenalty} * 0.8 = ${score}`);
  } else {
    console.log(`✅ Compte actif`);
  }

  const finalScore = Math.max(0, Math.min(100, score));
  console.log(`\n🚨 === RÉSULTAT FINAL ===`);
  console.log(`Score calculé: ${score}`);
  console.log(`Score final (0-100): ${finalScore}`);
  console.log(`🚨 === FIN DEBUG EXTREME ===\n`);

  return finalScore;
};
// Enhanced client analysis function
export const analyzeClientProfile = (clientData: ClientData) => {
  const baseScore = calculateEnhancedScore(clientData);

  // Category determination
  let category = "révision";
  let priority = "basse";

  if (baseScore >= 90) {
    category = "premium";
    priority = "haute";
  } else if (baseScore >= 80) {
    category = "prioritaire";
    priority = "haute";
  } else if (baseScore >= 70) {
    category = "bon";
    priority = "moyenne";
  } else if (baseScore >= 60) {
    category = "potentiel";
    priority = "moyenne";
  } else if (baseScore >= 50) {
    category = "qualifier";
    priority = "basse";
  }

  // Strengths analysis
  const strengths = [];
  if (clientData.hasWorkedWithUs) strengths.push("Relation client établie");
  if (clientData.estimatedBudget && clientData.estimatedBudget >= 40000)
    strengths.push("Budget conséquent");
  if (clientData.goodForCustomer && clientData.goodForCustomer >= 70)
    strengths.push("Excellent fit produit");
  if (clientData.interactions?.[0]?.outcome === "positive")
    strengths.push("Momentum positif");
  if (clientData.opportunities?.length && clientData.opportunities.length > 1)
    strengths.push("Opportunités multiples");

  // Weaknesses analysis
  const weaknesses = [];
  if (!clientData.estimatedBudget) weaknesses.push("Budget non défini");
  if (clientData.companySize === "1-10") weaknesses.push("Petite structure");
  if (!clientData.interactions?.length)
    weaknesses.push("Pas d'historique d'interactions");
  if (clientData.interactions?.[0]?.outcome === "negative")
    weaknesses.push("Dernière interaction négative");
  if (clientData.isActive === false) weaknesses.push("Compte inactif");

  // Risk assessment
  let riskLevel: "low" | "medium" | "high" = "low";
  const riskFactors: string[] = [];

  if (clientData.interactions?.length) {
    const recentNegative = clientData.interactions
      .slice(0, 3)
      .filter((i) => i.outcome === "negative").length;

    if (recentNegative >= 2) {
      riskLevel = "high";
      riskFactors.push("Trend d'interactions négatives");
    }
  }

  const hasRecentInteraction =
    clientData.interactions?.length &&
    clientData.interactions[0] &&
    Math.floor(
      (new Date().getTime() -
        new Date(clientData.interactions[0].date).getTime()) /
        (1000 * 60 * 60 * 24)
    ) <= 90;

  if (!hasRecentInteraction) {
    riskLevel = riskLevel === "high" ? "high" : "medium";
    riskFactors.push("Pas d'interaction récente");
  }

  return {
    score: baseScore,
    category,
    priority,
    strengths,
    weaknesses,
    riskLevel,
    riskFactors,
    recommendation:
      AI_CONFIG.recommendations.byCategory[
        category as keyof typeof AI_CONFIG.recommendations.byCategory
      ],
    dataQuality: {
      hasRecentInteraction:
        AI_CONFIG.validationRules.dataQualityChecks.hasRecentInteraction(
          clientData
        ),
      hasBudgetInfo:
        AI_CONFIG.validationRules.dataQualityChecks.hasBudgetInfo(clientData),
      hasCompanySize:
        AI_CONFIG.validationRules.dataQualityChecks.hasCompanySize(clientData),
      isActiveAccount:
        AI_CONFIG.validationRules.dataQualityChecks.isActiveAccount(clientData)
    }
  };
};

// Validation functions
export const validateClientData = (clientData: ClientData): boolean => {
  const required = AI_CONFIG.validationRules.requiredFields;
  return required.every((field) => clientData[field as keyof ClientData]);
};

export const validateAIConfig = (): boolean => {
  try {
    if (
      !AI_CONFIG.openai?.apiKey ||
      AI_CONFIG.openai.apiKey === "" ||
      AI_CONFIG.openai.apiKey === "your-api-key-here"
    ) {
      console.error("❌ OpenAI API key missing or invalid");
      return false;
    }

    if (!AI_CONFIG.openai.apiKey.startsWith("sk-")) {
      console.error("❌ OpenAI API key format invalid");
      return false;
    }

    if (!AI_CONFIG.openai?.model || !AI_CONFIG.openai?.baseURL) {
      console.error("❌ OpenAI configuration incomplete");
      return false;
    }

    if (!AI_CONFIG.scoring?.thresholds) {
      console.error("❌ Scoring thresholds missing");
      return false;
    }

    console.log("✅ AI Configuration validated successfully");
    return true;
  } catch (error) {
    console.error("❌ Error validating AI configuration:", error);
    return false;
  }
};

// Helper function to prepare client data for AI analysis
export const prepareClientDataForAI = (clientData: ClientData): string => {
  return AI_CONFIG.prompts.clientAnalysisPrompt(clientData);
};

export default AI_CONFIG;
