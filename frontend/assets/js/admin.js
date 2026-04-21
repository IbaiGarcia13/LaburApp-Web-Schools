import { auth } from './firebase-config.js';
import { 
    obtenerTodosLosUsuarios, 
    obtenerTodosLosTrabajos, 
    obtenerDenuncias,
    obtenerUsuariosBaneados,
    obtenerUsuariosEliminados,
    banearUsuario,
    quitarBaneo,
    cambiarEstadoTrabajo,
    resolverDisputa,
    obtenerPerfilUsuario,
    eliminarTrabajo,
    eliminarDenuncia,
    obtenerTodosLosChats,
    eliminarChat,
    enviarAnuncioGlobal,
    obtenerEstadisticasAdmin,
    obtenerHistorialPagosGlobal,
    marcarTrabajoLeido,
    actualizarEstadoDenuncia
} from './database.js';

const adminUID = "Phym2MgXuhMKqOLV97cUe5uzDKC2";
let allUsers = [];
let allJobs = [];
let allDisputas = [];
let allDenuncias = [];
let allBaneados = [];
let allChats = [];
let allRevisiones = [];

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user || user.uid !== adminUID) {
            window.location.href = "../index.html";
            return;
        }
        
        // Cargar primera pestaña por defecto
        cargarPestaña('resumen');
    });

    // Lógica de pestañas
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.getAttribute('data-tab');
            cargarPestaña(target);
        });
    });

    // Dashboard al pulsar el título
    const btnDashboard = document.getElementById('btn-dashboard');
    if (btnDashboard) {
        btnDashboard.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            cargarPestaña('resumen');
        });
    }

    // Buscador de usuarios
    const searchUsers = document.getElementById('search-usuarios');
    if (searchUsers) {
        searchUsers.addEventListener('input', (e) => {
            filtrarUsuarios(e.target.value.toLowerCase());
        });
    }

    // Buscador Disputas
    document.getElementById('search-disputas')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allDisputas.filter(d => 
            d.titulo.toLowerCase().includes(term) ||
            (d.nombre_cliente && d.nombre_cliente.toLowerCase().includes(term)) ||
            (d.nombre_trabajador && d.nombre_trabajador.toLowerCase().includes(term))
        );
        renderDisputas(filtered, true);
    });

    // Buscador Denuncias
    document.getElementById('search-denuncias')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allDenuncias.filter(d => 
            (d.nombre_denunciante && d.nombre_denunciante.toLowerCase().includes(term)) ||
            (d.nombre_denunciado && d.nombre_denunciado.toLowerCase().includes(term)) ||
            (d.motivo && d.motivo.toLowerCase().includes(term))
        );
        renderDenuncias(filtered, true);
    });

    // Buscador Baneados
    document.getElementById('search-baneados')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allBaneados.filter(u => 
            (u.nombre_completo && u.nombre_completo.toLowerCase().includes(term)) ||
            (u.nombre && u.nombre.toLowerCase().includes(term)) ||
            (u.email && u.email.toLowerCase().includes(term))
        );
        renderBaneados(filtered, true);
    });

    // Filtro de trabajos
    const filterJobs = document.getElementById('filter-trabajos-estado');
    if (filterJobs) {
        filterJobs.addEventListener('change', (e) => {
            cargarPestaña('trabajos', e.target.value);
        });
    }

    // Buscador de trabajos
    const searchJobs = document.getElementById('search-trabajos');
    if (searchJobs) {
        searchJobs.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const estado = document.getElementById('filter-trabajos-estado').value;
            filtrarTrabajos(term, estado);
        });
    }

    // Buscador de pagos
    document.getElementById('search-pagos')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allPayments.filter(p => 
            p.nombre_pagador.toLowerCase().includes(term) ||
            p.detalle_pago.toLowerCase().includes(term) ||
            p.monto.toString().includes(term)
        );
        renderPagos(filtered, true);
    });
});

let allPayments = [];


async function cargarPestaña(tab, filter = null) {
    const panes = document.querySelectorAll('.tab-pane');
    panes.forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    switch (tab) {
        case 'resumen':
            const stats = await obtenerEstadisticasAdmin();
            renderResumen(stats);
            break;
        case 'usuarios':
            const users = await obtenerTodosLosUsuarios();
            // Filtrar solo los que NO están baneados
            allUsers = users.filter(u => !u.baneado);
            renderUsuarios(allUsers);
            break;
        case 'trabajos':
            const trabajos = await obtenerTodosLosTrabajos();
            renderTrabajos(trabajos, filter);
            break;
        case 'pagos':
            allPayments = await obtenerHistorialPagosGlobal();
            renderPagos(allPayments);
            break;
        case 'disputas':
            const allJobsList = await obtenerTodosLosTrabajos();
            allDisputas = allJobsList.filter(j => j.estado === 'En disputa');
            await renderDisputas(allDisputas);
            break;
        case 'denuncias':
            allDenuncias = await obtenerDenuncias();
            await renderDenuncias(allDenuncias);
            break;
        case 'baneados':
            allBaneados = await obtenerUsuariosBaneados();
            renderBaneados(allBaneados);
            break;
        case 'revisiones':
            const allJ = await obtenerTodosLosTrabajos();
            allRevisiones = allJ.filter(j => j.estado === 'Pausada' || j.estado === 'En revisión');
            await renderRevisiones(allRevisiones);
            break;
        case 'chats':
            allChats = await obtenerTodosLosChats();
            await renderChats(allChats);
            break;
        case 'anuncios':
            setupAnunciosLogic();
            break;
        case 'eliminados':
            const eliminados = await obtenerUsuariosEliminados();
            renderEliminados(eliminados);
            break;
    }
}

function setupAnunciosLogic() {
    const btn = document.getElementById('btn-send-announcement');
    if (btn) {
        btn.onclick = handleSendAnnouncement;
    }
}

async function handleSendAnnouncement() {
    const title = document.getElementById('announcement-title').value.trim();
    const message = document.getElementById('announcement-message').value.trim();
    const target = document.getElementById('announcement-target').value;

    if (!title || !message) {
        showCustomAlert("Error", "Por favor, completa todos los campos del anuncio.");
        return;
    }

    showCustomConfirm("Enviar Anuncio", `¿Estás seguro de que quieres enviar este anuncio a los usuarios seleccionados (${target})?`, async () => {
        try {
            const count = await enviarAnuncioGlobal(title, message, target);
            showCustomAlert("¡Éxito!", `Anuncio enviado correctamente a ${count} usuarios.`);
            document.getElementById('announcement-title').value = "";
            document.getElementById('announcement-message').value = "";
        } catch (err) {
            console.error("Error enviando anuncio:", err);
            showCustomAlert("Error", "No se pudo enviar el anuncio.");
        }
    });
}

function renderUsuarios(users) {
    const tbody = document.querySelector('#table-usuarios tbody');
    tbody.innerHTML = "";
    users.forEach(u => {
        const tr = document.createElement('tr');
        const iconPath = '../assets/img/icons/';
        
        tr.innerHTML = `
            <td class="uid-cell">${u.uid}</td>
            <td><strong>${u.nombre_completo || u.nombre}</strong></td>
            <td>${u.email}</td>
            <td>${u.dni || '-'}</td>
            <td>
                <button class="action-btn gray" title="Perfil" onclick="window.location.href='usuario.html?id=${u.uid}'"><img src="${iconPath}icono-perfil.png"></button>
                <button class="action-btn gray" title="Chatear" onclick="window.location.href='chat.html?userId=${u.uid}'"><img src="${iconPath}icono-mensajes.png"></button>
                <button class="action-btn red" title="Banear" onclick="abrirModalBan('${u.uid}', '${u.nombre}')"><img src="${iconPath}icono-baneo-blanco.png"></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarUsuarios(query) {
    const filtered = allUsers.filter(u => 
        (u.nombre_completo && u.nombre_completo.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.dni && u.dni.toLowerCase().includes(query))
    );
    renderUsuarios(filtered);
}

window.filtrarUsuariosPorNombre = async (nombre, type = null, id = null) => {
    // Si viene de una notificación, marcar como leído
    if (type === 'denuncia' && id) {
        await actualizarEstadoDenuncia(id, 'leida');
    }

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="usuarios"]').classList.add('active');
    
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-usuarios').classList.add('active');
    
    const searchInput = document.getElementById('search-usuarios');
    if (searchInput) {
        searchInput.value = nombre;
        filtrarUsuarios(nombre.toLowerCase());
    }
};

window.filtrarTrabajosPorTitulo = async (titulo, type = null, id = null) => {
    // Si viene de una notificación, marcar como leído
    if (id && (type === 'disputa' || type === 'revision')) {
        await marcarTrabajoLeido(id);
    }

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="trabajos"]').classList.add('active');
    
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-trabajos').classList.add('active');
    
    const searchInput = document.getElementById('search-trabajos');
    const filterEstado = document.getElementById('filter-trabajos-estado');
    
    if (searchInput) {
        searchInput.value = titulo;
    }
    if (filterEstado) {
        filterEstado.value = "todos";
    }
    
    filtrarTrabajos(titulo.toLowerCase(), "todos");
};

function filtrarTrabajos(query, estado) {
    let filtered = allJobs;
    if (estado && estado !== "todos") {
        filtered = allJobs.filter(t => t.estado === estado);
    }
    if (query) {
        filtered = filtered.filter(t => 
            t.titulo.toLowerCase().includes(query) ||
            (t.nombre_cliente && t.nombre_cliente.toLowerCase().includes(query)) ||
            (t.nombre_trabajador && t.nombre_trabajador.toLowerCase().includes(query))
        );
    }
    renderTrabajos(filtered, null, true); // true para no recargar perfiles si ya están
}

async function renderTrabajos(trabajos, filter = "todos", isFilterAction = false) {
    const tbody = document.querySelector('#table-trabajos tbody');
    // Solo mostrar cargando si la tabla está vacía y no es un filtro rápido
    if (tbody.children.length === 0 && !isFilterAction) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center'>Cargando trabajos...</td></tr>";
    }
    
    let filtered = trabajos;
    if (filter && filter !== "todos" && !isFilterAction) {
        filtered = trabajos.filter(t => t.estado === filter);
    }

    if (!isFilterAction) {
        allJobs = trabajos; // Guardar para búsqueda local
    }

    const rows = [];
    const iconPath = '../assets/img/icons/';

    for (const t of filtered) {
        try {
            // Guardar nombres para búsqueda rápida si no existen
            if (!t.nombre_cliente || !t.nombre_trabajador) {
                const [cliente, trabajador] = await Promise.all([
                    obtenerPerfilUsuario(t.id_publicador),
                    t.id_trabajador ? obtenerPerfilUsuario(t.id_trabajador) : Promise.resolve(null)
                ]);
                t.nombre_cliente = cliente ? (cliente.nombre_completo || cliente.nombre) : 'Desconocido';
                t.nombre_trabajador = trabajador ? (trabajador.nombre_completo || trabajador.nombre) : 'No asignado';
            }
            
            const tr = document.createElement('tr');
            const displayStatus = t.estado === 'Pausada' ? 'En revisión' : t.estado;

            tr.innerHTML = `
                <td><strong>${t.titulo}</strong></td>
                <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${t.nombre_cliente}')">${t.nombre_cliente}</span></td>
                <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${t.nombre_trabajador}')">${t.nombre_trabajador}</span></td>
                <td>${t.pago_cliente}€</td>
                <td><span class="status-badge ${t.estado.toLowerCase().replace(' ', '-')}">${displayStatus}</span></td>
                <td>
                    <button class="action-btn gray" title="Ver Trabajo" onclick="window.location.href='trabajo.html?id=${t.id}'"><img src="${iconPath}icono-trabajos.png"></button>
                    <button class="action-btn gray" title="Pausar/Reanudar" onclick="handlePausarTrabajo('${t.id}', '${t.estado}')"><img src="${iconPath}icono-pausa.png"></button>
                    <button class="action-btn purple" title="Disputa" onclick="handlePonerDisputa('${t.id}')"><img src="${iconPath}icono-disputa.png"></button>
                    <button class="action-btn red" title="Eliminar Trabajo" onclick="handleEliminarTrabajo('${t.id}')"><img src="${iconPath}icono-eliminar-blanco.png"></button>
                </td>
            `;
            rows.push(tr);
        } catch (err) {
            console.error("Error cargando trabajo:", t.id, err);
        }
    }
    
    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
}

async function renderDisputas(disputas, isFilter = false) {
    const tbody = document.querySelector('#table-disputas tbody');
    if (tbody.children.length === 0 || !isFilter) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Cargando datos de disputa...</td></tr>";
    }
    
    if (disputas.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>No se encontraron disputas</td></tr>";
        return;
    }

    const rows = [];
    const iconPath = '../assets/img/icons/';

    for (const d of disputas) {
        try {
            // Guardar nombres en el objeto para el buscador local
            if (!d.nombre_cliente || !d.nombre_trabajador) {
                const [cliente, trabajador] = await Promise.all([
                    obtenerPerfilUsuario(d.id_publicador),
                    d.id_trabajador ? obtenerPerfilUsuario(d.id_trabajador) : Promise.resolve(null)
                ]);
                d.nombre_cliente = cliente ? (cliente.nombre_completo || cliente.nombre) : 'Desconocido';
                d.nombre_trabajador = trabajador ? (trabajador.nombre_completo || trabajador.nombre) : 'Desconocido';
            }

            const resP = d.confirmacion_publicador === 'si' ? 'SI' : (d.confirmacion_publicador === 'no' ? 'NO' : '?');
            const resW = d.confirmacion_trabajador === 'si' ? 'SI' : (d.confirmacion_trabajador === 'no' ? 'NO' : '?');
            const respuestas = `${resP} / ${resW}`;
            
            const isUnread = !d.admin_leido;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong class="clickable-name" onclick="filtrarTrabajosPorTitulo('${d.titulo}', 'disputa', '${d.id}')">${d.titulo}</strong></td>
                <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${d.nombre_cliente}')">${d.nombre_cliente}</span></td>
                <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${d.nombre_trabajador}')">${d.nombre_trabajador}</span></td>
                <td><span class="status-badge" style="background: var(--gray-2);">${respuestas}</span></td>
                <td>
                    <button class="action-btn gray" title="Ver Trabajo" onclick="window.location.href='trabajo.html?id=${d.id}'"><img src="${iconPath}icono-trabajos.png"></button>
                    <button class="action-btn gray" title="Ver Chat" onclick="handleVerChat('${d.id}', '${d.id_trabajador}', '${d.id}')"><img src="${iconPath}icono-mensajes.png"></button>
                    <button class="action-btn green" title="Resolver Disputa" onclick="abrirModalDispute('${d.id}', '${d.titulo}')"><img src="${iconPath}icono-si-blanco.png"></button>
                </td>
                <td style="width: 20px;">${isUnread ? '<span class="unread-dot"></span>' : ''}</td>
            `;
            rows.push(tr);
        } catch (err) {
            console.error("Error cargando disputa:", d.id, err);
        }
    }

    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
}

async function renderDenuncias(denuncias, isFilter = false) {
    const tbody = document.querySelector('#table-denuncias tbody');
    if (tbody.children.length === 0 || !isFilter) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Cargando denuncias...</td></tr>";
    }
    
    if (denuncias.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>No se encontraron denuncias</td></tr>";
        return;
    }

    const iconPath = '../assets/img/icons/';
    const rows = [];

    for (const d of denuncias) {
        try {
            // Compatibilidad con denuncias antiguas (buscar nombres si no existen)
            if (!d.nombre_denunciante || !d.nombre_denunciado) {
                const idW = d.id_denunciante || d.id_usuario_denunciante;
                const idP = d.id_denunciado || d.id_usuario_reportado;
                
                const [pDenunciante, pDenunciado] = await Promise.all([
                    idW ? obtenerPerfilUsuario(idW) : Promise.resolve(null),
                    idP ? obtenerPerfilUsuario(idP) : Promise.resolve(null)
                ]);
                
                d.nombre_denunciante = pDenunciante ? (pDenunciante.nombre_completo || pDenunciante.nombre) : 'ID: ' + idW;
                d.nombre_denunciado = pDenunciado ? (pDenunciado.nombre_completo || pDenunciado.nombre) : 'ID: ' + idP;
            }

            const fecha = d.fecha?.toDate ? d.fecha.toDate().toLocaleDateString() : '-';
            const isUnread = d.estado === 'pendiente';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${fecha}</td>
                <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${d.nombre_denunciante}', 'denuncia', '${d.id}')">${d.nombre_denunciante}</span></td>
                <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${d.nombre_denunciado}', 'denuncia', '${d.id}')">${d.nombre_denunciado}</span></td>
                <td>${d.motivo}</td>
                <td>
                    <button class="action-btn red" title="Eliminar Denuncia" onclick="handleEliminarDenuncia('${d.id}')"><img src="${iconPath}icono-eliminar-blanco.png"></button>
                </td>
                <td style="width: 20px;">${isUnread ? '<span class="unread-dot"></span>' : ''}</td>
            `;
            rows.push(tr);
        } catch (err) {
            console.error("Error cargando denuncia:", d.id, err);
        }
    }

    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
}

async function renderRevisiones(revisiones) {
    const tbody = document.querySelector('#table-revisiones tbody');
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>Cargando...</td></tr>";
    
    if (revisiones.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>No hay trabajos en revisión</td></tr>";
        return;
    }

    const rows = [];
    const iconPath = '../assets/img/icons/';

    for (const t of revisiones) {
        const [cliente, trabajador] = await Promise.all([
            obtenerPerfilUsuario(t.id_publicador),
            t.id_trabajador ? obtenerPerfilUsuario(t.id_trabajador) : Promise.resolve(null)
        ]);

        const nC = cliente ? (cliente.nombre_completo || cliente.nombre) : 'Desconocido';
        const nW = trabajador ? (trabajador.nombre_completo || trabajador.nombre) : 'No asignado';
        
        const isUnread = !t.admin_leido;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong class="clickable-name" onclick="filtrarTrabajosPorTitulo('${t.titulo}', 'revision', '${t.id}')">${t.titulo}</strong></td>
            <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${nC}')">${nC}</span></td>
            <td>${nW}</td>
            <td>
                <button class="action-btn gray" title="Ver Trabajo" onclick="window.location.href='trabajo.html?id=${t.id}'"><img src="${iconPath}icono-trabajos.png"></button>
                <button class="action-btn green" title="Reanudar" onclick="handlePausarTrabajo('${t.id}', 'Pausada')"><img src="${iconPath}icono-si-blanco.png"></button>
            </td>
            <td style="width: 20px;">${isUnread ? '<span class="unread-dot"></span>' : ''}</td>
        `;
        rows.push(tr);
    }
    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
}

async function renderChats(chats) {
    const tbody = document.querySelector('#table-chats tbody');
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>Cargando...</td></tr>";
    
    if (chats.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>No hay chats registrados</td></tr>";
        return;
    }

    const rows = [];
    const iconPath = '../assets/img/icons/';

    for (const c of chats) {
        // El id del chat suele ser uid1_uid2 o uid1_uid2_job_id
        const parts = c.id.split('_');
        const uid1 = parts[0];
        const uid2 = (parts[1] === 'job') ? parts[0] : parts[1]; // Fallback si el formato es distinto
        
        // Si el chat tiene uids explícitos (nuevo sistema)
        const participant1 = c.uids ? c.uids[0] : uid1;
        const participant2 = c.uids ? c.uids[1] : (parts[1] === 'job' ? parts[0] : parts[1]);

        const [u1, u2] = await Promise.all([
            obtenerPerfilUsuario(participant1),
            obtenerPerfilUsuario(participant2)
        ]);

        const n1 = u1 ? (u1.nombre_completo || u1.nombre) : 'User 1';
        const n2 = u2 ? (u2.nombre_completo || u2.nombre) : 'User 2';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="uid-cell">${c.id}</td>
            <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${n1}')">${n1}</span></td>
            <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${n2}')">${n2}</span></td>
            <td>
                <button class="action-btn gray" title="Ver Chat" onclick="handleVerChat('${c.id}', '${participant2}', '${c.id_trabajo || ''}')"><img src="${iconPath}icono-mensajes.png"></button>
                <button class="action-btn red" title="Eliminar Chat" onclick="handleEliminarChat('${c.id}')"><img src="${iconPath}icono-eliminar-blanco.png"></button>
            </td>
        `;
        rows.push(tr);
    }
    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
}

function renderBaneados(baneados, isFilter = false) {
    const tbody = document.querySelector('#table-baneados tbody');
    
    // Solo mostrar cargando si la tabla está vacía y no es un filtro
    if (tbody.children.length === 0 && !isFilter) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Cargando baneados...</td></tr>";
    }

    if (baneados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>No se encontraron usuarios</td></tr>";
        return;
    }

    const iconPath = '../assets/img/icons/';
    const rows = [];

    baneados.forEach(u => {
        const hasta = u.baneado_hasta === -1 ? 'Permanente' : new Date(u.baneado_hasta).toLocaleString();
        const nombreMostrar = u.nombre_completo || u.nombre || "Usuario Desconocido";
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${nombreMostrar}</strong></td>
            <td>${u.email}</td>
            <td>${hasta}</td>
            <td>${u.motivo_baneo || 'No especificado'}</td>
            <td>
                <button class="action-btn red" title="Quitar Baneo" onclick="handleQuitarBaneo('${u.uid}')"><img src="${iconPath}icono-eliminar-blanco.png"></button>
            </td>
        `;
        rows.push(tr);
    });

    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
}

function renderEliminados(eliminados) {
    const tbody = document.querySelector('#table-eliminados tbody');
    tbody.innerHTML = "";
    eliminados.forEach(u => {
        const fecha = u.fecha_eliminacion?.toDate ? u.fecha_eliminacion.toDate().toLocaleString() : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.email}</td>
            <td>${fecha}</td>
            <td>${u.motivo || 'N/A'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- ACCIONES GLOBALES ---

window.abrirModalBan = (uid, name) => {
    document.getElementById('ban-user-name').innerText = `Usuario: ${name}`;
    document.getElementById('modal-ban').classList.remove('hidden');
    
    document.getElementById('btn-confirm-ban').onclick = async () => {
        const duration = parseInt(document.getElementById('ban-duration').value);
        const reason = document.getElementById('ban-reason').value.trim() || "Incumplimiento de normas";
        
        await banearUsuario(uid, duration, reason);
        document.getElementById('modal-ban').classList.add('hidden');
        cargarPestaña('usuarios');
    };
};

document.getElementById('btn-cancel-ban').onclick = () => {
    document.getElementById('modal-ban').classList.add('hidden');
};

window.handleQuitarBaneo = async (uid, refreshUsuarios = false) => {
    showCustomConfirm("Quitar Restricción", "¿Quieres quitar la restricción a este usuario?", async () => {
        const { quitarBaneo } = await import('./database.js');
        await quitarBaneo(uid);
        if (refreshUsuarios) {
            cargarPestaña('usuarios');
        } else {
            cargarPestaña('baneados');
        }
    }, "Quitar Baneo", "Cancelar", "confirm");
};

window.handleEliminarTrabajo = async (id) => {
    showCustomConfirm("Eliminar Trabajo", "¿Estás seguro de que quieres eliminar este trabajo permanentemente?", async () => {
        const { eliminarTrabajo } = await import('./database.js');
        await eliminarTrabajo(id);
        cargarPestaña('trabajos');
    }, "Eliminar", "Cancelar", "delete");
};

window.handleEliminarDenuncia = async (id) => {
    showCustomConfirm("Eliminar Denuncia", "¿Quieres eliminar esta denuncia de la lista?", async () => {
        const { eliminarDenuncia } = await import('./database.js');
        await eliminarDenuncia(id);
        cargarPestaña('denuncias');
    }, "Eliminar", "Cancelar", "delete");
};

window.handleEliminarChat = async (id) => {
    showCustomConfirm("Eliminar Chat", "¿Estás seguro de que quieres eliminar este chat y todos sus mensajes permanentemente?", async () => {
        await eliminarChat(id);
        cargarPestaña('chats');
    }, "Eliminar", "Cancelar", "delete");
};

window.handlePausarTrabajo = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === 'Pausada' ? 'Pendiente' : 'Pausada';
    await cambiarEstadoTrabajo(id, nuevoEstado);
    cargarPestaña('trabajos');
};

window.handlePonerDisputa = async (id) => {
    await cambiarEstadoTrabajo(id, 'En disputa');
    cargarPestaña('trabajos');
};

window.abrirModalDispute = (id, title) => {
    document.getElementById('dispute-job-title').innerText = `Trabajo: ${title}`;
    document.getElementById('modal-dispute').classList.remove('hidden');

    document.getElementById('btn-refund-client').onclick = async () => {
        showCustomConfirm("Devolver Dinero", "¿Confirmas devolver el dinero íntegro al cliente?", async () => {
            await resolverDisputa(id, 'cliente');
            document.getElementById('modal-dispute').classList.add('hidden');
            cargarPestaña('trabajos');
        }, "Confirmar", "Cancelar", "confirm");
    };

    document.getElementById('btn-pay-worker').onclick = async () => {
        showCustomConfirm("Pagar Trabajador", "¿Confirmas pagar al trabajador el importe correspondiente?", async () => {
            await resolverDisputa(id, 'trabajador');
            document.getElementById('modal-dispute').classList.add('hidden');
            cargarPestaña('trabajos');
        }, "Confirmar", "Cancelar", "confirm");
    };
};

document.getElementById('btn-close-dispute').onclick = () => {
    document.getElementById('modal-dispute').classList.add('hidden');
};

function renderResumen(stats) {
    document.getElementById('stat-total-usuarios').innerText = stats.totalUsuarios;
    document.getElementById('stat-sub-clientes').innerText = stats.suscriptoresCliente;
    document.getElementById('stat-sub-trabajadores').innerText = stats.suscriptoresTrabajador;
    document.getElementById('stat-total-trabajos').innerText = stats.totalTrabajos;
    document.getElementById('stat-comisiones').innerText = stats.dineroComisiones.toFixed(2) + '€';
    document.getElementById('stat-top-trabajador').innerText = stats.topTrabajador;
    document.getElementById('stat-top-categoria').innerText = stats.topCategoria;
    document.getElementById('stat-ultimo-usuario').innerText = stats.ultimoUsuario;
    document.getElementById('stat-top-cliente').innerText = stats.topCliente;
}

function renderPagos(pagos, isFilter = false) {
    const tbody = document.querySelector('#table-pagos tbody');
    if (!isFilter) tbody.innerHTML = "";
    
    if (pagos.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>No hay pagos registrados</td></tr>";
        return;
    }

    const rows = pagos.map(p => {
        const fecha = p.fecha_emision?.toDate ? p.fecha_emision.toDate().toLocaleString() : '-';
        const montoNum = Number(p.monto);
        
        let color = "var(--neutral-black)";
        if (montoNum > 0) color = "var(--success-color, green)";
        else if (montoNum < 0) color = "var(--error-color, red)";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${fecha}</td>
            <td><span class="clickable-name" onclick="filtrarUsuariosPorNombre('${p.nombre_pagador}')">${p.nombre_pagador}</span></td>
            <td><strong style="color: ${color};">${montoNum.toFixed(2)}€</strong></td>
            <td>${p.detalle_pago}</td>
        `;
        return tr;
    });

    tbody.innerHTML = "";
    rows.forEach(r => tbody.appendChild(r));
}

window.handleVerChat = async (idChat, userId, idTrabajo) => {
    if (idTrabajo) {
        await marcarTrabajoLeido(idTrabajo);
    }
    window.location.href = `chat.html?id=${idTrabajo}&userId=${userId}&viewOnly=true`;
};
