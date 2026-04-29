import { auth, db } from './firebase-config.js';
import { obtenerPerfilUsuario } from './database.js';
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
                        renderizarClases(perfil.clases || []);
                    }
                }
            } catch (error) {
                console.error("Error cargando el perfil del usuario:", error);
            }
        } else {
            if (dashboardStats) dashboardStats.style.display = 'none';
        }
    });

    async function renderizarClases(claseIds) {
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
                    
                    // Colores por defecto según la categoría/color guardado
                    const headerColor = obtenerColorClase(clase.color);

                    // Obtener nombre del docente
                    const docente = await obtenerPerfilUsuario(clase.id_docente);
                    const nombreDocente = docente ? `${docente.nombre} ${docente.apellidos || ''}` : "Cargando...";

                    card.innerHTML = `
                        <div class="class-card-header" style="background: ${headerColor}">
                            <h3>${clase.nombre}</h3>
                            <p class="card-teacher-name" style="font-size: 0.9rem; opacity: 0.9; margin-top: 5px;">Docente: ${nombreDocente}</p>
                        </div>
                        <div class="class-card-body">
                            <p>${clase.Descripción || "Sin descripción disponible."}</p>
                        </div>
                    `;
                    
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
            'cat-1': '#4285f4', // Azul
            'cat-2': '#34a853', // Verde
            'cat-3': '#fbbc05', // Amarillo
            'cat-4': '#ea4335', // Rojo
            'cat-5': '#673ab7', // Morado
            'cat-6': '#009688', // Teal
            'cat-7': '#ff5722', // Naranja
            'cat-8': '#607d8b', // Blue Grey
            'cat-9': '#e91e63', // Rosa
            'cat-10': '#795548', // Marrón
            'cat-11': '#00bcd4', // Cyan
            'cat-12': '#8bc34a'  // Light Green
        };
        return colors[colorKey] || '#1a1a1a';
    }

});
