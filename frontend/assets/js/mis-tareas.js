import { auth } from './firebase-config.js';
import { obtenerTrabajosPublicadosPorMi } from './database.js';
import { db } from './firebase-config.js';
import { doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    tMin: 1,
    tMax: 100,
    pMin: 2,
    pMax: 1000
};

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await loadMyPostedTasks(user.uid);
        }
    });
    setupEventListeners();
});

async function loadMyPostedTasks(uid) {
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
        const isCompletada = (j.estado || "").toLowerCase() === "completada";
        if (isCompletada) return false;

        const matchCat = (currentFilters.cat === "todas" || (j.id_categoria && j.id_categoria.toLowerCase() === currentFilters.cat.toLowerCase()));
        const pago = j.pago_cliente || 0;
        const matchPay = pago >= currentFilters.pMin && pago <= currentFilters.pMax;
        const tiempo = j.tiempo_estimado_horas || 0;
        const matchTime = tiempo >= currentFilters.tMin && tiempo <= currentFilters.tMax;
        return matchCat && matchPay && matchTime;
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
        container.innerHTML = "<p style='color:white; text-align:center;'>No tienes tareas publicadas que coincidan.</p>";
    }

    pageItems.forEach(tarea => {
        const catName = tarea.id_categoria ? tarea.id_categoria.charAt(0).toUpperCase() + tarea.id_categoria.slice(1) : "Otros";
        const pagoCliente = tarea.pago_cliente || 0;
        const xp = tarea.xp_otorgada || Math.round(pagoCliente * 10);
        const img = tarea.foto_trabajo || "../assets/img/trabajo-defecto.png";

        const card = `
            <article class="job-card" data-id="${tarea.id}" onclick="window.location.href='mi-tarea.html?id=${tarea.id}'">
                <div class="action-buttons">
                    <button class="action-btn edit-btn" title="Editar Tarea" onclick="event.stopPropagation(); window.location.href='mi-tarea.html?id=${tarea.id}'"><img src="../assets/img/icons/icono-editar.png" alt="Editar"></button>
                    <button class="action-btn delete-btn" title="Eliminar Publicación" onclick="event.stopPropagation(); confirmarEliminar('${tarea.id}')"><img src="../assets/img/icons/icono-eliminar.png" alt="Eliminar"></button>
                </div>
                <img src="${img}" class="job-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
                <div class="job-info">
                    <div class="job-card-header">
                        <h3>${tarea.titulo}</h3>
                        <span class="status-badge status-${(tarea.estado || 'pendiente').toLowerCase()}">${(tarea.estado || 'Pendiente').toUpperCase()}</span>
                    </div>
                    <p class="job-desc">${tarea.descripcion || "Sin descripción."}</p>
                    <div class="job-details">
                        <p><img src="../assets/img/icons/icono-ubicacion.png" class="icon-img-small" alt=""> ${tarea.direccion || "No especificada"}</p>
                        <p><img src="../assets/img/icons/icono-relog.png" class="icon-img-small" alt=""> Tiempo estimado: ${tarea.tiempo_estimado_horas}h</p>
                        <p><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Categoría: ${catName}</p>
                        <p><img src="../assets/img/icons/icono-xp.png" class="icon-img-small" alt=""> Experiencia: <strong>${xp} XP</strong></p>
                        <p><img src="../assets/img/icons/icono-dinero.png" class="icon-img-small" style="width:16px" alt=""><strong>${Number(pagoCliente).toFixed(2)} €</strong></p>
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
    showCustomConfirm(
        "Eliminar Publicación",
        "¿Estás seguro de que quieres eliminar esta tarea? Se borrará permanentemente de la plataforma.",
        async () => {
            try {
                await deleteDoc(doc(db, "trabajos", id));
                allTareas = allTareas.filter(t => t.id !== id);
                applyClientFilters();
            } catch (e) {
                console.error("Error al borrar:", e);
            }
        },
        "Eliminar",
        "Cancelar"
    );
};
