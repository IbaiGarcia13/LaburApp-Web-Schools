import { db } from './firebase-config.js';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');

// 1. ESCUCHAR MENSAJES (Tiempo Real)
const q = query(collection(db, "mensajes"), orderBy("fecha", "asc"));

onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = ''; // Limpiamos para no duplicar
    snapshot.forEach((doc) => {
        const data = doc.data();
        const p = document.createElement('p');
        p.textContent = `${data.texto}`;
        messagesContainer.appendChild(p);
    });
});

// 2. ENVIAR MENSAJES
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = messageInput.value;

    try {
        await addDoc(collection(db, "mensajes"), {
            texto: texto,
            fecha: serverTimestamp()
        });
        messageInput.value = ''; // Limpiar input
    } catch (error) {
        console.error("Error al enviar:", error);
    }
});

import { db } from './firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// PRUEBA DE FUEGO: Guardar un mensaje automático al cargar
async function testFirestore() {
    try {
        await addDoc(collection(db, "mensajes"), {
            texto: "¡Hola desde la web!",
            fecha: new Date()
        });
        console.log("✅ ¡Conexión con Firestore lograda!");
    } catch (e) {
        console.error("❌ Error de conexión: ", e);
    }
}

testFirestore();