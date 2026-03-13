import { auth, db } from './firebase-config.js';
import { obtenerTrabajoPorId, obtenerPostulacionesDeUnTrabajo, obtenerUsuarioPorId, aceptarPostulacion, rechazarPostulacion, completarTrabajo, dejarValoracion } from './database.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

                // Si la tarea está pendiente, cargamos candidatos
                if (tarea.estado === "Pendiente") {
                    loadApplicants(id);
                } else {
                    document.getElementById('applicantsSection').style.display = 'none';
                }

                // Mostrar botón de completar solo si hay trabajador asignado y no está completada
                const btnCompletar = document.getElementById('btnCompletar');
                if (btnCompletar) {
                    if (tarea.estado === "Aceptado" && tarea.id_trabajador) {
                        btnCompletar.style.display = 'inline-flex';
                    } else {
                        btnCompletar.style.display = 'none';
                    }
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
                list.innerHTML = "<p style='color: #888; grid-column: 1/-1; text-align: center; padding: 40px;'>No hay candidatos todavía.</p>";
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
            <img src="${avatar}" class="applicant-avatar" alt="${user.nombre}">
            <div class="applicant-info">
                <span class="applicant-name">${user.nombre}</span>
                <div class="applicant-actions">
                    <button class="app-btn btn-accept" title="Aceptar"><img src="../assets/img/icons/icono-check.png" alt=""> Aceptar</button>
                    <button class="app-btn btn-reject" title="Rechazar"><img src="../assets/img/icons/icono-eliminar.png" alt=""> Rechazar</button>
                    <button class="app-btn btn-chat-small" title="Chat"><img src="../assets/img/icons/icono-chat-2.png" alt=""> Chat</button>
                </div>
            </div>
        `;

        // Eventos
        card.querySelector('.btn-accept').onclick = () => {
            showCustomConfirm("Aceptar Candidato", `¿Quieres elegir a ${user.nombre} para realizar este trabajo?`, async () => {
                await aceptarPostulacion(tareaId, user.uid);
                showCustomAlert("¡Confirmado!", `${user.nombre} ha sido asignado al trabajo.`);
                location.reload();
            });
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
            window.location.href = `chat.html?id=${tareaId}`;
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
            const estado = tarea.estado || 'Pendiente';
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
            const ref = doc(db, "trabajos", tareaId);
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

            await updateDoc(ref, dataToUpdate);

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
                const ref = doc(db, "trabajos", tareaId);
                const pagoTrabajador = newValue * 0.9;
                const xp = Math.round(newValue * 10);
                // Como cliente, actualizo el pago que yo ofrezco
                await updateDoc(ref, {
                    pago_cliente: newValue,
                    pago_trabajador: pagoTrabajador,
                    xp_otorgada: xp
                });
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
            const ref = doc(db, "trabajos", tareaId);
            const dataToUpdate = {
                id_categoria: inputCat.value.split(" ")[0].toLowerCase(), // Ejemplo: "Jardinería"
                tiempo_estimado_horas: parseInt(inputTime.value) || 0
            };

            if (inputDate.value) {
                dataToUpdate.fecha_limite = new Date(inputDate.value);
            }

            await updateDoc(ref, dataToUpdate);

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
    const btnCancelValoracion = document.getElementById('btnCancelValoracion');

    // Cerrar al clicar fuera
    window.onclick = (event) => {
        if (event.target == modalMain) modalMain.classList.add('hidden');
        if (event.target == modalPay) modalPay.classList.add('hidden');
        if (event.target == modalInfo) modalInfo.classList.add('hidden');
        if (event.target == modalValoracion) modalValoracion.classList.add('hidden');
    };

    // Botón de Chat
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        btnChat.addEventListener("click", function (e) {
            e.preventDefault();
            window.location.href = `chat.html?id=${tareaId}`;
        });
    }

    // Botón de Completar Tarea: Abre el modal de valoración
    const btnCompletar = document.getElementById('btnCompletar');
    if (btnCompletar) {
        btnCompletar.addEventListener('click', () => {
            if (!currentTarea || !currentTarea.id_trabajador) return;
            resetValoracionModal();
            modalValoracion.classList.remove('hidden');
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

    if (btnConfirmarValoracion) {
        btnConfirmarValoracion.onclick = () => {
            if (currentRating < 1 || !currentTarea || !currentTarea.id_trabajador) return;

            showCustomConfirm(
                "¿Finalizar y Valorar?",
                "Esta acción no se puede deshacer.",
                async () => {
                    try {
                        btnConfirmarValoracion.disabled = true;
                        btnConfirmarValoracion.textContent = "Procesando...";

                        const comentario = inputComentario.value.trim();

                        // 1. Guardar la valoración
                        await dejarValoracion(currentTarea.id_trabajador, tareaId, currentRating, comentario);

                        // 2. Marcar la tarea como completada e incrementar XP/tareas
                        await completarTrabajo(tareaId, currentTarea.id_trabajador);

                        showCustomAlert("¡Completada!", "La tarea ha sido finalizada y la valoración enviada.");

                        modalValoracion.classList.add('hidden');
                        if (btnCompletar) btnCompletar.style.display = 'none';

                        // Actualizar badge
                        const badgeEl = document.getElementById('displayEstado');
                        if (badgeEl) {
                            badgeEl.textContent = 'Completada';
                            badgeEl.className = 'estado-badge completada';
                        }
                    } catch (e) {
                        console.error("Error al completar/valorar:", e);
                        showCustomAlert("Error", "Ocurrió un error al procesar la solicitud.");
                        btnConfirmarValoracion.disabled = false;
                        btnConfirmarValoracion.textContent = "Enviar y Completar";
                    }
                },
                "Confirmar",
                "Cancelar"
            );
        };
    }
});
