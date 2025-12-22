# Guide de Test Local

## 🚀 Option 1: Test Rapide (Serveur Local + Firebase Production)

### Démarrage
```bash
# Python (déjà installé sur macOS)
python3 -m http.server 8000

# OU Node.js
npx http-server -p 8000
```

### Accès
- Jury: http://localhost:8000/index.html
- Admin: http://localhost:8000/admin.html

⚠️ **Attention**: Utilise la vraie base de données Firebase!

---

## 🔥 Option 2: Test Isolé (Firebase Emulator)

### Installation (première fois uniquement)
```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Vérifier l'installation
firebase --version
```

### Configuration pour mode émulateur

**Modifier temporairement les fichiers HTML:**

Dans `index.html` et `admin.html`, remplacer:
```html
<script type="module" src="script.js"></script>
```

Par:
```html
<script type="module" src="script-emulator.js"></script>
```

**OU** créer des copies pour les tests:
```bash
cp index.html index-test.html
cp admin.html admin-test.html
# Puis modifier les imports dans ces fichiers
```

### Démarrage de l'émulateur
```bash
# Dans le dossier du projet
firebase emulators:start

# L'émulateur démarre sur:
# - Hosting: http://localhost:5000
# - Firestore: localhost:8080
# - UI Admin: http://localhost:4000
```

### Accès en mode émulateur
- Jury: http://localhost:5000/index.html
- Admin: http://localhost:5000/admin.html
- **Interface Emulator**: http://localhost:4000 (voir les données en temps réel)

### Avantages
✅ Données complètement locales (non sauvegardées)
✅ Pas de quota Firebase consommé
✅ Possibilité d'exporter/importer des jeux de données de test
✅ Interface web pour inspecter Firestore

---

## 🧪 Scénarios de Test Recommandés

### Test 1: Identification Jury
1. Ouvrir `index.html`
2. Entrer un nom de jury (ex: "Test Jury 1")
3. Vérifier que la page de notation s'affiche
4. **Vérifier localStorage** (DevTools > Application > Local Storage)

### Test 2: Notation Simple
1. Admin: Créer liste de candidats (ex: "Alice\nBob\nCharlie")
2. Jury: Sélectionner un candidat
3. Choisir notes (ex: Fond=15, Forme=20)
4. Valider et confirmer
5. Vérifier que le candidat disparaît de la liste

### Test 3: Calcul des Résultats
1. Créer 2-3 sessions jury différentes
2. Noter plusieurs candidats avec chaque jury
3. Admin: Cliquer "Charger et Calculer"
4. Vérifier matrice des scores
5. Vérifier podium

### Test 4: Élimination
1. Jury: Sélectionner candidat
2. Choisir "Éliminé" pour Fond ou Forme
3. Valider
4. Admin: Vérifier que le score = 0
5. Tester avec 3 jurys → Candidat éliminé du classement

### Test 5: Reset et Session
1. Noter quelques candidats
2. Admin: Réinitialiser tous les scores
3. Jury: Recharger la page
4. Vérifier que la session est maintenue (jury toujours connecté)
5. Vérifier que tous les candidats sont à nouveau disponibles

---

## 🛠️ Debugging

### Ouvrir les DevTools du Navigateur
- Chrome/Edge: `Cmd+Option+I` (macOS) ou `F12` (Windows)
- Firefox: `Cmd+Option+K` (macOS) ou `F12` (Windows)

### Console JavaScript
Vérifier les erreurs dans l'onglet "Console"

### Network Tab
Voir les requêtes Firebase dans l'onglet "Network"
- Filtrer par "firestore.googleapis.com"

### Application Tab
Inspecter localStorage et les données stockées

### Firestore Emulator UI (si émulateur actif)
http://localhost:4000 - Interface graphique complète

---

## 📋 Checklist Avant Commit

- [ ] Tester identification jury
- [ ] Tester notation (valeurs normales)
- [ ] Tester notation avec élimination
- [ ] Tester qu'un jury ne peut pas noter 2 fois le même candidat
- [ ] Tester calcul des résultats
- [ ] Tester podium avec éliminations (>=3 jurys)
- [ ] Tester déconnexion et reconnexion
- [ ] Tester sur tablette/mobile (DevTools > Device Mode)
- [ ] Vérifier qu'aucune erreur console
- [ ] Vérifier que `firebase-init.js` pointe bien vers PRODUCTION (pas émulateur)

---

## 🔄 Switch Entre Production et Émulateur

### Pour Production (défaut)
Utiliser `firebase-init.js` dans les imports

### Pour Émulateur
Créer `script-emulator.js`:
```javascript
// Copie de script.js mais importer:
import { db } from './firebase-init-emulator.js';
// Au lieu de:
// import { db } from './firebase-init.js';
```

**OU** utiliser une variable d'environnement:
```javascript
// firebase-init.js
const USE_EMULATOR = window.location.hostname === 'localhost';

if (USE_EMULATOR) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('🔥 Mode EMULATEUR');
}
```

---

## 📦 Export/Import Données de Test (Émulateur)

### Export
```bash
firebase emulators:export ./test-data
```

### Import
```bash
firebase emulators:start --import=./test-data
```

### Exemple: Créer jeu de données de test
1. Démarrer émulateur: `firebase emulators:start`
2. Créer candidats via admin.html
3. Noter avec plusieurs jurys
4. Exporter: `firebase emulators:export ./test-data`
5. Committer `test-data/` pour partager avec l'équipe

---

## 🚫 Fichiers à ne PAS Committer

Ajouter à `.gitignore`:
```
# Tests
*-test.html
*-emulator.js
test-data/

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
```

---

## ❓ Troubleshooting

### "Failed to load module script"
➜ Vérifier que vous servez via HTTP (pas file://)
➜ Utiliser `python3 -m http.server` ou équivalent

### "Firestore: Missing or insufficient permissions"
➜ Mode production: Vérifier les règles Firestore
➜ Mode émulateur: Pas de règles par défaut (tout autorisé)

### "Quota exceeded" (production)
➜ Passer en mode émulateur pour les tests intensifs

### L'émulateur ne démarre pas
```bash
# Tuer les processus Firebase existants
pkill -f firebase

# Nettoyer le cache
rm -rf ~/.cache/firebase/emulators/

# Réinstaller
npm install -g firebase-tools
```

### Les données ne s'affichent pas
➜ Ouvrir DevTools > Console pour voir les erreurs
➜ Vérifier que Firebase est bien initialisé
➜ Vérifier la connexion réseau (mode production)

---

## 📚 Ressources

- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

