import { auth } from './firebase-config.js';
import { obtenerConversacionesActivas, obtenerUsuarioPorId } from './database.js';

// =====================================================
// MENSAJES - Lista de conversaciones activas
// =====================================================

// Variables de estado
let allConversations = [];
const ITEMS_PER_PAGE = 5;
let currentPage = 1;

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await loadConversations(user.uid);
        } else {
            window.location.href = '../index.html';
        }
    });

    setupPaginationEvents();
});

async function loadConversations(uid) {
    try {
        allConversations = await obtenerConversacionesActivas(uid);
        renderMensajes();
    } catch (e) {
        console.error("Error cargando conversaciones:", e);
    }
}

// Renderiza las tarjetas de conversación
async function renderMensajes() {
    const container = document.getElementById('msgs-list');
    if (!container) return;
    container.innerHTML = '';

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const items = allConversations.slice(start, end);

    if (items.length === 0) {
        container.innerHTML = "<p style='color: white; text-align: center; padding: 20px; font-style: italic;'>No tienes chats activos aún.</p>";
        updatePaginationUI(0);
        return;
    }

    const currentUser = auth.currentUser;

    for (const job of items) {
        // El "otro" usuario es el publicador si yo soy el trabajador, o viceversa
        const otherId = (currentUser.uid === job.id_publicador) ? job.id_trabajador : job.id_publicador;
        const otherUser = await obtenerUsuarioPorId(otherId);

        if (!otherUser) continue;

        const avatar = otherUser.foto_perfil || "../assets/img/avatar-defecto.png";
        const nombre = otherUser.nombre_completo || "Usuario Desconocido";

        const card = document.createElement('div');
        card.className = 'msg-card';
        card.onclick = () => { window.location.href = `usuario.html?id=${otherId}`; };

        card.innerHTML = `
            <img src="${avatar}" class="msg-avatar" alt="${nombre}" onerror="this.src='../assets/img/avatar-defecto.png'">
            <div class="msg-info">
                <p class="msg-name">${nombre}</p>
                <p class="msg-label">Trabajo:</p>
                <button class="msg-job-link" data-id="${job.id}">${job.titulo}</button>
            </div>
            <button class="msg-chat-btn" title="Abrir chat con ${nombre}">
                <img src="../assets/img/icons/icono-chat-2.png" alt="Chat">
            </button>
        `;
        container.appendChild(card);

        // Nombre del trabajo → trabajo.html (sin propagar al card)
        card.querySelector('.msg-job-link').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `trabajo.html?id=${job.id}`;
        });

        // Botón chat → chat.html
        card.querySelector('.msg-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `chat.html?id=${job.id}`;
        });
    }

    updatePaginationUI(allConversations.length);
}

function updatePaginationUI(total) {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
    document.getElementById('page-info').textContent = `${currentPage} - ${totalPages}`;
    document.getElementById('prev-page').style.opacity = currentPage === 1 ? '0.3' : '1';
    document.getElementById('next-page').style.opacity = currentPage === totalPages ? '0.3' : '1';
}

function setupPaginationEvents() {
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderMensajes();
            window.scrollTo(0, 0);
        }
    });
    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(allConversations.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            renderMensajes();
            window.scrollTo(0, 0);
        }
    });
}
