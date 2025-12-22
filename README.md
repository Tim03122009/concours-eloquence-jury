# 🎭 Application de Notation - Concours d'Éloquence

Application web moderne et responsive pour la notation en temps réel des concours d'éloquence. Conçue pour les jurys sur tablettes, mobiles et ordinateurs portables.

![Version](https://img.shields.io/badge/version-2.0-blue)
![Firebase](https://img.shields.io/badge/firebase-10.1.0-orange)
![Responsive](https://img.shields.io/badge/responsive-mobile%20%7C%20tablet%20%7C%20desktop-green)

---

## ✨ Fonctionnalités

### 👨‍⚖️ Interface Jury
- ✅ **Identification simple** par nom/identifiant
- ✅ **Notation intuitive** avec scores prédéfinis (5, 10, 15, 20, Éliminé)
- ✅ **Double critère pondéré** : Fond (×3) / Forme (×1)
- ✅ **Prévention des doublons** : impossible de noter deux fois le même candidat
- ✅ **Modale de confirmation** avant envoi
- ✅ **Session persistante** avec localStorage
- ✅ **Design moderne** avec gradients et animations

### 👔 Interface Administrateur
- 🎯 **Gestion des candidats** : ajout/modification facile
- 📊 **Matrice détaillée** : tous les scores par jury et candidat
- 🏆 **Classement automatique** avec podium stylisé (🥇🥈🥉)
- ⚡ **Règle d'élimination** : ≥3 jurys → candidat hors classement
- 📑 **Export Excel** (.csv)
- 📸 **Export image** du podium
- 🗑️ **Réinitialisation sécurisée** des scores

---

## 🎨 Design Responsive de Pointe

### Conception Mobile-First
L'interface s'adapte automatiquement à tous les écrans :

#### 📱 Mobile (< 768px)
- Grille de scores 2×2 + bouton "Éliminé"
- Boutons empilés verticalement
- Texte adaptatif avec `clamp()`
- Zones tactiles optimisées (min 44px)

#### 📲 Tablette (768px - 1023px)
- Grille de scores 4×1 + bouton "Éliminé"
- Disposition en colonnes équilibrées
- Espacement augmenté pour le confort

#### 💻 Desktop (≥ 1024px)
- Grille de scores 5×1 (tous les boutons en ligne)
- Effets hover sophistiqués
- Animations fluides et transitions
- Espacement généreux

### Fonctionnalités UX Modernes

#### 🎯 Variables CSS pour thème cohérent
```css
--primary-color, --success-color, --danger-color, --warning-color
--shadow-sm, --shadow-md, --shadow-lg
--spacing-xs, --spacing-sm, --spacing-md, --spacing-lg
```

#### ✨ Animations et Transitions
- **Fade-in** à l'ouverture des pages
- **Slide-up** pour les modales
- **Hover effects** avec élévation (translateY)
- **Shimmer effect** sur les boutons

#### 🎨 Gradients et Ombres
- Fond dégradé violet (`#667eea` → `#764ba2`)
- Boutons avec gradients directionnels
- Ombres portées multi-niveaux

#### ♿ Accessibilité
- Support du mode `prefers-reduced-motion`
- Cibles tactiles ≥ 44px sur mobile
- Couleurs contrastées (WCAG AA)
- Labels et placeholders explicites

---

## 🚀 Installation et Démarrage

### Prérequis
- Compte Firebase avec projet créé
- Navigateur moderne (Chrome/Firefox/Safari/Edge)
- Serveur web local (Python, Node.js, ou Firebase Hosting)

### Démarrage Rapide

#### 1. Cloner le Projet
```bash
git clone <votre-repo>
cd concours-eloquence-jury
```

#### 2. Configurer Firebase
Éditer `firebase-init.js` avec vos clés Firebase (déjà configuré pour `concours-eloquence-2025`)

#### 3. Lancer le Serveur Local
```bash
# Option 1: Python (recommandé)
python3 -m http.server 8080

# Option 2: Node.js
npx http-server -p 8080

# Option 3: PHP
php -S localhost:8080
```

#### 4. Accéder aux Interfaces
- **Jury** : http://localhost:8080/index.html
- **Admin** : http://localhost:8080/admin.html

---

## 📖 Guide d'Utilisation

### Pour les Administrateurs

#### 1. Configurer les Candidats
1. Ouvrir `admin.html`
2. Saisir les noms (un par ligne)
3. Cliquer "💾 Sauvegarder la Liste"

#### 2. Consulter les Résultats
1. Cliquer "📊 Charger et Calculer"
2. Visualiser la matrice détaillée
3. Consulter le classement officiel

#### 3. Exporter les Données
- **Excel** : Bouton "📑 Excel (.csv)"
- **Image** : Bouton "📸 Podium (Image)"

#### 4. Réinitialiser (Nouveau Concours)
1. Aller dans "⚠️ Zone de Danger"
2. Cliquer "🗑️ RÉINITIALISER TOUS LES SCORES"
3. Confirmer l'action

### Pour les Jurys

#### 1. S'identifier
1. Ouvrir `index.html`
2. Entrer votre nom/identifiant
3. Cliquer "✨ Commencer la notation"

#### 2. Noter un Candidat
1. **Sélectionner** le candidat dans la liste déroulante
2. **Choisir** une note pour Fond (5/10/15/20/Éliminé)
3. **Choisir** une note pour Forme (5/10/15/20/Éliminé)
4. **Cliquer** "✅ Valider la notation"
5. **Confirmer** dans la modale

#### 3. Continuer ou Se Déconnecter
- Les candidats notés disparaissent automatiquement
- Session sauvegardée automatiquement
- Bouton "🚪 Déconnexion" en haut à droite

---

## 🧮 Système de Notation

### Formule de Calcul
```
Score Total = (Note Fond × 3) + (Note Forme × 1)
```

### Exemples
- **Fond: 15, Forme: 20** → (15×3) + (20×1) = **65 points**
- **Fond: 20, Forme: 15** → (20×3) + (15×1) = **75 points**
- **Fond: Éliminé** → Peu importe la Forme = **0 point**

### Règles d'Élimination
1. **Élimination partielle** : Un seul critère "Éliminé" → Score = 0
2. **Élimination définitive** : ≥3 jurys ont mis "Éliminé" → Hors classement

### Classement Final
1. Tri par score total décroissant
2. Candidats avec ≥3 éliminations → Affichés en bas (statut "ÉLIMINÉ")
3. Podium : Top 3 des candidats qualifiés

---

## 🛠️ Architecture Technique

### Structure des Fichiers
```
/
├── index.html              # Interface jury
├── admin.html              # Interface admin
├── script.js               # Logique métier jury
├── style.css               # Styles responsives modernes
├── firebase-init.js        # Configuration Firebase
├── firebase.json           # Config émulateur
├── .firebaserc             # Projet Firebase
├── .gitignore              # Fichiers exclus
├── README.md               # Ce fichier
├── SPEC.md                 # Spécification technique complète
└── TESTING.md              # Guide de test local
```

### Technologies
- **Frontend** : HTML5, CSS3 (Variables, Grid, Flexbox), JavaScript ES6+
- **Backend** : Firebase Firestore (NoSQL temps réel)
- **Animations** : CSS Transitions & Keyframes
- **Responsive** : Mobile-first avec Media Queries
- **Typo** : System fonts (-apple-system, Segoe UI, Roboto)

### Base de Données Firestore

#### Collection `candidats`
```javascript
{
  candidates: [
    { id: "C1", name: "Alice Martin" },
    { id: "C2", name: "Bob Dupont" }
  ]
}
```

#### Collection `scores`
```javascript
{
  juryName: "Mme. Dupont",
  candidateId: "C1",
  score1: 15,              // ou "Elimine"
  score2: 20,              // ou "Elimine"
  totalWeightedScore: 65,
  timestamp: Date
}
```

---

## 🧪 Tests

Voir le fichier **[TESTING.md](./TESTING.md)** pour :
- Guide de test local complet
- Firebase Emulator Suite
- Scénarios de test recommandés
- Checklist avant commit

### Test Rapide
```bash
# Démarrer le serveur local
python3 -m http.server 8080

# Ouvrir dans le navigateur
open http://localhost:8080/index.html
open http://localhost:8080/admin.html
```

---

## 📊 Spécifications Complètes

Voir le fichier **[SPEC.md](./SPEC.md)** pour :
- Architecture technique détaillée
- Flux de données et workflows
- Règles métier complètes
- Guide de déploiement
- Guide de maintenance

---

## 🎨 Personnalisation

### Modifier les Couleurs
Éditer les variables CSS dans `style.css` :
```css
:root {
    --primary-color: #007bff;    /* Bleu principal */
    --success-color: #28a745;    /* Vert succès */
    --danger-color: #dc3545;     /* Rouge danger */
    --warning-color: #ffc107;    /* Jaune avertissement */
    /* ... */
}
```

### Modifier les Scores Disponibles
Éditer dans `script.js` :
```javascript
const values = [5, 10, 15, 20]; // Ajouter d'autres valeurs
```

### Changer le Coefficient
Modifier dans `script.js` et `admin.html` :
```javascript
let pts = (parseInt(selectedScore1) * 3) + parseInt(selectedScore2);
// Changer le "* 3" par le coefficient souhaité
```

---

## 🚀 Déploiement en Production

### Firebase Hosting (Recommandé)
```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter
firebase login

# Déployer
firebase deploy --only hosting
```

### Autres Options
- **Netlify** : Drag & drop du dossier
- **Vercel** : Import depuis GitHub
- **GitHub Pages** : Activer dans Settings
- **Serveur dédié** : Copier les fichiers HTML/CSS/JS

---

## 🔒 Sécurité

### Règles Firestore Recommandées
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lecture seule pour les candidats
    match /candidats/{document} {
      allow read: if true;
      allow write: if false;
    }
    
    // Scores : lecture libre, écriture validée
    match /scores/{document} {
      allow read: if true;
      allow create: if request.resource.data.juryName is string
                    && request.resource.data.candidateId is string;
      allow update, delete: if false;
    }
  }
}
```

---

## 🐛 Dépannage

### Les pages s'affichent simultanément
✅ **Résolu** : CSS mis à jour pour gérer `.page` et `.page-container`

### Le serveur ne démarre pas sur le port 8000
→ Port déjà utilisé, essayer 8080 ou 3000

### Erreur "Failed to load module script"
→ Servir via HTTP (pas `file://`), utiliser un serveur web local

### Firebase "Permission denied"
→ Configurer les règles de sécurité Firestore

### L'interface est coupée sur mobile
→ Vérifier la balise `<meta name="viewport">` dans le HTML

---

## 📝 Changelog

### Version 2.0 - Design Moderne Responsive
- ✨ **Nouveau** : Design moderne avec gradients et animations
- ✨ **Nouveau** : Responsive mobile-first (mobile/tablet/desktop)
- ✨ **Nouveau** : Variables CSS pour thème cohérent
- ✨ **Nouveau** : Effets hover et transitions fluides
- ✨ **Nouveau** : Icônes emoji pour meilleure UX
- ✨ **Nouveau** : Support dark mode (optionnel)
- ✨ **Nouveau** : Animations fade-in et slide-up
- 🐛 **Corrigé** : Affichage simultané des deux pages
- 🐛 **Corrigé** : Zones tactiles trop petites sur mobile
- 📱 **Amélioration** : Grilles adaptatives selon la taille d'écran
- ♿ **Amélioration** : Support `prefers-reduced-motion`

### Version 1.0 - Application Initiale
- ✅ Interface jury de notation
- ✅ Interface admin des résultats
- ✅ Calcul automatique avec coefficients
- ✅ Système d'élimination
- ✅ Persistance Firebase Firestore

---

## 👥 Contribution

Pour contribuer au projet :
1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/amelioration`)
3. Commiter les changements (`git commit -m 'Ajout fonctionnalité X'`)
4. Push vers la branche (`git push origin feature/amelioration`)
5. Ouvrir une Pull Request

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

## 📧 Support

Pour toute question ou assistance :
- 📖 Consulter [SPEC.md](./SPEC.md) pour les détails techniques
- 🧪 Consulter [TESTING.md](./TESTING.md) pour les tests
- 🐛 Ouvrir une issue sur GitHub
- 💬 Contacter l'équipe de développement

---

## 🙏 Remerciements

- Firebase pour la plateforme backend
- La communauté open-source
- Tous les contributeurs du projet

---

**Fait avec ❤️ pour les concours d'éloquence** 🎭✨

