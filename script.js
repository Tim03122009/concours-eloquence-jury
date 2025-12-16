// script.js

// Importation de l'objet de base de données depuis notre fichier d'initialisation
import { db } from './firebase-init.js';

// Fonctions Firebase pour interagir avec la base de données
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// --- VARIABLES GLOBALES ---
let currentJuryName = '';
let selectedCandidateId = null;
let selectedScore = null;
let scoredCandidates = []; // IDs des candidats déjà notés par ce jury

// Liste des 35 candidats
const CANDIDATES = Array.from({length: 35}, (_, i) => ({
    id: `C${i + 1}`,
    name: `Candidat ${i + 1}` 
}));


// --------------------------------------------------------------------------------
// A. GESTION DE L'IDENTIFICATION (Page 1)
// --------------------------------------------------------------------------------

document.getElementById('start-scoring-button').addEventListener('click', () => {
    const input = document.getElementById('jury-name-input');
    currentJuryName = input.value.trim();

    if (currentJuryName.length < 3) {
        document.getElementById('error-message').textContent = 'Veuillez entrer un nom de jury valide.';
        return;
    }

    // Stockage local pour garder le nom du jury après envoi de score
    localStorage.setItem('currentJuryName', currentJuryName);
    
    // Bascule vers la page de notation
    document.getElementById('current-jury-name').textContent = currentJuryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');

    loadCandidateList();
});

// Vérification au chargement si le jury est déjà identifié
const storedJuryName = localStorage.getItem('currentJuryName');
if (storedJuryName) {
    currentJuryName = storedJuryName;
    document.getElementById('current-jury-name').textContent = currentJuryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    loadCandidateList();
}


// --------------------------------------------------------------------------------
// B. GESTION DE LA LISTE DES CANDIDATS (Chargement et Sélection)
// --------------------------------------------------------------------------------

async function loadCandidateList() {
    // 1. Récupérer les candidats déjà notés par CE JURY dans Firebase
    const scoresRef = collection(db, "scores");
    const q = query(scoresRef, where("juryName", "==", currentJuryName));
    const querySnapshot = await getDocs(q);

    // Mettre à jour la liste des IDs déjà notés
    scoredCandidates = querySnapshot.docs.map(doc => doc.data().candidateId);

    // 2. Remplir et mettre à jour l'affichage
    const selectElement = document.getElementById('candidate-select');
    selectElement.innerHTML = ''; 

    CANDIDATES.forEach(candidate => {
        const option = document.createElement('option');
        option.value = candidate.id;
        option.textContent = `${candidate.id} - ${candidate.name}`;
        
        // Désactiver et griser les candidats déjà notés
        if (scoredCandidates.includes(candidate.id)) {
            option.classList.add('scored');
            option.disabled = true;
        }

        selectElement.appendChild(option);
    });
}

// Écouteur pour la sélection d'un candidat
document.getElementById('candidate-select').addEventListener('change', (e) => {
    selectedCandidateId = e.target.value;
    const candidateName = CANDIDATES.find(c => c.id === selectedCandidateId).name;
    document.getElementById('selected-candidate-display').textContent = `Candidat sélectionné : ${candidateName}`;
    checkValidationStatus();
});


// --------------------------------------------------------------------------------
// C. GESTION DE LA SÉLECTION DU SCORE
// --------------------------------------------------------------------------------

document.querySelectorAll('.score-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        // Gérer le style 'selected'
        document.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('selected'));
        e.target.classList.add('selected');
        
        selectedScore = e.target.dataset.score;
        document.getElementById('selected-score-display').textContent = `Note sélectionnée : ${selectedScore}`;
        
        checkValidationStatus();
    });
});


// --------------------------------------------------------------------------------
// D. GESTION DU BOUTON VALIDER ET POP-UP
// --------------------------------------------------------------------------------

function checkValidationStatus() {
    const validateButton = document.getElementById('validate-button');
    // Le bouton est actif si un candidat ET un score sont choisis
    validateButton.disabled = !(selectedCandidateId && selectedScore);
}

document.getElementById('validate-button').addEventListener('click', () => {
    const candidateName = CANDIDATES.find(c => c.id === selectedCandidateId).name;
    
    // Remplir le pop-up
    document.getElementById('modal-jury-name').textContent = currentJuryName;
    document.getElementById('modal-candidate-name').textContent = candidateName;
    document.getElementById('modal-score').textContent = selectedScore;
    
    // Afficher le pop-up
    document.getElementById('confirmation-modal').style.display = 'flex';
});

document.getElementById('cancel-send-button').addEventListener('click', () => {
    document.getElementById('confirmation-modal').style.display = 'none';
});


// --------------------------------------------------------------------------------
// E. ENREGISTREMENT DANS FIREBASE (Confirmation Finale)
// --------------------------------------------------------------------------------

document.getElementById('confirm-send-button').addEventListener('click', async () => {
    const modal = document.getElementById('confirmation-modal');
    modal.style.display = 'none';

    try {
        // Envoi des données à Firestore
        await addDoc(collection(db, "scores"), {
            juryName: currentJuryName,
            candidateId: selectedCandidateId,
            score: selectedScore,
            timestamp: new Date()
        });

        alert(`Score de ${selectedScore} pour ${selectedCandidateId} enregistré avec succès !`);

        // --- Réinitialisation de l'interface ---
        
        loadCandidateList();

        selectedCandidateId = null;
        selectedScore = null;
        
        document.querySelectorAll('.score-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById('selected-score-display').textContent = 'Note sélectionnée : Aucune';
        document.getElementById('candidate-select').value = "";
        document.getElementById('selected-candidate-display').textContent = 'Candidat sélectionné : Aucun';
        checkValidationStatus();
        
    } catch (e) {
        console.error("Erreur lors de l'ajout du document : ", e);
        alert("Erreur lors de l'enregistrement du score. Veuillez réessayer.");
    }
});