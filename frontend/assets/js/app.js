import { db } from './firebase-config.js';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const listaMensajes = document.getElementById('contenedor-chat'); // El ID de tu div de mensajes
const formulario = document.getElementById('form-mensaje');        // El ID de tu <form>
const inputTexto = document.getElementById('input-chat');          // El ID de tu <input>

// --- A: ESCUCHAR MENSAJES ---
const q = query(collection(db, "mensajes"), orderBy("fecha", "asc"));

onSnapshot(q, (snapshot) => {
    if (listaMensajes) {
        listaMensajes.innerHTML = ''; // Limpiamos para no duplicar
        snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement('div');
            div.classList.add('burbuja-mensaje');
            div.textContent = data.texto;
            listaMensajes.appendChild(div);
        });
        // Scroll automático al último mensaje
        listaMensajes.scrollTop = listaMensajes.scrollHeight;
    }
});

// --- B: ENVIAR MENSAJES ---
if (formulario) {
    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = inputTexto.value.trim();

        if (texto !== "") {
            try {
                await addDoc(collection(db, "mensajes"), {
                    texto: texto,
                    fecha: serverTimestamp() // Usa la hora de Google, no la del PC
                });
                inputTexto.value = ''; // Limpiar el campo
            } catch (error) {
                console.error("Error al enviar:", error);
            }
        }
    });
}