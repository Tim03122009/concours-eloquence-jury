# Modèle de données – Objets et scores

## 1. Objet Candidate

Représente un candidat au concours.

| Champ      | Type     | Obligatoire | Description |
|------------|----------|-------------|-------------|
| `id`       | `string` | oui         | Identifiant unique (ex. `C1`, `C2`). |
| `name`     | `string` | oui         | Nom affiché du candidat. |
| `tour`     | `string` | non         | ID du tour auquel le candidat est rattaché (`roundId`). |
| `status`   | `string` | non         | `'Actif'` \| `'Qualifie'` \| `'Elimine'` \| `'Reset'`. |

**Stockage** : dans le document `candidats/liste_actuelle`, champ `candidates` (tableau de `Candidate`).

---

## 2. Objet Duel

Représente un duel entre deux candidats (résultat officiel, pas les notes jury).

| Champ           | Type     | Obligatoire | Description |
|-----------------|----------|-------------|-------------|
| `duelId`        | `string` | oui         | Identifiant unique du duel (ex. `duel_round3_1`). |
| `roundId`       | `string` | oui         | ID du tour (type Duels). |
| `candidate1Id`  | `string` | oui         | ID du premier candidat. |
| `candidate2Id`  | `string` | oui         | ID du second candidat. |
| `winnerId`      | `string` \| `null` | non | ID du gagnant, ou `null` si non décidé. |
| `createdAt`     | timestamp | non       | Date de création. |
| `updatedAt`     | timestamp | non       | Dernière mise à jour. |

**Stockage** : collection `duel_results` ; document par tour `duel_results/{roundId}` avec `{ roundId, duels: Duel[] }`, ou sous-collection `duels` par duel.

---

## 3. Objet Jury

Représente un membre du jury (compte).

| Champ        | Type      | Obligatoire | Description |
|--------------|-----------|-------------|-------------|
| `id`         | `string`  | oui         | Identifiant unique (ex. `jury1`, `jury2`). |
| `name`       | `string`  | oui         | Nom affiché. |
| `password`   | `string`  | non         | Mot de passe (hashé en production). |
| `rounds`     | `string[]`| non         | Liste des `roundId` auxquels le jury a accès. |
| `isPresident`| `boolean` | non         | `true` si président du jury. |
| `theme`      | `string`  | non         | Préférence thème (ex. `light`, `dark`). |
| `createdAt`  | timestamp | non         | Date de création du compte. |

**Stockage** : collection `accounts` ; un document par jury `accounts/{juryId}`.

---

## 4. Objet ClassementJury

Représente une entrée dans un classement (session « Classement ») : une ligne du classement pour un candidat.

| Champ        | Type     | Obligatoire | Description |
|--------------|----------|-------------|-------------|
| `rank`       | `number` | oui         | Rang (1, 2, 3, …). |
| `candidateId`| `string` | oui         | ID du candidat. |
| `name`       | `string` | non         | Nom du candidat (dénormalisé). |
| `score_base` | `number` | non         | Score avant bonus / ajustement (voir § Scores). |
| `score_appliqué` | `number` | non     | Score après application des bonus/ajustements. |
| `score_affiché`  | `number` | non     | Score effectivement affiché au jury. |

**Stockage** : dans `classements/{classementId}`, champ `entries` (tableau de `ClassementJury`). Le document contient aussi `code`, `readOnly`, `updatedAt`.

---

## 5. Objet ActivationLog

Enregistre chaque activation (bonus victoire ou classement jury) pour l’historique.

| Champ        | Type     | Obligatoire | Description |
|--------------|----------|-------------|-------------|
| `type`       | `string` | oui         | `'bonus_victoire'` \| `'classement_jury'`. |
| `candidat_id`| `string` | oui         | ID du candidat concerné. |
| `source`     | `string` | oui         | Origine : `duel_id` (ex. `duel_round3_1`) ou `jury_id` (ex. `jury1`) selon le type. |
| `timestamp`  | timestamp | oui        | Date/heure de l’activation. |
| `payload`    | `object` | non         | Données complémentaires (ex. valeur du bonus, ancien/nouveau score). |

**Valeurs de `type`** :
- **`bonus_victoire`** : activation d’un bonus lié à une victoire (ex. duel). `source` = identifiant du duel (`duel_id`).
- **`classement_jury`** : activation liée au classement décidé par un jury/président. `source` = identifiant du jury (`jury_id`).

**Stockage** : collection `activation_logs` ; un document par événement (id auto-généré), ou document unique `config/activation_logs` avec champ `logs: ActivationLog[]` (tableau append-only). Préférence : **collection `activation_logs`** pour requêtes et historique illimité.

---

## 6. Séparation des scores : score_base, score_appliqué, score_affiché

Pour chaque candidat (notation ou classement), trois niveaux de score sont prévus :

| Concept           | Nom dans le modèle | Description |
|-------------------|--------------------|-------------|
| **Score de base** | `score_base`       | Score calculé uniquement à partir des notes jury (fond/forme ou duel), sans bonus ni ajustement. |
| **Score appliqué**| `score_appliqué`   | Score après application des règles métier : bonus victoire, repêchage, etc. (toujours calculé ou fixé par une action humaine). |
| **Score affiché** | `score_affiché`    | Valeur effectivement montrée au jury/public ; en général égale à `score_appliqué`, sauf règle d’affichage spécifique (ex. masquage, arrondi). |

**Où les utiliser** :
- **Notation individuelle** : dans l’agrégation par candidat, on peut stocker `score_base` (somme pondérée des notes), puis `score_appliqué` après bonus, et `score_affiché` pour l’affichage.
- **Classement (ClassementJury)** : chaque entrée peut avoir `score_base`, `score_appliqué`, `score_affiché` ; l’affichage utilise `score_affiché`.
- **Duels** : le résultat du duel (gagnant) est distinct ; les scores jury du duel alimentent un `score_base` par candidat si besoin pour statistiques ou bonus.

Aucun recalcul automatique : le passage de `score_base` → `score_appliqué` → `score_affiché` est fait par action humaine (Admin/Président).

---

## 7. Historique des activations

Chaque activation (bonus victoire, classement jury) doit être tracée.

- **Stockage** : collection **`activation_logs`**.
- **Structure** : chaque document = un `ActivationLog` (champs `type`, `candidat_id`, `source`, `timestamp`, optionnellement `payload`).
- **Usage** :
  - Audit : qui a activé quoi, quand, pour quel candidat.
  - Réversibilité : en lisant l’historique, on peut recalculer ou annuler une activation.
  - Affichage admin : liste chronologique des activations par candidat ou par duel/jury.

Pas de suppression des logs : ajout uniquement (append-only). Optionnel : champ `annule_log_id` pour marquer qu’une entrée annule une activation précédente, sans supprimer l’entrée annulée.

---

## Référence code (model.js)

Le module **`model.js`** fournit :

- **Constantes** : `ACTIVATION_TYPE` (`bonus_victoire`, `classement_jury`).
- **Factories** : `createCandidate`, `createDuel`, `createJury`, `createClassementJury`, `createActivationLog`, `createScoreTriple`.
- **JSDoc** : types `Candidate`, `Duel`, `Jury`, `ClassementJury`, `ActivationLog`, `ScoreTriple`.

À chaque activation (bonus victoire ou classement jury), créer un document dans la collection **`activation_logs`** via `createActivationLog(...)` puis `addDoc(collection(db, "activation_logs"), log)` pour conserver l’historique.
