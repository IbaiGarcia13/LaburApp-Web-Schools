import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    deleteDoc,
    orderBy,
    increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * ==========================================
 * MÓDULO DE BASE DE DATOS (Adaptador NoSQL)
 * ==========================================
 * Incluye helpers para todas las colecciones basadas en 
 * el esquema SQL original (Usuarios, Trabajos, Postulaciones,
 * Valoraciones, Puntos, Metodos de Pago e Historial).
 */

// --- 1. USUARIOS ---

export async function obtenerPerfilUsuario(uid) {
    const docRef = doc(db, "usuarios", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null;
}

export const obtenerUsuarioPorId = obtenerPerfilUsuario;

export async function actualizarPerfilUsuario(uid, datosNuevos) {
    const docRef = doc(db, "usuarios", uid);
    await updateDoc(docRef, datosNuevos);
    return true;
}

export async function obtenerTodosLosUsuarios() {
    const q = query(collection(db, "usuarios"));
    const snapshot = await getDocs(q);
    const users = [];
    snapshot.forEach(doc => {
        users.push({ uid: doc.id, ...doc.data() });
    });
    return users;
}

// --- 2. TRABAJOS ---

export async function crearTrabajo(datosTrabajo) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");

    // Cálculo básico de pagos (El esquema SQL lo pide)
    const pagoCliente = Number(datosTrabajo.pagoCliente);
    // Suponemos una comisión genérica del 10% si no hay suscripción
    const pagoTrabajador = pagoCliente * 0.90;
    const xpOtorgada = Math.round(pagoCliente * 10);

    const docRef = await addDoc(collection(db, "trabajos"), {
        titulo: datosTrabajo.titulo,
        descripcion: datosTrabajo.descripcion,
        direccion: datosTrabajo.direccion || "",
        foto_trabajo: datosTrabajo.foto_trabajo || "",
        latitud: datosTrabajo.latitud || 0,
        longitud: datosTrabajo.longitud || 0,
        fecha_publicacion: serverTimestamp(),
        // fecha_limite debería venir como un objeto Date
        fecha_limite: datosTrabajo.fecha_limite,
        tiempo_estimado_horas: datosTrabajo.tiempo_estimado_horas || null,
        estado: "Pendiente", // 'Pendiente', 'Aceptado', 'En curso', 'Finalizado', 'Cancelado'
        pago_cliente: pagoCliente,
        pago_trabajador: pagoTrabajador,
        xp_otorgada: xpOtorgada,
        id_categoria: datosTrabajo.id_categoria,
        id_publicador: user.uid,
        id_trabajador: null
    });

    return docRef.id;
}

export async function obtenerTrabajoPorId(idTrabajo) {
    const docRef = doc(db, "trabajos", idTrabajo);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function obtenerTrabajos(idCategoria = "todas") {
    let q;
    if (idCategoria && idCategoria !== "todas") {
        q = query(
            collection(db, "trabajos"),
            where("id_categoria", "==", idCategoria),
            where("estado", "==", "Pendiente")
        );
    } else {
        q = query(
            collection(db, "trabajos"),
            where("estado", "==", "Pendiente")
        );
    }

    const snapshot = await getDocs(q);
    const trabajos = [];
    snapshot.forEach((doc) => {
        trabajos.push({ id: doc.id, ...doc.data() });
    });
    return trabajos;
}

export async function obtenerTrabajosPublicadosPorMi(uid) {
    const q = query(
        collection(db, "trabajos"),
        where("id_publicador", "==", uid)
    );

    const snapshot = await getDocs(q);
    const trabajos = [];
    snapshot.forEach((doc) => {
        trabajos.push({ id: doc.id, ...doc.data() });
    });
    return trabajos;
}

export async function obtenerTrabajosAceptadosPorMi(uid) {
    const q = query(
        collection(db, "trabajos"),
        where("id_trabajador", "==", uid)
    );

    const snapshot = await getDocs(q);
    const tareas = [];
    snapshot.forEach((doc) => {
        tareas.push({ id: doc.id, ...doc.data() });
    });
    return tareas;
}

// --- 3. POSTULACIONES (Subcolección de Trabajos) ---

export async function postularseATrabajo(idTrabajo) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");

    const postulacionRef = doc(db, "trabajos", idTrabajo, "postulaciones", user.uid);
    await setDoc(postulacionRef, {
        estado_postulacion: "Pendiente", // 'Pendiente', 'Aceptada', 'Rechazada', 'Cancelada'
        fecha_postulacion: serverTimestamp()
    });
    return true;
}

export async function obtenerPostulacionesDeUnTrabajo(idTrabajo) {
    const q = query(collection(db, "trabajos", idTrabajo, "postulaciones"));
    const snapshot = await getDocs(q);
    const postulaciones = [];
    snapshot.forEach((doc) => {
        postulaciones.push({ id_usuario: doc.id, ...doc.data() });
    });
    return postulaciones;
}

/**
 * Obtiene todas las tareas a las que el usuario actual se ha postulado
 */
export async function obtenerMisPostulaciones(uid) {
    // Firestore no permite queries collectionGroup fácilmente sin índices complejos para subcolecciones profundas
    // Así que buscaremos en todos los trabajos y filtraremos las subcolecciones (o mejor, usaremos una query de ayuda)
    // Para simplificar esta demo, buscaremos en todos los trabajos donde el usuario NO es el dueño
    // y luego verificamos si existe su documento en la subcolección 'postulaciones'
    const q = query(collection(db, "trabajos"), where("estado", "==", "Pendiente"));
    const snapshot = await getDocs(q);
    const misPostulaciones = [];

    for (const trabajoDoc of snapshot.docs) {
        const postRef = doc(db, "trabajos", trabajoDoc.id, "postulaciones", uid);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
            misPostulaciones.push({
                id: trabajoDoc.id,
                ...trabajoDoc.data(),
                postulacion: postSnap.data()
            });
        }
    }
    return misPostulaciones;
}

/**
 * Obtiene los usuarios que se han postulado a las tareas creadas por el usuario actual
 */
export async function obtenerPostulacionesParaMisTareas(uid) {
    const misTrabajos = await obtenerTrabajosPublicadosPorMi(uid);
    const todasLasPostulaciones = [];

    for (const trabajo of misTrabajos) {
        const posts = await obtenerPostulacionesDeUnTrabajo(trabajo.id);
        posts.forEach(p => {
            todasLasPostulaciones.push({
                ...p,
                trabajo_titulo: trabajo.titulo,
                id_trabajo: trabajo.id
            });
        });
    }
    return todasLasPostulaciones;
}

export async function cancelarPostulacion(idTrabajo, uid) {
    const postRef = doc(db, "trabajos", idTrabajo, "postulaciones", uid);
    await deleteDoc(postRef);
    return true;
}

export async function aceptarPostulacion(idTrabajo, uidTrabajador) {
    const trabajoRef = doc(db, "trabajos", idTrabajo);
    // 1. Actualizar el trabajo: poner el trabajador y cambiar estado
    await updateDoc(trabajoRef, {
        id_trabajador: uidTrabajador,
        estado: "Aceptado"
    });

    // 2. Marcar la postulación como aceptada
    const postRef = doc(db, "trabajos", idTrabajo, "postulaciones", uidTrabajador);
    await updateDoc(postRef, {
        estado_postulacion: "Aceptada"
    });

    // 3. (Opcional) Podríamos rechazar automáticamente al resto
    return true;
}

export async function rechazarPostulacion(idTrabajo, uidTrabajador) {
    const postRef = doc(db, "trabajos", idTrabajo, "postulaciones", uidTrabajador);
    await updateDoc(postRef, {
        estado_postulacion: "Rechazada"
    });
    return true;
}

/**
 * Marca un trabajo como Completada e incrementa tareas_realizadas del trabajador.
 * Solo debe llamarse cuando el publicador da el trabajo por finalizado.
 */
export async function completarTrabajo(idTrabajo, uidTrabajador) {
    const trabajoRef = doc(db, "trabajos", idTrabajo);

    // 1. Obtener datos del trabajo para saber su categoría
    const trabajoSnap = await getDoc(trabajoRef);
    let idCategoria = "otros"; // Por defecto si no tiene
    if (trabajoSnap.exists()) {
        const data = trabajoSnap.data();
        if (data.categoria) idCategoria = data.categoria;
    }

    // 2. Cambiar el estado del trabajo a Completada
    await updateDoc(trabajoRef, {
        estado: "Completada",
        fecha_completada: serverTimestamp()
    });

    // 3. Incrementar atómicamente tareas_realizadas en el perfil del trabajador
    const trabajadorRef = doc(db, "usuarios", uidTrabajador);
    await updateDoc(trabajadorRef, {
        tareas_realizadas: increment(1)
    });

    // 4. Sumar 1 punto a la categoría correspondiente
    await sumarPuntosCategoria(uidTrabajador, idCategoria, 1);

    return true;
}

// --- 4. CATEGORÍAS (Puntos Usuario - Subcolección) ---

export async function obtenerPuntosCategoria(uid, idCategoria) {
    const docRef = doc(db, "usuarios", uid, "puntuaciones_categorias", idCategoria);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().puntos : 0;
}

export async function obtenerTodosPuntosCategorias(uid) {
    const q = query(collection(db, "usuarios", uid, "puntuaciones_categorias"));
    const snapshot = await getDocs(q);
    const categorias = [];
    snapshot.forEach((doc) => {
        categorias.push({ id_categoria: doc.id, puntos: doc.data().puntos });
    });
    return categorias;
}

export async function sumarPuntosCategoria(uid, idCategoria, puntosASumar) {
    const docRef = doc(db, "usuarios", uid, "puntuaciones_categorias", idCategoria);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        await updateDoc(docRef, { puntos: docSnap.data().puntos + puntosASumar });
    } else {
        await setDoc(docRef, { puntos: puntosASumar });
    }
}

// --- 5. VALORACIONES (Subcolección de Usuario) ---

export async function dejarValoracion(uidReceptor, idTrabajo, puntuacion, comentario) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");
    if (puntuacion < 1 || puntuacion > 5) throw new Error("Puntuación inválida.");

    // 1. Guardar la valoración en la subcolección
    await addDoc(collection(db, "usuarios", uidReceptor, "valoraciones_recibidas"), {
        puntuacion: puntuacion,
        comentario: comentario || "",
        fecha: serverTimestamp(),
        id_trabajo: idTrabajo,
        id_usuario_emisor: user.uid
    });

    // 2. Recalcular la VALORACIÓN MEDIA del usuario receptor
    const userRef = doc(db, "usuarios", uidReceptor);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        let oldMedia = userData.valoracion_media !== undefined ? userData.valoracion_media : 2.5;
        let oldCount = userData.num_valoraciones !== undefined ? userData.num_valoraciones : 1;

        const newCount = oldCount + 1;
        const newMedia = (oldMedia * oldCount + puntuacion) / newCount;

        await updateDoc(userRef, {
            valoracion_media: Number(newMedia.toFixed(2)),
            num_valoraciones: newCount
        });
    }

    return true;
}

/**
 * Obtiene todas las valoraciones recibidas por un usuario,
 * con los datos del emisor (foto, nombre) para mostrarlas en su perfil.
 */
export async function obtenerValoracionesRecibidas(uid) {
    const q = query(
        collection(db, "usuarios", uid, "valoraciones_recibidas"),
        orderBy("fecha", "desc")
    );
    const snapshot = await getDocs(q);
    const valoraciones = [];

    for (const docSnap of snapshot.docs) {
        const v = { id: docSnap.id, ...docSnap.data() };

        // Buscar datos del emisor para mostrar foto y nombre
        if (v.id_usuario_emisor) {
            try {
                const emisorRef = doc(db, "usuarios", v.id_usuario_emisor);
                const emisorSnap = await getDoc(emisorRef);
                if (emisorSnap.exists()) {
                    const e = emisorSnap.data();
                    v.emisor_nombre = e.nombre_completo || ((e.nombre || '') + ' ' + (e.apellidos || '')).trim();
                    v.emisor_foto = e.foto_perfil || null;
                }
            } catch (_) { /* Si falla, continuamos sin datos del emisor */ }
        }

        // Buscar título del trabajo valorado
        if (v.id_trabajo) {
            try {
                const trabajoRef = doc(db, "trabajos", v.id_trabajo);
                const trabajoSnap = await getDoc(trabajoRef);
                if (trabajoSnap.exists()) {
                    v.titulo_trabajo = trabajoSnap.data().titulo;
                }
            } catch (_) { }
        }

        valoraciones.push(v);
    }
    return valoraciones;
}

// --- 6. MÉTODOS Y E HISTORIAL DE PAGO (Subcolecciones Usuario) ---

export async function agregarMetodoPago(uid, tipo, detalle) {
    // Si tipo == favorio le ponemos favorito al agregar, de momento no pedido por DB sino por UI
    const docRef = await addDoc(collection(db, "usuarios", uid, "metodos_pago"), {
        tipo: tipo, // 'Tarjeta Bancaria', 'PayPal'...
        detalle: detalle,
        favorito: false
    });
    return docRef.id;
}

export async function obtenerMetodosPago(uid) {
    const q = query(collection(db, "usuarios", uid, "metodos_pago"));
    const snapshot = await getDocs(q);
    const metodos = [];
    snapshot.forEach((doc) => {
        metodos.push({ id_metodo: doc.id, ...doc.data() });
    });
    return metodos;
}

export async function registrarPagoHistorial(uid, idMetodo, monto) {
    await addDoc(collection(db, "usuarios", uid, "historial_pagos"), {
        monto: monto,
        id_metodo: idMetodo,
        fecha_emision: serverTimestamp()
    });
    return true;
}

export async function obtenerHistorialPagos(uid) {
    // Order by date descending to have newest first, requires index
    const q = query(collection(db, "usuarios", uid, "historial_pagos"), orderBy("fecha_emision", "desc"));
    const snapshot = await getDocs(q);
    const historial = [];
    snapshot.forEach((doc) => {
        historial.push({ id_pago: doc.id, ...doc.data() });
    });
    return historial;
}

// --- 7. CHAT (Mensajes dentro del Trabajo) ---

export async function enviarMensajeTrabajo(idTrabajo, texto, tipo = "texto") {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");

    // Necesitamos el documento del trabajo para saber quién es el receptor
    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    if (!trabajo) throw new Error("Trabajo no encontrado.");

    // El receptor es el publicador si yo soy el trabajador, o viceversa
    let idReceptor = null;
    if (user.uid === trabajo.id_publicador) {
        idReceptor = trabajo.id_trabajador || null;
    } else if (user.uid === trabajo.id_trabajador) {
        idReceptor = trabajo.id_publicador;
    }

    const mensajesRef = collection(db, "trabajos", idTrabajo, "mensajes");
    await addDoc(mensajesRef, {
        contenido: texto,
        leido: false,
        tipo_contenido: tipo,
        id_emisor: user.uid,
        id_receptor: idReceptor,
        fecha_envio: serverTimestamp()
    });
}

import { limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Obtiene todos los trabajos donde el usuario actual participa Y ya hay mensajes.
 */
export async function obtenerConversacionesActivas(uid) {
    // 1. Trabajos publicados por mí que tienen un trabajador asignado
    const qPub = query(collection(db, "trabajos"), where("id_publicador", "==", uid), where("id_trabajador", "!=", null));
    const snapPub = await getDocs(qPub);

    // 2. Trabajos donde yo soy el trabajador
    const qWork = query(collection(db, "trabajos"), where("id_trabajador", "==", uid));
    const snapWork = await getDocs(qWork);

    const idsVistos = new Set();
    const candidatos = [];

    const procesarSnap = (snapshot) => {
        snapshot.forEach(doc => {
            if (!idsVistos.has(doc.id)) {
                idsVistos.add(doc.id);
                candidatos.push({ id: doc.id, ...doc.data() });
            }
        });
    };

    procesarSnap(snapPub);
    procesarSnap(snapWork);

    const filtrados = [];

    // 3. Filtrar solo aquellos que TENGAN mensajes
    for (const job of candidatos) {
        const msgRef = collection(db, "trabajos", job.id, "mensajes");
        const qMsg = query(msgRef, limit(1));
        const snapMsg = await getDocs(qMsg);

        if (!snapMsg.empty) {
            filtrados.push(job);
        }
    }

    return filtrados;
}

// --- 8. CHAT DIRECTO (Sin Trabajo) ---

export function generarIdChatDirecto(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

export async function enviarMensajeDirecto(uidOtro, texto, tipo = "texto") {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");

    const idChat = generarIdChatDirecto(user.uid, uidOtro);

    // Guardamos que existe la conversación para ambos usuarios para poder listarlas luego
    await setDoc(doc(db, "usuarios", user.uid, "chats_directos", uidOtro), {
        id_otro_usuario: uidOtro,
        ultimo_mensaje: serverTimestamp()
    }, { merge: true });

    await setDoc(doc(db, "usuarios", uidOtro, "chats_directos", user.uid), {
        id_otro_usuario: user.uid,
        ultimo_mensaje: serverTimestamp()
    }, { merge: true });

    const mensajesRef = collection(db, "chats", idChat, "mensajes");
    await addDoc(mensajesRef, {
        contenido: texto,
        leido: false,
        tipo_contenido: tipo,
        id_emisor: user.uid,
        id_receptor: uidOtro,
        fecha_envio: serverTimestamp()
    });
}

