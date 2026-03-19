import { auth } from './firebase-config.js';
import { obtenerPerfilUsuario } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    const statNivel = document.getElementById('stat-nivel');
    const statXp = document.getElementById('stat-xp');
    const statDinero = document.getElementById('stat-dinero');
    const dashboardStats = document.getElementById('dashboardStats');

    // Header elements (Using querySelector because they don't have IDs in HTML)
    const dropdownName = document.querySelector('.dropdown-name');
    const dropdownEmail = document.querySelector('.dropdown-email');

    // Escuchar el estado de autenticación en tiempo real
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // 1. Obtener datos del usuario desde Firestore
                const perfil = await obtenerPerfilUsuario(user.uid);

                if (perfil) {
                    // 2. Mostrar la sección de estadísticas
                    if (dashboardStats) dashboardStats.style.display = 'flex';

                    // 3. Rellenar los datos en formato visual
                    if (statNivel) statNivel.textContent = perfil.nivel || 1;
                    if (statXp) statXp.textContent = (perfil.experiencia_total || 0).toLocaleString() + " XP";

                    // Formatear el dinero como moneda (Euros)
                    const dinero = perfil.dinero_ganado_total || 0;
                    if (statDinero) statDinero.textContent = dinero.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

                    // 4. Actualizar dinámicamente el Header (Desplegable superior derecho)
                    if (dropdownName) dropdownName.textContent = perfil.nombre_completo || (perfil.nombre + " " + perfil.apellidos);
                    if (dropdownEmail) dropdownEmail.textContent = user.email;
                }
            } catch (error) {
                console.error("Error cargando el perfil del usuario:", error);
            }
        } else {
            // Si no hay usuario logueado, ocultar las estadísticas o redirigir
            if (dashboardStats) dashboardStats.style.display = 'none';
            // window.location.href = '../index.html'; // Opcional: Echarlo si intenta entrar sin sesión
        }
    });

});
