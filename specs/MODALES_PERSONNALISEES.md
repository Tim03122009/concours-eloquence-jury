# Modales Personnalisées

## Vue d'ensemble

Les dialogues natifs du navigateur (`alert()`, `confirm()`, `prompt()`) affichent toujours "[URL] says:" dans le titre, ce qui n'est pas professionnel. Ce système les remplace par des modales HTML/CSS élégantes et personnalisables.

## Fonctionnalités

✨ **Design moderne**
- Interface élégante avec animations fluides
- Compatible avec le thème light/dark automatiquement
- Effets de backdrop blur pour un rendu professionnel

⌨️ **Raccourcis clavier**
- `Enter` : Valider/OK
- `Escape` : Annuler/Fermer
- Auto-focus sur les boutons et champs de saisie

🎨 **Personnalisation**
- Utilise les variables CSS du thème existant
- Headers colorés selon le type de modale
- Animations d'entrée/sortie

## Utilisation

Les modales remplacent **automatiquement** les fonctions natives :

```javascript
// Alert
await alert("Message d'information");

// Confirm
const confirmed = await confirm("Êtes-vous sûr ?");
if (confirmed) {
    // Action confirmée
}

// Prompt
const name = await prompt("Entrez votre nom:", "Jean");
if (name) {
    // Nom saisi
}
```

## Mise en Place

### 1. Fichiers requis

- `modal.js` : Logique des modales
- `style.css` : Styles des modales (section "MODALES PERSONNALISÉES")

### 2. Intégration dans une page

```html
<head>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- Votre contenu -->
    
    <!-- Avant la fermeture du body -->
    <script>window.useCustomModals = true;</script>
    <script src="modal.js"></script>
    <script src="votre-script.js"></script>
</body>
```

**Important** : `modal.js` doit être chargé **avant** vos scripts qui utilisent alert/confirm/prompt.

### 3. Fonctions asynchrones

Les modales retournent des **Promises**, donc elles doivent être utilisées avec `await` dans des fonctions `async` :

```javascript
// ✅ Correct
async function maFonction() {
    const result = await confirm("Continuer ?");
    if (result) {
        // ...
    }
}

// ❌ Incorrect (ne fonctionnera pas)
function maFonction() {
    const result = confirm("Continuer ?"); // result sera une Promise
    if (result) {
        // Ne sera jamais exécuté
    }
}
```

## API

### customAlert(message)

Affiche un message d'information.

**Paramètres** :
- `message` (string) : Le message à afficher (peut contenir des `\n` pour les sauts de ligne)

**Retourne** : `Promise<void>`

**Exemple** :
```javascript
await customAlert("Opération réussie !");
await customAlert("Ligne 1\nLigne 2\nLigne 3");
```

### customConfirm(message)

Demande une confirmation à l'utilisateur.

**Paramètres** :
- `message` (string) : Le message de confirmation

**Retourne** : `Promise<boolean>`
- `true` si l'utilisateur confirme
- `false` si l'utilisateur annule

**Exemple** :
```javascript
if (await customConfirm("Supprimer ce candidat ?")) {
    // Suppression confirmée
} else {
    // Annulé
}
```

### customPrompt(message, defaultValue)

Demande une saisie à l'utilisateur.

**Paramètres** :
- `message` (string) : Le message/question
- `defaultValue` (string, optionnel) : Valeur par défaut

**Retourne** : `Promise<string|null>`
- La valeur saisie si validé
- `null` si annulé

**Exemple** :
```javascript
const name = await customPrompt("Nom du candidat:", "");
if (name) {
    console.log(`Candidat : ${name}`);
} else {
    console.log("Saisie annulée");
}
```

## Personnalisation des Styles

Les modales utilisent les variables CSS existantes du thème :

```css
/* Variables utilisées */
--card-bg           /* Fond de la modale */
--text-color        /* Couleur du texte */
--border-color      /* Bordures */
--primary           /* Bouton principal */
--secondary         /* Couleur secondaire */
--input-bg          /* Fond des champs de saisie */
--page-bg           /* Fond du footer */
```

### Modifier les couleurs

Modifiez les variables CSS dans `style.css` :

```css
/* Light mode */
:root {
    --primary: #007bff;  /* Bleu pour les boutons */
    --secondary: #0056b3;
}

/* Dark mode */
[data-theme="dark"] {
    --primary: #0d6efd;
    --secondary: #0a58ca;
}
```

### Modifier les animations

Dans `style.css`, section `.custom-modal` :

```css
@keyframes modalSlideIn {
    from {
        transform: translateY(-50px) scale(0.9);
        opacity: 0;
    }
    to {
        transform: translateY(0) scale(1);
        opacity: 1;
    }
}
```

## Compatibilité

- ✅ Chrome/Edge (moderne)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile (responsive)

## Notes Techniques

### Remplacement automatique

Quand `window.useCustomModals = true` est défini, les fonctions natives sont remplacées :

```javascript
window.alert = window.customAlert;
window.confirm = window.customConfirm;
window.prompt = window.customPrompt;
```

### Overlay unique

Un seul overlay est créé et réutilisé pour toutes les modales. Il est créé au chargement de la page :

```javascript
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    document.body.appendChild(overlay);
});
```

### Z-index

Les modales utilisent `z-index: 10000` pour s'afficher au-dessus de tout le contenu.

### Sécurité XSS

Les messages sont automatiquement échappés via `escapeHtml()` pour prévenir les injections HTML/JavaScript :

```javascript
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

## Dépannage

### La modale ne s'affiche pas

1. Vérifiez que `modal.js` est bien chargé
2. Vérifiez la console pour les erreurs JavaScript
3. Assurez-vous que `window.useCustomModals = true` est défini **avant** le chargement de `modal.js`

### La fonction ne retourne pas de résultat

Assurez-vous d'utiliser `await` dans une fonction `async` :

```javascript
// ❌ Incorrect
function test() {
    const result = confirm("Test"); // Promise non résolue
}

// ✅ Correct
async function test() {
    const result = await confirm("Test");
}
```

### Conflit avec d'autres bibliothèques

Si d'autres bibliothèques modifient `alert/confirm/prompt`, chargez `modal.js` **en dernier**.

## Migration depuis les dialogues natifs

### Avant

```javascript
function deleteCandidate(id) {
    if (confirm("Supprimer ?")) {
        // Suppression
        alert("Candidat supprimé");
    }
}
```

### Après

```javascript
async function deleteCandidate(id) {
    if (await confirm("Supprimer ?")) {
        // Suppression
        await alert("Candidat supprimé");
    }
}
```

**Changements requis** :
1. Ajouter `async` à la fonction
2. Ajouter `await` devant `confirm()` et `alert()`
3. Propager `async` aux fonctions appelantes si nécessaire

