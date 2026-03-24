import { auth } from './firebase-config.js';
import { obtenerTodosLosUsuarios } from './database.js';

let usuariosData = [];
// Array global que mantendrá los usuarios actualmente mostrados después de ser filtrados
let filteredUsers = [];
// Variables para controlar la paginación de la lista
let currentPage = 1;
const itemsPerPage = 5;

// Escuchar clic en botón de filtros para versión móvil
const mobileFilterBtn = document.getElementById('mobile-filter-btn');
const sidebar = document.getElementById('sidebar');
if (mobileFilterBtn && sidebar) {
    mobileFilterBtn.addEventListener('click', () => {
        const isOpening = !sidebar.classList.contains('show-mobile-filters');
        if (isOpening) {
            // Cerrar otros menús si están abiertos
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
        // El botón ahora es siempre opaco
        mobileFilterBtn.style.opacity = '1';
    });
}

document.addEventListener('DOMContentLoaded', async () => {

    const container = document.getElementById('users-list');
    if (container) container.innerHTML = "<p class='loading-text'>Cargando usuarios...</p>";

    try {
        usuariosData = await obtenerTodosLosUsuarios();

        // Esperar a que el usuario esté autenticado para filtrar su propio perfil
        auth.onAuthStateChanged((user) => {
            const currentUid = user ? user.uid : null;

            // Mapear datos para que coincidan con la lógica de filtrado si es necesario
            usuariosData = usuariosData.map(u => ({
                ...u,
                nombre: u.nombre_completo || (u.nombre + " " + u.apellidos),
                desc: u.bio || "Sin biografía.",
                loc: u.direccion_principal || "No especificada",
                lvl: u.nivel || 1,
                val: u.valoracion_media !== undefined ? u.valoracion_media : 2.5,
                esp: (u.especialidad || "General").toLowerCase().trim()
            }));

            // Filtrar para no mostrarse a sí mismo
            filteredUsers = usuariosData.filter(u => u.uid !== currentUid);

            // ORDENAR: Primero los CURRANTE, luego todos por actividad reciente (ultimo_login)
            filteredUsers.sort((a, b) => {
                const subA = a.id_suscripcion_trabajador === 'currante';
                const subB = b.id_suscripcion_trabajador === 'currante';

                if (subA && !subB) return -1;
                if (!subA && subB) return 1;

                // Para todos (sub y no sub), ordenamos por ultimo_login (actividad real)
                const timeA = a.ultimo_login?.toMillis ? a.ultimo_login.toMillis() : (a.ultimo_login || 0);
                const timeB = b.ultimo_login?.toMillis ? b.ultimo_login.toMillis() : (b.ultimo_login || 0);

                if (timeB !== timeA) return timeB - timeA;

                // Fallback por nivel si coinciden tiempos o son 0
                return (b.nivel || 1) - (a.nivel || 1);
            });

            displayUsers();
        });
    } catch (e) {
        console.error("Error cargando usuarios:", e);
    }
});

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
        'otros': 'Otros',
        'general': 'General'
    };
    return names[catId] || catId || 'General';
}

// Función principal para pintar las tarjetas de usuarios en la interfaz
function displayUsers() {
    const container = document.getElementById('users-list');
    container.innerHTML = "";

    // Calcular los índices de inicio y fin para saber qué elementos del array corresponden a la página actual
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredUsers.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:var(--gray-4);font-style: italic; text-align:center; margin-top: 20px;'>No se encontraron usuarios.</p>";
    }

    // Bucle para iterar y pintar cada uno de los elementos de la página actual
    pageItems.forEach((user) => {
        const avatar = user.foto_perfil || "../assets/img/avatar-defecto.png";
        const card = `
            <article class="user-card" onclick="window.location.href='usuario.html?id=${user.uid}'">
                <img src="${avatar}" class="user-img">
                <div class="user-info">
                    <h3 style="display: flex; align-items: center; gap: 8px;">
                        ${user.nombre}
                        ${user.id_suscripcion_trabajador === 'currante' ? '<span class="priority-badge" title="Trabajador CURRANTE" style="background: var(--blue-3); color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; display: flex; align-items: center; gap: 4px;"><img src="../assets/img/icons/icono-estrella.png" style="width: 10px; filter: brightness(0) invert(1);">CURRANTE</span>' : ''}
                    </h3>
                    <p class="user-desc">${user.desc}</p>
                    <div class="user-stats">
                        <p><img src="../assets/img/icons/icono-ubicacion.png" class="icon-img-small" alt=""> ${user.loc}</p>
                        <p><img src="../assets/img/icons/icono-nivel.png" class="icon-img-small" alt=""> Nivel: ${user.lvl}</p>
                        <p><img src="../assets/img/icons/icono-estrella.png" class="icon-img-small" alt=""> Valoración: ${Number(user.val).toFixed(1)}</p>
                        <p><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Especialidad: ${getStandardName(user.esp)}</p>
                    </div>
                </div>
            </article>`;
        container.innerHTML += card;
    });

    // Actualizar el paginador de la interfaz, mostrando en qué página estamos respecto al total
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
    document.getElementById('page-info').innerText = `${currentPage} - ${totalPages}`;
    document.getElementById('prev-page').style.opacity = currentPage === 1 ? '0.3' : '1';
    document.getElementById('next-page').style.opacity = currentPage === totalPages ? '0.3' : '1';
}

// Evento principal desencadenado al pulsar en el botón 'Aplicar Filtros' del menú de la izquierda
document.getElementById('update-btn').onclick = () => {
    const cat = document.getElementById('filter-category').value;
    const lvl = parseInt(document.getElementById('filter-level').value);
    const minV = parseFloat(document.getElementById('val-min').value);
    const maxV = parseFloat(document.getElementById('val-max').value);

    const isFiltered = cat !== "todas" || lvl !== 1 || minV !== 0.0 || maxV !== 5.0;
    const iconHtml = '<img src="../assets/img/icons/icono-ajustes.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    document.querySelector('.section-title').innerHTML = isFiltered ? iconHtml + "USUARIOS: Filtrados" : iconHtml + "USUARIOS: Todos";

    // Reconstruimos el array de usuarios mostrados filtrando uno a uno mediante las restricciones añadidas en los inputs
    filteredUsers = usuariosData.filter(u => {
        const matchCat = (cat === "todas" || u.esp === cat || u.esp.includes(cat) || cat.includes(u.esp));
        const matchLvl = u.lvl >= lvl;
        const matchVal = parseFloat(u.val) >= minV && parseFloat(u.val) <= maxV;
        return matchCat && matchLvl && matchVal;
    });

    currentPage = 1;
    displayUsers();
};

// Evento para cambiar de página hacia adelante en el listado
document.getElementById('next-page').onclick = () => {
    if (currentPage < Math.ceil(filteredUsers.length / itemsPerPage)) {
        currentPage++;
        displayUsers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Evento para retroceder de página en el listado
document.getElementById('prev-page').onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        displayUsers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};