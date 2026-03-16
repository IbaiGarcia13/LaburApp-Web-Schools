import { auth } from './firebase-config.js';
import { obtenerTrabajosAceptadosPorMi } from './database.js';
import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * MIS TRABAJOS: Trabajos que el usuario VA A HACER (Trabajador/Worker)
 */

// Variables de estado
let allJobs = [];
let filteredJobs = [];
let currentPage = 1;
const itemsPerPage = 5;

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
            await loadMyAcceptedJobs(user.uid);
        }
    });
    setupEventListeners();
});

async function loadMyAcceptedJobs(uid) {
    try {
        const rawJobs = await obtenerTrabajosAceptadosPorMi(uid);
        allJobs = rawJobs.sort((a, b) => {
            const dateA = a.fecha_publicacion?.toDate ? a.fecha_publicacion.toDate() : (a.fecha_publicacion || 0);
            const dateB = b.fecha_publicacion?.toDate ? b.fecha_publicacion.toDate() : (b.fecha_publicacion || 0);
            return dateB - dateA;
        });
        applyClientFilters();
    } catch (e) {
        console.error("Error cargando mis trabajos aceptados:", e);
    }
}

function applyClientFilters() {
    filteredJobs = allJobs.filter(j => {
        const isCompletada = (j.estado || "").toLowerCase() === "completada";
        if (isCompletada) return false;

        const matchCat = (currentFilters.cat === "todas" || (j.id_categoria && j.id_categoria.toLowerCase() === currentFilters.cat.toLowerCase()));
        const pago = j.pago_trabajador || (j.pago_cliente * 0.9);
        const matchPay = pago >= currentFilters.pMin && pago <= currentFilters.pMax;
        const tiempo = j.tiempo_estimado_horas || 0;
        const matchTime = tiempo >= currentFilters.tMin && tiempo <= currentFilters.tMax;
        return matchCat && matchPay && matchTime;
    });
    currentPage = 1;
    displayJobs();
}

function displayJobs() {
    const container = document.getElementById('jobs-list');
    if (!container) return;
    container.innerHTML = "";

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredJobs.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:white; text-align:center;'>No has aceptado trabajos aún que coincidan.</p>";
    }

    pageItems.forEach(job => {
        const catName = job.id_categoria ? job.id_categoria.charAt(0).toUpperCase() + job.id_categoria.slice(1) : "Otros";
        const pago = job.pago_trabajador || (job.pago_cliente * 0.9);
        const xp = job.xp_otorgada || Math.round(job.pago_cliente * 10);
        const img = job.foto_trabajo || "../assets/img/trabajo-defecto.png";

        const card = `
            <article class="job-card" onclick="window.location.href='mi-trabajo.html?id=${job.id}'">
                <div class="action-buttons" style="position: absolute; right: 10px; top: 10px;">
                     <button class="action-btn delete-btn" title="Abandonar Trabajo" onclick="event.stopPropagation(); confirmarAbandonar('${job.id}')" style="background: rgba(255,255,255,0.9); border:none; border-radius: 50%; padding: 5px; cursor:pointer;"><img src="../assets/img/icons/icono-eliminar.png" alt="X" style="width:15px"></button>
                </div>
                <img src="${img}" class="job-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
                <div class="job-info">
                    <h3>${job.titulo}</h3>
                    <p class="job-desc">${job.descripcion || "Sin descripción."}</p>
                    <div class="job-details">
                        <p><img src="../assets/img/icons/icono-ubicacion.png" class="icon-img-small" alt=""> ${job.direccion || "No especificada"}</p>
                        <p><img src="../assets/img/icons/icono-relog.png" class="icon-img-small" alt=""> Tiempo estimado: ${job.tiempo_estimado_horas}h</p>
                        <p><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Categoría: ${catName}</p>
                        <p><img src="../assets/img/icons/icono-xp.png" class="icon-img-small" alt=""> Experiencia: <strong>${xp} XP</strong></p>
                        <p><img src="../assets/img/icons/icono-dinero.png" class="icon-img-small" style="width:16px" alt=""><strong>${Number(pago).toFixed(2)} €</strong></p>
                    </div>
                </div>
            </article>`;
        container.innerHTML += card;
    });

    updatePaginationUI();
}

function updatePaginationUI() {
    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage) || 1;
    document.getElementById('page-info').innerText = `${currentPage} - ${totalPages}`;
    document.getElementById('prev-page').style.opacity = currentPage === 1 ? '0.3' : '1';
    document.getElementById('next-page').style.opacity = (currentPage === totalPages || filteredJobs.length === 0) ? '0.3' : '1';
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
        if (currentPage < Math.ceil(filteredJobs.length / itemsPerPage)) {
            currentPage++;
            displayJobs();
        }
    };

    document.getElementById('prev-page').onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayJobs();
        }
    };
}

window.confirmarAbandonar = function (id) {
    showCustomConfirm(
        "Abandonar Trabajo",
        "¿Quieres dejar de ser el trabajador de esta oferta?",
        async () => {
            try {
                await updateDoc(doc(db, "trabajos", id), {
                    id_trabajador: null,
                    estado: "Pendiente"
                });
                allJobs = allJobs.filter(j => j.id !== id);
                applyClientFilters();
            } catch (e) {
                console.error(e);
            }
        },
        "Si",
        "No"
    );
};