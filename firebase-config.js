// Importamos las funciones necesarias desde el CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYGWXxysDPmGHZ9S1-o-TWEurEyo8kehE",
  authDomain: "laburapp-1.firebaseapp.com",
  projectId: "laburapp-1",
  storageBucket: "laburapp-1.firebasestorage.app",
  messagingSenderId: "4014414490275",
  appId: "1:401441490275:web:608701bdd05507ad387f56"
};

// Inicializamos Firebase y la base de datos
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);