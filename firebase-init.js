// firebase-init.js
// -------------------------------------------------------------------------
// Ces imports permettent de connecter ton site aux services Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";


// 1. CONFIGURATION FIREBASE (TES CLES)
const firebaseConfig = {
  apiKey: "AIzaSyClXMDuJIhQjDe5onEFeGToDByxhyeltltg", 
  authDomain: "concours-eloquence-2025.firebaseapp.com", 
  projectId: "concours-eloquence-2025", 
  storageBucket: "concours-eloquence-2025.appspot.com", 
  messagingSenderId: "596405991638", 
  appId: "1:596405991638:web:5b9ce4442cbde8ae6ff177" 
};

// 2. Initialisation de l'application Firebase
const app = initializeApp(firebaseConfig);

// 3. Obtention de la base de données (que le code principal va utiliser)
export const db = getFirestore(app);

// -------------------------------------------------------------------------
// 🔧 MODE DÉVELOPPEMENT - ÉMULATEUR FIREBASE
// -------------------------------------------------------------------------
// Décommenter les lignes ci-dessous pour utiliser l'émulateur local lors des tests:
// 
// const USE_EMULATOR = window.location.hostname === 'localhost' 
//                   || window.location.hostname === '127.0.0.1';
// 
// if (USE_EMULATOR) {
//   connectFirestoreEmulator(db, 'localhost', 8080);
//   console.log('🔥 MODE ÉMULATEUR ACTIVÉ - Base de données locale');
// } else {
//   console.log('☁️ MODE PRODUCTION - Base de données cloud');
// }
//
// ⚠️ IMPORTANT: Démarrer l'émulateur avant d'utiliser:
//     firebase emulators:start
//
// ℹ️ Pour plus d'infos, voir TESTING.md
