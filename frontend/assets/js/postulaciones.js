import { auth } from './firebase-config.js';
import { obtenerMisPostulaciones, obtenerPostulacionesParaMisTareas, obtenerUsuarioPorId } from './database.js';

// =====================================================
// JS de la página de Postulaciones
// Renderiza dos listas: trabajos donde te postulaste (izq)
// y usuarios que se han postulado para tus tareas (der)
// =====================================================

// Variables de estado
let misPostulaciones = [];
let postulantesParaMisTareas = [];
const ITEMS_PER_PAGE = 5;
let currentPage = 1;

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await loadAllData(user.uid);
        } else {
            window.location.href = '../index.html';
        }
    });

    setupPaginationEvents();
});

async function loadAllData(uid) {
    try {
        // 1. Trabajos donde ME HE POSTULADO (Izquierda)
        misPostulaciones = await obtenerMisPostulaciones(uid);
        renderTrabajos();

        // 2. Usuarios que SE HAN POSTULADO a mis tareas (Derecha)
        postulantesParaMisTareas = await obtenerPostulacionesParaMisTareas(uid);
        renderUsuarios();
    } catch (e) {
        console.error("Error cargando datos de postulaciones:", e);
    }
}

// Renderiza la lista paginada de trabajos donde el usuario se ha postulado
function renderTrabajos() {
    const container = document.getElementById('jobs-list');
    if (!container) return;
    container.innerHTML = '';

    const totalPages = Math.ceil(misPostulaciones.length / ITEMS_PER_PAGE) || 1;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const items = misPostulaciones.slice(start, end);

    if (items.length === 0) {
        container.innerHTML = "<p style='color: #888; text-align: center; padding: 20px;'>No te has postulado a ningún trabajo aún.</p>";
    }

    items.forEach(trabajo => {
        const post = trabajo.postulacion;
        const estadoClass = `status-${(post.estado_postulacion || 'pendiente').toLowerCase()}`;
        const estadoText = (post.estado_postulacion || 'Pendiente');
        const xp = trabajo.xp_otorgada || Math.round(trabajo.pago_cliente * 10);
        const img = trabajo.foto_trabajo || "../assets/img/trabajo-defecto.png";

        const card = document.createElement('article');
        card.className = 'job-card';
        card.onclick = () => { window.location.href = `trabajo.html?id=${trabajo.id}`; };

        card.innerHTML = `
            <img src="${img}" class="job-card-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
            <div class="job-card-info">
                <h3 class="job-card-title">${trabajo.titulo}</h3>
                <p class="job-card-desc">${trabajo.descripcion || ""}</p>
                <div class="job-card-meta">
                    <span><img src="../assets/img/icons/icono-ubicacion.png" alt=""> ${trabajo.direccion || "No especificada"}</span>
                    <span><img src="../assets/img/icons/icono-relog.png" alt=""> Tiempo estimado: ${trabajo.tiempo_estimado_horas}h</span>
                    <span><img src="../assets/img/icons/icono-xp.png" alt=""> Experiencia: <strong>${xp} XP</strong></span>
                </div>
                <div class="job-card-footer">
                    <span class="status-badge ${estadoClass}">${estadoText.toUpperCase()}</span>
                    <span class="job-card-pago"><img src="../assets/img/icons/icono-dinero.png" style="width:14px;height:14px;vertical-align:middle;margin-right:3px;" alt=""> Pago: <strong>${Number(trabajo.pago_cliente).toFixed(2)} €</strong></span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    document.getElementById('page-info').textContent = `${currentPage} - ${totalPages}`;
    document.getElementById('prev-page').style.opacity = currentPage === 1 ? '0.3' : '1';
    document.getElementById('next-page').style.opacity = currentPage === totalPages ? '0.3' : '1';
}

// Renderiza la lista de usuarios postulantes (sin paginación, scroll vertical)
async function renderUsuarios() {
    const container = document.getElementById('users-list');
    if (!container) return;
    container.innerHTML = '';

    if (postulantesParaMisTareas.length === 0) {
        container.innerHTML = "<p style='color: #888; text-align: center; padding: 20px;'>Nadie se ha postulado a tus tareas todavía.</p>";
        return;
    }

    for (const app of postulantesParaMisTareas) {
        const user = await obtenerUsuarioPorId(app.id_usuario);
        if (!user) continue;

        const avatar = user.foto_perfil || "../assets/img/avatar-defecto.png";

        const card = document.createElement('div');
        card.className = 'user-app-card';
        card.style.cursor = 'pointer';
        card.onclick = () => { window.location.href = `usuario.html?id=${user.uid}`; };

        card.innerHTML = `
            <img src="${avatar}" class="user-app-img" onerror="this.src='../assets/img/avatar-defecto.png'">
            <div class="user-app-info">
                <p class="user-app-name">${user.nombre}</p>
                <p class="user-app-task">Ha postulado para realizar tu tarea:<br>
                    <strong class="user-task-link" data-id="${app.id_trabajo}">${app.trabajo_titulo}</strong>
                </p>
            </div>
            <button class="user-chat-btn" title="Chatear con ${user.nombre}">
                <img src="../assets/img/icons/icono-chat-2.png" alt="Chat">
            </button>
        `;
        container.appendChild(card);

        // Click en el título de la tarea
        card.querySelector('.user-task-link').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `mi-tarea.html?id=${app.id_trabajo}`;
        });

        // Click en chat
        card.querySelector('.user-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `chat.html?id=${app.id_trabajo}`;
        });
    }
}

function setupPaginationEvents() {
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTrabajos();
            window.scrollTo(0, 0);
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(misPostulaciones.length / ITEMS_PER_PAGE) || 1;
        if (currentPage < totalPages) {
            currentPage++;
            renderTrabajos();
            window.scrollTo(0, 0);
        }
    });
}
