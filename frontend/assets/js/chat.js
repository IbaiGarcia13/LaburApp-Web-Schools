import { db, auth } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { enviarMensajeTrabajo, obtenerTrabajoPorId, obtenerUsuarioPorId } from './database.js';

const listaMensajes = document.getElementById('messages');
const formulario = document.getElementById('chat-form');
const inputTexto = document.getElementById('message-input');
const otherAvatar = document.getElementById('otherAvatar');
const otherName = document.getElementById('otherName');
const jobTitle = document.getElementById('jobTitle');

// 1. Obtener ID del trabajo de la URL
const urlParams = new URLSearchParams(window.location.search);
const idTrabajo = urlParams.get('id');

if (!idTrabajo) {
    showCustomAlert("Error", "No se ha especificado un trabajo para el chat.");
    setTimeout(() => window.location.href = 'mensajes.html', 2000);
}

// 2. Cargar Info del Trabajo y del otro participante
async function loadChatMeta() {
    try {
        const trabajo = await obtenerTrabajoPorId(idTrabajo);
        if (!trabajo) return;

        jobTitle.textContent = `Trabajo: ${trabajo.titulo}`;

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const otherId = (user.uid === trabajo.id_publicador) ? trabajo.id_trabajador : trabajo.id_publicador;
                if (otherId) {
                    const otherUser = await obtenerUsuarioPorId(otherId);
                    if (otherUser) {
                        otherName.textContent = otherUser.nombre_completo || otherUser.nombre;
                        otherAvatar.src = otherUser.foto_perfil || "../assets/img/avatar-defecto.png";
                    }
                } else {
                    otherName.textContent = "Esperando trabajador...";
                }
            }
        });
    } catch (e) {
        console.error(e);
    }
}

loadChatMeta();

// --- A: ESCUCHAR MENSAJES DE ESTE TRABAJO ---
if (idTrabajo && listaMensajes) {
    const mensajesRef = collection(db, "trabajos", idTrabajo, "mensajes");
    const q = query(mensajesRef, orderBy("fecha_envio", "asc"));

    onSnapshot(q, (snapshot) => {
        listaMensajes.innerHTML = '';
        snapshot.forEach((msgDoc) => {
            const data = msgDoc.data();
            const div = document.createElement('div');
            div.classList.add('burbuja-mensaje');

            if (auth.currentUser && data.id_emisor === auth.currentUser.uid) {
                div.classList.add('mensaje-propio');
            } else {
                div.classList.add('mensaje-ajeno');
            }

            if (data.tipo_contenido === 'texto') {
                div.textContent = data.contenido;
            } else {
                div.textContent = "[Imagen Adjunta]";
            }

            listaMensajes.appendChild(div);
        });
        listaMensajes.scrollTop = listaMensajes.scrollHeight;
    });
}

// --- B: ENVIAR MENSAJE ---
if (formulario && idTrabajo) {
    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = inputTexto.value.trim();

        if (texto !== "") {
            try {
                await enviarMensajeTrabajo(idTrabajo, texto, "texto");
                inputTexto.value = '';
            } catch (error) {
                console.error("Error al enviar mensaje:", error);
                showCustomAlert("Error", "No pudimos enviar el mensaje. " + error.message);
            }
        }
    });
}
