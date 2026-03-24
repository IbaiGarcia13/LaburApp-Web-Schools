import { auth } from './firebase-config.js';
import { obtenerTrabajoPorId, obtenerPostulacionesDeUnTrabajo, obtenerUsuarioPorId, aceptarPostulacion, rechazarPostulacion, completarTrabajo, dejarValoracion, obtenerMetodosPago, actualizarTrabajo } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener el ID de la tarea desde la URL
    const urlParams = new URLSearchParams(window.location.search);
    const tareaId = urlParams.get('id');

    if (!tareaId) {
        console.error("No se proporcionó ID de tarea");
        return;
    }

    let currentTarea = null;

    // --- ELEMENTOS DE PANTALLA ---
    const displayTitle = document.getElementById('displayTitle');
    const displayDesc = document.getElementById('displayDesc');
    const displayLoc = document.getElementById('displayLoc');
    const displayPay = document.getElementById('displayPay');
    const displayExp = document.getElementById('displayExp');
    const displayCat = document.getElementById('displayCat');
    const displayTime = document.getElementById('displayTime');
    const displayDate = document.getElementById('displayDate');

    // 2. Cargar datos reales
    auth.onAuthStateChanged(user => {
        if (user) {
            loadTareaData(tareaId);
        } else {
            window.location.href = '../index.html';
        }
    });

    async function loadTareaData(id) {
        try {
            const tarea = await obtenerTrabajoPorId(id);
            if (tarea) {
                currentTarea = tarea;
                renderTarea(tarea);

                // Ocultar botones de edición si está en curso o completada
                if (tarea.estado === "En curso" || tarea.estado === "Completada") {
                    const editBtns = document.querySelectorAll('.icon-edit, .icon-edit-small');
                    editBtns.forEach(btn => btn.style.display = 'none');
                }

                // Si la tarea está pendiente, cargamos candidatos
                if (tarea.estado && tarea.estado.toLowerCase() === "pendiente") {
                    loadApplicants(id);
                } else {
                    document.getElementById('applicantsSection').style.display = 'none';
                }

                // Mostrar botón de completar solo si está en curso o finalizada por el trabajador
                const btnCompletar = document.getElementById('btnCompletar');
                if (btnCompletar) {
                    if (tarea.estado === "En curso" && tarea.id_trabajador) {
                        btnCompletar.style.display = 'inline-flex';
                    } else {
                        btnCompletar.style.display = 'none';
                    }
                }

                // Cargar trabajador asignado si existe
                if (tarea.id_trabajador && tarea.estado !== "Pendiente") {
                    loadAssignedWorker(tarea.id_trabajador);
                } else {
                    document.getElementById('workerSection').style.display = 'none';
                }
            } else {
                console.error("Tarea no encontrada");
            }
        } catch (e) {
            console.error("Error cargando tarea:", e);
        }
    }

    async function loadApplicants(id) {
        const section = document.getElementById('applicantsSection');
        const list = document.getElementById('applicantsList');
        section.style.display = 'block';

        try {
            const applicantsShort = await obtenerPostulacionesDeUnTrabajo(id);
            if (applicantsShort.length === 0) {
                list.innerHTML = "<p style='color: #888; grid-column: 1/-1; text-align: center; padding: 40px; font-style: italic;'>No hay candidatos todavía.</p>";
                return;
            }

            list.innerHTML = "";
            for (const app of applicantsShort) {
                const user = await obtenerUsuarioPorId(app.id_usuario);
                if (user) {
                    renderApplicantCard(user, app);
                }
            }
        } catch (e) {
            console.error("Error cargando postulantes:", e);
            list.innerHTML = "<p style='color: red;'>Error al cargar candidatos.</p>";
        }
    }

    function renderApplicantCard(user, post) {
        const list = document.getElementById('applicantsList');
        const avatar = user.foto_perfil || "../assets/img/avatar-defecto.png";

        const card = document.createElement('div');
        card.className = 'applicant-card';
        card.innerHTML = `
            <img src="${avatar}" class="applicant-avatar" alt="${user.nombre}" style="cursor:pointer;">
            <div class="applicant-info">
                <span class="applicant-name" style="cursor:pointer;">${user.nombre}</span>
                <div class="applicant-actions">
                    <button class="app-btn btn-accept" title="Aceptar"><img src="../assets/img/icons/icono-si-blanco.png" alt=""></button>
                    <button class="app-btn btn-reject" title="Rechazar"><img src="../assets/img/icons/icono-no-blanco.png" alt=""></button>
                    <button class="app-btn btn-chat-small" title="Chat"><img src="../assets/img/icons/icono-chat-2.png" alt=""></button>
                </div>
            </div>
        `;

        // Ir a perfil
        const goToProfile = () => window.location.href = `usuario.html?id=${user.uid}`;
        card.querySelector('.applicant-avatar').onclick = goToProfile;
        card.querySelector('.applicant-name').onclick = goToProfile;

        // Eventos
        card.querySelector('.btn-accept').onclick = () => {
            const modal = document.getElementById('modalAceptarTrabajador');
            const montoEl = document.getElementById('montoRetenerModal');
            const btnConfirm = document.getElementById('btnConfirmarAceptar');
            const btnCancel = document.getElementById('btnCancelAceptar');
            const selectMetodo = document.getElementById('selectMetodoAceptar');
            const noMethods = document.getElementById('noMethodsAceptar');

            // Cargar datos en el modal
            montoEl.textContent = Number(currentTarea.pago_cliente).toFixed(2);

            // Cargar métodos específicos para este modal
            const userAuth = auth.currentUser;
            if (userAuth) {
                obtenerMetodosPago(userAuth.uid).then(metodos => {
                    selectMetodo.innerHTML = "";
                    if (metodos.length === 0) {
                        selectMetodo.style.display = 'none';
                        noMethods.classList.remove('hidden');
                        btnConfirm.disabled = true;
                        btnConfirm.style.opacity = '0.5';
                    } else {
                        selectMetodo.style.display = 'block';
                        noMethods.classList.add('hidden');
                        btnConfirm.disabled = false;
                        btnConfirm.style.opacity = '1';

                        metodos.forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m.id_metodo;
                            opt.textContent = `${m.tipo}: ${m.detalle}`;
                            selectMetodo.appendChild(opt);
                        });
                    }
                });
            }

            modal.classList.remove('hidden');

            btnCancel.onclick = () => modal.classList.add('hidden');
            btnConfirm.onclick = async () => {
                try {
                    btnConfirm.disabled = true;
                    btnConfirm.textContent = "Procesando...";
                    await aceptarPostulacion(tareaId, user.uid);
                    modal.classList.add('hidden');
                    showCustomAlert("¡Confirmado!", `${user.nombre} ha sido asignado al trabajo.`);
                    location.reload();
                } catch (err) {
                    console.error("Error aceptando postulación:", err);
                    showCustomAlert("Error", "No se pudo asignar al trabajador.");
                    btnConfirm.disabled = false;
                    btnConfirm.textContent = "Confirmar";
                }
            };
        };

        card.querySelector('.btn-reject').onclick = () => {
            showCustomConfirm("Rechazar Candidato", `¿Estás seguro de rechazar la solicitud de ${user.nombre}?`, async () => {
                await rechazarPostulacion(tareaId, user.uid);
                card.remove();
                if (list.children.length === 0) {
                    list.innerHTML = "<p style='color: #888; grid-column: 1/-1; text-align: center; padding: 40px;'>No hay candidatos todavía.</p>";
                }
            });
        };

        card.querySelector('.btn-chat-small').onclick = () => {
            window.location.href = `chat.html?id=${tareaId}&userId=${user.uid}`;
        };

        list.appendChild(card);
    }

    async function loadAssignedWorker(workerId) {
        const section = document.getElementById('workerSection');
        const list = document.getElementById('workerList');
        section.style.display = 'block';

        try {
            const user = await obtenerUsuarioPorId(workerId);
            if (user) {
                renderWorkerCard(user);
            }
        } catch (e) {
            console.error("Error cargando trabajador asignado:", e);
            list.innerHTML = "<p style='color: red;'>Error al cargar datos del trabajador.</p>";
        }
    }

    function renderWorkerCard(user) {
        const list = document.getElementById('workerList');
        const avatar = user.foto_perfil || "../assets/img/avatar-defecto.png";

        list.innerHTML = ""; // Solo puede haber uno
        const card = document.createElement('div');
        card.className = 'applicant-card';
        card.innerHTML = `
            <img src="${avatar}" class="applicant-avatar" alt="${user.nombre}" style="cursor:pointer;">
            <div class="applicant-info">
                <span class="applicant-name" style="cursor:pointer;">${user.nombre}</span>
                <div class="applicant-actions">
                    <button class="app-btn btn-chat-small" title="Chat" style="width: 100%;"><img src="../assets/img/icons/icono-chat-2.png" alt=""> Chatear</button>
                </div>
            </div>
        `;

        // Ir a perfil
        const goToProfile = () => window.location.href = `usuario.html?id=${user.uid}`;
        card.querySelector('.applicant-avatar').onclick = goToProfile;
        card.querySelector('.applicant-name').onclick = goToProfile;

        card.querySelector('.btn-chat-small').onclick = () => {
            window.location.href = `chat.html?id=${tareaId}&userId=${user.uid}`;
        };

        list.appendChild(card);
    }

    function renderTarea(tarea) {
        displayTitle.textContent = tarea.titulo;
        displayDesc.textContent = tarea.descripcion || "Sin descripción.";
        displayLoc.textContent = tarea.direccion || "No especificada";

        const pagoTrabajador = tarea.pago_trabajador || (tarea.pago_cliente * 0.9);
        displayPay.textContent = Number(tarea.pago_cliente).toFixed(2);
        displayExp.textContent = tarea.xp_otorgada || Math.round(tarea.pago_cliente * 10);

        const catName = tarea.id_categoria ? tarea.id_categoria.charAt(0).toUpperCase() + tarea.id_categoria.slice(1) : "Otros";
        displayCat.textContent = catName;
        displayTime.textContent = `${tarea.tiempo_estimado_horas || 0}h`;

        if (tarea.fecha_limite) {
            const f = tarea.fecha_limite.toDate ? tarea.fecha_limite.toDate() : new Date(tarea.fecha_limite);
            displayDate.textContent = f.toLocaleDateString();
        } else {
            displayDate.textContent = "Sin fecha";
        }

        // Actualizar badge de estado
        const badgeEl = document.getElementById('displayEstado');
        if (badgeEl) {
            let estado = tarea.estado || 'Pendiente';
            if (estado === "Aceptado") estado = "Aceptada";
            badgeEl.textContent = estado;
            badgeEl.className = `estado-badge ${estado.toLowerCase()}`;
        }

        const imgEl = document.querySelector('.job-img');
        if (imgEl) {
            imgEl.src = tarea.foto_trabajo || "../assets/img/trabajo-defecto.png";
        }
    }

    // --- MODALES Y LÓGICA DE EDICIÓN ---

    // Modal 1: Principal
    const modalMain = document.getElementById('modalMain');
    const btnEditMain = document.getElementById('btnEditMain');
    const inputTitle = document.getElementById('inputTitle');
    const inputDesc = document.getElementById('inputDesc');
    const inputLoc = document.getElementById('inputLoc');

    btnEditMain.onclick = () => {
        inputTitle.value = displayTitle.textContent;
        inputDesc.value = displayDesc.textContent.trim();
        inputLoc.value = displayLoc.textContent;
        modalMain.classList.remove('hidden');
    };

    document.getElementById('btnCancelMain').onclick = () => modalMain.classList.add('hidden');
    document.getElementById('btnSaveMain').onclick = async () => {
        const photoFile = document.getElementById('inputPhoto').files[0];

        try {
            const dataToUpdate = {
                titulo: inputTitle.value,
                descripcion: inputDesc.value,
                direccion: inputLoc.value
            };

            // Si hay una foto nueva, la convertimos a base64
            if (photoFile) {
                const reader = new FileReader();
                const base64Photo = await new Promise((resolve, reject) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (e) => reject(e);
                    reader.readAsDataURL(photoFile);
                });
                dataToUpdate.foto_trabajo = base64Photo;
            }

            await actualizarTrabajo(tareaId, dataToUpdate);

            displayTitle.textContent = inputTitle.value;
            displayDesc.textContent = inputDesc.value;
            displayLoc.textContent = inputLoc.value;

            if (dataToUpdate.foto_trabajo) {
                const imgEl = document.querySelector('.job-img');
                if (imgEl) imgEl.src = dataToUpdate.foto_trabajo;
            }

            modalMain.classList.add('hidden');
            showCustomAlert("Guardado", "Cambios realizados con éxito.");
        } catch (e) {
            console.error(e);
            showCustomAlert("Error", "No se pudieron guardar los cambios.");
        }
    };

    // Modal 2: Pago
    const modalPay = document.getElementById('modalPay');
    const btnEditPay = document.getElementById('btnEditPay');
    const inputPay = document.getElementById('inputPay');

    btnEditPay.onclick = () => {
        inputPay.value = parseFloat(displayPay.textContent);
        modalPay.classList.remove('hidden');
    };

    document.getElementById('btnCancelPay').onclick = () => modalPay.classList.add('hidden');
    document.getElementById('btnSavePay').onclick = async () => {
        const newValue = parseFloat(inputPay.value);
        if (!isNaN(newValue)) {
            try {
                await actualizarTrabajo(tareaId, {
                    pago_cliente: newValue
                });
                const xp = Math.round(newValue * 10);
                displayPay.textContent = newValue.toFixed(2);
                displayExp.textContent = xp;
                modalPay.classList.add('hidden');
                showCustomAlert("Guardado", "Presupuesto actualizado.");
            } catch (e) {
                console.error(e);
            }
        }
    };

    // Modal 3: Info
    const modalInfo = document.getElementById('modalInfo');
    const btnEditInfo = document.getElementById('btnEditInfo');
    const inputCat = document.getElementById('inputCat');
    const inputTime = document.getElementById('inputTime');
    const inputDate = document.getElementById('inputDate');

    btnEditInfo.onclick = () => {
        const currentCat = displayCat.textContent;
        for (let i = 0; i < inputCat.options.length; i++) {
            if (inputCat.options[i].text === currentCat) {
                inputCat.selectedIndex = i;
                break;
            }
        }
        inputTime.value = displayTime.textContent.replace('h', '').trim();
        modalInfo.classList.remove('hidden');
    };

    document.getElementById('btnCancelInfo').onclick = () => modalInfo.classList.add('hidden');
    document.getElementById('btnSaveInfo').onclick = async () => {
        try {
            const dataToUpdate = {
                id_categoria: inputCat.value.split(" ")[0].toLowerCase(), // Ejemplo: "Jardinería"
                tiempo_estimado_horas: parseInt(inputTime.value) || 0
            };

            if (inputDate.value) {
                dataToUpdate.fecha_limite = new Date(inputDate.value);
            }

            await actualizarTrabajo(tareaId, dataToUpdate);

            displayCat.textContent = inputCat.options[inputCat.selectedIndex].text;
            displayTime.textContent = inputTime.value + "h";
            if (inputDate.value) {
                displayDate.textContent = new Date(inputDate.value).toLocaleDateString();
            }

            modalInfo.classList.add('hidden');
            showCustomAlert("Guardado", "Información actualizada.");
        } catch (e) {
            console.error(e);
        }
    };

    const modalValoracion = document.getElementById('modalValoracion');
    const modalPago = document.getElementById('modalPago');
    const btnCancelValoracion = document.getElementById('btnCancelValoracion');
    const btnCancelPago = document.getElementById('btnCancelPago');
    const btnConfirmarPago = document.getElementById('btnConfirmarPago');
    const selectMetodoPago = document.getElementById('selectMetodoPago');
    const noPaymentMethods = document.getElementById('noPaymentMethods');

    const modalAceptar = document.getElementById('modalAceptarTrabajador');

    // Cerrar al clicar fuera
    window.onclick = (event) => {
        if (event.target == modalMain) modalMain.classList.add('hidden');
        if (event.target == modalPay) modalPay.classList.add('hidden');
        if (event.target == modalInfo) modalInfo.classList.add('hidden');
        if (event.target == modalValoracion) modalValoracion.classList.add('hidden');
        if (event.target == modalPago) modalPago.classList.add('hidden');
        if (event.target == modalAceptar) modalAceptar.classList.add('hidden');
    };

    // Botón de Chat
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        btnChat.addEventListener("click", function (e) {
            e.preventDefault();
            const otherId = currentTarea?.id_trabajador || "";
            window.location.href = `chat.html?id=${tareaId}&userId=${otherId}`;
        });
    }

    // Botón de Completar Tarea: Confirmación de pago y luego valoración
    const btnCompletar = document.getElementById('btnCompletar');
    if (btnCompletar) {
        btnCompletar.addEventListener('click', () => {
            if (!currentTarea || !currentTarea.id_trabajador) return;

            showCustomConfirm(
                "¿Finalizar Tarea?",
                "Al marcarla como completada, el pago que tenemos retenido (escrow) se enviará automáticamente al trabajador. ¿Quieres proceder?",
                () => {
                    resetValoracionModal();
                    modalValoracion.classList.remove('hidden');
                },
                "Finalizar y Valorar",
                "Cancelar"
            );
        });
    }

    // LÓGICA DEL MODAL DE VALORACIÓN
    let currentRating = 0;
    const stars = document.querySelectorAll('.star-rating .star');
    const hint = document.getElementById('starHint');
    const btnConfirmarValoracion = document.getElementById('btnConfirmarValoracion');
    const inputComentario = document.getElementById('inputComentario');

    function resetValoracionModal() {
        currentRating = 0;
        stars.forEach(s => s.classList.remove('selected'));
        hint.textContent = "Selecciona una puntuación";
        inputComentario.value = "";
        btnConfirmarValoracion.disabled = true;
    }

    if (btnCancelValoracion) {
        btnCancelValoracion.onclick = () => modalValoracion.classList.add('hidden');
    }

    stars.forEach(star => {
        star.onclick = function () {
            currentRating = parseInt(this.getAttribute('data-val'));
            stars.forEach(s => s.classList.remove('selected'));
            this.classList.add('selected');

            // Actualizar texto descriptivo
            const hints = ["Pésimo", "Malo", "Regular", "Bueno", "Excelente"];
            hint.textContent = `${currentRating} Estrella(s) - ${hints[currentRating - 1]}`;

            // Habilitar botón de enviar
            btnConfirmarValoracion.disabled = false;
        };
    });

    // --- ACCIÓN FINAL: Guardar valoración y completar tarea ---
    if (btnConfirmarValoracion) {
        btnConfirmarValoracion.onclick = async () => {
            if (!currentTarea || !currentTarea.id_trabajador) return;

            try {
                btnConfirmarValoracion.disabled = true;
                btnConfirmarValoracion.textContent = "Procesando...";

                const puntuacion = currentRating;
                const comentario = inputComentario.value.trim();

                // 1. Guardar la valoración
                await dejarValoracion(currentTarea.id_trabajador, tareaId, puntuacion, comentario);

                // 2. Marcar como completada y transferir dinero (liberar escrow)
                await completarTrabajo(tareaId, currentTarea.id_trabajador);

                showCustomAlert("¡Tarea Finalizada!", "El pago se ha liberado al trabajador y la tarea está ahora completada.");

                modalValoracion.classList.add('hidden');
                if (btnCompletar) btnCompletar.style.display = 'none';

                // Actualizar badge
                const badgeEl = document.getElementById('displayEstado');
                if (badgeEl) {
                    badgeEl.textContent = 'Completada';
                    badgeEl.className = 'estado-badge completada';
                }

                // Recargar para ver cambios
                setTimeout(() => location.reload(), 1500);

            } catch (e) {
                console.error("Error al finalizar tarea:", e);
                showCustomAlert("Error", "No se pudo completar el proceso final.");
                btnConfirmarValoracion.disabled = false;
                btnConfirmarValoracion.textContent = "Enviar Valoración";
            }
        };
    }
});
