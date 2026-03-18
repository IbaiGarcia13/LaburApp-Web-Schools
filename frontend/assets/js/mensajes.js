import { db, auth } from './firebase-config.js';
import { collection, query, where, limit, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    obtenerTodasLasConversaciones,
    obtenerUsuarioPorId,
    obtenerPerfilUsuario,
    obtenerTodosPuntosCategorias,
    obtenerTrabajoPorId,
    generarIdChat,
    eliminarReferenciaConversacion
} from './database.js';

// =====================================================
// MENSAJES - Lista de conversaciones activas
// =====================================================

const ITEMS_PER_PAGE = 6;
let currentPage = 1;
let allConversations = [];   // Lista normalizada de todas las convs
let filteredConversations = []; // Lista filtrada a mostrar

// Mapa de categorías (igual que usuario.js)
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

// =====================================================
// HELPERS: unread & ultimo mensaje
// =====================================================

async function getUltimoMensaje(mensajesRef) {
    try {
        const q = query(mensajesRef, orderBy("fecha_envio", "desc"), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data();
    } catch (_) {
        return null;
    }
}

async function tieneNoLeidos(mensajesRef, myUid) {
    try {
        const q = query(
            mensajesRef,
            where("leido", "==", false),
            where("id_receptor", "==", myUid),
            limit(1)
        );
        const snap = await getDocs(q);
        return !snap.empty;
    } catch (_) {
        return false;
    }
}

function getEspecialidadPrincipal(ptsCat) {
    if (!ptsCat || ptsCat.length === 0) return null;
    let best = null;
    let maxPts = 0;
    ptsCat.forEach(c => {
        if (c.puntos > maxPts) {
            maxPts = c.puntos;
            best = c.id_categoria;
        }
    });
    return best ? (catInfo[best] || best) : null;
}

// =====================================================
// CARGA DE CONVERSACIONES
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    let unreadListener = null;

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("Usuario autenticado en mensajes:", user.uid);
            await initFechas(user.uid);
            await loadAllConversations(user.uid);

            // Evitar duplicar listeners si el estado de auth cambia sin recargar
            if (unreadListener) unreadListener();

            try {
                const { onSnapshot, collection } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                unreadListener = onSnapshot(collection(db, "usuarios", user.uid, "conversaciones"), () => {
                    console.log("Cambio en conversaciones detectado (Real-time update)...");
                    loadAllConversations(user.uid);
                });
            } catch (e) {
                console.error("No se pudo cargar el listener en tiempo real:", e);
            }
        } else {
            if (unreadListener) unreadListener();
            window.location.href = '../index.html';
        }
    });

    setupPaginationEvents();
    setupFilterEvents();
});

/**
 * Sets default date range: fecha_ingreso del usuario → hoy
 */
async function initFechas(uid) {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    document.getElementById('filter-fecha-hasta').value = hoyStr;

    try {
        const perfil = await obtenerPerfilUsuario(uid);
        if (perfil && perfil.fecha_ingreso) {
            let fi = perfil.fecha_ingreso;
            let desdeStr;

            // Puede ser Timestamp de Firestore o string "DD-MM-YYYY"
            if (fi && typeof fi.toDate === 'function') {
                desdeStr = fi.toDate().toISOString().split('T')[0];
            } else if (typeof fi === 'string' && fi.includes('-')) {
                // formato "DD-MM-YYYY" (registros antiguos)
                const parts = fi.split('-');
                if (parts[0].length === 2) {
                    // DD-MM-YYYY → YYYY-MM-DD
                    desdeStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else {
                    desdeStr = fi;
                }
            } else {
                desdeStr = '2024-01-01';
            }
            document.getElementById('filter-fecha-desde').value = desdeStr;
        } else {
            document.getElementById('filter-fecha-desde').value = '2024-01-01';
        }
    } catch (_) {
        document.getElementById('filter-fecha-desde').value = '2024-01-01';
    }
}

async function loadAllConversations(uid) {
    console.log("Cargando todas las conversaciones para:", uid);
    const container = document.getElementById('msgs-list');
    if (container && container.innerHTML === '') {
        container.innerHTML = '<p class="msgs-empty">Cargando conversaciones…</p>';
    }

    try {
        const convsActivas = await obtenerTodasLasConversaciones(uid);
        allConversations = [];

        for (const meta of convsActivas) {
            try {
                const { id_chat, id_otro_usuario, id_trabajo, tipo } = meta;
                const mensajesRef = collection(db, "chats", id_chat, "mensajes");

                const [ultimoMsg, noLeidos, otherUser, ptsCat] = await Promise.all([
                    getUltimoMensaje(mensajesRef),
                    tieneNoLeidos(mensajesRef, uid),
                    obtenerUsuarioPorId(id_otro_usuario),
                    obtenerTodosPuntosCategorias(id_otro_usuario)
                ]);

                // Si no hay mensajes en absoluto, omitir de la lista principal
                if (!ultimoMsg) continue;

                let job = null;
                let jobUrl = null;

                if (tipo === 'trabajo' && id_trabajo) {
                    job = await obtenerTrabajoPorId(id_trabajo);
                    if (job) {
                        // 1. Trabajador -> mi-trabajo.html
                        if (job.id_trabajador === uid) {
                            jobUrl = `mi-trabajo.html?id=${id_trabajo}`;
                        }
                        // 2. Publicador -> mi-tarea.html
                        else if (job.id_publicador === uid) {
                            jobUrl = `mi-tarea.html?id=${id_trabajo}`;
                        }
                        // 3. Otro -> trabajo.html
                        else {
                            jobUrl = `trabajo.html?id=${id_trabajo}`;
                        }
                    }
                }

                allConversations.push({
                    tipo,
                    otherId: id_otro_usuario,
                    otherUser,
                    ptsCat,
                    job,
                    ultimoMsg,
                    noLeidos,
                    chatUrl: (tipo === 'trabajo' && id_trabajo)
                        ? `chat.html?id=${id_trabajo}&userId=${id_otro_usuario}`
                        : `chat.html?userId=${id_otro_usuario}`,
                    jobUrl,
                    idChat: id_chat
                });
            } catch (err) {
                console.warn(`Error procesando conversación ${meta.id_chat}:`, err);
            }
        }

        // Ordenar por fecha del último mensaje (más reciente primero)
        allConversations.sort((a, b) => {
            const ta = (a.ultimoMsg?.fecha_envio?.toDate ? a.ultimoMsg.fecha_envio.toDate() : (a.ultimoMsg?.fecha_envio ? new Date(a.ultimoMsg.fecha_envio) : new Date(0)));
            const tb = (b.ultimoMsg?.fecha_envio?.toDate ? b.ultimoMsg.fecha_envio.toDate() : (b.ultimoMsg?.fecha_envio ? new Date(b.ultimoMsg.fecha_envio) : new Date(0)));
            return tb - ta;
        });

        console.log(`Total conversaciones procesadas: ${allConversations.length}`);
        applyFilters();
    } catch (e) {
        console.error("Error CRÍTICO en loadAllConversations:", e);
        if (container) container.innerHTML = '<p class="msgs-empty">Error al cargar los chats.</p>';
    }
}

// =====================================================
// FILTROS
// =====================================================

function setupFilterEvents() {
    document.getElementById('update-btn').addEventListener('click', () => {
        currentPage = 1;
        applyFilters();
    });

    // Allow pressing Enter in the form to trigger the filter
    document.getElementById('filter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        currentPage = 1;
        applyFilters();
    });
}

function applyFilters() {
    const estadoVal = document.getElementById('filter-leido').value;
    const trabajoVal = document.getElementById('filter-trabajo').value;
    const desdeVal = document.getElementById('filter-fecha-desde').value;
    const hastaVal = document.getElementById('filter-fecha-hasta').value;

    const desde = desdeVal ? new Date(desdeVal) : null;
    const hasta = hastaVal ? new Date(hastaVal + 'T23:59:59') : null;

    filteredConversations = allConversations.filter(conv => {
        // Filtro estado de lectura
        if (estadoVal === 'leidos' && conv.noLeidos) return false;
        if (estadoVal === 'no-leidos' && !conv.noLeidos) return false;

        // Filtro de tipo de chat
        if (trabajoVal === 'trabajo' && conv.tipo !== 'trabajo') return false;
        if (trabajoVal === 'directo' && conv.tipo !== 'directo') return false;

        // Filtro de fecha por último mensaje
        if (conv.ultimoMsg?.fecha_envio) {
            const fecha = conv.ultimoMsg.fecha_envio.toDate
                ? conv.ultimoMsg.fecha_envio.toDate()
                : new Date(conv.ultimoMsg.fecha_envio);
            if (desde && fecha < desde) return false;
            if (hasta && fecha > hasta) return false;
        }

        return true;
    });

    renderMensajes();
}

// =====================================================
// RENDER
// =====================================================

function renderMensajes() {
    const container = document.getElementById('msgs-list');
    if (!container) return;

    // Limpiar todo
    container.innerHTML = '';

    if (filteredConversations.length === 0) {
        container.innerHTML = `<p class="msgs-empty">No hay conversaciones disponibles.</p>`;
        updatePaginationUI(0);
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const items = filteredConversations.slice(start, start + ITEMS_PER_PAGE);

    for (const conv of items) {
        const { otherUser, ptsCat, job, noLeidos, chatUrl, jobUrl, tipo } = conv;

        const avatar = otherUser?.foto_perfil || "../assets/img/avatar-defecto.png";
        const nombre = otherUser?.nombre_completo || otherUser?.nombre || "Usuario Desconocido";
        const nivel = otherUser?.nivel || 1;
        const valoracion = otherUser?.valoracion_media !== undefined ? Number(otherUser.valoracion_media).toFixed(1) : '2.5';
        const especialidad = getEspecialidadPrincipal(ptsCat) || "General";
        const ubicacion = otherUser?.direccion_principal || "No especificada";

        const card = document.createElement('article');
        card.className = `msg-card ${tipo}-card ${noLeidos ? 'unread' : ''}`;

        let labelHTML = '';
        if (tipo === 'trabajo' && job) {
            labelHTML = `
                <div class="msg-task-context">
                    <p class="msg-label">Trabajo: <button class="msg-job-link" data-job-url="${jobUrl}">${job.titulo || 'Sin título'}</button></p>
                </div>
            `;
        } else {
            labelHTML = `
                <div class="msg-task-context">
                    <p class="msg-label">Chat Directo</p>
                </div>
            `;
        }

        card.innerHTML = `
            <img src="${avatar}" class="msg-avatar" alt="${nombre}" onerror="this.src='../assets/img/avatar-defecto.png'">
            <div class="msg-info">
                <h3 class="msg-name">${nombre}</h3>
                ${labelHTML}
                <div class="msg-stats">
                    <p><img src="../assets/img/icons/icono-ubicacion.png" alt=""> ${ubicacion}</p>
                    <p><img src="../assets/img/icons/icono-nivel.png" alt=""> Nivel: ${nivel}</p>
                    <p><img src="../assets/img/icons/icono-estrella.png" alt=""> Valoración: ${valoracion}</p>
                    <p><img src="../assets/img/icons/icono-categoria.png" alt=""> Especialidad: ${especialidad}</p>
                </div>
            </div>
            <button class="msg-chat-btn" title="Abrir chat con ${nombre}">
                <img src="../assets/img/icons/icono-chat-2.png" alt="Chat">
            </button>
            <button class="msg-hide-btn" title="Ocultar conversación">
                <img src="../assets/img/icons/icono-ojo-no.png" alt="Ocultar">
            </button>
        `;

        // Clic en la tarjeta → Ir al chat
        card.addEventListener('click', () => {
            window.location.href = chatUrl;
        });

        const avatarEl = card.querySelector('.msg-avatar');
        const nameEl = card.querySelector('.msg-name');

        const goToProfile = (e) => {
            e.stopPropagation();
            window.location.href = `usuario.html?id=${conv.otherId}`;
        };

        if (avatarEl) avatarEl.addEventListener('click', goToProfile);
        if (nameEl) nameEl.addEventListener('click', goToProfile);

        const jobBtn = card.querySelector('.msg-job-link');
        if (jobBtn) {
            jobBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = jobBtn.dataset.jobUrl;
            });
        }

        card.querySelector('.msg-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = chatUrl;
        });

        card.querySelector('.msg-hide-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const myUid = auth.currentUser.uid;
            showCustomConfirm(
                "Ocultar chat",
                "¿Quieres ocultar esta conversación? Seguirá existiendo, pero no aparecerá en esta lista hasta que vuelvas a contactar con el usuario.",
                async () => {
                    try {
                        await eliminarReferenciaConversacion(myUid, conv.idChat);
                        // No hace falta reload manual, el onSnapshot de loadAllConversations lo detectará
                    } catch (err) {
                        console.error("Error al ocultar chat:", err);
                    }
                },
                "Ocultar",
                "Cancelar",
                "confirm"
            );
        });

        container.appendChild(card);
    }

    updatePaginationUI(filteredConversations.length);
}

// =====================================================
// PAGINACIÓN
// =====================================================

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
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredConversations.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            renderMensajes();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}
