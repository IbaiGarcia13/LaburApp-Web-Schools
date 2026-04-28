import { auth, db } from './firebase-config.js';
import { obtenerPerfilUsuario, obtenerClasePorId } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, updateDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  const urlParams = new URLSearchParams(window.location.search);
  const claseId = urlParams.get('id');

  if (!claseId) {
    window.location.href = "principal.html";
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const clase = await obtenerClasePorId(claseId);
        
        if (!clase) {
          window.location.href = "principal.html";
          return;
        }

        // Verify it's the teacher
        if (clase.id_docente !== user.uid) {
          window.location.href = `clase.html?id=${claseId}`;
          return;
        }

        // Configurar Navegación del Header
        document.getElementById('linkAlumnosHeader').href = `usuarios.html?clase=${claseId}`;
        document.getElementById('linkTareasHeader').href = `tareas.html?clase=${claseId}`;

        initTabs();
        await loadDashboardData(claseId, clase);

      } catch (error) {
        console.error("Error en panel de control:", error);
      }
    } else {
      window.location.href = "../index.html";
    }
  });

  function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    const btnDashboard = document.getElementById('btn-dashboard');
    if (btnDashboard) {
      btnDashboard.addEventListener('click', () => {
        tabs[0].click();
      });
    }
  }

  async function loadDashboardData(claseId, clase) {
    const alumnosCount = clase.alumnos ? clase.alumnos.length : 0;
    document.getElementById('stat-total-alumnos').innerText = alumnosCount;

    // Fetch Tasks
    const qTareas = query(collection(db, "trabajos"), where("id_clase", "==", claseId));
    const snapTareas = await getDocs(qTareas);
    const tareas = [];
    snapTareas.forEach(d => tareas.push({ id: d.id, ...d.data() }));

    document.getElementById('stat-total-tareas').innerText = tareas.length;

    // Render Alumnos
    const tableAlumnos = document.querySelector('#table-alumnos tbody');
    tableAlumnos.innerHTML = "";
    
    if (alumnosCount === 0) {
      tableAlumnos.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No hay alumnos en esta clase</td></tr>";
    } else {
      for (const alumnoId of clase.alumnos) {
        const perfil = await obtenerPerfilUsuario(alumnoId);
        if (perfil) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${perfil.nombre_completo || 'Usuario'}</td>
            <td>${perfil.email || 'Oculto'}</td>
            <td>
              <button class="action-btn delete-btn" data-id="${alumnoId}" title="Expulsar">Expulsar</button>
            </td>
          `;
          tableAlumnos.appendChild(tr);
        }
      }

      // Expulsar logic
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const uid = e.target.dataset.id;
          showCustomConfirm(
            "Expulsar Alumno",
            "¿Seguro que quieres expulsar a este alumno de la clase?",
            async () => {
              try {
                const claseRef = doc(db, "clases", claseId);
                await updateDoc(claseRef, {
                  alumnos: arrayRemove(uid)
                });
                showCustomAlert("Éxito", "Alumno expulsado.");
                location.reload();
              } catch (err) {
                console.error(err);
                showCustomAlert("Error", "No se pudo expulsar al alumno.");
              }
            }
          );
        });
      });
    }

    // Render Tareas
    const tableTareas = document.querySelector('#table-tareas tbody');
    tableTareas.innerHTML = "";

    if (tareas.length === 0) {
      tableTareas.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No hay tareas creadas</td></tr>";
    } else {
      tareas.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><a href="trabajo.html?id=${t.id}" style="color:var(--primary); font-weight:bold;">${t.Título}</a></td>
          <td>${t.tipo_obligatoriedad === 'opcional' ? 'Opcional' : 'Obligatoria'}</td>
          <td>${t.fecha_limite || 'Sin límite'}</td>
          <td><span class="status-badge" style="background:var(--gray-3); color:black;">${t.estado || 'Abierta'}</span></td>
          <td>
            <a href="trabajo.html?id=${t.id}" class="action-btn" title="Ver tarea" style="background:var(--blue-1); color:black; padding:5px 10px; border-radius:4px; text-decoration:none;">Ver</a>
          </td>
        `;
        tableTareas.appendChild(tr);
      });
    }
  }
});



