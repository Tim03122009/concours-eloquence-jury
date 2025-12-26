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
    collection, addDoc, query, where, getDocs, getDoc, doc, setDoc, deleteDoc 
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
    } else {
        selectedScore2 = value;
        document.querySelectorAll('.score-btn-2').forEach(b => b.classList.remove('selected'));
    }
    element.classList.add('selected');
    document.getElementById(`display-score-${type}`).textContent = `Note : ${value}`;
    checkValidation();
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
                
                // Créer le nouveau compte avec le mot de passe par défaut
                await setDoc(doc(db, "accounts", newJuryId), {
                    name: name,
                    password: defaultPassword,
                    theme: 'light',
                    createdAt: new Date()
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
            <label>2. Fond / Argumentation (Coefficient ×3)</label>
            <div class="score-grid" id="grid-fond"></div>
            <p id="display-score-1" class="selection-info">Note Fond : -</p>
        </div>

        <hr>

        <div class="control-group">
            <label>3. Forme / Éloquence (Coefficient ×1)</label>
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
            const confirmOverwrite = await customConfirm(
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
                await updateCandidateSelect();
                return;
            }
        }
        
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
 */
async function showRepechageInterface() {
    const scoringPage = document.getElementById('scoring-page');
    
    // Charger les candidats du tour actif
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) CANDIDATES = docSnap.data().candidates || [];
    
    // Filtrer les candidats du tour actif qui sont "Actif" ou "Reset"
    const activeCandidates = CANDIDATES.filter(c => 
        c.tour === activeRoundId && (c.status === 'Actif' || c.status === 'Reset')
    );
    
    // Initialiser les listes
    repechageQualified = [];
    repechageEliminated = activeCandidates.map(c => c.id);
    
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
            Repêchage - Sélectionner ${activeRoundNextCandidates} candidat(s)
        </h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing); margin-bottom: var(--spacing);">
            <div style="border: 2px solid var(--success-color); border-radius: var(--radius); padding: var(--spacing); background: var(--card-bg);">
                <h4 style="text-align: center; color: var(--success-color); margin-bottom: 10px;">✓ Qualifiés (<span id="qualified-count">0</span>/${activeRoundNextCandidates})</h4>
                <div id="qualified-list" style="min-height: 200px;">
                    <!-- Liste des qualifiés -->
                </div>
            </div>
            
            <div style="border: 2px solid var(--danger-color); border-radius: var(--radius); padding: var(--spacing); background: var(--card-bg);">
                <h4 style="text-align: center; color: var(--danger-color); margin-bottom: 10px;">✗ Éliminés (<span id="eliminated-count">${repechageEliminated.length}</span>)</h4>
                <div id="eliminated-list" style="min-height: 200px;">
                    <!-- Liste des éliminés -->
                </div>
            </div>
        </div>
        
        <button id="repechage-validate-button" disabled style="width: 100%; padding: 15px; font-size: 1.1em; background: var(--primary-color); color: white; border: none; border-radius: var(--radius); cursor: pointer;">
            Confirmer le repêchage
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
}

/**
 * Afficher les listes de candidats pour le repêchage
 */
function renderRepechageLists() {
    const qualifiedList = document.getElementById('qualified-list');
    const eliminatedList = document.getElementById('eliminated-list');
    
    // Trier les candidats par ID
    const sortedQualified = repechageQualified.map(id => CANDIDATES.find(c => c.id === id)).sort((a, b) => parseInt(a.id) - parseInt(b.id));
    const sortedEliminated = repechageEliminated.map(id => CANDIDATES.find(c => c.id === id)).sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    // Afficher les qualifiés
    qualifiedList.innerHTML = sortedQualified.map(c => `
        <div style="padding: 10px; margin: 5px 0; background: var(--input-bg); border-radius: var(--radius); cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="moveToEliminated('${c.id}')">
            <span style="color: var(--text-color);"><strong>${c.id}</strong> - ${c.name}</span>
            <span style="color: var(--danger-color);">→ Éliminer</span>
        </div>
    `).join('');
    
    // Afficher les éliminés
    eliminatedList.innerHTML = sortedEliminated.map(c => `
        <div style="padding: 10px; margin: 5px 0; background: var(--input-bg); border-radius: var(--radius); cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="moveToQualified('${c.id}')">
            <span style="color: var(--text-color);"><strong>${c.id}</strong> - ${c.name}</span>
            <span style="color: var(--success-color);">← Qualifier</span>
        </div>
    `).join('');
    
    // Mettre à jour les compteurs
    document.getElementById('qualified-count').textContent = repechageQualified.length;
    document.getElementById('eliminated-count').textContent = repechageEliminated.length;
    
    // Activer/désactiver le bouton de validation
    const validateBtn = document.getElementById('repechage-validate-button');
    const expectedCount = parseInt(activeRoundNextCandidates);
    if (repechageQualified.length === expectedCount) {
        validateBtn.disabled = false;
        validateBtn.style.opacity = '1';
    } else {
        validateBtn.disabled = true;
        validateBtn.style.opacity = '0.5';
    }
}

/**
 * Déplacer un candidat vers la liste des qualifiés
 */
window.moveToQualified = function(candidateId) {
    const index = repechageEliminated.indexOf(candidateId);
    if (index > -1) {
        repechageEliminated.splice(index, 1);
        repechageQualified.push(candidateId);
        renderRepechageLists();
    }
};

/**
 * Déplacer un candidat vers la liste des éliminés
 */
window.moveToEliminated = function(candidateId) {
    const index = repechageQualified.indexOf(candidateId);
    if (index > -1) {
        repechageQualified.splice(index, 1);
        repechageEliminated.push(candidateId);
        renderRepechageLists();
    }
};

/**
 * Confirmer le repêchage
 */
async function confirmRepechage() {
    if (!await customConfirm(`Confirmer le repêchage ?\n\n✓ ${repechageQualified.length} candidat(s) qualifié(s)\n✗ ${repechageEliminated.length} candidat(s) éliminé(s)`)) {
        return;
    }
    
    try {
        // Mettre à jour le statut de chaque candidat dans la base de données
        const candidatesRef = doc(db, "candidats", "liste_actuelle");
        const docSnap = await getDoc(candidatesRef);
        
        if (docSnap.exists()) {
            const allCandidates = docSnap.data().candidates || [];
            
            allCandidates.forEach(candidate => {
                if (repechageQualified.includes(candidate.id)) {
                    candidate.status = 'Qualifie';
                } else if (repechageEliminated.includes(candidate.id)) {
                    candidate.status = 'Elimine';
                }
            });
            
            await setDoc(candidatesRef, { candidates: allCandidates });
            
            await customAlert("✓ Repêchage enregistré avec succès !");
            
            // Rafraîchir l'interface
            showRepechageInterface();
        }
    } catch (e) {
        await customAlert("Erreur lors de l'enregistrement : " + e.message);
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