// Evento global que se asegura de que el HTML esté completamente cargado antes de ejecutar el código de configuración
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DE CERRAR SESIÓN ---
    // Seleccionamos el botón de cerrar sesión y le añadimos un evento de clic que mostrará un diálogo de confirmación
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            showCustomConfirm(
                "Cerrar Sesión",
                "¿Estás seguro de que quieres cerrar sesión?",
                () => {
                    window.location.href = "../index.html";
                },
                "Cerrar Sesión",
                "Cancelar",
                "delete",
                true
            );
        });
    }

    // --- LÓGICA PARA CAMBIAR LA CONTRASEÑA ---
    // Obtenemos el botón para cambiar contraseña y la etiqueta donde se muestra ofuscada
    const btnChangePass = document.getElementById('btnChangePass');
    const passLabel = document.getElementById('passLabel');

    if (btnChangePass) {
        btnChangePass.addEventListener('click', (e) => {
            e.preventDefault();
            showCustomPrompt(
                "Cambiar Contraseña",
                "Introduce tu nueva contraseña:",
                (nuevaPass) => {
                    if (nuevaPass && nuevaPass.trim() !== "") {
                        showCustomAlert("Éxito", "Contraseña actualizada correctamente.");
                        passLabel.textContent = "*".repeat(nuevaPass.length);
                    }
                },
                "Actualizar",
                "Cancelar",
                "password"
            );
        });
    }

    // --- LÓGICA PARA BORRAR LA CUENTA ---
    // Seleccionamos el botón de borrar cuenta de la interfaz
    const btnDeleteAccount = document.getElementById('btnDeleteAccount');
    if (btnDeleteAccount) {
        btnDeleteAccount.addEventListener('click', (e) => {
            e.preventDefault();
            showCustomConfirm(
                "Borrar Cuenta",
                "¿Estás seguro de que quieres borrar tu cuenta? Todos tus datos se perderán de forma permanente.",
                () => {
                    window.location.href = "../index.html";
                },
                "Borrar definitivamente",
                "Cancelar",
                "delete",
                true // Centrar el texto de la pregunta solo en este modal
            );
        });
    }

    // --- MODAL DE EDICIÓN DE DATOS PERSONALES ---
    // Referencias a los contenedores y botones que controlan la ventana (modal) de edición de perfil
    const editModal = document.getElementById('editSettingsModal');
    const btnEditProfile = document.getElementById('btnEditProfile');
    const btnCancelEditSettings = document.getElementById('btnCancelEditSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');

    // Referencias a los campos de texto en la vista que muestran los datos actuales del usuario
    const displayNombre = document.getElementById('displayNombre');
    const displayApellidos = document.getElementById('displayApellidos');
    const displayDireccion = document.getElementById('displayDireccion');
    const displayFechaNac = document.getElementById('displayFechaNac');
    const displayDni = document.getElementById('displayDni');
    const displayTelefono = document.getElementById('displayTelefono');

    if (btnEditProfile) {
        btnEditProfile.onclick = () => {
            editModal.classList.remove('hidden');
            // Cargar valores actuales en los inputs
            document.getElementById('inputSetNombre').value = displayNombre.innerText;
            document.getElementById('inputSetApellidos').value = displayApellidos.innerText;
            document.getElementById('inputSetDireccion').value = displayDireccion.innerText;

            // Formatear la fecha para que el input de tipo "date" (año-mes-día) la entienda correctamente
            const dateParts = displayFechaNac.innerText.split('/');
            if (dateParts.length === 3) {
                document.getElementById('inputSetFechaNac').value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            } else {
                document.getElementById('inputSetFechaNac').value = displayFechaNac.innerText;
            }

            document.getElementById('inputSetDni').value = displayDni.innerText;
            document.getElementById('inputSetTelefono').value = displayTelefono.innerText;
        };
    }

    if (btnCancelEditSettings) {
        btnCancelEditSettings.onclick = () => {
            editModal.classList.add('hidden');
        };
    }

    if (btnSaveSettings) {
        btnSaveSettings.onclick = () => {
            // Recogemos todos los valores introducidos en el formulario
            const nom = document.getElementById('inputSetNombre').value.trim();
            const ape = document.getElementById('inputSetApellidos').value.trim();
            const fnac = document.getElementById('inputSetFechaNac').value.trim();
            const dni = document.getElementById('inputSetDni').value.trim();
            const dir = document.getElementById('inputSetDireccion').value.trim();
            const tel = document.getElementById('inputSetTelefono').value.trim();

            // Validación de los campos obligatorios del formulario
            if (!nom || !ape || !fnac || !dni) {
                showCustomAlert("Error", "Los campos Nombre, Apellidos, Fecha Nac. y DNI son obligatorios.");
                return;
            }

            // Si las validaciones pasan, ocultamos el modal
            editModal.classList.add('hidden');

            // Actualizamos la interfaz HTML con los nuevos datos introducidos
            displayNombre.innerText = nom;
            displayApellidos.innerText = ape;

            // Reformatear la fecha a dd/mm/yyyy para visualizarla
            const dParts = fnac.split('-');
            if (dParts.length === 3) {
                displayFechaNac.innerText = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
            } else {
                displayFechaNac.innerText = fnac;
            }

            displayDni.innerText = dni;
            // Actualizamos los campos opcionales. Si están vacíos usamos un texto por defecto
            displayDireccion.innerText = dir || 'No especificada';
            displayTelefono.innerText = tel || 'No especificado';
            // También actualizamos en el header si existe el campo
            const headerName = document.querySelector('.profile-name-header');
            if (headerName) {
                headerName.innerText = nom;
            }

            // Notificamos al usuario del éxito
            showCustomAlert("Éxito", "Datos actualizados correctamente.");
        };
    }

    // --- MODAL Y LOGICA AÑADIR MÉTODO DE PAGO ---
    const paymentModal = document.getElementById('paymentModal');
    const selectPaymentType = document.getElementById('selectPaymentType');
    const tarjetaFields = document.getElementById('tarjetaFields');
    const plataformaFields = document.getElementById('plataformaFields');
    const btnAddPayment = document.getElementById('btnAddPayment');
    const btnCancelPayment = document.getElementById('btnCancelPayment');
    const btnSavePayment = document.getElementById('btnSavePayment');

    // Cambiar dinámicamente qué campos se muestran según el tipo de pago elegido
    if (selectPaymentType) {
        selectPaymentType.addEventListener('change', (e) => {
            if (e.target.value === 'tarjeta') {
                tarjetaFields.style.display = 'block';
                plataformaFields.style.display = 'none';
            } else {
                tarjetaFields.style.display = 'none';
                plataformaFields.style.display = 'block';
            }
        });
    }

    // Evento para abrir el modal de añadir método de pago
    if (btnAddPayment) {
        btnAddPayment.addEventListener('click', (e) => {
            e.preventDefault(); // Evitamos que el botón haga submit o salto de ancla
            paymentModal.classList.remove('hidden');

            // Reiniciamos el estado por defecto del desplegable al tipo "tarjeta"
            if (selectPaymentType) {
                selectPaymentType.value = 'tarjeta';
                tarjetaFields.style.display = 'block';
                plataformaFields.style.display = 'none';
            }
            // Vaciamos todos los campos del formulario para que aparezcan en blanco
            document.getElementById('inputCardNumber').value = '';
            document.getElementById('inputCardExpiry').value = '';
            document.getElementById('inputCardCVV').value = '';
            document.getElementById('inputPlataformaEmail').value = '';
            document.getElementById('inputPlataformaPass').value = '';
        });
    }

    // Evento para cancelar y cerrar el modal de pagos sin guardar
    if (btnCancelPayment) {
        btnCancelPayment.addEventListener('click', () => {
            paymentModal.classList.add('hidden');
        });
    }

    // Evento para validar y guardar un nuevo método de pago
    if (btnSavePayment) {
        btnSavePayment.addEventListener('click', () => {
            let isValid = false;
            let listEntry = '';
            const type = selectPaymentType ? selectPaymentType.value : 'tarjeta';

            if (type === 'tarjeta') {
                const num = document.getElementById('inputCardNumber').value.trim();
                const exp = document.getElementById('inputCardExpiry').value.trim();
                const cvv = document.getElementById('inputCardCVV').value.trim();

                if (num && exp && cvv) {
                    isValid = true;
                    listEntry = `<li><span class="dot-icon">•</span> <strong>Nueva Tarjeta:</strong> **** - *${num.slice(-4)}</li>`;
                }
            } else {
                // Obtención de valores para plataforma y comprobación de validez
                const email = document.getElementById('inputPlataformaEmail').value.trim();
                const pass = document.getElementById('inputPlataformaPass').value.trim();

                if (email && pass) {
                    isValid = true;
                    // Clonamos el template para insertar una nueva plataforma de pago en la interfaz
                    const template = document.getElementById('payment-method-template-plataforma');
                    listEntry = template.content.cloneNode(true);
                    listEntry.querySelector('.platform-email').textContent = email;
                }
            }

            // Si los campos han sido validados correctamente
            if (isValid) {
                showCustomAlert("Éxito", "Método de pago añadido correctamente.");
                paymentModal.classList.add('hidden'); // Ocultar el modal

                // Insertar el elemento en la lista base de HTML
                const list = document.querySelector('.payment-methods');
                if (list && listEntry) {
                    list.appendChild(listEntry);
                }
            } else {
                showCustomAlert("Error", "Por favor, rellena todos los campos.");
            }
        });
    }

    // Evento global para cerrar cualquier modal si se hace clic fuera del recuadro de contenido
    window.addEventListener('click', (event) => {
        if (event.target == paymentModal) {
            paymentModal.classList.add('hidden');
        }
        if (event.target == editModal) {
            editModal.classList.add('hidden');
        }
    });

});
