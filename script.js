import { db } from './firebase-init.js';
import { collection, addDoc, query, where, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

let currentJuryName = localStorage.getItem('currentJuryName') || '';
let selectedCandidateId = null;
let selectedScore1 = null;
let selectedScore2 = null;
let CANDIDATES = [];

// PERSISTANCE : Charger directement si le nom existe
if (currentJuryName) {
    document.addEventListener('DOMContentLoaded', () => {
        showScoringPage();
    });
}

function showScoringPage() {
    document.getElementById('current-jury-name').textContent = currentJuryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    loadCandidateList();
}

document.getElementById('start-scoring-button').addEventListener('click', () => {
    const name = document.getElementById('jury-name-input').value.trim();
    if (name.length < 3) return;
    currentJuryName = name;
    localStorage.setItem('currentJuryName', name);
    showScoringPage();
});

async function loadCandidateList() {
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) { CANDIDATES = docSnap.data().candidates; }

    const q = query(collection(db, "scores"), where("juryName", "==", currentJuryName));
    const snap = await getDocs(q);
    const scoredIds = snap.docs.map(d => d.data().candidateId);

    const select = document.getElementById('candidate-select');
    select.innerHTML = '';
    CANDIDATES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.id} - ${c.name}`;
        if (scoredIds.includes(c.id)) { opt.classList.add('scored'); opt.disabled = true; }
        select.appendChild(opt);
    });
}

document.getElementById('candidate-select').addEventListener('change', (e) => {
    selectedCandidateId = e.target.value;
    const name = CANDIDATES.find(c => c.id === selectedCandidateId).name;
    document.getElementById('selected-candidate-display').textContent = `Candidat : ${name}`;
    checkValidation();
});

document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
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
        checkValidation();
    });
});

function checkValidation() {
    document.getElementById('validate-button').disabled = !(selectedCandidateId && selectedScore1 && selectedScore2);
}

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
        alert("Enregistré !");
        // Reset sans reload pour garder le nom du jury
        selectedScore1 = null; selectedScore2 = null; selectedCandidateId = null;
        document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('selected-score-display').textContent = "Sélection : Fond [-] | Forme [-]";
        document.getElementById('selected-candidate-display').textContent = "Candidat : Aucun";
        loadCandidateList();
    } catch (e) { alert("Erreur d'envoi."); }
});

document.getElementById('cancel-send-button').onclick = () => { document.getElementById('confirmation-modal').style.display = 'none'; };