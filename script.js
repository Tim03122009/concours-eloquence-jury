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
let currentJuryName = localStorage.getItem('currentJuryName') || '';
let storedSessionId = localStorage.getItem('sessionId') || '';
let activeRoundId = null; // Will be loaded from database
let selectedCandidateId = null;
let selectedScore1 = null; 
let selectedScore2 = null;
let CANDIDATES = [];

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
        }
    } catch (e) {
        document.getElementById('identification-page').classList.add('active');
    }
}

function logout() {
    // Supprimer uniquement les données de session, garder les préférences de thème
    localStorage.removeItem('currentJuryName');
    localStorage.removeItem('sessionId');
    // Note: on garde les clés theme_* pour préserver les préférences de chaque jury
    location.reload();
}

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
    elim1.onclick = () => selectScore(1, 'Elimine', elim1);
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
                storedSessionId = firebaseSessionId;
                localStorage.setItem('currentJuryName', juryId);
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
            // Le compte n'existe pas - proposer de le créer
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
                
                // Créer le nouveau compte avec thème par défaut
                await setDoc(doc(db, "accounts", newJuryId), {
                    name: name,
                    password: password,
                    theme: 'light',
                    createdAt: new Date()
                });
                
                // Connexion automatique après création
                const snap = await getDoc(doc(db, "config", "session"));
                const firebaseSessionId = snap.exists() ? snap.data().current_id : '1';

                currentJuryName = newJuryId;  // Stocker l'ID du jury
                storedSessionId = firebaseSessionId;
                localStorage.setItem('currentJuryName', newJuryId);
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

async function loadActiveRound() {
    const snap = await getDoc(doc(db, "config", "rounds"));
    if (snap.exists()) {
        activeRoundId = snap.data().activeRoundId || null;
        
        // Fallback: if no active round, use the first round or create default
        if (!activeRoundId) {
            const rounds = snap.data().rounds || [];
            if (rounds.length > 0) {
                activeRoundId = rounds[0].id;
            } else {
                // Create default round if none exists
                activeRoundId = 'round1';
            }
        }
    } else {
        // Create default round configuration
        activeRoundId = 'round1';
        const defaultRounds = [{
            id: 'round1',
            order: 1,
            name: 'Premier tour',
            type: 'Notation individuelle',
            nextRoundCandidates: 'ALL',
            active: true
        }];
        await setDoc(doc(db, "config", "rounds"), { 
            rounds: defaultRounds,
            activeRoundId: 'round1'
        });
    }
}

async function startScoring() {
    await loadActiveRound(); // Load active round before starting
    document.getElementById('current-jury-display').textContent = currentJuryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    createGrids();
    updateCandidateSelect();
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

    // Charger les verrous
    const lockSnap = await getDoc(doc(db, "config", "locks"));
    const locks = lockSnap.exists() ? lockSnap.data().locks || {} : {};

    const select = document.getElementById('candidate-select');
    const currentSelection = preserveSelection || selectedCandidateId;
    select.innerHTML = '<option value="" disabled selected>-- Choisir un candidat --</option>';

    CANDIDATES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        
        // Vérifier si le candidat est verrouillé pour ce jury
        const isLocked = locks[c.id]?.[currentJuryName] || false;
        
        // Vérifier si les deux notations sont complètes
        const scores = scoresByCandidate[c.id];
        const bothScoresSet = scores && 
                              scores.score1 && scores.score1 !== '-' && 
                              scores.score2 && scores.score2 !== '-';
        
        if (isLocked) {
            opt.textContent = `${c.id} - ${c.name} 🔒`;
            opt.disabled = true;
            opt.style.color = '#999';
        } else if (bothScoresSet) {
            opt.textContent = `${c.id} - ${c.name} ✓`;
            opt.disabled = true;
            opt.style.color = '#999';
        } else {
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