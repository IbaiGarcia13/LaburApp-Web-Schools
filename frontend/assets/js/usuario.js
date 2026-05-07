import { auth, db } from './firebase-config.js';
import { collection, query, getDocs, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { obtenerUsuarioPorId, obtenerTodosPuntosCategorias, obtenerValoracionesRecibidas } from './database.js';
// --- LÓGICA CARGADA AL VISUALIZAR EL PERFIL DE UN USUARIO EXTERNO ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    let userId = urlParams.get('id') || urlParams.get('uid');

    console.log("Cargando perfil para ID:", userId);

    if (!userId || userId === "undefined" || userId === "null") {
        console.error("No se proporcionó ID de usuario válido");
        const h1 = document.querySelector('h1');
        if (h1) h1.textContent = "Usuario no especificado";
        return;
    }

    const catInfo = {
        'matematicas': { nombre: 'Matemáticas', color: 'cat-dot-carpinteria' },
        'filosofia': { nombre: 'Filosofía', color: 'cat-dot-construccion' },
        'lengua castellana': { nombre: 'Lengua Castellana', color: 'cat-dot-cuidado_personal' },
        'inglés': { nombre: 'Inglés', color: 'cat-dot-diseno' },
        'lengua extranjera 1': { nombre: 'Lengua Extranjera 1', color: 'cat-dot-evento' },
        'lengua extranjera 2': { nombre: 'Lengua Extranjera 2', color: 'cat-dot-gastronomia' },
        'segunda lengua oficial': { nombre: 'Segunda Lengua Oficial', color: 'cat-dot-informatica' },
        'latin': { nombre: 'Latín', color: 'cat-dot-jardineria' },
        'ciencias': { nombre: 'Ciencias', color: 'cat-dot-limpieza' },
        'biología': { nombre: 'Biología', color: 'cat-dot-mascotas' },
        'fisica': { nombre: 'Física', color: 'cat-dot-mudanza' },
        'quimica': { nombre: 'Química', color: 'cat-dot-transporte' },
        'educacion fisica': { nombre: 'Educación Física', color: 'cat-dot-otros' },
        'musica': { nombre: 'Música', color: 'cat-dot-otros' },
        'plastica': { nombre: 'Plástica', color: 'cat-dot-otros' },
        'tecnologia': { nombre: 'Tecnología', color: 'cat-dot-otros' },
        'religion': { nombre: 'Religión', color: 'cat-dot-otros' },
        'informatica': { nombre: 'Informática', color: 'cat-dot-otros' },
        'historia': { nombre: 'Historia', color: 'cat-dot-otros' },
        'geografía': { nombre: 'Geografía', color: 'cat-dot-otros' },
        'economia': { nombre: 'Economía', color: 'cat-dot-otros' },
        'ciencias sociales': { nombre: 'Ciencias Sociales', color: 'cat-dot-otros' },
        'dibujo tecnico': { nombre: 'Dibujo Técnico', color: 'cat-dot-otros' }
    };

    loadUserData(userId);

    async function loadUserData(uid) {
        try {
            const user = await obtenerUsuarioPorId(uid);
            if (!user) {
                console.error("Usuario no encontrado");
                return;
            }

            // Intentar obtener puntuaciones (puede fallar por permisos)
            let ptsCat = [];
            try {
                const q = query(collection(db, "usuarios", uid, "puntuaciones_categorias"));
                const snapshot = await getDocs(q);
                snapshot.forEach(docSnap => {
                    ptsCat.push({
                        id_categoria: docSnap.id,
                        puntos: docSnap.data().puntos || 0,
                        fecha_creacion: docSnap.data().fecha_creacion?.toDate ? docSnap.data().fecha_creacion.toDate() : (docSnap.data().fecha_creacion || 0)
                    });
                });
            } catch (err) {
                console.warn("No se pudieron cargar las puntuaciones de categoría:", err);
            }

            // Intentar obtener valoraciones (puede fallar por permisos)
            let valoraciones = [];
            try {
                valoraciones = await obtenerValoracionesRecibidas(uid);
            } catch (err) {
                console.warn("No se pudieron cargar las valoraciones:", err);
            }

            // Renderizar lo que tengamos
            renderUser(user, ptsCat);

        } catch (e) {
            console.error("Error crítico cargando usuario:", e);
            // Intentar al menos mostrar un error visual si falla todo
            const h1 = document.querySelector('h1');
            if (h1) h1.textContent = "Error al cargar";
        }
    }


    async function renderUser(user, ptsCat) {
        document.querySelector('h1').textContent = user.nombre_completo || (user.nombre + " " + user.apellidos);
        document.querySelector('.description').textContent = user.bio || "Este usuario aún no tiene biografia.";

        const displayContact = document.getElementById('displayContact');
        const contactRow = document.getElementById('contactRow');
        if (displayContact) {
            if (user.email_contacto) {
                displayContact.textContent = user.email_contacto;
                if (contactRow) contactRow.style.display = "flex";
            } else {
                if (contactRow) contactRow.style.display = "none";
            }
        }

        const isDocente = user.rol === 'docente';
        const statsCard = document.querySelector('.stats-card');
        const categoriesTitle = document.getElementById('categoriesTitle');

        if (isDocente) {
            if (statsCard) statsCard.style.display = 'none';
            if (categoriesTitle) categoriesTitle.textContent = "Asignaturas";
            
            // Cargar asignaturas desde sus clases
            const grid = document.getElementById('categoriesGrid');
            if (grid) {
                grid.innerHTML = "<p>Cargando asignaturas...</p>";
                try {
                    const q = query(collection(db, "clases"), where("id_docente", "==", userId));
                    const snap = await getDocs(q);
                    const subjects = new Set();
                    snap.forEach(docSnap => {
                        const data = docSnap.data();
                        if (data.Asignatura) subjects.add(data.Asignatura);
                    });

                    if (subjects.size > 0) {
                        grid.innerHTML = "";
                        subjects.forEach(sub => {
                            const info = catInfo[sub.toLowerCase()] || { nombre: sub, color: 'cat-dot-otros' };
                            const div = document.createElement('div');
                            div.className = 'cat-item';
                            div.innerHTML = `<span class="dot ${info.color}"></span> <strong>${info.nombre}</strong>`;
                            grid.appendChild(div);
                        });
                    } else {
                        grid.innerHTML = "<p>Este docente aún no imparte ninguna asignatura.</p>";
                    }
                } catch (err) {
                    console.error("Error cargando asignaturas del docente:", err);
                    grid.innerHTML = "<p>Error al cargar las asignaturas.</p>";
                }
            }
        } else {
            // LÓGICA ALUMNO (Stats + Puntos)
            if (statsCard) statsCard.style.display = 'block';
            if (categoriesTitle) categoriesTitle.textContent = "Progreso Académico";

            // Curriculum logic removed as per request

            const pic = document.querySelector('.profile-pic');
            if (pic) {
                const rolParaAvatar = (user.rol || "alumno").toLowerCase();
                pic.src = user.foto_perfil || `../assets/img/avatar-defecto-${rolParaAvatar}.png`;
            }

            const nLvl = user.nivel || 1;
            const xpActual = user.experiencia_nivel_actual || 0;
            const maxXP = 100 + (nLvl - 1) * 50;

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
            const cursoStatItem = document.getElementById('cursoStatItem');

            if (stats.length >= 3) { // Ahora hay 3 elementos strong en el DOM si es alumno
                stats[0].textContent = (user.valoracion_media !== undefined ? user.valoracion_media : 0).toFixed(1);

                let maxPts = -1;
                let bestCatId = null;
                let oldestDate = Infinity;

                ptsCat.forEach(c => {
                    if (c.puntos > maxPts) {
                        maxPts = c.puntos;
                        bestCatId = c.id_categoria;
                        oldestDate = c.fecha_creacion;
                    } else if (c.puntos === maxPts && c.puntos > 0) {
                        if (c.fecha_creacion < oldestDate) {
                            bestCatId = c.id_categoria;
                            oldestDate = c.fecha_creacion;
                        }
                    }
                });

                if (bestCatId && maxPts > 0) {
                    const info = catInfo[bestCatId.toLowerCase()] || { nombre: bestCatId };
                    stats[1].textContent = `${info.nombre} (${maxPts} pts)`;
                } else {
                    stats[1].textContent = "Ninguna (0 pts)";
                }

                // Mostrar curso si es alumno
                if (cursoStatItem) {
                    cursoStatItem.style.display = 'flex';
                    stats[2].textContent = user.curso || "No especificado";
                }
            } else if (stats.length === 2) {
                // Fallback si por algún motivo solo hay 2
                stats[0].textContent = (user.valoracion_media !== undefined ? user.valoracion_media : 0).toFixed(1);
                // ... (lógica simplificada si falla la cuenta de elementos)
            }

            const grid = document.getElementById('categoriesGrid');
            if (grid) {
                ptsCat.sort((a, b) => b.puntos - a.puntos);
                grid.innerHTML = "";
                ptsCat.forEach(c => {
                    if (c.puntos > 0) {
                        const info = catInfo[c.id_categoria.toLowerCase()] || { nombre: c.id_categoria, color: 'cat-dot-otros' };
                        const div = document.createElement('div');
                        div.className = 'cat-item';
                        div.innerHTML = `<span class="dot ${info.color}"></span> <strong>${info.nombre}:</strong> ${c.puntos} puntos`;
                        grid.appendChild(div);
                    }
                });
                if (grid.innerHTML === "") {
                    grid.innerHTML = "<p>Sin puntuaciones en asignaturas todavía.</p>";
                }
            }
        }

        // Foto de perfil (común a ambos pero con rol específico)
        const pic = document.querySelector('.profile-pic');
        if (pic) {
            const rolParaAvatar = (user.rol || "alumno").toLowerCase();
            pic.src = user.foto_perfil || `../assets/img/avatar-defecto-${rolParaAvatar}.png`;
        }
    }

    function renderValoraciones(valoraciones) {
        const list = document.getElementById('reviewsList');
        if (!list) return;

        list.innerHTML = "";

        if (!valoraciones || valoraciones.length === 0) {
            list.innerHTML = "<p style='color: var(--gray-5);'>Este usuario aún no tiene valoraciones.</p>";
            return;
        }

        const LIMIT = 5;
        const visibles = valoraciones.slice(0, LIMIT);
        const ocultas = valoraciones.slice(LIMIT);

        function crearCard(val) {
            const div = document.createElement('div');
            div.className = 'review-card';

            const foto = val.emisor_foto || "../assets/img/avatar-defecto.png";
            const nombre = val.emisor_nombre || "Usuario Anónimo";
            const puntos = val.puntuacion || 0;
            const comentario = val.comentario || "<i style='color:#999'>Sin comentario.</i>";

            let estrellasHTML = "";
            for (let i = 1; i <= 5; i++) {
                if (i <= puntos) {
                    estrellasHTML += `<span style="color: var(--yellow-2); font-size: 1.125rem;">&#9733;</span>`;
                } else {
                    estrellasHTML += `<span style="color: var(--gray-3); font-size: 1.125rem;">&#9733;</span>`;
                }
            }

            let fechaStr = "";
            if (val.fecha) {
                const date = val.fecha.toDate ? val.fecha.toDate() : new Date(val.fecha);
                fechaStr = date.toLocaleDateString();
            }

            div.innerHTML = `
                <div class="review-header">
                    <a href="usuario.html?id=${val.id_usuario_emisor}" style="text-decoration:none; display:flex; align-items:center; gap:12px; color:inherit;">
                        <img src="${foto}" alt="${nombre}" class="review-avatar" style="margin:0;">
                    </a>
                    <div class="review-user-info">
                        <a href="usuario.html?id=${val.id_usuario_emisor}" style="text-decoration:none; color:inherit;">
                            <strong>${nombre}</strong>
                        </a>
                        <div class="review-stars-date">
                            <span class="stars">${estrellasHTML}</span>
                            <span class="review-date">${fechaStr}</span>
                        </div>
                    </div>
                </div>
                <div class="review-body">
                    ${val.titulo_trabajo ? `<span style="display:block; font-size: 0.75rem; color: var(--gray-4); margin-bottom: 5px;">Trabajo: <b>${val.titulo_trabajo}</b></span>` : ''}
                    <p>${comentario}</p>
                </div>
            `;
            return div;
        }

        visibles.forEach(val => list.appendChild(crearCard(val)));

        if (ocultas.length > 0) {
            const btnVerMas = document.createElement('button');
            btnVerMas.id = 'btnVerMasValoraciones';
            btnVerMas.className = 'btn-ver-mas-valoraciones';
            btnVerMas.textContent = `Ver más valoraciones (${ocultas.length} restantes)`;
            btnVerMas.addEventListener('click', () => {
                ocultas.forEach(val => list.appendChild(crearCard(val)));
                btnVerMas.remove();
            });
            list.after(btnVerMas);
        }
    }

    const btnChat = document.getElementById('btn-chat');
    if (btnChat) {
        btnChat.addEventListener('click', (e) => {
            e.preventDefault();
            window.verificarSesion(() => {
                window.location.href = `chat.html?userId=${userId}`;
            }, "iniciar un chat con este usuario");
        });
    }
});