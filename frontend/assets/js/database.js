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

/**
 * Actualiza la suscripción del usuario (trabajador o cliente)
 * @param {string} uid 
 * @param {string} tipo - 'trabajador' o 'cliente'
 * @param {string} idSuscripcion - El nombre de la suscripción (ej: 'currante', 'jefe')
 */
export async function actualizarSuscripcionUsuario(uid, tipo, idSuscripcion) {
    const docRef = doc(db, "usuarios", uid);
    const campo = tipo === 'trabajador' ? 'id_suscripcion_trabajador' : 'id_suscripcion_cliente';

    const updateData = {};
    updateData[campo] = idSuscripcion;

    await updateDoc(docRef, updateData);

    // Notificar al usuario
    await crearNotificacion(uid, "Nueva suscripción adquirida", `Tu suscripción de ${tipo} ahora es "${idSuscripcion}".`, "suscripcion");

    return true;
}

/**
 * Cancela una suscripción activa (la pone a vacío)
 */
export async function cancelarSuscripcionUsuario(uid, tipo) {
    const docRef = doc(db, "usuarios", uid);
    const campo = tipo === 'trabajador' ? 'id_suscripcion_trabajador' : 'id_suscripcion_cliente';

    const updateData = {};
    updateData[campo] = ""; // O "ninguna" si prefieres, pero el código parece esperar IDs

    await updateDoc(docRef, updateData);

    // Notificar
    await crearNotificacion(uid, "Suscripción Cancelada", `Has cancelado tu suscripción de ${tipo}.`, "rechazado");

    return true;
}

/**
 * Actualiza el timestamp de actividad para usuarios con suscripción activa.
 * Esto permite el posicionamiento prioritario en las listas.
 */
export async function actualizarActividadSuscripcion(uid) {
    const userRef = doc(db, "usuarios", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const now = serverTimestamp();
    const updates = {};

    // Si es trabajador PRO, actualizar su perfil
    if (data.id_suscripcion_trabajador === "currante") {
        updates.ultimo_login_suscrito = now;
    }

    // Si es cliente PRO, actualizar su perfil y sus trabajos PENDIENTES
    if (data.id_suscripcion_cliente === "jefe") {
        updates.ultimo_login_suscrito = now;

        // Buscar trabajos pendientes de este usuario
        const q = query(
            collection(db, "trabajos"),
            where("id_publicador", "==", uid),
            where("estado", "==", "Pendiente")
        );
        const jobsSnap = await getDocs(q);
        jobsSnap.forEach(async (jobDoc) => {
            await updateDoc(doc(db, "trabajos", jobDoc.id), {
                prioridad_suscripcion: now
            });
        });
    }

    if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
    }
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
        estado: "Pendiente", // 'Pendiente', 'Aceptada', 'En curso', 'Completada', 'Cancelada'
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

/**
 * Actualiza un trabajo en Firestore. Centraliza la lógica de negocio
 * como el recálculo de XP y pago al trabajador si cambia el pago del cliente.
 */
export async function actualizarTrabajo(idTrabajo, datosNuevos) {
    const docRef = doc(db, "trabajos", idTrabajo);

    // Lógica de negocio si se cambia el pago
    if (datosNuevos.pago_cliente !== undefined) {
        const pagoC = Number(datosNuevos.pago_cliente);
        datosNuevos.pago_trabajador = pagoC * 0.90;
        datosNuevos.xp_otorgada = Math.round(pagoC * 10);
    }

    // Notificar si se empieza el trabajo (siendo el trabajador el que lo actualiza)
    if (datosNuevos.estado === "En curso") {
        const trabajo = await obtenerTrabajoPorId(idTrabajo);
        if (trabajo && trabajo.id_publicador) {
            await crearNotificacion(trabajo.id_publicador, "Tarea en Curso", `El trabajador ha empezado el trabajo "${trabajo.titulo}".`, "tarea_empezada", { id_trabajo: idTrabajo });
        }
    }

    await updateDoc(docRef, datosNuevos);
    return true;
}

export async function obtenerTrabajos(idCategoria = "todas") {
    let q;
    if (idCategoria && idCategoria !== "todas") {
        // Mapeo de sinónimos para búsqueda más robusta
        const catSynonyms = {
            "construccion": ["construccion", "construccion/reforma", "construcción"],
            "mudanza": ["mudanza", "mudanza/traslado"],
            "cuidado_personal": ["cuidado_personal", "cuidado personal"],
            "informatica": ["informatica", "informática"],
            "gastronomia": ["gastronomia", "gastronomía"],
            "diseno": ["diseno", "diseño"],
            "jardineria": ["jardineria", "jardinería"]
        };

        const categoriesToSearch = catSynonyms[idCategoria] || [idCategoria];

        q = query(
            collection(db, "trabajos"),
            where("id_categoria", "in", categoriesToSearch),
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

    // Notificar al publicador
    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    if (trabajo && trabajo.id_publicador) {
        await crearNotificacion(trabajo.id_publicador, "Nueva Postulación", `Un usuario ha postulado a tu trabajo "${trabajo.titulo}".`, "nueva_postulacion", { id_trabajo: idTrabajo });
    }

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
    // y luego verificaremos si existe su documento en la subcolección 'postulaciones'
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
    // Solo mostramos postulantes de trabajos que aún están pendientes
    const pendientes = misTrabajos.filter(t => t.estado === "Pendiente");

    const todasLasPostulaciones = [];

    for (const trabajo of pendientes) {
        const posts = await obtenerPostulacionesDeUnTrabajo(trabajo.id);
        posts.forEach(p => {
            todasLasPostulaciones.push({
                ...p,
                trabajo_titulo: trabajo.titulo,
                id_trabajo: trabajo.id,
                pago_cliente: trabajo.pago_cliente
            });
        });
    }
    return todasLasPostulaciones;
}

export async function cancelarPostulacion(idTrabajo, uid) {
    const job = await obtenerTrabajoPorId(idTrabajo);
    const postRef = doc(db, "trabajos", idTrabajo, "postulaciones", uid);
    await deleteDoc(postRef);

    // Notificar al publicador que alguien retiró su postulación (opcional, pero útil)
    if (job) {
        await crearNotificacion(job.id_publicador, "Postulación Retirada", `Un candidato ha retirado su postulación de "${job.titulo}".`, "info");
    }
    return true;
}

export async function aceptarPostulacion(idTrabajo, uidTrabajador) {
    const trabajoRef = doc(db, "trabajos", idTrabajo);
    const jobSnap = await getDoc(trabajoRef);
    if (!jobSnap.exists()) return;
    const trabajo = jobSnap.data();

    // 1. Actualizar el trabajo: poner el trabajador, cambiar estado y marcar pago retenido
    const pagoC = Number(trabajo.pago_cliente || 0);
    await updateDoc(trabajoRef, {
        id_trabajador: uidTrabajador,
        estado: "Aceptada",
        pago_retenido: true
    });

    // 1.1 Descontar saldo al publicador (Escrow)
    const publicadorRef = doc(db, "usuarios", trabajo.id_publicador);
    await updateDoc(publicadorRef, {
        saldo: increment(-pagoC)
    });

    // 1.2 Registrar en el historial del publicador
    await registrarPagoHistorial(trabajo.id_publicador, "Saldo LaburApp", -pagoC, `Retención por tarea: ${trabajo.titulo}`);

    // 2. Marcar la postulación como aceptada
    const postRef = doc(db, "trabajos", idTrabajo, "postulaciones", uidTrabajador);
    await updateDoc(postRef, {
        estado_postulacion: "Aceptada"
    });

    // 3. Notificar al trabajador
    await crearNotificacion(uidTrabajador, "¡Postulación Aceptada!", `Has sido aceptado para el trabajo "${trabajo.titulo}".`, "aceptado", { id_trabajo: idTrabajo });
    await crearNotificacion(uidTrabajador, "Nuevo Trabajo", `Tienes un nuevo trabajo asignado: "${trabajo.titulo}".`, "nuevo_trabajo", { id_trabajo: idTrabajo });

    // 4. Rechazar o eliminar automáticamente al resto
    const postulaciones = await obtenerPostulacionesDeUnTrabajo(idTrabajo);
    for (const post of postulaciones) {
        if (post.id_usuario !== uidTrabajador) {
            // Notificamos antes de borrar para que lo sepan? O simplemente borramos.
            // Según el feedback anterior, al resto se le elimina. Les notificamos.
            await crearNotificacion(post.id_usuario, "Trabajo No Disponible", `El trabajo "${trabajo.titulo}" al que postulaste ya tiene un trabajador.`, "rechazado");
            await cancelarPostulacion(idTrabajo, post.id_usuario);
        }
    }

    return true;
}

export async function rechazarPostulacion(idTrabajo, uidTrabajador) {
    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    const postRef = doc(db, "trabajos", idTrabajo, "postulaciones", uidTrabajador);
    await updateDoc(postRef, {
        estado_postulacion: "Rechazada"
    });

    // Notificar al trabajador
    if (trabajo) {
        await crearNotificacion(uidTrabajador, "Postulación Rechazada", `Tu postulación para "${trabajo.titulo}" ha sido rechazada.`, "rechazado");
    }
    return true;
}

/**
 * Marca un trabajo como Completada e incrementa tareas_realizadas del trabajador.
 * Solo debe llamarse cuando el publicador da el trabajo por finalizado.
 */
export async function completarTrabajo(idTrabajo, uidTrabajador) {
    const trabajoRef = doc(db, "trabajos", idTrabajo);

    // 1. Obtener datos del trabajo para saber su categoría y recompensas
    const trabajoSnap = await getDoc(trabajoRef);
    let idCategoria = "otros";
    let xpRecompensa = 0;

    if (trabajoSnap.exists()) {
        const data = trabajoSnap.data();
        idCategoria = data.id_categoria || data.categoria || "otros";
        xpRecompensa = data.xp_otorgada || Math.round((data.pago_cliente || 0) * 10);
    }

    // 2. Cambiar el estado del trabajo a Completada y liberar retención
    await updateDoc(trabajoRef, {
        estado: "Completada",
        fecha_completada: serverTimestamp(),
        pago_retenido: false
    });

    // 3. Incrementar recompensas en el perfil del trabajador
    const trabajadorRef = doc(db, "usuarios", uidTrabajador);
    const trabajadorSnap = await getDoc(trabajadorRef);

    let pagoFinalTrabajador = (trabajoSnap.exists() ? trabajoSnap.data().pago_trabajador : 0) || (xpRecompensa / 10 * 0.9);

    // APLICAR VENTAJAS DE SUSCRIPCIÓN CURRANTE
    if (trabajadorSnap.exists()) {
        const tData = trabajadorSnap.data();
        if (tData.id_suscripcion_trabajador === "currante") {
            xpRecompensa *= 2; // x2 Experiencia
            // 5% comisión (el trabajador recibe el 95% del pago_cliente)
            if (trabajoSnap.exists()) {
                pagoFinalTrabajador = trabajoSnap.data().pago_cliente * 0.95;
            }
        }
    }

    const updateTrabajador = {
        tareas_realizadas: increment(1),
        experiencia_total: increment(xpRecompensa),
        saldo: increment(pagoFinalTrabajador),
        dinero_ganado_total: increment(pagoFinalTrabajador)
    };

    // Lógica de niveles
    if (trabajadorSnap.exists()) {
        const tData = trabajadorSnap.data();
        let oldLvl = tData.nivel || 1;
        let currentLvl = tData.nivel || 1;
        let currentXP = tData.experiencia_nivel_actual || 0;
        let newXP = currentXP + xpRecompensa;
        let maxXP = 50 * (currentLvl + 1);

        while (newXP >= maxXP) {
            newXP -= maxXP;
            currentLvl++;
            maxXP = 50 * (currentLvl + 1);
        }
        updateTrabajador.nivel = currentLvl;
        updateTrabajador.experiencia_nivel_actual = newXP;

        if (currentLvl > oldLvl) {
            await crearNotificacion(uidTrabajador, "¡Subida de Nivel!", `¡Enhorabuena! Has alcanzado el nivel ${currentLvl}.`, "nivel");
        }
    }

    await updateDoc(trabajadorRef, updateTrabajador);

    // Notificación de completada y pago
    const tituloTarea = trabajoSnap.exists() ? trabajoSnap.data().titulo : "Trabajo";
    await crearNotificacion(uidTrabajador, "Trabajo Completado", `Has finalizado "${tituloTarea}".`, "aceptado");
    await crearNotificacion(uidTrabajador, "Pago Recibido", `Has recibido ${Number(pagoFinalTrabajador).toFixed(2)}€ por "${tituloTarea}".`, "pago");

    // Lógica simple de nivel (opcional, si queremos que se guarde en DB)
    if (trabajadorSnap.exists()) {
        const tData = trabajadorSnap.data();
        let oldLvl = tData.nivel || 1;
        let currentLvl = tData.nivel || 1;
        let currentXP = tData.experiencia_nivel_actual || 0;
        let newXP = currentXP + xpRecompensa;
        let maxXP = 50 * (currentLvl + 1);

        while (newXP >= maxXP) {
            newXP -= maxXP;
            currentLvl++;
            maxXP = 50 * (currentLvl + 1);
        }

        if (currentLvl > oldLvl) {
            await crearNotificacion(uidTrabajador, "¡Subida de Nivel!", `¡Enhorabuena! Has alcanzado el nivel ${currentLvl}.`, "nivel");
        }
    }

    // 4. Sumar 1 punto a la categoría correspondiente
    await sumarPuntosCategoria(uidTrabajador, idCategoria, 1);

    // 5. Registrar pagos en el historial
    // Al publicador (empleador) YA se le descontó al aceptar la postulación (Escrow),
    // así que NO lo volvemos a hacer aquí. Solo registramos la confirmación si queremos,
    // pero para evitar saldos duplicados negativos, omitimos la deducción de saldo extra.

    // Al trabajador le sale positivo
    const titulo = data.titulo || "Trabajo";
    await registrarPagoHistorial(uidTrabajador, "Saldo LaburApp", Math.abs(pagoT), `Cobro por trabajo: ${titulo}`);

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

    // 1. Obtener título del trabajo para persistencia
    let tituloTrabajo = "Trabajo";
    try {
        const trabajoRef = doc(db, "trabajos", idTrabajo);
        const trabajoSnap = await getDoc(trabajoRef);
        if (trabajoSnap.exists()) {
            tituloTrabajo = trabajoSnap.data().titulo;
        }
    } catch (e) { console.error("Error al obtener título para valoración:", e); }

    // 2. Guardar la valoración en la subcolección
    await addDoc(collection(db, "usuarios", uidReceptor, "valoraciones_recibidas"), {
        puntuacion: puntuacion,
        comentario: comentario || "",
        fecha: serverTimestamp(),
        id_trabajo: idTrabajo,
        titulo_trabajo: tituloTrabajo, // Denormalización para persistencia
        id_usuario_emisor: user.uid
    });

    // Notificar al receptor
    await crearNotificacion(uidReceptor, "¡Nueva Valoración!", `Has recibido una valoración de ${puntuacion} estrellas.`, "valoracion");

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
 * --- SISTEMA DE NOTIFICACIONES ---
 */

export async function crearNotificacion(uid, titulo, mensaje, tipo = "info", metadata = {}) {
    try {
        const notifRef = collection(db, "usuarios", uid, "notificaciones");

        // Regla: Solo una notificación de mensaje sin leer por chat
        if (tipo === "mensaje" && metadata.id_chat) {
            const q = query(
                notifRef,
                where("tipo", "==", "mensaje"),
                where("id_chat", "==", metadata.id_chat),
                where("leida", "==", false)
            );
            const existing = await getDocs(q);
            if (!existing.empty) {
                // Actualizar la existente con el nuevo mensaje y fecha para que suba en la lista
                const docId = existing.docs[0].id;
                await updateDoc(doc(db, "usuarios", uid, "notificaciones", docId), {
                    mensaje,
                    fecha: serverTimestamp(),
                    ...metadata
                });
                return;
            }
        }

        await addDoc(notifRef, {
            titulo,
            mensaje,
            tipo,
            leida: false,
            fecha: serverTimestamp(),
            ...metadata
        });
    } catch (e) {
        console.error("Error creando notificación:", e);
    }
}

export async function obtenerNotificaciones(uid) {
    const q = query(
        collection(db, "usuarios", uid, "notificaciones"),
        orderBy("fecha", "desc"),
        limit(20)
    );
    const snap = await getDocs(q);
    const notifs = [];
    snap.forEach(doc => {
        notifs.push({ id: doc.id, ...doc.data() });
    });
    return notifs;
}

export async function marcarNotificacionesComoLeidas(uid) {
    const q = query(collection(db, "usuarios", uid, "notificaciones"), where("leida", "==", false));
    const snap = await getDocs(q);
    const batch = [];
    snap.forEach(docSnap => {
        batch.push(updateDoc(docSnap.ref, { leida: true }));
    });
    await Promise.all(batch);
}

export async function eliminarNotificacion(uid, notifId) {
    await deleteDoc(doc(db, "usuarios", uid, "notificaciones", notifId));
}

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

        // Buscar título del trabajo valorado (con fallback al persistido)
        if (!v.titulo_trabajo && v.id_trabajo) {
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

/**
 * Verifica si un usuario tiene al menos un método de pago registrado.
 * @param {string} uid - UID del usuario.
 * @returns {Promise<boolean>} - True si tiene métodos de pago, false en caso contrario.
 */
export async function usuarioTieneMetodoPago(uid) {
    const q = query(collection(db, "usuarios", uid, "metodos_pago"), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

export async function registrarPagoHistorial(uid, idMetodo, monto, detallePago = 'Transacción de LaburApp') {
    await addDoc(collection(db, "usuarios", uid, "historial_pagos"), {
        monto: monto,
        id_metodo: idMetodo,
        detalle_pago: detallePago,
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

// --- 7. CHAT (Centralizado en la colección 'chats') ---

/**
 * Genera un ID único para un chat.
 * Si hay trabajo, el ID depende de los usuarios Y del trabajo.
 * Si es directo, solo depende de los dos usuarios (ordenados alfabéticamente).
 */
export function generarIdChat(uid1, uid2, idTrabajo = null) {
    const sortedUsers = [uid1, uid2].sort().join("_");
    if (idTrabajo) {
        return `${sortedUsers}_job_${idTrabajo}`;
    }
    return sortedUsers;
}

/**
 * Registra o actualiza una conversación en la subcolección del usuario
 * para que sepa qué chats tiene activos.
 */
export async function registrarConversacionActiva(uidActor, uidOtro, idChat, idTrabajo = null) {
    const convRef = doc(db, "usuarios", uidActor, "conversaciones", idChat);
    await setDoc(convRef, {
        id_chat: idChat,
        id_otro_usuario: uidOtro,
        id_trabajo: idTrabajo,
        tipo: idTrabajo ? 'trabajo' : 'directo',
        ultima_actualizacion: serverTimestamp()
    }, { merge: true });
}

/**
 * Elimina la referencia de una conversación en la subcolección del usuario.
 * Esto "oculta" el chat en mensajes.html sin borrar los mensajes reales.
 */
export async function eliminarReferenciaConversacion(uid, idChat) {
    const convRef = doc(db, "usuarios", uid, "conversaciones", idChat);
    await deleteDoc(convRef);
}

export async function enviarMensajeTrabajo(idTrabajo, texto, tipo = "texto", idReceptorOverride = null) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");

    const trabajo = await obtenerTrabajoPorId(idTrabajo);
    if (!trabajo) throw new Error("Trabajo no encontrado.");

    let idReceptor = idReceptorOverride;

    if (!idReceptor) {
        idReceptor = (user.uid === trabajo.id_publicador) ? trabajo.id_trabajador : trabajo.id_publicador;
    }

    if (!idReceptor) {
        throw new Error("No hay un destinatario asignado para este trabajo.");
    }

    const idChat = generarIdChat(user.uid, idReceptor, idTrabajo);

    // 1. Guardar mensaje en colección centralizada
    const mensajesRef = collection(db, "chats", idChat, "mensajes");
    await addDoc(mensajesRef, {
        contenido: texto,
        leido: false,
        tipo_contenido: tipo,
        id_emisor: user.uid,
        id_receptor: idReceptor,
        fecha_envio: serverTimestamp()
    });

    // 2. Registrar/Actualizar conversación activa para ambos
    await registrarConversacionActiva(user.uid, idReceptor, idChat, idTrabajo);
    await registrarConversacionActiva(idReceptor, user.uid, idChat, idTrabajo);

    // 3. Notificar al receptor (Deduplicado por id_chat)
    await crearNotificacion(idReceptor, "Nuevo Mensaje", `Has recibido un nuevo mensaje.`, "mensaje", { id_chat: idChat });
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

// --- 8. CHAT DIRECTO ---

export async function enviarMensajeDirecto(uidOtro, texto, tipo = "texto") {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");

    const idChat = generarIdChat(user.uid, uidOtro);

    // 1. Guardar mensaje en colección centralizada
    const mensajesRef = collection(db, "chats", idChat, "mensajes");
    await addDoc(mensajesRef, {
        contenido: texto,
        leido: false,
        tipo_contenido: tipo,
        id_emisor: user.uid,
        id_receptor: uidOtro,
        fecha_envio: serverTimestamp()
    });

    // 2. Actualizar metadatos de conversación para ambos
    await registrarConversacionActiva(user.uid, uidOtro, idChat, null);
    await registrarConversacionActiva(uidOtro, user.uid, idChat, null);

    // 3. Notificar al receptor (Deduplicado por id_chat)
    await crearNotificacion(uidOtro, "Nuevo Mensaje", "Has recibido un nuevo mensaje directo.", "mensaje", { id_chat: idChat });
}

// --- 9. OBTENER CONVERSACIONES ---

/**
 * Obtiene todas las conversaciones (directas y de trabajo) del usuario.
 * Lee la subcolección usuarios/{uid}/conversaciones.
 */
export async function obtenerTodasLasConversaciones(uid) {
    const q = query(collection(db, "usuarios", uid, "conversaciones"), orderBy("ultima_actualizacion", "desc"));
    const snapshot = await getDocs(q);
    const chats = [];
    snapshot.forEach(docSnap => {
        chats.push(docSnap.data());
    });
    return chats;
}

/**
 * Comprueba si hay mensajes no leídos dirigidos al usuario (uid) en una colección de mensajes.
 * @param {CollectionReference} mensajesRef - referencia a la subcolección de mensajes
 * @param {string} uid - UID del usuario actual (receptor)
 */
export async function tieneNoLeidosEnChat(mensajesRef, uid) {
    const q = query(mensajesRef, where("leido", "==", false), where("id_receptor", "==", uid), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
}

/**
 * Devuelve el último mensaje de una colección de mensajes.
 */
export async function obtenerUltimoMensaje(mensajesRef) {
    const q = query(mensajesRef, orderBy("fecha_envio", "desc"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Registra una denuncia contra un usuario.
 * @param {string} idUsuarioReportado - UID del usuario que está siendo denunciado.
 * @param {string} motivo - Comentario explicando el motivo del reporte.
 */
export async function enviarDenuncia(idUsuarioReportado, motivo) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");

    await addDoc(collection(db, "denuncias"), {
        id_usuario_reportado: idUsuarioReportado,
        id_usuario_denunciante: user.uid,
        motivo: motivo,
        fecha: serverTimestamp()
    });

    return true;
}

/**
 * Elimina por completo un chat de trabajo y sus referencias.
 */
export async function eliminarChatDeTrabajo(idTrabajo, uidPublicador, uidTrabajador) {
    if (!uidPublicador || !uidTrabajador) return;

    const idChat = generarIdChat(uidPublicador, uidTrabajador, idTrabajo);

    // 1. Borrar mensajes del chat
    const mensajesRef = collection(db, "chats", idChat, "mensajes");
    const snapshotMensajes = await getDocs(mensajesRef);
    for (const docMsg of snapshotMensajes.docs) {
        await deleteDoc(docMsg.ref);
    }

    // 2. Borrar documento del chat
    await deleteDoc(doc(db, "chats", idChat));

    // 3. Borrar referencias en las conversaciones de los usuarios
    await deleteDoc(doc(db, "usuarios", uidPublicador, "conversaciones", idChat));
    await deleteDoc(doc(db, "usuarios", uidTrabajador, "conversaciones", idChat));
}

/**
 * Gestiona el borrado de una tarea. Si ambos la borran, se elimina de la DB y limpia chats.
 */
export async function gestionarBorradoTarea(idTrabajo, rol) {
    const trabajoRef = doc(db, "trabajos", idTrabajo);
    const snap = await getDoc(trabajoRef);

    if (!snap.exists()) return;
    const tarea = snap.data();

    const yaBorradaPorOtro = (rol === 'publicador') ? tarea.borrado_por_trabajador : tarea.borrado_por_publicador;

    // --- REGLAS DE BORRADO PERMANENTE ---
    // 1. Si ya la borró el otro O no tenía trabajador asignado, podríamos borrar...
    // 2. PERO solo si se cumplen las condiciones de seguridad (7 días):

    const ahora = new Date();
    const fechaPub = (tarea.fecha_publicacion?.toDate ? tarea.fecha_publicacion.toDate() : (tarea.fecha_publicacion ? new Date(tarea.fecha_publicacion) : ahora));
    const fechaLim = (tarea.fecha_limite?.toDate ? tarea.fecha_limite.toDate() : (tarea.fecha_limite ? new Date(tarea.fecha_limite) : null));

    const diffPubDias = (ahora - fechaPub) / (1000 * 60 * 60 * 24);
    const diffLimDias = fechaLim ? (ahora - fechaLim) / (1000 * 60 * 60 * 24) : -1;

    const esElegibleParaPermanente =
        (tarea.estado === 'Pendiente' && diffPubDias > 7) || // Pendiente + 7 días
        (diffLimDias > 7) ||                                // > 7 días después de fecha límite
        (tarea.estado === 'Completada');                      // Historial completado (se puede borrar si ambos quieren)

    const condicionUsuarios = (yaBorradaPorOtro === true || !tarea.id_trabajador);

    if (condicionUsuarios && esElegibleParaPermanente) {
        // Notificar al otro si todavía existe y no la ha borrado
        if (!yaBorradaPorOtro && tarea.id_trabajador) {
            const targetUid = (rol === 'publicador') ? tarea.id_trabajador : tarea.id_publicador;
            const msg = (rol === 'publicador') ? `El publicador ha eliminado el trabajo "${tarea.titulo}".` : `El trabajador ha eliminado de su lista el trabajo "${tarea.titulo}".`;
            await crearNotificacion(targetUid, "Trabajo Eliminado", msg, "rechazado");
        }

        // Borrado permanente de chats y postulaciones
        await eliminarChatDeTrabajo(idTrabajo, tarea.id_publicador, tarea.id_trabajador);

        const postsRef = collection(db, "trabajos", idTrabajo, "postulaciones");
        const snapshotPosts = await getDocs(postsRef);
        for (const docPost of snapshotPosts.docs) {
            const uidPostulante = docPost.id;
            // Notificar que la postulación ha sido cancelada porque el trabajo se eliminó
            await crearNotificacion(
                uidPostulante,
                "Postulación Cancelada",
                `El trabajo "${tarea.titulo}" ha sido eliminado y tu postulación ha sido cancelada.`,
                "info"
            );
            await deleteDoc(docPost.ref);
        }

        await deleteDoc(trabajoRef);
        return { permanent: true };
    } else {
        // --- 1. Reembolso si el trabajador abandona ---
        if (rol === 'trabajador' && tarea.pago_retenido === true) {
            const monto = Number(tarea.pago_cliente || 0);
            const publicadorRef = doc(db, "usuarios", tarea.id_publicador);
            await updateDoc(publicadorRef, { saldo: increment(monto) });
            await registrarPagoHistorial(tarea.id_publicador, "Saldo LaburApp", monto, `Reembolso por abandono: ${tarea.titulo}`);
            await updateDoc(trabajoRef, { pago_retenido: false });
        }

        // --- 2. Simplemente ocultar (marcar borrado) ---
        const updateData = {};
        if (rol === 'publicador') updateData.borrado_por_publicador = true;
        else updateData.borrado_por_trabajador = true;

        await updateDoc(trabajoRef, updateData);
        return { permanent: false };
    }
}
