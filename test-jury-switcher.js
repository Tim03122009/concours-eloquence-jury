import { db } from './firebase-init.js';
import {
    collection,
    getDocs,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

const jurySelect = document.getElementById('test-jury-switcher');

let firebaseSessionId = '1';
let juries = []; // { id: string, name: string, theme: string }

function setSelectEnabled(enabled) {
    if (!jurySelect) return;
    jurySelect.disabled = !enabled;
}

function setSelectOptions(list, preselectedId = '') {
    if (!jurySelect) return;

    const currentValue = jurySelect.value;
    jurySelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = list.length ? '— Sélectionner un jury —' : '— Aucun jury trouvé —';
    placeholder.disabled = true;
    placeholder.selected = true;
    jurySelect.appendChild(placeholder);

    list.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j.id;
        opt.textContent = `${j.id} - ${j.name}`;
        jurySelect.appendChild(opt);
    });

    const chosen = preselectedId || currentValue;
    if (chosen && list.some(x => x.id === chosen)) {
        jurySelect.value = chosen;
    }
}

async function loadFirebaseSessionId() {
    const snap = await getDoc(doc(db, "config", "session"));
    if (snap.exists()) firebaseSessionId = snap.data().current_id || '1';
    else firebaseSessionId = '1';
}

async function loadJuries() {
    const accountsSnap = await getDocs(collection(db, "accounts"));
    juries = [];

    accountsSnap.forEach(docSnap => {
        const id = docSnap.id;
        // Les jurys ont l'ID sous la forme `juryN` (admin est stocké ailleurs).
        if (!/^jury\d+$/.test(id)) return;

        const data = docSnap.data() || {};
        juries.push({
            id,
            name: data.name || id,
            theme: data.theme || 'light'
        });
    });

    // Tri alphabétique (stabilité meilleure pour le repérage)
    juries.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function applyTestJuryAndReload(juryId) {
    const jury = juries.find(j => j.id === juryId);
    if (!jury) return;

    // Indispensable pour que script.js démarre directement l'interface.
    localStorage.setItem('currentJuryName', jury.id);
    localStorage.setItem('currentJuryDisplayName', jury.name);
    localStorage.setItem('sessionId', firebaseSessionId);
    localStorage.setItem(`theme_${jury.id}`, jury.theme);

    // Recharger : script.js réexécute checkSessionAndStart et lance startScoring.
    location.reload();
}

async function init() {
    if (!jurySelect) return;

    setSelectEnabled(false);
    jurySelect.innerHTML = '<option value="" selected>Chargement…</option>';

    try {
        await loadFirebaseSessionId();
        await loadJuries();

        const storedJuryId = localStorage.getItem('currentJuryName') || '';
        setSelectOptions(juries, storedJuryId);

        setSelectEnabled(true);

        // Pré-synchroniser le menu sélectionné si c'est déjà le même jury
        // (sans déclencher de reload automatiquement).
        if (storedJuryId && juries.some(x => x.id === storedJuryId)) {
            jurySelect.value = storedJuryId;
        }

        jurySelect.onchange = (e) => {
            const value = e.target.value;
            if (!value) return;
            applyTestJuryAndReload(value);
        };
    } catch (err) {
        console.error('test-jury-switcher:', err);
        setSelectOptions([], '');
        jurySelect.innerHTML = '<option value="" selected>Erreur de chargement des jurys</option>';
    }
}

document.addEventListener('DOMContentLoaded', init);

