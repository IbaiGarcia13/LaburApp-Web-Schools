document.addEventListener('DOMContentLoaded', () => {

    // --- CERRAR SESIÓN ---
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
                "delete"
            );
        });
    }

    // --- CAMBIAR CONTRASEÑA ---
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

    // --- BORRAR CUENTA ---
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
                "delete"
            );
        });
    }

    // --- MODAL DE EDICIÓN DE DATOS PERSONALES ---
    const editModal = document.getElementById('editSettingsModal');
    const btnEditProfile = document.getElementById('btnEditProfile');
    const btnCancelEditSettings = document.getElementById('btnCancelEditSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');

    // Elementos de la página a actualizar
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

            // Format for <input type="date"> (yyyy-mm-dd)
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
            displayNombre.innerText = document.getElementById('inputSetNombre').value;
            displayApellidos.innerText = document.getElementById('inputSetApellidos').value;
            displayDireccion.innerText = document.getElementById('inputSetDireccion').value;

            // Convert back to dd/mm/yyyy
            const dateVal = document.getElementById('inputSetFechaNac').value;
            if (dateVal && dateVal.includes('-')) {
                const parts = dateVal.split('-');
                displayFechaNac.innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
                displayFechaNac.innerText = dateVal;
            }

            displayDni.innerText = document.getElementById('inputSetDni').value;
            displayTelefono.innerText = document.getElementById('inputSetTelefono').value;

            showCustomAlert("Éxito", "Datos personales actualizados correctamente.");
            editModal.classList.add('hidden');
        };
    }

    // --- MODAL AÑADIR MÉTODO DE PAGO ---
    const paymentModal = document.getElementById('paymentModal');
    const btnAddPayment = document.getElementById('btnAddPayment');
    const btnCancelPayment = document.getElementById('btnCancelPayment');
    const btnSavePayment = document.getElementById('btnSavePayment');

    if (btnAddPayment) {
        btnAddPayment.addEventListener('click', (e) => {
            e.preventDefault();
            paymentModal.style.display = 'block';
        });
    }

    if (btnCancelPayment) {
        btnCancelPayment.addEventListener('click', () => {
            paymentModal.style.display = 'none';
        });
    }

    if (btnSavePayment) {
        btnSavePayment.addEventListener('click', () => {
            const num = document.getElementById('inputCardNumber').value;
            const exp = document.getElementById('inputCardExpiry').value;
            const cvv = document.getElementById('inputCardCVV').value;

            if (num && exp && cvv) {
                showCustomAlert("Éxito", "Método de pago añadido correctamente.");
                paymentModal.style.display = 'none';

                // Opcional: añadir la nueva tarjeta a la lista (Visualmente)
                const list = document.querySelector('.payment-methods');
                const last4 = num.slice(-4);
                const li = document.createElement('li');
                li.innerHTML = `<span class="dot-icon">•</span> <strong>Nueva Tarjeta:</strong> **** - *${last4}`;
                list.appendChild(li);

                // Limpiar inputs
                document.getElementById('inputCardNumber').value = '';
                document.getElementById('inputCardExpiry').value = '';
                document.getElementById('inputCardCVV').value = '';

            } else {
                showCustomAlert("Error", "Por favor, rellena todos los campos.");
            }
        });
    }

    // Cerrar modales clicando fuera
    window.addEventListener('click', (event) => {
        if (event.target == paymentModal) {
            paymentModal.style.display = "none";
        }
        if (event.target == editModal) {
            editModal.classList.add('hidden');
        }
    });

});
