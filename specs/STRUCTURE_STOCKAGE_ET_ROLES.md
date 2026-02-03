# Structure de stockage et rôles

## Rôles (séparation stricte)

| Rôle       | Responsabilités                          | Interdit                          |
|-----------|-------------------------------------------|-----------------------------------|
| **Jury**  | Saisie : notes fond/forme, votes repêchage, notes duels | Activation, affichage global, recalcul |
| **Président** | Choix (repêchage) + bonus                 | Activation des tours/classements, affichage admin |
| **Admin** | Activation (tours, bonus, classements) + affichage      | Saisie jury, recalcul automatique |

- Aucun recalcul ni qualification sans action humaine (bouton explicite en admin / président).

---

## Structure de stockage (indépendante)

### 1. Notes fond / forme

- **Collection** : `scores`
- **Champs** : `juryId`, `juryName`, `candidateId`, `roundId`, `score1` (fond), `score2` (forme), `timestamp`
- Pour les tours en **notation individuelle** : même structure, pas de mélange avec les duels.

### 2. Résultats de duels

- **Collection** : `duel_results`
- **Document** : `duel_results/{roundId}` (un doc par tour duels)
- **Structure** : `{ roundId, results: [ { candidate1Id, candidate2Id, winnerId } ], updatedAt }`
- Les notes des jurys pour les duels restent dans `scores` (score1 = note du candidat, score2 = 0 ou absent). Le résultat officiel du duel (gagnant) est dans `duel_results`, renseigné par Admin/Président.

### 3. Classements des jurés (session « Classement »)

- **Collection** : `classements`
- **Document** : `classements/{classementId}`
- **Structure** :  
  `{ code, entries: ClassementJury[], readOnly: true, updatedAt }`  
  Chaque entrée **ClassementJury** : `{ rank, candidateId, name?, score_base?, score_appliqué?, score_affiché? }`.  
  Séparation des scores : **score_base** (avant bonus), **score_appliqué** (après règles métier), **score_affiché** (valeur affichée au jury).
- **Session Classement** : identifiée par un tour de type « Classement » avec `classementId` et `codeClassement`. Affichage jury : **lecture seule**, **synchronisation temps réel** (`onSnapshot`). **Classement basé uniquement sur score final** (score_affiché puis score_appliqué) ; **mise à jour du classement uniquement par activation** (admin « Activation classements » ou président « Bonus victoire »). **Ordre réel = ordre affiché** (tri par score final décroissant). Les N premiers (selon `nextRoundCandidates` du tour) sont marqués qualifiés (vert clair).

### 3bis. Mon classement (classement personnel par juré)

- **Collection** : `jury_rankings`
- **Document** : `jury_rankings/{juryId_roundId}` (ex. `jury1_round3`).
- **Structure** : `{ juryId, roundId, positions: { "10": candidateId|null, "8": candidateId|null, "6": candidateId|null, "4": candidateId|null, "2": candidateId|null }, updatedAt }`.
- **Usage** : dans l’onglet « Mon classement » (tour type Classement), chaque juré dispose de 5 positions fixes (étiquettes 10, 8, 6, 4, 2) avec menus déroulants listant tous les candidats du tour. Un candidat ne peut être qu’à une position ; en cas de doublon, la position précédente est libérée automatiquement. **Aucune application de points** : les valeurs 10/8/6/4/2 sont des étiquettes uniquement.

### 3ter. Activation classements (admin)

- **Collection** : `classement_activations`
- **Document** : `classement_activations/{classementId}`
- **Structure** : `{ activated: [{ juryId, candidateId, points?, activatedAt? }], updatedAt }`.
- **Usage** : dans l’onglet admin « Activation classements », l’admin peut activer indépendamment chaque couple (juré, candidat) pour lequel le juré a attribué des points dans « Mon classement ». À chaque activation : ajout des points au score du candidat dans le classement, recalcul des rangs, enregistrement dans `activation_logs` (type `classement_jury`). Bouton grisé si le juré n’a pas classé ce candidat (0 point) ; bouton désactivé après activation. L’interface jury affiche une animation de dépassement lorsque le classement est mis à jour.

### 4. Activations (bonus & classements)

- **Document** : `config/activations`
- **Structure** :  
  `{ bonusActif: boolean, classementActif: boolean, classementIdActif: string }`
- Utilisé par l’**Admin** pour activer/désactiver l’affichage bonus et le classement actif. Le jury voit le classement dont l’id est soit celui du tour actif (type Classement), soit `classementIdActif` si configuré.

### 5. Historique des activations (ActivationLog)

- **Collection** : `activation_logs`
- **Structure** (par document) :  
  `{ type: 'bonus_victoire' | 'classement_jury' | 'tour_validated', candidat_id: string, source: string (duel_id, jury_id ou 'admin'), timestamp: Date, payload?: object }`
- Chaque activation (bonus victoire, classement jury, validation de tour) est enregistrée ici pour **historique traçable**. Pas de suppression : ajout uniquement (append-only).
- **Notes Fond/Forme non modifiables** après validation du tour : vérification de `config/validated_rounds` avant toute sauvegarde admin ; verrous (`config/locks`) pour le jury. **Pas de double activation** : vérification de `classement_activations` avant d’activer un couple (juré, candidat). **Aucun recalcul silencieux** : qualification et classement uniquement par action humaine. **État cohérent après rafraîchissement** : relecture de `validated_rounds` et `classement_activations` avant écriture.
- Voir **specs/MODELE_DONNEES.md** et **model.js** pour les objets complets.

---

## Type d’épreuve : Duels

- **Identifiant** : `type_epreuve = "duels"` sur le tour (en plus de `type: "Duels"`).
- Ne remplace pas l’épreuve 1 (notation individuelle) : c’est un type d’épreuve distinct.
- Seule la **logique de notation** change (deux candidats, une note chacun ; pas de score pondéré fond×3+forme).
- Aucune qualification automatique après saisie : les résultats de duels et la qualification sont décidés par action humaine (Admin/Président).

---

## Interdiction de logique automatique globale

- Aucun recalcul de qualification ou de classement déclenché automatiquement après une saisie jury.
- La qualification des candidats (passage au tour suivant, élimination) est faite uniquement via une action explicite (ex. bouton « Qualifier les candidats du tour actif » en admin).
- Les résultats de duels (gagnant) et les classements sont écrits/mis à jour uniquement par Admin/Président, jamais par un calcul automatique global.
