# Tests Automatiques - Concours d'Éloquence

Ce répertoire contient la suite complète de tests automatiques pour l'application Concours d'Éloquence.

> **Vue d’ensemble de ce que vous devez faire** (automatique + manuel) : voir **[TESTS_A_FAIRE.md](./TESTS_A_FAIRE.md)**.

## 📋 Table des matières

- [Installation](#installation)
- [Exécution des tests](#exécution-des-tests)
- [Structure des tests](#structure-des-tests)
- [Types de tests](#types-de-tests)
- [Couverture de code](#couverture-de-code)
- [Écrire de nouveaux tests](#écrire-de-nouveaux-tests)

## 🚀 Installation

### Prérequis

- Node.js (version 14 ou supérieure)
- npm ou yarn

### Installation des dépendances

```bash
cd test
npm install
```

## ▶️ Exécution des tests

### Tous les tests

```bash
npm test
```

### Tests avec surveillance (watch mode)

```bash
npm run test:watch
```

### Tests unitaires uniquement

```bash
npm run test:unit
```

### Tests d'intégration uniquement

```bash
npm run test:integration
```

### Tests end-to-end uniquement

```bash
npm run test:e2e
```

### Rapport de couverture

```bash
npm run test:coverage
```

Un rapport HTML sera généré dans `./coverage/lcov-report/index.html`.

## 📁 Structure des tests

```
test/
├── __mocks__/              # Mocks pour les dépendances externes
│   └── firebase.js         # Mock Firebase
├── unit/                   # Tests unitaires (69 tests)
│   ├── score-calculation.test.js    # Calculs de scores
│   ├── data-validation.test.js      # Validation des données
│   └── edge-cases.test.js           # Cas limites et exceptionnels
├── integration/            # Tests d'intégration (23 tests)
│   ├── firebase-operations.test.js  # Opérations Firebase
│   └── security.test.js             # Sécurité et contrôle d'accès
├── e2e/                    # Tests end-to-end (41 tests)
│   ├── jury-workflow.test.js        # Flux utilisateur jury
│   └── admin-workflow.test.js       # Flux administrateur
├── setup.js                # Configuration Jest
├── jest.config.js          # Configuration Jest
├── package.json            # Dépendances et scripts
├── manuel.md               # Manuel de tests manuels (français)
├── .gitignore              # Fichiers à ignorer
└── README.md               # Ce fichier
```

## 🧪 Types de tests

### 1. Tests unitaires (`unit/`) - 69 tests

Tests des fonctions isolées et de la logique métier.

**Couverture :**

#### `score-calculation.test.js` (18 tests)
- Calcul des scores pondérés (score1 × 3 + score2)
- Agrégation des scores de plusieurs jurys
- Calcul des scores de repêchage (0 ou 1 avec score précédent)
- Classement et tri des candidats
- Filtrage des candidats (par statut, par tour)
- Génération de notes aléatoires

#### `data-validation.test.js` (30 tests)
- Validation des candidats (champs requis, format)
- Validation des scores (5, 10, 15, 20, EL, -, 0, 1)
- Validation des jurys (président unique, tours de présence)
- Validation des tours (ordre, type, nextRoundCandidates)
- Validation des identifiants (unicité, format)
- Format de repêchage (ALL, nombre)

#### `edge-cases.test.js` (21 tests)
- Gestion des données vides ou nulles
- Chaînes de caractères invalides
- Doublons et conflits (IDs, présidents, scores)
- Limites numériques (très grand nombre de candidats)
- Ordre et tri avec égalités
- Transitions d'état
- Précision des calculs (virgule flottante, division par zéro)
- Formatage et export (caractères spéciaux, CSV)
- Logique de repêchage (cas limites)
- Sécurité (injection, validation)
- Concurrence (race conditions)

**Exemple :**
```javascript
test('Score pondéré normal', () => {
  expect(5 * 3 + 5).toBe(20);
});
```

### 2. Tests d'intégration (`integration/`) - 23 tests

Tests des interactions avec Firebase (mockées) et de la sécurité.

**Couverture :**

#### `firebase-operations.test.js` (13 tests)
- Opérations CRUD sur les candidats
- Opérations CRUD sur les scores (avec requêtes filtrées)
- Opérations CRUD sur les jurys
- Configuration des tours
- Batch writes pour performance
- Listeners temps réel (onSnapshot)
- Gestion des erreurs (document inexistant, échec réseau)

#### `security.test.js` (10 tests)
- Authentification (avec/sans credentials)
- Autorisation par rôle (jury vs admin)
- Contrôle d'accès par tour
- Contrôle d'accès au repêchage (président uniquement)
- Modification de données (verrouillage, propriétaire)
- Protection contre injections (SQL-like, XSS)
- Validation des permissions (actions admin)
- Intégrité des données (scores négatifs, max)
- Rate limiting (tentatives de connexion, batch size)
- Protection des données sensibles (mots de passe)
- Validation des transitions d'état

**Exemple :**
```javascript
test('Créer un candidat', async () => {
  await addDoc(collection('candidats'), candidateData);
  expect(addDoc).toHaveBeenCalled();
});
```

### 3. Tests end-to-end (`e2e/`) - 41 tests

Tests des flux utilisateur complets.

**Couverture :**

#### Jury (`jury-workflow.test.js`) - 15 tests
- Connexion/déconnexion (succès, échec, permissions)
- Notation normale (sélection, notes, validation, lecture seule)
- Repêchage président (initialisation, déplacement, validation, podium)
- Changement de mot de passe
- Gestion des permissions par tour

#### Administrateur (`admin-workflow.test.js`) - 26 tests
- Gestion des candidats (CRUD, test data)
- Gestion des jurys (CRUD, président, tours de présence)
- Gestion des tours (CRUD, défaut, terminer)
- Auto-remplissage des notes (aléatoires, 15% EL)
- Visualisation du tableau de notes (filtres, jurys présents)
- Affichage du podium (top N, exclusion éliminés, repêchage)
- Export CSV (notes, résultats)
- Réinitialisation (tour, tous, complet)

## 📖 Tests manuels

En complément des **133 tests automatiques**, un [manuel de tests détaillé](./manuel.md) est disponible en français.

### Contenu du manuel

Le manuel couvre **15 scénarios de tests manuels** complets :

1. **Configuration** - Préparation de l'environnement de test
2. **Tests administrateur** (7 scénarios) :
   - Gestion des candidats
   - Gestion des jurys et président
   - Configuration des tours
   - Tableau de notes (normal et repêchage)
   - Podium et classement
   - Auto-remplissage et réinitialisation
   - Export des données (CSV, JSON)

3. **Tests jury** (4 scénarios) :
   - Connexion et contrôle d'accès
   - Notation normale (lecture seule pour notes existantes)
   - Interface de repêchage (président)
   - Changement de mot de passe

4. **Tests bout en bout** (2 scénarios) :
   - Compétition complète (du début à la fin)
   - Synchronisation multi-utilisateurs temps réel

5. **Tests de régression** (1 checklist) :
   - Validation de toutes les fonctionnalités après modifications

6. **Tests de performance** (1 scénario) :
   - Performance avec 200 candidats et 2000 scores

### Utilisation du manuel

```bash
# Ouvrir le manuel
open test/manuel.md

# Ou avec votre éditeur préféré
code test/manuel.md
```

Le manuel inclut :
- ✅ Procédures détaillées étape par étape
- ✅ Résultats attendus pour chaque test
- ✅ Checklist de validation avant production
- ✅ Template de rapport de bugs
- ✅ Tableaux de mesure de performance

## 📊 Couverture de code

### Objectifs de couverture

- **Branches :** 50%
- **Fonctions :** 50%
- **Lignes :** 50%
- **Statements :** 50%

### Voir le rapport

Après avoir exécuté `npm run test:coverage`, ouvrez :

```bash
open coverage/lcov-report/index.html
```

## ✍️ Écrire de nouveaux tests

### Structure d'un test

```javascript
describe('Groupe de tests', () => {
  
  // Configuration avant chaque test
  beforeEach(() => {
    // Initialisation
  });
  
  test('Description du test', () => {
    // Arrange (préparer)
    const input = 'value';
    
    // Act (agir)
    const result = functionToTest(input);
    
    // Assert (vérifier)
    expect(result).toBe('expected');
  });
  
  // Nettoyage après chaque test
  afterEach(() => {
    // Cleanup
  });
});
```

### Bonnes pratiques

1. **Nom descriptif** : Le nom du test doit décrire clairement ce qui est testé
2. **Un test = un concept** : Chaque test doit vérifier un seul comportement
3. **Indépendance** : Les tests doivent être indépendants les uns des autres
4. **Lisibilité** : Utiliser Arrange-Act-Assert pour structurer les tests
5. **Mocks** : Utiliser des mocks pour les dépendances externes

### Matchers Jest courants

```javascript
// Égalité
expect(value).toBe(expected);           // Égalité stricte (===)
expect(value).toEqual(expected);        // Égalité profonde

// Vérité
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeUndefined();
expect(value).toBeNull();

// Nombres
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThan(5);

// Chaînes
expect(value).toContain('substring');
expect(value).toMatch(/pattern/);

// Tableaux
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objets
expect(object).toHaveProperty('key');

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('error message');

// Fonctions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(2);

// Promesses
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## 🐛 Debugging

### Mode verbose

```bash
npm test -- --verbose
```

### Tests spécifiques

```bash
npm test -- score-calculation
```

### Avec debugger

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Puis ouvrir `chrome://inspect` dans Chrome.

## 📚 Ressources

- [Documentation Jest](https://jestjs.io/docs/getting-started)
- [Guide des matchers Jest](https://jestjs.io/docs/expect)
- [Mocking avec Jest](https://jestjs.io/docs/mock-functions)
- [Testing Firebase](https://firebase.google.com/docs/rules/unit-tests)

## 🤝 Contribution

Pour ajouter de nouveaux tests :

1. Créer un fichier `.test.js` dans le répertoire approprié
2. Suivre la structure et les conventions existantes
3. Exécuter `npm test` pour vérifier
4. Vérifier la couverture avec `npm run test:coverage`

## 📝 Notes

- Les tests utilisent des mocks Firebase pour éviter les appels réseau réels
- Les données de test sont réinitialisées avant chaque test
- La configuration Jest se trouve dans `jest.config.js`
- Les mocks globaux sont dans `setup.js`

