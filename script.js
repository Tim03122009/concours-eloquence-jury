import { db } from './firebase-init.js';
import { 
    collection, addDoc, query, where, getDocs, getDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// --- VARIABLES GLOBALES ---
let currentJuryName = '';
let selectedCandidateId = null;
let selectedScore1 = null; // Note Fond
let selectedScore2 = null; // Note Forme
let CANDIDATES = [];

// --------------------------------------------------------------------------------
// INITIALISATION DES GRILLES DE BOUTONS
// --------------------------------------------------------------------------------
function createGrids() {
    const gridFond = document.getElementById('grid-fond');
    const gridForme = document.getElementById('grid-forme');
    
    // Création des boutons 1 à 20 pour les deux grilles
    for (let i = 1; i <= 20; i++) {
        // Grille Fond
        const btn1 = document.createElement('button');
        btn1.className = 'score-btn score-btn-1';
        btn1.textContent = i;
        btn1.onclick = () => selectScore(1, i, btn1);
        gridFond.appendChild(btn1);

        // Grille Forme
        const btn2 = document.createElement('button');
        btn2.className = 'score-btn score-btn-2';
        btn2.textContent = i;
        btn2.onclick = () => selectScore(2, i, btn2);
        gridForme.appendChild(btn2);
    }

    // Ajout bouton élimination sur la note de fond
    const btnElim = document.createElement('button');
    btnElim.className = 'score-btn score-btn-1 eliminated';
    btnElim.textContent = 'ÉLIMINATION DIRECTE';
    btnElim.onclick = () => selectScore(1, 'Elimine', btnElim);
    gridFond.appendChild(btnElim);
}

function selectScore(type, value, element) {
    if (type === 1) {
        selectedScore1 = value;
        document.querySelectorAll('.score-btn-1').forEach(b => b.classList.remove('selected'));
        document.getElementById('display-score-1').textContent = `Note Fond : ${value}`;
    } else {
        selectedScore2 = value;
        document.querySelectorAll('.score-btn-2').forEach(b => b.classList.remove('selected'));
        document.getElementById('display-score-2').textContent = `Note Forme : ${value}`;
    }
    element.classList.add('selected');
    checkValidation();
}

createGrids();

// --------------------------------------------------------------------------------
// LOGIQUE FIREBASE & INTERFACE
// --------------------------------------------------------------------------------

async function loadCandidatesFromFirebase() {
    const docRef = doc(db, "candidats", "liste_actuelle");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        CANDIDATES = docSnap.data().candidates;
    }
}

async function updateCandidateSelect() {
    await loadCandidatesFromFirebase();
    const select = document.getElementById('candidate-select');
    select.innerHTML = '<option value="" disabled selected>-- Choisir un candidat --</option>';

    // Récupérer les candidats déjà notés pour les griser
    const q = query(collection(db, "scores"), where("juryName", "==", currentJuryName));
    const snap = await getDocs(q);
    const scoredIds = snap.docs.map(d => d.data().candidateId);

    CANDIDATES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.id} - ${c.name}`;
        if (scoredIds.includes(c.id)) opt.disabled = true;
        select.appendChild(opt);
    });
}

document.getElementById('start-scoring-button').addEventListener('click', () => {
    currentJuryName = document.getElementById('jury-name-input').value.trim();
    if (currentJuryName.length < 3) return;

    localStorage.setItem('currentJuryName', currentJuryName);
    document.getElementById('current-jury-display').textContent = currentJuryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    updateCandidateSelect();
});

document.getElementById('candidate-select').addEventListener('change', (e) => {
    selectedCandidateId = e.target.value;
    const name = CANDIDATES.find(c => c.id === selectedCandidateId).name;
    document.getElementById('selected-candidate-display').textContent = `Candidat : ${name}`;
    checkValidation();
});

function checkValidation() {
    const btn = document.getElementById('validate-button');
    btn.disabled = !(selectedCandidateId && selectedScore1 && selectedScore2);
}

// --------------------------------------------------------------------------------
// ENVOI DES DONNÉES
// --------------------------------------------------------------------------------

document.getElementById('validate-button').addEventListener('click', () => {
    const name = CANDIDATES.find(c => c.id === selectedCandidateId).name;
    document.getElementById('modal-candidate').textContent = name;
    document.getElementById('modal-s1').textContent = selectedScore1;
    document.getElementById('modal-s2').textContent = selectedScore2;
    document.getElementById('confirmation-modal').style.display = 'flex';
});

document.getElementById('cancel-send-button').onclick = () => {
    document.getElementById('confirmation-modal').style.display = 'none';
};

document.getElementById('confirm-send-button').onclick = async () => {
    document.getElementById('confirmation-modal').style.display = 'none';
    
    // Calcul de la pondération
    let totalWeighted = 0;
    if (selectedScore1 === 'Elimine') {
        totalWeighted = 0; // Ou une valeur spécifique pour gérer l'élimination
    } else {
        totalWeighted = (parseInt(selectedScore1) * 3) + parseInt(selectedScore2);
    }

    try {
        await addDoc(collection(db, "scores"), {
            juryName: currentJuryName,
            candidateId: selectedCandidateId,
            score1: selectedScore1,
            score2: selectedScore2,
            totalWeightedScore: totalWeighted,
            timestamp: new Date()
        });

        alert("Notes enregistrées !");
        location.reload(); // Recharge pour vider les sélections
    } catch (e) {
        alert("Erreur lors de l'envoi.");
    }
};