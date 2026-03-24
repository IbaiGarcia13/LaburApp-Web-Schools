import { auth, storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { obtenerTrabajoPorId, actualizarTrabajo, enviarMensajeTrabajo, crearNotificacion } from './database.js';

document.addEventListener("DOMContentLoaded", async function () {
    // 1. Obtener el ID del trabajo desde la URL
    const urlParams = new URLSearchParams(window.location.search);
    const trabajoId = urlParams.get('id');

    if (!trabajoId) {
        console.error("No se proporcionó ID de trabajo");
        return;
    }

    let currentTrabajo = null;
    // 2. Cargar datos del trabajo desde Firestore
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

    // 3. Lógica del botón de chat
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

    // 4. Lógica del botón de Empezar
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

    // 5. Lógica de Finalizar con Cámara
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

                // 1. Capturar fotograma en canvas
                cameraCanvas.width = cameraStream.videoWidth;
                cameraCanvas.height = cameraStream.videoHeight;
                cameraCanvas.getContext('2d').drawImage(cameraStream, 0, 0);
                stopCamera();

                // 2. Convertir a Blob
                const blob = await new Promise(resolve => cameraCanvas.toBlob(resolve, 'image/jpeg', 0.85));
                if (!blob) throw new Error("No se pudo generar la imagen.");

                // 3. Subir a Storage
                const fileName = `finalizacion_${trabajoId}_${Date.now()}.jpg`;
                const storagePath = `pruebas_finalizacion/${trabajoId}/${fileName}`;
                const fileRef = ref(storage, storagePath);
                await uploadBytes(fileRef, blob);
                const imageUrl = await getDownloadURL(fileRef);

                // 4. Actualizar Estado en Firestore (NO cambiamos estado, solo añadimos la prueba)
                await actualizarTrabajo(trabajoId, {
                    prueba_finalizado: imageUrl
                });

                // 4.1 Notificar al publicador (usamos icono de tarea en curso como pidió el usuario)
                const recipientId = currentTrabajo?.id_publicador;
                if (recipientId) {
                    await crearNotificacion(
                        recipientId,
                        "Trabajo Finalizado",
                        `El trabajador ha finalizado el trabajo "${currentTrabajo.titulo}". Revisa el chat para ver la prueba.`,
                        "tarea_empezada",
                        { id_trabajo: trabajoId }
                    );

                    // 5. Enviar al chat automáticamente
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

/**
 * Función para inyectar los datos del trabajo en el HTML
 */
function renderTrabajo(trabajo) {
    // Imagen
    const imgEl = document.querySelector('.job-img');
    if (imgEl && trabajo.foto_trabajo) imgEl.src = trabajo.foto_trabajo;

    // Info principal
    const titleEl = document.querySelector('.job-title');
    if (titleEl) titleEl.innerText = trabajo.titulo;

    const descEl = document.querySelector('.job-description');
    if (descEl) descEl.innerText = trabajo.descripcion || "Sin descripción detallada.";

    const locEl = document.querySelector('.italic');
    if (locEl) locEl.innerText = trabajo.direccion || "Ubicación no especificada";

    // Pagos y XP
    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 2) {
        // EL TRABAJADOR VE PAGO_CLIENTE (precio original)
        const pago = trabajo.pago_cliente || 0;
        statValues[0].innerText = `${Number(pago).toFixed(2)} €`;
        statValues[1].innerText = `${trabajo.xp_otorgada || Math.round(trabajo.pago_cliente * 10)} XP`;
    }

    // Información detallada
    const infoTexts = document.querySelectorAll('.info-text');
    if (infoTexts.length >= 3) {
        // Categoría
        const catName = trabajo.id_categoria ? trabajo.id_categoria.charAt(0).toUpperCase() + trabajo.id_categoria.slice(1) : "Otros";
        infoTexts[0].innerText = catName;

        // Tiempo
        infoTexts[1].innerText = `${trabajo.tiempo_estimado_horas}h`;

        // Fecha Límite
        let fechaStr = "Sin fecha";
        if (trabajo.fecha_limite) {
            const f = trabajo.fecha_limite.toDate ? trabajo.fecha_limite.toDate() : new Date(trabajo.fecha_limite);
            fechaStr = f.toLocaleDateString();
        }
        infoTexts[2].innerText = fechaStr;
    }

    // Actualizar badge de estado
    const badgeEl = document.getElementById('displayEstado');
    if (badgeEl) {
        let estado = trabajo.estado || 'Pendiente';
        // Normalización para visualización
        if (estado === "Aceptado") estado = "Aceptada";

        badgeEl.textContent = estado;
        badgeEl.className = `estado-badge ${estado.toLowerCase().replace(" ", "-")}`;
    }

    // Lógica de botones de acción
    const btnEmpezar = document.getElementById("btn-empezar");
    const btnFinalizar = document.getElementById("btn-finalizar");

    if (btnEmpezar) btnEmpezar.style.display = (trabajo.estado === "Aceptada") ? "block" : "none";

    if (btnFinalizar) {
        const haEmpezado = !!trabajo.fecha_inicio;
        if (trabajo.estado === "En curso" || (trabajo.estado === "Cancelada" && haEmpezado)) {
            btnFinalizar.style.display = "flex";
            if (trabajo.prueba_finalizado) {
                // Ya envió la foto
                btnFinalizar.disabled = true;
                btnFinalizar.innerHTML = '<img src="../assets/img/icons/icono-si-blanco.png" style="width: 20px;"> FINALIZADO';
            } else {
                // No ha enviado la foto aún
                btnFinalizar.disabled = false;
                btnFinalizar.innerHTML = '<img src="../assets/img/icons/icono-foto.png" style="width: 20px; filter: invert(1);"> FINALIZAR';
            }
        } else {
            btnFinalizar.style.display = "none";
        }
    }

    // Inicializar Mini Mapa
    if (trabajo.latitud && trabajo.longitud) {
        initMiniMap(trabajo.latitud, trabajo.longitud, trabajo.id_categoria);
    }
}

function initMiniMap(lat, lng, cat) {
    const miniMap = L.map('mini-map', {
        zoomControl: true,
        dragging: !L.Browser.mobile,
        touchZoom: true,
        scrollWheelZoom: false
    }).setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(miniMap);

    const colorMap = {
        "carpinteria": "#A52A2A", "construccion": "#808080", "cuidado_personal": "#FFC0CB",
        "diseno": "#5F9EA0", "evento": "#FF0000", "gastronomia": "#FFD700",
        "informatica": "#0000FF", "jardineria": "#008000", "limpieza": "#800080",
        "mascotas": "#006400", "mudanza": "#8B0000", "transporte": "#FFA500", "otros": "#000000"
    };
    const color = colorMap[cat?.toLowerCase()] || "#000000";

    L.circleMarker([lat, lng], {
        radius: 10,
        color: color,
        fillColor: color,
        fillOpacity: 0.8
    }).addTo(miniMap).bindPopup("Ubicación del trabajo").openPopup();

    setTimeout(() => miniMap.invalidateSize(), 500);
}
