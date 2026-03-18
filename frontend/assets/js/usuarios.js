import { auth } from './firebase-config.js';
import { obtenerTodosLosUsuarios } from './database.js';

let usuariosData = [];
// Array global que mantendrá los usuarios actualmente mostrados después de ser filtrados
let filteredUsers = [];
// Variables para controlar la paginación de la lista
let currentPage = 1;
const itemsPerPage = 5;

document.addEventListener('DOMContentLoaded', async () => {
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
        container.innerHTML = "<p style='color:white; text-align:center;'>No se encontraron usuarios.</p>";
    }

    // Bucle para iterar y pintar cada uno de los elementos de la página actual
    pageItems.forEach((user) => {
        const avatar = user.foto_perfil || "../assets/img/avatar-defecto.png";
        const card = `
            <article class="user-card" onclick="window.location.href='usuario.html?id=${user.uid}'">
                <img src="${avatar}" class="user-img">
                <div class="user-info">
                    <h3>${user.nombre}</h3>
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