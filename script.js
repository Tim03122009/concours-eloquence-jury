/**
 * Concours d'Éloquence - Jury Interface
 * 
 * RÔLES (séparation stricte) :
 * - Jury : saisie uniquement (notes fond/forme, votes repêchage, notes duels).
 * - Président : choix (repêchage) + bonus ; pas d’activation ni d’affichage global.
 * - Admin : activation (tours, bonus, classements) + affichage ; pas de saisie jury.
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
    collection, addDoc, query, where, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, onSnapshot, increment 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// --- VARIABLES GLOBALES (Ajout de localStorage) ---
let currentJuryName = localStorage.getItem('currentJuryName') || ''; // Stocke le juryId
let currentJuryDisplayName = localStorage.getItem('currentJuryDisplayName') || ''; // Stocke le nom affiché
let storedSessionId = localStorage.getItem('sessionId') || '';
let activeRoundId = null; // Will be loaded from database
let activeRoundName = ''; // Nom du tour actif
let activeRoundType = ''; // Type du tour actif (Notation individuelle, Repêchage, Duels, Classement)
let activeRoundTypeEpreuve = ''; // type_epreuve = duels | classement | notation | repêchage
let activeRoundNextCandidates = 'ALL'; // Nombre de candidats pour le tour suivant
let activeRoundClassementId = null; // Si type Classement : id du classement
let activeRoundClassementCode = null; // Si type Classement : code du classement
let selectedCandidateId = null;
let selectedScore1 = null; 
let selectedScore2 = null;
let selectedCandidate2Id = null;
let selectedScore1_c2 = null;
let selectedScore2_c2 = null;
// Petite finale — épreuve 2 (Œuvre contemporaine) : 4 notes (globale 30, fond 20, critère, note 20)
let selectedCandidateIdExo2 = null;
let selectedScore1Exo2 = null;  // globale /30
let selectedScore2Exo2 = null;  // fond /20
let selectedScore3Exo2 = null;   // critère spécifique
let selectedScore4Exo2 = null;   // note /20
let selectedCandidate2IdExo2 = null;
let selectedScore1_c2Exo2 = null;
let selectedScore2_c2Exo2 = null;
// Petite finale — épreuve 3 (Le temps des discours) : 4 notes (globale 30, fond 20, critère, note 20)
let selectedCandidateIdExo3 = null;
let selectedScore1Exo3 = null;  // globale /30
let selectedScore2Exo3 = null;  // fond /20
let selectedScore3Exo3 = null;  // critère spécifique
let selectedScore4Exo3 = null;  // note /20
let CANDIDATES = [];

// Variables pour l'interface Repêchage
let repechageQualified = [];
let repechageEliminated = [];
let repechageScoresListener = null;
let roundChangeListener = null;
let sessionLockListener = null;

// Variables pour l'interface Duels (Fond + Forme pour chaque candidat)
let duelCandidate1 = null;
let duelScore1Fond = null;
let duelScore1Forme = null;
let duelCandidate2 = null;
let duelScore2Fond = null;
let duelScore2Forme = null;

// Variables pour l'interface Classement (lecture seule, sync temps réel)
let classementListener = null;
let isCurrentUserPresident = false;

/** Critère à évaluer pour la note « critère spécifique » en petite finale (assigné par l'admin). */
let currentJuryCriterePetiteFinale = '';

// Listeners temps réel (admin → jury : mise à jour sans recharger la page)
let roundsRealtimeListener = null;
let candidatesRealtimeListener = null;
let duelResultsRealtimeListener = null;
let juryAccountRealtimeListener = null;
let scoresRealtimeListener = null;
let previousClassementEntriesForOvertake = null; // Entrées avant mise à jour (pour animation dépassement)

// Variables pour la configuration des tours
let ROUNDS = [];
let JURIES = [];

/** Positions pour "Mon classement" : 5 premières positions (1 à 5). */
const MON_CLASSEMENT_POSITIONS = ['1', '2', '3', '4', '5'];

/**
 * Charge les tours depuis Firebase
 */
async function loadRoundsConfig() {
    try {
        const snap = await getDoc(doc(db, "config", "rounds"));
        if (snap.exists()) {
            ROUNDS = snap.data().rounds || [];
        }
    } catch (e) {
        console.error('Erreur chargement rounds:', e);
    }
}

/**
 * Charge les jurys depuis Firebase
 */
async function loadJuriesConfig() {
    try {
        const accountsSnap = await getDocs(collection(db, "accounts"));
        JURIES = [];
        accountsSnap.forEach(docSnap => {
            const data = docSnap.data();
            JURIES.push({
                id: docSnap.id,
                name: data.name || docSnap.id,
                rounds: data.rounds || [],
                isPresident: data.isPresident || false
            });
        });
    } catch (e) {
        console.error('Erreur chargement jurys:', e);
    }
}

/**
 * Vérifie si tous les candidats actifs ont leurs notes complètes
 * et qualifie/élimine selon nextRoundCandidates
 * Cette fonction est appelée après chaque enregistrement de score
 */
async function checkAndQualifyCandidateFromJury(candidateId) {
    try {
        console.log(`🔍 [Jury] Vérification qualification pour candidat ${candidateId}...`);
        
        // Charger la configuration si nécessaire
        if (ROUNDS.length === 0) await loadRoundsConfig();
        if (JURIES.length === 0) await loadJuriesConfig();
        
        // Trouver le tour actif
        const activeRound = ROUNDS.find(r => r.id === activeRoundId);
        if (!activeRound) {
            console.log('❌ Tour actif non trouvé');
            return;
        }
        
        // Charger les candidats frais depuis Firebase
        const candidatesDoc = await getDoc(doc(db, "candidats", "liste_actuelle"));
        if (!candidatesDoc.exists()) return;
        
        const allCandidates = candidatesDoc.data().candidates || [];
        const candidatesInRound = allCandidates.filter(c => c.tour === activeRoundId && c.status === 'Actif');
        
        if (candidatesInRound.length === 0) {
            console.log('❌ Aucun candidat actif dans ce tour');
            return;
        }
        
        // Jurys présents sur ce tour
        const juriesOnRound = JURIES.filter(j => j.rounds && j.rounds.includes(activeRoundId));
        if (juriesOnRound.length === 0) {
            console.log('❌ Aucun jury présent sur ce tour');
            return;
        }
        
        console.log(`📋 ${candidatesInRound.length} candidats actifs, ${juriesOnRound.length} jurys présents`);
        
        // Charger tous les scores du tour
        const scoresQuery = query(
            collection(db, "scores"),
            where("roundId", "==", activeRoundId)
        );
        const scoresSnap = await getDocs(scoresQuery);
        
        // Organiser les scores par candidat
        const scoresByCandidate = {};
        scoresSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (!scoresByCandidate[data.candidateId]) {
                scoresByCandidate[data.candidateId] = {};
            }
            const juryId = data.juryId || data.juryName;
            scoresByCandidate[data.candidateId][juryId] = {
                score1: data.score1,
                score2: data.score2
            };
        });
        
        // Vérifier si TOUS les candidats ont TOUTES leurs notes complètes
        let allCandidatesComplete = true;
        const candidateScores = [];
        
        for (const c of candidatesInRound) {
            const candidateScoreData = scoresByCandidate[c.id] || {};
            let isComplete = true;
            let totalScore = 0;
            
            for (const jury of juriesOnRound) {
                const scores = candidateScoreData[jury.id];
                if (!scores || 
                    !scores.score1 || scores.score1 === '-' ||
                    !scores.score2 || scores.score2 === '-') {
                    isComplete = false;
                    allCandidatesComplete = false;
                    break;
                }
                
                // Calculer le score (EL = 0)
                if (scores.score1 === 'EL' || scores.score2 === 'EL') {
                    totalScore += 0;
                } else {
                    const s1 = parseFloat(scores.score1) || 0;
                    const s2 = parseFloat(scores.score2) || 0;
                    totalScore += (s1 * 3 + s2);
                }
            }
            
            if (isComplete) {
                candidateScores.push({
                    id: c.id,
                    name: c.name,
                    totalScore: totalScore
                });
            }
        }
        
        // Si tous les candidats ne sont pas complets, on attend
        if (!allCandidatesComplete) {
            console.log(`⏳ En attente: ${candidatesInRound.length - candidateScores.length}/${candidatesInRound.length} candidat(s) sans notes complètes`);
            return;
        }
        
        console.log(`✅ Tous les ${candidatesInRound.length} candidats ont leurs notes complètes!`);
        
        // Trier par score décroissant
        candidateScores.sort((a, b) => b.totalScore - a.totalScore);
        
        // Déterminer le nombre à qualifier
        let qualifyCount;
        if (activeRound.nextRoundCandidates === 'ALL') {
            qualifyCount = candidateScores.length;
        } else {
            qualifyCount = parseInt(activeRound.nextRoundCandidates) || candidateScores.length;
        }
        
        console.log(`🏆 Qualification: ${qualifyCount}/${candidateScores.length} candidats`);
        
        // Qualifier/Éliminer
        let qualifiedCount = 0;
        let eliminatedCount = 0;
        
        candidateScores.forEach((scoreData, index) => {
            const c = allCandidates.find(cand => cand.id === scoreData.id);
            if (c) {
                if (index < qualifyCount) {
                    c.status = 'Qualifie';
                    qualifiedCount++;
                    console.log(`  ✓ ${c.name}: ${scoreData.totalScore} pts → Qualifié (rang ${index + 1})`);
                } else {
                    c.status = 'Elimine';
                    eliminatedCount++;
                    console.log(`  ✗ ${c.name}: ${scoreData.totalScore} pts → Éliminé (rang ${index + 1})`);
                }
            }
        });
        
        // Sauvegarder les candidats
        await setDoc(doc(db, "candidats", "liste_actuelle"), { candidates: allCandidates });
        console.log(`✅ Qualification terminée: ${qualifiedCount} qualifié(s), ${eliminatedCount} éliminé(s)`);
        
    } catch (e) {
        console.error('❌ Erreur lors de la vérification qualification:', e);
    }
}

// --- INITIALISATION (Vérifie si le jury est déjà connecté ou si reset admin) ---
async function checkSessionAndStart() {
    try {
        const snap = await getDoc(doc(db, "config", "session"));
        const data = snap.exists() ? snap.data() : {};
        const firebaseSessionId = data.current_id || '1';
        const sessionLocked = data.sessionLocked === true;

        if (sessionLocked) {
            localStorage.removeItem('currentJuryName');
            localStorage.removeItem('currentJuryDisplayName');
            localStorage.removeItem('sessionId');
            showIdentificationOnly();
            await displayActiveRoundOnLogin();
            const display = document.getElementById('active-round-display');
            if (display) display.textContent = 'Session verrouillée. Vous n\'avez plus accès aux modifications.';
            return;
        }

        if (storedSessionId !== firebaseSessionId && storedSessionId !== '') {
            logout(); // Reset forcé par l'admin
            return;
        }

        if (currentJuryName) {
            startScoring();
        } else {
            showIdentificationOnly();
            await displayActiveRoundOnLogin(); // Afficher le tour en cours
        }
    } catch (e) {
        showIdentificationOnly();
        await displayActiveRoundOnLogin(); // Afficher le tour en cours
    }
}

/** Affiche uniquement la page identification et masque la page jury (évite les deux en même temps). */
function showIdentificationOnly() {
    const scoringPage = document.getElementById('scoring-page');
    const identificationPage = document.getElementById('identification-page');
    if (scoringPage) {
        scoringPage.classList.remove('active');
        scoringPage.style.display = 'none';
    }
    if (identificationPage) {
        identificationPage.classList.add('active');
        identificationPage.style.display = '';
    }
}

function logout() {
    const identificationPage = document.getElementById('identification-page');
    const scoringPage = document.getElementById('scoring-page');

    // Masquer la page jury immédiatement (classe + style pour forcer)
    if (scoringPage) {
        scoringPage.classList.remove('active');
        scoringPage.style.display = 'none';
        scoringPage.style.visibility = 'hidden';
    }
    // Afficher uniquement la page identification
    if (identificationPage) {
        identificationPage.classList.add('active');
        identificationPage.style.display = '';
        identificationPage.style.visibility = '';
    }

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
    if (sessionLockListener) {
        sessionLockListener();
        sessionLockListener = null;
    }
    if (classementListener) {
        classementListener();
        classementListener = null;
    }
    if (roundsRealtimeListener) {
        roundsRealtimeListener();
        roundsRealtimeListener = null;
    }
    if (candidatesRealtimeListener) {
        candidatesRealtimeListener();
        candidatesRealtimeListener = null;
    }
    if (duelResultsRealtimeListener) {
        duelResultsRealtimeListener();
        duelResultsRealtimeListener = null;
    }
    if (juryAccountRealtimeListener) {
        juryAccountRealtimeListener();
        juryAccountRealtimeListener = null;
    }
    if (scoresRealtimeListener) {
        scoresRealtimeListener();
        scoresRealtimeListener = null;
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

/** Forcer la synchronisation avec les données admin (tours, candidats, duels) sans recharger la page. */
window.syncWithAdmin = async function() {
    try {
        const snapRounds = await getDoc(doc(db, "config", "rounds"));
        if (snapRounds.exists()) applyRoundsData(snapRounds.data());
        const snapCandidates = await getDoc(doc(db, "candidats", "liste_actuelle"));
        if (snapCandidates.exists()) CANDIDATES = snapCandidates.data().candidates || [];
        const roundDisplay = document.getElementById('scoring-round-display');
        if (roundDisplay) roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
        refreshCurrentJuryPanel();
        const menuContent = document.getElementById('menu-content-scoring');
        if (menuContent) menuContent.classList.remove('show');
        if (typeof customAlert === 'function') await customAlert('✓ Données synchronisées avec l\'admin.');
        else alert('✓ Données synchronisées avec l\'admin.');
    } catch (e) {
        console.error('syncWithAdmin', e);
        if (typeof customAlert === 'function') await customAlert('Erreur de synchronisation : ' + e.message);
        else alert('Erreur : ' + e.message);
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
    if (!gridFond || !gridForme) return;
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
    const elim1 = document.createElement('button');
    elim1.className = 'score-btn score-btn-1 eliminated';
    elim1.textContent = 'Éliminé';
    elim1.onclick = () => selectScore(1, 'EL', elim1);
    gridFond.appendChild(elim1);
}

function createGridsNotationTwo() {
    // Pour la Petite finale : curseur 0–20 comme les duels, sinon boutons 5/10/15/20/EL
    const isPetiteFinale = activeRoundType === 'Petite finale';
    const values = [5, 10, 15, 20];
    [1, 2].forEach(candNum => {
        const gridFond = document.getElementById('grid-fond-' + candNum);
        const gridForme = document.getElementById('grid-forme-' + candNum);
        if (!gridFond || !gridForme) return;
        gridFond.innerHTML = '';
        gridForme.innerHTML = '';

        if (isPetiteFinale) {
            gridFond.classList.remove('score-grid');
            gridForme.classList.remove('score-grid');
            gridFond.classList.add('duel-grid');
            gridForme.classList.add('duel-grid');
            // Petite finale : uniquement Fond (pas de note Forme)
            const pairs = [{ type: 1, key: 'fond', container: gridFond }];
            pairs.forEach(({ type, key, container }) => {
                const wrap = document.createElement('div');
                wrap.className = 'duel-score-input-wrap';
                const sliderId = `pf-slider-${key}-${candNum}`;
                const numId = `pf-num-${key}-${candNum}`;
                wrap.innerHTML = `
                    <div class="duel-slider-row">
                        <span class="duel-slider-endcap">0</span>
                        <input type="range" id="${sliderId}" min="0" max="20" value="0" class="duel-range-input">
                        <span class="duel-slider-endcap">20</span>
                        <input type="number" id="${numId}" min="0" max="20" step="1" value="" placeholder="0" class="duel-num-input" inputmode="numeric">
                    </div>
                `;
                container.appendChild(wrap);
                const numEl = document.getElementById(numId);
                const sliderEl = document.getElementById(sliderId);
                const displayEl = document.getElementById(
                    key === 'fond'
                        ? (candNum === 1 ? 'display-score-1-fond' : 'display-score-2-fond')
                        : (candNum === 1 ? 'display-score-1-forme' : 'display-score-2-forme')
                );
                function setValue(v) {
                    const n = Math.min(20, Math.max(0, typeof v === 'number' ? v : parseInt(v, 10)));
                    if (isNaN(n)) return;
                    if (candNum === 1 && key === 'fond') selectedScore1 = String(n);
                    if (candNum === 1 && key === 'forme') selectedScore2 = String(n);
                    if (candNum === 2 && key === 'fond') selectedScore1_c2 = String(n);
                    if (candNum === 2 && key === 'forme') selectedScore2_c2 = String(n);
                    if (isPetiteFinale && key === 'fond') {
                        if (candNum === 1) selectedScore2 = '0';
                        else selectedScore2_c2 = '0';
                    }
                    if (numEl) numEl.value = n;
                    if (sliderEl) sliderEl.value = n;
                    if (displayEl) {
                        displayEl.textContent = (key === 'fond' ? 'Note Fond : ' : 'Note Forme : ') + n;
                    }
                    checkValidationNotationTwo();
                }
                if (numEl) {
                    numEl.addEventListener('input', () => setValue(numEl.value));
                    numEl.addEventListener('change', () => setValue(numEl.value));
                }
                if (sliderEl) {
                    sliderEl.addEventListener('input', () => setValue(sliderEl.value));
                }
            });
        } else {
            gridFond.classList.remove('duel-grid');
            gridForme.classList.remove('duel-grid');
            gridFond.classList.add('score-grid');
            gridForme.classList.add('score-grid');
            values.forEach(val => {
                const bf = document.createElement('button');
                bf.className = 'score-btn notation-cand' + candNum + ' notation-fond';
                bf.textContent = val;
                bf.onclick = () => selectScoreNotation(candNum, 1, val, bf);
                gridFond.appendChild(bf);
                const bm = document.createElement('button');
                bm.className = 'score-btn notation-cand' + candNum + ' notation-forme';
                bm.textContent = val;
                bm.onclick = () => selectScoreNotation(candNum, 2, val, bm);
                gridForme.appendChild(bm);
            });
            const elim = document.createElement('button');
            elim.className = 'score-btn notation-cand' + candNum + ' notation-fond eliminated';
            elim.textContent = 'Éliminé';
            elim.onclick = () => selectScoreNotation(candNum, 1, 'EL', elim);
            gridFond.appendChild(elim);
        }
    });
    if (isPetiteFinale) {
        [1, 2].forEach(n => {
            const formEl = document.getElementById('grid-forme-' + n);
            if (formEl) formEl.closest('.control-group')?.style.setProperty('display', 'none');
        });
    }
}

/** Grilles Œuvre contemporaine (Petite finale — 1 candidat, 1 note sur 30) */
function createGridsNotationTwoExo2() {
    const isPetiteFinale = activeRoundType === 'Petite finale';
    if (!isPetiteFinale) return;
    const wrapper = document.getElementById('œuvre-notes-wrapper-2');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    const top = document.createElement('div');
    top.className = 'œuvre-notes-top';
    top.innerHTML = `
        <label>Note globale du discours</label>
        <div class="duel-score-input-wrap">
            <div class="duel-slider-row">
                <span class="duel-slider-endcap">0</span>
                <input type="range" id="pf2-slider-globale-1" min="0" max="30" value="0" class="duel-range-input">
                <span class="duel-slider-endcap">30</span>
                <input type="number" id="pf2-num-globale-1" min="0" max="30" step="1" value="" placeholder="0" class="duel-num-input" inputmode="numeric">
            </div>
        </div>
        <p id="display-oeuvre2-globale" class="selection-info">Note globale : -</p>
    `;
    wrapper.appendChild(top);
    const bindOeuvre2 = (sliderId, numId, displayId, maxVal, setScore) => {
        const s = document.getElementById(sliderId);
        const n = document.getElementById(numId);
        const d = document.getElementById(displayId);
        const setValue = (v) => {
            const num = Math.min(maxVal, Math.max(0, parseInt(String(v), 10)));
            if (isNaN(num)) return;
            setScore(String(num));
            if (n) n.value = num;
            if (s) s.value = num;
            if (d) d.textContent = num;
            checkValidationNotationTwoExo2();
        };
        if (n) { n.addEventListener('input', () => setValue(n.value)); n.addEventListener('change', () => setValue(n.value)); }
        if (s) s.addEventListener('input', () => setValue(s.value));
    };
    bindOeuvre2('pf2-slider-globale-1', 'pf2-num-globale-1', 'display-oeuvre2-globale', 30, v => { selectedScore1Exo2 = v; });
}

function selectScoreNotationExo2(candNum, type, value, element) {
    const suffix = candNum + 'b';
    if (candNum === 1) {
        if (type === 1) {
            selectedScore1Exo2 = value;
            document.querySelectorAll('#grid-fond-1b .score-btn').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
            document.getElementById('display-score-1b-fond').textContent = value === 'EL' ? 'Note Fond : Éliminé' : 'Note Fond : ' + value;
            if (value === 'EL') {
                selectedScore2Exo2 = 'EL';
                document.querySelectorAll('#grid-forme-1b .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = true; b.style.opacity = '0.4'; });
                document.getElementById('grid-forme-1b').style.opacity = '0.5';
                document.getElementById('grid-forme-1b').style.pointerEvents = 'none';
                document.getElementById('display-score-1b-forme').textContent = 'Note Forme : 0 (Éliminé)';
            } else {
                document.querySelectorAll('#grid-forme-1b .score-btn').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
                document.getElementById('grid-forme-1b').style.opacity = '1';
                document.getElementById('grid-forme-1b').style.pointerEvents = 'auto';
            }
        } else {
            selectedScore2Exo2 = value;
            document.querySelectorAll('#grid-forme-1b .score-btn').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
            document.getElementById('display-score-1b-forme').textContent = 'Note Forme : ' + value;
        }
    } else {
        if (type === 1) {
            selectedScore1_c2Exo2 = value;
            document.querySelectorAll('#grid-fond-2b .score-btn').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
            document.getElementById('display-score-2b-fond').textContent = value === 'EL' ? 'Note Fond : Éliminé' : 'Note Fond : ' + value;
            if (value === 'EL') {
                selectedScore2_c2Exo2 = 'EL';
                document.querySelectorAll('#grid-forme-2b .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = true; b.style.opacity = '0.4'; });
                document.getElementById('grid-forme-2b').style.opacity = '0.5';
                document.getElementById('grid-forme-2b').style.pointerEvents = 'none';
                document.getElementById('display-score-2b-forme').textContent = 'Note Forme : 0 (Éliminé)';
            } else {
                document.querySelectorAll('#grid-forme-2b .score-btn').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
                document.getElementById('grid-forme-2b').style.opacity = '1';
                document.getElementById('grid-forme-2b').style.pointerEvents = 'auto';
            }
        } else {
            selectedScore2_c2Exo2 = value;
            document.querySelectorAll('#grid-forme-2b .score-btn').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
            document.getElementById('display-score-2b-forme').textContent = 'Note Forme : ' + value;
        }
    }
    checkValidationNotationTwoExo2();
}

/** Crée les 4 contrôles Fond + Forme pour l'interface Duels : saisie manuelle (0-20) + slider 0 — 10 — 20. */
function createDuelGridsTwo() {
    const pairs = [
        { candNum: 1, type: 1, typeKey: 'fond' },
        { candNum: 1, type: 2, typeKey: 'forme' },
        { candNum: 2, type: 1, typeKey: 'fond' },
        { candNum: 2, type: 2, typeKey: 'forme' }
    ];
    pairs.forEach(({ candNum, type, typeKey }) => {
        const container = document.getElementById('duel-grid-' + typeKey + '-' + candNum);
        if (!container) return;
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'duel-score-input-wrap';
        const numId = 'duel-num-' + candNum + '-' + typeKey;
        const sliderId = 'duel-slider-' + candNum + '-' + typeKey;
        wrap.innerHTML = `
            <div class="duel-slider-row">
                <span class="duel-slider-endcap">0</span>
                <input type="range" id="${sliderId}" min="0" max="20" value="0" class="duel-range-input">
                <span class="duel-slider-endcap">20</span>
                <input type="number" id="${numId}" min="0" max="20" step="1" value="" placeholder="0" class="duel-num-input" inputmode="numeric">
            </div>
        `;
        container.appendChild(wrap);
        const numEl = document.getElementById(numId);
        const sliderEl = document.getElementById(sliderId);
        const displayEl = document.getElementById('duel-display-' + candNum + '-' + typeKey);
        function setDuelValue(v) {
            const n = Math.min(20, Math.max(0, typeof v === 'number' ? v : parseInt(v, 10)));
            if (isNaN(n)) return;
            if (candNum === 1 && type === 1) duelScore1Fond = n;
            if (candNum === 1 && type === 2) duelScore1Forme = n;
            if (candNum === 2 && type === 1) duelScore2Fond = n;
            if (candNum === 2 && type === 2) duelScore2Forme = n;
            numEl.value = n;
            sliderEl.value = n;
            if (displayEl) displayEl.textContent = (typeKey === 'fond' ? 'Note Fond : ' : 'Note Forme : ') + n;
            checkDuelValidation();
        }
        numEl.addEventListener('input', () => setDuelValue(numEl.value));
        numEl.addEventListener('change', () => setDuelValue(numEl.value));
        sliderEl.addEventListener('input', () => setDuelValue(sliderEl.value));
    });
}

function selectScoreNotation(candNum, type, value, element) {
    if (candNum === 1) {
        if (type === 1) {
            selectedScore1 = value;
            document.querySelectorAll('#grid-fond-1 .score-btn').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
            document.getElementById('display-score-1-fond').textContent = value === 'EL' ? 'Note Fond : Éliminé' : 'Note Fond : ' + value;
            if (value === 'EL') {
                selectedScore2 = 'EL';
                document.querySelectorAll('#grid-forme-1 .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = true; b.style.opacity = '0.4'; });
                document.getElementById('grid-forme-1').style.opacity = '0.5';
                document.getElementById('grid-forme-1').style.pointerEvents = 'none';
                document.getElementById('display-score-1-forme').textContent = 'Note Forme : 0 (Éliminé)';
            } else {
                document.querySelectorAll('#grid-forme-1 .score-btn').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
                document.getElementById('grid-forme-1').style.opacity = '1';
                document.getElementById('grid-forme-1').style.pointerEvents = 'auto';
            }
        } else {
            selectedScore2 = value;
            document.querySelectorAll('#grid-forme-1 .score-btn').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
            document.getElementById('display-score-1-forme').textContent = 'Note Forme : ' + value;
        }
    } else {
        if (type === 1) {
            selectedScore1_c2 = value;
            document.querySelectorAll('#grid-fond-2 .score-btn').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
            document.getElementById('display-score-2-fond').textContent = value === 'EL' ? 'Note Fond : Éliminé' : 'Note Fond : ' + value;
            if (value === 'EL') {
                selectedScore2_c2 = 'EL';
                document.querySelectorAll('#grid-forme-2 .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = true; b.style.opacity = '0.4'; });
                document.getElementById('grid-forme-2').style.opacity = '0.5';
                document.getElementById('grid-forme-2').style.pointerEvents = 'none';
                document.getElementById('display-score-2-forme').textContent = 'Note Forme : 0 (Éliminé)';
            } else {
                document.querySelectorAll('#grid-forme-2 .score-btn').forEach(b => { b.disabled = false; b.style.opacity = '1'; });
                document.getElementById('grid-forme-2').style.opacity = '1';
                document.getElementById('grid-forme-2').style.pointerEvents = 'auto';
            }
        } else {
            selectedScore2_c2 = value;
            document.querySelectorAll('#grid-forme-2 .score-btn').forEach(b => b.classList.remove('selected'));
            element.classList.add('selected');
            document.getElementById('display-score-2-forme').textContent = 'Note Forme : ' + value;
        }
    }
    checkValidationNotationTwo();
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
        // Vérification mode classement (vue unique, accès par identifiant + mot de passe sur page d'accueil)
        if (name.toLowerCase() === 'classement') {
            const classementDoc = await getDoc(doc(db, "config", "classement"));
            const storedPassword = classementDoc.exists() ? (classementDoc.data().password || 'classement') : 'classement';
            if (!password) {
                alert('Veuillez entrer le mot de passe pour accéder au classement.');
                return;
            }
            if (password === storedPassword) {
                window.location.href = 'classement.html';
            } else {
                alert('Mot de passe incorrect');
            }
            return;
        }

        // Accès interface malus : identifiant "malus" et mot de passe vide
        if (name.toLowerCase() === 'malus') {
            if (password && password.trim() !== '') {
                alert('Pour l\'interface malus, laissez le mot de passe vide.');
                return;
            }
            window.location.href = 'malus.html';
            return;
        }

        // Accès interface QR code : identifiant "qr code" et mot de passe vide
        if (name.toLowerCase() === 'qr code') {
            if (password && password.trim() !== '') {
                alert('Pour l\'interface QR code, laissez le mot de passe vide.');
                return;
            }
            window.location.href = 'qr.html';
            return;
        }

        // Accès interface vidéo : identifiant "vidéo" ou "video", mot de passe vide
        if (name.toLowerCase() === 'vidéo' || name.toLowerCase() === 'video') {
            if (password && password.trim() !== '') {
                alert('Pour l\'interface vidéo, laissez le mot de passe vide.');
                return;
            }
            window.location.href = 'video.html';
            return;
        }

        // Accès interface grande finale : identifiant "final" ou "finale", mot de passe vide
        if (name.toLowerCase() === 'final' || name.toLowerCase() === 'finale') {
            if (password && password.trim() !== '') {
                alert('Pour l\'interface grande finale, laissez le mot de passe vide.');
                return;
            }
            window.location.href = 'finale.html';
            return;
        }

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
                // Connexion réussie — vérifier que la session n'est pas verrouillée
                const sessionSnap = await getDoc(doc(db, "config", "session"));
                const sessionData = sessionSnap.exists() ? sessionSnap.data() : {};
                if (sessionData.sessionLocked === true) {
                    if (typeof customAlert === 'function') await customAlert('La session est verrouillée.\n\nVous n\'avez plus accès aux modifications.');
                    else alert('La session est verrouillée. Vous n\'avez plus accès aux modifications.');
                    return;
                }
                const firebaseSessionId = sessionData.current_id || '1';

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
                
                // Connexion automatique après création — vérifier que la session n'est pas verrouillée
                const sessionSnap = await getDoc(doc(db, "config", "session"));
                const sessionData = sessionSnap.exists() ? sessionSnap.data() : {};
                if (sessionData.sessionLocked === true) {
                    if (typeof customAlert === 'function') await customAlert('La session est verrouillée.\n\nVous n\'avez plus accès aux modifications.');
                    else alert('La session est verrouillée. Vous n\'avez plus accès aux modifications.');
                    return;
                }
                const firebaseSessionId = sessionData.current_id || '1';

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
            // type_epreuve = duels | classement | notation | repêchage (identifiant explicite)
            activeRoundTypeEpreuve = activeRound.type_epreuve || (activeRound.type === 'Duels' ? 'duels' : activeRound.type === 'Classement' ? 'classement' : activeRound.type === 'Repêchage' ? 'repechage' : activeRound.type === 'Grande finale' ? 'grande_finale' : 'notation');
            activeRoundClassementId = activeRound.classementId || null;
            activeRoundClassementCode = activeRound.codeClassement || activeRound.code || null;
        } else {
            activeRoundName = '';
            activeRoundType = 'Notation individuelle';
            activeRoundTypeEpreuve = 'notation';
            activeRoundNextCandidates = 'ALL';
            activeRoundClassementId = null;
            activeRoundClassementCode = null;
        }
        
        // Fallback: if no active round, use the first round or create default
        if (!activeRoundId) {
            if (rounds.length > 0) {
                const r0 = rounds[0];
                activeRoundId = r0.id;
                activeRoundName = r0.name;
                activeRoundType = r0.type || 'Notation individuelle';
                activeRoundTypeEpreuve = r0.type_epreuve || 'notation';
                activeRoundNextCandidates = r0.nextRoundCandidates || 'ALL';
                activeRoundClassementId = r0.classementId || null;
                activeRoundClassementCode = r0.codeClassement || r0.code || null;
            } else {
                activeRoundId = 'round1';
                activeRoundName = '1er tour';
                activeRoundType = 'Notation individuelle';
                activeRoundTypeEpreuve = 'notation';
                activeRoundNextCandidates = 'ALL';
                activeRoundClassementId = null;
                activeRoundClassementCode = null;
            }
        }
    } else {
        // Create default round configuration with 6 rounds (type_epreuve = duels pour Duels)
        activeRoundId = 'round1';
        activeRoundName = '1er tour';
        activeRoundTypeEpreuve = 'notation';
        activeRoundClassementId = null;
        activeRoundClassementCode = null;
        const defaultRounds = [
            {
                id: 'round1',
                order: 1,
                name: '1er tour',
                type: 'Notation individuelle',
                type_epreuve: 'notation',
                nextRoundCandidates: 'ALL',
                active: true
            },
            {
                id: 'round2',
                order: 2,
                name: 'Repechage 1er tour',
                type: 'Repêchage',
                type_epreuve: 'repechage',
                nextRoundCandidates: 18,
                active: false
            },
            {
                id: 'round3',
                order: 3,
                name: '2eme tour',
                type: 'Duels',
                type_epreuve: 'duels',
                nextRoundCandidates: 'ALL',
                active: false
            },
            {
                id: 'round4',
                order: 4,
                name: 'Repechage 2eme tour',
                type: 'Repêchage',
                type_epreuve: 'repechage',
                nextRoundCandidates: 7,
                active: false
            },
            {
                id: 'round5',
                order: 5,
                name: 'Demi-finale',
                type: 'Duels',
                type_epreuve: 'duels',
                nextRoundCandidates: 3,
                active: false
            },
            {
                id: 'round6',
                order: 6,
                name: 'Finale',
                type: 'Duels',
                type_epreuve: 'duels',
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

/**
 * Applique les données rounds (config/rounds) en mémoire sans écrire en base.
 * Utilisé par le listener temps réel pour mettre à jour l'interface jury quand l'admin modifie les tours.
 */
function applyRoundsData(data) {
    if (!data) return;
    const rounds = data.rounds || [];
    ROUNDS = rounds;
    let newActiveId = data.activeRoundId || null;
    const activeRound = rounds.find(r => r.id === newActiveId);
    if (activeRound) {
        activeRoundId = newActiveId;
        activeRoundName = activeRound.name;
        activeRoundType = activeRound.type || 'Notation individuelle';
        activeRoundNextCandidates = activeRound.nextRoundCandidates || 'ALL';
        activeRoundTypeEpreuve = activeRound.type_epreuve || (activeRound.type === 'Duels' ? 'duels' : activeRound.type === 'Classement' ? 'classement' : activeRound.type === 'Repêchage' ? 'repechage' : activeRound.type === 'Grande finale' ? 'grande_finale' : 'notation');
        activeRoundClassementId = activeRound.classementId || null;
        activeRoundClassementCode = activeRound.codeClassement || activeRound.code || null;
    } else if (rounds.length > 0) {
        const r0 = rounds[0];
        ROUNDS = rounds;
        activeRoundId = r0.id;
        activeRoundName = r0.name;
        activeRoundType = r0.type || 'Notation individuelle';
        activeRoundTypeEpreuve = r0.type_epreuve || 'notation';
        activeRoundNextCandidates = r0.nextRoundCandidates || 'ALL';
        activeRoundClassementId = r0.classementId || null;
        activeRoundClassementCode = r0.codeClassement || r0.code || null;
    } else {
        activeRoundId = 'round1';
        activeRoundName = '1er tour';
        activeRoundType = 'Notation individuelle';
        activeRoundTypeEpreuve = 'notation';
        activeRoundNextCandidates = 'ALL';
        activeRoundClassementId = null;
        activeRoundClassementCode = null;
    }
}

/**
 * Rafraîchit le panneau jury visible (liste candidats, duels, repêchage, etc.) sans recharger la page.
 */
function refreshCurrentJuryPanel() {
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) {
        roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
    }
    const tabNotation = document.getElementById('jury-tab-notation');
    const tabDuels = document.getElementById('jury-tab-duels');
    const tabMonClassement = document.getElementById('jury-tab-mon-classement');
    const juryDuelsList = document.getElementById('jury-duels-list');
    const qualifiedList = document.getElementById('qualified-list');
    if (tabNotation && tabNotation.classList.contains('active')) {
        if (typeof updateNotationTwoSelects === 'function') updateNotationTwoSelects();
        if (typeof updateNotationTwoSelectsExo2 === 'function') updateNotationTwoSelectsExo2();
        if (typeof updateNotationSelectsExo3 === 'function') updateNotationSelectsExo3();
        if (document.getElementById('candidate-select') && typeof updateCandidateSelect === 'function') {
            updateCandidateSelect(selectedCandidateId);
        }
    }
    const duelsPanelVisible = (tabDuels && tabDuels.classList.contains('active')) || (juryDuelsList && !tabNotation);
    if (duelsPanelVisible && typeof renderJuryDuelsPanel === 'function') {
        renderJuryDuelsPanel();
    }
    if (tabMonClassement && tabMonClassement.classList.contains('active')) {
        if (typeof renderJuryMonClassementPanel === 'function') renderJuryMonClassementPanel();
    }
    if (qualifiedList && typeof renderRepechageLists === 'function') {
        renderRepechageLists();
    }
    if (document.getElementById('grande-finale-validations-count') && typeof window.updateGrandeFinaleCounter === 'function') {
        window.updateGrandeFinaleCounter();
    }
}

async function startScoring() {
    await loadActiveRound(); // Load active round before starting
    
    // Vérifier que le jury a accès au tour actif et si c'est le président (bonus victoire)
    const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
    isCurrentUserPresident = juryDoc.exists() && juryDoc.data().isPresident === true;
    currentJuryCriterePetiteFinale = (juryDoc.exists() && juryDoc.data().criterePetiteFinale) ? String(juryDoc.data().criterePetiteFinale).trim() : '';
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
    const identificationPage = document.getElementById('identification-page');
    const scoringPage = document.getElementById('scoring-page');
    identificationPage.classList.remove('active');
    scoringPage.classList.add('active');
    // Réinitialiser les styles inline (évite que la page jury reste cachée après showIdentificationOnly)
    identificationPage.style.display = '';
    identificationPage.style.visibility = '';
    scoringPage.style.display = '';
    scoringPage.style.visibility = '';

    // Afficher l'interface appropriée selon le type de tour (le classement est en vue unique via identifiant "classement" sur la page d'accueil)
    if (activeRoundType === 'Repêchage' || activeRoundTypeEpreuve === 'repechage') {
        showRepechageInterface();
    } else if (activeRoundType === 'Duels' || activeRoundTypeEpreuve === 'duels') {
        showDuelsInterface();
    } else if (activeRoundType === 'Grande finale' || activeRoundTypeEpreuve === 'grande_finale') {
        showGrandeFinaleInterface();
    } else {
        showNotationInterface();
    }
    
    // Écouter les changements de tour
    setupRoundChangeListener();
    // Écouter le verrouillage de session (expulsion immédiate si admin verrouille)
    setupSessionLockListener();
    // Mise à jour temps réel quand l'admin modifie tours, candidats, duels ou compte jury
    setupRealtimeListeners();
}

/**
 * Listeners temps réel : quand l'admin modifie config/rounds, candidats, duel_results ou accounts,
 * l'interface jury se met à jour sans recharger la page.
 */
function setupRealtimeListeners() {
    if (roundsRealtimeListener) return;
    const roundId = () => activeRoundId || 'round1';

    roundsRealtimeListener = onSnapshot(doc(db, "config", "rounds"), (snap) => {
        if (!snap.exists()) return;
        try {
            if (duelResultsRealtimeListener) {
                duelResultsRealtimeListener();
                duelResultsRealtimeListener = null;
            }
            if (scoresRealtimeListener) {
                scoresRealtimeListener();
                scoresRealtimeListener = null;
            }
            const data = snap.data();
            const prevType = activeRoundTypeEpreuve;
            applyRoundsData(data);
            const roundDisplay = document.getElementById('scoring-round-display');
            if (roundDisplay) roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
            if (prevType !== activeRoundTypeEpreuve) {
                if (activeRoundTypeEpreuve === 'repechage') showRepechageInterface();
                else if (activeRoundTypeEpreuve === 'duels') showDuelsInterface();
                else if (activeRoundTypeEpreuve === 'grande_finale') showGrandeFinaleInterface();
                else showNotationInterface();
            } else {
                refreshCurrentJuryPanel();
            }
            const qScores = query(
                collection(db, "scores"),
                where("juryId", "==", currentJuryName),
                where("roundId", "==", roundId())
            );
            scoresRealtimeListener = onSnapshot(qScores, () => {
                try { refreshCurrentJuryPanel(); } catch (e) { console.error('scoresRealtime', e); }
            });
            if (activeRoundTypeEpreuve === 'duels') {
                duelResultsRealtimeListener = onSnapshot(doc(db, "duel_results", roundId()), () => {
                    try { if (typeof renderJuryDuelsPanel === 'function') renderJuryDuelsPanel(); } catch (e) { console.error('duelResultsRealtime', e); }
                });
            }
        } catch (e) {
            console.error('roundsRealtime listener', e);
        }
    });

    candidatesRealtimeListener = onSnapshot(doc(db, "candidats", "liste_actuelle"), (snap) => {
        if (!snap.exists()) return;
        try {
            CANDIDATES = snap.data().candidates || [];
            refreshCurrentJuryPanel();
        } catch (e) {
            console.error('candidatesRealtime listener', e);
        }
    });

    let accountFirst = true;
    juryAccountRealtimeListener = onSnapshot(doc(db, "accounts", currentJuryName), (snap) => {
        if (!snap.exists()) return;
        try {
            const data = snap.data();
            isCurrentUserPresident = data.isPresident === true;
            currentJuryCriterePetiteFinale = (data.criterePetiteFinale) ? String(data.criterePetiteFinale).trim() : '';
            if (!accountFirst) refreshCurrentJuryPanel();
            else accountFirst = false;
            const labelCritere = document.getElementById('label-critere-exo3');
            if (labelCritere) {
                labelCritere.textContent = currentJuryCriterePetiteFinale ? `Note critère spécifique (${currentJuryCriterePetiteFinale})` : 'Note critère spécifique';
            }
            const critereAssigneEl = document.getElementById('jury-critere-assigne');
            if (critereAssigneEl) {
                critereAssigneEl.textContent = currentJuryCriterePetiteFinale ? 'Critère à évaluer : ' + currentJuryCriterePetiteFinale : '';
                critereAssigneEl.style.display = currentJuryCriterePetiteFinale ? '' : 'none';
            }
        } catch (e) {
            console.error('juryAccountRealtime listener', e);
        }
    });

    if (activeRoundTypeEpreuve === 'duels') {
        let duelFirst = true;
        duelResultsRealtimeListener = onSnapshot(doc(db, "duel_results", roundId()), (snap) => {
            if (duelFirst) {
                duelFirst = false;
                return;
            }
            try {
                if (typeof renderJuryDuelsPanel === 'function') renderJuryDuelsPanel();
            } catch (e) {
                console.error('duelResultsRealtime listener', e);
            }
        });
    }

    const qScores = query(
        collection(db, "scores"),
        where("juryId", "==", currentJuryName),
        where("roundId", "==", roundId())
    );
    let scoresFirst = true;
    scoresRealtimeListener = onSnapshot(qScores, () => {
        if (scoresFirst) {
            scoresFirst = false;
            return;
        }
        try {
            refreshCurrentJuryPanel();
        } catch (e) {
            console.error('scoresRealtime listener', e);
        }
    });
}

/**
 * Écouter le verrouillage de session : si l'admin verrouille, expulser immédiatement le jury.
 */
function setupSessionLockListener() {
    if (sessionLockListener) return;
    let isFirstSnapshot = true;
    sessionLockListener = onSnapshot(doc(db, "config", "session"), (snap) => {
        if (isFirstSnapshot) {
            isFirstSnapshot = false;
            return;
        }
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.sessionLocked === true) {
            if (typeof customAlert === 'function') {
                customAlert('La session a été verrouillée par l\'administrateur.\n\nVous n\'avez plus accès aux modifications.').then(() => { logout(); });
            } else {
                alert('La session a été verrouillée. Vous n\'avez plus accès.');
                logout();
            }
            return;
        }
        const firebaseSessionId = data.current_id || '1';
        if (storedSessionId !== firebaseSessionId) {
            if (typeof customAlert === 'function') {
                customAlert('Votre session a été invalidée.\n\nVous allez être déconnecté.').then(() => { logout(); });
            } else {
                logout();
            }
        }
    }, (err) => { console.error('sessionLockListener', err); });
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
        
        // Aucun recalcul automatique : la qualification se fait uniquement par action humaine (Admin / Président)
        alert("✓ Notation enregistrée avec succès !");
    } catch (e) { 
        alert("Erreur d'envoi : " + e.message); 
    }
};

// ========================================
// INTERFACES SPÉCIFIQUES PAR TYPE DE TOUR
// ========================================

/**
 * Interface Grande finale : un seul onglet avec 3 boutons (candidats), Valider, et compteur de validations.
 * Chaque validation = +1 point pour le candidat choisi (score1 = nombre de votes, score2 = 0).
 */
async function showGrandeFinaleInterface() {
    const scoringPage = document.getElementById('scoring-page');
    const roundId = activeRoundId || 'round1';

    let candidates = CANDIDATES.filter(c => c.tour === roundId);
    if (candidates.length === 0) {
        const candSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
        if (candSnap.exists()) {
            CANDIDATES = candSnap.data().candidates || [];
            candidates = CANDIDATES.filter(c => c.tour === roundId);
        }
    }
    const finaleCandidates = candidates.slice(0, 3).sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

    scoringPage.innerHTML = `
        <div class="burger-menu">
            <div class="burger-icon" onclick="toggleMenu()">
                <span></span><span></span><span></span>
            </div>
            <div class="burger-menu-content" id="menu-content-scoring">
                <div class="theme-toggle">
                    <span>Mode sombre</span>
                    <div class="toggle-switch" id="theme-toggle-scoring" onclick="toggleTheme()">
                        <div class="toggle-slider"></div>
                    </div>
                </div>
                <div class="menu-item" onclick="refreshCandidateList()">🔄 Rafraîchir la liste</div>
                <div class="menu-item" onclick="syncWithAdmin()">📡 Synchroniser avec l'admin</div>
                <div class="menu-item" onclick="changePassword()">🔑 Changer le mot de passe</div>
                <div class="menu-item" onclick="logout()">🚪 Déconnexion</div>
            </div>
        </div>
        <p id="scoring-round-display" style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing);"></p>
        <h2 style="text-align: center; margin-bottom: var(--spacing);">Jury : <span id="current-jury-display"></span></h2>
        <div id="grande-finale-panel" style="max-width: 500px; margin: 0 auto;">
            <p class="jury-notation-intro" style="text-align: center; margin-bottom: 20px;">Choisissez le meilleur candidat pour ce passage.</p>
            <div id="grande-finale-buttons" style="display: flex; flex-direction: column; gap: 12px;"></div>
            <button id="grande-finale-validate" type="button" class="jury-notation-validate" disabled style="margin-top: 20px; width: 100%;">Valider</button>
            <p id="grande-finale-validations-count" style="text-align: center; margin-top: 16px; font-weight: 600; color: var(--text-secondary);">Nombre de validations : 0</p>
        </div>
    `;

    document.getElementById('current-jury-display').textContent = currentJuryDisplayName;
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';

    const container = document.getElementById('grande-finale-buttons');
    const validateBtn = document.getElementById('grande-finale-validate');
    const countEl = document.getElementById('grande-finale-validations-count');
    let selectedGrandeFinaleCandidateId = null;
    let grandeFinaleLocked = false;
    let finaleJuries = [];
    let validationCountsByJury = {}; // juryId -> nombre de votes (score1) pour ce tour
    let minValidationCount = 0;
    let currentJuryValidationCount = 0;
    let finaleCountsReady = false; // On ne valide pas tant qu'on n'a pas agrégé au moins une fois

    finaleCandidates.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'jury-tab-btn';
        btn.style.cssText = 'padding: 14px 20px; font-size: 1.05em; text-align: center; border-radius: 8px; border: 2px solid var(--border-color); background: var(--input-bg); color: var(--text-color); cursor: pointer;';
        btn.textContent = c.name || c.id;
        btn.dataset.candidateId = c.id;
        btn.addEventListener('click', () => {
            if (grandeFinaleLocked) return;
            selectedGrandeFinaleCandidateId = c.id;
            container.querySelectorAll('button[data-candidate-id]').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'var(--input-bg)';
                b.style.borderColor = 'var(--border-color)';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--primary-color)';
            btn.style.borderColor = 'var(--primary-color)';
            btn.style.color = '#fff';
                refreshGrandeFinaleValidationState();
        });
        container.appendChild(btn);
    });

    function refreshGrandeFinaleValidationState() {
        const selectedOk = !!selectedGrandeFinaleCandidateId;
        const stepOk = finaleCountsReady && currentJuryValidationCount === minValidationCount;
        validateBtn.disabled = grandeFinaleLocked || !selectedOk || !stepOk;
        if (countEl) countEl.textContent = 'Nombre de validations : ' + (currentJuryValidationCount || 0);
    }

    async function loadFinaleJuriesConfig() {
        try {
            const accountsSnap = await getDocs(collection(db, "accounts"));
            finaleJuries = [];
            accountsSnap.forEach(docSnap => {
                const data = docSnap.data();
                const rounds = data.rounds || [];
                if (Array.isArray(rounds) && rounds.includes(roundId)) {
                    finaleJuries.push({
                        id: docSnap.id,
                        name: data.name || docSnap.id
                    });
                }
            });
            // Initialiser à 0 (mais on n'active pas tant qu'on n'a pas agrégé via onSnapshot)
            validationCountsByJury = {};
            finaleJuries.forEach(j => { validationCountsByJury[j.id] = 0; });
            minValidationCount = 0;
            currentJuryValidationCount = validationCountsByJury[currentJuryName] || 0;
            refreshGrandeFinaleValidationState();
        } catch (e) {
            console.error('Erreur chargement jurys grande finale:', e);
        }
    }

    await loadFinaleJuriesConfig();

    // Agrégation temps réel des votes par jury sur ce tour :
    // règle : on autorise une nouvelle validation uniquement si le jury courant a le même nombre de validations que le minimum des jurys.
    const qFinaleScores = query(
        collection(db, "scores"),
        where("roundId", "==", roundId)
    );
    onSnapshot(qFinaleScores, (scoresSnap) => {
        const counts = {};
        // Inclure tous les jurys de ce tour (même ceux qui ont 0 votes) => étape synchronisée.
        finaleJuries.forEach(j => { counts[j.id] = 0; });

        scoresSnap.forEach(docSnap => {
            const data = docSnap.data();
            const juryId = data.juryId || data.juryName;
            if (!juryId) return;
            const vRaw = data.score1;
            const v = (typeof vRaw === 'number') ? vRaw : (parseInt(vRaw, 10) || 0);
            if (counts[juryId] == null) counts[juryId] = 0;
            counts[juryId] += v;
        });

        validationCountsByJury = counts;
        const values = Object.values(counts);
        minValidationCount = values.length ? Math.min(...values) : 0;
        currentJuryValidationCount = counts[currentJuryName] || 0;
        finaleCountsReady = true;
        refreshGrandeFinaleValidationState();
    });

    async function updateGrandeFinaleCounter() {
        try {
            const q = query(
                collection(db, "scores"),
                where("juryId", "==", currentJuryName),
                where("roundId", "==", roundId)
            );
            const snap = await getDocs(q);
            let total = 0;
            snap.docs.forEach(d => {
                const v = d.data().score1;
                if (typeof v === 'number' && Number.isFinite(v)) total += v;
                else if (typeof v === 'string' && v !== '-' && v !== '') total += parseInt(v, 10) || 0;
            });
            if (countEl) countEl.textContent = 'Nombre de validations : ' + total;
        } catch (e) {
            if (countEl) countEl.textContent = 'Nombre de validations : —';
        }
    }
    window.updateGrandeFinaleCounter = updateGrandeFinaleCounter;

    validateBtn.addEventListener('click', async () => {
        if (grandeFinaleLocked) return;
        if (!selectedGrandeFinaleCandidateId) return;
        if (!finaleCountsReady || currentJuryValidationCount !== minValidationCount) {
            if (typeof customAlert === 'function') await customAlert('Attendez que tous les autres jurys aient validé le même nombre de fois.');
            else alert('Attendez que tous les autres jurys aient validé le même nombre de fois.');
            return;
        }
        const candidateId = selectedGrandeFinaleCandidateId;
        try {
            const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
            const juryName = juryDoc.exists() ? juryDoc.data().name : currentJuryName;
            const docId = `gf_${currentJuryName}_${candidateId}_${roundId}`;
            const ref = doc(db, "scores", docId);
            const existing = await getDoc(ref);
            if (!existing.exists()) {
                await setDoc(ref, {
                    juryId: currentJuryName,
                    juryName,
                    candidateId,
                    roundId,
                    score1: 1,
                    score2: 0,
                    timestamp: new Date()
                });
            } else {
                await updateDoc(ref, {
                    score1: increment(1),
                    timestamp: new Date()
                });
            }
            selectedGrandeFinaleCandidateId = null;
            container.querySelectorAll('button[data-candidate-id]').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'var(--input-bg)';
                b.style.borderColor = 'var(--border-color)';
                b.style.color = '';
            });
            validateBtn.disabled = true;
            await updateGrandeFinaleCounter();
            if (typeof customAlert === 'function') await customAlert('✓ Vote enregistré (+1 point pour ce candidat).');
            else alert('✓ Vote enregistré (+1 point pour ce candidat).');
        } catch (e) {
            console.error(e);
            if (typeof customAlert === 'function') await customAlert('Erreur lors de l\'enregistrement : ' + (e.message || e));
            else alert('Erreur lors de l\'enregistrement.');
        }
    });

    await updateGrandeFinaleCounter();
    initTheme();

    // Vérifier si le classement finale est verrouillé (bloque les votes)
    try {
        const lockRef = doc(db, "config", "finale_lock");
        const lockSnap = await getDoc(lockRef);
        grandeFinaleLocked = lockSnap.exists() && lockSnap.data().locked === true;
        const applyLockState = (locked) => {
            grandeFinaleLocked = locked;
            container.querySelectorAll('button[data-candidate-id]').forEach(b => {
                b.disabled = locked;
                b.style.opacity = locked ? '0.6' : '1';
                b.style.cursor = locked ? 'not-allowed' : 'pointer';
            });
            refreshGrandeFinaleValidationState();
            const intro = document.querySelector('#grande-finale-panel .jury-notation-intro');
            if (intro) {
                intro.textContent = locked
                    ? 'Le classement finale est verrouillé : aucun nouveau vote n’est accepté.'
                    : 'Choisissez le meilleur candidat pour ce passage.';
            }
        };
        applyLockState(grandeFinaleLocked);
        onSnapshot(lockRef, (snap) => {
            const isLocked = snap.exists() && snap.data().locked === true;
            applyLockState(isLocked);
        });
    } catch (e) {
        console.warn('Impossible de lire le verrouillage finale', e);
    }
}

/**
 * Interface pour Notation Individuelle (standard) — avec onglets Notation | Duels | Mon classement
 */
function showNotationInterface() {
    const scoringPage = document.getElementById('scoring-page');
    
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
                <div class="menu-item" onclick="syncWithAdmin()">📡 Synchroniser avec l'admin</div>
                <div class="menu-item" onclick="changePassword()">🔑 Changer le mot de passe</div>
                <div class="menu-item" onclick="logout()">🚪 Déconnexion</div>
            </div>
        </div>
        <p id="scoring-round-display" style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing);"></p>
        <h2 style="text-align: center; margin-bottom: var(--spacing);">Jury: <span id="current-jury-display"></span></h2>
        <div class="jury-tabs-bar">
            <button type="button" class="jury-tab-btn active" data-jury-tab="notation">${activeRoundType === 'Petite finale' ? 'Le temps des présentations' : 'Notation'}</button>
            <button type="button" class="jury-tab-btn jury-tab-notation2" data-jury-tab="notation2" style="display: none;">Œuvre contemporaine</button>
            <button type="button" class="jury-tab-btn jury-tab-notation3" data-jury-tab="notation3" style="display: none;">Le temps des discours</button>
            <button type="button" class="jury-tab-btn" data-jury-tab="duels">Gagnants de duel</button>
            <button type="button" class="jury-tab-btn" data-jury-tab="mon-classement">Mon classement</button>
        </div>
        <div id="jury-tab-notation" class="jury-tab-content active">
            <p class="jury-notation-intro">Noter deux candidats : Fond et Forme pour chacun.</p>
            <div class="jury-notation-cols">
                <div class="jury-notation-card">
                    <label for="candidate-select-1" class="card-title">Candidat 1</label>
                    <select id="candidate-select-1">
                        <option value="">-- Choisir --</option>
            </select>
                    <p id="selected-candidate-display-1" class="selection-info">Aucun</p>
                    <hr class="jury-notation-sep">
                    <div class="control-group">
                        <label>Fond / Argumentation (Coefficient ×3)</label>
                        <div class="score-grid" id="grid-fond-1"></div>
                        <p id="display-score-1-fond" class="selection-info">Note Fond : -</p>
        </div>
                    <hr class="jury-notation-sep">
        <div class="control-group">
                        <label>Forme / Éloquence</label>
                        <div class="score-grid" id="grid-forme-1"></div>
                        <p id="display-score-1-forme" class="selection-info">Note Forme : -</p>
        </div>
                </div>
                <div class="jury-notation-card">
                    <label for="candidate-select-2" class="card-title">Candidat 2</label>
                    <select id="candidate-select-2">
                        <option value="">-- Choisir --</option>
                    </select>
                    <p id="selected-candidate-display-2" class="selection-info">Aucun</p>
                    <hr class="jury-notation-sep">
        <div class="control-group">
                        <label>Fond / Argumentation (Coefficient ×3)</label>
                        <div class="score-grid" id="grid-fond-2"></div>
                        <p id="display-score-2-fond" class="selection-info">Note Fond : -</p>
        </div>
                    <hr class="jury-notation-sep">
                    <div class="control-group">
                        <label>Forme / Éloquence</label>
                        <div class="score-grid" id="grid-forme-2"></div>
                        <p id="display-score-2-forme" class="selection-info">Note Forme : -</p>
                    </div>
                </div>
            </div>
            <button id="validate-button" class="jury-notation-validate" disabled>Valider les deux notations</button>
        </div>
        <div id="jury-tab-notation2" class="jury-tab-content" style="display: none;">
            <div class="jury-notation-cols">
                <div class="jury-notation-card">
                    <label for="candidate-select-1b" class="card-title">Candidat</label>
                    <select id="candidate-select-1b">
                        <option value="">-- Choisir --</option>
                    </select>
                    <p id="selected-candidate-display-1b" class="selection-info">Aucun</p>
                    <p class="jury-notation-intro">Œuvre contemporaine — Une note : note globale du discours.</p>
                    <hr class="jury-notation-sep">
                    <div id="œuvre-notes-wrapper-2" class="œuvre-notes-wrapper"></div>
                    <div id="grid-fond-1b" style="display: none;"></div>
                    <div id="grid-forme-1b" style="display: none;"></div>
                </div>
            </div>
            <button id="validate-button-2" class="jury-notation-validate" disabled>Valider la notation</button>
        </div>
        <div id="jury-tab-notation3" class="jury-tab-content" style="display: none;">
            <div class="jury-notation-cols">
                <div class="jury-notation-card">
                    <label for="candidate-select-1c" class="card-title">Candidat</label>
                    <select id="candidate-select-1c">
                        <option value="">-- Choisir --</option>
                    </select>
                    <p id="selected-candidate-display-1c" class="selection-info">Aucun</p>
                    <p class="jury-notation-intro">Le temps des discours — Trois notes : note globale du discours, note de fond, note critère spécifique.</p>
                    <p id="jury-critere-assigne" class="selection-info" style="font-weight: 600; margin-top: 4px; display: none;"></p>
                    <hr class="jury-notation-sep">
                    <div id="œuvre-notes-wrapper-3" class="œuvre-notes-wrapper"></div>
                    <div id="grid-fond-1c" style="display: none;"></div>
                    <div id="grid-forme-1c" style="display: none;"></div>
                </div>
            </div>
            <button id="validate-button-3" class="jury-notation-validate" disabled>Valider la notation</button>
        </div>
        <div id="jury-tab-duels" class="jury-tab-content">
            <p id="jury-duels-message" style="text-align: center; color: var(--text-secondary);">Chargement des duels…</p>
            <div id="jury-duels-list" style="display: none;"></div>
        </div>
        <div id="jury-tab-mon-classement" class="jury-tab-content">
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 15px;">Votre classement personnel : 5 premières positions (1 à 5). Chaque menu propose tous les candidats ; si vous placez un candidat à une autre position, son ancienne position se vide.</p>
            <table id="jury-mon-classement-table" style="width: 100%; border-collapse: collapse;">
                <thead><tr style="background: var(--neutral-color); color: white;"><th style="padding: 12px; text-align: center;">Position</th><th style="padding: 12px; text-align: left;">Candidat</th></tr></thead>
                <tbody id="jury-mon-classement-body"></tbody>
            </table>
        </div>
    `;
    setupJuryTabs();
    // Petite finale : onglets Notation 2 et Notation 3 visibles, pas d'onglet "Gagnants de duel"
    const notation2TabBtn = document.querySelector('.jury-tab-notation2');
    const notation2Panel = document.getElementById('jury-tab-notation2');
    const notation3TabBtn = document.querySelector('.jury-tab-notation3');
    const notation3Panel = document.getElementById('jury-tab-notation3');
    const duelsTabBtn = document.querySelector('.jury-tab-btn[data-jury-tab="duels"]');
    const duelsPanel = document.getElementById('jury-tab-duels');
    if (activeRoundType === 'Petite finale') {
        if (notation2TabBtn) notation2TabBtn.style.display = '';
        if (notation2Panel) notation2Panel.style.display = '';
        if (notation3TabBtn) notation3TabBtn.style.display = '';
        if (notation3Panel) notation3Panel.style.display = '';
        if (duelsTabBtn) duelsTabBtn.style.display = 'none';
        if (duelsPanel) duelsPanel.style.display = 'none';
    } else {
        if (notation2TabBtn) notation2TabBtn.style.display = 'none';
        if (notation2Panel) notation2Panel.style.display = 'none';
        if (notation3TabBtn) notation3TabBtn.style.display = 'none';
        if (notation3Panel) notation3Panel.style.display = 'none';
    }
    
    // Mettre à jour les informations affichées
    document.getElementById('current-jury-display').textContent = currentJuryDisplayName;
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) {
        roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
    }
    
    initTheme();
    createGridsNotationTwo();
    if (activeRoundType === 'Petite finale') {
        const intro1 = document.querySelector('#jury-tab-notation .jury-notation-intro');
if (intro1) intro1.textContent = 'Noter deux candidats : Fond pour chacun.';
            document.querySelectorAll('#jury-tab-notation .control-group label').forEach(lab => { if (lab.textContent.includes('Fond')) lab.textContent = 'Fond'; });
    }
    updateNotationTwoSelects();
    if (activeRoundType === 'Petite finale') {
        createGridsNotationTwoExo2();
        updateNotationTwoSelectsExo2();
        const sel1b = document.getElementById('candidate-select-1b');
        if (sel1b) sel1b.addEventListener('change', function() { loadCandidateNotationSideExo2(1, this.value || null); });
        const validateBtn2 = document.getElementById('validate-button-2');
        if (validateBtn2) validateBtn2.addEventListener('click', validateNotationTwoExo2);
        createGridsNotationExo3();
        const critereAssigneEl = document.getElementById('jury-critere-assigne');
        if (critereAssigneEl) {
            critereAssigneEl.textContent = currentJuryCriterePetiteFinale ? 'Critère à évaluer : ' + currentJuryCriterePetiteFinale : '';
            critereAssigneEl.style.display = currentJuryCriterePetiteFinale ? '' : 'none';
        }
        updateNotationSelectsExo3();
        const sel1c = document.getElementById('candidate-select-1c');
        if (sel1c) sel1c.addEventListener('change', function() { loadCandidateNotationSideExo3(1, this.value || null); });
        const validateBtn3 = document.getElementById('validate-button-3');
        if (validateBtn3) validateBtn3.addEventListener('click', validateNotationExo3);
    }

    async function loadCandidateNotationSide(candNum, candidateId) {
        const c = CANDIDATES.find(x => x.id === candidateId);
        if (!c) return;
        const lockSnap = await getDoc(doc(db, "config", "locks"));
        const locks = lockSnap.exists() ? lockSnap.data().locks || {} : {};
        const isLocked = locks[candidateId]?.[currentJuryName] || false;
        if (isLocked) {
            await customAlert(`❌ Ce candidat est verrouillé.`);
            if (candNum === 1) { selectedCandidateId = null; document.getElementById('candidate-select-1').value = ''; document.getElementById('selected-candidate-display-1').textContent = 'Aucun'; }
            else { selectedCandidate2Id = null; document.getElementById('candidate-select-2').value = ''; document.getElementById('selected-candidate-display-2').textContent = 'Aucun'; }
            updateNotationTwoSelects();
            checkValidationNotationTwo();
            return;
        }
        const q = query(collection(db, "scores"), where("candidateId", "==", candidateId), where("juryId", "==", currentJuryName), where("roundId", "==", activeRoundId || 'round1'));
        const snap = await getDocs(q);
        const scores = snap.docs[0]?.data();
        const bothSet = scores && scores.score1 !== '-' && scores.score2 !== '-';
        if (candNum === 1) {
            selectedCandidateId = candidateId;
            document.getElementById('selected-candidate-display-1').textContent = bothSet ? c.name + ' (déjà noté)' : 'Candidat : ' + c.name;
            if (bothSet) {
                selectedScore1 = scores.score1; selectedScore2 = scores.score2;
                document.querySelectorAll('#grid-fond-1 .score-btn').forEach(b => { b.classList.remove('selected'); if (b.textContent === String(scores.score1) || (scores.score1 === 'EL' && b.textContent === 'Éliminé')) b.classList.add('selected'); });
                document.querySelectorAll('#grid-forme-1 .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = scores.score1 === 'EL'; if (b.textContent === String(scores.score2)) b.classList.add('selected'); });
                document.getElementById('display-score-1-fond').textContent = scores.score1 === 'EL' ? 'Note Fond : Éliminé' : 'Note Fond : ' + scores.score1;
                document.getElementById('display-score-1-forme').textContent = scores.score2 === 'EL' ? 'Note Forme : 0 (Éliminé)' : 'Note Forme : ' + scores.score2;
                if (scores.score1 === 'EL') document.getElementById('grid-forme-1').style.opacity = '0.5';
            } else {
                selectedScore1 = null; selectedScore2 = null;
                // Réinitialiser l'UI boutons (tours classiques)
                document.querySelectorAll('#grid-fond-1 .score-btn, #grid-forme-1 .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = false; b.style.opacity = '1'; });
                document.getElementById('grid-forme-1').style.opacity = '1'; document.getElementById('grid-forme-1').style.pointerEvents = 'auto';
                document.getElementById('display-score-1-fond').textContent = 'Note Fond : -';
                document.getElementById('display-score-1-forme').textContent = 'Note Forme : -';
            }
            // Petite finale : synchroniser les curseurs 0–20 si présents
            if (activeRoundType === 'Petite finale') {
                const fondSlider = document.getElementById('pf-slider-fond-1');
                const fondNum = document.getElementById('pf-num-fond-1');
                const formeSlider = document.getElementById('pf-slider-forme-1');
                const formeNum = document.getElementById('pf-num-forme-1');
                const s1Val = scores && scores.score1 !== '-' ? parseInt(scores.score1, 10) : null;
                const s2Val = scores && scores.score2 !== '-' ? parseInt(scores.score2, 10) : null;
                if (fondSlider && fondNum && s1Val != null && !isNaN(s1Val)) {
                    fondSlider.value = s1Val;
                    fondNum.value = s1Val;
                    document.getElementById('display-score-1-fond').textContent = 'Note Fond : ' + s1Val;
                    selectedScore1 = String(s1Val);
                    selectedScore2 = '0';
                }
                if (formeSlider && formeNum && s2Val != null && !isNaN(s2Val)) {
                    formeSlider.value = s2Val;
                    formeNum.value = s2Val;
                    document.getElementById('display-score-1-forme').textContent = 'Note Forme : ' + s2Val;
                    selectedScore2 = String(s2Val);
                }
            }
        } else {
            selectedCandidate2Id = candidateId;
            document.getElementById('selected-candidate-display-2').textContent = bothSet ? c.name + ' (déjà noté)' : 'Candidat : ' + c.name;
            if (bothSet) {
                selectedScore1_c2 = scores.score1; selectedScore2_c2 = scores.score2;
                document.querySelectorAll('#grid-fond-2 .score-btn').forEach(b => { b.classList.remove('selected'); if (b.textContent === String(scores.score1) || (scores.score1 === 'EL' && b.textContent === 'Éliminé')) b.classList.add('selected'); });
                document.querySelectorAll('#grid-forme-2 .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = scores.score1 === 'EL'; if (b.textContent === String(scores.score2)) b.classList.add('selected'); });
                document.getElementById('display-score-2-fond').textContent = scores.score1 === 'EL' ? 'Note Fond : Éliminé' : 'Note Fond : ' + scores.score1;
                document.getElementById('display-score-2-forme').textContent = scores.score2 === 'EL' ? 'Note Forme : 0 (Éliminé)' : 'Note Forme : ' + scores.score2;
                if (scores.score1 === 'EL') document.getElementById('grid-forme-2').style.opacity = '0.5';
            } else {
                selectedScore1_c2 = null; selectedScore2_c2 = null;
                document.querySelectorAll('#grid-fond-2 .score-btn, #grid-forme-2 .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = false; b.style.opacity = '1'; });
                document.getElementById('grid-forme-2').style.opacity = '1'; document.getElementById('grid-forme-2').style.pointerEvents = 'auto';
                document.getElementById('display-score-2-fond').textContent = 'Note Fond : -';
                document.getElementById('display-score-2-forme').textContent = 'Note Forme : -';
            }
            if (activeRoundType === 'Petite finale') {
                const fondSlider = document.getElementById('pf-slider-fond-2');
                const fondNum = document.getElementById('pf-num-fond-2');
                const formeSlider = document.getElementById('pf-slider-forme-2');
                const formeNum = document.getElementById('pf-num-forme-2');
                const s1Val = scores && scores.score1 !== '-' ? parseInt(scores.score1, 10) : null;
                const s2Val = scores && scores.score2 !== '-' ? parseInt(scores.score2, 10) : null;
                if (fondSlider && fondNum && s1Val != null && !isNaN(s1Val)) {
                    fondSlider.value = s1Val;
                    fondNum.value = s1Val;
                    document.getElementById('display-score-2-fond').textContent = 'Note Fond : ' + s1Val;
                    selectedScore1_c2 = String(s1Val);
                    selectedScore2_c2 = '0';
                }
                if (formeSlider && formeNum && s2Val != null && !isNaN(s2Val)) {
                    formeSlider.value = s2Val;
                    formeNum.value = s2Val;
                    document.getElementById('display-score-2-forme').textContent = 'Note Forme : ' + s2Val;
                    selectedScore2_c2 = String(s2Val);
                }
            }
        }
        updateNotationTwoSelects();
        checkValidationNotationTwo();
    }

    document.getElementById('candidate-select-1').onchange = async function() {
        const candidateId = this.value;
        if (!candidateId) { selectedCandidateId = null; document.getElementById('selected-candidate-display-1').textContent = 'Aucun'; checkValidationNotationTwo(); updateNotationTwoSelects(); return; }
        await loadCandidateNotationSide(1, candidateId);
    };
    document.getElementById('candidate-select-2').onchange = async function() {
        const candidateId = this.value;
        if (!candidateId) { selectedCandidate2Id = null; document.getElementById('selected-candidate-display-2').textContent = 'Aucun'; checkValidationNotationTwo(); updateNotationTwoSelects(); return; }
        await loadCandidateNotationSide(2, candidateId);
    };

    document.getElementById('validate-button').onclick = async () => {
        const lockSnap = await getDoc(doc(db, "config", "locks"));
        const locks = lockSnap.exists() ? lockSnap.data().locks || {} : {};
        if (locks[selectedCandidateId]?.[currentJuryName] || locks[selectedCandidate2Id]?.[currentJuryName]) {
            await customAlert(`❌ Un candidat est verrouillé.`);
            return;
        }
        const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
        const juryName = juryDoc.exists() ? juryDoc.data().name : currentJuryName;
        const roundId = activeRoundId || 'round1';

        async function saveOneScore(candidateId, score1, score2) {
            const q = query(collection(db, "scores"), where("candidateId", "==", candidateId), where("juryId", "==", currentJuryName), where("roundId", "==", roundId));
            const existing = await getDocs(q);
            const data = { juryId: currentJuryName, juryName, candidateId, roundId, score1, score2, timestamp: new Date() };
            if (!existing.empty) {
                if (existing.docs.length > 1) { for (let i = 1; i < existing.docs.length; i++) await deleteDoc(doc(db, "scores", existing.docs[i].id)); }
                await setDoc(doc(db, "scores", existing.docs[0].id), data);
            } else {
                await addDoc(collection(db, "scores"), data);
            }
        }

        const s2a = activeRoundType === 'Petite finale' ? (selectedScore2 || '0') : selectedScore2;
        const s2b = activeRoundType === 'Petite finale' ? (selectedScore2_c2 || '0') : selectedScore2_c2;
        await saveOneScore(selectedCandidateId, selectedScore1, s2a);
        await saveOneScore(selectedCandidate2Id, selectedScore1_c2, s2b);

        selectedCandidateId = null; selectedScore1 = null; selectedScore2 = null;
        selectedCandidate2Id = null; selectedScore1_c2 = null; selectedScore2_c2 = null;
        document.getElementById('candidate-select-1').value = ''; document.getElementById('candidate-select-2').value = '';
        document.getElementById('selected-candidate-display-1').textContent = 'Aucun'; document.getElementById('selected-candidate-display-2').textContent = 'Aucun';
        document.querySelectorAll('#grid-fond-1 .score-btn, #grid-forme-1 .score-btn, #grid-fond-2 .score-btn, #grid-forme-2 .score-btn').forEach(b => { b.classList.remove('selected'); b.disabled = false; b.style.opacity = '1'; });
        document.getElementById('grid-forme-1').style.opacity = '1'; document.getElementById('grid-forme-1').style.pointerEvents = 'auto';
        document.getElementById('grid-forme-2').style.opacity = '1'; document.getElementById('grid-forme-2').style.pointerEvents = 'auto';
        // Petite finale : reset curseurs épreuve 1
        const pf1Ids = [
            ['pf-slider-fond-1', 'pf-num-fond-1'],
            ['pf-slider-forme-1', 'pf-num-forme-1'],
            ['pf-slider-fond-2', 'pf-num-fond-2'],
            ['pf-slider-forme-2', 'pf-num-forme-2']
        ];
        pf1Ids.forEach(([sid, nid]) => {
            const s = document.getElementById(sid);
            const n = document.getElementById(nid);
            if (s) s.value = 0;
            if (n) n.value = '';
        });
        document.getElementById('display-score-1-fond').textContent = 'Note Fond : -'; document.getElementById('display-score-1-forme').textContent = 'Note Forme : -';
        document.getElementById('display-score-2-fond').textContent = 'Note Fond : -'; document.getElementById('display-score-2-forme').textContent = 'Note Forme : -';
        updateNotationTwoSelects();
        checkValidationNotationTwo();
        await customAlert("✓ Les deux notations ont été enregistrées.");
    };
}

async function updateNotationTwoSelects() {
    const filtered = CANDIDATES.filter(c => c.tour === (activeRoundId || 'round1'));
    const sorted = [...filtered].sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
    const opts = (excludeId) => sorted.filter(c => c.id !== excludeId).map(c => ({ value: c.id, text: c.id + ' - ' + (c.name || c.id) }));
    const sel1 = document.getElementById('candidate-select-1');
    const sel2 = document.getElementById('candidate-select-2');
    if (!sel1 || !sel2) return;
    const cur1 = sel1.value;
    const cur2 = sel2.value;
    sel1.innerHTML = '<option value="">-- Choisir --</option>' + opts(cur2).map(o => `<option value="${o.value}">${o.text}</option>`).join('');
    sel2.innerHTML = '<option value="">-- Choisir --</option>' + opts(cur1).map(o => `<option value="${o.value}">${o.text}</option>`).join('');
    if (cur1) sel1.value = cur1;
    if (cur2) sel2.value = cur2;
    if (document.getElementById('candidate-select-1b')) updateNotationTwoSelectsExo2();
}

function checkValidationNotationTwo() {
    const btn = document.getElementById('validate-button');
    if (!btn) return;
    const ok = selectedCandidateId && selectedScore1 != null && selectedScore2 != null &&
               selectedCandidate2Id && selectedScore1_c2 != null && selectedScore2_c2 != null &&
               selectedCandidateId !== selectedCandidate2Id;
    btn.disabled = !ok;
}

function updateNotationTwoSelectsExo2() {
    const filtered = CANDIDATES.filter(c => c.tour === (activeRoundId || 'round1'));
    const sorted = [...filtered].sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
    const opts = (excludeId) => sorted.filter(c => c.id !== excludeId).map(c => ({ value: c.id, text: c.id + ' - ' + (c.name || c.id) }));
    const sel1 = document.getElementById('candidate-select-1b');
    if (!sel1) return;
    const cur1 = sel1.value;
    // Œuvre contemporaine : 1 seul candidat (pas de sel2b)
    const sel2 = document.getElementById('candidate-select-2b');
    const optionsFor1 = sel2 ? opts(sel2.value) : sorted.map(c => ({ value: c.id, text: c.id + ' - ' + (c.name || c.id) }));
    sel1.innerHTML = '<option value="">-- Choisir --</option>' + optionsFor1.map(o => `<option value="${o.value}">${o.text}</option>`).join('');
    if (cur1) sel1.value = cur1;
    if (sel2) {
        const cur2 = sel2.value;
        sel2.innerHTML = '<option value="">-- Choisir --</option>' + opts(cur1).map(o => `<option value="${o.value}">${o.text}</option>`).join('');
        if (cur2) sel2.value = cur2;
    }
}

function checkValidationNotationTwoExo2() {
    const btn = document.getElementById('validate-button-2');
    if (!btn) return;
    const ok = selectedCandidateIdExo2 && selectedScore1Exo2 != null;
    btn.disabled = !ok;
}

async function loadCandidateNotationSideExo2(candNum, candidateId) {
    if (!candidateId) {
        selectedCandidateIdExo2 = null;
        document.getElementById('selected-candidate-display-1b').textContent = 'Aucun';
        selectedScore1Exo2 = null;
        ['pf2-slider-globale-1', 'pf2-num-globale-1'].forEach(id => { const el = document.getElementById(id); if (el) el.value = el.type === 'range' ? 0 : 0; });
        const d = document.getElementById('display-oeuvre2-globale'); if (d) d.textContent = 'Note globale : -';
        updateNotationTwoSelectsExo2();
        checkValidationNotationTwoExo2();
        return;
    }
    const c = CANDIDATES.find(x => x.id === candidateId);
    if (!c) return;
    const q = query(collection(db, "scores"), where("candidateId", "==", candidateId), where("juryId", "==", currentJuryName), where("roundId", "==", activeRoundId || 'round1'));
    const snap = await getDocs(q);
    const scores = snap.docs[0]?.data();
    const s3 = scores && (scores.score3 != null && scores.score3 !== '') ? scores.score3 : '-';
    const s4 = scores && (scores.score4 != null && scores.score4 !== '') ? scores.score4 : '-';
    const allSet = s3 !== '-';
    selectedCandidateIdExo2 = candidateId;
    document.getElementById('selected-candidate-display-1b').textContent = allSet ? c.name + ' (déjà noté)' : 'Candidat : ' + c.name;
    selectedScore1Exo2 = s3 !== '-' ? s3 : null;
    const setEl = (sid, nid, did, val) => {
        const v = val !== '-' ? parseInt(val, 10) : null;
        const s = document.getElementById(sid);
        const n = document.getElementById(nid);
        const d = document.getElementById(did);
        if (s && v != null && !isNaN(v)) s.value = v;
        if (n) n.value = v != null ? v : '';
        if (d) d.textContent = v != null ? v : 'Note globale : -';
    };
    setEl('pf2-slider-globale-1', 'pf2-num-globale-1', 'display-oeuvre2-globale', s3);
    updateNotationTwoSelectsExo2();
    checkValidationNotationTwoExo2();
}

async function validateNotationTwoExo2() {
    const roundId = activeRoundId || 'round1';
    async function mergeScoreExo2(candidateId, score3, score4, score5, score6) {
        const q = query(collection(db, "scores"), where("candidateId", "==", candidateId), where("juryId", "==", currentJuryName), where("roundId", "==", roundId));
        const existing = await getDocs(q);
        if (!existing.empty) {
            await setDoc(doc(db, "scores", existing.docs[0].id), { score3, score4, score5, score6, timestamp: new Date() }, { merge: true });
        } else {
            const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
            const juryName = juryDoc.exists() ? juryDoc.data().name : currentJuryName;
            await addDoc(collection(db, "scores"), { juryId: currentJuryName, juryName, candidateId, roundId, score1: '-', score2: '-', score3, score4, score5, score6, timestamp: new Date() });
        }
    }
    await mergeScoreExo2(selectedCandidateIdExo2, selectedScore1Exo2, '-', '-', '-');
    selectedCandidateIdExo2 = null; selectedScore1Exo2 = null;
    const sel1b = document.getElementById('candidate-select-1b');
    if (sel1b) sel1b.value = '';
    document.getElementById('selected-candidate-display-1b').textContent = 'Aucun';
    ['pf2-slider-globale-1', 'pf2-num-globale-1'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.type === 'range' ? 0 : 0;
    });
    document.getElementById('display-oeuvre2-globale').textContent = 'Note globale : -';
    updateNotationTwoSelectsExo2();
    checkValidationNotationTwoExo2();
    await customAlert("✓ La notation (œuvre contemporaine) a été enregistrée.");
}

/** Grilles Le temps des discours (Petite finale — 1 candidat, 4 notes) */
function createGridsNotationExo3() {
    const wrapper = document.getElementById('œuvre-notes-wrapper-3');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    const bottom = document.createElement('div');
    bottom.className = 'œuvre-notes-bottom';
    bottom.innerHTML = `
        <div class="œuvre-note-cell">
            <label>Note de fond</label>
            <div class="duel-score-input-wrap">
                <div class="duel-slider-row">
                    <span class="duel-slider-endcap">0</span>
                    <input type="range" id="pf3-slider-fond-1" min="0" max="20" value="0" class="duel-range-input">
                    <span class="duel-slider-endcap">20</span>
                    <input type="number" id="pf3-num-fond-1" min="0" max="20" step="1" value="" placeholder="0" class="duel-num-input" inputmode="numeric">
                </div>
            </div>
            <p id="display-oeuvre3-fond" class="selection-info">-</p>
        </div>
        <div class="œuvre-note-cell">
            <label id="label-critere-exo3">${currentJuryCriterePetiteFinale ? `Note critère spécifique (${currentJuryCriterePetiteFinale})` : 'Note critère spécifique'}</label>
            <div class="duel-score-input-wrap">
                <div class="duel-slider-row">
                    <span class="duel-slider-endcap">0</span>
                    <input type="range" id="pf3-slider-critere-1" min="0" max="20" value="0" class="duel-range-input">
                    <span class="duel-slider-endcap">20</span>
                    <input type="number" id="pf3-num-critere-1" min="0" max="20" step="1" value="" placeholder="0" class="duel-num-input" inputmode="numeric">
                </div>
            </div>
            <p id="display-oeuvre3-critere" class="selection-info">-</p>
        </div>
    `;
    wrapper.appendChild(bottom);
    const top = document.createElement('div');
    top.className = 'œuvre-notes-top';
    top.innerHTML = `
        <label>Note globale du discours</label>
        <div class="duel-score-input-wrap">
            <div class="duel-slider-row">
                <span class="duel-slider-endcap">0</span>
                <input type="range" id="pf3-slider-globale-1" min="0" max="30" value="0" class="duel-range-input">
                <span class="duel-slider-endcap">30</span>
                <input type="number" id="pf3-num-globale-1" min="0" max="30" step="1" value="" placeholder="0" class="duel-num-input" inputmode="numeric">
            </div>
        </div>
        <p id="display-oeuvre3-globale" class="selection-info">Note globale : -</p>
    `;
    wrapper.appendChild(top);
    const bindOeuvre3 = (sliderId, numId, displayId, maxVal, setScore) => {
        const s = document.getElementById(sliderId);
        const n = document.getElementById(numId);
        const d = document.getElementById(displayId);
        const setValue = (v) => {
            const num = Math.min(maxVal, Math.max(0, parseInt(String(v), 10)));
            if (isNaN(num)) return;
            setScore(String(num));
            if (n) n.value = num;
            if (s) s.value = num;
            if (d) d.textContent = num;
            checkValidationNotationExo3();
        };
        if (n) { n.addEventListener('input', () => setValue(n.value)); n.addEventListener('change', () => setValue(n.value)); }
        if (s) s.addEventListener('input', () => setValue(s.value));
    };
    bindOeuvre3('pf3-slider-globale-1', 'pf3-num-globale-1', 'display-oeuvre3-globale', 30, v => { selectedScore1Exo3 = v; });
    bindOeuvre3('pf3-slider-fond-1', 'pf3-num-fond-1', 'display-oeuvre3-fond', 20, v => { selectedScore2Exo3 = v; });
    bindOeuvre3('pf3-slider-critere-1', 'pf3-num-critere-1', 'display-oeuvre3-critere', 20, v => { selectedScore3Exo3 = v; });
}

function updateNotationSelectsExo3() {
    const filtered = CANDIDATES.filter(c => c.tour === (activeRoundId || 'round1'));
    const sorted = [...filtered].sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
    const sel1 = document.getElementById('candidate-select-1c');
    if (!sel1) return;
    const cur1 = sel1.value;
    sel1.innerHTML = '<option value="">-- Choisir --</option>' + sorted.map(c => ({ value: c.id, text: c.id + ' - ' + (c.name || c.id) })).map(o => `<option value="${o.value}">${o.text}</option>`).join('');
    if (cur1) sel1.value = cur1;
}

function checkValidationNotationExo3() {
    const btn = document.getElementById('validate-button-3');
    if (!btn) return;
    btn.disabled = !(selectedCandidateIdExo3 && selectedScore1Exo3 != null && selectedScore2Exo3 != null && selectedScore3Exo3 != null);
}

async function loadCandidateNotationSideExo3(candNum, candidateId) {
    if (!candidateId) {
        selectedCandidateIdExo3 = null;
        document.getElementById('selected-candidate-display-1c').textContent = 'Aucun';
        selectedScore1Exo3 = null; selectedScore2Exo3 = null; selectedScore3Exo3 = null;
        ['pf3-slider-globale-1', 'pf3-num-globale-1', 'pf3-slider-fond-1', 'pf3-num-fond-1', 'pf3-slider-critere-1', 'pf3-num-critere-1'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = el.type === 'range' ? 0 : 0;
        });
        document.getElementById('display-oeuvre3-globale').textContent = 'Note globale : -';
        ['display-oeuvre3-fond', 'display-oeuvre3-critere'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '-'; });
        updateNotationSelectsExo3();
        checkValidationNotationExo3();
        return;
    }
    const cand = CANDIDATES.find(x => x.id === candidateId);
    if (!cand) return;
    const q = query(collection(db, "scores"), where("candidateId", "==", candidateId), where("juryId", "==", currentJuryName), where("roundId", "==", activeRoundId || 'round1'));
    const snap = await getDocs(q);
    const data = snap.docs[0]?.data();
    const s7 = data && (data.score7 != null && data.score7 !== '') ? data.score7 : '-';
    const s8 = data && (data.score8 != null && data.score8 !== '') ? data.score8 : '-';
    const s9 = data && (data.score9 != null && data.score9 !== '') ? data.score9 : '-';
    const allSet = s7 !== '-' && s8 !== '-' && s9 !== '-';
    selectedCandidateIdExo3 = candidateId;
    document.getElementById('selected-candidate-display-1c').textContent = allSet ? cand.name + ' (déjà noté)' : 'Candidat : ' + cand.name;
    selectedScore1Exo3 = s7 !== '-' ? s7 : null;
    selectedScore2Exo3 = s8 !== '-' ? s8 : null;
    selectedScore3Exo3 = s9 !== '-' ? s9 : null;
    const setEl = (sid, nid, did, val) => {
        const v = val !== '-' ? parseInt(val, 10) : null;
        const s = document.getElementById(sid);
        const n = document.getElementById(nid);
        const d = document.getElementById(did);
        if (s && v != null && !isNaN(v)) s.value = v;
        if (n) n.value = v != null ? v : '';
        if (d) d.textContent = v != null ? v : (did === 'display-oeuvre3-globale' ? 'Note globale : -' : '-');
    };
    setEl('pf3-slider-globale-1', 'pf3-num-globale-1', 'display-oeuvre3-globale', s7);
    setEl('pf3-slider-fond-1', 'pf3-num-fond-1', 'display-oeuvre3-fond', s8);
    setEl('pf3-slider-critere-1', 'pf3-num-critere-1', 'display-oeuvre3-critere', s9);
    updateNotationSelectsExo3();
    checkValidationNotationExo3();
}

async function validateNotationExo3() {
    const roundId = activeRoundId || 'round1';
    const q = query(collection(db, "scores"), where("candidateId", "==", selectedCandidateIdExo3), where("juryId", "==", currentJuryName), where("roundId", "==", roundId));
    const existing = await getDocs(q);
    const payload = { score7: selectedScore1Exo3, score8: selectedScore2Exo3, score9: selectedScore3Exo3, score10: '-', timestamp: new Date() };
    if (!existing.empty) {
        await setDoc(doc(db, "scores", existing.docs[0].id), payload, { merge: true });
    } else {
        const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
        const juryName = juryDoc.exists() ? juryDoc.data().name : currentJuryName;
        await addDoc(collection(db, "scores"), { juryId: currentJuryName, juryName, candidateId: selectedCandidateIdExo3, roundId, score1: '-', score2: '-', score3: '-', score4: '-', score5: '-', score6: '-', score7: selectedScore1Exo3, score8: selectedScore2Exo3, score9: selectedScore3Exo3, score10: '-', timestamp: new Date() });
    }
    selectedCandidateIdExo3 = null; selectedScore1Exo3 = null; selectedScore2Exo3 = null; selectedScore3Exo3 = null;
    const sel1c = document.getElementById('candidate-select-1c');
    if (sel1c) sel1c.value = '';
    document.getElementById('selected-candidate-display-1c').textContent = 'Aucun';
    ['pf3-slider-globale-1', 'pf3-num-globale-1', 'pf3-slider-fond-1', 'pf3-num-fond-1', 'pf3-slider-critere-1', 'pf3-num-critere-1'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.type === 'range' ? 0 : 0;
    });
    document.getElementById('display-oeuvre3-globale').textContent = 'Note globale : -';
    ['display-oeuvre3-fond', 'display-oeuvre3-critere'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '-'; });
    updateNotationSelectsExo3();
    checkValidationNotationExo3();
    await customAlert("✓ La notation (Le temps des discours) a été enregistrée.");
}

/** Gestion des onglets jury : Notation | Duels | Mon classement */
function setupJuryTabs() {
    const btns = document.querySelectorAll('.jury-tab-btn');
    const contents = document.querySelectorAll('.jury-tab-content');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-jury-tab');
            btns.forEach(b => { b.classList.remove('active'); });
            contents.forEach(c => { c.classList.remove('active'); });
            btn.classList.add('active');
            const panel = document.getElementById('jury-tab-' + tab);
            if (panel) panel.classList.add('active');
            if (tab === 'duels') renderJuryDuelsPanel();
            if (tab === 'mon-classement') renderJuryMonClassementPanel();
        });
    });
}

/** Onglet Duels : liste des gagnants ; président peut sélectionner le gagnant, autres en lecture seule */
async function renderJuryDuelsPanel() {
    const messageEl = document.getElementById('jury-duels-message');
    const listEl = document.getElementById('jury-duels-list');
    if (!messageEl || !listEl) return;
    const roundId = activeRoundId || 'round1';
    if (CANDIDATES.length === 0) {
        const candSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
        if (candSnap.exists()) CANDIDATES = candSnap.data().candidates || [];
    }
    try {
        const snap = await getDoc(doc(db, "duel_results", roundId));
        const duels = (snap.exists() && snap.data().duels) ? [...snap.data().duels] : [];
        messageEl.style.display = duels.length === 0 ? 'block' : 'none';
        messageEl.textContent = duels.length === 0 ? 'Aucun duel pour ce tour.' : '';
        listEl.style.display = duels.length > 0 ? 'block' : 'none';
        listEl.innerHTML = '';
        duels.forEach((duel, i) => {
            const c1 = CANDIDATES.find(c => c.id === duel.candidate1Id);
            const c2 = CANDIDATES.find(c => c.id === duel.candidate2Id);
            const name1 = (c1 ? c1.name : duel.candidate1Id) || duel.candidate1Id;
            const name2 = (c2 ? c2.name : duel.candidate2Id) || duel.candidate2Id;
            const is1Winner = duel.winnerId === duel.candidate1Id;
            const is2Winner = duel.winnerId === duel.candidate2Id;
            const color1 = duel.winnerId ? (is1Winner ? 'var(--success-color)' : 'var(--danger-color)') : 'var(--text-color)';
            const color2 = duel.winnerId ? (is2Winner ? 'var(--success-color)' : 'var(--danger-color)') : 'var(--text-color)';
            const card = document.createElement('div');
            card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 14px; margin-bottom: 10px; border: 2px solid var(--border-color); border-radius: 8px; background: var(--input-bg);';
            const winnerSpan = document.createElement('span');
            winnerSpan.style.color = 'var(--text-color);';
            if (duel.winnerId) {
                const winnerName = duel.winnerId === duel.candidate1Id ? name1 : name2;
                winnerSpan.innerHTML = 'Gagnant : <span style="color: var(--success-color); font-weight: 600;">' + winnerName.replace(/</g, '&lt;') + '</span>';
        } else {
                winnerSpan.textContent = 'Gagnant : —';
            }
            const vsSpan = document.createElement('span');
            vsSpan.innerHTML = '<span style="color: ' + color1 + '; font-weight: 600;">' + name1.replace(/</g, '&lt;') + '</span> <strong>vs</strong> <span style="color: ' + color2 + '; font-weight: 600;">' + name2.replace(/</g, '&lt;') + '</span>';
            card.innerHTML = '<span style="font-weight: 600; color: var(--text-color);">Duel ' + (i + 1) + '</span>';
            card.appendChild(vsSpan);
            card.appendChild(winnerSpan);
            if (isCurrentUserPresident) {
                const wrap = document.createElement('span');
                wrap.style.display = 'flex'; wrap.style.gap = '10px'; wrap.style.alignItems = 'center';
                const btn1 = document.createElement('button');
                btn1.type = 'button';
                btn1.textContent = name1;
                btn1.style.cssText = 'padding: 8px 14px; border-radius: 6px; border: 2px solid var(--border-color); cursor: pointer; font-weight: 600; background: ' + (is1Winner ? 'var(--success-color)' : (duel.winnerId ? 'var(--danger-color)' : 'var(--input-bg)')) + '; color: ' + (is1Winner || (duel.winnerId && !is1Winner) ? 'white' : 'var(--text-color)') + ';';
                const btn2 = document.createElement('button');
                btn2.type = 'button';
                btn2.textContent = name2;
                btn2.style.cssText = 'padding: 8px 14px; border-radius: 6px; border: 2px solid var(--border-color); cursor: pointer; font-weight: 600; background: ' + (is2Winner ? 'var(--success-color)' : (duel.winnerId ? 'var(--danger-color)' : 'var(--input-bg)')) + '; color: ' + (is2Winner || (duel.winnerId && !is2Winner) ? 'white' : 'var(--text-color)') + ';';
                btn1.onclick = () => jurySetDuelWinner(roundId, duels, i, duel.candidate1Id);
                btn2.onclick = () => jurySetDuelWinner(roundId, duels, i, duel.candidate2Id);
                wrap.appendChild(btn1); wrap.appendChild(btn2);
                card.appendChild(wrap);
            }
            listEl.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        messageEl.style.display = 'block';
        messageEl.textContent = 'Erreur de chargement des duels.';
        listEl.style.display = 'none';
    }
}

/** Enregistrer le gagnant d'un duel (président uniquement, appelé depuis l'onglet jury). */
async function jurySetDuelWinner(roundId, duelsList, duelIndex, winnerId) {
    if (!isCurrentUserPresident || duelIndex < 0 || duelIndex >= duelsList.length) return;
    const d = duelsList[duelIndex];
    if (winnerId !== d.candidate1Id && winnerId !== d.candidate2Id) return;
    d.winnerId = winnerId;
    try {
        await setDoc(doc(db, "duel_results", roundId), { duels: duelsList, updatedAt: new Date() });
        renderJuryDuelsPanel();
    } catch (err) {
        console.error(err);
        if (typeof customAlert === 'function') customAlert('Erreur lors de l\'enregistrement du gagnant.');
    }
}

/** Onglet Mon classement : 5 premières positions (1 à 5), un menu déroulant par position avec tous les candidats ; si un candidat est resélectionné à une autre position, l'ancienne se vide. */
async function renderJuryMonClassementPanel() {
    const tbody = document.getElementById('jury-mon-classement-body');
    if (!tbody) return;
    const roundId = activeRoundId || 'round1';
    let candidates = CANDIDATES.filter(c => c.tour === roundId);
    if (candidates.length === 0) {
        const candSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
        if (candSnap.exists()) {
            CANDIDATES = candSnap.data().candidates || [];
            candidates = CANDIDATES.filter(c => c.tour === roundId);
        }
    }
    const docId = `${currentJuryName}_${roundId}`;
    const rankingSnap = await getDoc(doc(db, "jury_rankings", docId));
    const positions = rankingSnap.exists() ? { ...(rankingSnap.data().positions || {}) } : {};
    MON_CLASSEMENT_POSITIONS.forEach(p => { if (positions[p] === undefined) positions[p] = null; });

    tbody.innerHTML = '';
    MON_CLASSEMENT_POSITIONS.forEach(positionLabel => {
        const row = tbody.insertRow();
        const cellPos = row.insertCell();
        cellPos.textContent = positionLabel;
        cellPos.style.padding = '12px';
        cellPos.style.textAlign = 'center';
        cellPos.style.fontWeight = '600';
        const cellSelect = row.insertCell();
        cellSelect.style.padding = '12px';
        const select = document.createElement('select');
        select.dataset.position = positionLabel;
        select.style.width = '100%';
        select.style.padding = '8px';
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— Aucun —';
        select.appendChild(emptyOpt);
        candidates.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = (c.id || '') + ' - ' + (c.name || c.id);
            select.appendChild(opt);
        });
        const currentVal = positions[positionLabel];
        select.value = currentVal || '';
        cellSelect.appendChild(select);

        select.addEventListener('change', async () => {
            const chosenId = select.value || null;
            const newPositions = {};
            document.querySelectorAll('#jury-mon-classement-body select[data-position]').forEach(sel => {
                newPositions[sel.getAttribute('data-position')] = sel.value || null;
            });
            newPositions[positionLabel] = chosenId;
            if (chosenId) {
                MON_CLASSEMENT_POSITIONS.forEach(p => {
                    if (p === positionLabel) return;
                    if (newPositions[p] === chosenId) {
                        newPositions[p] = null;
                        const otherSel = tbody.querySelector('select[data-position="' + p + '"]');
                        if (otherSel) otherSel.value = '';
                    }
                });
            }
            try {
                await setDoc(doc(db, "jury_rankings", docId), {
                    juryId: currentJuryName,
                    roundId,
                    positions: newPositions,
                    updatedAt: new Date()
                });
            } catch (err) {
                console.error(err);
                if (typeof customAlert === 'function') customAlert('Erreur sauvegarde : ' + err.message);
            }
        });
    });
}

/**
 * Session "Classement" : identifiant classement, code classement, lecture seule, synchronisation temps réel.
 * Onglets : Classement (global) | Mon classement (5 positions par juré, sans application de points).
 * Stockage : classements/{classementId} ; jury_rankings/{juryId_roundId} pour Mon classement.
 */
async function showClassementInterface() {
    const scoringPage = document.getElementById('scoring-page');
    let classementId = activeRoundClassementId;
    if (!classementId) {
        const activationsSnap = await getDoc(doc(db, "config", "activations"));
        if (activationsSnap.exists()) classementId = activationsSnap.data().classementIdActif || null;
    }
    const codeDisplay = activeRoundClassementCode || (classementId ? classementId : '—');

    scoringPage.innerHTML = `
        <div class="burger-menu">
            <div class="burger-icon" onclick="toggleMenu()"><span></span><span></span><span></span></div>
            <div class="burger-menu-content" id="menu-content-scoring">
                <div class="theme-toggle"><span>Mode sombre</span><div class="toggle-switch" id="theme-toggle-scoring" onclick="toggleTheme()"><div class="toggle-slider"></div></div></div>
                <div class="menu-item" onclick="syncWithAdmin()">📡 Synchroniser avec l'admin</div>
                <div class="menu-item" onclick="changePassword()">🔑 Changer le mot de passe</div>
                <div class="menu-item" onclick="logout()">🚪 Déconnexion</div>
            </div>
        </div>
        <p id="scoring-round-display" style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing);"></p>
        <h2 style="text-align: center; margin-bottom: var(--spacing);">Jury: <span id="current-jury-display"></span></h2>
        <h3 style="text-align: center; margin-bottom: var(--spacing); color: var(--text-color);">Classement — ${activeRoundName}</h3>
        <div class="classement-tabs" style="display: flex; gap: 0; margin-bottom: 15px; max-width: 800px; margin-left: auto; margin-right: auto;">
            <button type="button" class="classement-tab active" data-tab="classement" style="flex: 1; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm) 0 0 var(--radius-sm); background: var(--primary-color); color: white; cursor: pointer; font-weight: 600;">Classement</button>
            <button type="button" class="classement-tab" data-tab="mon-classement" style="flex: 1; padding: 12px; border: 1px solid var(--border-color); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; background: var(--card-bg); color: var(--text-color); cursor: pointer;">Mon classement</button>
        </div>
        <div id="classement-tab-panel" class="classement-tab-panel" style="max-width: 800px; margin: 0 auto;">
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 15px;">Code : <strong>${codeDisplay}</strong> · Lecture seule · Mise à jour en temps réel</p>
            <div id="classement-container" style="max-width: 800px; margin: 0 auto; background: var(--card-bg); border-radius: var(--radius); padding: var(--spacing); box-shadow: var(--shadow-md);">
            <p id="classement-loading" style="text-align: center; color: var(--text-secondary);">Chargement du classement…</p>
            <table id="classement-table" style="width: 100%; border-collapse: collapse; display: none;">
                <thead><tr id="classement-thead-row" style="background: var(--neutral-color); color: white;"><th style="padding: 12px; text-align: center;">Rang</th><th style="padding: 12px; text-align: left;">Candidat</th><th style="padding: 12px; text-align: center;">Score</th></tr></thead>
                <tbody id="classement-body"></tbody>
            </table>
            <p id="classement-empty" style="text-align: center; color: var(--text-secondary); display: none;">Aucun classement pour l’instant.</p>
            </div>
        </div>
        <div id="mon-classement-tab-panel" class="classement-tab-panel" style="display: none; max-width: 800px; margin: 0 auto; background: var(--card-bg); border-radius: var(--radius); padding: var(--spacing); box-shadow: var(--shadow-md);">
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 15px;">Votre classement personnel : 5 premières positions (1 à 5). Chaque menu propose tous les candidats ; si vous placez un candidat à une autre position, son ancienne position se vide.</p>
            <table id="mon-classement-table" style="width: 100%; border-collapse: collapse;">
                <thead><tr style="background: var(--neutral-color); color: white;"><th style="padding: 12px; text-align: center;">Position</th><th style="padding: 12px; text-align: left;">Candidat</th></tr></thead>
                <tbody id="mon-classement-body"></tbody>
            </table>
        </div>
    `;

    document.getElementById('current-jury-display').textContent = currentJuryDisplayName;
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) roundDisplay.textContent = activeRoundName ? `Tour : ${activeRoundName}` : '';
    if (typeof initTheme === 'function') initTheme();

    // Onglets Classement / Mon classement
    const tabButtons = scoringPage.querySelectorAll('.classement-tab');
    const panelClassement = document.getElementById('classement-tab-panel');
    const panelMonClassement = document.getElementById('mon-classement-tab-panel');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            tabButtons.forEach(b => {
                b.classList.remove('active');
                b.style.background = b.getAttribute('data-tab') === 'classement' ? 'var(--card-bg)' : 'var(--card-bg)';
                b.style.color = 'var(--text-color)';
                b.style.fontWeight = 'normal';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
            btn.style.fontWeight = '600';
            if (tab === 'classement') {
                if (panelClassement) panelClassement.style.display = 'block';
                if (panelMonClassement) panelMonClassement.style.display = 'none';
            } else {
                if (panelClassement) panelClassement.style.display = 'none';
                if (panelMonClassement) {
                    panelMonClassement.style.display = 'block';
                    renderMonClassementPanel();
                }
            }
        });
    });

    const BONUS_VICTOIRE_FACTOR = 1.10;
    let lastRenderedClassementEntries = null;

    function getEntryDisplayScore(entry) {
        return entry.score_affiché != null ? entry.score_affiché : (entry.score_appliqué != null ? entry.score_appliqué : (entry.score_base != null ? entry.score_base : (entry.score != null ? entry.score : 0)));
    }

    /** Score final uniquement (score_affiché puis score_appliqué) — pour le tri. Mise à jour du classement uniquement par activation. */
    function getScoreFinal(entry) {
        const v = entry.score_affiché != null ? entry.score_affiché : (entry.score_appliqué != null ? entry.score_appliqué : 0);
        return typeof v === 'number' ? v : parseFloat(v) || 0;
    }

    function renderClassement(data, opts) {
        const fromAdmin = opts && opts.fromAdmin === true;
        const tbody = document.getElementById('classement-body');
        const theadRow = document.getElementById('classement-thead-row');
        const loadingEl = document.getElementById('classement-loading');
        const tableEl = document.getElementById('classement-table');
        const emptyEl = document.getElementById('classement-empty');
        if (!tbody) return;
        if (!data || !data.entries || data.entries.length === 0) {
            if (loadingEl) loadingEl.style.display = 'none';
            if (tableEl) tableEl.style.display = 'none';
            if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'Aucun classement pour l’instant.'; }
            previousClassementEntriesForOvertake = null;
            lastRenderedClassementEntries = null;
            return;
        }
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        if (tableEl) tableEl.style.display = 'table';
        const oldRankByCandidate = {};
        if (previousClassementEntriesForOvertake) {
            previousClassementEntriesForOvertake.forEach(e => { oldRankByCandidate[e.candidateId] = e.rank != null ? e.rank : 0; });
        }
        if (theadRow && isCurrentUserPresident) {
            if (!theadRow.querySelector('th.classement-bonus-header')) {
                const th = document.createElement('th');
                th.className = 'classement-bonus-header';
                th.style.cssText = 'padding: 12px; text-align: center;';
                th.textContent = 'Bonus';
                theadRow.appendChild(th);
            }
        } else if (theadRow) {
            const bonusTh = theadRow.querySelector('th.classement-bonus-header');
            if (bonusTh) bonusTh.remove();
        }
        tbody.innerHTML = '';
        const sortedEntries = [...data.entries].sort((a, b) => getScoreFinal(b) - getScoreFinal(a));
        const numQualified = activeRoundNextCandidates === 'ALL' ? sortedEntries.length : (parseInt(activeRoundNextCandidates, 10) || 0);
        sortedEntries.forEach((entry, i) => {
            const row = tbody.insertRow();
            const newRank = i + 1;
            if (previousClassementEntriesForOvertake && oldRankByCandidate[entry.candidateId] != null && newRank < oldRankByCandidate[entry.candidateId]) {
                row.classList.add('row-overtake');
            }
            if (fromAdmin && previousClassementEntriesForOvertake && oldRankByCandidate[entry.candidateId] != null && newRank > oldRankByCandidate[entry.candidateId]) {
                row.classList.add('classement-row-overtaken');
            }
            if (i < numQualified) row.classList.add('classement-row-qualified');
            const rankCell = row.insertCell();
            rankCell.textContent = newRank;
            rankCell.style.padding = '12px';
            rankCell.style.textAlign = 'center';
            const nameCell = row.insertCell();
            nameCell.textContent = entry.name || entry.candidateId || '—';
            nameCell.style.padding = '12px';
            const scoreCell = row.insertCell();
            const scoreAffiche = getEntryDisplayScore(entry);
            scoreCell.textContent = scoreAffiche != null ? scoreAffiche : '—';
            scoreCell.style.padding = '12px';
            scoreCell.style.textAlign = 'center';
            if (isCurrentUserPresident) {
                const bonusCell = row.insertCell();
                bonusCell.style.padding = '12px';
                bonusCell.style.textAlign = 'center';
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = '+ Bonus victoire';
                btn.className = 'bonus-victoire-btn';
                btn.onclick = () => applyBonusVictoire(classementId, entry.candidateId);
                bonusCell.appendChild(btn);
            }
        });
        lastRenderedClassementEntries = sortedEntries.map((e, i) => ({ ...e, rank: i + 1 }));
        previousClassementEntriesForOvertake = null;
    }

    function getEntryScore(e) {
        return e.score_affiché != null ? e.score_affiché : (e.score_appliqué != null ? e.score_appliqué : (e.score_base != null ? e.score_base : (e.score != null ? e.score : 0)));
    }

    window.applyBonusVictoire = async function(cId, candidateId) {
        if (!cId || !candidateId) return;
        try {
            const snap = await getDoc(doc(db, "classements", cId));
            if (!snap.exists()) return;
            const data = snap.data();
            const entries = [...(data.entries || [])];
            const entry = entries.find(e => e.candidateId === candidateId);
            if (!entry) return;
            const currentScore = getEntryScore(entry);
            const numScore = typeof currentScore === 'number' ? currentScore : parseFloat(currentScore) || 0;
            const newScore = Math.round(numScore * BONUS_VICTOIRE_FACTOR * 100) / 100;
            entry.score_appliqué = newScore;
            entry.score_affiché = newScore;
            entries.sort((a, b) => getEntryScore(b) - getEntryScore(a));
            entries.forEach((e, i) => { e.rank = i + 1; });
            previousClassementEntriesForOvertake = snap.data().entries || [];
            await setDoc(doc(db, "classements", cId), { ...data, entries, lastUpdateSource: 'president_bonus', updatedAt: new Date() });
        } catch (err) {
            console.error(err);
            if (typeof customAlert === 'function') customAlert('Erreur lors de l\'application du bonus : ' + err.message);
            else alert('Erreur : ' + err.message);
        }
    };

    /** Collection jury_rankings : document id = juryId_roundId, champs juryId, roundId, positions { "10": candidateId|null, ... }, updatedAt. */
    async function renderMonClassementPanel() {
        const tbody = document.getElementById('mon-classement-body');
        if (!tbody) return;
        const roundId = activeRoundId || 'round1';
        let candidates = CANDIDATES.filter(c => c.tour === roundId);
        if (candidates.length === 0) {
            const candSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
            if (candSnap.exists()) {
                CANDIDATES = candSnap.data().candidates || [];
                candidates = CANDIDATES.filter(c => c.tour === roundId);
            }
        }
        const docId = `${currentJuryName}_${roundId}`;
        const rankingSnap = await getDoc(doc(db, "jury_rankings", docId));
        const positions = rankingSnap.exists() ? { ...(rankingSnap.data().positions || {}) } : {};
        MON_CLASSEMENT_POSITIONS.forEach(p => { if (positions[p] === undefined) positions[p] = null; });

        tbody.innerHTML = '';
        MON_CLASSEMENT_POSITIONS.forEach(positionLabel => {
            const row = tbody.insertRow();
            const cellPos = row.insertCell();
            cellPos.textContent = positionLabel;
            cellPos.style.padding = '12px';
            cellPos.style.textAlign = 'center';
            cellPos.style.fontWeight = '600';
            const cellSelect = row.insertCell();
            cellSelect.style.padding = '12px';
            const select = document.createElement('select');
            select.dataset.position = positionLabel;
            select.style.width = '100%';
            select.style.padding = '8px';
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '— Aucun —';
            select.appendChild(emptyOpt);
            candidates.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.id} - ${c.name || c.id}`;
                select.appendChild(opt);
            });
            const currentVal = positions[positionLabel];
            select.value = currentVal || '';
            cellSelect.appendChild(select);

            select.addEventListener('change', async () => {
                const chosenId = select.value || null;
                const newPositions = {};
                MON_CLASSEMENT_POSITIONS.forEach(p => {
                    const sel = tbody.closest('table').querySelector(`select[data-position="${p}"]`);
                    newPositions[p] = (sel && sel.value) ? sel.value : null;
                });
                newPositions[positionLabel] = chosenId;
                if (chosenId) {
                    MON_CLASSEMENT_POSITIONS.forEach(p => {
                        if (p === positionLabel) return;
                        if (newPositions[p] === chosenId) {
                            newPositions[p] = null;
                            const otherSel = tbody.closest('table').querySelector(`select[data-position="${p}"]`);
                            if (otherSel) otherSel.value = '';
                        }
                    });
                }
                try {
                    await setDoc(doc(db, "jury_rankings", docId), {
                        juryId: currentJuryName,
                        roundId,
                        positions: newPositions,
                        updatedAt: new Date()
                    });
                } catch (err) {
                    console.error(err);
                    if (typeof customAlert === 'function') customAlert('Erreur sauvegarde : ' + err.message);
                    else alert('Erreur : ' + err.message);
                }
            });
        });
    }

    if (!classementId) {
        renderClassement(null);
        return;
    }

    if (classementListener) {
        classementListener();
        classementListener = null;
    }
    classementListener = onSnapshot(doc(db, "classements", classementId), (snap) => {
        if (!snap.exists()) {
            renderClassement(null);
            return;
        }
        previousClassementEntriesForOvertake = lastRenderedClassementEntries;
        const data = snap.data();
        const fromAdmin = data.lastUpdateSource === 'admin_activation';
        renderClassement(data, { fromAdmin });
    }, (err) => {
        console.error('Erreur classement:', err);
        document.getElementById('classement-loading').textContent = 'Erreur de chargement du classement.';
    });
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
                <div class="menu-item" onclick="syncWithAdmin()">📡 Synchroniser avec l'admin</div>
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
        
        const v = scoreValue === 'EL' || scoreValue === '-' ? 0 : (Number(scoreValue) * 3) + Number(scoreValue);
        const scoreData = {
            juryId: currentJuryName,
            juryName: juryName,
            candidateId: candidateId,
            roundId: activeRoundId,
            score1: scoreValue,
            score2: scoreValue, // Les deux scores sont identiques pour le repêchage
            score_base: v,
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
    duelScore1Fond = null;
    duelScore1Forme = null;
    duelCandidate2 = null;
    duelScore2Fond = null;
    duelScore2Forme = null;
    
    // Afficher l'interface avec onglets Notation | Duels | Mon classement (Fond + Forme pour chaque candidat)
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
                <div class="menu-item" onclick="syncWithAdmin()">📡 Synchroniser avec l'admin</div>
                <div class="menu-item" onclick="changePassword()">🔑 Changer le mot de passe</div>
                <div class="menu-item" onclick="logout()">🚪 Déconnexion</div>
            </div>
        </div>
        <p id="scoring-round-display" style="text-align: center; color: var(--text-secondary); margin-bottom: var(--spacing);"></p>
        <h2 style="text-align: center; margin-bottom: var(--spacing);">Jury: <span id="current-jury-display"></span></h2>
        <div class="jury-tabs-bar">
            <button type="button" class="jury-tab-btn active" data-jury-tab="notation">Notation</button>
            <button type="button" class="jury-tab-btn" data-jury-tab="duels">Gagnants de duel</button>
            <button type="button" class="jury-tab-btn" data-jury-tab="mon-classement">Mon classement</button>
        </div>
        <div id="jury-tab-notation" class="jury-tab-content active">
            <p class="jury-notation-intro">Duel — Notez les deux candidats : Fond et Forme pour chacun (0 à 20 par critère).</p>
            <div class="jury-notation-cols">
                <div class="jury-notation-card">
                    <label for="duel-candidate-1" class="card-title">Candidat 1</label>
                    <select id="duel-candidate-1">
                        <option value="">-- Choisir --</option>
                        ${activeCandidates.map(c => `<option value="${c.id}">${c.id} - ${c.name}</option>`).join('')}
                    </select>
                    <hr class="jury-notation-sep">
                    <div class="control-group">
                        <label>Fond / Argumentation</label>
                        <div class="score-grid" id="duel-grid-fond-1"></div>
                        <p id="duel-display-1-fond" class="selection-info">Note Fond : -</p>
                </div>
                    <hr class="jury-notation-sep">
                    <div class="control-group">
                        <label>Forme / Éloquence</label>
                        <div class="score-grid" id="duel-grid-forme-1"></div>
                        <p id="duel-display-1-forme" class="selection-info">Note Forme : -</p>
                    </div>
                </div>
                <div class="jury-notation-card">
                    <label for="duel-candidate-2" class="card-title">Candidat 2</label>
                    <select id="duel-candidate-2">
                        <option value="">-- Choisir --</option>
                        ${activeCandidates.map(c => `<option value="${c.id}">${c.id} - ${c.name}</option>`).join('')}
                    </select>
                    <hr class="jury-notation-sep">
                    <div class="control-group">
                        <label>Fond / Argumentation</label>
                        <div class="score-grid" id="duel-grid-fond-2"></div>
                        <p id="duel-display-2-fond" class="selection-info">Note Fond : -</p>
                </div>
                    <hr class="jury-notation-sep">
                    <div class="control-group">
                        <label>Forme / Éloquence</label>
                        <div class="score-grid" id="duel-grid-forme-2"></div>
                        <p id="duel-display-2-forme" class="selection-info">Note Forme : -</p>
                    </div>
                </div>
            </div>
            <button id="duel-validate-button" class="jury-notation-validate" disabled>Valider le duel</button>
        </div>
        <div id="jury-tab-duels" class="jury-tab-content">
            <p id="jury-duels-message" style="text-align: center; color: var(--text-secondary);">Chargement des duels…</p>
            <div id="jury-duels-list" style="display: none;"></div>
        </div>
        <div id="jury-tab-mon-classement" class="jury-tab-content">
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 15px;">Votre classement personnel : 5 premières positions (1 à 5). Chaque menu propose tous les candidats ; si vous placez un candidat à une autre position, son ancienne position se vide.</p>
            <table id="jury-mon-classement-table" style="width: 100%; border-collapse: collapse;">
                <thead><tr style="background: var(--neutral-color); color: white;"><th style="padding: 12px; text-align: center;">Position</th><th style="padding: 12px; text-align: left;">Candidat</th></tr></thead>
                <tbody id="jury-mon-classement-body"></tbody>
            </table>
        </div>
    `;
    setupJuryTabs();
    document.getElementById('current-jury-display').textContent = currentJuryDisplayName;
    const roundDisplay = document.getElementById('scoring-round-display');
    if (roundDisplay) {
        roundDisplay.textContent = activeRoundName ? `Tour en cours : ${activeRoundName}` : '';
    }
    initTheme();
    createDuelGridsTwo();
    
    document.getElementById('duel-candidate-1').addEventListener('change', (e) => {
        duelCandidate1 = e.target.value || null;
        checkDuelValidation();
    });
    document.getElementById('duel-candidate-2').addEventListener('change', (e) => {
        duelCandidate2 = e.target.value || null;
        checkDuelValidation();
    });
    document.getElementById('duel-validate-button').addEventListener('click', confirmDuel);
}

/**
 * Vérifier si le duel peut être validé (Fond + Forme 0-20 pour les deux candidats).
 */
function checkDuelValidation() {
    const validateBtn = document.getElementById('duel-validate-button');
    if (!validateBtn) return;
    const c1Ok = duelCandidate1 && duelCandidate1 !== duelCandidate2 &&
        duelScore1Fond != null && duelScore1Forme != null;
    const c2Ok = duelCandidate2 &&
        duelScore2Fond != null && duelScore2Forme != null;
    const ok = c1Ok && c2Ok;
    validateBtn.disabled = !ok;
    validateBtn.style.opacity = ok ? '1' : '0.6';
}

/**
 * Confirmer le duel (Fond + Forme 0-20 pour chaque candidat).
 */
async function confirmDuel() {
    const candidate1 = CANDIDATES.find(c => c.id === duelCandidate1);
    const candidate2 = CANDIDATES.find(c => c.id === duelCandidate2);
    const msg = `Confirmer ce duel ?\n\n${candidate1?.name || duelCandidate1} : Fond ${duelScore1Fond} / Forme ${duelScore1Forme}\n${candidate2?.name || duelCandidate2} : Fond ${duelScore2Fond} / Forme ${duelScore2Forme}`;
    if (!await customConfirm(msg)) {
        return;
    }
    try {
        const juryDoc = await getDoc(doc(db, "accounts", currentJuryName));
        const juryName = juryDoc.exists() ? juryDoc.data().name : currentJuryName;
        const s1 = Number(duelScore1Fond);
        const s2 = Number(duelScore1Forme);
        const s3 = Number(duelScore2Fond);
        const s4 = Number(duelScore2Forme);
        const scoreBase = (s1, s2) => ((s1 === 'EL' || s2 === 'EL') ? 0 : Number(s1) + Number(s2)); // duel : fond et forme coef 1
        const scores = [
            { juryId: currentJuryName, juryName, candidateId: duelCandidate1, roundId: activeRoundId, score1: s1, score2: s2, score_base: scoreBase(s1, s2), timestamp: new Date() },
            { juryId: currentJuryName, juryName, candidateId: duelCandidate2, roundId: activeRoundId, score1: s3, score2: s4, score_base: scoreBase(s3, s4), timestamp: new Date() }
        ];
        for (const scoreData of scores) {
            const q = query(collection(db, "scores"), where("candidateId", "==", scoreData.candidateId), where("juryId", "==", currentJuryName), where("roundId", "==", activeRoundId));
            const existingScores = await getDocs(q);
            if (!existingScores.empty) {
                await setDoc(doc(db, "scores", existingScores.docs[0].id), scoreData);
            } else {
                await addDoc(collection(db, "scores"), scoreData);
            }
        }
        await customAlert("✓ Duel enregistré avec succès !");
        setTimeout(async () => {
            await checkAndQualifyCandidateFromJury(duelCandidate1);
            await checkAndQualifyCandidateFromJury(duelCandidate2);
        }, 500);
        showDuelsInterface();
    } catch (e) {
        await customAlert("Erreur lors de l'enregistrement : " + e.message);
    }
}

checkSessionAndStart();

// La liste des candidats est synchronisée en temps réel via Firebase onSnapshot (setupRealtimeListeners).
// Plus besoin de rafraîchissement périodique.
