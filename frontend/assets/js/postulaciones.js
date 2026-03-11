// =====================================================
// JS de la página de Postulaciones
// Renderiza dos listas: trabajos donde te postulaste (izq)
// y usuarios que se han postulado para tus tareas (der)
// =====================================================

// --- DATOS MOCK: Trabajos a los que el usuario se ha postulado ---
const postulacionesTrabajos = [
    { id: 1, titulo: "Cortar el césped", desc: "Necesito a una persona que me corte el césped, se requiere de maquinaria y...", loc: "Barakaldo, Bizkaia, Calle La Paz 21, 2ºF", tiempo: 5, cat: "Jardinería", xp: 307, pago: 30.75, estado: "pendiente" },
    { id: 2, titulo: "Sacar al perro", desc: "Requiero de una persona para sacar a mi perro durante 2 horas por mi vecindario.", loc: "Castro Urdiales, Cantabria", tiempo: 2, cat: "Mascotas", xp: 205, pago: 20.5, estado: "aceptada" },
    { id: 3, titulo: "Montar un Ordenador", desc: "Necesito que alguien me monte el ordenador, tengo los componentes...", loc: "Sestao, Bizkaia", tiempo: 4, cat: "Informática", xp: 450, pago: 40, estado: "pendiente" },
    { id: 4, titulo: "Tarta Cumpleaños", desc: "Es el cumpleaños de mi hija, y necesito una tarta para su cumpleaños. La tarta des...", loc: "Sestao, Bizkaia", tiempo: 1, cat: "Informática", xp: 200, pago: 20, estado: "cancelada" },
    { id: 5, titulo: "Limpieza de Garaje", desc: "Limpieza general de un garaje privado tras una pequeña obra.", loc: "Portugalete, Bizkaia", tiempo: 6, cat: "Limpieza", xp: 600, pago: 60, estado: "pendiente" },
    { id: 6, titulo: "Poda de Setos", desc: "Recortar setos perimetrales de una finca de 800m2.", loc: "Laredo, Cantabria", tiempo: 4, cat: "Jardinería", xp: 400, pago: 40, estado: "aceptada" },
    { id: 7, titulo: "Paseo diario perros", desc: "Paseo de 1 hora por la mañana para dos Golden Retriever.", loc: "Getxo, Bizkaia", tiempo: 1, cat: "Mascotas", xp: 150, pago: 15, estado: "cancelada" },
    { id: 8, titulo: "Formatear Portátil", desc: "Instalación de sistema operativo y copia de seguridad de datos.", loc: "Santander, Cantabria", tiempo: 2, cat: "Informática", xp: 250, pago: 25, estado: "pendiente" },
    { id: 9, titulo: "Cena de Empresa", desc: "Catering para 10 personas en una oficina pequeña.", loc: "Basauri, Bizkaia", tiempo: 3, cat: "Gastronomía", xp: 1200, pago: 120, estado: "aceptada" },
    { id: 10, titulo: "Limpieza Ventanas", desc: "Limpieza de cristales en un piso de 3 habitaciones.", loc: "Barakaldo, Bizkaia", tiempo: 4, cat: "Limpieza", xp: 500, pago: 50, estado: "pendiente" },
    { id: 11, titulo: "Desbrozar Terreno", desc: "Eliminar maleza de un terreno de 100m2 en las afueras.", loc: "Castro Urdiales, Cantabria", tiempo: 8, cat: "Jardinería", xp: 1000, pago: 100, estado: "cancelada" },
    { id: 12, titulo: "Cuidado de Gatos", desc: "Visitar y alimentar a dos gatos durante el fin de semana.", loc: "Bilbao, Bizkaia", tiempo: 1, cat: "Mascotas", xp: 120, pago: 12, estado: "pendiente" }
];

// --- DATOS MOCK: Usuarios que se han postulado a tareas del perfil activo ---
const postulacionesUsuarios = [
    { id: 1, nombre: "Juan García Méndez", avatar: "../assets/img/Ibai.jpg", tarea: "Montar un armario" },
    { id: 2, nombre: "María Isabel Gómez Martín", avatar: "../assets/img/Ibai.jpg", tarea: "Diseñar una web" },
    { id: 3, nombre: "Carlos Rodríguez López", avatar: "../assets/img/Ibai.jpg", tarea: "Pasear al perro" },
    { id: 4, nombre: "Ana Fernández Torres", avatar: "../assets/img/Ibai.jpg", tarea: "Limpiar la cocina" },
    { id: 5, nombre: "Pedro Martínez Ruiz", avatar: "../assets/img/Ibai.jpg", tarea: "Cortar el césped" }
];

// --- PAGINACIÓN: solo para la columna de trabajos ---
const ITEMS_PER_PAGE = 5;
let currentPage = 1;
const totalPages = Math.ceil(postulacionesTrabajos.length / ITEMS_PER_PAGE);

// Renderiza la lista paginada de trabajos donde el usuario se ha postulado
function renderTrabajos() {
    const container = document.getElementById('jobs-list');
    container.innerHTML = '';

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const items = postulacionesTrabajos.slice(start, end);

    items.forEach(job => {
        const estadoClass = `status-${job.estado}`;
        const estadoText = job.estado.charAt(0).toUpperCase() + job.estado.slice(1);
        const pagoText = Number.isInteger(job.pago) ? job.pago : Number(job.pago).toFixed(2);

        const card = document.createElement('article');
        card.className = 'job-card';
        // Click en la tarjeta → trabajo.html
        card.onclick = () => { window.location.href = `trabajo.html?id=${job.id}`; };

        card.innerHTML = `
            <img src="../assets/img/principal1.png" class="job-card-img" alt="${job.titulo}">
            <div class="job-card-info">
                <h3 class="job-card-title">${job.titulo}</h3>
                <p class="job-card-desc">${job.desc}</p>
                <div class="job-card-meta">
                    <span><img src="../assets/img/icons/icono-ubicacion.png" alt=""> ${job.loc}</span>
                    <span><img src="../assets/img/icons/icono-relog.png" alt=""> Tiempo estimado: ${job.tiempo}h</span>
                    <span><img src="../assets/img/icons/icono-categoria.png" alt=""> Categoría: ${job.cat} (+1)</span>
                    <span><img src="../assets/img/icons/icono-xp.png" alt=""> Experiencia: <strong>${job.xp} XP</strong></span>
                </div>
                <div class="job-card-footer">
                    <span class="status-badge ${estadoClass}">${estadoText.toUpperCase()}</span>
                    <span class="job-card-pago"><img src="../assets/img/icons/icono-dinero.png" style="width:14px;height:14px;vertical-align:middle;margin-right:3px;" alt=""> Pago: <strong>${pagoText} €</strong></span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    document.getElementById('page-info').textContent = `${currentPage} - ${totalPages}`;
    document.getElementById('prev-page').style.opacity = currentPage === 1 ? '0.3' : '1';
    document.getElementById('next-page').style.opacity = currentPage === totalPages ? '0.3' : '1';
}

// Renderiza la lista de usuarios postulantes (sin paginación, dato estático)
function renderUsuarios() {
    const container = document.getElementById('users-list');
    container.innerHTML = '';

    postulacionesUsuarios.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-app-card';
        // Click en el card entero → perfil del usuario
        card.style.cursor = 'pointer';
        card.onclick = () => { window.location.href = `usuario.html?id=${user.id}`; };

        card.innerHTML = `
            <img src="${user.avatar}" class="user-app-img" alt="${user.nombre}">
            <div class="user-app-info">
                <p class="user-app-name">${user.nombre}</p>
                <p class="user-app-task">Ha postulado para tu realizar tu tarea:<br>
                    <strong class="user-task-link">${user.tarea}</strong>
                </p>
            </div>
            <button class="user-chat-btn" data-user="${user.nombre}" title="Chatear con ${user.nombre}">
                <img src="../assets/img/icons/icono-chat-2.png" alt="Chat">
            </button>
        `;
        container.appendChild(card);

        // Nombre de la tarea → mi-tarea.html (sin propagar al card)
        card.querySelector('.user-task-link').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = 'mi-tarea.html';
        });
    });

    // Vinculamos los botones de chat con el modal de confirmación
    container.querySelectorAll('.user-chat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // No propagar click al card
            const nombre = btn.dataset.user;
            showCustomConfirm(
                "Chatear con usuario",
                `¿Quieres chatear con este usuario?`,
                () => { window.location.href = 'chat.html'; },
                "Aceptar",
                "Cancelar"
            );
        });
    });
}

// Eventos de paginación
document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTrabajos();
        window.scrollTo(0, 0);
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderTrabajos();
        window.scrollTo(0, 0);
    }
});

// Inicializar
renderTrabajos();
renderUsuarios();
