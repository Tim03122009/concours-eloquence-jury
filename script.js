import { db } from './firebase-init.js';
import { 
    collection, addDoc, query, where, getDocs, getDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

let currentJuryName = '';
let selectedCandidateId = null;
let selectedScore1 = null;
let selectedScore2 = null;
let CANDIDATES = [];

// A. IDENTIFICATION
document.getElementById('start-scoring-button').addEventListener('click', () => {
    const input = document.getElementById('jury-name-input');
    currentJuryName = input.value.trim();
    if (currentJuryName.length < 3) return;

    localStorage.setItem('currentJuryName', currentJuryName);
    document.getElementById('current-jury-name').textContent = currentJuryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    loadCandidateList();
});

// B. CHARGEMENT CANDIDATS (Depuis Firestore)
async function loadCandidateList() {
    // On récupère la liste depuis le document de l'admin
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) {
        CANDIDATES = docSnap.data().candidates;
    }

    const scoresRef = collection(db, "scores");
    const q = query(scoresRef, where("juryName", "==", currentJuryName));
    const querySnapshot = await getDocs(q);
    const scoredIds = querySnapshot.docs.map(doc => doc.data().candidateId);

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

// C. GESTION DES SCORES (Deux groupes)
document.querySelectorAll('.score-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const value = e.target.dataset.score;
        
        if (e.target.classList.contains('s1')) {
            selectedScore1 = value;
            document.querySelectorAll('.s1').forEach(btn => btn.classList.remove('selected'));
        } else {
            selectedScore2 = value;
            document.querySelectorAll('.s2').forEach(btn => btn.classList.remove('selected'));
        }
        
        e.target.classList.add('selected');
        document.getElementById('selected-score-display').textContent = `Sélection : Fond [${selectedScore1 || '-'}] | Forme [${selectedScore2 || '-'}]`;
        checkValidationStatus();
    });
});

function checkValidationStatus() {
    const btn = document.getElementById('validate-button');
    btn.disabled = !(selectedCandidateId && selectedScore1 && selectedScore2);
}

// D. VALIDATION ET ENVOI
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
    
    // Calcul score pondéré
    let total = 0;
    if (selectedScore1 !== "Elimine") {
        total = (parseInt(selectedScore1) * 3) + parseInt(selectedScore2);
    }

    try {
        await addDoc(collection(db, "scores"), {
            juryName: currentJuryName,
            candidateId: selectedCandidateId,
            score1: selectedScore1,
            score2: selectedScore2,
            totalWeightedScore: total,
            timestamp: new Date()
        });
        alert("Enregistré avec succès !");
        location.reload(); // Reset complet pour le candidat suivant
    } catch (e) {
        alert("Erreur lors de l'envoi.");
    }
});

document.getElementById('cancel-send-button').addEventListener('click', () => {
    document.getElementById('confirmation-modal').style.display = 'none';
});