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
    try {
        // Obtenemos los trabajos pendientes de la base de datos
        let rawJobs = await obtenerTrabajos(currentFilters.cat);

        // Ordenamos por fecha_publicacion descendente en el cliente (para evitar índices compuestos)
        allJobs = rawJobs.sort((a, b) => {
            const dateA = a.fecha_publicacion?.toDate ? a.fecha_publicacion.toDate() : (a.fecha_publicacion || 0);
            const dateB = b.fecha_publicacion?.toDate ? b.fecha_publicacion.toDate() : (b.fecha_publicacion || 0);
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
    const iconHtml = '<img src="../assets/img/icons/icono-ajustes.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    const titleEl = document.querySelector('.section-title');
    if (titleEl) {
        titleEl.innerHTML = isFiltered ? iconHtml + "TRABAJOS: Filtrados" : iconHtml + "TRABAJOS: Todos";
    }

    // Cálculos para saber qué trabajos extraer del array según la página actual
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredJobs.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:white; text-align:center; margin-top: 20px;'>No hay trabajos disponibles con estos criterios.</p>";
    }

    // Crear e inyectar cada tarjeta de trabajo para la página activa
    pageItems.forEach((job) => {
        const card = `
            <article class="job-card" onclick="window.location.href='trabajo.html?id=${job.id}'">
                <img src="${job.foto_trabajo || '../assets/img/trabajo-defecto.png'}" class="job-img" onerror="this.src='../assets/img/trabajo-defecto.png'">
                <div class="job-info">
                    <h3>${job.titulo}</h3>
                    <p class="job-desc">${job.descripcion || "Sin descripción"}</p>
                    <div class="job-details">
                        <p><img src="../assets/img/icons/icono-ubicacion.png" class="icon-img-small" alt=""> ${job.direccion || "Ubicación no especificada"}</p>
                        <p><img src="../assets/img/icons/icono-relog.png" class="icon-img-small" alt=""> Tiempo estimado: ${job.tiempo_estimado_horas}h</p>
                        <p><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Categoría: ${job.id_categoria.charAt(0).toUpperCase() + job.id_categoria.slice(1)}</p>
                        <p><img src="../assets/img/icons/icono-xp.png" class="icon-img-small" alt=""> Experiencia: <strong>${job.xp_otorgada || Math.round(job.pago_cliente * 10)} XP</strong></p>
                        <p><img src="../assets/img/icons/icono-dinero.png" class="icon-img-small" style="width:20px; height: 20px" alt=""> Pago: <strong>${Number(job.pago_cliente).toFixed(2)} €</strong></p>
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
            window.scrollTo(0, 0);
        }
    };
}

const btnPrev = document.getElementById('prev-page');
if (btnPrev) {
    btnPrev.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayJobs();
            window.scrollTo(0, 0);
        }
    };
}

// Inicio
loadJobs();
