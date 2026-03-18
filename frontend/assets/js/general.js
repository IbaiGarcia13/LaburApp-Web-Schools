import { auth, db } from './firebase-config.js';
import { obtenerPerfilUsuario, obtenerNotificaciones, marcarNotificacionesComoLeidas, eliminarNotificacion } from './database.js';
import { onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Evento global que inicializa el menú lateral y las acciones comunes en la barra superior al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // -- LÓGICA DE USUARIO EN CABECERA --
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            setupNotificationBadgeListener(user.uid);
            // Comprobar si han pasado más de 7 días (si se usó "Recordarme")
            const loginTimestamp = localStorage.getItem("loginTimestamp");
            if (loginTimestamp) {
                const sieteDiasEnMs = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - parseInt(loginTimestamp) > sieteDiasEnMs) {
                    console.log("Sesión expirada (7 días). Cerrando sesión...");
                    localStorage.removeItem("loginTimestamp");
                    auth.signOut().then(() => {
                        // Al estar en una subpágina, volvemos a la raíz
                        window.location.href = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
                    });
                    return;
                }
            }

            const perfil = await obtenerPerfilUsuario(user.uid);
            if (perfil) {
                const avatarUrl = perfil.foto_perfil || (window.location.pathname.includes('/pages/') ? '../assets/img/avatar-defecto.png' : 'frontend/assets/img/avatar-defecto.png');

                // Actualizar avatars en la cabecera
                const headerAvatar = document.getElementById('profileBtn');
                const dropdownAvatar = document.querySelector('.dropdown-avatar');
                if (headerAvatar) headerAvatar.src = avatarUrl;
                if (dropdownAvatar) dropdownAvatar.src = avatarUrl;

                // Actualizar nombre y email
                const dropdownName = document.querySelector('.dropdown-name');
                const dropdownEmail = document.querySelector('.dropdown-email');
                if (dropdownName) dropdownName.innerText = (perfil.nombre || "Usuario").split(' ')[0];
                if (dropdownEmail) dropdownEmail.innerText = user.email;
            }
        }
    });

    // Referencias al botón del menú hamburguesa y al contenedor del menú lateral
    const menuBtn = document.getElementById('menuBtn');
    const sideMenu = document.getElementById('sideMenu');

    if (menuBtn && sideMenu) {
        menuBtn.addEventListener('click', (e) => {
            const isOpening = !sideMenu.classList.contains('active');
            if (isOpening) {
                // Cerrar otros si estamos abriendo este
                if (profileDropdown) profileDropdown.classList.remove('show');
                toggleNotificationsPanel(false);
            }

            // Alterna la clase 'active' en el menú lateral para abrirlo
            sideMenu.classList.toggle('active');

            // Alterna la clase 'active' en el botón para el fondo gris
            menuBtn.classList.toggle('active');

            e.stopPropagation();
        });

        // Cerrar el menú y quitar el fondo gris al hacer clic fuera
        document.addEventListener('click', (e) => {
            // No cerrar si el clic es dentro del menú o del botón
            if (!sideMenu.contains(e.target) && !menuBtn.contains(e.target)) {
                sideMenu.classList.remove('active');
                menuBtn.classList.remove('active');
            }
        });
    }

    // -- LÓGICA DEL MENÚ DESPLEGABLE DEL PERFIL --
    // Referencias al botón del perfil (avatar) y su contenedor desplegable (dropdown)
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            const isOpening = !profileDropdown.classList.contains('show');
            if (isOpening) {
                // Cerrar otros
                if (sideMenu) {
                    sideMenu.classList.remove('active');
                    if (menuBtn) menuBtn.classList.remove('active');
                }
                toggleNotificationsPanel(false);
            }
            profileDropdown.classList.toggle('show');
            e.stopPropagation();
        });

        document.addEventListener('click', (e) => {
            if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });
    }

    // --- LÓGICA GLOBAL DE CERRAR SESIÓN ---
    // Seleccionar todos los enlaces que apuntan a index.html o ../index.html y contienen texto o icono de cerrar sesión
    const logoutLinks = document.querySelectorAll('a[href="../index.html"], a[href="index.html"]');

    logoutLinks.forEach(link => {
        // Verificar que sea efectivamente el enlace de cerrar sesión (por texto o cercanía a un icono)
        if (link.textContent.toLowerCase().includes('cerrar sesi') || link.parentElement.innerHTML.includes('icono-cerrar-sesion')) {
            link.addEventListener('click', (e) => {
                e.preventDefault(); // Evitar la redirección inmediata

                showCustomConfirm(
                    "Cerrar Sesión",
                    "¿Estás seguro de que quieres cerrar sesión?",
                    () => {
                        localStorage.removeItem("loginTimestamp");
                        auth.signOut().then(() => {
                            window.location.href = link.getAttribute('href');
                        }).catch((error) => {
                            console.error("Error al cerrar sesión:", error);
                            window.location.href = link.getAttribute('href');
                        });
                    },
                    "Cerrar Sesión",
                    "Cancelar",
                    "delete", // Se le pasa la clase 'delete' para que sea rojo
                    true
                );
            });
        }
    });

    // --- LÓGICA DE NOTIFICACIONES ---
    injectNotificationsHtml();
    setupNotificationsLogic();

});

function setupNotificationsLogic() {
    const sideMenu = document.getElementById('sideMenu');
    if (!sideMenu) return;

    // Buscamos el enlace de notificaciones (que añadiremos a los HTML)
    // O lo añadimos dinámicamente si no existe para asegurar cobertura
    let notifLink = document.getElementById('notifLink');
    if (!notifLink) {
        const ul = sideMenu.querySelector('ul');
        if (ul) {
            const li = document.createElement('li');
            li.innerHTML = `<img src="${window.location.pathname.includes('/pages/') ? '../assets/img/icons/icono-ajustes.png' : 'frontend/assets/img/icons/icono-ajustes.png'}"><a href="#" id="notifLink">Notificaciones</a>`;
            ul.appendChild(li);
            notifLink = li.querySelector('a');
        }
    }

    if (notifLink) {
        notifLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Cerrar otros al abrir notificaciones
            if (profileDropdown) profileDropdown.classList.remove('show');
            // Nota: Aquí no cerramos el sideMenu obligatoriamente porque 
            // a veces las notificaciones salen ENCIMA del sideMenu, 
            // pero el usuario pidió que se cierren.
            if (sideMenu) {
                sideMenu.classList.remove('active');
                if (menuBtn) menuBtn.classList.remove('active');
            }

            toggleNotificationsPanel(true);
        });
    }

    const closeBtn = document.getElementById('closeNotifPanel');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleNotificationsPanel(false));
    }
}

async function toggleNotificationsPanel(show) {
    const panel = document.getElementById('notificationsPanel');
    if (!panel) return;

    if (show) {
        panel.classList.add('active');
        // Al abrir, cargamos notificaciones
        await renderNotifications();
    } else {
        panel.classList.remove('active');
        // Al cerrar, marcamos como leídas
        const user = auth.currentUser;
        if (user) {
            await marcarNotificacionesComoLeidas(user.uid);
        }
    }
}

async function renderNotifications() {
    const container = document.getElementById('notifHeaderList'); // El contenedor de la lista
    if (!container) return;

    const user = auth.currentUser;
    if (!user) {
        container.innerHTML = "<p class='notif-empty'>Inicia sesión para ver notificaciones.</p>";
        return;
    }

    container.innerHTML = "<div class='notif-loader'>Cargando...</div>";

    try {
        const notifs = await obtenerNotificaciones(user.uid);
        if (notifs.length === 0) {
            container.innerHTML = "<p class='notif-empty'>No tienes notificaciones todavía.</p>";
            return;
        }

        container.innerHTML = "";
        notifs.forEach(n => {
            const date = n.fecha?.toDate ? n.fecha.toDate().toLocaleString() : "";
            const item = document.createElement('div');
            item.className = `notif-item ${n.leida ? 'read' : 'unread'} type-${n.tipo}`;
            item.innerHTML = `
                <button class="notif-delete" title="Eliminar">×</button>
                <div class="notif-icon-box">
                    <img src="${getNotifIcon(n.tipo)}" alt="">
                </div>
                <div class="notif-content">
                    <h4>${n.titulo}</h4>
                    <p>${n.mensaje}</p>
                    <span class="notif-date">${date}</span>
                </div>
            `;

            const delBtn = item.querySelector('.notif-delete');
            delBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    await eliminarNotificacion(user.uid, n.id);
                    item.style.opacity = '0';
                    item.style.transform = 'translateX(20px)';
                    setTimeout(() => {
                        item.remove();
                        if (container.children.length === 0) {
                            container.innerHTML = "<p class='notif-empty'>No tienes notificaciones todavía.</p>";
                        }
                    }, 300);
                } catch (err) {
                    console.error("Error eliminando notificación:", err);
                }
            };

            // Redirección al hacer click
            item.style.cursor = 'pointer';
            item.onclick = async () => {
                let targetUrl = null;
                const isPage = window.location.pathname.includes('/pages/');
                const prefix = isPage ? '' : 'pages/';

                switch (n.tipo) {
                    case 'nueva_postulacion':
                        targetUrl = prefix + 'postulaciones.html';
                        break;
                    case 'nuevo_trabajo':
                        if (n.id_trabajo) targetUrl = prefix + `mi-trabajo.html?id=${n.id_trabajo}`;
                        break;
                    case 'nivel':
                        targetUrl = prefix + 'perfil.html';
                        break;
                    case 'tarea_empezada':
                        if (n.id_trabajo) targetUrl = prefix + `mi-tarea.html?id=${n.id_trabajo}`;
                        break;
                }

                // Si tiene destino, redirigimos y borramos
                if (targetUrl) {
                    try {
                        await eliminarNotificacion(user.uid, n.id);
                        window.location.href = targetUrl;
                    } catch (err) {
                        console.error("Error al procesar click en notificación:", err);
                    }
                }
            };

            container.appendChild(item);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = "<p class='notif-empty'>Error al cargar notificaciones.</p>";
    }
}

function getNotifIcon(tipo) {
    const base = window.location.pathname.includes('/pages/') ? '../assets/img/icons/' : 'frontend/assets/img/icons/';
    switch (tipo) {
        // Nuevos tipos
        case 'nivel': return base + 'noti/icono-noti-nivel.png';
        case 'mensaje': return base + 'noti/icono-noti-nuevo-mensaje.png';
        case 'pago': return base + 'noti/icono-noti-pago.png';
        case 'suscripcion': return base + 'noti/icono-noti-suscripcion.png';
        case 'valoracion': return base + 'noti/icono-noti-valoracion.png';
        case 'tarea_empezada': return base + 'noti/icono-noti-tarea-empezada.png';
        case 'nuevo_trabajo': return base + 'noti/icono-noti-nuevo-trabajo.png';
        case 'nueva_postulacion': return base + 'noti/icono-noti-nueva-postulacion.png';
        case 'rechazado': return base + 'icono-no-blanco.png';
        case 'aceptado': return base + 'icono-si-blanco.png';
        // Base / Otros
        case 'info': return base + 'icono-notificaciones.png';
        default: return base + 'icono-notificaciones.png';
    }
}

function injectNotificationsHtml() {
    if (document.getElementById('notificationsPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'notificationsPanel';
    panel.className = 'notifications-sidebar';
    panel.innerHTML = `
        <div class="notif-sidebar-header">
            <h3>Notificaciones</h3>
            <button id="closeNotifPanel">&times;</button>
        </div>
        <div class="notif-sidebar-body" id="notifHeaderList">
            <!-- Las notificaciones se inyectan aquí -->
        </div>
    `;
    document.body.appendChild(panel);
}

/* --- MODAL GLOBAL (Alerts & Confirms) --- */
// Función principal que inyecta en tiempo de ejecución o recupera (si ya existe) la estructura base del modal de alertas global en el body de la página.
function injectModalHtml() {
    let modal = document.getElementById('global-custom-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'global-custom-modal';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 id="global-modal-title"></h3>
                <p id="global-modal-message"></p>
                <div class="modal-buttons" id="global-modal-buttons"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    return modal;
}

// Función para mostrar una alerta genérica con 1 solo botón
window.showCustomAlert = function (title, message, btnText = "Aceptar") {
    const modal = injectModalHtml();
    document.getElementById('global-modal-title').innerText = title;

    const msgEl = document.getElementById('global-modal-message');
    msgEl.innerText = message;
    msgEl.style.textAlign = ''; // Reset alignment

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `<button class="modal-btn confirm" id="global-modal-ok">${btnText}</button>`;

    modal.classList.remove('hidden');

    document.getElementById('global-modal-ok').onclick = () => {
        modal.classList.add('hidden');
    };
};

// Función genérica para solicitar una confirmación binaria al usuario (Aceptar / Cancelar)
window.showCustomConfirm = function (title, message, onConfirm, confirmText = "Aceptar", cancelText = "Cancelar", confirmClass = "confirm", centerText = false) {
    const modal = injectModalHtml();
    document.getElementById('global-modal-title').innerText = title;

    const msgEl = document.getElementById('global-modal-message');
    msgEl.innerText = message;
    msgEl.style.textAlign = centerText ? 'center' : '';

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `
        <button class="modal-btn cancel" id="global-modal-cancel">${cancelText}</button>
        <button class="modal-btn ${confirmClass}" id="global-modal-confirm">${confirmText}</button>
    `;

    modal.classList.remove('hidden');

    document.getElementById('global-modal-cancel').onclick = () => {
        modal.classList.add('hidden');
    };

    document.getElementById('global-modal-confirm').onclick = () => {
        modal.classList.add('hidden');
        if (typeof onConfirm === 'function') onConfirm();
    };
};

// Función genérica para cuando se requiere pedir un dato al usuario de manera activa usando modales (como el cambio de contraseña)
window.showCustomPrompt = function (title, message, onConfirm, confirmText = "Aceptar", cancelText = "Cancelar", inputType = "text") {
    const modal = injectModalHtml();
    document.getElementById('global-modal-title').innerText = title;

    const msgEl = document.getElementById('global-modal-message');
    msgEl.style.textAlign = ''; // Reset alignment

    // Convertir el message en HTML para incluir un input
    msgEl.innerHTML = `
        <span>${message}</span><br>
        <input type="${inputType}" id="global-modal-input" class="modal-input" style="margin-top: 15px;">
    `;

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `
        <button class="modal-btn cancel" id="global-modal-cancel">${cancelText}</button>
        <button class="modal-btn confirm" id="global-modal-confirm">${confirmText}</button>
    `;

    modal.classList.remove('hidden');

    // Enfocar el input
    setTimeout(() => document.getElementById('global-modal-input').focus(), 100);

    document.getElementById('global-modal-cancel').onclick = () => {
        modal.classList.add('hidden');
    };

    document.getElementById('global-modal-confirm').onclick = () => {
        modal.classList.add('hidden');
        const val = document.getElementById('global-modal-input').value;
        if (typeof onConfirm === 'function') onConfirm(val);
    };
};
// --- LÓGICA DEL BADGE DE NOTIFICACIONES ---
function setupNotificationBadgeListener(uid) {
    const notifLink = document.getElementById('notifLink');
    if (!notifLink) return;

    // Buscamos o creamos el badge dentro del link de notificaciones
    let badge = notifLink.querySelector('.notif-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-badge hidden';
        notifLink.appendChild(badge);
    }

    const q = query(
        collection(db, "usuarios", uid, "notificaciones")
    );

    onSnapshot(q, (snapshot) => {
        const count = snapshot.size;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}
