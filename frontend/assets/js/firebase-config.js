
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCma8TEKfSj_AVj5IkHnLcVaKu7bAavC5c",
  authDomain: "laburapp-schools.firebaseapp.com",
  projectId: "laburapp-schools",
  storageBucket: "laburapp-schools.firebasestorage.app",
  messagingSenderId: "611375650010",
  appId: "1:611375650010:web:e741a6afe6c079e573c1e3",
  measurementId: "G-275D8GJ5GP"
};

import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
