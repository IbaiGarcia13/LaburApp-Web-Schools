// Evento global que inicializa el menú lateral y las acciones comunes en la barra superior al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Referencias al botón del menú hamburguesa y al contenedor del menú lateral
    const menuBtn = document.getElementById('menuBtn');
    const sideMenu = document.getElementById('sideMenu');

    if (menuBtn && sideMenu) {
        menuBtn.addEventListener('click', (e) => {
            // Alterna la clase 'active' en el menú lateral para abrirlo
            sideMenu.classList.toggle('active');

            // Alterna la clase 'active' en el botón para el fondo gris
            menuBtn.classList.toggle('active');

            e.stopPropagation();
        });

        // Cerrar el menú y quitar el fondo gris al hacer clic fuera
        document.addEventListener('click', () => {
            sideMenu.classList.remove('active');
            menuBtn.classList.remove('active'); // Quita el fondo gris
        });
    }

    // -- LÓGICA DEL MENÚ DESPLEGABLE DEL PERFIL --
    // Referencias al botón del perfil (avatar) y su contenedor desplegable (dropdown)
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            profileDropdown.classList.toggle('show');
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            profileDropdown.classList.remove('show');
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
                        window.location.href = link.getAttribute('href');
                    },
                    "Cerrar Sesión",
                    "Cancelar",
                    "delete", // Se le pasa la clase 'delete' para que sea rojo
                    true
                );
            });
        }
    });

});

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
