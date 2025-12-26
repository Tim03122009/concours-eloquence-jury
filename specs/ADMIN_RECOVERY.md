# 🔐 Récupération du Compte Administrateur

## Mot de passe de secours

Si vous avez perdu le mot de passe administrateur principal, vous pouvez toujours accéder au panneau d'administration avec les identifiants de secours suivants :

### Identifiants de secours

- **Identifiant** : `admin`
- **Mot de passe de secours** : `admin-recovery-2024`

⚠️ **Important** : Ce mot de passe de secours est hardcodé dans le code source et fonctionne **toujours**, indépendamment du mot de passe principal stocké dans Firebase.

## Comment utiliser le mot de passe de secours

1. Allez sur la page de connexion
2. Entrez `admin` comme identifiant
3. Entrez `admin-recovery-2024` comme mot de passe
4. Vous serez redirigé vers le panneau d'administration

## Réinitialiser le mot de passe principal

Une fois connecté avec le mot de passe de secours :

1. Cliquez sur le menu burger (☰) en haut à droite
2. Sélectionnez "Changer le mot de passe"
3. Définissez un nouveau mot de passe principal

## Sécurité

⚠️ **Recommandation de sécurité** :

- Ce mot de passe de secours est visible dans le code source
- Pour une utilisation en production, il est recommandé de :
  1. Changer le mot de passe de secours dans `script.js` (ligne ~186)
  2. Ne pas partager ce document publiquement
  3. Conserver une copie sécurisée de ce mot de passe

## Localisation dans le code

Le mot de passe de secours est défini dans :
- **Fichier** : `script.js`
- **Variable** : `BACKUP_ADMIN_PASSWORD`
- **Ligne** : ~186

```javascript
const BACKUP_ADMIN_PASSWORD = 'admin-recovery-2024';
```

## Notes

- Le mot de passe de secours fonctionne en parallèle du mot de passe principal
- Vous pouvez utiliser l'un ou l'autre pour vous connecter
- Le changement du mot de passe principal n'affecte pas le mot de passe de secours

