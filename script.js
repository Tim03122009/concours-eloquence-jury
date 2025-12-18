import { db } from './firebase-init.js';
import { 
    collection, addDoc, query, where, getDocs, getDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

let currentJuryName = '';
let selectedCandidateId = null;
let selectedScore1 = null;
let selectedScore2 = null;
let CANDIDATES = [];

// --- NOUVEAU : VERIFICATION DE SESSION AU CHARGEMENT ---
const storedJuryName = localStorage.getItem('currentJuryName');
if (storedJuryName) {
    currentJuryName = storedJuryName;
    // On attend que le DOM soit prêt pour basculer de page
    document.addEventListener('DOMContentLoaded', () => {
        showScoringPage(currentJuryName);
    });
}

// Fonction pour basculer vers l'interface de notation
function showScoringPage(name) {
    document.getElementById('current-jury-name').textContent = name;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    loadCandidateList();
}

// A. IDENTIFICATION (Premier passage)
document.getElementById('start-scoring-button').addEventListener('click', () => {
    const input = document.getElementById('jury-name-input');
    currentJuryName = input.value.trim();
    if (currentJuryName.length < 3) return;

    localStorage.setItem('currentJuryName', currentJuryName);
    showScoringPage(currentJuryName);
});

// B. CHARGEMENT CANDIDATS
async function loadCandidateList() {
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) {
        CANDIDATES = docSnap.data().candidates;
    }

    const q = query(collection(db, "scores"), where("juryName", "==", currentJuryName));
    const snap = await getDocs(q);
    const scoredIds = snap.docs.map(d => d.data().candidateId);

    const selectElement = document.getElementById('candidate-select');
    selectElement.innerHTML = ''; 

    CANDIDATES.forEach(candidate => {
        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = `${candidate.id} - ${candidate.name}`;
        if (scoredIds.includes(candidate.id)) {
            option.classList.add('scored');
            option.disabled = true;
        }
        selectElement.appendChild(option);
    });
}

document.getElementById('candidate-select').addEventListener('change', (e) => {
    selectedCandidateId = e.target.value;
    const name = CANDIDATES.find(c => c.id === selectedCandidateId).name;
    document.getElementById('selected-candidate-display').textContent = `Candidat : ${name}`;
    checkValidationStatus();
});

// C. SELECTION DES NOTES
document.querySelectorAll('.score-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const val = e.target.dataset.score;
        if (e.target.classList.contains('s1')) {
            selectedScore1 = val;
            document.querySelectorAll('.s1').forEach(b => b.classList.remove('selected'));
        } else {
            selectedScore2 = val;
            document.querySelectorAll('.s2').forEach(b => b.classList.remove('selected'));
        }
        e.target.classList.add('selected');
        document.getElementById('selected-score-display').textContent = `Sélection : Fond [${selectedScore1 || '-'}] | Forme [${selectedScore2 || '-'}]`;
        checkValidationStatus();
    });
});

function checkValidationStatus() {
    document.getElementById('validate-button').disabled = !(selectedCandidateId && selectedScore1 && selectedScore2);
}

// D. ENVOI DES DONNÉES (SANS RELOAD)
document.getElementById('validate-button').addEventListener('click', () => {
    const name = CANDIDATES.find(c => c.id === selectedCandidateId).name;
    document.getElementById('modal-jury-name').textContent = currentJuryName;
    document.getElementById('modal-candidate-name').textContent = name;
    document.getElementById('modal-score1').textContent = selectedScore1;
    document.getElementById('modal-score2').textContent = selectedScore2;
    document.getElementById('confirmation-modal').style.display = 'flex';
});

document.getElementById('confirm-send-button').addEventListener('click', async () => {
    document.getElementById('confirmation-modal').style.display = 'none';
    let total = (selectedScore1 === "Elimine") ? 0 : (parseInt(selectedScore1) * 3) + parseInt(selectedScore2);

    try {
        await addDoc(collection(db, "scores"), {
            juryName: currentJuryName,
            candidateId: selectedCandidateId,
            score1: selectedScore1,
            score2: selectedScore2,
            totalWeightedScore: total,
            timestamp: new Date()
        });

        alert("Score enregistré !");

        // RESET INTERFACE SANS RECHARGER NI REDEMANDER LE NOM
        selectedScore1 = null;
        selectedScore2 = null;
        selectedCandidateId = null;
        document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('selected-score-display').textContent = `Sélection : Fond [-] | Forme [-]`;
        document.getElementById('selected-candidate-display').textContent = "Candidat : Aucun";
        document.getElementById('validate-button').disabled = true;
        
        loadCandidateList(); 

    } catch (e) {
        alert("Erreur d'envoi.");
    }
});

document.getElementById('cancel-send-button').addEventListener('click', () => {
    document.getElementById('confirmation-modal').style.display = 'none';
});