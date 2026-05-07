import { auth, db } from './firebase-config.js';
import { obtenerPerfilUsuario, obtenerTodosPuntosCategorias } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const statNivel = document.getElementById('stat-nivel');
    const statNota = document.getElementById('stat-nota');
    const dashboardStats = document.getElementById('dashboardStats');
    const classesGrid = document.getElementById('classesGrid');

    const btnCrearClase = document.getElementById('btnCrearClase');
    const btnUnirseClase = document.getElementById('btnUnirseClase');

    const dropdownName = document.querySelector('.dropdown-name');
    const dropdownEmail = document.querySelector('.dropdown-email');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const perfil = await obtenerPerfilUsuario(user.uid);

                if (perfil) {
                    if (dashboardStats) dashboardStats.style.display = 'flex';

                    // --- Actualizar Estadísticas ---
                    if (statNivel) statNivel.textContent = perfil.nivel || 1;
                    if (statNota) statNota.textContent = (perfil.nota_media || 0).toFixed(1);

                    // --- Puntos Totales ---
                    const statPuntos = document.getElementById('stat-puntos');
                    if (statPuntos) {
                        const ptsCats = await obtenerTodosPuntosCategorias(user.uid);
                        const total = ptsCats.reduce((sum, cat) => sum + (cat.puntos || 0), 0);
                        statPuntos.textContent = total;
                    }

                    // --- Mostrar Botones según Rol ---
                    const rol = (perfil.rol || "").toLowerCase();
                    if (rol === "docente") {
                        if (btnCrearClase) btnCrearClase.style.display = 'flex';
                        if (btnUnirseClase) btnUnirseClase.style.display = 'none';
                    } else if (rol === "alumno") {
                        if (btnCrearClase) btnCrearClase.style.display = 'none';
                        if (btnUnirseClase) btnUnirseClase.style.display = 'flex';
                    }

                    // --- Actualizar Header ---
                    if (dropdownName) dropdownName.textContent = (perfil.nombre || "Usuario").split(' ')[0];
                    if (dropdownEmail) dropdownEmail.textContent = user.email;

                    // --- Cargar Clases ---
                    if (classesGrid) {
                        renderizarClases(perfil.clases || [], perfil);
                    }
                }
            } catch (error) {
                console.error("Error cargando el perfil del usuario:", error);
            }
        } else {
            if (dashboardStats) dashboardStats.style.display = 'none';
        }
    });

    async function renderizarClases(claseIds, perfil) {
        if (!classesGrid) return;
        classesGrid.innerHTML = "";

        if (claseIds.length === 0) {
            classesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.7); padding: 40px;">
                    <p>Aún no tienes clases. ¡Crea una o únete a una para empezar!</p>
                </div>
            `;
            return;
        }

        for (const id of claseIds) {
            try {
                const docSnap = await getDoc(doc(db, "clases", id));
                if (docSnap.exists()) {
                    const clase = docSnap.data();
                    const card = document.createElement('div');
                    card.className = 'class-card';
                    
                    // Colores por defecto o personalizados
                    let colorKey = clase.color;
                    if (perfil.preferencias_clases && perfil.preferencias_clases[id] && perfil.preferencias_clases[id].color) {
                        colorKey = perfil.preferencias_clases[id].color;
                    }
                    const headerColor = obtenerColorClase(colorKey);

                    // Obtener nombre del docente
                    const docente = await obtenerPerfilUsuario(clase.id_docente);
                    const nombreDocente = docente ? `${docente.nombre} ${docente.apellidos || ''}` : "Cargando...";

                    card.innerHTML = `
                        <div class="class-card-header" style="background: ${headerColor}">
                            <h3>${clase.nombre}</h3>
                            <p class="card-teacher-name" style="font-size: 0.9rem; color: #fff !important; opacity: 1; margin-top: 5px;">
                                Docente: ${clase.id_docente ? `<a href="usuario.html?id=${clase.id_docente}" class="teacher-link" style="color: #fff; text-decoration: underline;">${nombreDocente}</a>` : nombreDocente}
                            </p>
                            <span class="card-subject-tag-header">${clase.Asignatura || "General"}</span>
                        </div>
                        <div class="class-card-body">
                            <p>${clase.Descripción || "Sin descripción disponible."}</p>
                        </div>
                    `;

                    // Evitar que al pulsar el docente se abra la clase
                    const teacherLink = card.querySelector('.teacher-link');
                    if (teacherLink) {
                        teacherLink.onclick = (e) => {
                            e.stopPropagation();
                        };
                    }
                    
                    card.onclick = () => {
                        window.location.href = `clase.html?id=${id}`;
                    };
                    
                    classesGrid.appendChild(card);
                }
            } catch (err) {
                console.error("Error al cargar clase:", id, err);
            }
        }
    }

    function obtenerColorClase(colorKey) {
        const colors = {
            'cat-1': '#4285f4',
            'cat-2': '#e46363',
            'cat-3': '#71b77f',
            'cat-4': '#659ee8',
            'cat-5': '#ffd54f',
            'cat-6': '#bc5ad2',
            'cat-7': '#b07c4c',
            'cat-8': '#ff9152',
            'cat-9': '#5def81',
            'cat-10': '#6fb9e7',
            'cat-11': '#edec84',
            'cat-12': '#f07dc8',
            'cat-13': '#919191'
        };
        return colors[colorKey] || '#1a1a1a';
    }

});
