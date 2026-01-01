# Tests Automatiques - Concours d'Éloquence

Ce répertoire contient la suite complète de tests automatiques pour l'application Concours d'Éloquence.

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
├── unit/                   # Tests unitaires
│   ├── score-calculation.test.js
│   └── data-validation.test.js
├── integration/            # Tests d'intégration
│   └── firebase-operations.test.js
├── e2e/                    # Tests end-to-end
│   ├── jury-workflow.test.js
│   └── admin-workflow.test.js
├── setup.js                # Configuration Jest
├── jest.config.js          # Configuration Jest
├── package.json            # Dépendances et scripts
└── README.md               # Ce fichier
```

## 🧪 Types de tests

### 1. Tests unitaires (`unit/`)

Tests des fonctions isolées et de la logique métier.

**Couverture :**
- Calcul des scores pondérés
- Agrégation des scores de plusieurs jurys
- Calcul des scores de repêchage
- Validation des données (candidats, scores, jurys, tours)
- Génération de notes aléatoires

**Exemple :**
```javascript
test('Score pondéré normal', () => {
  expect(5 * 3 + 5).toBe(20);
});
```

### 2. Tests d'intégration (`integration/`)

Tests des interactions avec Firebase (mockées).

**Couverture :**
- Opérations CRUD sur les candidats
- Opérations CRUD sur les scores
- Opérations CRUD sur les jurys
- Requêtes Firebase avec filtres
- Batch writes
- Listeners temps réel (onSnapshot)

**Exemple :**
```javascript
test('Créer un candidat', async () => {
  await addDoc(collection('candidats'), candidateData);
  expect(addDoc).toHaveBeenCalled();
});
```

### 3. Tests end-to-end (`e2e/`)

Tests des flux utilisateur complets.

**Couverture :**

#### Jury (`jury-workflow.test.js`)
- Connexion/déconnexion
- Notation normale (sélection candidat, attribution notes)
- Repêchage (déplacer candidats, valider)
- Changement de mot de passe
- Gestion des permissions par tour

#### Administrateur (`admin-workflow.test.js`)
- Gestion des candidats (CRUD)
- Gestion des jurys (CRUD, président)
- Gestion des tours (création, configuration)
- Auto-remplissage des notes
- Visualisation du tableau de notes
- Affichage du podium
- Export CSV
- Réinitialisation des données

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

