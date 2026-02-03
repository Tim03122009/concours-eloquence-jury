/**
 * Modèle de données – Concours d'Éloquence
 * Définit les objets Candidate, Duel, Jury, ClassementJury, ActivationLog
 * et la séparation score_base / score_appliqué / score_affiché.
 *
 * @see specs/MODELE_DONNEES.md
 */

// -----------------------------------------------------------------------------
// Types d'activation (ActivationLog.type)
// -----------------------------------------------------------------------------
export const ACTIVATION_TYPE = {
  BONUS_VICTOIRE: 'bonus_victoire',
  CLASSEMENT_JURY: 'classement_jury'
};

// -----------------------------------------------------------------------------
// Candidate
// -----------------------------------------------------------------------------
/**
 * @typedef {Object} Candidate
 * @property {string} id - Identifiant unique (ex. C1, C2)
 * @property {string} name - Nom affiché du candidat
 * @property {string} [tour] - ID du tour (roundId)
 * @property {string} [status] - 'Actif' | 'Qualifie' | 'Elimine' | 'Reset'
 */

/**
 * Crée un objet Candidate valide.
 * @param {string} id
 * @param {string} name
 * @param {{ tour?: string, status?: string }} [opts]
 * @returns {Candidate}
 */
export function createCandidate(id, name, opts = {}) {
  return {
    id: String(id),
    name: String(name),
    ...(opts.tour != null && { tour: String(opts.tour) }),
    ...(opts.status != null && { status: String(opts.status) })
  };
}

// -----------------------------------------------------------------------------
// Duel
// -----------------------------------------------------------------------------
/**
 * @typedef {Object} Duel
 * @property {string} duelId - Identifiant unique du duel
 * @property {string} roundId - ID du tour (type Duels)
 * @property {string} candidate1Id - ID du premier candidat
 * @property {string} candidate2Id - ID du second candidat
 * @property {string|null} [winnerId] - ID du gagnant ou null
 * @property {Date|import('firebase/firestore').Timestamp} [createdAt]
 * @property {Date|import('firebase/firestore').Timestamp} [updatedAt]
 */

/**
 * Crée un objet Duel valide.
 * @param {string} duelId
 * @param {string} roundId
 * @param {string} candidate1Id
 * @param {string} candidate2Id
 * @param {{ winnerId?: string|null, createdAt?: Date, updatedAt?: Date }} [opts]
 * @returns {Duel}
 */
export function createDuel(duelId, roundId, candidate1Id, candidate2Id, opts = {}) {
  const now = opts.updatedAt || opts.createdAt || new Date();
  return {
    duelId: String(duelId),
    roundId: String(roundId),
    candidate1Id: String(candidate1Id),
    candidate2Id: String(candidate2Id),
    ...(opts.winnerId !== undefined && { winnerId: opts.winnerId == null ? null : String(opts.winnerId) }),
    ...(opts.createdAt && { createdAt: opts.createdAt }),
    ...(opts.updatedAt && { updatedAt: opts.updatedAt }),
    updatedAt: now
  };
}

// -----------------------------------------------------------------------------
// Jury
// -----------------------------------------------------------------------------
/**
 * @typedef {Object} Jury
 * @property {string} id - Identifiant unique (ex. jury1)
 * @property {string} name - Nom affiché
 * @property {string} [password]
 * @property {string[]} [rounds] - Liste des roundId accessibles
 * @property {boolean} [isPresident]
 * @property {string} [theme]
 * @property {Date|import('firebase/firestore').Timestamp} [createdAt]
 */

/**
 * Crée un objet Jury valide (pour usage mémoire ; le mot de passe n'est pas mis par défaut).
 * @param {string} id
 * @param {string} name
 * @param {{ password?: string, rounds?: string[], isPresident?: boolean, theme?: string, createdAt?: Date }} [opts]
 * @returns {Jury}
 */
export function createJury(id, name, opts = {}) {
  return {
    id: String(id),
    name: String(name),
    ...(opts.password != null && { password: String(opts.password) }),
    ...(opts.rounds != null && { rounds: [...opts.rounds].map(String) }),
    ...(opts.isPresident != null && { isPresident: Boolean(opts.isPresident) }),
    ...(opts.theme != null && { theme: String(opts.theme) }),
    ...(opts.createdAt && { createdAt: opts.createdAt })
  };
}

// -----------------------------------------------------------------------------
// ClassementJury (entrée d'un classement)
// -----------------------------------------------------------------------------
/**
 * @typedef {Object} ClassementJury
 * @property {number} rank - Rang (1, 2, 3, …)
 * @property {string} candidateId - ID du candidat
 * @property {string} [name] - Nom du candidat (dénormalisé)
 * @property {number} [score_base] - Score avant bonus / ajustement
 * @property {number} [score_appliqué] - Score après application des bonus
 * @property {number} [score_affiché] - Score effectivement affiché
 */

/**
 * Crée une entrée ClassementJury avec séparation score_base / score_appliqué / score_affiché.
 * @param {number} rank
 * @param {string} candidateId
 * @param {{ name?: string, score_base?: number, score_appliqué?: number, score_affiché?: number }} [opts]
 * @returns {ClassementJury}
 */
export function createClassementJury(rank, candidateId, opts = {}) {
  const scoreBase = opts.score_base != null ? Number(opts.score_base) : undefined;
  const scoreApplique = opts.score_appliqué != null ? Number(opts.score_appliqué) : (scoreBase != null ? scoreBase : undefined);
  const scoreAffiche = opts.score_affiché != null ? Number(opts.score_affiché) : (scoreApplique != null ? scoreApplique : undefined);
  return {
    rank: Number(rank),
    candidateId: String(candidateId),
    ...(opts.name != null && { name: String(opts.name) }),
    ...(scoreBase != null && { score_base: scoreBase }),
    ...(scoreApplique != null && { score_appliqué: scoreApplique }),
    ...(scoreAffiche != null && { score_affiché: scoreAffiche })
  };
}

// -----------------------------------------------------------------------------
// ActivationLog (historique des activations)
// -----------------------------------------------------------------------------
/**
 * @typedef {Object} ActivationLog
 * @property {string} type - 'bonus_victoire' | 'classement_jury'
 * @property {string} candidat_id - ID du candidat concerné
 * @property {string} source - duel_id (ex. duel_round3_1) ou jury_id (ex. jury1)
 * @property {Date|import('firebase/firestore').Timestamp} timestamp
 * @property {Object} [payload] - Données complémentaires
 */

/**
 * Crée un enregistrement ActivationLog pour l'historique.
 * @param {string} type - ACTIVATION_TYPE.BONUS_VICTOIRE | ACTIVATION_TYPE.CLASSEMENT_JURY
 * @param {string} candidatId - ID du candidat
 * @param {string} source - duel_id ou jury_id
 * @param {Date} [timestamp] - Par défaut maintenant
 * @param {Object} [payload]
 * @returns {ActivationLog}
 */
export function createActivationLog(type, candidatId, source, timestamp = new Date(), payload = undefined) {
  if (type !== ACTIVATION_TYPE.BONUS_VICTOIRE && type !== ACTIVATION_TYPE.CLASSEMENT_JURY) {
    throw new Error(`ActivationLog.type invalide: ${type}`);
  }
  return {
    type,
    candidat_id: String(candidatId),
    source: String(source),
    timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp),
    ...(payload != null && { payload })
  };
}

// -----------------------------------------------------------------------------
// Scores : score_base, score_appliqué, score_affiché
// -----------------------------------------------------------------------------
/**
 * Objet regroupant les trois niveaux de score pour un candidat.
 * @typedef {Object} ScoreTriple
 * @property {number} [score_base] - Score calculé à partir des notes jury uniquement
 * @property {number} [score_appliqué] - Score après bonus / règles métier
 * @property {number} [score_affiché] - Valeur affichée au jury / public
 */

/**
 * Construit un ScoreTriple à partir de valeurs optionnelles.
 * Par défaut : score_affiché = score_appliqué = score_base si non fournis.
 * @param {{ score_base?: number, score_appliqué?: number, score_affiché?: number }} [opts]
 * @returns {ScoreTriple}
 */
export function createScoreTriple(opts = {}) {
  const base = opts.score_base != null ? Number(opts.score_base) : undefined;
  const applique = opts.score_appliqué != null ? Number(opts.score_appliqué) : base;
  const affiche = opts.score_affiché != null ? Number(opts.score_affiché) : applique;
  return {
    ...(base != null && { score_base: base }),
    ...(applique != null && { score_appliqué: applique }),
    ...(affiche != null && { score_affiché: affiche })
  };
}
