import { auth, db } from './firebase-config.js';
import {
    obtenerPerfilUsuario,
    obtenerNotificaciones,
    marcarNotificacionesComoLeidas,
    eliminarNotificacion,
    actualizarActividadSuscripcion,
    obtenerTareasPendientesConfirmacion,
    registrarRespuestaConfirmacion,
    verificarSuscripcionesRecurrentes
} from './database.js';
import { onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initCookieConsent } from './cookies.js';

// Evento global que inicializa el menú lateral y las acciones comunes en la barra superior al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // -- LÓGICA DE USUARIO EN CABECERA --
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            setupNotificationBadgeListener(user.uid);

            // Inyectar notificaciones solo para usuarios autenticados
            injectNotificationsHtml();
            setupNotificationsLogic();

            // Comprobar si han pasado más de 7 días (si se usó "Recordarme")
            const loginTimestamp = localStorage.getItem("loginTimestamp");
            if (loginTimestamp) {
                const sieteDiasEnMs = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - parseInt(loginTimestamp) > sieteDiasEnMs) {
                    console.log("Sesión expirada (7 días). Cerrando sesión...");
                    localStorage.removeItem("loginTimestamp");
                    auth.signOut().then(() => {
                        window.location.href = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
                    });
                    return;
                }
            }

            const perfil = await obtenerPerfilUsuario(user.uid);
            if (perfil) {
                // Actualizar actividad si tiene suscripción activa (Prioridad en listas)
                // Actualizar siempre la actividad para refrescar prioridad o quitarla si ya no es suscriptor
                actualizarActividadSuscripcion(user.uid).catch(e => {
                    console.error("Error actualizando actividad suscripción:", e);
                });

                // Verificar y procesar renovaciones automáticas de suscripciones
                verificarSuscripcionesRecurrentes(user.uid).catch(e => {
                    console.error("Error verificando suscripciones recurrentes:", e);
                });

                const avatarUrl = perfil.foto_perfil || (window.location.pathname.includes('/pages/') ? '../assets/img/avatar-defecto.png' : 'frontend/assets/img/avatar-defecto.png');

                // Actualizar avatars en la cabecera
                const headerAvatar = document.getElementById('profileBtn');
                const dropdownAvatar = document.querySelector('.dropdown-avatar');
                if (headerAvatar) headerAvatar.src = avatarUrl;
                if (dropdownAvatar) dropdownAvatar.src = avatarUrl;

                // Actualizar nombre y email
                const dropdownName = document.querySelector('.dropdown-name');
                const dropdownEmail = document.querySelector('.dropdown-email');
                if (dropdownEmail) dropdownEmail.innerText = user.email;

                // --- NUEVO: Chequeo de tareas vencidas que requieren confirmación ---
                checkExpiredTasks(user.uid);
            }
        }
    });

    // Referencias al botón del menú hamburguesa y al contenedor del menú lateral
    const menuBtn = document.getElementById('menuBtn');
    const sideMenu = document.getElementById('sideMenu');

    // Función auxiliar global para cerrar filtros móviles si existen en la página
    function closeMobileFilters() {
        const filters = document.querySelectorAll('.show-mobile-filters');
        filters.forEach(f => f.classList.remove('show-mobile-filters'));
        const filterBtn = document.getElementById('mobile-filter-btn');
        if (filterBtn) {
            filterBtn.classList.remove('active');
            filterBtn.style.opacity = '1';
        }
    }

    if (menuBtn && sideMenu) {
        menuBtn.addEventListener('click', (e) => {
            const isOpening = !sideMenu.classList.contains('active');
            if (isOpening) {
                // Cerrar otros si estamos abriendo este
                if (profileDropdown) profileDropdown.classList.remove('show');
                toggleNotificationsPanel(false);
                closeMobileFilters();
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
                closeMobileFilters();
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
    function procesarCerrarSesion(href) {
        showCustomConfirm(
            "Cerrar Sesión",
            "¿Estás seguro de que quieres cerrar sesión?",
            () => {
                localStorage.removeItem("loginTimestamp");
                auth.signOut().then(() => {
                    window.location.href = href;
                }).catch((error) => {
                    console.error("Error al cerrar sesión:", error);
                    window.location.href = href;
                });
            },
            "Cerrar Sesión",
            "Cancelar",
            "delete", // Se le pasa la clase 'delete' para que sea rojo
            true
        );
    }

    // 1. Enlaces individuales (en el dropdown del perfil, etc.)
    const logoutLinks = document.querySelectorAll('a[href="../index.html"], a[href="index.html"]');
    logoutLinks.forEach(link => {
        if (link.textContent.toLowerCase().includes('cerrar sesi') || link.parentElement.innerHTML.includes('icono-cerrar-sesion')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                procesarCerrarSesion(link.getAttribute('href'));
            });
        }
    });

    // 2. Caja completa del Side Menu Footer
    const sideMenuFooter = document.querySelector('.side-menu-footer');
    if (sideMenuFooter) {
        sideMenuFooter.addEventListener('click', (e) => {
            const link = sideMenuFooter.querySelector('a');
            const href = link ? link.getAttribute('href') : (window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html');
            procesarCerrarSesion(href);
        });
    }

    // 3. Caja completa del Dropdown Footer (especialmente para móvil donde el texto está oculto)
    const dropdownFooter = document.querySelector('.profile-dropdown .dropdown-footer');
    if (dropdownFooter) {
        dropdownFooter.addEventListener('click', (e) => {
            const link = dropdownFooter.querySelector('a');
            if (link) {
                procesarCerrarSesion(link.getAttribute('href'));
            }
        });
    }

    // 4. Botones de Logout generales en tarjetas (clase .logout-action)
    document.querySelectorAll('.logout-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const link = btn.querySelector('a');
            const href = link ? link.getAttribute('href') : (window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html');
            procesarCerrarSesion(href);
        });
    });

    // --- LÓGICA DE CONSENTIMIENTO DE COOKIES (RGPD) ---
    initCookieConsent();

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
                    case 'trabajo_cancelado':
                        if (n.id_trabajo) targetUrl = prefix + `mi-trabajo.html?id=${n.id_trabajo}`;
                        break;
                    case 'tarea_abandonada':
                        if (n.id_trabajo) targetUrl = prefix + `mi-tarea.html?id=${n.id_trabajo}`;
                        break;
                    case 'pago':
                        targetUrl = prefix + 'ajustes.html#paymentHistoryContainer';
                        break;
                    case 'mensaje':
                        targetUrl = prefix + 'mensajes.html';
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
        case 'trabajo_cancelado': return base + 'icono-no-blanco.png';
        case 'tarea_abandonada': return base + 'icono-no-blanco.png';
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
window.showCustomAlert = function (title, message, btnText = "Aceptar", onClose = null) {
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
        if (typeof onClose === 'function') onClose();
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

// Función específica para el cambio de contraseña con doble campo e iconos de ojo
window.showChangePasswordModal = function (onConfirm) {
    const modal = injectModalHtml();
    document.getElementById('global-modal-title').innerText = "Cambiar Contraseña";

    const msgEl = document.getElementById('global-modal-message');
    msgEl.innerHTML = `
        <div class="password-modal-container">
            <p style="margin-bottom: 20px; text-align: left; color: var(--gray-5);">Gestiona tu seguridad con una nueva clave.</p>
            
            <div class="modal-input-group">
                <label>Nueva Contraseña:</label>
                <div class="modal-pass-wrapper">
                    <input type="password" id="passNew" class="modal-input-pass" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
                    <button type="button" class="eye-toggle" data-target="passNew">
                        <img src="${getIconPath('icono-ojo-si.png')}" alt="Ver">
                    </button>
                </div>
            </div>

            <div class="modal-input-group" style="margin-top: 20px;">
                <label>Repetir Contraseña:</label>
                <div class="modal-pass-wrapper">
                    <input type="password" id="passRepeat" class="modal-input-pass" placeholder="Repite la clave" autocomplete="new-password">
                    <button type="button" class="eye-toggle" data-target="passRepeat">
                        <img src="${getIconPath('icono-ojo-si.png')}" alt="Ver">
                    </button>
                </div>
            </div>
            <p id="modalPassError" style="color: var(--red-2); font-size: 13px; margin-top: 10px; display: none; text-align: left;"></p>
        </div>
    `;

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `
        <button class="modal-btn cancel" id="global-modal-cancel">Cancelar</button>
        <button class="modal-btn confirm" id="global-modal-confirm">Actualizar</button>
    `;

    modal.classList.remove('hidden');

    // Toggle eye icons
    modal.querySelectorAll('.eye-toggle').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const img = btn.querySelector('img');
            if (input.type === 'password') {
                input.type = 'text';
                img.src = getIconPath('icono-ojo-no.png');
            } else {
                input.type = 'password';
                img.src = getIconPath('icono-ojo-si.png');
            }
        };
    });

    document.getElementById('global-modal-cancel').onclick = () => modal.classList.add('hidden');

    document.getElementById('global-modal-confirm').onclick = () => {
        const p1 = document.getElementById('passNew').value.trim();
        const p2 = document.getElementById('passRepeat').value.trim();
        const err = document.getElementById('modalPassError');

        if (p1.length < 6) {
            err.textContent = "La contraseña debe tener al menos 6 caracteres.";
            err.style.display = "block";
            return;
        }
        if (p1 !== p2) {
            err.textContent = "Las contraseñas no coinciden.";
            err.style.display = "block";
            return;
        }

        modal.classList.add('hidden');
        if (typeof onConfirm === 'function') onConfirm(p1);
    };

    function getIconPath(name) {
        const isPage = window.location.pathname.includes('/pages/');
        return isPage ? `../assets/img/icons/${name}` : `assets/img/icons/${name}`;
    }
};

/**
 * --- LÓGICA DE CONFIRMACIÓN DE TAREAS VENCIDAS ---
 */

async function checkExpiredTasks(uid) {
    try {
        const tareas = await obtenerTareasPendientesConfirmacion(uid);
        if (tareas.length > 0) {
            // Mostramos el modal para la primera tarea que necesite atención
            showMandatoryCompletionModal(tareas[0]);
        }
    } catch (e) {
        console.error("Error al comprobar tareas vencidas:", e);
    }
}

function showMandatoryCompletionModal(tarea) {
    const isPublicador = tarea.es_publicador;
    const title = "Confirmación Obligatoria";
    const question = isPublicador
        ? `¿El trabajador ha completado el trabajo "${tarea.titulo}"?`
        : `¿Has completado el trabajo "${tarea.titulo}"?`;

    const modal = injectModalHtml();

    // Configurar contenido
    document.getElementById('global-modal-title').innerText = title;
    const msgEl = document.getElementById('global-modal-message');
    msgEl.innerText = question;
    msgEl.style.textAlign = 'center';
    msgEl.style.fontWeight = '600';

    const btnContainer = document.getElementById('global-modal-buttons');
    btnContainer.innerHTML = `
        <button class="modal-btn confirm" id="modal-resp-si" style="flex: 1;">Sí</button>
        <button class="modal-btn cancel" id="modal-resp-no" style="flex: 1;">No</button>
        <button class="modal-btn" id="modal-resp-espera" style="flex: 1; background: var(--gray-3); color: white;">Espera</button>
    `;

    // Mostrar modal
    modal.classList.remove('hidden');

    const responder = async (respuesta) => {
        try {
            await registrarRespuestaConfirmacion(tarea.id, auth.currentUser.uid, respuesta);
            modal.classList.add('hidden');

            // Si hay más tareas, el siguiente recargo las mostrará.
            if (respuesta === 'si' || respuesta === 'no') {
                showCustomAlert("Respuesta Registrada", "Gracias por tu respuesta. Se procesará la resolución adecuada.");
            }
        } catch (e) {
            console.error("Error al registrar respuesta:", e);
            showCustomAlert("Error", "No se pudo registrar tu respuesta. Inténtalo de nuevo.");
        }
    };

    document.getElementById('modal-resp-si').onclick = () => responder('si');
    document.getElementById('modal-resp-no').onclick = () => responder('no');
    document.getElementById('modal-resp-espera').onclick = () => responder('espera');
}
