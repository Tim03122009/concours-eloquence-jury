import { db } from './firebase-init.js';
import { 
    collection, addDoc, query, where, getDocs, getDoc, doc, setDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// --- VARIABLES GLOBALES (Ajout de localStorage) ---
let currentJuryName = localStorage.getItem('currentJuryName') || '';
let storedSessionId = localStorage.getItem('sessionId') || '';
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
    localStorage.clear();
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
// Détection du mode admin
document.getElementById('jury-name-input').addEventListener('input', (e) => {
    const name = e.target.value.trim().toLowerCase();
    const passwordGroup = document.getElementById('password-group');
    if (name === 'admin') {
        passwordGroup.style.display = 'block';
    } else {
        passwordGroup.style.display = 'none';
    }
});

document.getElementById('start-scoring-button').onclick = async () => {
    const name = document.getElementById('jury-name-input').value.trim();
    if (name.length < 2) return;

    // Vérification mode admin
    if (name.toLowerCase() === 'admin') {
        const password = document.getElementById('admin-password-input').value;
        if (!password) {
            alert('Veuillez entrer le mot de passe administrateur');
            return;
        }

        try {
            // Récupération du mot de passe admin depuis Firebase
            const adminDoc = await getDoc(doc(db, "config", "admin"));
            const storedPassword = adminDoc.exists() ? adminDoc.data().password : 'admin';

            if (password === storedPassword) {
                // Redirection vers admin.html
                window.location.href = 'admin.html';
            } else {
                alert('Mot de passe incorrect');
            }
        } catch (e) {
            console.error('Erreur de connexion admin:', e);
            alert('Erreur de connexion');
        }
        return;
    }

    // Connexion jury normale
    const snap = await getDoc(doc(db, "config", "session"));
    const firebaseSessionId = snap.exists() ? snap.data().current_id : '1';

    currentJuryName = name;
    storedSessionId = firebaseSessionId;
    localStorage.setItem('currentJuryName', name);
    localStorage.setItem('sessionId', firebaseSessionId);
    startScoring();
};

function startScoring() {
    document.getElementById('current-jury-display').textContent = currentJuryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    createGrids();
    updateCandidateSelect();
}

async function updateCandidateSelect(preserveSelection = null) {
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) CANDIDATES = docSnap.data().candidates || [];

    const q = query(collection(db, "scores"), where("juryName", "==", currentJuryName));
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
        
        // Vérifier si un score existe déjà pour ce candidat et ce jury
        const q = query(
            collection(db, "scores"), 
            where("candidateId", "==", selectedCandidateId),
            where("juryName", "==", currentJuryName)
        );
        const existingScores = await getDocs(q);
        
        const scoreData = {
            juryName: currentJuryName,
            candidateId: selectedCandidateId,
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