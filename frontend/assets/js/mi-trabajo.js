import { obtenerTrabajoPorId } from './database.js';

document.addEventListener("DOMContentLoaded", async function () {
    // 1. Obtener el ID del trabajo desde la URL
    const urlParams = new URLSearchParams(window.location.search);
    const trabajoId = urlParams.get('id');

    if (!trabajoId) {
        console.error("No se proporcionó ID de trabajo");
        return;
    }

    // 2. Cargar datos del trabajo desde Firestore
    try {
        const trabajo = await obtenerTrabajoPorId(trabajoId);
        if (trabajo) {
            renderTrabajo(trabajo);
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

            // Como soy el trabajador, este botón me llevará al chat con el publicador
            showCustomConfirm(
                "Chat",
                "¿Quieres hablar con la persona que publicó esta oferta?",
                () => {
                    window.location.href = `chat.html?id=${trabajoId}`;
                },
                "Chatear",
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
        // EL TRABAJADOR VE PAGO_TRABAJADOR
        const pago = trabajo.pago_trabajador || (trabajo.pago_cliente * 0.9);
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
}