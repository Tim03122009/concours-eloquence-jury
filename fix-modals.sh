#!/bin/bash

# Script pour ajouter await devant tous les confirm() et prompt() dans des fonctions async

# Backup des fichiers
cp admin.html admin.html.backup
cp script.js script.js.backup

# Remplacer "if (!confirm(" par "if (!await confirm(" dans admin.html
sed -i '' 's/if (!confirm(/if (!await confirm(/g' admin.html

# Remplacer "if (confirm(" par "if (await confirm(" dans admin.html
sed -i '' 's/if (confirm(/if (await confirm(/g' admin.html

# Remplacer "const ... = prompt(" par "const ... = await prompt(" dans admin.html
sed -i '' 's/\(const [a-zA-Z_][a-zA-Z0-9_]* = \)prompt(/\1await prompt(/g' admin.html

# Remplacer "let ... = prompt(" par "let ... = await prompt(" dans admin.html
sed -i '' 's/\(let [a-zA-Z_][a-zA-Z0-9_]* = \)prompt(/\1await prompt(/g' admin.html

# Faire de même pour script.js
sed -i '' 's/if (!confirm(/if (!await confirm(/g' script.js
sed -i '' 's/if (confirm(/if (await confirm(/g' script.js
sed -i '' 's/\(const [a-zA-Z_][a-zA-Z0-9_]* = \)prompt(/\1await prompt(/g' script.js
sed -i '' 's/\(let [a-zA-Z_][a-zA-Z0-9_]* = \)prompt(/\1await prompt(/g' script.js

echo "✓ Remplacements effectués"
echo "✓ Backups créés : admin.html.backup, script.js.backup"

