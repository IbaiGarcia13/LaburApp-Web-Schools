import { auth, db } from './firebase-config.js';
import { obtenerTrabajoPorId, aceptarTareaDirectamente } from './database.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async function () {
   
    const urlParams = new URLSearchParams(window.location.search);
    const trabajoId = urlParams.get('id');

    if (!trabajoId) {
        console.error("No se proporcionó ID de trabajo");
        return;
    }

    let currentTrabajo = null;

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
            const btnPostular = document.getElementById("btn-postular");
            const btnChat = document.getElementById("btn-chat");

            if (!user) {
                if (btnPostular) {
                    btnPostular.style.display = 'block';
                    btnPostular.onclick = () => window.verificarSesion(null, "postularte a este trabajo");
                }
                if (btnChat) {
                    btnChat.onclick = (e) => {
                        e.preventDefault();
                        window.verificarSesion(null, "chatear con el publicador");
                    };
                }
                return;
            }

            if (user.uid === trabajo.id_publicador) {
                if (btnPostular) btnPostular.style.display = 'none';
                return;
            }

            if (trabajo.estado !== "Pendiente") {
                if (btnPostular) btnPostular.style.display = 'none';
                return;
            }

            if (trabajo.id_trabajador === user.uid) {
                if (btnPostular) {
                    btnPostular.innerText = "TAREA ACEPTADA";
                    btnPostular.disabled = true;
                    btnPostular.style.opacity = "0.6";
                    btnPostular.style.display = 'block';
                }
            } else {
                if (btnPostular) {
                    btnPostular.innerText = "ACEPTAR TAREA";
                    btnPostular.style.display = 'block';
                    btnPostular.onclick = async () => {
                        showCustomConfirm(
                            "Aceptar Tarea",
                            "¿Quieres aceptar esta tarea y empezar a realizarla?",
                            async () => {
                                try {
                                    await aceptarTareaDirectamente(trabajo.id);
                                    showCustomAlert("¡Éxito!", "Has aceptado la tarea correctamente.");
                                    btnPostular.innerText = "TAREA ACEPTADA";
                                    btnPostular.disabled = true;
                                    btnPostular.style.opacity = "0.6";
                                } catch (err) {
                                    showCustomAlert("Error", "No se pudo aceptar la tarea.");
                                }
                            }
                        );
                    };
                }
            }
        });
    }

   // --- 3. LÓGICA DEL BOTÓN DE CHAT ---
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        btnChat.addEventListener("click", function (e) {
            e.preventDefault();

            window.verificarSesion(() => {
                if (currentTrabajo && currentTrabajo.id_publicador) {
                    window.location.href = `chat.html?id=${trabajoId}&userId=${currentTrabajo.id_publicador}`;
                }
            }, "chatear con el publicador");
        });
    }
});

function renderTrabajo(trabajo) {
   
    const imgEl = document.querySelector('.job-img');
    if (imgEl) {
        imgEl.src = trabajo.foto_trabajo || "../assets/img/trabajo-defecto.png";
    }

    const titleEl = document.querySelector('.job-title');
    if (titleEl) titleEl.innerText = trabajo.titulo;

    const descEl = document.querySelector('.job-description');
    if (descEl) descEl.innerText = trabajo.descripcion || "Sin descripción detallada.";

    const locEl = document.querySelector('.italic');
    if (locEl) locEl.innerText = trabajo.direccion || "Ubicación no especificada";

    const xp = trabajo.xp_otorgada || Math.round(trabajo.pago_cliente * 10);

    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 2) {
        statValues[0].innerText = `${Number(trabajo.pago_cliente).toFixed(2)} €`;
        statValues[1].innerText = `${xp} XP`;
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

    // Mapa eliminado
}

// initMiniMap eliminado
