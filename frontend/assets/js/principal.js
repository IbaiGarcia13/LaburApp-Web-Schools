import { auth } from './firebase-config.js';
import { obtenerPerfilUsuario, obtenerTrabajosPublicadosPorMi } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    const statNivel = document.getElementById('stat-nivel');
    const statTareas = document.getElementById('stat-tareas');
    const statTareasTitulo = document.getElementById('stat-tareas-titulo');
    const statDinero = document.getElementById('stat-dinero');
    const dashboardStats = document.getElementById('dashboardStats');

   // --- HEADER ELEMENTS (USING QUERYSELECTOR BECAUSE THEY DON'T HAVE IDS IN HTML) ---
    const dropdownName = document.querySelector('.dropdown-name');
    const dropdownEmail = document.querySelector('.dropdown-email');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
               
                const perfil = await obtenerPerfilUsuario(user.uid);

                if (perfil) {
                   
                    if (dashboardStats) dashboardStats.style.display = 'flex';

                    if (statNivel) statNivel.textContent = perfil.nivel || 1;

                   // --- LÓGICA PARA MOSTRAR LO QUE MÁS TENGA (SUBIDAS VS REALIZADAS) ---
                    const trabajosSubidos = await obtenerTrabajosPublicadosPorMi(user.uid);
                    const numSubidas = trabajosSubidos ? trabajosSubidos.length : 0;
                    const numRealizadas = perfil.tareas_realizadas || 0;

                    if (numSubidas > numRealizadas) {
                        if (statTareasTitulo) statTareasTitulo.textContent = "Tareas Subidas";
                        if (statTareas) statTareas.textContent = numSubidas.toLocaleString();
                    } else {
                        if (statTareasTitulo) statTareasTitulo.textContent = "Tareas Realizadas";
                        if (statTareas) statTareas.textContent = numRealizadas.toLocaleString();
                    }

                    const dinero = perfil.dinero_ganado_total || 0;
                    if (statDinero) statDinero.textContent = dinero.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

                   // --- 4. ACTUALIZAR DINÁMICAMENTE EL HEADER (DESPLEGABLE SUPERIOR DERECHO) ---
                    if (dropdownName) dropdownName.textContent = (perfil.nombre || "Usuario").split(' ')[0];
                    if (dropdownEmail) dropdownEmail.textContent = user.email;
                }
            } catch (error) {
                console.error("Error cargando el perfil del usuario:", error);
            }
        } else {
           
            if (dashboardStats) dashboardStats.style.display = 'none';
           
        }
    });

});
