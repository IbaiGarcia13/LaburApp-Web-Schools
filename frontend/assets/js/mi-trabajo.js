import { auth, storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { obtenerTrabajoPorId, actualizarTrabajo, enviarMensajeTrabajo, crearNotificacion } from './database.js';

document.addEventListener("DOMContentLoaded", async function () {
   
    const urlParams = new URLSearchParams(window.location.search);
    const trabajoId = urlParams.get('id');

    if (!trabajoId) {
        console.error("No se proporcionó ID de trabajo");
        return;
    }

    let currentTrabajo = null;
   
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = '../index.html';
            return;
        }

        try {
            currentTrabajo = await obtenerTrabajoPorId(trabajoId);
            if (currentTrabajo) {
                renderTrabajo(currentTrabajo);
            } else {
                console.error("Trabajo no encontrado");
            }
        } catch (e) {
            console.error("Error cargando detalle del trabajo:", e);
        }
    });

   // --- 3. LÓGICA DEL BOTÓN DE CHAT ---
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        btnChat.addEventListener("click", function (e) {
            e.preventDefault();
            showCustomConfirm(
                "Chat",
                "¿Quieres hablar con la persona que publicó esta oferta?",
                () => {
                    const otherId = currentTrabajo?.id_publicador || "";
                    window.location.href = `chat.html?id=${trabajoId}&userId=${otherId}`;
                },
                "Chatear",
                "Cancelar",
                "confirm"
            );
        });
    }

   // --- 4. LÓGICA DEL BOTÓN DE EMPEZAR ---
    const btnEmpezar = document.getElementById("btn-empezar");
    if (btnEmpezar) {
        btnEmpezar.addEventListener("click", async function () {
            showCustomConfirm(
                "Empezar Trabajo",
                "¿Confirmas que vas a empezar este trabajo ahora mismo?",
                async () => {
                    try {
                        btnEmpezar.disabled = true;
                        btnEmpezar.innerText = "ACTUALIZANDO...";
                        await actualizarTrabajo(trabajoId, { estado: "En curso" });
                        showCustomAlert("¡A darle!", "El trabajo ahora está en curso. ¡Mucha suerte!");
                        location.reload();
                    } catch (err) {
                        console.error("Error al empezar trabajo:", err);
                        showCustomAlert("Error", "No se pudo actualizar el estado del trabajo.");
                        btnEmpezar.disabled = false;
                        btnEmpezar.innerText = "EMPEZAR";
                    }
                },
                "Empezar",
                "Cancelar",
                "confirm"
            );
        });
    }

   // --- 5. LÓGICA DE FINALIZAR CON CÁMARA ---
    const btnFinalizar = document.getElementById("btn-finalizar");
    const modalCamera = document.getElementById('modalCamera');
    const cameraStream = document.getElementById('cameraStream');
    const cameraCanvas = document.getElementById('cameraCanvas');
    const btnCapture = document.getElementById('btnCapture');
    const btnCancelCamera = document.getElementById('btnCancelCamera');
    let activeStream = null;

    if (btnFinalizar) {
        btnFinalizar.addEventListener('click', openCamera);
    }

    async function openCamera() {
        modalCamera.classList.remove('hidden');
        try {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            cameraStream.srcObject = activeStream;
        } catch (err) {
            showCustomAlert("Error", "No se pudo acceder a la cámara: " + err.message);
            modalCamera.classList.add('hidden');
        }
    }

    function stopCamera() {
        if (activeStream) {
            activeStream.getTracks().forEach(track => track.stop());
            activeStream = null;
        }
        cameraStream.srcObject = null;
        modalCamera.classList.add('hidden');
    }

    if (btnCancelCamera) btnCancelCamera.onclick = stopCamera;

    if (btnCapture) {
        btnCapture.onclick = async () => {
            if (!cameraStream.srcObject) return;

            try {
                btnCapture.disabled = true;
                btnCapture.innerText = "📦 Procesando...";

                cameraCanvas.width = cameraStream.videoWidth;
                cameraCanvas.height = cameraStream.videoHeight;
                cameraCanvas.getContext('2d').drawImage(cameraStream, 0, 0);
                stopCamera();

                const blob = await new Promise(resolve => cameraCanvas.toBlob(resolve, 'image/jpeg', 0.85));
                if (!blob) throw new Error("No se pudo generar la imagen.");

                const fileName = `finalizacion_${trabajoId}_${Date.now()}.jpg`;
                const storagePath = `pruebas_finalizacion/${trabajoId}/${fileName}`;
                const fileRef = ref(storage, storagePath);
                await uploadBytes(fileRef, blob);
                const imageUrl = await getDownloadURL(fileRef);

                await actualizarTrabajo(trabajoId, {
                    prueba_finalizado: imageUrl
                });

                const recipientId = currentTrabajo?.id_publicador;
                if (recipientId) {
                    await crearNotificacion(
                        recipientId,
                        "Trabajo Finalizado",
                        `El trabajador ha finalizado el trabajo "${currentTrabajo.titulo}". Revisa el chat para ver la prueba.`,
                        "tarea_empezada",
                        { id_trabajo: trabajoId }
                    );

                    await enviarMensajeTrabajo(trabajoId, imageUrl, "imagen", recipientId);
                    await enviarMensajeTrabajo(trabajoId, "¡He terminado el trabajo! Aquí tienes la foto de prueba.", "texto", recipientId);
                }

                showCustomAlert("¡Trabajo Finalizado!", "Has enviado la prueba. El publicador será notificado.");
                location.reload();

            } catch (err) {
                console.error("Error al finalizar con foto:", err);
                showCustomAlert("Error", "Hubo un problema al procesar la foto.");
                btnCapture.disabled = false;
                btnCapture.innerText = "📸 Capturar y Finalizar";
            }
        };
    }
});

function renderTrabajo(trabajo) {
   
    const imgEl = document.querySelector('.job-img');
    if (imgEl && trabajo.foto_trabajo) imgEl.src = trabajo.foto_trabajo;

    const titleEl = document.querySelector('.job-title');
    if (titleEl) titleEl.innerText = trabajo.titulo;

    const descEl = document.querySelector('.job-description');
    if (descEl) descEl.innerText = trabajo.descripcion || "Sin descripción detallada.";

    const locEl = document.querySelector('.italic');
    if (locEl) locEl.innerText = trabajo.direccion || "Ubicación no especificada";

    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 2) {
       // --- EL TRABAJADOR VE PAGO_CLIENTE (PRECIO ORIGINAL) ---
        const pago = trabajo.pago_cliente || 0;
        statValues[0].innerText = `${Number(pago).toFixed(2)} €`;
        statValues[1].innerText = `${trabajo.xp_otorgada || Math.round(trabajo.pago_cliente * 10)} XP`;
    }

    const infoTexts = document.querySelectorAll('.info-text');
    if (infoTexts.length >= 3) {
       
        const catName = trabajo.id_categoria ? trabajo.id_categoria.charAt(0).toUpperCase() + trabajo.id_categoria.slice(1) : "Otros";
        infoTexts[0].innerText = catName;

        infoTexts[1].innerText = `${trabajo.tiempo_estimado_horas}h`;

        let fechaStr = "Sin fecha";
        if (trabajo.fecha_limite) {
            const f = trabajo.fecha_limite.toDate ? trabajo.fecha_limite.toDate() : new Date(trabajo.fecha_limite);
            fechaStr = f.toLocaleDateString();
        }
        infoTexts[2].innerText = fechaStr;
    }

    const badgeEl = document.getElementById('displayEstado');
    if (badgeEl) {
        let estado = trabajo.estado || 'Pendiente';
       
        if (estado === "Aceptado") estado = "Aceptada";
        if (estado === "Pausada") estado = "En revisión";

        badgeEl.textContent = estado;
        const classEstado = (trabajo.estado === 'Pausada') ? 'en-revision' : estado.toLowerCase().replace(/\s+/g, "-");
        badgeEl.className = `estado-badge ${classEstado}`;
    }

   // --- LÓGICA DE BOTONES DE ACCIÓN ---
    const btnEmpezar = document.getElementById("btn-empezar");
    const btnFinalizar = document.getElementById("btn-finalizar");

    if (btnEmpezar) btnEmpezar.style.display = (trabajo.estado === "Aceptada") ? "block" : "none";

    if (btnFinalizar) {
        const haEmpezado = !!trabajo.fecha_inicio;
        if (trabajo.estado === "En curso" || (trabajo.estado === "Cancelada" && haEmpezado)) {
            btnFinalizar.style.display = "flex";
            if (trabajo.prueba_finalizado) {
               
                btnFinalizar.disabled = true;
                btnFinalizar.innerHTML = '<img src="../assets/img/icons/icono-si-blanco.png" style="width: 20px;"> FINALIZADO';
            } else {
               
                btnFinalizar.disabled = false;
                btnFinalizar.innerHTML = '<img src="../assets/img/icons/icono-foto.png" style="width: 20px; filter: invert(1);"> FINALIZAR';
            }
        } else {
            btnFinalizar.style.display = "none";
        }
    }

    // Mapa eliminado
}

// initMiniMap eliminado
