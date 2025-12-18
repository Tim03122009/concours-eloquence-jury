import { db } from './firebase-init.js';
import { 
    collection, addDoc, query, where, getDocs, getDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

let currentJuryName = '';
let selectedCandidateId = null;
let selectedScore1 = null; 
let selectedScore2 = null; 
let CANDIDATES = [];

function createGrids() {
    const gridFond = document.getElementById('grid-fond');
    const gridForme = document.getElementById('grid-forme');
    
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

    const btnElim = document.createElement('button');
    btnElim.className = 'score-btn score-btn-1 eliminated';
    btnElim.textContent = 'ÉLIMINER LE CANDIDAT';
    btnElim.onclick = () => selectScore(1, 'Elimine', btnElim);
    gridFond.appendChild(btnElim);
}

function selectScore(type, value, element) {
    if (type === 1) {
        selectedScore1 = value;
        document.querySelectorAll('.score-btn-1').forEach(b => b.classList.remove('selected'));
        document.getElementById('display-score-1').textContent = value;
    } else {
        selectedScore2 = value;
        document.querySelectorAll('.score-btn-2').forEach(b => b.classList.remove('selected'));
        document.getElementById('display-score-2').textContent = value;
    }
    element.classList.add('selected');
    checkValidation();
}

async function loadCandidatesFromFirebase() {
    const docRef = doc(db, "candidats", "liste_actuelle");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) { CANDIDATES = docSnap.data().candidates; }
}

async function updateCandidateSelect() {
    await loadCandidatesFromFirebase();
    const select = document.getElementById('candidate-select');
    select.innerHTML = '<option value="" disabled selected>Candidat...</option>';
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
    if (currentJuryName.length < 2) return;
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
    document.getElementById('validate-button').disabled = !(selectedCandidateId && selectedScore1 && selectedScore2);
}

document.getElementById('validate-button').addEventListener('click', () => {
    const name = CANDIDATES.find(c => c.id === selectedCandidateId).name;
    document.getElementById('modal-summary').innerHTML = `<b>${name}</b><br>Note 1: ${selectedScore1}<br>Note 2: ${selectedScore2}`;
    document.getElementById('confirmation-modal').style.display = 'flex';
});

document.getElementById('cancel-send-button').onclick = () => { document.getElementById('confirmation-modal').style.display = 'none'; };

document.getElementById('confirm-send-button').onclick = async () => {
    document.getElementById('confirmation-modal').style.display = 'none';
    let total = (selectedScore1 === 'Elimine') ? 0 : (parseInt(selectedScore1) * 3) + parseInt(selectedScore2);
    try {
        await addDoc(collection(db, "scores"), {
            juryName: currentJuryName,
            candidateId: selectedCandidateId,
            score1: selectedScore1,
            score2: selectedScore2,
            totalWeightedScore: total,
            timestamp: new Date()
        });
        alert("Enregistré");
        location.reload();
    } catch (e) { alert("Erreur"); }
};

createGrids();