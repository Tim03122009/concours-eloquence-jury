import { db } from './firebase-init.js';
import { 
    collection, addDoc, query, where, getDocs, getDoc, doc 
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

async function updateCandidateSelect() {
    const docSnap = await getDoc(doc(db, "candidats", "liste_actuelle"));
    if (docSnap.exists()) CANDIDATES = docSnap.data().candidates;

    const q = query(collection(db, "scores"), where("juryName", "==", currentJuryName));
    const snap = await getDocs(q);
    const scoredIds = snap.docs.map(d => d.data().candidateId);

    const select = document.getElementById('candidate-select');
    select.innerHTML = '<option value="" disabled selected>-- Choisir un candidat --</option>';

    CANDIDATES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.id} - ${c.name}`;
        if (scoredIds.includes(c.id)) opt.disabled = true;
        select.appendChild(opt);
    });
}

document.getElementById('candidate-select').onchange = (e) => {
    selectedCandidateId = e.target.value;
    const c = CANDIDATES.find(x => x.id === selectedCandidateId);
    document.getElementById('selected-candidate-display').textContent = `Candidat : ${c.name}`;
    checkValidation();
};

function checkValidation() {
    document.getElementById('validate-button').disabled = !(selectedCandidateId && selectedScore1 && selectedScore2);
}

// --------------------------------------------------------------------------------
// GESTION MODALE ET ENVOI
// --------------------------------------------------------------------------------
document.getElementById('validate-button').onclick = () => {
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
    let pts = (selectedScore1 === 'Elimine' || selectedScore2 === 'Elimine') ? 0 : (parseInt(selectedScore1) * 3) + parseInt(selectedScore2);
    
    try {
        await addDoc(collection(db, "scores"), {
            juryName: currentJuryName,
            candidateId: selectedCandidateId,
            score1: selectedScore1,
            score2: selectedScore2,
            totalWeightedScore: pts,
            timestamp: new Date()
        });
        location.reload(); 
    } catch (e) { 
        alert("Erreur d'envoi : " + e.message); 
    }
};

checkSessionAndStart();