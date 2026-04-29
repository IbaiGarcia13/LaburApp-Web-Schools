import { auth } from './firebase-config.js';
import { obtenerTrabajosAceptadosPorMi, gestionarBorradoTarea } from './database.js';

let allJobs = [];
let filteredJobs = [];
let currentPage = 1;
const itemsPerPage = 5;

let currentFilters = {
    cat: "todas",
    status: "todas",
    tMin: 1,
    tMax: 100,
    pMin: 2,
    pMax: 1000
};

document.addEventListener("DOMContentLoaded", () => {
   
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

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('show-mobile-filters') &&
                !sidebar.contains(e.target) &&
                !mobileFilterBtn.contains(e.target)) {

                sidebar.classList.remove('show-mobile-filters');
                mobileFilterBtn.classList.remove('active');
            }
        });
    }

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = '../index.html';
            return;
        }
        await loadMyAcceptedJobs(user.uid);
    });
    setupEventListeners();
});

async function loadMyAcceptedJobs(uid) {
    const container = document.getElementById('jobs-list');
    if (container) container.innerHTML = "<p class='loading-text'>Cargando mis tareas...</p>";

    try {
        const rawJobs = await obtenerTrabajosAceptadosPorMi(uid);
        allJobs = rawJobs.sort((a, b) => {
            const dateA = a.fecha_actividad?.toDate ? a.fecha_actividad.toDate() : (a.fecha_actividad || a.fecha_aceptacion?.toDate?.() || a.fecha_aceptacion || a.fecha_publicacion?.toDate?.() || a.fecha_publicacion || 0);
            const dateB = b.fecha_actividad?.toDate ? b.fecha_actividad.toDate() : (b.fecha_actividad || b.fecha_aceptacion?.toDate?.() || b.fecha_aceptacion || b.fecha_publicacion?.toDate?.() || b.fecha_publicacion || 0);
            return dateB - dateA;
        });
        applyClientFilters();
    } catch (e) {
        console.error("Error cargando mis trabajos aceptados:", e);
    }
}

function applyClientFilters() {
    filteredJobs = allJobs.filter(j => {
       
        if (j.cancelado_por === "trabajador") return false;
        if (j.borrado_por_trabajador === true) return false;

        const matchCat = (currentFilters.cat === "todas" || (j.id_categoria && j.id_categoria.toLowerCase() === currentFilters.cat.toLowerCase()));

        const statusVal = (j.estado || "pendiente").toLowerCase();
        let matchStatus = false;
        if (currentFilters.status === "todas") {

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
        container.innerHTML = "<p style='color:var(--gray-4); font-style: italic; text-align:center; margin-top: 20px;'>No has aceptado trabajos aún que coincidan.</p>";
    }

    pageItems.forEach(job => {
        const catName = job.id_categoria ? job.id_categoria.charAt(0).toUpperCase() + job.id_categoria.slice(1) : "Otros";
        const pago = job.pago_cliente || 0;
        const xp = job.xp_otorgada || Math.round(job.pago_cliente * 10);
        const img = job.foto_trabajo || "../assets/img/trabajo-defecto.png";
        const estadoNorm = (job.estado || 'Pendiente');

        const isCompletada = estadoNorm.toLowerCase() === "completada";
        const actionIcon = isCompletada ? "../assets/img/icons/icono-eliminar-blanco.png" : "../assets/img/icons/icono-no-blanco.png";
        const actionBtnClass = isCompletada ? "delete-btn" : "cancel-btn";
        const deleteTitle = isCompletada ? "Eliminar Historial" : "Abandonar Trabajo";

        const card = `
            <article class="job-card" onclick="window.location.href='mi-trabajo.html?id=${job.id}'">
                <div class="action-buttons">
                     <button class="action-btn ${actionBtnClass}" title="${deleteTitle}" onclick="event.stopPropagation(); confirmarAbandonar('${job.id}')">
                        <img src="${actionIcon}" alt="X">
                     </button>
                </div>
                <img src="${img}" class="job-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
                <div class="job-info">
                    <div class="job-card-header">
                        <h3>${job.titulo}</h3>
                        <span class="status-badge status-${estadoNorm.toLowerCase() === 'pausada' ? 'en-revision' : estadoNorm.toLowerCase().replace(/\s+/g, '-')}">${(job.estado === 'Pausada' ? 'En revisión' : (job.estado === 'Aceptado' ? 'Aceptada' : estadoNorm)).toUpperCase()}</span>
                    </div>
                    <p class="job-desc">${job.descripcion || "Sin descripción."}</p>
                    <div class="job-details">
                        <span><img src="../assets/img/icons/icono-ubicacion.png" class="icon-img-small" alt=""> ${job.direccion || "No especificada"}</span>
                        <span><img src="../assets/img/icons/icono-relog.png" class="icon-img-small" alt=""> Tiempo estimado: ${job.tiempo_estimado_horas}h</span>
                        <span><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Categoría: ${catName}</span>
                        <span><img src="../assets/img/icons/icono-xp.png" class="icon-img-small" alt=""> Experiencia: <strong>${xp} XP</strong></span>
                        <span><img src="../assets/img/icons/icono-dinero.png" class="icon-img-small" style="width:20px; height: 20px" alt=""><strong>${Number(pago).toFixed(2)} €</strong></span>
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
        currentFilters.status = document.getElementById('filter-status').value;
        currentFilters.tMin = parseInt(document.getElementById('time-min').value) || 1;
        currentFilters.tMax = parseInt(document.getElementById('time-max').value) || 100;
        currentFilters.pMin = parseFloat(document.getElementById('pay-min').value) || 2;
        currentFilters.pMax = parseFloat(document.getElementById('pay-max').value) || 1000;
        applyClientFilters();

        const sidebar = document.getElementById('sidebar');
        const mobileFilterBtn = document.getElementById('mobile-filter-btn');
        if (sidebar && sidebar.classList.contains('show-mobile-filters')) {
            sidebar.classList.remove('show-mobile-filters');
            if (mobileFilterBtn) mobileFilterBtn.classList.remove('active');
        }
    };

    document.getElementById('next-page').onclick = () => {
        if (currentPage < Math.ceil(filteredJobs.length / itemsPerPage)) {
            currentPage++;
            displayJobs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    document.getElementById('prev-page').onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayJobs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
}

window.confirmarAbandonar = function (id) {
    const job = allJobs.find(j => j.id === id);
    if (!job) return;

    const isCompletada = (job.estado || "").toLowerCase() === "completada";

    const ahora = new Date();
    const fechaLim = job.fecha_limite?.toDate ? job.fecha_limite.toDate() : (job.fecha_limite ? new Date(job.fecha_limite) : null);
    const dentroDePlazo = !fechaLim || fechaLim > ahora;

    const realizarAbandono = async () => {
        try {
            const { permanent } = await gestionarBorradoTarea(id, 'trabajador');

            if (permanent) {
                allJobs = allJobs.filter(j => j.id !== id);
            } else {
                const jobIndex = allJobs.findIndex(j => j.id === id);
                if (jobIndex !== -1) {
                    allJobs[jobIndex].borrado_por_trabajador = true;
                }
            }

            applyClientFilters();
        } catch (e) {
            console.error(e);
        }
    };

    if (!isCompletada && dentroDePlazo) {
        realizarAbandono();
    } else {
       // --- PARA TAREAS COMPLETADAS (BORRAR HISTORIAL) U OTRAS, MANTENEMOS EL MODAL POR SEGURIDAD ---
        const modalTitle = isCompletada ? "Eliminar del Historial" : "Abandonar Trabajo";
        const modalDesc = isCompletada
            ? "¿Quieres eliminar este trabajo de tu lista? Solo desaparecerá para ti, el registro se mantiene para el publicador."
            : "¿Quieres dejar de ser el trabajador de esta oferta?";

        showCustomConfirm(
            modalTitle,
            modalDesc,
            realizarAbandono,
            "Si",
            "No"
        );
    }
};