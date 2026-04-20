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
    increment,
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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

export async function actualizarSuscripcionUsuario(uid, tipo, idSuscripcion) {
    const docRef = doc(db, "usuarios", uid);
    const campoId = tipo === 'trabajador' ? 'id_suscripcion_trabajador' : 'id_suscripcion_cliente';
    const campoVencimiento = tipo === 'trabajador' ? 'fecha_vencimiento_trabajador' : 'fecha_vencimiento_cliente';
    const campoRenovacion = tipo === 'trabajador' ? 'renovacion_automatica_trabajador' : 'renovacion_automatica_cliente';

    const hoy = new Date();
    const proximoMes = new Date();
    proximoMes.setMonth(hoy.getMonth() + 1);

    const updateData = {};
    updateData[campoId] = idSuscripcion;
    updateData[campoVencimiento] = proximoMes;
    updateData[campoRenovacion] = true;

    await updateDoc(docRef, updateData);

    await actualizarActividadSuscripcion(uid).catch(console.error);

    await crearNotificacion(uid, "Nueva suscripción adquirida", `Tu suscripción de ${tipo} ahora es "${idSuscripcion}". Tu próximo cobro será el ${proximoMes.toLocaleDateString()}.`, "suscripcion");

    return true;
}

export async function cancelarSuscripcionUsuario(uid, tipo) {
    const docRef = doc(db, "usuarios", uid);
    const campoRenovacion = tipo === 'trabajador' ? 'renovacion_automatica_trabajador' : 'renovacion_automatica_cliente';
    const campoVencimiento = tipo === 'trabajador' ? 'fecha_vencimiento_trabajador' : 'fecha_vencimiento_cliente';

    const userSnap = await getDoc(docRef);
    if (!userSnap.exists()) return false;
    const data = userSnap.data();
    const fechaVencimiento = data[campoVencimiento]?.toDate ? data[campoVencimiento].toDate() : null;

    const updateData = {};
    updateData[campoRenovacion] = false;

    await updateDoc(docRef, updateData);

    const fechaStr = fechaVencimiento ? fechaVencimiento.toLocaleDateString() : 'el fin del periodo pagado';
    await crearNotificacion(uid, "Renovación Cancelada", `Has cancelado la renovación automática de tu suscripción de ${tipo}. Seguirás disfrutando de los beneficios hasta el ${fechaStr}.`, "info");

    return true;
}

export async function actualizarActividadSuscripcion(uid) {
    const userRef = doc(db, "usuarios", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const esJefe = data.id_suscripcion_cliente === "jefe";
    const esCurrante = data.id_suscripcion_trabajador === "currante";
    const now = serverTimestamp();
    const updates = {
        ultimo_login: now
    };

    if (esJefe || esCurrante) {
        updates.ultimo_login_suscrito = now;
    } else if (data.ultimo_login_suscrito) {
       
        updates.ultimo_login_suscrito = 0;
    }

    if (esJefe) {
       
        const q = query(
            collection(db, "trabajos"),
            where("id_publicador", "==", uid),
            where("estado", "==", "Pendiente"),
            where("es_tarea_premium", "==", true)
        );
        const jobsSnap = await getDocs(q);
        jobsSnap.forEach(async (jobDoc) => {
            await updateDoc(doc(db, "trabajos", jobDoc.id), {
                prioridad_suscripcion: now
            });
        });
    } else {
       
        const q = query(
            collection(db, "trabajos"),
            where("id_publicador", "==", uid),
            where("estado", "==", "Pendiente")
        );
        const jobsSnap = await getDocs(q);
        jobsSnap.forEach(async (jobDoc) => {
            await updateDoc(doc(db, "trabajos", jobDoc.id), {
                prioridad_suscripcion: 0
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

    const perfil = await obtenerPerfilUsuario(user.uid);
    const esJefe = perfil && perfil.id_suscripcion_cliente === 'jefe';

    const pagoCliente = Number(datosTrabajo.pagoCliente);
   
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
        fecha_actividad: serverTimestamp(),
       
        fecha_limite: datosTrabajo.fecha_limite,
        tiempo_estimado_horas: datosTrabajo.tiempo_estimado_horas || null,
        estado: "Pendiente",
        pago_cliente: pagoCliente,
        pago_trabajador: pagoTrabajador,
        xp_otorgada: xpOtorgada,
        id_categoria: datosTrabajo.id_categoria,
        id_publicador: user.uid,
        id_trabajador: null,
        prioridad_suscripcion: esJefe ? serverTimestamp() : 0,
        es_tarea_premium: esJefe ? true : false
    });

    return docRef.id;
}

export async function obtenerTrabajoPorId(idTrabajo) {
    const docRef = doc(db, "trabajos", idTrabajo);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

/* --- *
 * ACTUALIZA UN TRABAJO EN FIRESTORE. CENTRALIZA LA LÓGICA DE NEGOCIO
 * COMO EL RECÁLCULO DE XP Y PAGO AL TRABAJADOR SI CAMBIA EL PAGO DEL CLIENTE. --- */
export async function actualizarTrabajo(idTrabajo, datosNuevos) {
    const docRef = doc(db, "trabajos", idTrabajo);

   // --- LÓGICA DE NEGOCIO SI SE CAMBIA EL PAGO ---
    if (datosNuevos.pago_cliente !== undefined) {
        const pagoC = Number(datosNuevos.pago_cliente);
        datosNuevos.pago_trabajador = pagoC * 0.90;
        datosNuevos.xp_otorgada = Math.round(pagoC * 10);
    }

    if (datosNuevos.estado === "En curso") {
        datosNuevos.fecha_inicio = serverTimestamp();
        const trabajo = await obtenerTrabajoPorId(idTrabajo);
        if (trabajo && trabajo.id_publicador) {
            await crearNotificacion(trabajo.id_publicador, "Tarea en Curso", `El trabajador ha empezado el trabajo "${trabajo.titulo}".`, "tarea_empezada", { id_trabajo: idTrabajo });
        }
    }

    datosNuevos.fecha_actividad = serverTimestamp();

    await updateDoc(docRef, datosNuevos);
    return true;
}

export async function obtenerTrabajos(idCategoria = "todas") {
    let q;
    if (idCategoria && idCategoria !== "todas") {
       
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

export async function postularseATrabajo(idTrabajo) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");

    const postulacionRef = doc(db, "trabajos", idTrabajo, "postulaciones", user.uid);
    await setDoc(postulacionRef, {
        estado_postulacion: "Pendiente",
        fecha_postulacion: serverTimestamp()
    });

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

export async function obtenerMisPostulaciones(uid) {

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

export async function obtenerPostulacionesParaMisTareas(uid) {
    const misTrabajos = await obtenerTrabajosPublicadosPorMi(uid);
   
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

    const pagoC = Number(trabajo.pago_cliente || 0);
    await updateDoc(trabajoRef, {
        id_trabajador: uidTrabajador,
        estado: "Aceptada",
        pago_retenido: true,
        fecha_aceptacion: serverTimestamp(),
        fecha_actividad: serverTimestamp()
    });

    const publicadorRef = doc(db, "usuarios", trabajo.id_publicador);
    await updateDoc(publicadorRef, {
        saldo: increment(-pagoC)
    });

    await registrarPagoHistorial(trabajo.id_publicador, "Saldo LaburApp", -pagoC, `Retención por tarea: ${trabajo.titulo}`);

    const postRef = doc(db, "trabajos", idTrabajo, "postulaciones", uidTrabajador);
    await updateDoc(postRef, {
        estado_postulacion: "Aceptada"
    });

    await crearNotificacion(uidTrabajador, "¡Postulación Aceptada!", `Has sido aceptado para el trabajo "${trabajo.titulo}".`, "aceptado", { id_trabajo: idTrabajo });
    await crearNotificacion(uidTrabajador, "Nuevo Trabajo", `Tienes un nuevo trabajo asignado: "${trabajo.titulo}".`, "nuevo_trabajo", { id_trabajo: idTrabajo });

    const postulaciones = await obtenerPostulacionesDeUnTrabajo(idTrabajo);
    for (const post of postulaciones) {
        if (post.id_usuario !== uidTrabajador) {

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
        estado_postulacion: "Rechazada",
        fecha_actividad: serverTimestamp()
    });

    if (trabajo) {
        await crearNotificacion(uidTrabajador, "Postulación Rechazada", `Tu postulación para "${trabajo.titulo}" ha sido rechazada.`, "rechazado");
    }
    return true;
}

export async function completarTrabajo(idTrabajo, uidTrabajador) {
    const trabajoRef = doc(db, "trabajos", idTrabajo);

    const trabajoSnap = await getDoc(trabajoRef);
    let idCategoria = "otros";
    let xpRecompensa = 0;
    let tituloTrabajo = "Trabajo";

    if (trabajoSnap.exists()) {
        const data = trabajoSnap.data();
        idCategoria = data.id_categoria || data.categoria || "otros";
        xpRecompensa = data.xp_otorgada || Math.round((data.pago_cliente || 0) * 10);
        tituloTrabajo = data.titulo || "Trabajo";
    }

    await updateDoc(trabajoRef, {
        estado: "Completada",
        fecha_completada: serverTimestamp(),
        fecha_actividad: serverTimestamp(),
        pago_retenido: false
    });

    const trabajadorRef = doc(db, "usuarios", uidTrabajador);
    const trabajadorSnap = await getDoc(trabajadorRef);

    let pagoFinalTrabajador = (trabajoSnap.exists() ? trabajoSnap.data().pago_trabajador : 0) || (xpRecompensa / 10 * 0.9);

   // --- APLICAR VENTAJAS DE SUSCRIPCIÓN CURRANTE ---
    if (trabajadorSnap.exists()) {
        const tData = trabajadorSnap.data();
        if (tData.id_suscripcion_trabajador === "currante") {
            xpRecompensa *= 2;
           
            if (trabajoSnap.exists()) {
                pagoFinalTrabajador = trabajoSnap.data().pago_cliente * 0.95;
            }
        }
    }

    await aplicarXPTrabajador(uidTrabajador, xpRecompensa, idCategoria);

    if (idCategoria && idCategoria !== "ninguna") {
        await sumarPuntosCategoria(uidTrabajador, idCategoria, 1);
    }

    await updateDoc(trabajadorRef, {
        tareas_realizadas: increment(1),
        saldo: increment(pagoFinalTrabajador),
        dinero_ganado_total: increment(pagoFinalTrabajador)
    });

    await crearNotificacion(uidTrabajador, "Trabajo Completado", `Has finalizado "${tituloTrabajo}".`, "aceptado");
    await crearNotificacion(uidTrabajador, "Pago Recibido", `Has recibido ${Number(pagoFinalTrabajador).toFixed(2)}€ por "${tituloTrabajo}".`, "pago");

    await registrarPagoHistorial(uidTrabajador, "Saldo LaburApp", Math.abs(pagoFinalTrabajador), `Cobro por trabajo: ${tituloTrabajo}`);

    return true;
}

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
        await updateDoc(docRef, { puntos: increment(puntosASumar) });
    } else {
        await setDoc(docRef, {
            puntos: puntosASumar,
            fecha_creacion: serverTimestamp()
        });
    }

    await recalcularEspecialidadPrincipal(uid);
}

export async function aplicarXPTrabajador(uid, xpDelta, idCategoria) {
    if (!uid || xpDelta === 0) return;

    const trabajadorRef = doc(db, "usuarios", uid);
    const trabajadorSnap = await getDoc(trabajadorRef);

    if (!trabajadorSnap.exists()) return;

    const tData = trabajadorSnap.data();
    let oldLvl = tData.nivel || 1;
    let currentLvl = tData.nivel || 1;
    let currentXP = tData.experiencia_nivel_actual || 0;

    let newXP = currentXP + xpDelta;
    let maxXP = 100 + (currentLvl - 1) * 50;

   // --- LÓGICA DE SUBIDA DE NIVEL ---
    while (newXP >= maxXP) {
        newXP -= maxXP;
        currentLvl++;
        maxXP = 100 + (currentLvl - 1) * 50;
    }

   // --- LÓGICA DE BAJADA DE NIVEL (OPCIONAL, PERO PARA EVITAR XP NEGATIVO EXCESIVO) ---
   
    while (newXP < 0 && currentLvl > 1) {
        currentLvl--;
        maxXP = 100 + (currentLvl - 1) * 50;
        newXP += maxXP;
    }

    if (newXP < 0) newXP = 0;

    const updateData = {
        experiencia_total: increment(xpDelta),
        nivel: currentLvl,
        experiencia_nivel_actual: newXP
    };

    await updateDoc(trabajadorRef, updateData);

    if (currentLvl > oldLvl) {
        await crearNotificacion(uid, "¡Subida de Nivel!", `¡Enhorabuena! Has alcanzado el nivel ${currentLvl}.`, "nivel");
    }
}

export async function recalcularEspecialidadPrincipal(uid) {
    try {
        const ptsCat = await obtenerTodosPuntosCategorias(uid);
        if (ptsCat.length === 0) return;

        const catDocs = [];
        const q = query(collection(db, "usuarios", uid, "puntuaciones_categorias"));
        const snapshot = await getDocs(q);

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            catDocs.push({
                id_categoria: docSnap.id,
                puntos: data.puntos || 0,
                fecha_creacion: data.fecha_creacion?.toDate ? data.fecha_creacion.toDate() : (data.fecha_creacion || 0)
            });
        });

        if (catDocs.length === 0) return;

        catDocs.sort((a, b) => {
            if (b.puntos !== a.puntos) {
                return b.puntos - a.puntos;
            }
            return a.fecha_creacion - b.fecha_creacion;
        });

        const mejorCat = catDocs[0];

        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, {
            especialidad_principal: mejorCat.id_categoria,
            puntos_especialidad: mejorCat.puntos
        });

    } catch (e) {
        console.error("Error recalculando especialidad principal:", e);
    }
}

export async function dejarValoracion(uidReceptor, idTrabajo, puntuacion, comentario) {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión.");
    if (puntuacion < 1 || puntuacion > 5) throw new Error("Puntuación inválida.");

    let tituloTrabajo = "Trabajo";
    try {
        const trabajoRef = doc(db, "trabajos", idTrabajo);
        const trabajoSnap = await getDoc(trabajoRef);
        if (trabajoSnap.exists()) {
            tituloTrabajo = trabajoSnap.data().titulo;
        }
    } catch (e) { console.error("Error al obtener título para valoración:", e); }

    await addDoc(collection(db, "usuarios", uidReceptor, "valoraciones_recibidas"), {
        puntuacion: puntuacion,
        comentario: comentario || "",
        fecha: serverTimestamp(),
        id_trabajo: idTrabajo,
        titulo_trabajo: tituloTrabajo,
        id_usuario_emisor: user.uid
    });

    await crearNotificacion(uidReceptor, "¡Nueva Valoración!", `Has recibido una valoración de ${puntuacion} estrellas.`, "valoracion");

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

    try {
        const trabajoRef = doc(db, "trabajos", idTrabajo);
        const trabajoSnap = await getDoc(trabajoRef);

        if (trabajoSnap.exists()) {
            const tData = trabajoSnap.data();

            if (tData.id_trabajador === uidReceptor && !tData.xp_ajustado_por_valoracion) {
                const xpBase = tData.xp_otorgada || 0;

                const multiMap = {
                    1: -0.2,
                    2: -0.1,
                    3: 0,
                    4: 0.1,
                    5: 0.2
                };

                const deltaMod = multiMap[puntuacion] || 0;
                const xpDelta = Math.round(xpBase * deltaMod);

                if (xpDelta !== 0) {
                    const idCat = tData.id_categoria || tData.categoria || "otros";
                    await aplicarXPTrabajador(uidReceptor, xpDelta, idCat);
                }

                await updateDoc(trabajoRef, { xp_ajustado_por_valoracion: true });
            }
        }
    } catch (e) {
        console.error("Error aplicando escalado de XP por valoración:", e);
    }

    return true;
}

/* --- *
 * --- SISTEMA DE NOTIFICACIONES --- */

export async function crearNotificacion(uid, titulo, mensaje, tipo = "info", metadata = {}) {
    try {
        const notifRef = collection(db, "usuarios", uid, "notificaciones");

        if (tipo === "mensaje" && metadata.id_chat) {
            const q = query(
                notifRef,
                where("tipo", "==", "mensaje"),
                where("id_chat", "==", metadata.id_chat),
                where("leida", "==", false)
            );
            const existing = await getDocs(q);
            if (!existing.empty) {
               
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

        if (v.id_usuario_emisor) {
            try {
                const emisorRef = doc(db, "usuarios", v.id_usuario_emisor);
                const emisorSnap = await getDoc(emisorRef);
                if (emisorSnap.exists()) {
                    const e = emisorSnap.data();
                    v.emisor_nombre = e.nombre_completo || ((e.nombre || '') + ' ' + (e.apellidos || '')).trim();
                    v.emisor_foto = e.foto_perfil || null;
                }
            } catch (_) {  }
        }

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
// --- 6. MÉTODOS Y E HISTORIAL DE PAGO (SUBCOLECCIONES USUARIO) ---

export async function agregarMetodoPago(uid, tipo, detalle) {
   
    const metodosExistentes = await obtenerMetodosPago(uid);
    const esFavorito = metodosExistentes.length === 0;

    const docRef = await addDoc(collection(db, "usuarios", uid, "metodos_pago"), {
        tipo: tipo,
        detalle: detalle,
        favorito: esFavorito
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

export async function eliminarMetodoPago(uid, idMetodo) {
    const metodos = await obtenerMetodosPago(uid);
    if (metodos.length <= 1) {
        throw new Error("No puedes eliminar tu único método de pago.");
    }

    const metodoAEliminar = metodos.find(m => m.id_metodo === idMetodo);
    const eraFavorito = metodoAEliminar?.favorito === true;

    await deleteDoc(doc(db, "usuarios", uid, "metodos_pago", idMetodo));

    if (eraFavorito) {
        const restantes = metodos.filter(m => m.id_metodo !== idMetodo);
        if (restantes.length > 0) {
            const nuevoFavoritoId = restantes[0].id_metodo;
            await updateDoc(doc(db, "usuarios", uid, "metodos_pago", nuevoFavoritoId), {
                favorito: true
            });
        }
    }
    return true;
}

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
   
    const q = query(collection(db, "usuarios", uid, "historial_pagos"), orderBy("fecha_emision", "desc"));
    const snapshot = await getDocs(q);
    const historial = [];
    snapshot.forEach((doc) => {
        historial.push({ id_pago: doc.id, ...doc.data() });
    });
    return historial;
}

export function generarIdChat(uid1, uid2, idTrabajo = null) {
    const sortedUsers = [uid1, uid2].sort().join("_");
    if (idTrabajo) {
        return `${sortedUsers}_job_${idTrabajo}`;
    }
    return sortedUsers;
}

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

    const mensajesRef = collection(db, "chats", idChat, "mensajes");
    await addDoc(mensajesRef, {
        contenido: texto,
        leido: false,
        tipo_contenido: tipo,
        id_emisor: user.uid,
        id_receptor: idReceptor,
        fecha_envio: serverTimestamp()
    });

    await registrarConversacionActiva(user.uid, idReceptor, idChat, idTrabajo);
    await registrarConversacionActiva(idReceptor, user.uid, idChat, idTrabajo);

    await crearNotificacion(idReceptor, "Nuevo Mensaje", `Has recibido un nuevo mensaje.`, "mensaje", { id_chat: idChat });
}

export async function obtenerConversacionesActivas(uid) {
   
    const qPub = query(collection(db, "trabajos"), where("id_publicador", "==", uid), where("id_trabajador", "!=", null));
    const snapPub = await getDocs(qPub);

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

    const mensajesRef = collection(db, "chats", idChat, "mensajes");
    await addDoc(mensajesRef, {
        contenido: texto,
        leido: false,
        tipo_contenido: tipo,
        id_emisor: user.uid,
        id_receptor: uidOtro,
        fecha_envio: serverTimestamp()
    });

    await registrarConversacionActiva(user.uid, uidOtro, idChat, null);
    await registrarConversacionActiva(uidOtro, user.uid, idChat, null);

    await crearNotificacion(uidOtro, "Nuevo Mensaje", "Has recibido un nuevo mensaje directo.", "mensaje", { id_chat: idChat });
}
// --- 9. OBTENER CONVERSACIONES ---

export async function obtenerTodasLasConversaciones(uid) {
    const q = query(collection(db, "usuarios", uid, "conversaciones"), orderBy("ultima_actualizacion", "desc"));
    const snapshot = await getDocs(q);
    const chats = [];
    snapshot.forEach(docSnap => {
        chats.push(docSnap.data());
    });
    return chats;
}

export async function tieneNoLeidosEnChat(mensajesRef, uid) {
    const q = query(mensajesRef, where("leido", "==", false), where("id_receptor", "==", uid), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
}

export async function obtenerUltimoMensaje(mensajesRef) {
    const q = query(mensajesRef, orderBy("fecha_envio", "desc"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

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

export async function eliminarChatDeTrabajo(idTrabajo, uidPublicador, uidTrabajador) {
    if (!uidPublicador || !uidTrabajador) return;

    const idChat = generarIdChat(uidPublicador, uidTrabajador, idTrabajo);

    const mensajesRef = collection(db, "chats", idChat, "mensajes");
    const snapshotMensajes = await getDocs(mensajesRef);
    for (const docMsg of snapshotMensajes.docs) {
        await deleteDoc(docMsg.ref);
    }

    await deleteDoc(doc(db, "chats", idChat));

    await deleteDoc(doc(db, "usuarios", uidPublicador, "conversaciones", idChat));
    await deleteDoc(doc(db, "usuarios", uidTrabajador, "conversaciones", idChat));
}

export async function gestionarBorradoTarea(idTrabajo, rol) {
    const trabajoRef = doc(db, "trabajos", idTrabajo);
    const snap = await getDoc(trabajoRef);

    if (!snap.exists()) return { permanent: true };
    const tarea = snap.data();

    const yaBorradaPorOtro = (rol === 'publicador') ? tarea.borrado_por_trabajador : tarea.borrado_por_publicador;

   // --- REEMBOLSO INMEDIATO SI EL TRABAJADOR ABANDONA/BORRA ---
    let pagoYaReembolsado = false;
    if (rol === 'trabajador' && tarea.pago_retenido === true) {
        try {
            const monto = Number(tarea.pago_cliente || 0);
            const publicadorRef = doc(db, "usuarios", tarea.id_publicador);
            await updateDoc(publicadorRef, { saldo: increment(monto) });
            await registrarPagoHistorial(tarea.id_publicador, "Saldo LaburApp", monto, `Reembolso por abandono de trabajador: ${tarea.titulo}`);
            await crearNotificacion(
                tarea.id_publicador,
                "Reembolso por Abandono",
                `El trabajador ha abandonado la tarea "${tarea.titulo}". Se te han devuelto ${monto.toFixed(2)}€ a tu saldo.`,
                "pago",
                { id_trabajo: idTrabajo }
            );
            pagoYaReembolsado = true;
        } catch (e) {
            console.error("Error en reembolso por abandono:", e);
        }
    }

   // --- REGLAS DE BORRADO PERMANENTE ---

    const ahora = new Date();
    const fechaPub = (tarea.fecha_publicacion?.toDate ? tarea.fecha_publicacion.toDate() : (tarea.fecha_publicacion ? new Date(tarea.fecha_publicacion) : ahora));
    const fechaLim = (tarea.fecha_limite?.toDate ? tarea.fecha_limite.toDate() : (tarea.fecha_limite ? new Date(tarea.fecha_limite) : null));

    const diffPubDias = (ahora - fechaPub) / (1000 * 60 * 60 * 24);
    const diffLimDias = fechaLim ? (ahora - fechaLim) / (1000 * 60 * 60 * 24) : -1;

    const esElegibleParaPermanente =
        (tarea.estado === 'Pendiente' && diffPubDias > 7) ||  
        (diffLimDias > 7) ||                                 
        (tarea.estado === 'Completada') ||                  
        (tarea.estado === 'Cancelada' && yaBorradaPorOtro); 

    const condicionUsuarios = (yaBorradaPorOtro === true || !tarea.id_trabajador);

    if (condicionUsuarios && esElegibleParaPermanente) {
       
        if (!yaBorradaPorOtro && tarea.id_trabajador) {
            const targetUid = (rol === 'publicador') ? tarea.id_trabajador : tarea.id_publicador;
            const msg = (rol === 'publicador') ? `El publicador ha eliminado el trabajo "${tarea.titulo}".` : `El trabajador ha eliminado de su lista el trabajo "${tarea.titulo}".`;
            await crearNotificacion(targetUid, "Trabajo Eliminado", msg, "rechazado");
        }

        await eliminarChatDeTrabajo(idTrabajo, tarea.id_publicador, tarea.id_trabajador);

        const postsRef = collection(db, "trabajos", idTrabajo, "postulaciones");
        const snapshotPosts = await getDocs(postsRef);
        for (const docPost of snapshotPosts.docs) {
            const uidPostulante = docPost.id;
           
            await crearNotificacion(
                uidPostulante,
                "Postulación Cancelada",
                `El trabajo "${tarea.titulo}" ha sido eliminado y tu postulación ha sido cancelada.`,
                "trabajo_cancelado"
            );
            await deleteDoc(docPost.ref);
        }

        await deleteDoc(trabajoRef);

       // --- NUEVO: REEMBOLSO AL PUBLICADOR AL BORRAR PERMANENTEMENTE ---
        if (tarea.pago_retenido === true && !pagoYaReembolsado) {
            try {
                const monto = Number(tarea.pago_cliente || 0);
                const publicadorRef = doc(db, "usuarios", tarea.id_publicador);
                await updateDoc(publicadorRef, { saldo: increment(monto) });
                await registrarPagoHistorial(tarea.id_publicador, "Saldo LaburApp", monto, `Reembolso por eliminación: ${tarea.titulo}`);
               
                await crearNotificacion(
                    tarea.id_publicador,
                    "Reembolso Recibido",
                    `Has recibido un reembolso de ${monto.toFixed(2)}€ por la eliminación de "${tarea.titulo}".`,
                    "pago",
                    { id_trabajo: idTrabajo }
                );
            } catch (e) {
                console.error("Error en reembolso final:", e);
            }
        }

        return { permanent: true };
    } else {
       // --- NUEVAS NOTIFICACIONES DE CANCELACIÓN/ABANDONO (NO PERMANENTE TODAVÍA) ---
        if (tarea.estado !== 'Completada' && tarea.estado !== 'Cancelada') {
            if (rol === 'publicador' && tarea.id_trabajador) {
                await crearNotificacion(
                    tarea.id_trabajador,
                    "Trabajo Cancelado",
                    `El publicador ha cancelado el trabajo "${tarea.titulo}".`,
                    "rechazado"
                );
            } else if (rol === 'trabajador') {
                await crearNotificacion(
                    tarea.id_publicador,
                    "Tarea Abandonada",
                    `El trabajador ha abandonado la tarea "${tarea.titulo}".`,
                    "tarea_abandonada",
                    { id_trabajo: idTrabajo }
                );
            }
        }

        const updateData = {};
        if (rol === 'publicador') updateData.borrado_por_publicador = true;
        else {
            updateData.borrado_por_trabajador = true;
            updateData.estado = "Cancelada";
           
            updateData.pago_retenido = false;
        }

        await updateDoc(trabajoRef, updateData);
        return { permanent: false };
    }
}

export async function eliminarCuentaUsuario() {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario autenticado.");

    const uid = user.uid;
    const storage = getStorage();

    try {
       
        const userRef = doc(db, "usuarios", uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
           
            await addDoc(collection(db, "usuarios_eliminados"), {
                uid: uid,
                nombre: data.nombre || "",
                apellidos: data.apellidos || "",
                dni: data.dni || "",
                fecha_eliminacion: serverTimestamp()
            });
        }

        const subcollections = ["notificaciones", "conversaciones", "metodos_pago", "historial_pagos", "valoraciones_recibidas", "puntuaciones_categorias"];
        for (const sub of subcollections) {
            const q = query(collection(db, "usuarios", uid, sub));
            const snap = await getDocs(q);
            const batchDeletes = [];
            snap.forEach(docSnap => {
                batchDeletes.push(deleteDoc(docSnap.ref));
            });
            await Promise.all(batchDeletes);
        }

        const qJobs = query(collection(db, "trabajos"), where("id_publicador", "==", uid));
        const jobsSnap = await getDocs(qJobs);
        for (const jobDoc of jobsSnap.docs) {
            const jobData = jobDoc.data();
            if (jobData.estado === "Pendiente") {
               
                await deleteDoc(jobDoc.ref);
            } else {
               
                await updateDoc(jobDoc.ref, { 
                    estado: "Cancelada", 
                    borrado_por_publicador: true,
                    nota_sistema: "Cuenta de publicador eliminada."
                });
            }
        }

        const qAllJobs = query(collection(db, "trabajos"), where("estado", "==", "Pendiente"));
        const allJobsSnap = await getDocs(qAllJobs);
        for (const jobDoc of allJobsSnap.docs) {
            const postRef = doc(db, "trabajos", jobDoc.id, "postulaciones", uid);
            const postSnap = await getDoc(postRef);
            if (postSnap.exists()) {
                await deleteDoc(postRef);
            }
        }

        const profilePicRef = ref(storage, `avatars/${uid}/profile.jpg`);
        await deleteObject(profilePicRef).catch(e => console.log("No había foto de perfil en storage para borrar o error ignorado."));

        await deleteDoc(userRef);

        await deleteUser(user);

        return true;
    } catch (error) {
        console.error("Error al eliminar cuenta integral:", error);
        throw error;
    }
}

export async function cancelarTrabajo(idTrabajo) {
    const trabajoRef = doc(db, "trabajos", idTrabajo);
    const snap = await getDoc(trabajoRef);
    if (!snap.exists()) return;
    const tarea = snap.data();

    const updateData = { estado: "Cancelada" };
    if (tarea.pago_retenido === true && tarea.estado !== "En curso") {
        updateData.pago_retenido = false;
        try {
            const monto = Number(tarea.pago_cliente || 0);
            const publicadorRef = doc(db, "usuarios", tarea.id_publicador);
            await updateDoc(publicadorRef, { saldo: increment(monto) });
            await registrarPagoHistorial(tarea.id_publicador, "Saldo LaburApp", monto, `Reembolso por tarea cancelada: ${tarea.titulo}`);

            await crearNotificacion(
                tarea.id_publicador,
                "Reembolso Recibido",
                `Has recibido un reembolso de ${monto.toFixed(2)}€ por la tarea cancelada "${tarea.titulo}".`,
                "pago",
                { id_trabajo: idTrabajo }
            );
        } catch (e) {
            console.error("Error en reembolso por cancelación:", e);
        }
    }

    updateData.fecha_actividad = serverTimestamp();

    await updateDoc(trabajoRef, updateData);

    if (tarea.id_trabajador) {
        await crearNotificacion(
            tarea.id_trabajador,
            "Trabajo Cancelado",
            `El publicador ha cancelado el trabajo "${tarea.titulo}".`,
            "trabajo_cancelado",
            { id_trabajo: idTrabajo }
        );
    }

    return true;
}

/* --- *
 * ==========================================
 * SISTEMA DE CONFIRMACIÓN DE TRABAJO
 * --- */

export async function obtenerTareasPendientesConfirmacion(uid) {
    const ahora = new Date();

    const q1 = query(collection(db, "trabajos"), where("id_publicador", "==", uid), where("estado", "in", ["Aceptada", "En curso"]));
    const q2 = query(collection(db, "trabajos"), where("id_trabajador", "==", uid), where("estado", "in", ["Aceptada", "En curso"]));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const tareas = [];
    const idsVistos = new Set();

    const procesarSnap = (snap, esPublicador) => {
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const fechaLim = data.fecha_limite?.toDate ? data.fecha_limite.toDate() : (data.fecha_limite ? new Date(data.fecha_limite) : null);

            if (fechaLim && fechaLim < ahora && !data.resolucion_finalizada) {
                const respuestaUsuario = esPublicador ? data.confirmacion_publicador : data.confirmacion_trabajador;

                if (!respuestaUsuario || respuestaUsuario === 'pendiente' || respuestaUsuario === 'espera') {
                    if (!idsVistos.has(docSnap.id)) {
                        idsVistos.add(docSnap.id);
                        tareas.push({ id: docSnap.id, ...data, es_publicador: esPublicador });
                    }
                }
            }
        });
    };

    procesarSnap(snap1, true);
    procesarSnap(snap2, false);

    return tareas;
}

export async function registrarRespuestaConfirmacion(idTarea, uid, respuesta) {
    const trabajoRef = doc(db, "trabajos", idTarea);
    const snap = await getDoc(trabajoRef);
    if (!snap.exists()) return;
    const tarea = snap.data();

    const esPublicador = tarea.id_publicador === uid;
    const updateData = {
        fecha_actividad: serverTimestamp()
    };

    if (esPublicador) {
        updateData.confirmacion_publicador = respuesta;
    } else {
        updateData.confirmacion_trabajador = respuesta;
    }

    if (!tarea.fecha_inicio_disputa) {
        updateData.fecha_inicio_disputa = serverTimestamp();
    }

    await updateDoc(trabajoRef, updateData);

    await ejecutarResolucionTarea(idTarea);
}

/* --- *
 * LÓGICA CENTRAL DE RESOLUCIÓN: DECIDE SI SE PAGA, SE REEMBOLSA O SE ENTRA EN DISPUTA. --- */
/* --- *
 * LÓGICA CENTRAL DE RESOLUCIÓN: DECIDE SI SE PAGA, SE REEMBOLSA O SE ENTRA EN DISPUTA. --- */
export async function ejecutarResolucionTarea(idTarea) {
    const trabajoRef = doc(db, "trabajos", idTarea);
    const snap = await getDoc(trabajoRef);
    if (!snap.exists()) return;
    const tarea = snap.data();

    if (tarea.resolucion_finalizada) return;

    const resP = tarea.confirmacion_publicador || 'pendiente';
    const resW = tarea.confirmacion_trabajador || 'pendiente';

    const ahora = new Date();
    const fechaLim = tarea.fecha_limite?.toDate ? tarea.fecha_limite.toDate() : (tarea.fecha_limite ? new Date(tarea.fecha_limite) : null);
    if (!fechaLim) return;
    const diasTranscurridos = (ahora - fechaLim) / (1000 * 60 * 60 * 24);

   // --- 1. ACUERDO O ACCIÓN INMEDIATA ---
   
    if (resW === 'no') {
        await reembolsarTrabajo(idTarea);
        await updateDoc(trabajoRef, { resolucion_finalizada: true, estado: 'Cancelada' });
        await eliminarTareaResolucion(idTarea);
        return;
    }

    if (resP === 'si' && resW === 'si') {
        await completarTrabajo(idTarea, tarea.id_trabajador);
        await updateDoc(trabajoRef, { resolucion_finalizada: true });
        await eliminarTareaResolucion(idTarea);
        return;
    }

    if (resP === 'no' && resW === 'no') {
        await reembolsarTrabajo(idTarea);
        await updateDoc(trabajoRef, { resolucion_finalizada: true, estado: 'Cancelada' });
        await eliminarTareaResolucion(idTarea);
        return;
    }

    if ((resP === 'si' && resW === 'no') || (resP === 'no' && resW === 'si')) {
        await updateDoc(trabajoRef, { estado: 'En disputa', resolucion_finalizada: true });
        const msg = `Hay discrepancias en la confirmación de "${tarea.titulo}". Se ha abierto una investigación manual.`;
        await crearNotificacion(tarea.id_publicador, "Investigación Abierta", msg, "info");
        await crearNotificacion(tarea.id_trabajador, "Investigación Abierta", msg, "info");
       
        return;
    }

   // --- 2. EXPIRACIÓN (7 DÍAS) ---
    if (diasTranscurridos >= 7) {
       
        if ((resP === 'si' || resP === 'no') && (resW === 'pendiente' || resW === 'espera')) {
           
            await reembolsarTrabajo(idTarea);
            await updateDoc(trabajoRef, { resolucion_finalizada: true, estado: 'Cancelada' });
            await eliminarTareaResolucion(idTarea);
        }
        else if ((resW === 'si') && (resP === 'pendiente' || resP === 'espera')) {
           
            await completarTrabajo(idTarea, tarea.id_trabajador);
            await updateDoc(trabajoRef, { resolucion_finalizada: true });
            await eliminarTareaResolucion(idTarea);
        }
        else {
           
            await reembolsarTrabajo(idTarea);
            await updateDoc(trabajoRef, { resolucion_finalizada: true, estado: 'Cancelada' });
            await eliminarTareaResolucion(idTarea);
        }
    }
}

export async function eliminarTareaResolucion(idTarea) {
    try {
        const docRef = doc(db, "trabajos", idTarea);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const data = snap.data();

        if (data.estado === "En disputa") {
            console.log("Abortando borrado: Tarea en disputa.");
            return;
        }

        if (data.resolucion_finalizada) {
            await deleteDoc(docRef);
            console.log(`Tarea ${idTarea} eliminada físicamente.`);
        }
    } catch (e) {
        console.error("Error al borrar tarea:", e);
    }
}

export async function reembolsarTrabajo(idTarea) {
    const trabajoRef = doc(db, "trabajos", idTarea);
    const snap = await getDoc(trabajoRef);
    if (!snap.exists()) return;
    const tarea = snap.data();

    if (tarea.pago_retenido === true) {
        const monto = Number(tarea.pago_cliente || 0);
        const publicadorRef = doc(db, "usuarios", tarea.id_publicador);

        await updateDoc(publicadorRef, { saldo: increment(monto) });
        await registrarPagoHistorial(tarea.id_publicador, "Saldo LaburApp", monto, `Reembolso por resolución de tarea: ${tarea.titulo}`);
        await updateDoc(trabajoRef, { pago_retenido: false });

        await crearNotificacion(
            tarea.id_publicador,
            "Reembolso Procesado",
            `Se te han devuelto ${monto.toFixed(2)}€ a tu saldo por la tarea "${tarea.titulo}".`,
            "pago"
        );
    }
}

export async function verificarSuscripcionesRecurrentes(uid) {
    const docRef = doc(db, "usuarios", uid);
    const userSnap = await getDoc(docRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const hoy = new Date();
    const updates = {};
    let huboCambios = false;

    const roles = [
        { tipo: 'trabajador', id: data.id_suscripcion_trabajador, vencimiento: data.fecha_vencimiento_trabajador, renovacion: data.renovacion_automatica_trabajador, precio: 2 },
        { tipo: 'cliente', id: data.id_suscripcion_cliente, vencimiento: data.fecha_vencimiento_cliente, renovacion: data.renovacion_automatica_cliente, precio: 1 }
    ];

    for (const role of roles) {
        if (!role.id || role.id === "" || role.id === "ninguna") continue;

        const fechaVencimiento = role.vencimiento?.toDate ? role.vencimiento.toDate() : (role.vencimiento ? new Date(role.vencimiento) : null);
        if (!fechaVencimiento) continue;

        if (hoy >= fechaVencimiento) {
            if (role.renovacion === true) {
               
                const nuevaFechaVencimiento = new Date(fechaVencimiento);
                nuevaFechaVencimiento.setMonth(nuevaFechaVencimiento.getMonth() + 1);

                while (hoy >= nuevaFechaVencimiento) {
                    nuevaFechaVencimiento.setMonth(nuevaFechaVencimiento.getMonth() + 1);
                }

                const campoVencimiento = role.tipo === 'trabajador' ? 'fecha_vencimiento_trabajador' : 'fecha_vencimiento_cliente';
                updates[campoVencimiento] = nuevaFechaVencimiento;
                huboCambios = true;

                const nombreSub = role.id.charAt(0).toUpperCase() + role.id.slice(1);
                await registrarPagoHistorial(uid, "Renovación Automática", -role.precio, `Renovación mensual suscripción ${nombreSub}`);
                await crearNotificacion(uid, "Suscripción Renovada", `Tu suscripción de ${role.tipo} se ha renovado automáticamente hasta el ${nuevaFechaVencimiento.toLocaleDateString()}.`, "suscripcion");
            } else {
               
                const campoId = role.tipo === 'trabajador' ? 'id_suscripcion_trabajador' : 'id_suscripcion_cliente';
                const campoVencimiento = role.tipo === 'trabajador' ? 'fecha_vencimiento_trabajador' : 'fecha_vencimiento_cliente';
                updates[campoId] = "";
                updates[campoVencimiento] = null;
                huboCambios = true;

                await crearNotificacion(uid, "Suscripción Finalizada", `El periodo de tu suscripción de ${role.tipo} ha finalizado.`, "info");
               
                await actualizarActividadSuscripcion(uid).catch(console.error);
            }
        }
    }

    if (huboCambios) {
        await updateDoc(docRef, updates);
    }
}
