import { db, auth, storage } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { enviarMensajeTrabajo, obtenerTrabajoPorId, obtenerUsuarioPorId, enviarMensajeDirecto, generarIdChatDirecto } from './database.js';


const listaMensajes = document.getElementById('messages');
const formulario = document.getElementById('chat-form');
const inputTexto = document.getElementById('message-input');
const otherAvatar = document.getElementById('otherAvatar');
const otherName = document.getElementById('otherName');
const jobTitle = document.getElementById('jobTitle');

// Elementos de Previsualización de Imagen
const previewContainer = document.getElementById('image-preview-container');
const previewImage = document.getElementById('image-preview');
const btnRemovePreview = document.getElementById('btn-remove-preview');
const inputGallery = document.getElementById('input-file-gallery');

let currentUserData = null;
let otherUserData = null;

// 1. Obtener ID de la URL
const urlParams = new URLSearchParams(window.location.search);
const idTrabajo = urlParams.get('id'); // ID of the job
const userIdDirect = urlParams.get('userId'); // Direct chat with another user without a job

let chatMode = 'job';
if (userIdDirect) {
    chatMode = 'direct';
} else if (!idTrabajo) {
    showCustomAlert("Error", "No se ha especificado un destinatario para el chat.");
    setTimeout(() => window.location.href = 'mensajes.html', 2000);
}

// 2. Cargar Info
async function loadChatMeta() {
    try {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUserData = await obtenerUsuarioPorId(user.uid);

                let otherId = userIdDirect || urlParams.get('userId');

                if (chatMode === 'job') {
                    const trabajo = await obtenerTrabajoPorId(idTrabajo);
                    if (trabajo) {
                        jobTitle.textContent = `Trabajo: ${trabajo.titulo}`;
                        // If otherId wasn't in URL, we find it from the job
                        if (!otherId) {
                            otherId = (user.uid === trabajo.id_publicador) ? trabajo.id_trabajador : trabajo.id_publicador;
                        }
                    }
                } else {
                    jobTitle.style.display = 'none';
                }

                if (otherId) {
                    otherUserData = await obtenerUsuarioPorId(otherId);
                    if (otherUserData) {
                        const nameToDisplay = otherUserData.nombre_completo || otherUserData.nombre;
                        const avatarToDisplay = otherUserData.foto_perfil || "../assets/img/avatar-defecto.png";

                        otherName.textContent = nameToDisplay;
                        otherAvatar.src = avatarToDisplay;

                        // Links header
                        const headerImgLink = document.getElementById("headerProfileLinkImg");
                        const headerTextLink = document.getElementById("headerProfileLinkText");
                        if (headerImgLink) headerImgLink.href = `usuario.html?id=${otherId}`;
                        if (headerTextLink) headerTextLink.href = `usuario.html?id=${otherId}`;

                        const reportModalName = document.getElementById('reportModalName');
                        const reportModalAvatar = document.getElementById('reportModalAvatar');
                        if (reportModalName) reportModalName.textContent = nameToDisplay;
                        if (reportModalAvatar) reportModalAvatar.src = avatarToDisplay;

                        // Links modal
                        const modalImgLink = document.getElementById("modalProfileLinkImg");
                        const modalTextLink = document.getElementById("modalProfileLinkText");
                        if (modalImgLink) modalImgLink.href = `usuario.html?id=${otherId}`;
                        if (modalTextLink) modalTextLink.href = `usuario.html?id=${otherId}`;
                    }
                } else {
                    // This fallback is only reached if there's no info at all
                    otherName.textContent = "Chat";
                }

                // --- A: ESCUCHAR MENSAJES (Se inicia al saber el usuario) ---
                startMessageListener(user.uid, otherId);
            }
        });
    } catch (e) {
        console.error(e);
    }
}

loadChatMeta();
function startMessageListener(myUid, otherUid) {
    if (!listaMensajes) return;

    let mensajesRef;
    if (chatMode === 'job' && idTrabajo) {
        mensajesRef = collection(db, "trabajos", idTrabajo, "mensajes");
    } else if (chatMode === 'direct' && otherUid) {
        const chatId = generarIdChatDirecto(myUid, otherUid);
        mensajesRef = collection(db, "chats", chatId, "mensajes");
    } else {
        return; // Sin info para iniciar chat
    }

    const q = query(mensajesRef, orderBy("fecha_envio", "asc"));

    onSnapshot(q, (snapshot) => {
        // Marcar como leídos los mensajes del otro usuario que aún no están leídos
        snapshot.docs.forEach((msgDoc) => {
            const data = msgDoc.data();
            if (data.id_emisor !== myUid && data.leido === false) {
                updateDoc(doc(mensajesRef.firestore, mensajesRef.path, msgDoc.id), { leido: true })
                    .catch(err => console.warn('Error marcando leído:', err));
            }
        });

        listaMensajes.innerHTML = '';
        snapshot.forEach((msgDoc) => {
            const data = msgDoc.data();
            const isOwn = (data.id_emisor === myUid);

            const groupDiv = document.createElement('div');
            groupDiv.className = `message-group ${isOwn ? 'own' : 'other'}`;

            const wrapperDiv = document.createElement('div');
            wrapperDiv.className = 'message-wrapper';

            const avatarImg = document.createElement('img');
            avatarImg.className = 'msg-avatar';
            if (isOwn) {
                avatarImg.src = currentUserData?.foto_perfil || "../assets/img/avatar-defecto.png";
            } else {
                avatarImg.src = otherUserData?.foto_perfil || "../assets/img/avatar-defecto.png";
            }

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'burbuja-mensaje';

            const contentText = (data.tipo_contenido === 'texto') ? data.contenido : "[Imagen Adjunta]";

            let timeString = "";
            if (data.fecha_envio) {
                const date = data.fecha_envio.toDate();
                const now = new Date();
                const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();

                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (isToday) {
                    timeString = timeStr;
                } else {
                    const d = date.getDate().toString().padStart(2, '0');
                    const m = (date.getMonth() + 1).toString().padStart(2, '0');
                    const y = date.getFullYear();
                    timeString = `${timeStr} ${d}/${m}/${y}`;
                }
            }

            // Mensajes de texto o imagen
            if (data.tipo_contenido === 'imagen') {
                bubbleDiv.innerHTML = `<img src="${data.contenido}" alt="Imagen enviada" style="max-width:200px; border-radius:10px; display:block;">
                    <span class="msg-time">${timeString}</span>`;
            } else {
                bubbleDiv.innerHTML = `${contentText} <span class="msg-time">${timeString}</span>`;
            }

            wrapperDiv.appendChild(avatarImg);
            wrapperDiv.appendChild(bubbleDiv);
            groupDiv.appendChild(wrapperDiv);

            // Indicador de estado solo en mensajes propios
            if (isOwn) {
                const isRead = data.leido === true;
                const statusDiv = document.createElement('div');
                statusDiv.className = `msg-status ${isRead ? 'msg-status--read' : 'msg-status--unread'}`;
                statusDiv.textContent = isRead ? '✓✓ Leído' : '✓ No leído';
                groupDiv.appendChild(statusDiv);
            }

            listaMensajes.appendChild(groupDiv);
        });
        listaMensajes.scrollTop = listaMensajes.scrollHeight;
    });
}

// --- B: ENVIAR MENSAJE ---
let currentImageBlob = null;

function showPreview(fileOrBlob) {
    currentImageBlob = fileOrBlob;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(fileOrBlob);
}

function clearPreview() {
    currentImageBlob = null;
    previewImage.src = '';
    previewContainer.classList.add('hidden');
    if (inputGallery) inputGallery.value = '';
}

if (btnRemovePreview) {
    btnRemovePreview.addEventListener('click', clearPreview);
}

if (formulario && (idTrabajo || userIdDirect)) {
    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = inputTexto.value.trim();

        if (texto !== "" || currentImageBlob) {
            try {
                let imageUrl = null;

                // Si hay una imagen en el preview, la subimos primero
                if (currentImageBlob) {
                    const fileName = currentImageBlob.name || `capture_${Date.now()}.jpg`;
                    const path = `chat-images/${Date.now()}_${fileName}`;
                    const storageRef = ref(storage, path);
                    await uploadBytes(storageRef, currentImageBlob);
                    imageUrl = await getDownloadURL(storageRef);
                }

                if (chatMode === 'job') {
                    if (imageUrl) {
                        await enviarMensajeTrabajo(idTrabajo, imageUrl, "imagen");
                    }
                    if (texto !== "") {
                        await enviarMensajeTrabajo(idTrabajo, texto, "texto");
                    }
                } else {
                    if (imageUrl) {
                        await enviarMensajeDirecto(userIdDirect, imageUrl, "imagen");
                    }
                    if (texto !== "") {
                        await enviarMensajeDirecto(userIdDirect, texto, "texto");
                    }
                }

                inputTexto.value = '';
                clearPreview();
            } catch (error) {
                console.error("Error al enviar mensaje:", error);
                alert("Error: No pudimos enviar el mensaje. " + error.message);
            }
        }
    });
}

// --- C: MODAL DE DENUNCIA ---
const btnReport = document.getElementById('btnReport');
const reportModal = document.getElementById('reportModal');

if (btnReport && reportModal) {
    btnReport.addEventListener('click', (e) => {
        e.stopPropagation();
        reportModal.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!reportModal.contains(e.target) && !btnReport.contains(e.target)) {
            reportModal.classList.add('hidden');
        }
    });
}

// --- D: SELECCIÓN DE IMAGEN (GALERÍA) ---
const btnImage = document.getElementById('btnImage');

if (btnImage && inputGallery) {
    btnImage.addEventListener('click', () => inputGallery.click());
    inputGallery.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) showPreview(file);
    });
}

// --- E: MODAL CÁMARA (getUserMedia) ---
const btnCamera = document.getElementById('btnCamera');
const modalCamera = document.getElementById('modalCamera');
const cameraStream = document.getElementById('cameraStream');
const cameraCanvas = document.getElementById('cameraCanvas');
const btnCapture = document.getElementById('btnCapture');
const btnCancelCamera = document.getElementById('btnCancelCamera');

let activeStream = null;

async function openCamera() {
    modalCamera.classList.remove('hidden');
    try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStream.srcObject = activeStream;
    } catch (err) {
        alert("No se pudo acceder a la cámara: " + err.message);
        modalCamera.classList.add('hidden');
    }
}

function stopCamera() {
    if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
    }
    cameraStream.srcObject = null;
    modalCamera.classList.add('hidden');
}

if (btnCamera) {
    btnCamera.addEventListener('click', openCamera);
}

if (btnCancelCamera) {
    btnCancelCamera.addEventListener('click', stopCamera);
}

if (btnCapture) {
    btnCapture.addEventListener('click', () => {
        if (!cameraStream.srcObject) return;

        // Capturar fotograma en canvas
        cameraCanvas.width = cameraStream.videoWidth;
        cameraCanvas.height = cameraStream.videoHeight;
        cameraCanvas.getContext('2d').drawImage(cameraStream, 0, 0);

        stopCamera();

        // Convertir a Blob y mostrar en el preview (NO subir aún)
        cameraCanvas.toBlob((blob) => {
            if (blob) showPreview(blob);
        }, 'image/jpeg', 0.85);
    });
}

