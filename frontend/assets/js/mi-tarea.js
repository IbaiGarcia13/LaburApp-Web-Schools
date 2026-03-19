import { obtenerTrabajoPorId, obtenerPostulacionesDeUnTrabajo, obtenerUsuarioPorId, aceptarPostulacion, rechazarPostulacion, finalizarTrabajo, dejarValoracion } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
    // ... (resto de variables igual hasta line 15)
    let currentTarea = null;
    let workerId = null;

    // ... (referencias UI igual)

    async function loadTareaData(id) {
        try {
            const tarea = await obtenerTrabajoPorId(id);
            if (tarea) {
                currentTarea = tarea;
                workerId = tarea.id_trabajador;
                renderTarea(tarea);

                const finishSection = document.getElementById('finishSection');

                // Lógica de secciones según estado
                if (tarea.estado === "Pendiente") {
                    loadApplicants(id);
                } else {
                    document.getElementById('applicantsSection').style.display = 'none';
                    if (tarea.estado === "Aceptado") {
                        if (finishSection) finishSection.style.display = 'block';
                    } else if (tarea.estado === "Finalizado") {
                        if (finishSection) {
                            finishSection.style.display = 'block';
                            finishSection.innerHTML = "<p style='color: #4CAF50; font-weight: bold; font-size: 1.2rem;'>¡TRABAJO COMPLETADO!</p>";
                        }
                    }
                }
            }
        } catch (e) { console.error(e); }
    }

    // --- LÓGICA FINALIZAR TRABAJO ---
    const btnFinishJob = document.getElementById('btnFinishJob');
    const modalRating = document.getElementById('modalRating');

    if (btnFinishJob) {
        btnFinishJob.onclick = async () => {
            showCustomConfirm("Finalizar Trabajo", "¿Confirmas que el trabajo se ha realizado correctamente? Se procesará el pago y la XP.", async () => {
                try {
                    await finalizarTrabajo(tareaId);
                    showCustomAlert("¡Éxito!", "Trabajo finalizado. El trabajador ha recibido su recompensa.");
                    modalRating.classList.remove('hidden');
                } catch (e) {
                    showCustomAlert("Error", "No se pudo finalizar el trabajo: " + e.message);
                }
            });
        };
    }

    // --- LÓGICA VALORACIÓN ---
    const stars = document.querySelectorAll('.star');
    const inputRatingValue = document.getElementById('inputRatingValue');

    stars.forEach(star => {
        star.onclick = () => {
            const val = parseInt(star.getAttribute('data-value'));
            inputRatingValue.value = val;
            stars.forEach((s, idx) => {
                if (idx < val) s.classList.add('active');
                else s.classList.remove('active');
            });
        };
    });

    // Activar 5 estrellas por defecto
    stars.forEach(s => s.classList.add('active'));

    document.getElementById('btnSkipReview').onclick = () => location.reload();
    document.getElementById('btnSaveReview').onclick = async () => {
        const puntuacion = parseInt(inputRatingValue.value);
        const comentario = document.getElementById('inputReviewDesc').value.trim();
        try {
            if (workerId) {
                await dejarValoracion(workerId, tareaId, puntuacion, comentario);
                showCustomAlert("Gracias", "Tu valoración ha sido guardada.");
            }
            location.reload();
        } catch (e) {
            showCustomAlert("Error", "No se pudo guardar la valoración.");
            location.reload();
        }
    };

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

    // Cerrar al clicar fuera
    window.onclick = (event) => {
        if (event.target == modalMain) modalMain.classList.add('hidden');
        if (event.target == modalPay) modalPay.classList.add('hidden');
        if (event.target == modalInfo) modalInfo.classList.add('hidden');
    };

    // Botón de Chat (Re-utilizando la lógica de redirección con ID)
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        btnChat.addEventListener("click", function (e) {
            e.preventDefault();
            window.location.href = `chat.html?id=${tareaId}`;
        });
    }
});
