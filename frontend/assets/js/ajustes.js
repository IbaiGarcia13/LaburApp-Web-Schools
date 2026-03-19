import { auth, db } from './firebase-config.js';
import { obtenerPerfilUsuario, actualizarPerfilUsuario, obtenerMetodosPago, obtenerHistorialPagos, agregarMetodoPago, registrarPagoHistorial } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    // Referencias UI Cuenta
    const passLabel = document.getElementById('passLabel');
    const btnChangePass = document.getElementById('btnChangePass');

    // --- MODAL DE EDICIÓN DE DATOS PERSONALES ---
    const editModal = document.getElementById('editSettingsModal');
    const btnEditProfile = document.getElementById('btnEditProfile');
    const btnCancelEditSettings = document.getElementById('btnCancelEditSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');

    // Referencias a textos a rellenar
    const displayNombre = document.getElementById('displayNombre');
    const displayApellidos = document.getElementById('displayApellidos');
    const displayDireccion = document.getElementById('displayDireccion');
    const displayFechaNac = document.getElementById('displayFechaNac');
    const displayDni = document.getElementById('displayDni');
    const displayTelefono = document.getElementById('displayTelefono');

    // Contenedores para Suscripciones, Pagos e Historial
    const settingsCards = document.querySelectorAll('.settings-card');
    let subsBody = null;
    let paymentsList = null;
    let historyContainer = null;

    settingsCards.forEach(card => {
        const title = card.querySelector('.card-title')?.textContent || "";
        if (title.includes('Suscripciones')) subsBody = card.querySelector('.card-body');
        if (title.includes('Método de Pago')) paymentsList = card.querySelector('.payment-methods');
        if (title.includes('Historial de Pagos')) historyContainer = card.querySelector('.card-body');
    });

    // Cargar los datos reales desde Firestore
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const perfil = await obtenerPerfilUsuario(user.uid);
                if (perfil) {
                    if (displayNombre) displayNombre.textContent = perfil.nombre || "";
                    if (displayApellidos) displayApellidos.textContent = perfil.apellidos || "";
                    if (displayDireccion) displayDireccion.textContent = perfil.direccion_principal || "No especificada";
                    if (displayFechaNac) displayFechaNac.textContent = perfil.fecha_ingreso || "";
                    if (displayDni) displayDni.textContent = perfil.dni || "";
                    if (displayTelefono) displayTelefono.textContent = perfil.telefono || "No especificado";

                    // Update email on the view
                    const emailDisplays = document.querySelectorAll('p strong');
                    emailDisplays.forEach(el => {
                        if (el.textContent.includes('Correo electrónico')) {
                            el.parentElement.innerHTML = `<strong>Correo electrónico:</strong> ${user.email}`;
                        }
                    });

                    // --- 1. RENDER SUSCRIPCIONES ---
                    if (subsBody) {
                        const sTrabajador = perfil.id_suscripcion_trabajador || "ninguna";
                        const sCliente = perfil.id_suscripcion_cliente || "ninguna";

                        let tHtml = `<strong>Suscripcion Trabajador:</strong> `;
                        if (sTrabajador.toLowerCase() !== "ninguna") {
                            tHtml += `<img src="../assets/img/icons/icono-suscripciones.png" class="icon-img" alt="Diamante"> ${sTrabajador.toUpperCase()}`;
                        } else {
                            tHtml += `Ninguna`;
                        }

                        let cHtml = `<strong>Suscripción Cliente:</strong> `;
                        if (sCliente.toLowerCase() !== "ninguna") {
                            cHtml += `<img src="../assets/img/icons/icono-suscripciones.png" class="icon-img" alt="Diamante"> ${sCliente.toUpperCase()}`;
                        } else {
                            cHtml += `Ninguna`;
                        }
                        subsBody.innerHTML = `<p>${tHtml}</p><p>${cHtml}</p>`;
                    }
                }

                // --- 2. RENDER MÉTODOS DE PAGO ---
                if (paymentsList) {
                    const metodos = await obtenerMetodosPago(user.uid);
                    paymentsList.innerHTML = "";

                    if (metodos.length === 0) {
                        paymentsList.innerHTML = "<p style='color: #666; font-style: italic;'>No tienes métodos de pago registrados.</p>";
                    } else {
                        // Separar por tipos y encontrar favorito
                        const tarjetas = metodos.filter(m => m.tipo === "Tarjeta Bancaria");
                        const plataformas = metodos.filter(m => m.tipo !== "Tarjeta Bancaria");

                        const renderMetodo = (m) => {
                            const favor = m.favorito ? `<img src="../assets/img/icons/icono-estrella.png" class="icon-img-small" alt="Favorito"> ` : "";
                            const li = document.createElement('li');
                            li.innerHTML = `${favor} <strong>${m.tipo}:</strong> ${m.detalle}`;
                            return li;
                        };

                        tarjetas.forEach(m => paymentsList.appendChild(renderMetodo(m)));
                        plataformas.forEach(m => {
                            const p = document.createElement('p');
                            const favor = m.favorito ? `<img src="../assets/img/icons/icono-estrella.png" class="icon-img-small" alt="Favorito"> ` : "";
                            p.innerHTML = `${favor} <strong>${m.tipo}:</strong> ${m.detalle}`;
                            paymentsList.appendChild(p);
                        });
                    }
                }

                // --- 3. RENDER HISTORIAL DE PAGOS ---
                if (historyContainer) {
                    const historial = await obtenerHistorialPagos(user.uid);
                    if (historial.length === 0) {
                        // Si no hay pagos, vaciamos la sección o ponemos mensaje (según petición: "no saldrá ningún registro")
                        historyContainer.innerHTML = "<p style='color: #666; font-style: italic;'>Aún no has realizado ningún movimiento de pago.</p>";
                    } else {
                        let html = '<div class="payment-history">';
                        historial.forEach(p => {
                            const fecha = p.fecha_emision?.toDate ? p.fecha_emision.toDate().toLocaleDateString() : "Reciente";
                            const montoClase = p.monto < 0 ? 'negative-amount' : ''; // Para estilo visual si se desea
                            html += `
                                <div class="payment-row">
                                    <p><strong class="${montoClase}">Pago: ${p.monto}€</strong></p>
                                    <p><strong>Fecha Emisión:</strong> ${fecha}</p>
                                    <p><strong>Detalle:</strong> ${p.detalle_pago || 'Transacción de LaburApp'}</p>
                                </div>
                            `;
                        });
                        html += '</div>';
                        historyContainer.innerHTML = html;
                    }
                }

            } catch (error) {
                console.error("Error obteniendo perfil/pagos en Ajustes:", error);
            }
        }
    });

    // --- LÓGICA DE CERRAR SESIÓN ---
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            showCustomConfirm(
                "Cerrar Sesión",
                "¿Estás seguro de que quieres cerrar sesión?",
                () => {
                    auth.signOut().then(() => window.location.href = "../index.html");
                },
                "Cerrar Sesión",
                "Cancelar",
                "delete",
                true
            );
        });
    }

    // --- LÓGICA PARA CAMBIAR LA CONTRASEÑA ---
    if (btnChangePass) {
        btnChangePass.addEventListener('click', (e) => {
            e.preventDefault();
            showCustomPrompt(
                "Cambiar Contraseña",
                "Introduce tu nueva contraseña (mín. 6 caracteres):",
                async (nuevaPass) => {
                    if (nuevaPass && nuevaPass.trim().length >= 6) {
                        try {
                            await cambiarContrasena(nuevaPass);
                            showCustomAlert("Éxito", "Contraseña actualizada correctamente en Firebase.");
                            if (passLabel) passLabel.textContent = "*".repeat(nuevaPass.length);
                        } catch (err) {
                            if (err.code === 'auth/requires-recent-login') {
                                showCustomAlert("Sesión Caducada", "Por seguridad, debes cerrar sesión y volver a entrar para cambiar la contraseña.");
                            } else {
                                showCustomAlert("Error", "No se pudo cambiar la contraseña: " + err.message);
                            }
                        }
                    } else {
                        showCustomAlert("Error", "La contraseña es demasiado corta.");
                    }
                },
                "Actualizar",
                "Cancelar",
                "password"
            );
        });
    }

    // --- LÓGICA PARA BORRAR LA CUENTA ---
    const btnDeleteAccount = document.getElementById('btnDeleteAccount');
    if (btnDeleteAccount) {
        btnDeleteAccount.addEventListener('click', (e) => {
            e.preventDefault();
            showCustomConfirm(
                "Borrar Cuenta",
                "¿Estás seguro de que quieres borrar tu cuenta? Todos tus datos se perderán de forma permanente en la base de datos.",
                async () => {
                    try {
                        await borrarCuentaUsuario();
                        window.location.href = "../index.html";
                    } catch (err) {
                        if (err.code === 'auth/requires-recent-login') {
                            showCustomAlert("Sesión Caducada", "Por seguridad, debes cerrar sesión y volver a entrar para borrar tu cuenta.");
                        } else {
                            showCustomAlert("Error", "No se pudo borrar la cuenta: " + err.message);
                        }
                    }
                },
                "Borrar definitivamente",
                "Cancelar",
                "delete",
                true
            );
        });
    }

    // --- ABRIR MODAL EDITAR ---
    if (btnEditProfile) {
        btnEditProfile.onclick = () => {
            editModal.classList.remove('hidden');
            document.getElementById('inputSetNombre').value = displayNombre.innerText;
            document.getElementById('inputSetApellidos').value = displayApellidos.innerText;
            const dirSana = displayDireccion.innerText === 'No especificada' ? '' : displayDireccion.innerText;
            document.getElementById('inputSetDireccion').value = dirSana;

            // Formatear date (Si viene del register como DD-MM-YYYY hay que pasarlo a YYYY-MM-DD para el input type="date")
            const dateStr = displayFechaNac.innerText;
            if (dateStr && dateStr.includes("-") && dateStr.split("-")[0].length === 2) {
                const parts = dateStr.split("-");
                document.getElementById('inputSetFechaNac').value = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
                document.getElementById('inputSetFechaNac').value = dateStr;
            }

            document.getElementById('inputSetDni').value = displayDni.innerText;
            const telSano = displayTelefono.innerText === 'No especificado' ? '' : displayTelefono.innerText;
            document.getElementById('inputSetTelefono').value = telSano;
        };
    }

    if (btnCancelEditSettings) btnCancelEditSettings.onclick = () => editModal.classList.add('hidden');

    // --- GUARDAR EN FIREBASE ---
    if (btnSaveSettings) {
        btnSaveSettings.onclick = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const nom = document.getElementById('inputSetNombre').value.trim();
            const ape = document.getElementById('inputSetApellidos').value.trim();
            const rawFnac = document.getElementById('inputSetFechaNac').value.trim(); // YYYY-MM-DD
            const dni = document.getElementById('inputSetDni').value.trim();
            const dir = document.getElementById('inputSetDireccion').value.trim();
            const tel = document.getElementById('inputSetTelefono').value.trim();

            if (!nom || !ape || !rawFnac || !dni) {
                showCustomAlert("Error", "Los campos Nombre, Apellidos, Fecha Nac. y DNI son obligatorios.");
                return;
            }

            // Cambiar formato a DD-MM-YYYY
            let formattedFnac = rawFnac;
            if (rawFnac.includes("-") && rawFnac.split("-")[0].length === 4) {
                const parts = rawFnac.split("-");
                formattedFnac = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            try {
                // Guardar en Firestore
                await actualizarPerfilUsuario(user.uid, {
                    nombre: nom,
                    apellidos: ape,
                    nombre_completo: nom + " " + ape,
                    fecha_ingreso: formattedFnac,
                    dni: dni,
                    direccion_principal: dir,
                    telefono: tel
                });

                // Actualizar interfaz
                displayNombre.innerText = nom;
                displayApellidos.innerText = ape;
                displayFechaNac.innerText = formattedFnac;
                displayDni.innerText = dni;
                displayDireccion.innerText = dir || 'No especificada';
                displayTelefono.innerText = tel || 'No especificado';

                editModal.classList.add('hidden');
                showCustomAlert("Éxito", "Datos actualizados correctamente en base de datos.");

            } catch (e) {
                console.error("Error guardando ajustes: ", e);
                showCustomAlert("Error", "Fallo al guardar en la nube.");
            }
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

    if (btnAddPayment) {
        btnAddPayment.addEventListener('click', (e) => {
            e.preventDefault();
            paymentModal.classList.remove('hidden');

            if (selectPaymentType) {
                selectPaymentType.value = 'tarjeta';
                tarjetaFields.style.display = 'block';
                plataformaFields.style.display = 'none';
            }
            document.getElementById('inputCardNumber').value = '';
            document.getElementById('inputCardExpiry').value = '';
            document.getElementById('inputCardCVV').value = '';
            document.getElementById('inputPlataformaEmail').value = '';
            document.getElementById('inputPlataformaPass').value = '';
        });
    }

    if (btnCancelPayment) {
        btnCancelPayment.addEventListener('click', () => {
            paymentModal.classList.add('hidden');
        });
    }

    if (btnSavePayment) {
        btnSavePayment.addEventListener('click', async () => {
            let isValid = false;
            let listEntry = '';
            let dbTipo = '';
            let dbDetalle = '';
            const type = selectPaymentType ? selectPaymentType.value : 'tarjeta';

            if (type === 'tarjeta') {
                const num = document.getElementById('inputCardNumber').value.trim();
                const exp = document.getElementById('inputCardExpiry').value.trim();
                const cvv = document.getElementById('inputCardCVV').value.trim();

                if (num && exp && cvv) {
                    isValid = true;
                    dbTipo = 'Tarjeta Bancaria';
                    dbDetalle = `**** - *${num.slice(-4)}`;
                    listEntry = `<li><span class="dot-icon">•</span> <strong>${dbTipo}:</strong> ${dbDetalle}</li>`;
                }
            } else {
                const email = document.getElementById('inputPlataformaEmail').value.trim();
                const pass = document.getElementById('inputPlataformaPass').value.trim();

                if (email && pass) {
                    isValid = true;
                    dbTipo = 'Plataforma de Pago';
                    dbDetalle = email;
                    listEntry = `<li><span class="dot-icon">•</span> <strong>${dbTipo}:</strong> ${dbDetalle}</li>`;
                }
            }

            if (isValid) {
                try {
                    const user = auth.currentUser;
                    if (user) {
                        const idMetodo = await agregarMetodoPago(user.uid, dbTipo, dbDetalle);
                        await registrarPagoHistorial(user.uid, idMetodo, 0);
                    }

                    showCustomAlert("Éxito", "Método de pago añadido correctamente.");
                    paymentModal.classList.add('hidden');

                    const list = document.querySelector('.payment-methods');
                    if (list && listEntry) {
                        // Si el texto de "No hay metodos" existe, lo borramos
                        if (list.querySelector('p') && list.querySelector('p').textContent.includes('No tienes')) {
                            list.innerHTML = "";
                        }

                        const li = document.createElement('li');
                        li.innerHTML = listEntry;
                        list.appendChild(li);
                    }

                    if (historyContainer) {
                        const historial = await obtenerHistorialPagos(user.uid);
                        if (historial.length > 0) {
                            let html = '<div class="payment-history">';
                            historial.forEach(p => {
                                const fecha = p.fecha_emision?.toDate ? p.fecha_emision.toDate().toLocaleDateString() : "Reciente";
                                html += `
                                    <div class="payment-row" style="background: #f9f9f9; padding: 10px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #f9fafb;">
                                        <p><strong>Pago: ${p.monto}€</strong></p>
                                        <p><strong>Fecha Emisión:</strong> ${fecha}</p>
                                        <p><strong>Detalle:</strong> ${p.detalle_pago || 'Transacción de LaburApp'}</p>
                                    </div>
                                `;
                            });
                            html += '</div>';
                            historyContainer.innerHTML = html;
                        }
                    }
                } catch (e) {
                    console.error("Error al guardar método de pago:", e);
                    showCustomAlert("Error", "No se pudo guardar en la base de datos.");
                }
            } else {
                showCustomAlert("Error", "Por favor, rellena todos los campos.");
            }
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target == paymentModal) paymentModal.classList.add('hidden');
        if (event.target == editModal) editModal.classList.add('hidden');
    });

});
