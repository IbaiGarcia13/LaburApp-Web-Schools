import { auth } from './firebase-config.js';
import { obtenerUsuarioPorId, obtenerTodosPuntosCategorias } from './database.js';

// Lógica cargada al visualizar el perfil de un usuario externo
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (!userId) {
        console.error("No se proporcionó ID de usuario");
        return;
    }

    const catInfo = {
        'gastronomia': { nombre: 'Gastronomía', color: 'd-yellow' },
        'informatica': { nombre: 'Informática', color: 'd-blue' },
        'limpieza': { nombre: 'Limpieza', color: 'd-purple' },
        'mascotas': { nombre: 'Mascotas', color: 'd-green-dark' },
        'carpinteria': { nombre: 'Carpintería', color: 'd-brown' },
        'otros': { nombre: 'Otros', color: 'd-black' },
        'jardineria': { nombre: 'Jardinería', color: 'd-green-light' },
        'cuidado_personal': { nombre: 'Cuidado Personal', color: 'd-pink' },
        'evento': { nombre: 'Evento', color: 'd-red' },
        'diseno': { nombre: 'Diseño', color: 'd-teal' }
    };

    loadUserData(userId);

    async function loadUserData(uid) {
        try {
            const user = await obtenerUsuarioPorId(uid);
            const ptsCat = await obtenerTodosPuntosCategorias(uid);

            if (user) {
                renderUser(user, ptsCat);
            } else {
                console.error("Usuario no encontrado");
            }
        } catch (e) {
            console.error("Error cargando usuario:", e);
        }
    }

    function renderUser(user, ptsCat) {
        document.querySelector('h1').textContent = user.nombre_completo || (user.nombre + " " + user.apellidos);
        document.querySelector('.description').textContent = user.bio || "Este usuario aún no tiene biografia.";
        document.querySelector('.italic').textContent = user.direccion_principal || "Ubicación no especificada";

        // CV logic
        const pdfRow = document.getElementById('pdfRow');
        const displayPDF = document.getElementById('displayPDF');
        if (user.curriculum_url) {
            if (pdfRow) pdfRow.style.display = "flex";
            if (displayPDF) displayPDF.href = user.curriculum_url;
        } else {
            if (pdfRow) pdfRow.style.display = "none";
        }

        const pic = document.querySelector('.profile-pic');
        if (pic) pic.src = user.foto_perfil || "../assets/img/avatar-defecto.png";

        // Stats
        const nLvl = user.nivel || 1;
        const xpActual = user.experiencia_nivel_actual || 0;
        const maxXP = (nLvl + 1) * 100;

        document.querySelector('.lvl-val').textContent = nLvl;
        const xpBars = document.querySelectorAll('.xp-header span');
        if (xpBars.length >= 3) {
            xpBars[1].textContent = `${xpActual} XP`;
            xpBars[2].textContent = `${maxXP} XP`;
        }
        const xpFill = document.querySelector('.xp-fill');
        if (xpFill) {
            xpFill.style.width = Math.min((xpActual / maxXP) * 100, 100) + "%";
        }

        const stats = document.querySelectorAll('.stat-item strong');
        if (stats.length >= 3) {
            stats[0].textContent = (user.valoracion_media || 0).toFixed(1);

            let maxPts = -1;
            let bestCatId = null;
            ptsCat.forEach(c => {
                if (c.puntos > maxPts) {
                    maxPts = c.puntos;
                    bestCatId = c.id_categoria;
                }
            });

            if (bestCatId && maxPts > 0) {
                const info = catInfo[bestCatId] || { nombre: bestCatId };
                stats[1].textContent = `${info.nombre} (${maxPts} pts)`;
            } else {
                stats[1].textContent = "Ninguna (0 pts)";
            }

            stats[2].textContent = (user.dinero_ganado_total || 0).toLocaleString() + " €";
        }

        // Categorías
        const grid = document.querySelector('.cat-grid');
        if (grid) {
            grid.innerHTML = "";
            ptsCat.forEach(c => {
                if (c.puntos > 0) {
                    const info = catInfo[c.id_categoria] || { nombre: c.id_categoria, color: 'd-black' };
                    const div = document.createElement('div');
                    div.className = 'cat-item';
                    div.innerHTML = `<span class="dot ${info.color}"></span> <strong>${info.nombre}:</strong> ${c.puntos} puntos`;
                    grid.appendChild(div);
                }
            });
            if (grid.innerHTML === "") {
                grid.innerHTML = "<p>Sin puntuaciones en categorías.</p>";
            }
        }
    }

    const btnChat = document.getElementById('btn-chat');
    if (btnChat) {
        btnChat.addEventListener('click', (e) => {
            e.preventDefault();
            showCustomConfirm(
                "Chatear con usuario",
                "¿Quieres chatear con este usuario?",
                () => {
                    window.location.href = `chat.html?id_receptor=${userId}`;
                },
                "Aceptar",
                "Cancelar"
            );
        });
    }
});