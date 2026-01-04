/**
 * Concours d'Éloquence - Jury Interface
 * 
 * IMPORTANT - Mot de passe admin de secours:
 * En cas de perte du mot de passe administrateur principal,
 * vous pouvez toujours vous connecter avec:
 * - Identifiant: admin
 * - Mot de passe: admin-recovery-2024
 * 
 * Ce mot de passe de secours fonctionne toujours, même si
 * le mot de passe principal a été changé dans Firebase.
 */

import { db } from './firebase-init.js';
import { 
    collection, addDoc, query, where, getDocs, getDoc, doc, setDoc, deleteDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// --- VARIABLES GLOBALES (Ajout de localStorage) ---
let currentJuryName = localStorage.getItem('currentJuryName') || ''; // Stocke le juryId
let currentJuryDisplayName = localStorage.getItem('currentJuryDisplayName') || ''; // Stocke le nom affiché
let storedSessionId = localStorage.getItem('sessionId') || '';
let activeRoundId = null; // Will be loaded from database
let activeRoundName = ''; // Nom du tour actif
let activeRoundType = ''; // Type du tour actif (Notation individuelle, Repêchage, Duels, Classement)
let activeRoundNextCandidates = 'ALL'; // Nombre de candidats pour le tour suivant
let selectedCandidateId = null;
let selectedScore1 = null; 
let selectedScore2 = null;
let CANDIDATES = [];

// Variables pour l'interface Repêchage
let repechageQualified = [];
let repechageEliminated = [];
let repechageScoresListener = null;
let roundChangeListener = null;

// Variables pour l'interface Duels
let duelCandidate1 = null;
let duelScore1 = null;
let duelCandidate2 = null;
let duelScore2 = null;

// --- INITIALISATION (Vérifie si le jury est déjà connecté ou si reset admin) ---
async function checkSessionAndStart() {
    try {
        const snap = await getDoc(doc(db, "config", "session"));
        const firebaseSessionId = snap.exists() ? snap.data().current_id : '1';

        if (storedSessionId !== firebaseSessionId && storedSessionId !== '') {
            logout(); // Reset forcé par l'admin
            return;
        }

        if (currentJuryName) {
            startScoring();
        } else {
            document.getElementById('identification-page').classList.add('active');
            await displayActiveRoundOnLogin(); // Afficher le tour en cours
        }
    } catch (e) {
        document.getElementById('identification-page').classList.add('active');
        await displayActiveRoundOnLogin(); // Afficher le tour en cours
    }
}

function logout() {
    // Nettoyer le listener de repêchage s'il existe
    if (repechageScoresListener) {
        repechageScoresListener();
        repechageScoresListener = null;
    }
    
    // Nettoyer le listener de changement de tour s'il existe
    if (roundChangeListener) {
        roundChangeListener();
        roundChangeListener = null;
    }
    
    // Supprimer uniquement les données de session, garder les préférences de thème
    localStorage.removeItem('currentJuryName');
    localStorage.removeItem('currentJuryDisplayName');
    localStorage.removeItem('sessionId');
    // Note: on garde les clés theme_* pour préserver les préférences de chaque jury
    location.reload();
}

// Exposer la fonction logout globalement pour les onclick
window.logout = logout;

// Rafraîchir manuellement la liste des candidats
window.refreshCandidateList = async function() {
    console.log('🔄 Rafraîchissement de la liste des candidats...');
    await updateCandidateSelect(selectedCandidateId);
    
    // Fermer le menu burger après le rafraîchissement
    const menuContent = document.getElementById('menu-content-scoring');
    if (menuContent) {
        menuContent.classList.remove('show');
    }
};

// Changer le mot de passe du jury
window.changePassword = async function() {
    if (!currentJuryName) {
        alert('Vous devez être connecté pour changer votre mot de passe');
        return;
    }
    
    try {
        // Récupérer le compte actuel (currentJuryName contient maintenant le juryId)
        const accountDoc = await getDoc(doc(db, "accounts", currentJuryName));
        if (!accountDoc.exists()) {
            alert('Compte non trouvé');
            return;
        }
        
        const currentPassword = accountDoc.data().password || '';
        
        // Demander l'ancien mot de passe
        const oldPassword = await prompt('Ancien mot de passe (laisser vide si aucun):');
        if (oldPassword === null) return; // Annulé
        
        // Vérifier l'ancien mot de passe
        if (oldPassword !== currentPassword) {
            alert('Ancien mot de passe incorrect');
            return;
        }
        
        // Demander le nouveau mot de passe
        const newPassword = await prompt('Nouveau mot de passe (laisser vide pour aucun):');
        if (newPassword === null) return; // Annulé
        
        // Demander confirmation
        const confirmPassword = await prompt('Confirmer le nouveau mot de passe:');
        if (confirmPassword === null) return; // Annulé
        
        if (newPassword !== confirmPassword) {
            alert('Les mots de passe ne correspondent pas');
            return;
        }
        
        // Mettre à jour le mot de passe (currentJuryName = juryId)
        await setDoc(doc(db, "accounts", currentJuryName), {
            password: newPassword
        }, { merge: true });
        
        alert('✓ Mot de passe changé avec succès');
        
        // Fermer le menu burger
        const menuContent = document.getElementById('menu-content-scoring');
        if (menuContent) {
            menuContent.classList.remove('show');
        }
    } catch (e) {
        console.error('Erreur lors du changement de mot de passe:', e);
        alert('Erreur: ' + e.message);
    }
};

document.getElementById('logout-button').onclick = logout;

// --------------------------------------------------------------------------------
// GRILLES DE BOUTONS (Limitées à 5/10/15/20/Elim)
// --------------------------------------------------------------------------------
function createGrids() {
    const gridFond = document.getElementById('grid-fond');
    const gridForme = document.getElementById('grid-forme');
    const values = [5, 10, 15, 20];
    
    gridFond.innerHTML = ''; gridForme.innerHTML = '';

    values.forEach(val => {
        const btn1 = document.createElement('button');
        btn1.className = 'score-btn score-btn-1';
        btn1.textContent = val;
        btn1.onclick = () => selectScore(1, val, btn1);
        gridFond.appendChild(btn1);

        const btn2 = document.createElement('button');
        btn2.className = 'score-btn score-btn-2';
        btn2.textContent = val;
        btn2.onclick = () => selectScore(2, val, btn2);
        gridForme.appendChild(btn2);
    });

    // Ajout bouton Elimine seulement pour Fond/Argumentation
    const elim1 = document.createElement('button');
    elim1.className = 'score-btn score-btn-1 eliminated';
    elim1.textContent = 'Éliminé';
    elim1.onclick = () => selectScore(1, 'EL', elim1);
    gridFond.appendChild(elim1);
}

function selectScore(type, value, element) {
    if (type === 1) {
        selectedScore1 = value;
        document.querySelectorAll('.score-btn-1').forEach(b => b.classList.remove('selected'));
        element.classList.add('selected');
        
        // Si "EL" est sélectionné, griser la note 2 et la mettre automatiquement à "EL"
        if (value === 'EL') {
            selectedScore2 = 'EL'; 
            disableScore2Grid();
            document.getElementById('display-score-2').textContent = 'Note : 0 (Éliminé)';
        } else {
            // Réactiver la grille note 2 si elle était désactivée
            enableScore2Grid();
        }
    } else {
        selectedScore2 = value;
        document.querySelectorAll('.score-btn-2').forEach(b => b.classList.remove('selected'));
        element.classList.add('selected');
    }
    
    document.getElementById(`display-score-${type}`).textContent = `Note : ${value}`;
    checkValidation();
}

// Désactiver la grille de note 2 (quand EL est sélectionné pour note 1)
function disableScore2Grid() {
    const gridForme = document.getElementById('grid-forme');
    if (!gridForme) return;
    
    // Griser tous les boutons de la note 2
    document.querySelectorAll('.score-btn-2').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        btn.classList.remove('selected');
    });
    
    // Ajouter un style visuel pour indiquer que la section est désactivée
    gridForme.style.opacity = '0.5';
    gridForme.style.pointerEvents = 'none';
}

// Réactiver la grille de note 2
function enableScore2Grid() {
    const gridForme = document.getElementById('grid-forme');
    if (!gridForme) return;
    
    // Réactiver tous les boutons de la note 2
    document.querySelectorAll('.score-btn-2').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });
    
    // Retirer le style de désactivation
    gridForme.style.opacity = '1';
    gridForme.style.pointerEvents = 'auto';
    
    // Réinitialiser la note 2 si elle était à EL
    if (selectedScore2 === 'EL') {
        selectedScore2 = null;
        document.getElementById('display-score-2').textContent = 'Note Forme : -';
    }
}

function displayExistingScoresReadOnly(scores) {
    // Réinitialiser les sélections
    selectedScore1 = null;
    selectedScore2 = null;
    
    // Désactiver tous les boutons et les griser
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.classList.remove('selected');
    });
    
    // Afficher les notes existantes en les marquant comme sélectionnées
    const score1Value = scores.score1;
    const score2Value = scores.score2;
    
    // Sélectionner visuellement le bouton correspondant pour score1
    document.querySelectorAll('.score-btn-1').forEach(btn => {
        if (btn.textContent === String(score1Value) || (score1Value === 'EL' && btn.textContent === 'Éliminé')) {
            btn.classList.add('selected');
            btn.style.opacity = '0.7'; // Un peu plus visible pour le bouton sélectionné
        }
    });
    
    // Si score1 est "EL", griser complètement la grille de note 2
    const gridForme = document.getElementById('grid-forme');
    if (score1Value === 'EL') {
        if (gridForme) {
            gridForme.style.opacity = '0.3';
            gridForme.style.pointerEvents = 'none';
        }
        document.getElementById('display-score-1').textContent = `Note Fond : Éliminé`;
        document.getElementById('display-score-2').textContent = `Note Forme : 0 (Éliminé)`;
    } else {
        // Sélectionner visuellement le bouton correspondant pour score2
        document.querySelectorAll('.score-btn-2').forEach(btn => {
            if (btn.textContent === String(score2Value)) {
                btn.classList.add('selected');
                btn.style.opacity = '0.7'; // Un peu plus visible pour le bouton sélectionné
            }
        });
        
        // Mettre à jour l'affichage des notes
        document.getElementById('display-score-1').textContent = `Note Fond : ${score1Value}`;
        document.getElementById('display-score-2').textContent = `Note Forme : ${score2Value}`;
    }
}

function enableScoreButtons() {
    // Réactiver tous les boutons
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.classList.remove('selected');
    });
    
    // Réactiver la grille de note 2 (au cas où elle était désactivée par EL)
    const gridForme = document.getElementById('grid-forme');
    if (gridForme) {
        gridForme.style.opacity = '1';
        gridForme.style.pointerEvents = 'auto';
    }
    
    // Réinitialiser les affichages
    selectedScore1 = null;
    selectedScore2 = null;
    document.getElementById('display-score-1').textContent = 'Note Fond : -';
    document.getElementById('display-score-2').textContent = 'Note Forme : -';
}

// --------------------------------------------------------------------------------
// LOGIQUE DE NAVIGATION
// --------------------------------------------------------------------------------

document.getElementById('start-scoring-button').onclick = async () => {
    const name = document.getElementById('jury-name-input').value.trim();
    const password = document.getElementById('password-input').value; // Can be empty
    
    if (name.length < 2) {
        alert('Veuillez entrer un nom valide');
        return;
    }

    try {
        // Vérification mode admin
        if (name.toLowerCase() === 'admin') {
            const adminDoc = await getDoc(doc(db, "config", "admin"));
            const storedPassword = adminDoc.exists() ? adminDoc.data().password : 'admin';
            
            // Mot de passe de secours hardcodé (en cas de perte du mot de passe principal)
            const BACKUP_ADMIN_PASSWORD = 'mot-de-passe-de-secours-2026!!';
            
            // Admin requires password
            if (!password) {
                alert('Veuillez entrer le mot de passe administrateur');
                return;
            }

            // Accepter soit le mot de passe stocké, soit le mot de passe de secours
            if (password === storedPassword || password === BACKUP_ADMIN_PASSWORD) {
                // Charger le thème personnel de l'admin depuis Firebase
                const adminTheme = adminDoc.exists() ? (adminDoc.data().theme || 'light') : 'light';
                localStorage.setItem('theme_admin', adminTheme);
                
                // Redirection vers admin.html
                window.location.href = 'admin.html';
            } else {
                alert('Mot de passe incorrect');
            }
            return;
        }

        // Chercher le compte par nom (nouvelle structure avec IDs numériques)
        const accountsSnap = await getDocs(collection(db, "accounts"));
        let accountDoc = null;
        let juryId = null;
        
        accountsSnap.forEach(doc => {
            const accountName = doc.data().name || doc.id;
            if (accountName === name) {
                accountDoc = doc;
                juryId = doc.id;
            }
        });
        
        if (accountDoc) {
            // Le compte existe - vérifier le mot de passe
            const storedPassword = accountDoc.data().password || '';
            
            if (password === storedPassword) {
                // Connexion réussie
                const snap = await getDoc(doc(db, "config", "session"));
                const firebaseSessionId = snap.exists() ? snap.data().current_id : '1';

                currentJuryName = juryId;  // Stocker l'ID du jury
                currentJuryDisplayName = accountDoc.data().name || name;  // Stocker le nom affiché
                storedSessionId = firebaseSessionId;
                localStorage.setItem('currentJuryName', juryId);
                localStorage.setItem('currentJuryDisplayName', currentJuryDisplayName);
                localStorage.setItem('sessionId', firebaseSessionId);
                
                // Charger le thème personnel du jury depuis Firebase
                const userTheme = accountDoc.data().theme || 'light';
                localStorage.setItem(`theme_${juryId}`, userTheme);
                
                // Appliquer le thème immédiatement
                if (typeof initTheme === 'function') {
                    initTheme();
                }
                
                startScoring();
            } else {
                alert('Mot de passe incorrect');
            }
        } else {
            // Le compte n'existe pas - vérifier le mot de passe par défaut
            // Charger le mot de passe par défaut depuis Firebase
            const juryDefaultsDoc = await getDoc(doc(db, "config", "juryDefaults"));
            const defaultPassword = juryDefaultsDoc.exists() ? (juryDefaultsDoc.data().defaultPassword || '') : '';
            
            // Vérifier que le mot de passe correspond au mot de passe par défaut
            if (password !== defaultPassword) {
                if (defaultPassword) {
                    alert(`❌ Mot de passe incorrect.\n\nPour créer un nouveau compte jury, vous devez utiliser le mot de passe par défaut fourni par l'administrateur.`);
                } else {
                    alert(`❌ Impossible de créer un compte.\n\nL'administrateur n'a pas encore configuré de mot de passe par défaut pour les jurys.\nContactez l'administrateur.`);
                }
                return;
            }
            
            // Proposer de créer le compte
            if (await confirm(`Ce compte n'existe pas. Voulez-vous le créer ?`)) {
                // Générer un nouvel ID numérique
                let maxNum = 0;
                accountsSnap.forEach(doc => {
                    const match = doc.id.match(/^jury(\d+)$/);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (num > maxNum) maxNum = num;
                    }
                });
                const newJuryId = `jury${maxNum + 1}`;
                
                // Déterminer si c'est le premier jury (président)
                const isFirstJury = accountsSnap.docs.length === 0;
                
                // Charger les tours pour déterminer les tours par défaut
                const roundsSnap = await getDoc(doc(db, "config", "rounds"));
                let defaultRounds = [];
                if (roundsSnap.exists()) {
                    const rounds = roundsSnap.data().rounds || [];
                    const activeRoundId = roundsSnap.data().activeRoundId || null;
                    const sortedRounds = [...rounds].sort((a, b) => a.order - b.order);
                    const activeRoundIndex = sortedRounds.findIndex(r => r.id === activeRoundId);
                    
                    defaultRounds = sortedRounds
                        .filter((r, index) => {
                            // Inclure le tour actif et tous les suivants
                            if (index < activeRoundIndex) return false;
                            
                            // Si c'est un repêchage, l'inclure seulement si c'est le président
                            if (r.type === 'Repêchage') {
                                return isFirstJury;
                            }
                            
                            return true;
                        })
                        .map(r => r.id);
                }
                
                // Créer le nouveau compte avec le mot de passe par défaut
                await setDoc(doc(db, "accounts", newJuryId), {
                    name: name,
                    password: defaultPassword,
                    theme: 'light',
                    createdAt: new Date(),
                    isPresident: isFirstJury,
                    rounds: defaultRounds
                });
                
                // Connexion automatique après création
                const snap = await getDoc(doc(db, "config", "session"));
                const firebaseSessionId = snap.exists() ? snap.data().current_id : '1';

                currentJuryName = newJuryId;  // Stocker l'ID du jury
                currentJuryDisplayName = name;  // Stocker le nom affiché
                storedSessionId = firebaseSessionId;
                localStorage.setItem('currentJuryName', newJuryId);
                localStorage.setItem('currentJuryDisplayName', name);
                localStorage.setItem('sessionId', firebaseSessionId);
                
                // Initialiser le thème pour le nouveau compte
                localStorage.setItem(`theme_${newJuryId}`, 'light');
                
                // Appliquer le thème immédiatement
                if (typeof initTheme === 'function') {
                    initTheme();
                }
                
                startScoring();
            }
        }
    } catch (e) {
        console.error('Erreur de connexion:', e);
        alert('Erreur de connexion: ' + e.message);
    }
};

async function displayActiveRoundOnLogin() {
    const snap = await getDoc(doc(db, "config", "rounds"));
    const display = document.getElementById('active-round-display');
    
    if (snap.exists()) {
        const rounds = snap.data().rounds || [];
        const activeId = snap.data().activeRoundId || null;
        const activeRound = rounds.find(r => r.id === activeId);
        
        if (activeRound) {
            display.textContent = `Tour en cours : ${activeRound.name}`;
        } else {
            display.textContent = 'Aucun tour actif';
        }
    } else {
        display.textContent = 'Tour en cours : 1er tour';
    }
}

async function loadActiveRound() {
    const snap = await getDoc(doc(db, "config", "rounds"));
    if (snap.exists()) {
        const rounds = snap.data().rounds || [];
        activeRoundId = snap.data().activeRoundId || null;
        
        // Trouver le tour actif complet
        const activeRound = rounds.find(r => r.id === activeRoundId);
        if (activeRound) {
            activeRoundName = activeRound.name;
            activeRoundType = activeRound.type || 'Notation individuelle';
            activeRoundNextCandidates = activeRound.nextRoundCandidates || 'ALL';
        } else {
            activeRoundName = '';
            activeRoundType = 'Notation individuelle';
            activeRoundNextCandidates = 'ALL';
        }
        
        // Fallback: if no active round, use the first round or create default
        if (!activeRoundId) {
            if (rounds.length > 0) {
                activeRoundId = rounds[0].id;
                activeRoundName = rounds[0].name;
                activeRoundType = rounds[0].type || 'Notation individuelle';
                activeRoundNextCandidates = rounds[0].nextRoundCandidates || 'ALL';
            } else {
                // Create default round if none exists
                activeRoundId = 'round1';
                activeRoundName = '1er tour';
                activeRoundType = 'Notation individuelle';
                activeRoundNextCandidates = 'ALL';
            }
        }
    } else {
        // Create default round configuration with 6 rounds
        activeRoundId = 'round1';
        activeRoundName = '1er tour';
        const defaultRounds = [
            {
                id: 'round1',
                order: 1,
                name: '1er tour',
                type: 'Notation individuelle',
                nextRoundCandidates: 'ALL',
                active: true
            },
            {
                id: 'round2',
                order: 2,
                name: 'Repechage 1er tour',
                type: 'Repêchage',
                nextRoundCandidates: 18,
                active: false
            },
            {
                id: 'round3',
                order: 3,
                name: '2eme tour',
                type: 'Duels',
                nextRoundCandidates: 'ALL',
                active: false
            },
            {
                id: 'round4',
                order: 4,
                name: 'Repechage 2eme tour',
                type: 'Repêchage',
                nextRoundCandidates: 7,
                active: false
            },
            {
                id: 'round5',
                order: 5,
                name: 'Demi-finale',
                type: 'Duels',
                nextRoundCandidates: 3,
                active: false
            },
            {
                id: 'round6',
                order: 6,
                name: 'Finale',
                type: 'Duels',
                nextRoundCandidates: 1,
                active: false
            }
        ];
        await setDoc(doc(db, "config", "rounds"), { 
            rounds: defaultRounds,
            activeRoundId: 'round1'
        });
    }
}

async function startScoring() {
    await loadActiveRound(); // Load active round before starting
    
    // Vérifier que le jury a accès au tour actif
    const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
    if (juryDoc.exists()) {
        const juryData = juryDoc.data();
        const juryRounds = juryData.rounds || [];
        
        // Vérifier si le jury est autorisé à accéder au tour actif
        if (!juryRounds.includes(activeRoundId)) {
            let message = `❌ Accès refusé\n\nVous n'êtes pas autorisé à accéder au tour actuel "${activeRoundName}".\n\n`;
            
            // Si c'est un tour de repêchage, mentionner le président
            if (activeRoundType === 'Repêchage') {
                // Charger le président
                const accountsSnap = await getDocs(collection(db, "accounts"));
                let presidentName = null;
                accountsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.isPresident) {
                        presidentName = data.name || doc.id;
                    }
                });
                
                if (presidentName) {
                    message += `ℹ️ Les tours de repêchage sont gérés par le président (${presidentName}).\n\n`;
                } else {
                    message += `ℹ️ Les tours de repêchage sont gérés par le président du jury.\n\n`;
                }
            }
            
            message += `Veuillez vous reconnecter quand votre tour sera actif.\n\nContactez l'administrateur si vous pensez qu'il s'agit d'une erreur.`;
            
            await customAlert(message);
            logout();
            return;
        }
    }
    
    document.getElementById('current-jury-display').textContent = currentJuryDisplayName;
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) {
        roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
    }
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    
    // Afficher l'interface appropriée selon le type de tour
    if (activeRoundType === 'Repêchage') {
        showRepechageInterface();
    } else if (activeRoundType === 'Duels') {
        showDuelsInterface();
    } else {
        // Notation individuelle ou Classement
        showNotationInterface();
    }
    
    // Écouter les changements de tour
    setupRoundChangeListener();
}

/**
 * Écouter les changements de tour initiés par l'admin
 */
function setupRoundChangeListener() {
    // Si un listener existe déjà, ne pas en créer un nouveau
    if (roundChangeListener) {
        return;
    }
    
    console.log('🔄 Setting up round change listener...');
    
    let isFirstSnapshot = true;
    
    roundChangeListener = onSnapshot(doc(db, "config", "roundChange"), (docSnap) => {
        // Ignorer le premier snapshot (état initial)
        if (isFirstSnapshot) {
            isFirstSnapshot = false;
            console.log('⏭️ Skipping initial round change snapshot');
            return;
        }
        
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        const newRoundId = data.newRoundId;
        const juriesOnNewRound = data.juriesOnNewRound || [];
        
        console.log(`🔔 Changement de tour détecté: ${newRoundId}`);
        console.log(`👥 Jurys présents sur le nouveau tour:`, juriesOnNewRound);
        
        // Vérifier si ce jury est présent sur le nouveau tour
        if (juriesOnNewRound.includes(currentJuryName)) {
            // Ce jury est présent sur le nouveau tour → recharger la page
            console.log('✅ Ce jury est présent sur le nouveau tour, rechargement...');
            location.reload();
        } else {
            // Ce jury n'est pas présent sur le nouveau tour → déconnecter
            console.log('❌ Ce jury n\'est pas présent sur le nouveau tour, déconnexion...');
            customAlert(`Le tour actif a changé.\n\nVous n'êtes pas autorisé à accéder au nouveau tour.\n\nVous allez être déconnecté.`).then(() => {
                logout();
            });
        }
    }, (error) => {
        console.error('❌ Error listening to round changes:', error);
    });
}

async function updateCandidateSelect(preserveSelection = null) {
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) CANDIDATES = docSnap.data().candidates || [];

    const q = query(
        collection(db, "scores"), 
        where("juryId", "==", currentJuryName),  // currentJuryName contient maintenant le juryId
        where("roundId", "==", activeRoundId || 'round1')
    );
    const snap = await getDocs(q);
    
    // Créer un map des candidats avec leurs scores complets
    const scoresByCandidate = {};
    snap.docs.forEach(d => {
        const data = d.data();
        scoresByCandidate[data.candidateId] = data;
    });

    const select = document.getElementById('candidate-select');
    const currentSelection = preserveSelection || selectedCandidateId;
    select.innerHTML = '<option value="" disabled selected>-- Choisir un candidat --</option>';

    // Filtrer les candidats : seulement ceux du tour actif
    const filteredCandidates = CANDIDATES.filter(c => c.tour === activeRoundId);
    
    // Trier par ID (ordre de passage)
    const sortedCandidates = filteredCandidates.sort((a, b) => {
        // Comparer les IDs numériques
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idA - idB;
    });

    sortedCandidates.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        
        // Vérifier le statut du candidat
        const isQualifiedOrEliminated = (c.status === 'Qualifie' || c.status === 'Elimine');
        const isActive = (c.status === 'Actif' || c.status === 'Reset');
        
        // Vérifier si les deux notations sont complètes
        const scores = scoresByCandidate[c.id];
        const bothScoresSet = scores && 
                              scores.score1 && scores.score1 !== '-' && 
                              scores.score2 && scores.score2 !== '-';
        
        if (isQualifiedOrEliminated) {
            // Candidats qualifiés ou éliminés : affichés en grisé
            opt.textContent = `${c.id} - ${c.name} (${c.status})`;
            opt.disabled = true;
            opt.style.color = '#999';
            opt.style.fontStyle = 'italic';
        } else if (isActive) {
            // Candidats actifs : disponibles pour notation
            if (bothScoresSet) {
                opt.textContent = `${c.id} - ${c.name} ✓`;
            } else {
                opt.textContent = `${c.id} - ${c.name}`;
            }
        } else {
            // Autres statuts (Reset, etc.)
        opt.textContent = `${c.id} - ${c.name}`;
        }
        
        // Restaurer la sélection si demandé
        if (currentSelection && c.id === currentSelection) {
            opt.selected = true;
        }
        
        select.appendChild(opt);
    });
}

// Rafraîchir la liste quand on clique sur le dropdown (pour voir les dernières mises à jour)
document.getElementById('candidate-select').onfocus = async () => {
    console.log('🔄 Rafraîchissement de la liste (clic sur dropdown)...');
    await updateCandidateSelect(selectedCandidateId);
};

document.getElementById('candidate-select').onchange = async (e) => {
    selectedCandidateId = e.target.value;
    const c = CANDIDATES.find(x => x.id === selectedCandidateId);
    
    // Sanity check: Re-vérifier le statut du candidat en temps réel
    const q = query(
        collection(db, "scores"), 
        where("candidateId", "==", selectedCandidateId),
        where("juryName", "==", currentJuryName)
    );
    const snap = await getDocs(q);
    
    // Charger les verrous
    const lockSnap = await getDoc(doc(db, "config", "locks"));
    const locks = lockSnap.exists() ? lockSnap.data().locks || {} : {};
    const isLocked = locks[selectedCandidateId]?.[currentJuryName] || false;
    
    // Vérifier si les deux notations sont complètes
    const scores = snap.docs.length > 0 ? snap.docs[0].data() : null;
    const bothScoresSet = scores && 
                          scores.score1 && scores.score1 !== '-' && 
                          scores.score2 && scores.score2 !== '-';
    
    if (isLocked) {
        alert(`⚠️ Ce candidat est verrouillé pour votre jury.\nVous ne pouvez pas le noter.`);
        selectedCandidateId = null;
        document.getElementById('candidate-select').value = '';
        document.getElementById('selected-candidate-display').textContent = '';
        checkValidation();
        // Rafraîchir la liste des candidats pour refléter les changements
        await updateCandidateSelect();
        return;
    }
    
    if (bothScoresSet) {
        const confirmOverwrite = confirm(
            `⚠️ Attention !\n\nVous avez déjà noté ce candidat:\n` +
            `- Argumentation: ${scores.score1}\n` +
            `- Réponse aux questions: ${scores.score2}\n\n` +
            `Voulez-vous modifier ces notes ?`
        );
        if (!confirmOverwrite) {
            selectedCandidateId = null;
            document.getElementById('candidate-select').value = '';
            document.getElementById('selected-candidate-display').textContent = '';
            checkValidation();
            // Rafraîchir la liste des candidats pour refléter les changements
            await updateCandidateSelect();
            return;
        }
    }
    
    document.getElementById('selected-candidate-display').textContent = `Candidat : ${c.name}`;
    checkValidation();
    
    // Rafraîchir la liste après sélection pour montrer l'état à jour des autres candidats
    // (en préservant la sélection actuelle)
    await updateCandidateSelect(selectedCandidateId);
};

function checkValidation() {
    document.getElementById('validate-button').disabled = !(selectedCandidateId && selectedScore1 && selectedScore2);
}

// --------------------------------------------------------------------------------
// GESTION MODALE ET ENVOI
// --------------------------------------------------------------------------------
document.getElementById('validate-button').onclick = async () => {
    // Sanity check: Re-vérifier le statut avant d'ouvrir la modale
    const lockSnap = await getDoc(doc(db, "config", "locks"));
    const locks = lockSnap.exists() ? lockSnap.data().locks || {} : {};
    const isLocked = locks[selectedCandidateId]?.[currentJuryName] || false;
    
    if (isLocked) {
        alert(`❌ Ce candidat est maintenant verrouillé.\nVous ne pouvez plus modifier cette notation.`);
        location.reload();
        return;
    }
    
    const c = CANDIDATES.find(x => x.id === selectedCandidateId);
    document.getElementById('modal-candidate').textContent = c.name;
    document.getElementById('modal-s1').textContent = selectedScore1;
    document.getElementById('modal-s2').textContent = selectedScore2;
    document.getElementById('confirmation-modal').style.display = 'flex';
};

document.getElementById('cancel-send-button').onclick = () => {
    document.getElementById('confirmation-modal').style.display = 'none';
};

document.getElementById('confirm-send-button').onclick = async () => {
    document.getElementById('confirmation-modal').style.display = 'none';
    
    try {
        // Sanity check: Re-vérifier si le candidat est verrouillé ou déjà noté
        const lockSnap = await getDoc(doc(db, "config", "locks"));
        const locks = lockSnap.exists() ? lockSnap.data().locks || {} : {};
        const isLocked = locks[selectedCandidateId]?.[currentJuryName] || false;
        
        if (isLocked) {
            alert(`❌ Ce candidat est maintenant verrouillé.\nImpossible d'enregistrer la notation.`);
            location.reload();
            return;
        }
        
        // Récupérer le nom du jury depuis le document accounts
        const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
        const juryName = juryDoc.exists() ? (juryDoc.data().name || currentJuryName) : currentJuryName;
        
        // Vérifier si un score existe déjà pour ce candidat, ce jury et ce tour
        const q = query(
            collection(db, "scores"), 
            where("candidateId", "==", selectedCandidateId),
            where("juryId", "==", currentJuryName),  // Chercher par juryId
            where("roundId", "==", activeRoundId || 'round1')
        );
        const existingScores = await getDocs(q);
        
        const scoreData = {
            juryId: currentJuryName,  // ID du jury (jury1, jury2, etc.)
            juryName: juryName,       // Nom affiché du jury (dénormalisé pour performance)
            candidateId: selectedCandidateId,
            roundId: activeRoundId || 'round1',
            score1: selectedScore1,
            score2: selectedScore2,
            timestamp: new Date()
        };
        
        if (!existingScores.empty) {
            // Sanity check: Nettoyer les doublons s'ils existent
            if (existingScores.docs.length > 1) {
                console.warn(`⚠️ ${existingScores.docs.length} doublons détectés, nettoyage...`);
                // Supprimer tous les doublons
                for (let i = 1; i < existingScores.docs.length; i++) {
                    await deleteDoc(doc(db, "scores", existingScores.docs[i].id));
                }
            }
            
            // Mettre à jour le score existant (évite les doublons)
            const existingDoc = existingScores.docs[0];
            console.log(`✏️ Mise à jour du score existant pour ${selectedCandidateId}`);
            await setDoc(doc(db, "scores", existingDoc.id), scoreData);
        } else {
            // Créer un nouveau score
            console.log(`✨ Création d'un nouveau score pour ${selectedCandidateId}`);
            await addDoc(collection(db, "scores"), scoreData);
        }
        
        // Réinitialiser le formulaire et rafraîchir la liste sans recharger la page
        selectedCandidateId = null;
        selectedScore1 = null;
        selectedScore2 = null;
        document.getElementById('selected-candidate-display').textContent = '';
        document.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('selected'));
        document.querySelectorAll('.elim-btn').forEach(btn => btn.classList.remove('eliminated'));
        checkValidation();
        
        // Rafraîchir la liste des candidats pour montrer l'état à jour
        await updateCandidateSelect();
        
        alert("✓ Notation enregistrée avec succès !");
    } catch (e) { 
        alert("Erreur d'envoi : " + e.message); 
    }
};

// ========================================
// INTERFACES SPÉCIFIQUES PAR TYPE DE TOUR
// ========================================

/**
 * Interface pour Notation Individuelle (standard)
 */
function showNotationInterface() {
    const scoringPage = document.getElementById('scoring-page');
    
    // Afficher les contrôles standard
    scoringPage.innerHTML = `
        <div class="burger-menu">
            <div class="burger-icon" onclick="toggleMenu()">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="burger-menu-content" id="menu-content-scoring">
                <div class="theme-toggle">
                    <span>Mode sombre</span>
                    <div class="toggle-switch" id="theme-toggle-scoring" onclick="toggleTheme()">
                        <div class="toggle-slider"></div>
                    </div>
                </div>
                <div class="menu-item" onclick="refreshCandidateList()">🔄 Rafraîchir la liste</div>
                <div class="menu-item" onclick="changePassword()">🔑 Changer le mot de passe</div>
                <div class="menu-item" onclick="logout()">🚪 Déconnexion</div>
            </div>
        </div>
        
        <p id="scoring-round-display" style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing);"></p>
        
        <h2 style="text-align: center; margin-bottom: var(--spacing);">
            Jury: <span id="current-jury-display"></span>
        </h2>
        
        <div class="control-group">
            <label for="candidate-select">1. Sélectionner un candidat</label>
            <select id="candidate-select">
                <option value="" disabled selected>-- Choisir un candidat --</option>
            </select>
            <p id="selected-candidate-display" class="selection-info">Aucun candidat sélectionné</p>
        </div>

        <hr>

        <div class="control-group">
            <label>2. Première Note</label>
            <div class="score-grid" id="grid-fond"></div>
            <p id="display-score-1" class="selection-info">Note Fond : -</p>
        </div>

        <hr>

        <div class="control-group">
            <label>3. Deuxième Note</label>
            <div class="score-grid" id="grid-forme"></div>
            <p id="display-score-2" class="selection-info">Note Forme : -</p>
        </div>

        <button id="validate-button" disabled>Valider la notation</button>
    `;
    
    // Mettre à jour les informations affichées
    document.getElementById('current-jury-display').textContent = currentJuryDisplayName;
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) {
        roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
    }
    
    // Initialiser le thème
    initTheme();
    
    // Créer les grilles et mettre à jour la liste
    createGrids();
    updateCandidateSelect();
    
    // Réattacher l'event listener pour la sélection de candidat
    document.getElementById('candidate-select').onchange = async function() {
        const candidateId = this.value;
        if (!candidateId) return;
        
        // Charger le candidat sélectionné
        const c = CANDIDATES.find(c => c.id === candidateId);
        if (!c) return;
        
        selectedCandidateId = candidateId;
        
        // Vérifier si le candidat a déjà des notes
        const q = query(
            collection(db, "scores"), 
            where("candidateId", "==", candidateId),
            where("juryId", "==", currentJuryName),
            where("roundId", "==", activeRoundId || 'round1')
        );
        const snap = await getDocs(q);
        const scores = snap.docs[0]?.data();
        
        // Vérifier si le candidat est verrouillé
        const lockSnap = await getDoc(doc(db, "config", "locks"));
        const locks = lockSnap.exists() ? lockSnap.data().locks || {} : {};
        const isLocked = locks[candidateId]?.[currentJuryName] || false;
        
        if (isLocked) {
            await customAlert(`❌ Ce candidat est verrouillé.\nVous ne pouvez plus modifier cette notation.`);
            selectedCandidateId = null;
            document.getElementById('candidate-select').value = '';
            document.getElementById('selected-candidate-display').textContent = '';
            checkValidation();
            await updateCandidateSelect();
            return;
        }
        
        const bothScoresSet = scores && scores.score1 && scores.score1 !== '-' && scores.score2 && scores.score2 !== '-';
        
        if (bothScoresSet) {
            // Afficher les notes existantes en lecture seule
            document.getElementById('selected-candidate-display').innerHTML = 
                `Candidat : ${c.name}<br><span style="color: var(--danger-color); font-size: 0.9em;">✓ Candidat déjà noté - Affichage en lecture seule</span>`;
            displayExistingScoresReadOnly(scores);
            selectedCandidateId = null; // Empêcher la validation
            checkValidation();
            await updateCandidateSelect(candidateId);
            return;
        }
        
        // Réactiver les boutons pour un nouveau candidat ou candidat non noté
        enableScoreButtons();
        document.getElementById('selected-candidate-display').textContent = `Candidat : ${c.name}`;
        checkValidation();
        await updateCandidateSelect(selectedCandidateId);
    };
    
    // Réattacher l'event listener pour le bouton de validation
    document.getElementById('validate-button').onclick = async () => {
        // Sanity check: Re-vérifier le statut avant d'ouvrir la modale
        const lockSnap = await getDoc(doc(db, "config", "locks"));
        const locks = lockSnap.exists() ? lockSnap.data().locks || {} : {};
        const isLocked = locks[selectedCandidateId]?.[currentJuryName] || false;
        
        if (isLocked) {
            await customAlert(`❌ Ce candidat est maintenant verrouillé.\nVous ne pouvez plus modifier cette notation.`);
            location.reload();
            return;
        }
        
        // Récupérer le nom du candidat et du jury pour l'affichage
        const candidate = CANDIDATES.find(c => c.id === selectedCandidateId);
        const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
        const juryName = juryDoc.exists() ? juryDoc.data().name : currentJuryName;
        
        // Vérifier si un score existe déjà
        const q = query(
            collection(db, "scores"), 
            where("candidateId", "==", selectedCandidateId),
            where("juryId", "==", currentJuryName),
            where("roundId", "==", activeRoundId || 'round1')
        );
        const existingScores = await getDocs(q);
        
        const scoreData = {
            juryId: currentJuryName,
            juryName: juryName,
            candidateId: selectedCandidateId,
            roundId: activeRoundId || 'round1',
            score1: selectedScore1,
            score2: selectedScore2,
            timestamp: new Date()
        };
        
        if (!existingScores.empty) {
            // Sanity check: Nettoyer les doublons s'ils existent
            if (existingScores.docs.length > 1) {
                console.warn(`⚠️ ${existingScores.docs.length} doublons détectés, nettoyage...`);
                for (let i = 1; i < existingScores.docs.length; i++) {
                    await deleteDoc(doc(db, "scores", existingScores.docs[i].id));
                }
            }
            
            // Mettre à jour le score existant
            const existingDoc = existingScores.docs[0];
            await setDoc(doc(db, "scores", existingDoc.id), scoreData);
        } else {
            // Créer un nouveau score
            await addDoc(collection(db, "scores"), scoreData);
        }
        
        // Réinitialiser le formulaire et rafraîchir la liste
        selectedCandidateId = null;
        selectedScore1 = null;
        selectedScore2 = null;
        document.getElementById('selected-candidate-display').textContent = '';
        document.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('selected'));
        document.querySelectorAll('.elim-btn').forEach(btn => btn.classList.remove('eliminated'));
        checkValidation();
        
        await updateCandidateSelect();
        await customAlert("✓ Notation enregistrée avec succès !");
    };
}

/**
 * Interface pour Repêchage
 * Système à deux colonnes : Qualifiés (note 1) / Éliminés (note 0)
 */
async function showRepechageInterface() {
    const scoringPage = document.getElementById('scoring-page');
    
    // Charger les candidats du tour actif
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) CANDIDATES = docSnap.data().candidates || [];
    
    // Filtrer tous les candidats du tour actif (quel que soit leur statut)
    const activeCandidates = CANDIDATES.filter(c => c.tour === activeRoundId);
    
    // Charger la configuration des tours pour trouver le tour précédent
    const roundsSnap = await getDoc(doc(db, "config", "rounds"));
    let previousRoundId = null;
    let numToQualify = 0;
    if (roundsSnap.exists()) {
        const rounds = roundsSnap.data().rounds || [];
        const sortedRounds = [...rounds].sort((a, b) => a.order - b.order);
        const currentRoundIndex = sortedRounds.findIndex(r => r.id === activeRoundId);
        
        if (currentRoundIndex > 0) {
            previousRoundId = sortedRounds[currentRoundIndex - 1].id;
            const currentRound = sortedRounds[currentRoundIndex];
            numToQualify = parseInt(currentRound.nextRoundCandidates) || 0;
        }
    }
    
    // Charger les scores du tour précédent pour calculer le classement initial
    let initiallyQualifiedSet = new Set();
    if (previousRoundId) {
        const prevScoresQuery = query(
            collection(db, "scores"),
            where("roundId", "==", previousRoundId)
        );
        const prevScoresSnap = await getDocs(prevScoresQuery);
        
        // Calculer les scores totaux pour chaque candidat
        const candidateScores = {};
        prevScoresSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (!candidateScores[data.candidateId]) {
                candidateScores[data.candidateId] = { id: data.candidateId, total: 0 };
            }
            
            const s1 = parseFloat(data.score1) || 0;
            const s2 = parseFloat(data.score2) || 0;
            
            // Si EL, contribution = 0
            if (data.score1 === 'EL' || data.score2 === 'EL') {
                candidateScores[data.candidateId].total += 0;
            } else if (data.score1 !== '-' && data.score2 !== '-') {
                candidateScores[data.candidateId].total += (s1 * 3 + s2);
            }
        });
        
        // Trier par score et prendre les N premiers
        const sortedCandidates = Object.values(candidateScores).sort((a, b) => b.total - a.total);
        for (let i = 0; i < Math.min(numToQualify, sortedCandidates.length); i++) {
            initiallyQualifiedSet.add(sortedCandidates[i].id);
        }
    }
    
    // Stocker globalement pour renderRepechageLists
    window.repechageInitiallyQualified = initiallyQualifiedSet;
    
    // Charger les scores existants pour ce jury
    const q = query(
        collection(db, "scores"),
        where("juryId", "==", currentJuryName),
        where("roundId", "==", activeRoundId)
    );
    const scoresSnap = await getDocs(q);
    const existingScores = {};
    scoresSnap.forEach(docSnap => {
        const data = docSnap.data();
        existingScores[data.candidateId] = data.score1; // Pour le repêchage, score1 = score2
    });
    
    // Initialiser les listes selon les scores existants
    repechageQualified = [];
    repechageEliminated = [];
    
    activeCandidates.forEach(c => {
        // Utiliser le score existant ou, par défaut, le classement initial
        let score = existingScores[c.id];
        if (score === undefined || score === null) {
            // Si pas de score existant, utiliser le classement initial
            score = initiallyQualifiedSet.has(c.id) ? '1' : '0';
        }
        
        if (score === '1') {
            repechageQualified.push(c.id);
        } else {
            repechageEliminated.push(c.id);
        }
    });
    
    // Afficher l'interface
    scoringPage.innerHTML = `
        <div class="burger-menu">
            <div class="burger-icon" onclick="toggleMenu()">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="burger-menu-content" id="menu-content-scoring">
                <div class="theme-toggle">
                    <span>Mode sombre</span>
                    <div class="toggle-switch" id="theme-toggle-scoring" onclick="toggleTheme()">
                        <div class="toggle-slider"></div>
                    </div>
                </div>
                <div class="menu-item" onclick="changePassword()">🔑 Changer le mot de passe</div>
                <div class="menu-item" onclick="logout()">🚪 Déconnexion</div>
            </div>
        </div>
        
        <p id="scoring-round-display" style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing);"></p>
        
        <h2 style="text-align: center; margin-bottom: var(--spacing);">
            Jury: <span id="current-jury-display"></span>
        </h2>
        
        <h3 style="text-align: center; margin-bottom: var(--spacing); color: var(--text-color);">
            Repêchage - Sélectionner exactement ${activeRoundNextCandidates === 'ALL' ? 'tous les' : activeRoundNextCandidates} candidat(s) qualifié(s)
        </h3>
        
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: 10px;">
            Cliquez sur un candidat pour choisir entre <strong>Qualifié</strong> et <strong>Éliminé</strong>
        </p>
        <p style="text-align: center; color: var(--text-secondary); font-size: 0.9em; margin-bottom: 20px;">
            <span style="color: #28a745;">■ Vert</span> = Initialement qualifié • 
            <span style="color: #dc3545;">■ Rouge</span> = Initialement éliminé
        </p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing); margin-bottom: var(--spacing);">
            <div style="border: 2px solid var(--success-color); border-radius: var(--radius); padding: var(--spacing); background: var(--card-bg);">
                <h4 style="text-align: center; color: var(--success-color); margin-bottom: 10px;">✓ Qualifiés - <span id="qualified-count">0</span>/${activeRoundNextCandidates === 'ALL' ? 'Tous' : activeRoundNextCandidates}</h4>
                <div id="qualified-list" style="min-height: 200px;">
                    <!-- Liste des qualifiés -->
                </div>
            </div>
            
            <div style="border: 2px solid var(--danger-color); border-radius: var(--radius); padding: var(--spacing); background: var(--card-bg);">
                <h4 style="text-align: center; color: var(--danger-color); margin-bottom: 10px;">✗ Éliminés - <span id="eliminated-count">0</span></h4>
                <div id="eliminated-list" style="min-height: 200px;">
                    <!-- Liste des éliminés -->
                </div>
            </div>
        </div>
        
        <p style="text-align: center; color: var(--text-secondary); margin: 20px 0 10px 0; font-size: 0.9em; padding: 10px; background: var(--bg-secondary); border-radius: var(--radius);">
            ℹ️ Vos votes sont automatiquement sauvegardés. Cliquez ci-dessous pour <strong>finaliser</strong> et mettre à jour les statuts des candidats.
        </p>
        
        <p id="repechage-help-text" style="display: none;"></p>
        
        <button id="repechage-validate-button" style="width: 100%; padding: 15px; font-size: 1.1em; background: var(--primary-color); color: white; border: none; border-radius: var(--radius); cursor: pointer; opacity: 0.5;" disabled>
            ✓ Finaliser et valider les statuts
        </button>
    `;
    
    // Mettre à jour les informations affichées
    document.getElementById('current-jury-display').textContent = currentJuryDisplayName;
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) {
        roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
    }
    
    // Initialiser le thème
    initTheme();
    
    // Afficher les listes
    renderRepechageLists();
    
    // Event listener pour le bouton de validation
    document.getElementById('repechage-validate-button').addEventListener('click', confirmRepechage);
    
    // Listener en temps réel pour détecter les changements de scores
    setupRepechageListener();
}

/**
 * Écouter les changements de scores en temps réel pour le repêchage
 */
function setupRepechageListener() {
    // Si un listener existe déjà, le désactiver
    if (repechageScoresListener) {
        repechageScoresListener();
        repechageScoresListener = null;
    }
    
    // Créer un nouveau listener pour les scores de ce jury sur ce tour
    const q = query(
        collection(db, "scores"),
        where("juryId", "==", currentJuryName),
        where("roundId", "==", activeRoundId)
    );
    
    let isFirstSnapshot = true;
    
    repechageScoresListener = onSnapshot(q, async (snapshot) => {
        // Ignorer le premier appel (état initial)
        if (isFirstSnapshot) {
            isFirstSnapshot = false;
            return;
        }
        
        // Vérifier s'il y a eu des changements
        const changes = snapshot.docChanges();
        if (changes.length === 0) return;
        
        console.log('🔄 Changements détectés dans les scores de repêchage');
        
        // Charger tous les candidats du tour actif
        const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
        if (!docSnap.exists()) return;
        
        const allCandidates = docSnap.data().candidates || [];
        const activeCandidates = allCandidates.filter(c => c.tour === activeRoundId);
        
        // Construire un map des scores existants
        const existingScores = {};
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            existingScores[data.candidateId] = data.score1; // score1 = score2 pour le repêchage
        });
        
        // Récupérer les candidats initialement qualifiés
        const initiallyQualified = window.repechageInitiallyQualified || new Set();
        
        // Réinitialiser les listes
        repechageQualified = [];
        repechageEliminated = [];
        
        // Répartir tous les candidats selon leur score (ou valeur par défaut)
        activeCandidates.forEach(c => {
            let score = existingScores[c.id];
            
            // Si pas de score existant, utiliser le classement initial
            if (score === undefined || score === null) {
                score = initiallyQualified.has(c.id) ? '1' : '0';
            }
            
            if (score === '1') {
                repechageQualified.push(c.id);
            } else {
                repechageEliminated.push(c.id);
            }
        });
        
        // Rafraîchir l'affichage
        renderRepechageLists();
    }, (error) => {
        console.error('Erreur lors de l\'écoute des scores de repêchage:', error);
    });
}

/**
 * Afficher les listes de candidats pour le repêchage
 */
function renderRepechageLists() {
    const qualifiedList = document.getElementById('qualified-list');
    const eliminatedList = document.getElementById('eliminated-list');
    
    // Récupérer les candidats initialement qualifiés
    const initiallyQualified = window.repechageInitiallyQualified || new Set();
    
    // Trier les candidats par ID
    const sortedQualified = repechageQualified.map(id => CANDIDATES.find(c => c.id === id)).sort((a, b) => parseInt(a.id) - parseInt(b.id));
    const sortedEliminated = repechageEliminated.map(id => CANDIDATES.find(c => c.id === id)).sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    // Afficher les qualifiés
    qualifiedList.innerHTML = sortedQualified.map(c => {
        // Vert si initialement qualifié, rouge si initialement éliminé
        const nameColor = initiallyQualified.has(c.id) ? '#28a745' : '#dc3545';
        return `
            <div style="padding: 10px; margin: 5px 0; background: var(--input-bg); border-radius: var(--radius); cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="moveToEliminated('${c.id}')">
                <span style="color: ${nameColor}; font-weight: 500;"><strong>${c.id}</strong> - ${c.name}</span>
                <span style="color: var(--danger-color); font-weight: 500;">→ Éliminer</span>
            </div>
        `;
    }).join('');
    
    // Afficher les éliminés
    eliminatedList.innerHTML = sortedEliminated.map(c => {
        // Vert si initialement qualifié, rouge si initialement éliminé
        const nameColor = initiallyQualified.has(c.id) ? '#28a745' : '#dc3545';
        return `
            <div style="padding: 10px; margin: 5px 0; background: var(--input-bg); border-radius: var(--radius); cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="moveToQualified('${c.id}')">
                <span style="color: ${nameColor}; font-weight: 500;"><strong>${c.id}</strong> - ${c.name}</span>
                <span style="color: var(--success-color); font-weight: 500;">← Qualifier</span>
            </div>
        `;
    }).join('');
    
    // Mettre à jour les compteurs
    document.getElementById('qualified-count').textContent = repechageQualified.length;
    document.getElementById('eliminated-count').textContent = repechageEliminated.length;
    
    // Activer/désactiver le bouton de validation selon le nombre requis
    const validateBtn = document.getElementById('repechage-validate-button');
    if (validateBtn) {
        const expectedCount = activeRoundNextCandidates === 'ALL' 
            ? (repechageQualified.length + repechageEliminated.length) // Tous les candidats doivent être qualifiés
            : parseInt(activeRoundNextCandidates) || 0;
        
        const isValid = repechageQualified.length === expectedCount;
        
        validateBtn.disabled = !isValid;
        validateBtn.style.opacity = isValid ? '1' : '0.5';
        validateBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        
        // Afficher un message d'aide si le nombre n'est pas correct
        const helpText = document.getElementById('repechage-help-text');
        if (helpText) {
            if (isValid) {
                helpText.textContent = '';
                helpText.style.display = 'none';
            } else {
                helpText.textContent = `⚠️ Vous devez sélectionner exactement ${expectedCount} candidat(s) qualifié(s) pour valider.`;
                helpText.style.display = 'block';
                helpText.style.color = 'var(--warning-color)';
                helpText.style.textAlign = 'center';
                helpText.style.marginTop = '10px';
                helpText.style.fontWeight = '600';
            }
        }
    }
}

/**
 * Déplacer un candidat vers la liste des qualifiés (note 1)
 */
window.moveToQualified = async function(candidateId) {
    const index = repechageEliminated.indexOf(candidateId);
    if (index > -1) {
        repechageEliminated.splice(index, 1);
        repechageQualified.push(candidateId);
        renderRepechageLists();
        
        // Mettre à jour immédiatement le score dans Firebase
        await updateRepechageScore(candidateId, '1');
    }
};

/**
 * Déplacer un candidat vers la liste des éliminés (note 0)
 */
window.moveToEliminated = async function(candidateId) {
    const index = repechageQualified.indexOf(candidateId);
    if (index > -1) {
        repechageQualified.splice(index, 1);
        repechageEliminated.push(candidateId);
        renderRepechageLists();
        
        // Mettre à jour immédiatement le score dans Firebase
        await updateRepechageScore(candidateId, '0');
    }
};

/**
 * Mettre à jour le score de repêchage pour un candidat
 */
async function updateRepechageScore(candidateId, scoreValue) {
    try {
        // Récupérer le nom du jury
        const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
        const juryName = juryDoc.exists() ? juryDoc.data().name : currentJuryName;
        
        // Chercher si un score existe déjà
        const q = query(
            collection(db, "scores"),
            where("candidateId", "==", candidateId),
            where("juryId", "==", currentJuryName),
            where("roundId", "==", activeRoundId)
        );
        const existingScores = await getDocs(q);
        
        const scoreData = {
            juryId: currentJuryName,
            juryName: juryName,
            candidateId: candidateId,
            roundId: activeRoundId,
            score1: scoreValue,
            score2: scoreValue, // Les deux scores sont identiques pour le repêchage
            timestamp: new Date()
        };
        
        if (!existingScores.empty) {
            // Mettre à jour le score existant
            const existingDoc = existingScores.docs[0];
            await setDoc(doc(db, "scores", existingDoc.id), scoreData);
        } else {
            // Créer un nouveau score
            await addDoc(collection(db, "scores"), scoreData);
        }
        
        console.log(`✅ Score mis à jour: ${candidateId} = ${scoreValue}`);
    } catch (e) {
        console.error('Erreur lors de la mise à jour du score:', e);
    }
}

/**
 * Afficher le podium après la validation du repêchage
 */
async function showRepechagePodium() {
    const scoringPage = document.getElementById('scoring-page');
    
    // Charger tous les candidats
    const candidatesDoc = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (!candidatesDoc.exists()) {
        await customAlert('Erreur : Impossible de charger les candidats.');
        return;
    }
    const allCandidates = candidatesDoc.data().candidates || [];
    
    // Charger la configuration pour trouver le tour précédent
    const roundsSnap = await getDoc(doc(db, "config", "rounds"));
    let previousRoundId = null;
    if (roundsSnap.exists()) {
        const rounds = roundsSnap.data().rounds || [];
        const sortedRounds = [...rounds].sort((a, b) => a.order - b.order);
        const currentRoundIndex = sortedRounds.findIndex(r => r.id === activeRoundId);
        if (currentRoundIndex > 0) {
            previousRoundId = sortedRounds[currentRoundIndex - 1].id;
        }
    }
    
    // Charger les scores du tour de repêchage (votes du président)
    const repechageScoresQuery = query(
        collection(db, "scores"),
        where("roundId", "==", activeRoundId)
    );
    const repechageScoresSnap = await getDocs(repechageScoresQuery);
    
    // Charger les jurys pour identifier le président
    const accountsSnap = await getDocs(collection(db, "accounts"));
    let president = null;
    accountsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.isPresident) {
            president = { id: docSnap.id, name: data.name };
        }
    });
    
    // Construire les données agrégées
    const aggregatedData = {};
    allCandidates.forEach(c => {
        aggregatedData[c.id] = { 
            id: c.id,
            name: c.name, 
            status: c.status,
            tour: c.tour,
            total: 0, 
            juryScores: {}, 
            hasScores: false 
        };
    });
    
    // Ajouter les scores de repêchage (votes du président)
    repechageScoresSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (aggregatedData[data.candidateId] && president) {
            aggregatedData[data.candidateId].juryScores[president.name] = data;
        }
    });
    
    // Charger les scores du tour précédent
    let previousRoundScores = {};
    let previousRoundJuries = [];
    if (previousRoundId) {
        const prevQuery = query(
            collection(db, "scores"),
            where("roundId", "==", previousRoundId)
        );
        const prevQuerySnapshot = await getDocs(prevQuery);
        
        const previousRoundJuriesSet = new Set();
        prevQuerySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const juryId = data.juryId || data.juryName;
            previousRoundJuriesSet.add(juryId);
            
            if (!previousRoundScores[data.candidateId]) {
                previousRoundScores[data.candidateId] = {};
            }
            previousRoundScores[data.candidateId][juryId] = {
                score1: data.score1,
                score2: data.score2,
                juryName: data.juryName
            };
        });
        
        // Récupérer la liste des jurys du tour précédent
        accountsSnap.forEach(docSnap => {
            const juryId = docSnap.id;
            if (previousRoundJuriesSet.has(juryId)) {
                previousRoundJuries.push({ 
                    id: juryId, 
                    name: docSnap.data().name 
                });
            }
        });
    }
    
    // Calculer les scores pour chaque candidat (même logique que l'admin)
    allCandidates.forEach(c => {
        let totalScore = 0;
        let hasScores = false;
        
        if (president) {
            // Pour le repêchage, vérifier d'abord le vote du président
            const presidentScore = aggregatedData[c.id].juryScores[president.name];
            let presidentVote = null;
            
            if (presidentScore && presidentScore.score1 !== '-') {
                presidentVote = presidentScore.score1; // '0' ou '1'
            }
            
            // Si le président a voté "0" (éliminé), le score est 0
            if (presidentVote === '0') {
                totalScore = 0;
                hasScores = true;
            }
            // Si le président a voté "1" (qualifié) ou n'a pas encore voté, utiliser le score du tour précédent
            else {
                previousRoundJuries.forEach(jury => {
                    const scores = previousRoundScores[c.id]?.[jury.id];
                    if (scores) {
                        if (scores.score1 !== '-' && scores.score2 !== '-') {
                            hasScores = true;
                            
                            // Règle : si un jury met "EL", toute sa notation = 0
                            if (scores.score1 === 'EL' || scores.score2 === 'EL') {
                                totalScore += 0;
                            } else {
                                const s1 = parseFloat(scores.score1) || 0;
                                const s2 = parseFloat(scores.score2) || 0;
                                totalScore += (s1 * 3 + s2);
                            }
                        }
                    }
                });
            }
        }
        
        aggregatedData[c.id].total = totalScore;
        aggregatedData[c.id].hasScores = hasScores;
    });
    
    // Filtrer et trier les candidats (même logique que renderPodium de l'admin)
    let candidateScores = Object.values(aggregatedData).filter(c => {
        // Inclure uniquement les candidats du tour de repêchage qui ne sont pas éliminés
        return c.tour === activeRoundId && c.hasScores && c.status !== 'Elimine';
    }).sort((a, b) => b.total - a.total);
    
    // Afficher le podium
    scoringPage.innerHTML = `
        <div class="burger-menu">
            <div class="burger-icon" onclick="toggleMenu()">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="burger-menu-content" id="menu-content-scoring">
                <div class="theme-toggle">
                    <span>Mode sombre</span>
                    <div class="toggle-switch" id="theme-toggle-scoring" onclick="toggleTheme()">
                        <div class="toggle-slider"></div>
                    </div>
                </div>
                <div class="menu-item" onclick="logout()">🚪 Déconnexion</div>
            </div>
        </div>
        
        <h2 style="text-align: center; margin-bottom: var(--spacing); color: var(--text-color);">
            🏆 Résultats du Repêchage
        </h2>
        
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing);">
            Tour : ${activeRoundName}
        </p>
        
        <div style="max-width: 800px; margin: 0 auto; background: var(--card-bg); border-radius: var(--radius); padding: var(--spacing); box-shadow: var(--shadow-md);">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--neutral-color); color: white;">
                        <th style="padding: 15px; text-align: center; border: 1px solid var(--border-color);">Rang</th>
                        <th style="padding: 15px; text-align: left; border: 1px solid var(--border-color);">Candidat</th>
                        <th style="padding: 15px; text-align: center; border: 1px solid var(--border-color);">Score</th>
                    </tr>
                </thead>
                <tbody id="podium-body-jury">
                </tbody>
            </table>
        </div>
        
        <div style="display: flex; justify-content: center; margin-top: var(--spacing);">
            <button onclick="logout()" style="max-width: 400px; padding: 15px 40px; font-size: 1.1em; background: var(--danger-color); color: white; border: none; border-radius: var(--radius); cursor: pointer; font-weight: 600;">
                ✓ Terminer
            </button>
        </div>
    `;
    
    // Initialiser le thème
    initTheme();
    
    // Remplir le tableau
    const tbody = document.getElementById('podium-body-jury');
    candidateScores.forEach((c, i) => {
        const row = tbody.insertRow();
        
        // Appliquer les styles selon le rang
        if (i === 0) {
            row.style.background = 'linear-gradient(135deg, gold 0%, #ffed4e 100%)';
            row.style.fontWeight = 'bold';
        } else if (i === 1) {
            row.style.background = 'linear-gradient(135deg, silver 0%, #e0e0e0 100%)';
            row.style.fontWeight = 'bold';
        } else if (i === 2) {
            row.style.background = 'linear-gradient(135deg, #cd7f32 0%, #b87333 100%)';
            row.style.fontWeight = 'bold';
            row.style.color = 'white';
        }
        
        const cellRank = row.insertCell();
        cellRank.textContent = i + 1;
        cellRank.style.padding = '15px';
        cellRank.style.textAlign = 'center';
        cellRank.style.border = '1px solid var(--border-color)';
        cellRank.style.color = i <= 1 ? '#212529' : (i === 2 ? 'white' : 'var(--text-color)');
        
        const cellName = row.insertCell();
        cellName.textContent = c.name;
        cellName.style.padding = '15px';
        cellName.style.textAlign = 'left';
        cellName.style.border = '1px solid var(--border-color)';
        cellName.style.color = i <= 1 ? '#212529' : (i === 2 ? 'white' : 'var(--text-color)');
        
        const cellScore = row.insertCell();
        cellScore.textContent = c.total;
        cellScore.style.padding = '15px';
        cellScore.style.textAlign = 'center';
        cellScore.style.border = '1px solid var(--border-color)';
        cellScore.style.color = i <= 1 ? '#212529' : (i === 2 ? 'white' : 'var(--text-color)');
    });
}

/**
 * Confirmer et enregistrer les votes du repêchage
 */
async function confirmRepechage() {
    // Vérifier que le nombre de qualifiés correspond exactement au nombre requis
    const expectedCount = activeRoundNextCandidates === 'ALL' 
        ? (repechageQualified.length + repechageEliminated.length) // Tous les candidats doivent être qualifiés
        : parseInt(activeRoundNextCandidates) || 0;
    
    if (repechageQualified.length !== expectedCount) {
        await customAlert(`❌ Impossible de valider.\n\nVous devez sélectionner exactement ${expectedCount} candidat(s) qualifié(s).\n\nActuellement : ${repechageQualified.length} qualifié(s)`);
        return;
    }
    
    if (!await customConfirm(`Confirmer et finaliser vos votes ?\n\n✓ ${repechageQualified.length} candidat(s) qualifié(s)\n✗ ${repechageEliminated.length} candidat(s) éliminé(s)\n\nLe statut des candidats sera mis à jour.`)) {
        return;
    }
    
    try {
        // Charger tous les candidats
        const candidatesDoc = await getDoc(doc(db, "candidats", "liste_actuelle"));
        if (!candidatesDoc.exists()) {
            await customAlert('Erreur : Impossible de charger les candidats.');
            return;
        }
        
        let allCandidates = candidatesDoc.data().candidates || [];
        let updatedCount = 0;
        
        // Mettre à jour le statut de chaque candidat selon les votes
        allCandidates = allCandidates.map(candidate => {
            // Vérifier si ce candidat est dans le tour de repêchage actif
            if (candidate.tour === activeRoundId) {
                if (repechageQualified.includes(candidate.id)) {
                    // Note 1 → Statut Qualifié
                    if (candidate.status !== 'Qualifie') {
                        candidate.status = 'Qualifie';
                        updatedCount++;
                    }
                } else if (repechageEliminated.includes(candidate.id)) {
                    // Note 0 → Statut Éliminé
                    if (candidate.status !== 'Elimine') {
                        candidate.status = 'Elimine';
                        updatedCount++;
                    }
                }
            }
            return candidate;
        });
        
        // Sauvegarder les candidats mis à jour
        await setDoc(doc(db, "candidats", "liste_actuelle"), { candidates: allCandidates });
        
        // Mettre à jour la variable globale
        CANDIDATES = allCandidates;
        
        await customAlert(`✓ Votes finalisés avec succès !\n\n✓ ${repechageQualified.length} candidat(s) qualifié(s)\n✗ ${repechageEliminated.length} candidat(s) éliminé(s)\n📊 ${updatedCount} statut(s) mis à jour`);
        
        // Vérifier si l'option d'affichage du podium après repêchage est activée
        const podiumConfigDoc = await getDoc(doc(db, "config", "podiumSettings"));
        const showPodiumAfterRepechage = podiumConfigDoc.exists() ? podiumConfigDoc.data().showPodiumAfterRepechage : false;
        
        if (showPodiumAfterRepechage) {
            // Afficher l'écran podium
            await showRepechagePodium();
        } else {
            // Déconnecter directement
            logout();
        }
        
    } catch (e) {
        console.error('Erreur lors de la finalisation des votes:', e);
        await customAlert('Erreur lors de la mise à jour des statuts : ' + e.message);
    }
}

/**
 * Interface pour Duels
 */
async function showDuelsInterface() {
    const scoringPage = document.getElementById('scoring-page');
    
    // Charger les candidats du tour actif
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) CANDIDATES = docSnap.data().candidates || [];
    
    // Filtrer les candidats du tour actif qui sont "Actif" ou "Reset"
    const activeCandidates = CANDIDATES.filter(c => 
        c.tour === activeRoundId && (c.status === 'Actif' || c.status === 'Reset')
    ).sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    // Réinitialiser les sélections
    duelCandidate1 = null;
    duelScore1 = null;
    duelCandidate2 = null;
    duelScore2 = null;
    
    // Afficher l'interface
    scoringPage.innerHTML = `
        <div class="burger-menu">
            <div class="burger-icon" onclick="toggleMenu()">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="burger-menu-content" id="menu-content-scoring">
                <div class="theme-toggle">
                    <span>Mode sombre</span>
                    <div class="toggle-switch" id="theme-toggle-scoring" onclick="toggleTheme()">
                        <div class="toggle-slider"></div>
                    </div>
                </div>
                <div class="menu-item" onclick="changePassword()">🔑 Changer le mot de passe</div>
                <div class="menu-item" onclick="logout()">🚪 Déconnexion</div>
            </div>
        </div>
        
        <p id="scoring-round-display" style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing);"></p>
        
        <h2 style="text-align: center; margin-bottom: var(--spacing);">
            Jury: <span id="current-jury-display"></span>
        </h2>
        
        <h3 style="text-align: center; margin-bottom: var(--spacing); color: var(--text-color);">
            Duel - Notez les deux candidats
        </h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing); margin-bottom: var(--spacing);">
            <!-- Candidat 1 -->
            <div style="border: 2px solid var(--primary-color); border-radius: var(--radius); padding: var(--spacing); background: var(--card-bg);">
                <h4 style="text-align: center; color: var(--primary-color); margin-bottom: 10px;">Candidat 1</h4>
                
                <div class="control-group">
                    <label for="duel-candidate-1">Sélectionner</label>
                    <select id="duel-candidate-1" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius); background: var(--input-bg); color: var(--text-color); font-size: 1em;">
                        <option value="">-- Choisir --</option>
                        ${activeCandidates.map(c => `<option value="${c.id}">${c.id} - ${c.name}</option>`).join('')}
                    </select>
                </div>
                
                <div class="control-group" style="margin-top: 15px;">
                    <label>Note</label>
                    <div id="duel-grid-1" class="score-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 8px; margin-top: 10px;">
                        ${[5, 10, 15, 20].map(score => `
                            <button class="score-btn" data-candidate="1" data-score="${score}" style="padding: 15px; font-size: 1.2em; background: var(--input-bg); color: var(--text-color); border: 2px solid var(--border-color); border-radius: var(--radius); cursor: pointer;">
                                ${score}
                            </button>
                        `).join('')}
                    </div>
                    <p id="duel-display-1" class="selection-info" style="margin-top: 10px; text-align: center; color: var(--text-secondary);">Note : -</p>
                </div>
            </div>
            
            <!-- Candidat 2 -->
            <div style="border: 2px solid var(--secondary-color); border-radius: var(--radius); padding: var(--spacing); background: var(--card-bg);">
                <h4 style="text-align: center; color: var(--secondary-color); margin-bottom: 10px;">Candidat 2</h4>
                
                <div class="control-group">
                    <label for="duel-candidate-2">Sélectionner</label>
                    <select id="duel-candidate-2" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius); background: var(--input-bg); color: var(--text-color); font-size: 1em;">
                        <option value="">-- Choisir --</option>
                        ${activeCandidates.map(c => `<option value="${c.id}">${c.id} - ${c.name}</option>`).join('')}
                    </select>
                </div>
                
                <div class="control-group" style="margin-top: 15px;">
                    <label>Note</label>
                    <div id="duel-grid-2" class="score-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 8px; margin-top: 10px;">
                        ${[5, 10, 15, 20].map(score => `
                            <button class="score-btn" data-candidate="2" data-score="${score}" style="padding: 15px; font-size: 1.2em; background: var(--input-bg); color: var(--text-color); border: 2px solid var(--border-color); border-radius: var(--radius); cursor: pointer;">
                                ${score}
                            </button>
                        `).join('')}
                    </div>
                    <p id="duel-display-2" class="selection-info" style="margin-top: 10px; text-align: center; color: var(--text-secondary);">Note : -</p>
                </div>
            </div>
        </div>
        
        <button id="duel-validate-button" disabled style="width: 100%; padding: 15px; font-size: 1.1em; background: var(--primary-color); color: white; border: none; border-radius: var(--radius); cursor: pointer; opacity: 0.5;">
            Valider le duel
        </button>
    `;
    
    // Mettre à jour les informations affichées
    document.getElementById('current-jury-display').textContent = currentJuryDisplayName;
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) {
        roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
    }
    
    // Initialiser le thème
    initTheme();
    
    // Event listeners pour les dropdowns
    document.getElementById('duel-candidate-1').addEventListener('change', (e) => {
        duelCandidate1 = e.target.value;
        checkDuelValidation();
    });
    
    document.getElementById('duel-candidate-2').addEventListener('change', (e) => {
        duelCandidate2 = e.target.value;
        checkDuelValidation();
    });
    
    // Event listeners pour les boutons de score
    document.getElementById('duel-grid-1').querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const candidateNum = parseInt(this.dataset.candidate);
            const score = parseInt(this.dataset.score);
            selectDuelScore(candidateNum, score, this);
        });
    });
    
    document.getElementById('duel-grid-2').querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const candidateNum = parseInt(this.dataset.candidate);
            const score = parseInt(this.dataset.score);
            selectDuelScore(candidateNum, score, this);
        });
    });
    
    // Event listener pour le bouton de validation
    document.getElementById('duel-validate-button').addEventListener('click', confirmDuel);
}

/**
 * Sélectionner une note pour un candidat de duel
 */
function selectDuelScore(candidateNum, score, button) {
    // Désélectionner les autres boutons de la même grille
    const gridId = `duel-grid-${candidateNum}`;
    const grid = document.getElementById(gridId);
    grid.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('selected'));
    
    // Sélectionner ce bouton
    button.classList.add('selected');
    
    // Enregistrer le score
    if (candidateNum === 1) {
        duelScore1 = score;
    } else {
        duelScore2 = score;
    }
    
    // Afficher le score
    document.getElementById(`duel-display-${candidateNum}`).textContent = `Note : ${score}`;
    
    // Vérifier la validation
    checkDuelValidation();
}

/**
 * Vérifier si le duel peut être validé
 */
function checkDuelValidation() {
    const validateBtn = document.getElementById('duel-validate-button');
    
    if (duelCandidate1 && duelCandidate2 && duelScore1 && duelScore2 && duelCandidate1 !== duelCandidate2) {
        validateBtn.disabled = false;
        validateBtn.style.opacity = '1';
    } else {
        validateBtn.disabled = true;
        validateBtn.style.opacity = '0.5';
    }
}

/**
 * Confirmer le duel
 */
async function confirmDuel() {
    const candidate1 = CANDIDATES.find(c => c.id === duelCandidate1);
    const candidate2 = CANDIDATES.find(c => c.id === duelCandidate2);
    
    if (!await customConfirm(`Confirmer ce duel ?\n\n${candidate1.name} : ${duelScore1}\n${candidate2.name} : ${duelScore2}`)) {
        return;
    }
    
    try {
        // Récupérer le nom du jury pour la dénormalisation
        const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
        const juryName = juryDoc.exists() ? juryDoc.data().name : currentJuryName;
        
        // Enregistrer les deux scores
        const scores = [
            {
                juryId: currentJuryName,
                juryName: juryName,
                candidateId: duelCandidate1,
                roundId: activeRoundId,
                score1: duelScore1,
                score2: 0, // Pas de deuxième note pour les duels
                timestamp: new Date()
            },
            {
                juryId: currentJuryName,
                juryName: juryName,
                candidateId: duelCandidate2,
                roundId: activeRoundId,
                score1: duelScore2,
                score2: 0, // Pas de deuxième note pour les duels
                timestamp: new Date()
            }
        ];
        
        for (const scoreData of scores) {
            // Vérifier si un score existe déjà
            const q = query(
                collection(db, "scores"),
                where("candidateId", "==", scoreData.candidateId),
                where("juryId", "==", currentJuryName),
                where("roundId", "==", activeRoundId)
            );
            const existingScores = await getDocs(q);
            
            if (!existingScores.empty) {
                // Mettre à jour
                await setDoc(doc(db, "scores", existingScores.docs[0].id), scoreData);
            } else {
                // Créer
                await addDoc(collection(db, "scores"), scoreData);
            }
        }
        
        await customAlert("✓ Duel enregistré avec succès !");
        
        // Rafraîchir l'interface
        showDuelsInterface();
    } catch (e) {
        await customAlert("Erreur lors de l'enregistrement : " + e.message);
    }
}

checkSessionAndStart();

// Rafraîchir automatiquement la liste des candidats toutes les 30 secondes
// pour détecter les modifications faites dans l'interface admin
setInterval(async () => {
    // Ne rafraîchir que si on est sur la page de notation
    const scoringPage = document.getElementById('scoring-page');
    if (scoringPage && scoringPage.classList.contains('active')) {
        console.log('🔄 Auto-rafraîchissement de la liste des candidats...');
        await updateCandidateSelect(selectedCandidateId);
    }
}, 30000); // 30 secondes