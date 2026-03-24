import { auth } from './firebase-config.js';
import { obtenerTrabajosPublicadosPorMi, gestionarBorradoTarea, cancelarTrabajo } from './database.js';

/**
 * MIS TAREAS: Tareas que el usuario HA COLGADO (Publicador/Cliente)
 */

// Variables de estado
let allTareas = [];
let filteredTareas = [];
let currentPage = 1;
const itemsPerPage = 4;

let currentFilters = {
    cat: "todas",
    status: "todas",
    tMin: 1,
    tMax: 100,
    pMin: 2,
    pMax: 1000
};

document.addEventListener("DOMContentLoaded", () => {
    // Escuchar clic en botón de filtros para versión móvil
    const mobileFilterBtn = document.getElementById('mobile-filter-btn');
    const sidebar = document.getElementById('sidebar');
    if (mobileFilterBtn && sidebar) {
        mobileFilterBtn.addEventListener('click', () => {
            const isOpening = !sidebar.classList.contains('show-mobile-filters');
            if (isOpening) {
                const sideMenu = document.getElementById('sideMenu');
                const profileDropdown = document.getElementById('profileDropdown');
                const menuBtn = document.getElementById('menuBtn');
                const notificationsPanel = document.getElementById('notificationsPanel');

                if (sideMenu) sideMenu.classList.remove('active');
                if (menuBtn) menuBtn.classList.remove('active');
                if (profileDropdown) profileDropdown.classList.remove('show');
                if (notificationsPanel) notificationsPanel.classList.remove('active');
            }
            sidebar.classList.toggle('show-mobile-filters');
            mobileFilterBtn.classList.toggle('active');
            mobileFilterBtn.style.opacity = '1';
        });
    }

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await loadMyPostedTasks(user.uid);
        }
    });
    setupEventListeners();
});

async function loadMyPostedTasks(uid) {
    const container = document.getElementById('tareas-list');
    if (container) container.innerHTML = "<p class='loading-text'>Cargando mis tareas...</p>";

    try {
        // Obtenemos lo que YO HE PUBLICADO
        const rawTareas = await obtenerTrabajosPublicadosPorMi(uid);
        allTareas = rawTareas.sort((a, b) => {
            const dateA = a.fecha_publicacion?.toDate ? a.fecha_publicacion.toDate() : (a.fecha_publicacion || 0);
            const dateB = b.fecha_publicacion?.toDate ? b.fecha_publicacion.toDate() : (b.fecha_publicacion || 0);
            return dateB - dateA;
        });
        applyClientFilters();
    } catch (e) {
        console.error("Error cargando mis tareas publicadas:", e);
    }
}

function applyClientFilters() {
    filteredTareas = allTareas.filter(j => {
        // Ocultar si fue cancelado por el propio publicador O borrado por él tras completarse
        if (j.cancelado_por === "publicador") return false;
        if (j.borrado_por_publicador === true) return false;

        const matchCat = (currentFilters.cat === "todas" || (j.id_categoria && j.id_categoria.toLowerCase() === currentFilters.cat.toLowerCase()));

        const statusVal = (j.estado || "pendiente").toLowerCase();
        let matchStatus = false;
        if (currentFilters.status === "todas") {
            // "Todas" muestra todo lo que no esté borrado o cancelado por el usuario.
            // Si el trabajador la canceló, el publicador SÍ quiere verla como "Cancelada".
            matchStatus = true;
        } else {
            matchStatus = statusVal === currentFilters.status.toLowerCase();
        }

        const pago = j.pago_cliente || 0;
        const matchPay = pago >= currentFilters.pMin && pago <= currentFilters.pMax;
        const tiempo = j.tiempo_estimado_horas || 0;
        const matchTime = tiempo >= currentFilters.tMin && tiempo <= currentFilters.tMax;
        return matchCat && matchStatus && matchPay && matchTime;
    });
    currentPage = 1;
    displayTareas();
}

function displayTareas() {
    const container = document.getElementById('tareas-list');
    if (!container) return;
    container.innerHTML = "";

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredTareas.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:var(--gray-4); font-style: italic; text-align:center; margin-top: 20px;'>No tienes tareas publicadas que coincidan.</p>";
    }

    pageItems.forEach(tarea => {
        const catName = tarea.id_categoria ? tarea.id_categoria.charAt(0).toUpperCase() + tarea.id_categoria.slice(1) : "Otros";
        const pagoCliente = tarea.pago_cliente || 0;
        const xp = tarea.xp_otorgada || Math.round(pagoCliente * 10);
        const img = tarea.foto_trabajo || "../assets/img/trabajo-defecto.png";

        const isCompletada = (tarea.estado || "").toLowerCase() === "completada";
        const canDelete = isCompletada || (tarea.estado || "").toLowerCase() === "cancelada";
        const actionIcon = canDelete ? "../assets/img/icons/icono-eliminar-blanco.png" : "../assets/img/icons/icono-no-blanco.png";
        const actionTitle = canDelete ? "Eliminar Tarea" : "Cancelar Tarea";
        const actionBtnClass = canDelete ? "delete-btn" : "cancel-btn";
        const actionFn = canDelete ? `confirmarEliminar('${tarea.id}')` : `confirmarCancelarTarea('${tarea.id}')`;

        const card = `
            <article class="job-card" data-id="${tarea.id}" onclick="window.location.href='mi-tarea.html?id=${tarea.id}'">
                <div class="action-buttons">
                    <button class="action-btn ${actionBtnClass}" title="${actionTitle}" onclick="event.stopPropagation(); ${actionFn}">
                        <img src="${actionIcon}" alt="${actionTitle}">
                    </button>
                </div>
                <img src="${img}" class="job-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
                <div class="job-info">
                    <div class="job-card-header">
                        <h3>${tarea.titulo}</h3>
                        <span class="status-badge status-${(tarea.estado || 'pendiente').toLowerCase().replace(/\s+/g, '-')}">${(tarea.estado === 'Aceptado' ? 'Aceptada' : (tarea.estado || 'Pendiente')).toUpperCase()}</span>
                    </div>
                    <p class="job-desc">${tarea.descripcion || "Sin descripción."}</p>
                    <div class="job-details">
                        <p><img src="../assets/img/icons/icono-ubicacion.png" class="icon-img-small" alt=""> ${tarea.direccion || "No especificada"}</p>
                        <p><img src="../assets/img/icons/icono-relog.png" class="icon-img-small" alt=""> Tiempo estimado: ${tarea.tiempo_estimado_horas}h</p>
                        <p><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Categoría: ${catName}</p>
                        <p><img src="../assets/img/icons/icono-xp.png" class="icon-img-small" alt=""> Experiencia: ${xp} XP</p>
                        <p><img src="../assets/img/icons/icono-dinero.png" class="icon-img-small" style="width:20px; height: 20px" alt=""><strong>${Number(pagoCliente).toFixed(2)} €</strong></p>
                    </div>
                </div>
            </article>`;
        container.innerHTML += card;
    });

    updatePaginationUI();
}

function updatePaginationUI() {
    const totalPages = Math.ceil(filteredTareas.length / itemsPerPage) || 1;
    document.getElementById('page-info').innerText = `${currentPage} - ${totalPages}`;
    document.getElementById('prev-page').style.opacity = currentPage === 1 ? '0.3' : '1';
    document.getElementById('next-page').style.opacity = (currentPage === totalPages || filteredTareas.length === 0) ? '0.3' : '1';
}

function setupEventListeners() {
    document.getElementById('update-btn').onclick = () => {
        currentFilters.cat = document.getElementById('filter-category').value;
        currentFilters.status = document.getElementById('filter-status').value;
        currentFilters.tMin = parseInt(document.getElementById('time-min').value) || 1;
        currentFilters.tMax = parseInt(document.getElementById('time-max').value) || 100;
        currentFilters.pMin = parseFloat(document.getElementById('pay-min').value) || 2;
        currentFilters.pMax = parseFloat(document.getElementById('pay-max').value) || 1000;
        applyClientFilters();
    };

    document.getElementById('next-page').onclick = () => {
        if (currentPage < Math.ceil(filteredTareas.length / itemsPerPage)) {
            currentPage++;
            displayTareas();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    document.getElementById('prev-page').onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayTareas();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
}

window.confirmarEliminar = function (id) {
    const tarea = allTareas.find(t => t.id === id);
    const isCompletada = tarea && (tarea.estado || "").toLowerCase() === "completada";

    const modalTitle = isCompletada ? "Eliminar del Historial" : "Borrar Permanentemente";
    const modalDesc = isCompletada
        ? "¿Quieres eliminar esta tarea de tu historial? Solo desaparecerá para ti, el registro se mantiene para el trabajador."
        : "¿Estás seguro de que quieres borrar esta tarea definitivamente? El registro se eliminará de la base de datos y se procesará el reembolso de la garantía si corresponde.";

    showCustomConfirm(
        modalTitle,
        modalDesc,
        async () => {
            try {
                const { permanent } = await gestionarBorradoTarea(id, 'publicador');

                if (permanent) {
                    allTareas = allTareas.filter(t => t.id !== id);
                } else {
                    const idx = allTareas.findIndex(t => t.id === id);
                    if (idx !== -1) allTareas[idx].borrado_por_publicador = true;
                }
                applyClientFilters();
            } catch (e) {
                console.error("Error al procesar eliminación:", e);
            }
        },
        "Borrar",
        "Cerrar",
        "delete"
    );
};

window.confirmarCancelarTarea = function (id) {
    const tarea = allTareas.find(t => t.id === id);
    if (!tarea) return;

    showCustomConfirm(
        "Cancelar Tarea",
        `¿Estás seguro de que quieres cancelar "${tarea.titulo}"? La tarea se detendrá y no se podrán aceptar más candidatos. El dinero de la garantía se retendrá hasta que la tarea sea borrada de tu lista.`,
        async () => {
            try {
                await cancelarTrabajo(id);
                // Actualizar localmente para reflejar el cambio sin recargar todo
                const idx = allTareas.findIndex(t => t.id === id);
                if (idx !== -1) allTareas[idx].estado = "Cancelada";
                applyClientFilters();
                showCustomAlert("Tarea Cancelada", "La tarea ha sido cancelada con éxito.");
            } catch (e) {
                console.error("Error al cancelar tarea:", e);
                showCustomAlert("Error", "No se pudo cancelar la tarea.");
            }
        },
        "Cancelar Tarea",
        "Cerrar",
        "delete"
    );
};
