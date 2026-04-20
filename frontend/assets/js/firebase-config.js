
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYgWXxysDPmGHZ9S1-o-TWEurEyo8kehE",
  authDomain: "laburapp-1.firebaseapp.com",
  projectId: "laburapp-1",
  storageBucket: "laburapp-1.firebasestorage.app",
  messagingSenderId: "401441490275",
  appId: "1:401441490275:web:608701bdd05507ad387f56"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
