# Manuel de Tests - Concours d'Éloquence

## 📋 Table des matières

1. [Introduction](#introduction)
2. [Prérequis](#prérequis)
3. [Configuration de l'environnement de test](#configuration-de-lenvironnement-de-test)
4. [Tests manuels - Interface Administrateur](#tests-manuels---interface-administrateur)
5. [Tests manuels - Interface Jury](#tests-manuels---interface-jury)
6. [Tests de bout en bout](#tests-de-bout-en-bout)
7. [Tests de régression](#tests-de-régression)
8. [Tests de performance](#tests-de-performance)
9. [Checklist de validation](#checklist-de-validation)
10. [Rapport de bugs](#rapport-de-bugs)

---

## Introduction

Ce document décrit les procédures de tests manuels complémentaires aux tests automatiques. Il couvre les scénarios utilisateur réels et les cas d'usage avancés qui nécessitent une validation humaine.

### Objectifs des tests manuels

- ✅ Valider l'ergonomie et l'expérience utilisateur
- ✅ Tester les interactions complexes entre composants
- ✅ Vérifier la cohérence visuelle
- ✅ Identifier les bugs d'interface
- ✅ Valider les workflows complets

### Résumé : tests manuels à faire (checklist rapide)

| # | À faire | Où |
|---|--------|-----|
| 1 | Gestion des candidats (ajouter, modifier, supprimer, tour) | Admin → Candidats |
| 2 | Gestion des jurys (ajouter, président, tours, MDP, supprimer) | Admin → Jurys |
| 3 | Gestion des tours (créer, modifier, actif, terminer) | Admin → Tours |
| 4 | Tableau de notes (afficher, modifier, filtre, tri, repêchage) | Admin → Notes |
| 5 | Podium (classement, couleurs, export image) | Admin → Podium |
| 6 | **Épreuve duel** : notation fond×1 + forme×1, gagnants duels | Admin → Duels ; Jury → Notation duel |
| 7 | Auto-remplissage et réinitialisation | Admin → Réinitialiser |
| 8 | Export CSV / JSON, restauration | Admin → Notes, Podium, Réinitialiser |
| 9 | Connexion jury (succès, échec, accès tour, repêchage président) | index.html |
| 10 | Notation normale (candidat, notes, valider, lecture seule, EL) | Jury → Notation |
| 11 | Repêchage président (colonnes, déplacer, finaliser, podium) | Jury (président) |
| 12 | Changement de mot de passe jury | Jury → Menu ☰ |
| 13 | Scénario complet (tour 1 → repêchage → tour 2 → … → finale) | Admin + plusieurs jurys |
| 14 | Synchronisation multi-utilisateurs (plusieurs onglets) | Admin + 3 jurys en parallèle |
| 15 | Régression (checklist rapide après une modif) | Toute l’app |
| 16 | Performance (200 candidats, 2000 scores) | Optionnel |

Le détail de chaque test est décrit ci-dessous. Pour une validation avant mise en production, voir la [Checklist de validation](#checklist-de-validation).

---

## Prérequis

### Matériel nécessaire

- [ ] Ordinateur avec navigateur moderne (Chrome, Firefox, Safari, Edge)
- [ ] Connexion Internet (pour Firebase)
- [ ] Plusieurs fenêtres/onglets de navigateur (pour tester multi-utilisateurs)
- [ ] Optionnel : Tablette ou smartphone pour tests responsive

### Connaissances requises

- Connaissance de base de l'application
- Accès aux identifiants de test (admin + jurys)
- Familiarité avec les outils de développement du navigateur (F12)

### Documents de référence

- [README.md](../README.md) - Documentation principale
- [SPEC.md](../specs/SPEC.md) - Spécifications fonctionnelles
- [Tests automatiques](./README.md) - Documentation des tests auto

---

## Configuration de l'environnement de test

### Étape 1 : Lancer l'application

```bash
# Option 1 : Firebase Emulators (recommandé pour les tests)
firebase emulators:start

# Option 2 : Serveur HTTP simple
python3 -m http.server 8000
# ou
npx http-server -p 8000
```

### Étape 2 : Accéder aux interfaces

- **Interface Admin** : `http://localhost:8000/admin.html`
- **Interface Jury** : `http://localhost:8000/index.html`

### Étape 3 : Préparer les données de test

1. Ouvrir l'interface Admin
2. Aller dans l'onglet **Réinitialiser**
3. Cliquer sur **Insérer candidats et jurys de test**
4. Vérifier que :
   - 20 candidats sont créés
   - 3 jurys sont créés (jury1, jury2, jury3)
   - Le premier jury est défini comme président

---

## Tests manuels - Interface Administrateur

### TEST 1 : Gestion des candidats

#### Objectif
Vérifier la création, modification et suppression de candidats.

#### Procédure

1. **Ajouter un candidat**
   - [ ] Aller dans l'onglet **Candidats**
   - [ ] Entrer un nom : "Test Candidat"
   - [ ] Entrer un ID : "TEST001"
   - [ ] Cliquer sur **Ajouter**
   - [ ] **Vérifier** : Le candidat apparaît dans la liste
   - [ ] **Vérifier** : Le statut est "Actif"
   - [ ] **Vérifier** : Le tour est "round1"

2. **Modifier le statut d'un candidat**
   - [ ] Sélectionner le candidat créé
   - [ ] Changer le statut en "Qualifié" via le dropdown
   - [ ] Rafraîchir la page
   - [ ] **Vérifier** : Le statut est conservé après rechargement

3. **Changer le tour d'un candidat**
   - [ ] Sélectionner un candidat
   - [ ] Changer le tour via le dropdown
   - [ ] **Vérifier** : Le candidat apparaît dans le nouveau tour

4. **Supprimer un candidat**
   - [ ] Cliquer sur le bouton **Supprimer** (🗑️) à côté d'un candidat
   - [ ] **Vérifier** : Une confirmation est demandée
   - [ ] Confirmer la suppression
   - [ ] **Vérifier** : Le candidat disparaît de la liste

#### Résultats attendus
- ✅ Toutes les opérations CRUD fonctionnent correctement
- ✅ Les modifications sont persistantes après rechargement
- ✅ Les confirmations sont affichées pour les actions critiques

---

### TEST 2 : Gestion des jurys

#### Objectif
Vérifier la création et configuration des jurys, notamment la gestion du président et des tours de présence.

#### Procédure

1. **Ajouter un jury**
   - [ ] Aller dans l'onglet **Jury**
   - [ ] Entrer un nom : "M. Test"
   - [ ] Entrer un nom d'utilisateur : "test_jury"
   - [ ] Entrer un mot de passe : "password123"
   - [ ] Cliquer sur **Ajouter jury**
   - [ ] **Vérifier** : Le jury apparaît dans la liste

2. **Définir un président**
   - [ ] Cocher le radio button "Président" pour un jury
   - [ ] **Vérifier** : Le radio button des autres jurys se décoche automatiquement
   - [ ] **Vérifier** : Les tours de repêchage sont automatiquement cochés pour le président
   - [ ] Rafraîchir la page
   - [ ] **Vérifier** : La configuration du président est conservée

3. **Configurer les tours de présence**
   - [ ] Pour un jury non-président, décocher un tour
   - [ ] Rafraîchir la page
   - [ ] **Vérifier** : La configuration est conservée
   - [ ] **Vérifier** : Le jury ne peut pas accéder au tour décoché (test dans interface jury)

4. **Changer le mot de passe d'un jury**
   - [ ] Cliquer sur "Changer MDP" pour un jury
   - [ ] Entrer un nouveau mot de passe
   - [ ] Confirmer
   - [ ] **Vérifier** : Une confirmation est affichée
   - [ ] Tester la connexion avec le nouveau mot de passe

5. **Supprimer un jury**
   - [ ] Cliquer sur le bouton **Supprimer** à côté d'un jury
   - [ ] Confirmer la suppression
   - [ ] **Vérifier** : Le jury disparaît
   - [ ] Aller dans l'onglet **Notes**
   - [ ] **Vérifier** : Les notes du jury supprimé n'apparaissent plus

#### Résultats attendus
- ✅ Un seul président peut être défini à la fois
- ✅ Le président a automatiquement accès aux tours de repêchage
- ✅ La configuration des tours de présence est respectée
- ✅ Le changement de mot de passe fonctionne immédiatement

---

### TEST 3 : Gestion des tours

#### Objectif
Vérifier la configuration et la progression des tours de compétition.

#### Procédure

1. **Afficher les tours par défaut**
   - [ ] Aller dans l'onglet **Tours**
   - [ ] **Vérifier** : 6 tours sont définis par défaut
   - [ ] **Vérifier** : Les tours alternent Normal/Repêchage
   - [ ] **Vérifier** : Les ordres sont séquentiels (1, 2, 3, 4, 5, 6)

2. **Modifier un tour**
   - [ ] Changer le nom d'un tour
   - [ ] Changer le type (Normal ↔ Repêchage)
   - [ ] Changer le nombre de candidats qualifiés
   - [ ] Rafraîchir la page
   - [ ] **Vérifier** : Toutes les modifications sont conservées

3. **Ajouter un nouveau tour**
   - [ ] Cliquer sur **Ajouter un tour**
   - [ ] Remplir les informations
   - [ ] **Vérifier** : Le tour apparaît dans la liste
   - [ ] **Vérifier** : L'ordre est automatiquement calculé

4. **Supprimer un tour**
   - [ ] Cliquer sur le bouton **Supprimer** d'un tour
   - [ ] Confirmer
   - [ ] **Vérifier** : Le tour disparaît
   - [ ] **Vérifier** : Les ordres des autres tours s'ajustent si nécessaire

5. **Réinitialiser aux tours par défaut**
   - [ ] Aller dans **Réinitialiser**
   - [ ] Cliquer sur **Remettre les tours par défaut**
   - [ ] Confirmer
   - [ ] Retourner dans l'onglet **Tours**
   - [ ] **Vérifier** : Les 6 tours par défaut sont restaurés

6. **Changer le tour actif**
   - [ ] Dans l'onglet **Tours**, noter le tour actif actuel
   - [ ] Sélectionner un autre tour dans le dropdown "Tour actif"
   - [ ] Cliquer sur **Changer le tour actif**
   - [ ] **Vérifier** : Le badge "Tour actif" se déplace
   - [ ] Ouvrir l'interface Jury dans un autre onglet
   - [ ] **Vérifier** : Le jury voit le nouveau tour actif

7. **Terminer un tour**
   - [ ] Sélectionner le tour actif
   - [ ] Cliquer sur **Terminer le tour et passer au suivant**
   - [ ] Confirmer
   - [ ] **Vérifier** : Le tour actif passe au suivant
   - [ ] **Vérifier** : Les candidats sont qualifiés/éliminés selon leurs notes

#### Résultats attendus
- ✅ La configuration des tours est flexible et persistante
- ✅ Le changement de tour actif se propage aux jurys connectés
- ✅ La terminaison d'un tour déclenche les actions appropriées

---

### TEST 4 : Tableau de notes

#### Objectif
Vérifier l'affichage et la modification des notes dans l'interface admin.

#### Procédure

1. **Afficher les notes d'un tour normal**
   - [ ] Aller dans l'onglet **Notes**
   - [ ] Sélectionner "round1" dans le dropdown
   - [ ] **Vérifier** : Les candidats du tour 1 sont affichés
   - [ ] **Vérifier** : Les colonnes des jurys présents sur ce tour sont affichées
   - [ ] **Vérifier** : Chaque jury a 2 colonnes de notes

2. **Modifier une note**
   - [ ] Changer la valeur d'une note via le dropdown (5, 10, 15, 20, EL)
   - [ ] **Vérifier** : La note est mise à jour immédiatement
   - [ ] **Vérifier** : Le score total est recalculé automatiquement
   - [ ] Rafraîchir la page
   - [ ] **Vérifier** : La modification est conservée

3. **Afficher les notes d'un tour de repêchage**
   - [ ] Terminer le round1 pour activer le repêchage
   - [ ] Aller dans l'onglet **Notes**
   - [ ] Sélectionner le tour de repêchage
   - [ ] **Vérifier** : La colonne "Score (tour précédent)" affiche les totaux du tour précédent
   - [ ] **Vérifier** : Seul le président a une colonne de note (0 ou 1)
   - [ ] Changer une note de repêchage de 1 à 0
   - [ ] **Vérifier** : Le score affiché devient 0

4. **Filtrer les candidats en cours**
   - [ ] Cocher "Candidats en cours uniquement"
   - [ ] **Vérifier** : Seuls les candidats "Actif" ou "Reset" sont affichés
   - [ ] Décocher
   - [ ] **Vérifier** : Tous les candidats réapparaissent

5. **Trier le tableau**
   - [ ] Cliquer sur l'en-tête "ID"
   - [ ] **Vérifier** : Le tri se fait par ID (croissant/décroissant)
   - [ ] Cliquer sur l'en-tête "Score"
   - [ ] **Vérifier** : Le tri se fait par score

#### Résultats attendus
- ✅ Les notes sont affichées correctement selon le type de tour
- ✅ Les modifications sont persistantes
- ✅ Les filtres et tris fonctionnent correctement
- ✅ Le calcul des scores est correct (EL = 0, repêchage avec tour précédent)

---

### TEST 5 : Podium

#### Objectif
Vérifier l'affichage du classement des candidats.

#### Procédure

1. **Afficher le podium d'un tour normal**
   - [ ] Aller dans l'onglet **Podium**
   - [ ] Sélectionner "round1"
   - [ ] **Vérifier** : Les candidats sont classés par score décroissant
   - [ ] **Vérifier** : Le top 3 a des couleurs distinctes (or, argent, bronze)
   - [ ] **Vérifier** : Les candidats éliminés n'apparaissent pas

2. **Afficher le podium d'un tour de repêchage**
   - [ ] Sélectionner un tour de repêchage
   - [ ] **Vérifier** : Les scores affichés correspondent aux scores du tour précédent
   - [ ] **Vérifier** : Les candidats avec note 0 du président ont un score de 0
   - [ ] **Vérifier** : Les candidats avec note 1 du président conservent leur score

3. **Modifier le nombre de résultats affichés**
   - [ ] Changer le nombre dans "Limiter à : X résultats"
   - [ ] **Vérifier** : Le nombre de lignes affichées correspond

4. **Exporter le podium en image**
   - [ ] Cliquer sur **Exporter en image**
   - [ ] **Vérifier** : Une image PNG est téléchargée
   - [ ] Ouvrir l'image
   - [ ] **Vérifier** : Le podium est correctement capturé

#### Résultats attendus
- ✅ Le classement est correct et cohérent avec les notes
- ✅ Les couleurs du podium sont appliquées correctement
- ✅ Les candidats éliminés sont exclus
- ✅ L'export en image fonctionne

---

### TEST 6 : Auto-remplissage et réinitialisation

#### Objectif
Vérifier les fonctions d'automatisation et de remise à zéro.

#### Procédure

1. **Auto-remplir les notes**
   - [ ] Aller dans **Réinitialiser**
   - [ ] Cliquer sur **Auto-remplir et qualifier le tour actif**
   - [ ] Confirmer
   - [ ] **Vérifier** : Un message indique le nombre de notes créées
   - [ ] Aller dans **Notes**
   - [ ] **Vérifier** : Toutes les notes sont remplies avec des valeurs aléatoires (5, 10, 15, 20)
   - [ ] **Vérifier** : Environ 15% des candidats ont au moins une note "EL"
   - [ ] **Vérifier** : Les candidats avec toutes les notes sont passés en "Qualifié"

2. **Réinitialiser les notes d'un tour**
   - [ ] Cliquer sur **Réinitialiser les notes du tour actif**
   - [ ] Confirmer
   - [ ] Aller dans **Notes**
   - [ ] **Vérifier** : Toutes les notes du tour actif sont supprimées
   - [ ] **Vérifier** : Les candidats repassent en statut "Actif"

3. **Réinitialiser tous les scores et tours**
   - [ ] Cliquer sur **Réinitialiser tous les scores et tours**
   - [ ] Confirmer
   - [ ] **Vérifier** : Toutes les notes de tous les tours sont supprimées
   - [ ] **Vérifier** : Tous les candidats sont en "Actif" au tour 1
   - [ ] **Vérifier** : Le tour actif est "round1"
   - [ ] **Vérifier** : La configuration des tours est réinitialisée aux valeurs par défaut

4. **Réinitialisation complète**
   - [ ] Cliquer sur **RÉINITIALISER TOUT**
   - [ ] Confirmer (attention : action irréversible)
   - [ ] **Vérifier** : Tous les candidats sont supprimés
   - [ ] **Vérifier** : Tous les jurys sont supprimés
   - [ ] **Vérifier** : Toutes les notes sont supprimées

#### Résultats attendus
- ✅ L'auto-remplissage génère des notes réalistes
- ✅ Les réinitialisations fonctionnent selon leur portée
- ✅ Les confirmations sont demandées pour toutes les actions destructives
- ✅ Les données sont correctement restaurées ou supprimées

---

### TEST 6b : Épreuve duel (notation et gagnants)

#### Objectif
Vérifier que pour l’épreuve **Duels**, les notes Fond et Forme ont le **même coefficient 1** (score = fond + forme), et que la gestion des duels et gagnants fonctionne.

#### Procédure

1. **Configurer un tour Duels**
   - [ ] Aller dans l’onglet **Tours**
   - [ ] Créer ou modifier un tour en type **Duels** (ex. « 2ème tour », « Demi-finale »)
   - [ ] Activer ce tour comme tour actif (ou le sélectionner pour les tests)
   - [ ] S’assurer que des candidats sont affectés à ce tour

2. **Notation duel côté jury**
   - [ ] Ouvrir l’interface Jury (`index.html`)
   - [ ] Se connecter avec un jury ayant accès au tour Duels
   - [ ] **Vérifier** : L’interface affiche « Duel - Fond (×1) et Forme (×1) » (et non ×3 pour le fond)
   - [ ] Choisir Candidat 1 et Candidat 2
   - [ ] Noter : par ex. Candidat 1 → Fond 10, Forme 15 ; Candidat 2 → Fond 12, Forme 8
   - [ ] Valider le duel
   - [ ] **Vérifier** : Message de succès

3. **Vérifier le calcul des scores (coef 1)**
   - [ ] Dans l’admin, aller dans **Notes**
   - [ ] Sélectionner le tour de type Duels
   - [ ] **Vérifier** : Pour Candidat 1, score = 10 + 15 = **25** (et non 10×3+15 = 45)
   - [ ] **Vérifier** : Pour Candidat 2, score = 12 + 8 = **20**
   - [ ] **Vérifier** : Le classement du tour duel est trié selon ces scores (25 puis 20)

4. **Comparer avec un tour Notation individuelle**
   - [ ] Sélectionner un tour « Notation individuelle » (ex. round1)
   - [ ] **Vérifier** : Les scores sont bien fond×3 + forme (ex. 10 et 15 → 45)
   - [ ] Confirmer que seul le tour Duels utilise fond + forme

5. **Gagnants de duel (admin)**
   - [ ] Aller dans l’onglet **Duels**
   - [ ] Sélectionner le tour Duels
   - [ ] Ajouter un duel (choisir deux candidats)
   - [ ] Cliquer sur un candidat pour le désigner gagnant (bouton vert)
   - [ ] **Vérifier** : Le gagnant est enregistré et l’affichage se met à jour
   - [ ] **Vérifier** : Côté jury, l’onglet « Gagnants de duel » affiche les duels et permet d’enregistrer le gagnant si prévu

#### Résultats attendus
- ✅ En duel : score = fond + forme (coefficient 1 pour chacun)
- ✅ En notation individuelle : score = fond×3 + forme (inchangé)
- ✅ Les libellés jury pour le duel indiquent bien « Coefficient ×1 » pour le fond
- ✅ Création de duels et désignation des gagnants fonctionnent

---

### TEST 7 : Export des données

#### Objectif
Vérifier les fonctions d'export CSV et de sauvegarde/restauration.

#### Procédure

1. **Exporter les notes individuelles en CSV**
   - [ ] Aller dans **Notes**
   - [ ] Cliquer sur **Exporter en CSV (Notes individuelles)**
   - [ ] **Vérifier** : Un fichier CSV est téléchargé
   - [ ] Ouvrir le fichier dans Excel/LibreOffice
   - [ ] **Vérifier** : Les colonnes sont : Candidat, Jury1, Jury2, ..., Total
   - [ ] **Vérifier** : Les notes "EL" sont remplacées par "0"
   - [ ] **Vérifier** : Les accents et caractères spéciaux sont corrects (UTF-8)

2. **Exporter les résultats agrégés en CSV**
   - [ ] Aller dans **Podium**
   - [ ] Cliquer sur **Exporter en CSV (Résultats)**
   - [ ] **Vérifier** : Un fichier CSV est téléchargé
   - [ ] Ouvrir le fichier
   - [ ] **Vérifier** : Les colonnes incluent les scores détaillés par jury et le total

3. **Télécharger la base de données**
   - [ ] Aller dans **Réinitialiser**
   - [ ] Cliquer sur **Télécharger la base de données**
   - [ ] **Vérifier** : Un fichier JSON est téléchargé
   - [ ] Ouvrir le fichier dans un éditeur
   - [ ] **Vérifier** : Le JSON contient les candidats, scores, accounts, config

4. **Restaurer depuis un fichier**
   - [ ] Cliquer sur **Restaurer depuis un fichier**
   - [ ] Sélectionner le fichier JSON précédemment téléchargé
   - [ ] Confirmer
   - [ ] **Vérifier** : Un message de succès est affiché
   - [ ] **Vérifier** : Les données sont restaurées correctement dans tous les onglets

#### Résultats attendus
- ✅ Les exports CSV sont correctement formatés
- ✅ L'encodage UTF-8 est respecté
- ✅ La sauvegarde/restauration JSON fonctionne
- ✅ Toutes les données sont préservées lors de la restauration

---

## Tests manuels - Interface Jury

### TEST 8 : Connexion du jury

#### Objectif
Vérifier le processus d'authentification et les contrôles d'accès.

#### Procédure

1. **Connexion réussie**
   - [ ] Ouvrir `index.html`
   - [ ] Entrer les identifiants : `jury1` / `password123`
   - [ ] Cliquer sur **Connexion**
   - [ ] **Vérifier** : L'interface de notation s'affiche
   - [ ] **Vérifier** : Le nom du jury est affiché en haut
   - [ ] **Vérifier** : Le tour actif est affiché

2. **Connexion échouée**
   - [ ] Se déconnecter
   - [ ] Entrer des identifiants incorrects
   - [ ] Cliquer sur **Connexion**
   - [ ] **Vérifier** : Un message d'erreur est affiché
   - [ ] **Vérifier** : L'utilisateur reste sur la page de connexion

3. **Accès refusé à un tour non autorisé**
   - [ ] Dans l'admin, décocher un tour pour jury1
   - [ ] Dans l'admin, activer ce tour
   - [ ] Se connecter avec jury1
   - [ ] **Vérifier** : Un message indique que le jury n'a pas accès
   - [ ] **Vérifier** : Le jury est déconnecté automatiquement

4. **Accès au repêchage - président uniquement**
   - [ ] Dans l'admin, activer un tour de repêchage
   - [ ] Se connecter avec un jury non-président
   - [ ] **Vérifier** : Un message indique que seul le président peut accéder
   - [ ] **Vérifier** : Le nom du président est mentionné dans le message
   - [ ] Se déconnecter et se connecter avec le président
   - [ ] **Vérifier** : L'interface de repêchage s'affiche

#### Résultats attendus
- ✅ L'authentification fonctionne correctement
- ✅ Les contrôles d'accès par tour sont respectés
- ✅ Les messages d'erreur sont clairs et informatifs

---

### TEST 9 : Notation normale

#### Objectif
Vérifier le processus de notation standard avec deux notes par candidat.

#### Procédure

1. **Sélectionner un candidat**
   - [ ] Connecté en tant que jury
   - [ ] Ouvrir le dropdown "Sélectionner un candidat"
   - [ ] **Vérifier** : Seuls les candidats "Actif" du tour actif sont listés
   - [ ] Sélectionner un candidat
   - [ ] **Vérifier** : Le nom du candidat s'affiche sous le dropdown

2. **Attribuer les notes**
   - [ ] Cliquer sur un bouton de note pour "Première Note" (5, 10, 15, 20, ou Éliminé)
   - [ ] **Vérifier** : Le bouton est surligné
   - [ ] **Vérifier** : La note s'affiche sous la grille
   - [ ] Cliquer sur un bouton de note pour "Deuxième Note"
   - [ ] **Vérifier** : Les deux notes sont sélectionnées
   - [ ] **Vérifier** : Le bouton "Valider la notation" est activé

3. **Valider la notation**
   - [ ] Cliquer sur **Valider la notation**
   - [ ] **Vérifier** : Un message de confirmation est affiché
   - [ ] **Vérifier** : Les notes sont réinitialisées
   - [ ] **Vérifier** : Le candidat disparaît de la liste (déjà noté)

4. **Modifier une note existante (déconseillé)**
   - [ ] Dans l'admin, réactiver l'affichage du candidat noté
   - [ ] Dans l'interface jury, rafraîchir la liste
   - [ ] Sélectionner le candidat déjà noté
   - [ ] **Vérifier** : Les notes existantes sont affichées en gris (lecture seule)
   - [ ] **Vérifier** : Les boutons de note sont désactivés
   - [ ] **Vérifier** : Un message indique "Candidat déjà noté - Affichage en lecture seule"
   - [ ] **Vérifier** : Le bouton "Valider" reste désactivé

5. **Note "Éliminé"**
   - [ ] Sélectionner un nouveau candidat
   - [ ] Cliquer sur le bouton **Éliminé** pour la première note
   - [ ] **Vérifier** : La note "EL" est sélectionnée
   - [ ] Attribuer une deuxième note normale
   - [ ] Valider
   - [ ] Dans l'admin, vérifier que la note "EL" est enregistrée
   - [ ] **Vérifier** : Le score de ce jury pour ce candidat est 0

#### Résultats attendus
- ✅ Le processus de notation est fluide et intuitif
- ✅ Les validations fonctionnent correctement
- ✅ Les notes existantes sont affichées en lecture seule
- ✅ Les notes "Éliminé" sont correctement traitées

---

### TEST 10 : Interface de repêchage (Président)

#### Objectif
Vérifier l'interface spécifique de repêchage avec déplacement de candidats.

#### Procédure

1. **Initialisation du repêchage**
   - [ ] Dans l'admin, terminer un tour et activer un repêchage
   - [ ] Se connecter avec le président
   - [ ] **Vérifier** : L'interface de repêchage s'affiche
   - [ ] **Vérifier** : Le titre indique le nombre exact de candidats à qualifier
   - [ ] **Vérifier** : Deux colonnes sont affichées : "Qualifiés" et "Éliminés"
   - [ ] **Vérifier** : Les candidats initialement qualifiés (top N) sont en vert
   - [ ] **Vérifier** : Les candidats initialement éliminés sont en rouge
   - [ ] **Vérifier** : Les candidats sont répartis selon leur classement initial

2. **Déplacer un candidat de Qualifié à Éliminé**
   - [ ] Cliquer sur un candidat dans la colonne "Qualifiés"
   - [ ] **Vérifier** : Le candidat se déplace immédiatement dans "Éliminés"
   - [ ] **Vérifier** : Les compteurs sont mis à jour
   - [ ] **Vérifier** : Le score du candidat passe à 0 en temps réel

3. **Déplacer un candidat d'Éliminé à Qualifié**
   - [ ] Cliquer sur un candidat dans la colonne "Éliminés"
   - [ ] **Vérifier** : Le candidat se déplace dans "Qualifiés"
   - [ ] **Vérifier** : Le score du candidat redevient celui du tour précédent

4. **Validation du nombre de qualifiés**
   - [ ] Ajuster les candidats pour avoir le nombre exact requis de qualifiés
   - [ ] **Vérifier** : Le bouton "Finaliser et valider" est activé
   - [ ] Retirer un qualifié pour avoir un nombre incorrect
   - [ ] **Vérifier** : Le bouton se désactive
   - [ ] **Vérifier** : Un message d'aide indique le nombre requis

5. **Finaliser le repêchage**
   - [ ] Ajuster pour avoir le bon nombre de qualifiés
   - [ ] Cliquer sur **Finaliser et valider les statuts**
   - [ ] Confirmer
   - [ ] **Vérifier** : Un message de succès est affiché
   - [ ] **Vérifier** : Le podium des résultats s'affiche
   - [ ] **Vérifier** : Les candidats sont classés correctement
   - [ ] **Vérifier** : Les scores correspondent aux choix du président
   - [ ] **Vérifier** : Un bouton "Terminer" est centré en bas

6. **Vérification post-repêchage**
   - [ ] Cliquer sur **Terminer**
   - [ ] **Vérifier** : Le président est déconnecté
   - [ ] Dans l'admin, aller dans **Notes**
   - [ ] Sélectionner le tour de repêchage
   - [ ] **Vérifier** : Les statuts "Qualifié" / "Éliminé" sont corrects
   - [ ] **Vérifier** : Les notes 0/1 correspondent aux choix

#### Résultats attendus
- ✅ L'interface de repêchage est intuitive et responsive
- ✅ Les déplacements sont instantanés et persistent
- ✅ La validation du nombre de qualifiés est stricte
- ✅ Le podium final affiche les bons scores
- ✅ Les statuts des candidats sont mis à jour correctement

---

### TEST 11 : Changement de mot de passe (Jury)

#### Objectif
Vérifier que les jurys peuvent changer leur mot de passe.

#### Procédure

1. **Accéder à la fonction**
   - [ ] Connecté en tant que jury
   - [ ] Cliquer sur le menu hamburger (☰)
   - [ ] Cliquer sur **Changer le mot de passe**
   - [ ] **Vérifier** : Une boîte de dialogue s'affiche

2. **Changer le mot de passe**
   - [ ] Entrer l'ancien mot de passe : `password123`
   - [ ] Entrer un nouveau mot de passe : `newpass456`
   - [ ] Confirmer le nouveau mot de passe : `newpass456`
   - [ ] **Vérifier** : Un message de succès est affiché
   - [ ] Se déconnecter

3. **Vérifier le nouveau mot de passe**
   - [ ] Se reconnecter avec l'ancien mot de passe
   - [ ] **Vérifier** : La connexion échoue
   - [ ] Se reconnecter avec le nouveau mot de passe
   - [ ] **Vérifier** : La connexion réussit

4. **Cas d'erreur**
   - [ ] Changer le mot de passe avec un ancien mot de passe incorrect
   - [ ] **Vérifier** : Un message d'erreur est affiché
   - [ ] Changer avec des mots de passe de confirmation différents
   - [ ] **Vérifier** : Un message d'erreur est affiché

#### Résultats attendus
- ✅ Le changement de mot de passe fonctionne
- ✅ L'ancien mot de passe est immédiatement invalidé
- ✅ Les validations empêchent les erreurs

---

## Tests de bout en bout

### TEST 12 : Scénario complet de compétition

#### Objectif
Simuler un concours complet du début à la fin avec plusieurs jurys.

#### Procédure

**Préparation (Admin)**
1. [ ] Réinitialiser toutes les données
2. [ ] Insérer 20 candidats de test
3. [ ] Insérer 3 jurys de test
4. [ ] Vérifier que jury1 est président
5. [ ] Configurer les tours par défaut

**Tour 1 - Notation (Jurys)**
6. [ ] Ouvrir 3 onglets pour les 3 jurys
7. [ ] Se connecter avec chaque jury
8. [ ] Pour chaque jury, noter tous les candidats
9. [ ] **Vérifier** : Les notes apparaissent en temps réel dans l'admin
10. [ ] **Vérifier** : Les candidats passent progressivement en "Qualifié"

**Fin du Tour 1 (Admin)**
11. [ ] Vérifier que tous les candidats sont notés
12. [ ] Aller dans **Tours**
13. [ ] Cliquer sur **Terminer le tour et passer au suivant**
14. [ ] **Vérifier** : Le tour actif passe à "Repêchage 1"
15. [ ] **Vérifier** : Les candidats non qualifiés passent en "Éliminé"
16. [ ] **Vérifier** : Les jurys non-présidents connectés sont déconnectés

**Repêchage 1 (Président)**
17. [ ] Le président (jury1) reste connecté ou se reconnecte
18. [ ] **Vérifier** : L'interface de repêchage s'affiche
19. [ ] Déplacer des candidats entre les colonnes
20. [ ] Ajuster pour avoir le bon nombre de qualifiés
21. [ ] Finaliser et valider
22. [ ] **Vérifier** : Le podium s'affiche
23. [ ] **Vérifier** : Les scores sont corrects
24. [ ] Cliquer sur "Terminer"

**Tour 2 - Notation (Jurys)**
25. [ ] Tous les jurys se reconnectent
26. [ ] Noter les candidats du Tour 2
27. [ ] Terminer le tour (admin)

**Répéter** pour les tours suivants jusqu'à la finale

**Finale - Podium**
28. [ ] Aller dans **Podium** (admin)
29. [ ] Sélectionner le tour "Finale"
30. [ ] **Vérifier** : Le classement final est correct
31. [ ] **Vérifier** : Les 3 premiers ont les bonnes couleurs
32. [ ] Exporter le podium en image
33. [ ] Exporter les résultats en CSV

#### Résultats attendus
- ✅ Le workflow complet fonctionne de bout en bout
- ✅ Les transitions entre tours sont fluides
- ✅ Les données sont cohérentes à chaque étape
- ✅ Les exports finaux sont corrects

---

### TEST 13 : Synchronisation multi-utilisateurs

#### Objectif
Vérifier que plusieurs utilisateurs peuvent travailler simultanément sans conflit.

#### Procédure

1. **Préparation**
   - [ ] Ouvrir 4 onglets de navigateur
   - [ ] Onglet 1 : Admin
   - [ ] Onglets 2, 3, 4 : Jurys (jury1, jury2, jury3)

2. **Notation simultanée**
   - [ ] Les 3 jurys notent différents candidats en même temps
   - [ ] **Vérifier** (dans admin) : Toutes les notes apparaissent en temps réel
   - [ ] **Vérifier** : Aucune note n'est perdue ou écrasée

3. **Modification admin pendant notation**
   - [ ] Pendant qu'un jury note, changer le statut d'un candidat dans l'admin
   - [ ] **Vérifier** : Le changement est reflété chez le jury après rafraîchissement

4. **Changement de tour pendant connexion**
   - [ ] Laisser les jurys connectés
   - [ ] Dans l'admin, terminer le tour et passer au suivant
   - [ ] **Vérifier** : Les jurys présents sur le nouveau tour sont notifiés
   - [ ] **Vérifier** : Leurs pages se rechargent automatiquement
   - [ ] **Vérifier** : Les jurys non présents sur le nouveau tour sont déconnectés

5. **Repêchage avec admin ouvert**
   - [ ] Le président fait le repêchage
   - [ ] L'admin a l'onglet **Notes** ouvert sur le tour de repêchage
   - [ ] Déplacer des candidats dans le repêchage
   - [ ] **Vérifier** (dans admin) : Les notes 0/1 se mettent à jour en temps réel
   - [ ] Finaliser le repêchage
   - [ ] **Vérifier** (dans admin) : Les statuts se mettent à jour automatiquement

#### Résultats attendus
- ✅ La synchronisation temps réel fonctionne parfaitement
- ✅ Aucune perte de données
- ✅ Les listeners Firebase détectent tous les changements
- ✅ L'interface se met à jour sans action utilisateur

---

## Tests de régression

### TEST 14 : Régression après modifications

#### Objectif
Vérifier que les fonctionnalités existantes n'ont pas été cassées par les nouvelles modifications.

#### Checklist rapide

**Candidats**
- [ ] Ajouter un candidat
- [ ] Modifier un candidat
- [ ] Supprimer un candidat
- [ ] Filtrer par statut
- [ ] Trier par colonne

**Jurys**
- [ ] Ajouter un jury
- [ ] Définir le président
- [ ] Configurer les tours de présence
- [ ] Changer le mot de passe
- [ ] Supprimer un jury

**Tours**
- [ ] Modifier un tour
- [ ] Ajouter un tour
- [ ] Supprimer un tour
- [ ] Changer le tour actif
- [ ] Terminer un tour

**Notes**
- [ ] Afficher les notes d'un tour
- [ ] Modifier une note
- [ ] Filtrer les candidats en cours
- [ ] Trier le tableau
- [ ] Exporter en CSV

**Podium**
- [ ] Afficher le podium
- [ ] Changer le tour affiché
- [ ] Modifier le nombre de résultats
- [ ] Exporter en image

**Jury - Notation**
- [ ] Se connecter
- [ ] Sélectionner un candidat
- [ ] Noter un candidat
- [ ] Valider la notation
- [ ] Changer le mot de passe
- [ ] Se déconnecter

**Jury - Repêchage**
- [ ] Accéder à l'interface de repêchage
- [ ] Déplacer des candidats
- [ ] Finaliser et valider
- [ ] Voir le podium
- [ ] Se déconnecter

#### Résultats attendus
- ✅ Toutes les fonctionnalités de base fonctionnent
- ✅ Aucune régression détectée

---

## Tests de performance

### TEST 15 : Performance avec beaucoup de données

#### Objectif
Vérifier que l'application reste performante avec un grand volume de données.

#### Procédure

1. **Créer un grand nombre de candidats**
   - [ ] Dans l'admin, créer manuellement ou via script 200 candidats
   - [ ] **Mesurer** : Temps de chargement de la page Candidats
   - [ ] **Attendu** : < 2 secondes

2. **Créer beaucoup de scores**
   - [ ] Créer 10 jurys
   - [ ] Auto-remplir les notes pour 200 candidats × 10 jurys = 2000 scores
   - [ ] **Mesurer** : Temps d'affichage du tableau de notes
   - [ ] **Attendu** : < 3 secondes

3. **Trier un grand tableau**
   - [ ] Dans le tableau de notes avec 2000 scores
   - [ ] Cliquer sur différents en-têtes pour trier
   - [ ] **Mesurer** : Temps de réponse du tri
   - [ ] **Attendu** : < 1 seconde

4. **Calcul du podium avec beaucoup de candidats**
   - [ ] Afficher le podium avec 200 candidats notés
   - [ ] **Mesurer** : Temps de calcul et d'affichage
   - [ ] **Attendu** : < 2 secondes

5. **Export CSV volumineux**
   - [ ] Exporter les notes avec 2000 scores
   - [ ] **Mesurer** : Temps de génération et téléchargement
   - [ ] **Attendu** : < 5 secondes

#### Outils de mesure
- Utiliser les DevTools du navigateur (F12 → Performance)
- Noter les temps dans le tableau ci-dessous

| Action | Temps mesuré | Objectif | ✅/❌ |
|--------|--------------|----------|------|
| Chargement 200 candidats | | < 2s | |
| Affichage 2000 scores | | < 3s | |
| Tri du tableau | | < 1s | |
| Calcul podium 200 | | < 2s | |
| Export CSV 2000 | | < 5s | |

#### Résultats attendus
- ✅ L'application reste fluide avec beaucoup de données
- ✅ Aucun freeze ou ralentissement notable
- ✅ Les temps de réponse sont acceptables

---

## Checklist de validation

### Avant la mise en production

#### Fonctionnalités critiques
- [ ] Connexion/déconnexion des jurys
- [ ] Notation des candidats
- [ ] Calcul des scores
- [ ] Interface de repêchage
- [ ] Changement de tour
- [ ] Export des résultats

#### Sécurité
- [ ] Contrôle d'accès par tour
- [ ] Validation des entrées
- [ ] Protection contre les injections
- [ ] Gestion des mots de passe

#### Performance
- [ ] Chargement < 3s
- [ ] Pas de freeze
- [ ] Synchronisation temps réel fonctionnelle

#### Compatibilité
- [ ] Chrome (dernière version)
- [ ] Firefox (dernière version)
- [ ] Safari (dernière version)
- [ ] Edge (dernière version)
- [ ] Mobile/Tablette (responsive)

#### Ergonomie
- [ ] Interface intuitive
- [ ] Messages d'erreur clairs
- [ ] Confirmations pour actions critiques
- [ ] Pas de boutons cachés
- [ ] Couleurs et contrastes accessibles

---

## Rapport de bugs

### Template de rapport

Lorsque vous trouvez un bug, documentez-le avec les informations suivantes :

```markdown
## Bug #[NUMERO]

**Titre** : [Titre court et descriptif]

**Sévérité** : Bloquante / Critique / Majeure / Mineure / Cosmétique

**Environnement** :
- Navigateur : [Chrome 120, Firefox 121, etc.]
- OS : [Windows 11, macOS 14, etc.]
- Version de l'app : [commit hash ou date]

**Description** :
[Description détaillée du problème]

**Étapes pour reproduire** :
1. [Étape 1]
2. [Étape 2]
3. [Étape 3]

**Résultat attendu** :
[Ce qui devrait se passer]

**Résultat observé** :
[Ce qui se passe réellement]

**Captures d'écran** :
[Si applicable]

**Logs console** :
[F12 → Console, copier les erreurs]

**Commentaires** :
[Informations supplémentaires]
```

### Exemple de rapport

```markdown
## Bug #001

**Titre** : Les notes ne se sauvegardent pas après validation

**Sévérité** : Bloquante

**Environnement** :
- Navigateur : Chrome 120.0.6099.109
- OS : Windows 11
- Version : commit abc123

**Description** :
Lorsqu'un jury valide ses notes pour un candidat, les notes disparaissent
mais ne sont pas enregistrées dans Firebase.

**Étapes pour reproduire** :
1. Se connecter avec jury1
2. Sélectionner le candidat "Alice"
3. Choisir notes : 15 et 20
4. Cliquer sur "Valider la notation"
5. Aller dans l'admin → Notes
6. Observer

**Résultat attendu** :
Les notes 15 et 20 doivent apparaître dans le tableau.

**Résultat observé** :
Le tableau affiche "-" pour les deux notes.

**Logs console** :
```
Error: Failed to write to Firebase
at saveScores (script.js:234)
```

**Commentaires** :
Le problème se produit uniquement avec jury1, les autres jurys fonctionnent.
```

---

## Conclusion

Ce manuel de tests couvre les scénarios principaux et complémentaires des tests automatiques. Il est recommandé de :

1. **Exécuter les tests automatiques** avant chaque commit
2. **Effectuer les tests manuels** avant chaque release
3. **Documenter tous les bugs** trouvés
4. **Mettre à jour ce manuel** quand de nouvelles fonctionnalités sont ajoutées

### Ressources complémentaires

- [Tests automatiques](./README.md)
- [Documentation principale](../README.md)
- [Spécifications](../specs/SPEC.md)

### Contact

Pour toute question sur les tests, contacter l'équipe de développement.

---

**Version du document** : 1.0  
**Dernière mise à jour** : 2026-01-01

