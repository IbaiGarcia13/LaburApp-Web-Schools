import { auth, db, storage } from './firebase-config.js';
import {
    obtenerClasePorId,
    obtenerPerfilUsuario,
    crearNovedadClase,
    expulsarAlumno,
    banearAlumnoClase
} from './database.js';
import {
    collection,
    addDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    getDocs,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let currentClassId = new URLSearchParams(window.location.search).get('id');
let userRole = null;
let currentPerfil = null;
let currentClassData = null; // Almacenar datos de la clase
let selectedColor = '';

const colorMap = {
    'cat-2': '#e46363ff', 'cat-3': '#71b77fff', 'cat-4': '#659ee8ff', 'cat-5': '#ffd54f', 'cat-6': '#bc5ad2ff', 'cat-7': '#b07c4cff',
    'cat-8': '#ff9152ff', 'cat-9': '#5def81ff', 'cat-10': '#6fb9e7ff', 'cat-11': '#edec84ff', 'cat-12': '#f07dc8ff', 'cat-13': '#91919198'
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!currentClassId) {
        window.location.href = 'principal.html';
        return;
    }

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = '../index.html';
            return;
        }

        currentPerfil = await obtenerPerfilUsuario(user.uid);
        const clase = await obtenerClasePorId(currentClassId);

        if (!clase) {
            window.showCustomAlert("Error", "La clase no existe.", "Volver", () => {
                window.location.href = 'principal.html';
            });
            return;
        }

        const esDocente = clase.id_docente === user.uid;
        const esAlumno = clase.alumnos && clase.alumnos.includes(user.uid);
        const esBaneado = clase.baneados && clase.baneados.includes(user.uid);

        if (esBaneado) {
            window.showCustomAlert("Acceso Denegado", "Has sido baneado de esta clase.", "Volver", () => {
                window.location.href = 'principal.html';
            });
            return;
        }

        if (!esDocente && !esAlumno) {
            window.showCustomAlert("Acceso Denegado", "No tienes permiso para ver esta clase.", "Volver", () => {
                window.location.href = 'principal.html';
            });
            return;
        }

        userRole = esDocente ? 'docente' : 'alumno';
        currentClassData = clase; // Guardar datos para usar en creación de tareas
        renderClassUI(clase);
        setupFeedListener();
        setupEventListeners(clase);

        if (esDocente) {
            document.getElementById('btnEditarClase').style.display = 'flex';
            document.getElementById('btnVerCodigo').style.display = 'flex';
            document.getElementById('btnNuevaTarea').style.display = 'flex';
            document.getElementById('btnGestionarAlumnos').style.display = 'flex';
        } else if (esAlumno) {
            // Mostrar selector de color solo para alumnos
            const picker = document.getElementById('colorPickerContainer');
            if (picker) picker.style.display = 'flex';
            setupColorPicker();
        }
    });
});

function getAvatar(perfil) {
    if (perfil && perfil.foto_perfil) return perfil.foto_perfil;
    const rol = perfil?.rol || 'alumno';
    return `../assets/img/avatar-defecto-${rol}.png`;
}

async function renderClassUI(clase) {
    document.getElementById('className').innerText = clase.nombre;
    document.getElementById('classDesc').innerText = clase.Descripción || "";
    document.getElementById('classSubject').innerText = clase.Asignatura || "General";

    // Obtener nombre del docente
    const docente = await obtenerPerfilUsuario(clase.id_docente);
    if (docente) {
        document.getElementById('classTeacherName').innerText = `${docente.nombre} ${docente.apellidos || ''}`;
    }

    // Aplicar color (Prioridad: Preferencia Usuario > Color Clase > Default)
    let colorKey = clase.color || 'cat-4'; // Default azul
    if (currentPerfil && currentPerfil.preferencias_clases && currentPerfil.preferencias_clases[currentClassId]) {
        colorKey = currentPerfil.preferencias_clases[currentClassId].color || colorKey;
    }

    const hero = document.getElementById('classHero');
    if (hero && colorMap[colorKey]) {
        hero.style.backgroundColor = colorMap[colorKey];
        // Actualizar el circulo del picker
        const inner = document.getElementById('currentColorInner');
        if (inner) inner.style.backgroundColor = colorMap[colorKey];
    }

    if (currentPerfil) {
        document.getElementById('userPostAvatar').src = getAvatar(currentPerfil);
    }
}

function setupFeedListener() {
    const q = query(
        collection(db, "clases", currentClassId, "novedades"),
        orderBy("fecha", "desc")
    );

    onSnapshot(q, (snapshot) => {
        const feedList = document.getElementById('classFeedList');
        feedList.innerHTML = '';

        if (snapshot.empty) {
            feedList.innerHTML = '<div class="empty-msg">Anuncia algo a tu clase para empezar.</div>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const date = data.fecha?.toDate ? data.fecha.toDate().toLocaleString() : 'Reciente';

            const item = document.createElement('div');
            item.className = 'feed-item';

            let contentHtml = '';
            if (data.tipo === 'tarea') {
                contentHtml = `
                    <div class="feed-task-info">
                        <strong>Nueva Tarea: ${data.titulo}</strong>
                        <p>${data.mensaje}</p>
                        <a href="trabajo.html?id=${data.id_referencia}" class="btn-ver-tarea">Ver Tarea</a>
                    </div>
                `;
            } else if (data.tipo === 'unirse') {
                contentHtml = `<p style="color: var(--gray-4); font-style: italic;">${data.mensaje}</p>`;
            } else {
                // Mensaje normal
                if (data.mensaje) {
                    contentHtml += `<p class="feed-text">${data.mensaje}</p>`;
                }
                if (data.archivoUrl) {
                    const isImg = data.archivoNombre && data.archivoNombre.match(/\.(jpg|jpeg|png|gif)$/i);
                    if (isImg) {
                        contentHtml += `<div class="feed-attachment"><img src="${data.archivoUrl}" alt="Adjunto" class="feed-img-preview" onclick="window.open('${data.archivoUrl}', '_blank')"></div>`;
                    } else {
                        contentHtml += `
                            <div class="feed-attachment">
                                <a href="${data.archivoUrl}" download="${data.archivoNombre}" class="feed-file-link">
                                    <img src="../assets/img/icons/icono-categoria.png">
                                    <span>${data.archivoNombre}</span>
                                </a>
                            </div>`;
                    }
                }
            }

            item.innerHTML = `
                <div class="feed-item-header">
                    <img src="../assets/img/avatar-defecto.png" class="post-avatar" id="avatar-${docSnap.id}">
                    <div class="author-info">
                        <h4>${data.autor_nombre}</h4>
                        <span>${date}</span>
                    </div>
                </div>
                <div class="feed-item-content">
                    ${contentHtml}
                </div>
            `;
            feedList.appendChild(item);

            if (data.autor_id) {
                obtenerPerfilUsuario(data.autor_id).then(p => {
                    const img = document.getElementById(`avatar-${docSnap.id}`);
                    if (img) img.src = getAvatar(p);
                });
            }
        });
    });
}

function setupEventListeners(clase) {
    // Publicar mensaje
    const btnSend = document.getElementById('btnSendFeed');
    const inputMsg = document.getElementById('inputFeedMessage');
    const btnAttach = document.getElementById('btnAttachFeed');
    const fileInput = document.getElementById('feedFileInput');
    const filePreview = document.getElementById('feedFilePreview');
    const btnRemoveFile = document.getElementById('btnRemoveFeedFile');

    let selectedFeedFile = null;

    btnAttach.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFeedFile = file;
            const nameSpan = filePreview.querySelector('.file-name');
            const thumbContainer = document.getElementById('feedThumbContainer');
            const thumbImg = document.getElementById('feedThumb');

            nameSpan.textContent = file.name;

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    thumbImg.src = e.target.result;
                    thumbContainer.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                thumbContainer.classList.add('hidden');
            }

            filePreview.classList.remove('hidden');
        }
    };

    btnRemoveFile.onclick = () => {
        selectedFeedFile = null;
        fileInput.value = '';
        filePreview.classList.add('hidden');
        const thumbContainer = document.getElementById('feedThumbContainer');
        if (thumbContainer) thumbContainer.classList.add('hidden');
    };

    // Mandar con Enter
    inputMsg.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnSend.click();
        }
    });

    btnSend.onclick = async () => {
        const msg = inputMsg.value.trim();
        if (!msg && !selectedFeedFile) return;

        try {
            btnSend.disabled = true;
            btnSend.style.opacity = '0.5';

            let archivoData = {};
            if (selectedFeedFile) {
                console.log("Procesando archivo como Base64...");
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(selectedFeedFile);
                });
                archivoData = {
                    archivoUrl: base64,
                    archivoNombre: selectedFeedFile.name
                };
            }

            await crearNovedadClase(currentClassId, {
                tipo: 'mensaje',
                autor_id: auth.currentUser.uid,
                autor_nombre: currentPerfil?.nombre || "Usuario",
                mensaje: msg,
                ...archivoData
            });

            inputMsg.value = '';
            selectedFeedFile = null;
            fileInput.value = '';
            filePreview.classList.add('hidden');
            const thumbContainer = document.getElementById('feedThumbContainer');
            if (thumbContainer) thumbContainer.classList.add('hidden');

            window.showCustomAlert("Éxito", "Publicado correctamente.");
        } catch (err) {
            console.error("Error al publicar en el muro:", err);
            window.showCustomAlert("Error", "No se pudo publicar: " + err.message);
        } finally {
            btnSend.disabled = false;
            btnSend.style.opacity = '1';
        }
    };

    // Modales genéricos
    document.querySelectorAll('.close-modal, .modal-btn.cancel').forEach(btn => {
        btn.onclick = (e) => {
            if (e.target.tagName === 'A') return; // No cerrar si es un link (p.ej. en el footer del dropdown)
            btn.closest('.modal-overlay').classList.add('hidden');
        };
    });

    // Ver Código
    const btnVerCodigo = document.getElementById('btnVerCodigo');
    const modalVerCodigo = document.getElementById('modalVerCodigo');
    if (btnVerCodigo) {
        btnVerCodigo.onclick = () => {
            document.getElementById('bigClassCode').innerText = clase.Código;
            modalVerCodigo.classList.remove('hidden');
        };
    }

    // Editar Clase
    const btnEditar = document.getElementById('btnEditarClase');
    const modalEditar = document.getElementById('modalEditarClase');
    const editSelectAsig = document.getElementById('editAsignaturaClase');
    const editCustomAsig = document.getElementById('editAsignaturaPersonalizada');

    if (btnEditar) {
        btnEditar.onclick = () => {
            document.getElementById('editNombreClase').value = clase.nombre;
            document.getElementById('editDescClase').value = clase.Descripción || "";
            
            // Lógica de Asignatura
            const currentAsig = clase.Asignatura || "General";
            let found = false;
            for (let i = 0; i < editSelectAsig.options.length; i++) {
                if (editSelectAsig.options[i].value === currentAsig) {
                    editSelectAsig.selectedIndex = i;
                    found = true;
                    break;
                }
            }

            if (!found && currentAsig !== "General") {
                editSelectAsig.value = "Otra";
                editCustomAsig.value = currentAsig;
                editCustomAsig.classList.remove('hidden');
            } else {
                editCustomAsig.classList.add('hidden');
                editCustomAsig.value = "";
            }

            selectedColor = clase.color || 'cat-2';
            renderColorPicker();
            modalEditar.classList.remove('hidden');
        };
    }

    if (editSelectAsig) {
        editSelectAsig.onchange = (e) => {
            if (e.target.value === 'Otra') {
                editCustomAsig.classList.remove('hidden');
            } else {
                editCustomAsig.classList.add('hidden');
            }
        };
    }

    const btnSaveEdit = document.getElementById('btnSaveEdit');
    if (btnSaveEdit) {
        btnSaveEdit.onclick = async () => {
            const nuevoNombre = document.getElementById('editNombreClase').value.trim();
            let nuevaAsig = editSelectAsig.value;
            const customAsigVal = editCustomAsig.value.trim();

            if (nuevaAsig === 'Otra') {
                if (!customAsigVal) {
                    window.showCustomAlert("Error", "Escribe el nombre de la asignatura personalizada.");
                    return;
                }
                nuevaAsig = customAsigVal;
            }

            const nuevaDesc = document.getElementById('editDescClase').value.trim();

            if (!nuevoNombre) return;

            try {
                await updateDoc(doc(db, "clases", currentClassId), {
                    nombre: nuevoNombre,
                    Asignatura: nuevaAsig,
                    Descripción: nuevaDesc,
                    color: selectedColor
                });
                modalEditar.classList.add('hidden');
                window.location.reload();
            } catch (err) {
                console.error(err);
                window.showCustomAlert("Error", "No se pudo actualizar la clase.");
            }
        };
    }

    // Crear Tarea
    const btnNuevaTarea = document.getElementById('btnNuevaTarea');
    const modalTarea = document.getElementById('modalCrearTarea');
    if (btnNuevaTarea) {
        btnNuevaTarea.onclick = () => modalTarea.classList.remove('hidden');
    }

    const formTarea = document.getElementById('formNuevaTarea');
    if (formTarea) {
        formTarea.onsubmit = async (e) => {
            e.preventDefault();
            await crearTarea();
        };
    }

    // Lógica de File Slots
    const fileSlots = document.querySelectorAll('.file-slot');
    fileSlots.forEach(slot => {
        const input = slot.querySelector('input');
        const nameSpan = slot.querySelector('.file-name');

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                slot.classList.add('has-file');
                nameSpan.textContent = file.name;
                nameSpan.classList.remove('hidden');
            } else {
                slot.classList.remove('has-file');
                nameSpan.classList.add('hidden');
            }
        });
    });

    const selectPart = document.getElementById('selectParticipantes');
    selectPart.onchange = async (e) => {
        const extra = document.getElementById('participantesExtra');
        extra.innerHTML = '';
        if (e.target.value === 'numero') {
            extra.innerHTML = '<input type="number" id="numPart" placeholder="Nº de alumnos" min="1" required>';
        } else if (e.target.value === 'especificos') {
            extra.innerHTML = '<p>Cargando alumnos...</p>';
            const updatedClase = await obtenerClasePorId(currentClassId);
            if (updatedClase && updatedClase.alumnos) {
                extra.innerHTML = '<div id="listEspec" style="max-height: 150px; overflow-y: auto; border: 1px solid var(--gray-2); padding: 10px; border-radius: 8px;"></div>';
                const list = document.getElementById('listEspec');
                for (const uid of updatedClase.alumnos) {
                    const p = await obtenerPerfilUsuario(uid);
                    const div = document.createElement('div');
                    div.innerHTML = `<input type="checkbox" name="especAlumno" value="${uid}"> ${p.nombre} ${p.apellidos || ''}`;
                    list.appendChild(div);
                }
            }
        }
    };

    // Botón Panel de Control (Docente) -> Ir a clase-admin.html
    const btnGestionar = document.getElementById('btnGestionarAlumnos');
    if (btnGestionar) {
        btnGestionar.onclick = () => {
            window.location.href = `clase-admin.html?id=${currentClassId}`;
        };
    }
}

function renderColorPicker() {
    const picker = document.getElementById('colorPicker');
    picker.innerHTML = '';
    Object.keys(colorMap).forEach(cat => {
        const opt = document.createElement('div');
        opt.className = `color-option ${selectedColor === cat ? 'selected' : ''}`;
        opt.style.backgroundColor = colorMap[cat];
        opt.onclick = () => {
            selectedColor = cat;
            renderColorPicker();
        };
        picker.appendChild(opt);
    });
}

async function renderAlumnosList() {
    const list = document.getElementById('alumnosList');
    list.innerHTML = 'Cargando alumnos...';

    const clase = await obtenerClasePorId(currentClassId);
    if (!clase || !clase.alumnos || clase.alumnos.length === 0) {
        list.innerHTML = 'No hay alumnos en esta clase.';
        return;
    }

    list.innerHTML = '';
    for (const uid of clase.alumnos) {
        const p = await obtenerPerfilUsuario(uid);
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        item.innerHTML = `
            <div class="user-info-box">
                <img src="${p.foto_perfil || '../assets/img/avatar-defecto.png'}" class="post-avatar">
                <div>
                    <strong>${p.nombre} ${p.apellidos || ''}</strong>
                    <p style="font-size: 0.8rem; color: var(--gray-4);">${p.email || ''}</p>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn-warning" onclick="expulsarAlumnoWrapper('${uid}')">Expulsar</button>
                <button class="btn-danger" onclick="banearAlumnoWrapper('${uid}')">Banear</button>
            </div>
        `;
        list.appendChild(item);
    }
}

window.expulsarAlumnoWrapper = async (uid) => {
    window.showCustomConfirm("Expulsar Alumno", "¿Seguro que quieres expulsar a este alumno?", async () => {
        await expulsarAlumno(currentClassId, uid);
        await renderAlumnosList();
    });
};

window.banearAlumnoWrapper = async (uid) => {
    window.showCustomConfirm("Banear Alumno", "¿Seguro que quieres banear a este alumno? NO podrá volver a unirse.", async () => {
        await banearAlumnoClase(currentClassId, uid);
        await renderAlumnosList();
    });
};

async function crearTarea() {
    const titulo = document.getElementById('tareaTitulo').value.trim();
    const desc = document.getElementById('tareaDesc').value.trim();
    const tipoTarea = document.getElementById('tareaTipo').value;
    const fSalida = document.getElementById('fechaSalida').value;
    const hSalida = document.getElementById('horaSalida').value;
    const fEntrega = document.getElementById('fechaEntrega').value;
    const hEntrega = document.getElementById('horaEntrega').value;
    const puntos = parseInt(document.getElementById('tareaPuntos').value) || 1;
    const partTipo = document.getElementById('selectParticipantes').value;

    // Recoger archivos de los slots (máx 4)
    const archivos = [];
    for (let i = 0; i < 4; i++) {
        const f = document.getElementById(`file-${i}`).files[0];
        if (f) archivos.push(f);
    }

    if (!titulo || !desc || !fSalida || !fEntrega || !hSalida || !hEntrega) {
        window.showCustomAlert("Error", "Todos los campos obligatorios deben estar rellenos.");
        return;
    }

    try {
        window.showCustomAlert("Publicando", "Procesando archivos y creando tarea...");

        const fileUrls = [];
        for (const file of archivos) {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            fileUrls.push({ nombre: file.name, url: base64 });
        }

        const alumnosEspec = [];
        if (partTipo === 'especificos') {
            const checks = document.querySelectorAll('input[name="especAlumno"]:checked');
            checks.forEach(c => alumnosEspec.push(c.value));
        }

        const tareaRef = await addDoc(collection(db, "trabajos"), {
            titulo: titulo,
            descripcion: desc,
            tipo_tarea: tipoTarea, // Obligatoria u Opcional
            fecha_publicacion: serverTimestamp(),
            fecha_limite: new Date(`${fEntrega}T${hEntrega}:00`),
            fecha_salida: new Date(`${fSalida}T${hSalida}:00`),
            estado: "Pendiente",
            id_publicador: auth.currentUser.uid,
            id_clase: currentClassId,
            adjuntos: fileUrls,
            participantes_tipo: partTipo,
            num_participantes: partTipo === 'numero' ? document.getElementById('numPart').value : null,
            alumnos_especificos: alumnosEspec,
            tipo: 'escolar',
            puntos: puntos,
            id_categoria: currentClassData?.Asignatura || 'General' // Heredar asignatura de la clase
        });

        await crearNovedadClase(currentClassId, {
            tipo: 'tarea',
            autor_id: auth.currentUser.uid,
            autor_nombre: currentPerfil.nombre || "Profesor",
            titulo: titulo,
            mensaje: `Se ha publicado una nueva tarea: **${titulo}** (${tipoTarea})`,
            id_referencia: tareaRef.id
        });

        document.getElementById('modalCrearTarea').classList.add('hidden');
        window.showCustomAlert("Éxito", "Tarea publicada correctamente.");
        document.getElementById('formNuevaTarea').reset();

        // Resetear slots
        document.querySelectorAll('.file-slot').forEach(s => {
            s.classList.remove('has-file');
            s.querySelector('.file-name').classList.add('hidden');
        });

    } catch (err) {
        console.error("Error al crear tarea:", err);
        window.showCustomAlert("Error", "No se pudo crear la tarea.");
    }
}
function setupColorPicker() {
    const picker = document.getElementById('colorPickerContainer');
    if (!picker) return;

    picker.onclick = (e) => {
        e.stopPropagation();
        // Eliminar si ya existe
        const existing = document.querySelector('.color-options-popup');
        if (existing) {
            existing.remove();
            return;
        }

        const popup = document.createElement('div');
        popup.className = 'color-options-popup';

        Object.entries(colorMap).forEach(([key, value]) => {
            const opt = document.createElement('div');
            opt.className = 'color-option';
            opt.style.backgroundColor = value;
            opt.onclick = async () => {
                const hero = document.getElementById('classHero');
                const inner = document.getElementById('currentColorInner');
                if (hero) hero.style.backgroundColor = value;
                if (inner) inner.style.backgroundColor = value;

                // Guardar preferencia
                try {
                    const user = auth.currentUser;
                    const prefPath = `preferencias_clases.${currentClassId}.color`;
                    await updateDoc(doc(db, "usuarios", user.uid), {
                        [prefPath]: key
                    });
                    // Actualizar perfil local
                    if (!currentPerfil.preferencias_clases) currentPerfil.preferencias_clases = {};
                    if (!currentPerfil.preferencias_clases[currentClassId]) currentPerfil.preferencias_clases[currentClassId] = {};
                    currentPerfil.preferencias_clases[currentClassId].color = key;
                } catch (err) {
                    console.error("Error al guardar preferencia de color:", err);
                }
                popup.remove();
            };
            popup.appendChild(opt);
        });

        picker.appendChild(popup);
    };

    document.addEventListener('click', () => {
        const popup = document.querySelector('.color-options-popup');
        if (popup) popup.remove();
    });
}
