import { db } from './firebase-init.js';
import { collection, addDoc, query, where, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

let juryName = localStorage.getItem('currentJuryName') || '';
let storedSessionId = localStorage.getItem('sessionId') || '';
let selectedId = null;
let s1 = null; let s2 = null;
let candidates = [];

// --- VERIFICATION SESSION AU CHARGEMENT ---
async function checkSessionAndLoad() {
    try {
        const snap = await getDoc(doc(db, "config", "session"));
        const firebaseSessionId = snap.exists() ? snap.data().current_id : '1';

        // Si l'ID a changé dans Firebase (Reset Admin), on vide le nom local
        if (storedSessionId !== firebaseSessionId) {
            localStorage.clear();
            juryName = '';
            storedSessionId = firebaseSessionId;
            document.getElementById('identification-page').classList.add('active');
        } 
        else if (juryName) {
            showNotation();
        } 
        else {
            document.getElementById('identification-page').classList.add('active');
        }
    } catch (e) {
        document.getElementById('identification-page').classList.add('active');
    }
}

checkSessionAndLoad();

function showNotation() {
    document.getElementById('current-jury-name').textContent = juryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    loadData();
}

// Bouton d'entrée
document.getElementById('start-scoring-button').onclick = () => {
    const val = document.getElementById('jury-name-input').value.trim();
    if (val.length < 2) return;
    juryName = val;
    localStorage.setItem('currentJuryName', juryName);
    localStorage.setItem('sessionId', storedSessionId);
    showNotation();
};

async function loadData() {
    // Liste candidats
    const cSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (cSnap.exists()) candidates = cSnap.data().candidates;

    // Scores déjà mis
    const q = query(collection(db, "scores"), where("juryName", "==", juryName));
    const sSnap = await getDocs(q);
    const done = sSnap.docs.map(d => d.data().candidateId);

    const select = document.getElementById('candidate-select');
    select.innerHTML = '';
    candidates.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.id} - ${c.name}`;
        if (done.includes(c.id)) { opt.disabled = true; opt.style.color = "#ccc"; }
        select.appendChild(opt);
    });
}

// Sélection et Notes
document.getElementById('candidate-select').onchange = (e) => {
    selectedId = e.target.value;
    const c = candidates.find(x => x.id === selectedId);
    document.getElementById('selected-candidate-display').textContent = "Candidat : " + c.name;
    updateBtn();
};

document.querySelectorAll('.score-btn').forEach(btn => {
    btn.onclick = (e) => {
        const val = e.target.dataset.score;
        if (e.target.classList.contains('s1')) {
            s1 = val;
            document.querySelectorAll('.s1').forEach(b => b.classList.remove('selected'));
        } else {
            s2 = val;
            document.querySelectorAll('.s2').forEach(b => b.classList.remove('selected'));
        }
        e.target.classList.add('selected');
        document.getElementById('selected-score-display').textContent = `Fond [${s1 || '-'}] |