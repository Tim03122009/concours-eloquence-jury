// script.js

// Importation de l'objet de base de données depuis notre fichier d'initialisation
import { db } from './firebase-init.js';

// Fonctions Firebase pour interagir avec la base de données
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs,
    // NOUVEAUX IMPORTS : pour charger la liste des candidats depuis Firebase
    getDoc, 
    doc
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// --- VARIABLES GLOBALES ---
let currentJuryName = '';
let selectedCandidateId = null;
let selectedScore = null;
let scoredCandidates = []; // IDs des candidats déjà notés par ce jury

// NOUVEAU : La liste des candidats est maintenant une variable modifiable (let)
let CANDIDATES = [];


// --------------------------------------------------------------------------------
// NOUVEAU : GESTION DU CHARGEMENT DE LA LISTE DEPUIS FIREBASE
// --------------------------------------------------------------------------------

async function loadCandidatesFromFirebase() {
    try {
        const docRef = doc(db, "candidats", "liste_actuelle");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().candidates) {
            CANDIDATES = docSnap.data().candidates;
            // On s'assure que la liste est un tableau
            if (!Array.isArray(CANDIDATES)) {
                CANDIDATES = [];
            }
        } else {
            console.warn("Aucune liste de candidats trouvée dans Firebase. Les jurys ne pourront pas noter tant qu'elle n'est pas sauvegardée via admin.html.");
            alert("Erreur critique: La liste des candidats n'a pas été définie par l'administrateur.");
        }
    } catch (error) {
        console.error("Erreur de chargement des candidats depuis Firebase:", error);
        alert("Erreur de connexion à la base de données pour charger les candidats.");
    }
}


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

    // NOUVEAU : Charger la liste AVANT de charger l'interface
    loadCandidateList();
});

// Vérification au chargement si le jury est déjà identifié
const storedJuryName = localStorage.getItem('currentJuryName');
if (storedJuryName) {
    currentJuryName = storedJuryName;
    document.getElementById('current-jury-name').textContent = currentJuryName;
    document.getElementById('identification-page').classList.remove('active');
    document.getElementById('scoring-page').classList.add('active');
    
    // NOUVEAU : Charger la liste AVANT de charger l'interface
    loadCandidateList();
}


// --------------------------------------------------------------------------------
// B. GESTION DE LA LISTE DES CANDIDATS (Chargement et Sélection)
// --------------------------------------------------------------------------------

async function loadCandidateList() {
    // 1. NOUVEAU : Récupérer la liste des candidats depuis Firebase (si ce n'est pas déjà fait)
    if (CANDIDATES.length === 0) {
        await loadCandidatesFromFirebase();
    }
    
    if (CANDIDATES.length === 0) {
        // Afficher un message si la liste est toujours vide après l'appel à Firebase
        document.getElementById('selected-candidate-display').textContent = 'Liste des candidats indisponible. Veuillez contacter l\'administrateur.';
        return;
    }

    // 2. Récupérer les candidats déjà notés par CE JURY dans Firebase
    const scoresRef = collection(db, "scores");
    const q = query(scoresRef, where("juryName", "==", currentJuryName));
    const querySnapshot = await getDocs(q);

    // Mettre à jour la liste des IDs déjà notés
    scoredCandidates = querySnapshot.docs.map(doc => doc.data().candidateId);

    // 3. Remplir et mettre à jour l'affichage
    const selectElement = document.getElementById('candidate-select');
    selectElement.innerHTML = '<option value="" disabled selected>-- Sélectionnez un candidat --</option>'; 

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
    // On doit chercher dans la variable globale CANDIDATES
    const candidate = CANDIDATES.find(c => c.id === selectedCandidateId);
    
    // Vérification de sécurité au cas où un ID non trouvé serait sélectionné
    if (candidate) {
        document.getElementById('selected-candidate-display').textContent = `Candidat sélectionné : ${candidate.name}`;
    } else {
        document.getElementById('selected-candidate-display').textContent = `Candidat sélectionné : (ID Inconnu)`;
    }
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
    const candidate = CANDIDATES.find(c => c.id === selectedCandidateId);
    
    // Si la liste n'a pas chargé ou si le candidat n'existe pas (sécurité)
    if (!candidate) {
        alert("Erreur de sélection du candidat. Veuillez contacter l'administrateur.");
        return;
    }

    // Remplir le pop-up
    document.getElementById('modal-jury-name').textContent = currentJuryName;
    document.getElementById('modal-candidate-name').textContent = candidate.name;
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
        
        // Recharger la liste pour désactiver le candidat noté
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