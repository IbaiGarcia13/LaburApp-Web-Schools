import { db, auth } from './firebase-config.js';
import { 
    doc, getDoc, collection, query, where, getDocs, updateDoc, arrayRemove, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    obtenerClasePorId, obtenerPerfilUsuario, expulsarAlumno 
} from './database.js';

let currentClassId = new URLSearchParams(window.location.search).get('id');

document.addEventListener('DOMContentLoaded', async () => {
    if (!currentClassId) {
        window.location.href = 'principal.html';
        return;
    }

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const clase = await obtenerClasePorId(currentClassId);
            if (!clase || clase.id_docente !== user.uid) {
                // Solo el docente de esta clase puede entrar
                window.location.href = 'principal.html';
                return;
            }
            
            document.getElementById('panel-title').innerText = `RESUMEN DE: ${clase.nombre.toUpperCase()}`;
            
            setupTabs();
            cargarResumen(clase);
            cargarAlumnos(clase.alumnos || []);
            cargarTareas();

            // Botón superior para volver a la clase
            const btnDashboard = document.getElementById('btn-dashboard');
            if (btnDashboard) {
                btnDashboard.onclick = () => {
                    window.location.href = `clase.html?id=${currentClassId}`;
                };
            }
        }
    });
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(btn => {
        btn.onclick = () => {
            tabs.forEach(b => b.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
        };
    });
}

async function cargarResumen(clase) {
    document.getElementById('stat-alumnos').innerText = (clase.alumnos || []).length;
    
    const qTareas = query(collection(db, "trabajos"), where("id_clase", "==", currentClassId));
    const snapTareas = await getDocs(qTareas);
    document.getElementById('stat-tareas').innerText = snapTareas.size;

    // Aquí podrías contar entregas si tuvieras una colección de entregas
    document.getElementById('stat-entregas').innerText = "0"; 
}

async function cargarAlumnos(alumnosIds) {
    const tbody = document.querySelector('#table-alumnos tbody');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';

    if (alumnosIds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No hay alumnos en esta clase.</td></tr>';
        return;
    }

    const rows = [];
    for (const uid of alumnosIds) {
        const p = await obtenerPerfilUsuario(uid);
        rows.push(`
            <tr>
                <td>
                    <div class="user-cell">
                        <img src="${p.foto_perfil || '../assets/img/avatar-defecto-alumno.png'}" class="table-avatar">
                        <span>${p.nombre} ${p.apellidos || ''}</span>
                    </div>
                </td>
                <td>${p.email || 'N/A'}</td>
                <td>-</td>
                <td>
                    <button class="btn-warning btn-sm" onclick="expulsarAlumnoUI('${uid}')">Expulsar</button>
                </td>
            </tr>
        `);
    }
    tbody.innerHTML = rows.join('');
}

async function cargarTareas() {
    const tbody = document.querySelector('#table-tareas tbody');
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';

    const q = query(collection(db, "trabajos"), where("id_clase", "==", currentClassId));
    const snap = await getDocs(q);

    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="5">No has creado tareas todavía.</td></tr>';
        return;
    }

    const rows = [];
    snap.forEach(docSnap => {
        const t = docSnap.data();
        const limite = t.fecha_limite?.toDate ? t.fecha_limite.toDate().toLocaleDateString() : (t.fecha_entrega || '-');
        rows.push(`
            <tr>
                <td>${t.titulo}</td>
                <td><span class="tag-tipo">${t.tipo_tarea || 'Obligatoria'}</span></td>
                <td>${limite}</td>
                <td>0</td>
                <td>
                    <button class="btn-danger btn-sm" onclick="eliminarTareaUI('${docSnap.id}')">Eliminar</button>
                </td>
            </tr>
        `);
    });
    tbody.innerHTML = rows.join('');
}

window.expulsarAlumnoUI = async (uid) => {
    window.showCustomConfirm("Expulsar Alumno", "¿Seguro que quieres expulsar a este alumno?", async () => {
        try {
            await expulsarAlumno(currentClassId, uid);
            window.location.reload();
        } catch (e) {
            console.error(e);
            window.showCustomAlert("Error", "No se pudo expulsar al alumno.");
        }
    });
};

window.eliminarTareaUI = async (id) => {
    window.showCustomConfirm("Eliminar Tarea", "¿Seguro que quieres eliminar esta tarea? Se borrará para todos.", async () => {
        try {
            await deleteDoc(doc(db, "trabajos", id));
            window.location.reload();
        } catch (e) {
            console.error(e);
            window.showCustomAlert("Error", "No se pudo eliminar la tarea.");
        }
    });
};
