import { auth, db } from './firebase-config.js';
import { obtenerTodosLosUsuarios, obtenerClasePorId } from './database.js';

let usuariosData = [];
let filteredUsers = [];
let currentPage = 1;
const itemsPerPage = 5;
let currentRoleLabel = "USUARIOS";

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

document.addEventListener('DOMContentLoaded', async () => {

    const container = document.getElementById('users-list');
    if (container) container.innerHTML = "<p class='loading-text'>Cargando...</p>";

    try {
        usuariosData = await obtenerTodosLosUsuarios();

        auth.onAuthStateChanged((user) => {
            const currentUid = user ? user.uid : null;
            const urlParams = new URLSearchParams(window.location.search);
            const claseId = urlParams.get('claseId');

            // --- FILTRAR POR CLASE SI EXISTE EL PARÁMETRO ---
            if (claseId) {
                obtenerClasePorId(claseId).then(clase => {
                    if (clase) {
                        const classUids = [clase.id_docente, ...(clase.alumnos || [])];
                        usuariosData = usuariosData.filter(u => classUids.includes(u.uid));
                        finalizarCarga(currentUid);
                    } else {
                        finalizarCarga(currentUid);
                    }
                }).catch(e => {
                    console.error("Error filtrando por clase:", e);
                    finalizarCarga(currentUid);
                });
            } else {
                finalizarCarga(currentUid);
            }
        });
    } catch (e) {
        console.error("Error cargando usuarios:", e);
    }
});

function finalizarCarga(currentUid) {
    // --- MAPEAR DATOS ---
    usuariosData = usuariosData.map(u => ({
        ...u,
        nombre: u.nombre_completo || (u.nombre + " " + (u.apellidos || "")),
        desc: u.bio || "Sin biografía.",
        loc: u.direccion_principal || "No especificada",
        lvl: u.nivel || 1,
        val: u.valoracion_media !== undefined ? u.valoracion_media : 2.5,
        esp: u.especialidad_principal || u.id_categoria_trabajador || u.especialidad || "General"
    }));

    filteredUsers = usuariosData.filter(u => u.uid !== currentUid);

    // Ajustar título según rol
    const perfilActual = usuariosData.find(u => u.uid === currentUid);
    currentRoleLabel = (perfilActual && perfilActual.rol === 'docente') ? 'ALUMNOS' : 'COMPAÑEROS';
    
    // Si estamos en una clase, el título debe ser específico
    const urlParams = new URLSearchParams(window.location.search);
    const context = urlParams.get('claseId') ? " de la Clase" : ": Todos";

    const iconHtml = '<img src="../assets/img/icons/icono-perfil.png" style="width: 35px; vertical-align: middle; margin-right: 10px; filter: invert(1);" alt=""> ';
    const titleEl = document.querySelector('.section-title');
    if (titleEl) titleEl.innerHTML = iconHtml + currentRoleLabel + context;

    // --- ORDENAR ---
    filteredUsers.sort((a, b) => {
        const timeA = a.ultimo_login?.toMillis ? a.ultimo_login.toMillis() : (a.ultimo_login || 0);
        const timeB = b.ultimo_login?.toMillis ? b.ultimo_login.toMillis() : (b.ultimo_login || 0);
        return timeB - timeA;
    });

    displayUsers(perfilActual);
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
        'otros': 'Otros',
        'general': 'General'
    };
    const res = names[catId.toLowerCase()] || catId;
    return res.charAt(0).toUpperCase() + res.slice(1);
}

function displayUsers(perfilActual) {
    const container = document.getElementById('users-list');
    if (!container) return;
    container.innerHTML = "";

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredUsers.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:var(--gray-4);font-style: italic; text-align:center; margin-top: 20px;'>No se encontraron resultados.</p>";
    }

    const isDocente = perfilActual && perfilActual.rol === 'docente';

    pageItems.forEach((user) => {
        const avatar = user.foto_perfil || (user.rol === 'docente' ? "../assets/img/avatar-defecto-docente.png" : "../assets/img/avatar-defecto-alumno.png");
        
        // Solo mostrar insignia de suscripción si no somos alumnos (opcional, según criterio)
        const showBadge = !isDocente && user.id_suscripcion_trabajador === 'currante';

        const card = `
            <article class="user-card" onclick="window.location.href='usuario.html?id=${user.uid}'">
                <img src="${avatar}" class="user-img">
                <div class="user-info">
                    <h3 style="display: flex; align-items: center; gap: 8px;">
                        ${user.nombre}
                        ${showBadge ? '<span class="priority-badge" style="background: var(--blue-3); color: var(--neutral-white); font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: bold;"><img src="../assets/img/icons/icono-estrella.png" style="width: 10px; filter: brightness(0) invert(1);">CURRANTE</span>' : ''}
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

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
    document.getElementById('page-info').innerText = `${currentPage} - ${totalPages}`;
    document.getElementById('prev-page').style.opacity = currentPage === 1 ? '0.3' : '1';
    document.getElementById('next-page').style.opacity = currentPage === totalPages ? '0.3' : '1';
}

document.getElementById('update-btn').onclick = () => {
    const cat = document.getElementById('filter-category').value;
    const lvl = parseInt(document.getElementById('filter-level').value);
    const minV = parseFloat(document.getElementById('val-min').value);
    const maxV = parseFloat(document.getElementById('val-max').value);

    const isFiltered = cat !== "todas" || lvl !== 1 || minV !== 0.0 || maxV !== 5.0;
    const iconHtml = '<img src="../assets/img/icons/icono-ajustes.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    document.querySelector('.section-title').innerHTML = isFiltered ? iconHtml + `${currentRoleLabel}: Filtrados` : iconHtml + `${currentRoleLabel}: Todos`;

    filteredUsers = usuariosData.filter(u => {
        const matchCat = (cat === "todas" || u.esp === cat || u.esp.includes(cat) || cat.includes(u.esp));
        const matchLvl = u.lvl >= lvl;
        const matchVal = parseFloat(u.val) >= minV && parseFloat(u.val) <= maxV;
        return matchCat && matchLvl && matchVal;
    });

    currentPage = 1;
    displayUsers();

    const sidebar = document.getElementById('sidebar');
    const mobileFilterBtn = document.getElementById('mobile-filter-btn');
    if (sidebar && sidebar.classList.contains('show-mobile-filters')) {
        sidebar.classList.remove('show-mobile-filters');
        if (mobileFilterBtn) mobileFilterBtn.classList.remove('active');
    }
};

document.getElementById('next-page').onclick = () => {
    if (currentPage < Math.ceil(filteredUsers.length / itemsPerPage)) {
        currentPage++;
        displayUsers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.getElementById('prev-page').onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        displayUsers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};