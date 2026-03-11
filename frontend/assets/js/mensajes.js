// =====================================================
// MENSAJES - Lista de conversaciones activas
// =====================================================

// Datos mock: usuarios con los que hay conversación activa
const mensajesData = [
    { id: 1, nombre: "Juan García Méndez", avatar: "../assets/img/Ibai.jpg", trabajo: "Montar un armario" },
    { id: 2, nombre: "María Isabel Gómez Martín", avatar: "../assets/img/Ibai.jpg", trabajo: "Diseñar una web" },
    { id: 3, nombre: "Carlos Rodríguez López", avatar: "../assets/img/Ibai.jpg", trabajo: "Pasear al perro" },
    { id: 4, nombre: "Ana Fernández Torres", avatar: "../assets/img/Ibai.jpg", trabajo: "Limpiar la cocina" },
    { id: 5, nombre: "Pedro Martínez Ruiz", avatar: "../assets/img/Ibai.jpg", trabajo: "Cortar el césped" },
    { id: 6, nombre: "Laura Sánchez Díaz", avatar: "../assets/img/Ibai.jpg", trabajo: "Pintar habitación" },
    { id: 7, nombre: "Miguel Ángel Torres", avatar: "../assets/img/Ibai.jpg", trabajo: "Reparar ordenador" },
    { id: 8, nombre: "Elena Pérez García", avatar: "../assets/img/Ibai.jpg", trabajo: "Cuidar mascotas" }
];

// Paginación
const ITEMS_PER_PAGE = 4;
let currentPage = 1;
const totalPages = Math.ceil(mensajesData.length / ITEMS_PER_PAGE);

// Renderiza las tarjetas de conversación
function renderMensajes() {
    const container = document.getElementById('msgs-list');
    container.innerHTML = '';

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const items = mensajesData.slice(start, start + ITEMS_PER_PAGE);

    items.forEach(user => {
        const card = document.createElement('div');
        card.className = 'msg-card';
        // Click en el card → perfil del usuario
        card.onclick = () => { window.location.href = `usuario.html?id=${user.id}`; };

        card.innerHTML = `
            <img src="${user.avatar}" class="msg-avatar" alt="${user.nombre}">
            <div class="msg-info">
                <p class="msg-name">${user.nombre}</p>
                <p class="msg-label">Trabajo:</p>
                <button class="msg-job-link">${user.trabajo}</button>
            </div>
            <button class="msg-chat-btn" title="Abrir chat con ${user.nombre}">
                <img src="../assets/img/icons/icono-chat-2.png" alt="Chat">
            </button>
        `;
        container.appendChild(card);

        // Nombre del trabajo → trabajo.html (sin propagar al card)
        card.querySelector('.msg-job-link').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = 'trabajo.html';
        });

        // Botón chat → modal de confirmación → chat.html
        card.querySelector('.msg-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showCustomConfirm(
                "Abrir Chat",
                "¿Quieres chatear con este usuario?",
                () => { window.location.href = 'chat.html'; },
                "Aceptar",
                "Cancelar"
            );
        });
    });

    document.getElementById('page-info').textContent = `${currentPage} - ${totalPages}`;
    document.getElementById('prev-page').style.opacity = currentPage === 1 ? '0.3' : '1';
    document.getElementById('next-page').style.opacity = currentPage === totalPages ? '0.3' : '1';
}

// Paginación
document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderMensajes(); window.scrollTo(0, 0); }
});
document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage < totalPages) { currentPage++; renderMensajes(); window.scrollTo(0, 0); }
});

renderMensajes();
