# Migration vers IDs Numériques des Jurys

## Changements Apportés

### Nouvelle Structure

**Avant :**
```
accounts/
  └─ "Pierre Dubois"/           ← Nom du jury = ID du document
      ├─ password: "..."
      └─ theme: "dark"

scores:
  └─ {
      juryName: "Pierre Dubois"  ← Référence directe par nom
      candidateId: "C1"
      score1: 15
    }
```

**Après :**
```
accounts/
  └─ jury1/                      ← ID numérique
      ├─ name: "Pierre Dubois"  ← Nom stocké séparément
      ├─ password: "..."
      └─ theme: "dark"

scores:
  └─ {
      juryId: "jury1"            ← Référence par ID
      juryName: "Pierre Dubois"  ← Nom dénormalisé (pour performance)
      candidateId: "C1"
      score1: 15
    }
```

### Avantages

1. **Renommage facile** : On peut changer le nom d'un jury sans avoir à mettre à jour tous les scores
2. **Cohérence** : Les IDs ne changent jamais, même si le nom change
3. **Performance** : Le nom dénormalisé dans les scores évite des jointures
4. **Évolutivité** : Facilite l'ajout de champs supplémentaires aux jurys

## Procédure de Migration

### 1. Migration Automatique des Scores

Un bouton **"Migrer vers IDs jury"** a été ajouté dans l'onglet "Réinitialiser" → "Utilitaires" de l'interface admin.

**Ce qu'il fait :**
- Charge tous les comptes jury et crée une map `nom → ID`
- Parcourt tous les scores existants
- Pour chaque score sans `juryId`, ajoute le champ en cherchant l'ID correspondant au nom
- Conserve le champ `juryName` pour compatibilité et performance

**Lancer la migration :**
1. Connectez-vous en tant qu'admin
2. Allez dans l'onglet "Réinitialiser"
3. Section "🔧 Utilitaires"
4. Cliquez sur **"Migrer vers IDs jury"**
5. Confirmez l'opération

### 2. Backup de Sécurité

**IMPORTANT** : Avant de migrer, exportez la base de données complète :
1. Onglet "Réinitialiser" → "Sauvegarde"
2. Cliquez sur **"Télécharger la base de données (JSON)"**
3. Conservez ce fichier en sécurité

La nouvelle version d'export (v2.0) inclut :
- ✅ Tous les comptes jury avec leurs IDs et noms
- ✅ Tous les scores avec juryId et juryName
- ✅ Toutes les configurations

### 3. Création de Nouveaux Jurys

Les nouveaux jurys créés après la migration auront automatiquement :
- Un ID numérique (`jury1`, `jury2`, etc.)
- Un champ `name` avec leur nom affiché
- Tous leurs scores incluront `juryId` et `juryName`

## Compatibilité

### Rétrocompatibilité

Le système est **100% compatible** avec les anciennes données :
- Les scores sans `juryId` fonctionneront toujours (utilisation de `juryName` en fallback)
- Les requêtes essaient d'abord `juryId`, puis `juryName` si non trouvé
- Les anciennes sauvegardes (v1.0) peuvent être restaurées

### Fonctionnalités Mises à Jour

Toutes les fonctionnalités ont été adaptées :
- ✅ **Connexion jury** : Recherche par nom, stocke l'ID
- ✅ **Création de scores** : Inclut `juryId` + `juryName`
- ✅ **Modification de scores** : Utilise `juryId` pour identifier
- ✅ **Renommage de jury** : Met à jour `name` dans accounts + `juryName` dénormalisé dans scores
- ✅ **Suppression de jury** : Supprime par `juryId`
- ✅ **Import CSV** : Mappe les noms vers IDs
- ✅ **Export CSV** : Utilise les noms affichés
- ✅ **Résultats** : Affiche les noms des jurys
- ✅ **Export/Import database** : Format v2.0 avec IDs

## Vérifications Post-Migration

Après avoir lancé la migration, vérifiez :

1. **Tous les scores migrés ?**
   - Le message de confirmation indique le nombre de scores migrés
   - Pas de jurys "non trouvés" (notFound = 0)

2. **Les notations fonctionnent ?**
   - Connectez-vous en tant que jury
   - Vérifiez qu'un candidat déjà noté apparaît comme complété
   - Notez un nouveau candidat

3. **L'admin fonctionne ?**
   - Onglet "Notes" : les scores s'affichent correctement
   - Onglet "Résultats" : les totaux sont corrects
   - Onglet "Jury" : vous pouvez renommer un jury
   - Vérifiez que les scores du jury renommé s'affichent toujours

## Rollback

En cas de problème, restaurez la sauvegarde :
1. Onglet "Réinitialiser" → "Sauvegarde"
2. Cliquez sur **"Choisir un fichier"** (bouton de restauration)
3. Sélectionnez votre fichier JSON de backup
4. Confirmez la restauration
5. La page se rechargera automatiquement

## Support

Si des scores ne sont pas migrés correctement :
1. Vérifiez la console du navigateur (F12) pour les warnings
2. Les jurys "non trouvés" indiquent des scores orphelins (jury supprimé)
3. Vous pouvez relancer la migration plusieurs fois sans risque

## Technique : Dénormalisation

Le champ `juryName` est **intentionnellement dupliqué** dans les scores :
- **Performance** : Évite de charger les comptes jury pour chaque affichage
- **Simplicité** : Les requêtes existantes fonctionnent sans changement
- **Cohérence** : Mis à jour automatiquement lors du renommage

C'est une pratique courante en NoSQL appelée "dénormalisation".

