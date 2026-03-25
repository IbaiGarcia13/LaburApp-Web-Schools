import { auth } from './firebase-config.js';
import { obtenerTrabajos } from './database.js';

// Variables de estado para los filtros y la paginación de la lista de trabajos
let allJobs = [];
let filteredJobs = [];
let currentPage = 1;
const itemsPerPage = 5;

// Variables de los filtros actuales (para persistencia en memoria)
let currentFilters = {
    cat: "todas",
    tMin: 1,
    tMax: 100,
    pMin: 2,
    pMax: 1000
};

/**
 * Carga inicial y obtención de datos desde Firestore
 */
async function loadJobs() {
    const container = document.getElementById('jobs-list');
    if (container) container.innerHTML = "<p class='loading-text'>Cargando trabajos...</p>";

    try {
        let rawJobs = await obtenerTrabajos(currentFilters.cat);

        // Filtrar para que no salgan los trabajos propios
        const user = auth.currentUser;
        if (user) {
            rawJobs = rawJobs.filter(j => j.id_publicador !== user.uid);
        }

        // Ordenamos: Primero por prioridad de suscripción (actividad reciente), luego por fecha de publicación
        allJobs = rawJobs.sort((a, b) => {
            const prioA = a.prioridad_suscripcion?.toMillis ? a.prioridad_suscripcion.toMillis() : (Number(a.prioridad_suscripcion) || 0);
            const prioB = b.prioridad_suscripcion?.toMillis ? b.prioridad_suscripcion.toMillis() : (Number(b.prioridad_suscripcion) || 0);

            if (prioB !== prioA) {
                return prioB - prioA;
            }

            // Si ambos coinciden (p.ej. ambos 0), se ordena por fecha de publicación (más reciente primero)
            const dateA = a.fecha_publicacion?.toMillis ? a.fecha_publicacion.toMillis() : (a.fecha_publicacion || 0);
            const dateB = b.fecha_publicacion?.toMillis ? b.fecha_publicacion.toMillis() : (b.fecha_publicacion || 0);

            return dateB - dateA;
        });

        applyClientFilters();
    } catch (e) {
        console.error("Error cargando trabajos:", e);
        const container = document.getElementById('jobs-list');
        if (container) container.innerHTML = "<p style='color:white; text-align:center;'>Error al conectar con la base de datos.</p>";
    }
}

/**
 * Aplica los filtros que Firestore no puede hacer fácilmente sin índices compuestos (tiempo y pago)
 */
function applyClientFilters() {
    filteredJobs = allJobs.filter(j => {
        const matchTime = (j.tiempo_estimado_horas || 0) >= currentFilters.tMin && (j.tiempo_estimado_horas || 0) <= currentFilters.tMax;
        const matchPay = (j.pago_cliente || 0) >= currentFilters.pMin && (j.pago_cliente || 0) <= currentFilters.pMax;
        return matchTime && matchPay;
    });

    currentPage = 1;
    displayJobs();
}

/**
 * Función principal que renderiza el listado de trabajos en la página actual o filtrada
 */
function displayJobs() {
    const container = document.getElementById('jobs-list');
    if (!container) return;
    container.innerHTML = "";

    // Título dinámico
    const isFiltered = currentFilters.cat !== "todas" || currentFilters.tMin !== 1 || currentFilters.tMax !== 100 || currentFilters.pMin !== 2 || currentFilters.pMax !== 1000;
    const iconHtml = '<img src="../assets/img/icons/icono-trabajos-blanco.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    const titleEl = document.querySelector('.section-title');
    if (titleEl) {
        titleEl.innerHTML = isFiltered ? iconHtml + "TRABAJOS: Filtrados" : iconHtml + "TRABAJOS: Todos";
    }

    // Cálculos para saber qué trabajos extraer del array según la página actual
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredJobs.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:var(--gray-4);font-style: italic; text-align:center; margin-top: 20px;'>No se encontraron trabajos.</p>";
    }

    // Crear e inyectar cada tarjeta de trabajo para la página activa
    pageItems.forEach((job) => {
        const dateObj = job.fecha_publicacion?.toDate ? job.fecha_publicacion.toDate() : (job.fecha_publicacion ? new Date(job.fecha_publicacion) : null);
        const dateStr = dateObj ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Reciente";
        const hasPrio = (job.prioridad_suscripcion || 0) !== 0;

        const card = `
            <article class="job-card" onclick="window.location.href='trabajo.html?id=${job.id}'">
                <img src="${job.foto_trabajo || '../assets/img/trabajo-defecto.png'}" class="job-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
                <div class="job-info">
                    <div class="job-card-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h3 style="display: flex; align-items: center; gap: 8px;">
                            ${job.titulo}
                            ${(job.prioridad_suscripcion || 0) !== 0 ? '<span class="priority-badge" style="background: var(--blue-2); color: #fff; font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; font-weight: bold; display: flex; align-items: center; gap: 4px;"><img src="../assets/img/icons/icono-estrella.png" style="width: 10px; filter: brightness(0) invert(1);">JEFE</span>' : ''}
                        </h3>
                        <span class="job-date" style="font-size: 0.85rem; color: var(--gray-4); white-space: nowrap; margin-left: 10px;">${dateStr}</span>
                    </div>
                    <p class="job-desc">${job.descripcion || "Sin descripción"}</p>
                    <div class="job-details">
                        <span><img src="../assets/img/icons/icono-ubicacion.png" class="icon-img-small" alt=""> ${job.direccion || "Ubicación no especificada"}</span>
                        <span><img src="../assets/img/icons/icono-relog.png" class="icon-img-small" alt=""> Tiempo estimado: ${job.tiempo_estimado_horas}h</span>
                        <span><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Categoría: ${getStandardName(job.id_categoria)}</span>
                        <span><img src="../assets/img/icons/icono-xp.png" class="icon-img-small" alt=""> Experiencia: <strong>${job.xp_otorgada || Math.round(job.pago_cliente * 10)} XP</strong></span>
                        <span><img src="../assets/img/icons/icono-dinero.png" class="icon-img-small" style="width:20px; height: 20px" alt=""> <strong> ${Number(job.pago_cliente).toFixed(2)} €</strong></span>
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

function getStandardName(catId) {
    const names = {
        'carpinteria': 'Carpintería',
        'construccion': 'Construcción/Reforma',
        'cuidado_personal': 'Cuidado personal',
        'diseno': 'Diseño',
        'evento': 'Evento',
        'gastronomia': 'Gastronomía',
        'informatica': 'Informática',
        'jardineria': 'Jardinería',
        'limpieza': 'Limpieza',
        'mascotas': 'Mascotas',
        'mudanza': 'Mudanza/Traslado',
        'transporte': 'Transporte',
        'otros': 'Otros'
    };
    return names[catId] || catId || 'Otros';
}

// Evento del botón de filtrado: actualiza la lista basándose en los criterios elegidos
const btnUpdate = document.getElementById('update-btn');
if (btnUpdate) {
    btnUpdate.onclick = async () => {
        const newCat = document.getElementById('filter-category').value;
        const newTMin = parseInt(document.getElementById('time-min').value);
        const newTMax = parseInt(document.getElementById('time-max').value);
        const newPMin = parseFloat(document.getElementById('pay-min').value);
        const newPMax = parseFloat(document.getElementById('pay-max').value);

        const categoryChanged = newCat !== currentFilters.cat;

        currentFilters = {
            cat: newCat,
            tMin: newTMin,
            tMax: newTMax,
            pMin: newPMin,
            pMax: newPMax
        };

        if (categoryChanged) {
            // Si cambió la categoría, re-solicitamos a Firestore
            await loadJobs();
        } else {
            // Si solo cambiaron precios o tiempos, filtramos sobre lo que ya tenemos
            applyClientFilters();
        }
    };
}

// Navegación de página
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

// Inicio
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

    // Cerrar filtros al hacer clic fuera
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
