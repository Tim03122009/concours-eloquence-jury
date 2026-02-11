# Tests à faire – Concours d'Éloquence

Ce document résume **tout ce que vous devez faire** pour tester l'application : **tests automatiques** (à lancer en ligne de commande) et **tests manuels** (à exécuter vous‑même dans le navigateur).

---

# Partie 1 – Tests automatiques

## Ce que vous devez faire

1. **Installer les dépendances** (une seule fois)
   ```bash
   cd test
   npm install
   ```

2. **Lancer tous les tests**
   ```bash
   npm test
   ```
   Ou depuis la racine du projet :
   ```bash
   node run-tests.js
   ```

3. **Vérifier** que tous les tests passent (aucune erreur rouge).

## Commandes utiles

| Commande | Rôle |
|----------|------|
| `npm test` | Tous les tests |
| `npm run test:unit` | Tests unitaires uniquement |
| `npm run test:integration` | Tests d'intégration uniquement |
| `npm run test:e2e` | Tests end-to-end uniquement |
| `npm run test:coverage` | Tests + rapport de couverture |
| `npm run test:watch` | Relance les tests à chaque modification |

## Ce qui est testé automatiquement

- **Calcul des scores** : notation (fond×3 + forme), duel (fond+forme coef 1), EL = 0, repêchage.
- **Validation des données** : candidats, scores, jurys, tours, identifiants.
- **Cas limites** : données vides, doublons, sécurité, concurrence.
- **Pages** : présence des éléments critiques dans index.html, classement.html, admin.html.
- **Fonctionnalités métier** : zone qualifiée, verrou session, bonus duel.
- **Intégration** : opérations Firebase (mock), sécurité.
- **Flux** : ajout candidats/jurys, notation, réinitialisation, export (simulés).

**Détail complet** : voir `test/README.md` et `test/TESTS_SUMMARY.md`.

---

# Partie 2 – Tests manuels

À faire **vous‑même** dans le navigateur, avec l’app lancée (serveur local ou Firebase).

## Préparation (une fois)

- [ ] Lancer l’app (ex. `npx http-server -p 8000` ou Firebase).
- [ ] Ouvrir **Admin** : `http://localhost:8000/admin.html`.
- [ ] Ouvrir **Jury** : `http://localhost:8000/index.html`.
- [ ] Réinitialiser puis **Insérer candidats et jurys de test** (onglet Réinitialiser).

---

## Checklist – Admin

### Candidats
- [ ] Ajouter un candidat (nom, ID) et vérifier qu’il apparaît.
- [ ] Modifier le statut (ex. Qualifié) et le tour d’un candidat.
- [ ] Supprimer un candidat (avec confirmation).

### Jurys
- [ ] Ajouter un jury (nom, identifiant, mot de passe).
- [ ] Définir un jury comme président (un seul à la fois).
- [ ] Configurer les tours de présence d’un jury.
- [ ] Changer le mot de passe d’un jury puis se connecter avec le nouveau.
- [ ] Supprimer un jury.

### Tours
- [ ] Afficher les tours, modifier un tour (nom, type, nombre de qualifiés).
- [ ] Changer le tour actif et vérifier qu’il s’affiche côté jury.
- [ ] Terminer un tour et vérifier le passage au suivant.

### Notes
- [ ] Afficher les notes d’un tour (dropdown), modifier une note (5, 10, 15, 20, EL).
- [ ] Vérifier que le score total se recalcule.
- [ ] Pour un tour repêchage : vérifier colonne « Score tour précédent » et note président (0/1).
- [ ] Filtrer « Candidats en cours uniquement », trier par ID puis par Score.

### Podium
- [ ] Choisir un tour, vérifier le classement (Rang, Candidat, Score).
- [ ] Vérifier que le **classement final** inclut bien les points « Mon classement » et le bonus duel +10 % (sans dépendre de l’onglet Activation classements).
- [ ] Changer le nombre de candidats affichés, exporter en image.

### Duels
- [ ] Sélectionner un tour Duels, ajouter un duel (candidat 1, candidat 2).
- [ ] Définir le gagnant (bouton vert) et vérifier l’enregistrement.

### Épreuve duel (notation)
- [ ] Côté Jury, sur un tour Duels : vérifier les libellés **Fond (×1)** et **Forme (×1)**.
- [ ] Noter deux candidats (ex. 10+15 et 12+8), valider.
- [ ] Côté Admin → Notes (tour Duels) : vérifier scores 25 et 20 (et non 45/44).

### Activation classements
- [ ] Sélectionner un tour, afficher la grille (candidats × jurys).
- [ ] Activer des points pour un candidat (bouton « + X »), vérifier que le classement se met à jour.
- [ ] Activer/désactiver le bonus duel (🏆) pour un gagnant de duel.

### Réinitialisation et export
- [ ] Auto-remplir les notes (Réinitialiser), vérifier les notes générées.
- [ ] Exporter les notes en CSV, exporter les résultats (Podium) en CSV.
- [ ] Télécharger la base (JSON), puis restaurer depuis ce fichier.

---

## Checklist – Jury

### Connexion
- [ ] Connexion réussie (ex. jury1 / password123).
- [ ] Connexion échouée (mauvais identifiants) → message d’erreur.
- [ ] Accès refusé si le jury n’est pas sur le tour actif.
- [ ] Repêchage : seul le président accède à l’interface repêchage.

### Notation normale
- [ ] Sélectionner un candidat, choisir Fond et Forme (5, 10, 15, 20 ou Éliminé).
- [ ] Valider la notation, vérifier confirmation et réinitialisation.
- [ ] Pour un candidat déjà noté : affichage en lecture seule, pas de modification.

### Repêchage (président)
- [ ] Afficher les colonnes Qualifiés / Éliminés.
- [ ] Déplacer des candidats entre les deux colonnes.
- [ ] Finaliser avec le bon nombre de qualifiés, afficher le podium puis terminer.

### Autre
- [ ] Changer le mot de passe (menu ☰), se déconnecter, se reconnecter avec le nouveau mot de passe.

---

## Checklist – Bout en bout et régression

- [ ] **Scénario complet** : données de test → notation tour 1 par les 3 jurys → terminer le tour → repêchage président → tour 2 → vérifier podium final.
- [ ] **Multi-utilisateurs** : Admin + 3 onglets Jury, notation en parallèle ; vérifier mise à jour en temps réel dans l’admin.
- [ ] **Régression** : après une modification du code, refaire au moins les cases critiques (connexion, notation, podium, export).

---

## Résumé rapide

| Où | Quoi |
|----|------|
| **Terminal** | `cd test` → `npm install` → `npm test` |
| **Admin** | Candidats, Jurys, Tours, Notes, Podium (classement final), Duels, Activation classements, Réinitialiser, Export |
| **Jury** | Connexion, notation (normale + duel ×1), repêchage (président), mot de passe |
| **Bout en bout** | Scénario complet + multi-utilisateurs |

Pour le **détail des procédures** (étapes pas à pas, résultats attendus, performance, rapport de bugs), voir **`test/manuel.md`**.
