import { auth } from './firebase-config.js';
import { obtenerTrabajos } from './database.js';

let allJobs = [];
let filteredJobs = [];
let currentPage = 1;
const itemsPerPage = 5;

let currentFilters = {
    cat: "todas",
    tMin: 1,
    tMax: 100,
    ptsMin: 1,
    ptsMax: 100
};

async function loadJobs() {
    const container = document.getElementById('jobs-list');
    if (container) container.innerHTML = "<p class='loading-text'>Cargando tareas...</p>";

    try {
        let rawJobs = await obtenerTrabajos(currentFilters.cat);

        const user = auth.currentUser;
        if (user) {
            rawJobs = rawJobs.filter(j => j.id_publicador !== user.uid);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const claseId = urlParams.get('claseId');

        if (claseId) {
            rawJobs = rawJobs.filter(j => j.id_clase === claseId);
        }

        allJobs = rawJobs.sort((a, b) => {
            const prioA = a.prioridad_suscripcion?.toMillis ? a.prioridad_suscripcion.toMillis() : (Number(a.prioridad_suscripcion) || 0);
            const prioB = b.prioridad_suscripcion?.toMillis ? b.prioridad_suscripcion.toMillis() : (Number(b.prioridad_suscripcion) || 0);

            if (prioB !== prioA) {
                return prioB - prioA;
            }

            const dateA = a.fecha_publicacion?.toMillis ? a.fecha_publicacion.toMillis() : (a.fecha_publicacion || 0);
            const dateB = b.fecha_publicacion?.toMillis ? b.fecha_publicacion.toMillis() : (b.fecha_publicacion || 0);

            return dateB - dateA;
        });

        applyClientFilters();
    } catch (e) {
        console.error("Error cargando trabajos:", e);
        const container = document.getElementById('jobs-list');
        if (container) container.innerHTML = "<p style='color:white; text-align:center;'>Error al cargar las tareas.</p>";
    }
}

function applyClientFilters() {
    filteredJobs = allJobs.filter(j => {
        const matchTime = (j.tiempo_estimado_horas || 0) >= currentFilters.tMin && (j.tiempo_estimado_horas || 0) <= currentFilters.tMax;
        const matchPts = (j.puntos || 1) >= currentFilters.ptsMin && (j.puntos || 1) <= currentFilters.ptsMax;
        return matchTime && matchPts;
    });

    currentPage = 1;
    displayJobs();
}

function displayJobs() {
    const container = document.getElementById('jobs-list');
    if (!container) return;
    container.innerHTML = "";

    const isFiltered = currentFilters.cat !== "todas" || currentFilters.tMin !== 1 || currentFilters.tMax !== 100 || currentFilters.ptsMin !== 1 || currentFilters.ptsMax !== 100;
    const urlParams = new URLSearchParams(window.location.search);
    const context = urlParams.get('claseId') ? " de la Clase" : ": Todas";
    const iconHtml = '<img src="../assets/img/icons/icono-trabajos-blanco.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    const titleEl = document.querySelector('.section-title');
    if (titleEl) {
        titleEl.innerHTML = isFiltered ? iconHtml + "TAREAS: Filtradas" : iconHtml + "TAREAS" + context;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredJobs.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:var(--gray-4);font-style: italic; text-align:center; margin-top: 20px;'>No se encontraron tareas.</p>";
    }

    pageItems.forEach((job) => {
        const dateObj = job.fecha_publicacion?.toDate ? job.fecha_publicacion.toDate() : (job.fecha_publicacion ? new Date(job.fecha_publicacion) : null);
        const dateStr = dateObj ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Reciente";
        
        const puntos = job.puntos || 1;
        const xp = puntos * 100;

        const card = `
            <article class="job-card" onclick="window.location.href='tarea.html?id=${job.id}'">
                <img src="${job.foto_trabajo || '../assets/img/trabajo-defecto.png'}" class="job-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
                <div class="job-info">
                    <div class="job-card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h3 style="display: flex; align-items: center; gap: 8px;">
                            ${job.titulo}
                            ${(job.prioridad_suscripcion || 0) !== 0 ? '<span class="priority-badge" style="background: var(--blue-2); color: var(--neutral-white); font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; font-weight: bold; display: flex; align-items: center; gap: 4px;"><img src="../assets/img/icons/icono-estrella.png" style="width: 10px; filter: brightness(0) invert(1);">DOCENTE</span>' : ''}
                        </h3>
                        <span class="job-date" style="font-size: 0.85rem; color: var(--gray-4); white-space: nowrap; margin-left: 10px;">${dateStr}</span>
                    </div>
                    <p class="job-desc">${job.descripcion || "Sin descripción"}</p>
                    <div class="job-details">
                        <span><img src="../assets/img/icons/icono-relog.png" class="icon-img-small" alt=""> Tiempo: ${job.tiempo_estimado_horas}h</span>
                        <span><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Asignatura: ${job.id_categoria || 'Otra'}</span>
                        <span><img src="../assets/img/icons/icono-xp.png" class="icon-img-small" alt=""> <strong>${xp} XP</strong></span>
                        <span><img src="../assets/img/icons/icono-estrella-color.png" class="icon-img-small" style="width:18px; height: 18px" alt=""> <strong> ${puntos} Pts</strong></span>
                    </div>
                </div>
            </article>`;
        container.innerHTML += card;
    });

    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage) || 1;
    const pageInfo = document.getElementById('page-info');
    if (pageInfo) pageInfo.innerText = `${currentPage} - ${totalPages}`;

    const btnPrev = document.getElementById('prev-page');
    const btnNext = document.getElementById('next-page');
    if (btnPrev) btnPrev.style.opacity = currentPage === 1 ? '0.3' : '1';
    if (btnNext) btnNext.style.opacity = currentPage === totalPages ? '0.3' : '1';
}

const btnUpdate = document.getElementById('update-btn');
if (btnUpdate) {
    btnUpdate.onclick = async () => {
        const newCat = document.getElementById('filter-category').value;
        const newTMin = parseInt(document.getElementById('time-min').value) || 1;
        const newTMax = parseInt(document.getElementById('time-max').value) || 100;
        const newPtsMin = parseInt(document.getElementById('pts-min').value) || 1;
        const newPtsMax = parseInt(document.getElementById('pts-max').value) || 100;

        const categoryChanged = newCat !== currentFilters.cat;

        currentFilters = {
            cat: newCat,
            tMin: newTMin,
            tMax: newTMax,
            ptsMin: newPtsMin,
            ptsMax: newPtsMax
        };

        if (categoryChanged) {
            await loadJobs();
        } else {
            applyClientFilters();
        }

        const sidebar = document.getElementById('sidebar');
        const mobileFilterBtn = document.getElementById('mobile-filter-btn');
        if (sidebar && sidebar.classList.contains('show-mobile-filters')) {
            sidebar.classList.remove('show-mobile-filters');
            if (mobileFilterBtn) mobileFilterBtn.classList.remove('active');
        }
    };
}

const btnNext = document.getElementById('next-page');
if (btnNext) {
    btnNext.onclick = () => {
        if (currentPage < Math.ceil(filteredJobs.length / itemsPerPage)) {
            currentPage++;
            displayJobs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
}

const btnPrev = document.getElementById('prev-page');
if (btnPrev) {
    btnPrev.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayJobs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
}

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

auth.onAuthStateChanged(user => {
    loadJobs();
});
