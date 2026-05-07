import { auth } from './firebase-config.js';
import { obtenerValoracionesRecibidas, obtenerClasePorId } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let allValoraciones = [];

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadValoraciones(user.uid);
    } else {
      window.location.href = "../index.html";
    }
  });

  const btnFiltrar = document.getElementById('btnAplicarFiltros');
  if (btnFiltrar) {
    btnFiltrar.addEventListener('click', applyFilters);
  }
});

async function loadValoraciones(uid) {
  const listContainer = document.getElementById('valoracionesList');
  listContainer.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>Cargando tus notas...</p>";

  try {
    allValoraciones = await obtenerValoracionesRecibidas(uid);
    
    // Para cada valoración, intentar obtener la asignatura si no la tiene
    // (En el futuro las tareas tendrán id_Categoría, pero por ahora podemos mapear)
    
    displayValoraciones(allValoraciones);
    updateStats(allValoraciones);
  } catch (e) {
    console.error("Error al cargar valoraciones:", e);
    listContainer.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: red;'>Error al cargar las valoraciones.</p>";
  }
}

function updateStats(list) {
  const statsSummary = document.getElementById('statsSummary');
  const avgScoreEl = document.getElementById('avgScore');
  const totalTasksEl = document.getElementById('totalTasks');

  if (list.length === 0) {
    statsSummary.style.display = 'none';
    return;
  }

  const total = list.length;
  const sum = list.reduce((acc, curr) => acc + (curr.puntuacion || 0), 0);
  const avg = (sum / total).toFixed(1);

  avgScoreEl.innerText = avg;
  totalTasksEl.innerText = total;
  statsSummary.style.display = 'flex';
}

function displayValoraciones(list) {
  const listContainer = document.getElementById('valoracionesList');
  listContainer.innerHTML = "";

  if (list.length === 0) {
    listContainer.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: var(--gray-4);'>No tienes valoraciones registradas aún.</p>";
    return;
  }

  list.sort((a, b) => {
    const dA = a.fecha?.toMillis ? a.fecha.toMillis() : 0;
    const dB = b.fecha?.toMillis ? b.fecha.toMillis() : 0;
    return dB - dA;
  });

  list.forEach(val => {
    const card = document.createElement('div');
    const score = val.puntuacion || 0;
    
    let colorClass = "";
    if (score >= 9) colorClass = "val-card-9-10";
    else if (score >= 7) colorClass = "val-card-7-8";
    else if (score >= 5) colorClass = "val-card-5-6";
    else colorClass = "val-card-0-4";

    card.className = `valoracion-card ${colorClass}`;
    
    const dateObj = val.fecha?.toDate ? val.fecha.toDate() : new Date();
    const dateStr = dateObj.toLocaleDateString();

    card.innerHTML = `
      <div class="val-header">
        <div class="val-score">${score}<span>/10</span></div>
        <div class="val-date">${dateStr}</div>
      </div>
      <div class="val-title">${val.titulo_trabajo || "Tarea sin Título"}</div>
      <span class="val-subject">${val.asignatura || "General"}</span>
      <div class="val-comment">${val.comentario || "Sin comentarios."}</div>
    `;
    listContainer.appendChild(card);
  });
}

function applyFilters() {
  const asignatura = document.getElementById('filterAsignatura').value;
  const puntosRange = document.getElementById('filterPuntos').value;
  const fechaDesde = document.getElementById('filterFechaDesde').value;
  const fechaHasta = document.getElementById('filterFechaHasta').value;

  let filtered = allValoraciones.filter(v => {
    // Filtro asignatura
    const vAsig = v.asignatura || v.id_Categoría || "";
    if (asignatura !== 'todas' && vAsig !== asignatura) return false;

    // Filtro puntos
    if (puntosRange !== 'todas') {
      const score = v.puntuacion || 0;
      if (puntosRange === '9-10' && score < 9) return false;
      if (puntosRange === '7-8' && (score < 7 || score > 8.9)) return false;
      if (puntosRange === '5-6' && (score < 5 || score > 6.9)) return false;
      if (puntosRange === '0-4' && score >= 5) return false;
    }

    // Filtro fecha
    const vFecha = v.fecha?.toDate ? v.fecha.toDate() : new Date();
    if (fechaDesde && vFecha < new Date(fechaDesde)) return false;
    if (fechaHasta) {
      const h = new Date(fechaHasta);
      h.setHours(23, 59, 59);
      if (vFecha > h) return false;
    }

    return true;
  });

  displayValoraciones(filtered);
}



