import { auth } from './firebase-config.js';
import { obtenerMisPostulaciones, obtenerPostulacionesParaMisTareas, obtenerUsuarioPorId, cancelarPostulacion, aceptarPostulacion, rechazarPostulacion, obtenerMetodosPago } from './database.js';

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

    // Mapa de categorías (igual que en mensajes.js/usuario.js)
    const catInfo = {
        'gastronomia': 'Gastronomía',
        'informatica': 'Informática',
        'limpieza': 'Limpieza',
        'mascotas': 'Mascotas',
        'carpinteria': 'Carpintería',
        'otros': 'Otros',
        'jardineria': 'Jardinería',
        'cuidado_personal': 'Cuidado Personal',
        'evento': 'Evento',
        'diseno': 'Diseño',
        'transporte': 'Transporte',
        'mudanza': 'Mudanza',
        'construccion': 'Construcción'
    };

    items.forEach(trabajo => {
        const post = trabajo.postulacion;
        const estadoRaw = (post.estado_postulacion || 'Pendiente');
        const estadoClass = `status-${estadoRaw.toLowerCase()}`;
        const estadoText = estadoRaw.toUpperCase();
        const xp = trabajo.xp_otorgada || Math.round(trabajo.pago_cliente * 10);
        const img = trabajo.foto_trabajo || "../assets/img/trabajo-defecto.png";
        const categoriaNom = catInfo[trabajo.id_categoria] || "General";

        // Logic for red dot notification
        // We store the last seen status in localStorage to know if it has changed
        const lastSeenStatusKey = `lastSeenStatus_${trabajo.id}`;
        const lastSeenStatus = localStorage.getItem(lastSeenStatusKey);
        const isUnread = lastSeenStatus && lastSeenStatus !== estadoRaw && estadoRaw !== 'Pendiente';

        const card = document.createElement('article');
        card.className = `job-card ${isUnread ? 'unread' : ''}`;

        card.onclick = () => {
            localStorage.setItem(lastSeenStatusKey, estadoRaw); // Mark as seen
            window.location.href = `trabajo.html?id=${trabajo.id}`;
        };

        // If it's the first time we see this job, we save the status but don't show the dot
        if (!lastSeenStatus) {
            localStorage.setItem(lastSeenStatusKey, estadoRaw);
        }

        card.innerHTML = `
            <div class="action-buttons">
                <button class="action-btn delete-btn" title="Cancelar Postulación" onclick="event.stopPropagation(); confirmarCancelarPostulacion('${trabajo.id}')">
                    <img src="../assets/img/icons/icono-eliminar.png" alt="Eliminar">
                </button>
            </div>
            <img src="${img}" class="job-card-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
            <div class="job-card-info">
                <div class="job-card-header">
                    <h3 class="job-card-title">${trabajo.titulo}</h3>
                    <span class="status-badge ${estadoClass}">${estadoText}</span>
                </div>
                <p class="job-card-desc">${trabajo.descripcion || ""}</p>
                <div class="job-card-meta">
                    <span><img src="../assets/img/icons/icono-ubicacion.png" alt=""> ${trabajo.direccion || "No especificada"}</span>
                    <span><img src="../assets/img/icons/icono-relog.png" alt=""> Tiempo estimado: ${trabajo.tiempo_estimado_horas}h</span>
                    <span><img src="../assets/img/icons/icono-categoria.png" alt=""> Categoría: ${categoriaNom}</span>
                    <span><img src="../assets/img/icons/icono-xp.png" alt=""> Experiencia: <strong>${xp} XP</strong></span>
                </div>
                <div class="job-card-footer">
                    <span class="job-card-pago"><img src="../assets/img/icons/icono-dinero.png" style="width:14px;height:14px;vertical-align:middle;margin-right:3px;" alt=""><strong>${Number(trabajo.pago_cliente).toFixed(2)} €</strong></span>
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
            <div class="user-app-actions">
                <button class="action-btn btn-accept-small" title="Aceptar Candidato">
                    <img src="../assets/img/icons/icono-si-blanco.png" alt="Aceptar">
                </button>
                <button class="action-btn btn-reject-small" title="Rechazar Candidato">
                    <img src="../assets/img/icons/icono-no-blanco.png" alt="Rechazar">
                </button>
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
            window.location.href = `chat.html?id=${app.id_trabajo}&userId=${user.uid}`;
        });

        // Click en Aceptar
        card.querySelector('.btn-accept-small').addEventListener('click', (e) => {
            e.stopPropagation();

            const modal = document.getElementById('modalAceptarTrabajador');
            const montoEl = document.getElementById('montoRetenerModal');
            const btnConfirm = document.getElementById('btnConfirmarAceptar');
            const btnCancel = document.getElementById('btnCancelAceptar');
            const selectMetodo = document.getElementById('selectMetodoAceptar');
            const noMethods = document.getElementById('noMethodsAceptar');

            if (!modal || !montoEl || !btnConfirm || !btnCancel || !selectMetodo || !noMethods) return;

            // Cargar datos
            montoEl.textContent = Number(app.pago_cliente || 0).toFixed(2);

            const userAuth = auth.currentUser;
            if (userAuth) {
                obtenerMetodosPago(userAuth.uid).then(metodos => {
                    selectMetodo.innerHTML = "";
                    if (metodos.length === 0) {
                        selectMetodo.style.display = 'none';
                        noMethods.classList.remove('hidden');
                        btnConfirm.disabled = true;
                        btnConfirm.style.opacity = '0.5';
                    } else {
                        selectMetodo.style.display = 'block';
                        noMethods.classList.add('hidden');
                        btnConfirm.disabled = false;
                        btnConfirm.style.opacity = '1';

                        metodos.forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m.id_metodo;
                            opt.textContent = `${m.tipo}: ${m.detalle}`;
                            selectMetodo.appendChild(opt);
                        });
                    }
                });
            }

            modal.classList.remove('hidden');

            btnCancel.onclick = () => modal.classList.add('hidden');
            btnConfirm.onclick = async () => {
                try {
                    btnConfirm.disabled = true;
                    btnConfirm.textContent = "Procesando...";
                    await aceptarPostulacion(app.id_trabajo, user.uid);
                    modal.classList.add('hidden');
                    showCustomAlert("¡Confirmado!", `${user.nombre} ha sido asignado al trabajo.`);
                    location.reload();
                } catch (err) {
                    console.error("Error aceptando postulación:", err);
                    showCustomAlert("Error", "No se pudo asignar al trabajador.");
                    btnConfirm.disabled = false;
                    btnConfirm.textContent = "Confirmar";
                }
            };
        });

        // Click en Rechazar
        card.querySelector('.btn-reject-small').addEventListener('click', (e) => {
            e.stopPropagation();
            showCustomConfirm("Rechazar Candidato", `¿Estás seguro de rechazar la solicitud de ${user.nombre} para "${app.trabajo_titulo}"?`, async () => {
                try {
                    await rechazarPostulacion(app.id_trabajo, user.uid);
                    card.remove();
                    if (container.children.length === 0) {
                        container.innerHTML = "<p style='color: #888; text-align: center; padding: 20px;'>Nadie se ha postulado a tus tareas todavía.</p>";
                    }
                } catch (err) {
                    console.error("Error rechazando postulación:", err);
                    showCustomAlert("Error", "No se pudo rechazar la postulación.");
                }
            });
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

// Cerrar modal al clicar fuera
window.onclick = (event) => {
    const modalAceptar = document.getElementById('modalAceptarTrabajador');
    if (event.target == modalAceptar) {
        modalAceptar.classList.add('hidden');
    }
};

window.confirmarCancelarPostulacion = function (jobId) {
    const user = auth.currentUser;
    if (!user) return;

    showCustomConfirm(
        "Cancelar Postulación",
        "¿Estás seguro de que quieres retirar tu postulación para este trabajo?",
        async () => {
            try {
                await cancelarPostulacion(jobId, user.uid);
                // Actualizar lista local y renderizar
                misPostulaciones = misPostulaciones.filter(p => p.id !== jobId);
                renderTrabajos();
                showCustomAlert("Éxito", "Postulación cancelada correctamente.");
            } catch (e) {
                console.error("Error al cancelar postulación:", e);
                showCustomAlert("Error", "No se pudo cancelar la postulación.");
            }
        },
        "Sí, retirar",
        "No, volver"
    );
};
