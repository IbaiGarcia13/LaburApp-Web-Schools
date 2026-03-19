import { auth, db } from './firebase-config.js';
import { obtenerTrabajoPorId, postularseATrabajo } from './database.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
            checkUserRelation(currentTrabajo);
        } else {
            console.error("Trabajo no encontrado");
        }
    } catch (e) {
        console.error("Error cargando detalle del trabajo:", e);
    }

    async function checkUserRelation(trabajo) {
        auth.onAuthStateChanged(async (user) => {
            if (!user) return;

            const btnPostular = document.getElementById("btn-postular");
            const btnChat = document.getElementById("btn-chat");

            // Si soy el dueño, no puedo postularme
            if (user.uid === trabajo.id_publicador) {
                if (btnPostular) btnPostular.style.display = 'none';
                return;
            }

            // Si el trabajo ya no está pendiente, no se puede postular
            if (trabajo.estado !== "Pendiente") {
                if (btnPostular) btnPostular.style.display = 'none';
                return;
            }

            // Verificar si ya estoy postulado
            const postRef = doc(db, "trabajos", trabajo.id, "postulaciones", user.uid);
            const postSnap = await getDoc(postRef);

            if (postSnap.exists()) {
                if (btnPostular) {
                    btnPostular.innerText = "YA POSTULADO";
                    btnPostular.disabled = true;
                    btnPostular.style.opacity = "0.6";
                    btnPostular.style.display = 'block';
                }
            } else {
                if (btnPostular) {
                    btnPostular.style.display = 'block';
                    btnPostular.onclick = async () => {
                        showCustomConfirm(
                            "Postularse",
                            "¿Quieres postularte a este trabajo?",
                            async () => {
                                try {
                                    await postularseATrabajo(trabajo.id);
                                    showCustomAlert("¡Éxito!", "Te has postulado correctamente.");
                                    btnPostular.innerText = "YA POSTULADO";
                                    btnPostular.disabled = true;
                                    btnPostular.style.opacity = "0.6";
                                } catch (err) {
                                    showCustomAlert("Error", "No se pudo realizar la postulación.");
                                }
                            }
                        );
                    };
                }
            }
        });
    }

    // 3. Lógica del botón de chat
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        btnChat.addEventListener("click", function (e) {
            e.preventDefault();
            showCustomConfirm(
                "Aviso",
                "¿Quieres chatear con el usuario que ha publicado el trabajo?",
                () => {
                    window.location.href = `chat.html?id=${trabajoId}`;
                },
                "Aceptar",
                "Cancelar",
                "confirm"
            );
        });
    }
});

/**
 * Función para inyectar los datos del trabajo en el HTML
 */
function renderTrabajo(trabajo) {
    // Imagen
    const imgEl = document.querySelector('.job-img');
    if (imgEl) {
        imgEl.src = trabajo.foto_trabajo || "../assets/img/trabajo-defecto.png";
    }

    // Info principal
    const titleEl = document.querySelector('.job-title');
    if (titleEl) titleEl.innerText = trabajo.titulo;

    const descEl = document.querySelector('.job-description');
    if (descEl) descEl.innerText = trabajo.descripcion || "Sin descripción detallada.";

    const locEl = document.querySelector('.italic');
    if (locEl) locEl.innerText = trabajo.direccion || "Ubicación no especificada";

    // Pagos y XP
    const xp = trabajo.xp_otorgada || Math.round(trabajo.pago_cliente * 10);

    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 2) {
        statValues[0].innerText = `${Number(trabajo.pago_cliente).toFixed(2)} €`;
        statValues[1].innerText = `${xp} XP`;
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
            // Si es Timestamp de Firebase
            const f = trabajo.fecha_limite.toDate ? trabajo.fecha_limite.toDate() : new Date(trabajo.fecha_limite);
            fechaStr = f.toLocaleDateString();
        }
        infoTexts[2].innerText = fechaStr;
    }
}