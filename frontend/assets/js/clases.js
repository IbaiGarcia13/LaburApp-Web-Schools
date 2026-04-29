import { auth, db } from './firebase-config.js';
import { collection, addDoc, doc, updateDoc, arrayUnion, getDocs, getDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { obtenerPerfilUsuario } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnCrearClase = document.getElementById('btnCrearClase');
  const btnUnirseClase = document.getElementById('btnUnirseClase');
  const modalCrearClase = document.getElementById('modalCrearClase');
  const modalUnirseClase = document.getElementById('modalUnirseClase');

  const inputNombreClase = document.getElementById('inputNombreClase');
  const inputDescClase = document.getElementById('inputDescClase');
  const btnConfirmarCrear = document.getElementById('btnConfirmarCrear');
  const btnCancelarCrear = document.getElementById('btnCancelarCrear');

  const inputCódigoClase = document.getElementById('inputCódigoClase');
  const btnConfirmarUnirse = document.getElementById('btnConfirmarUnirse');
  const btnCancelarUnirse = document.getElementById('btnCancelarUnirse');

  if (btnCrearClase && modalCrearClase) {
    btnCrearClase.addEventListener('click', () => {
      modalCrearClase.classList.remove('hidden');
      inputNombreClase.value = "";
      inputDescClase.value = "";
    });

    btnCancelarCrear.addEventListener('click', () => {
      modalCrearClase.classList.add('hidden');
    });

    btnConfirmarCrear.addEventListener('click', () => {
      const nombreClase = inputNombreClase.value.trim();
      const AsignaturaClase = document.getElementById('inputAsignaturaClase').value;
      const DescripciónClase = inputDescClase.value.trim();
      
      if (!nombreClase) {
        window.showCustomAlert("Error", "El nombre de la clase es obligatorio.");
        return;
      }
      if (!AsignaturaClase) {
        window.showCustomAlert("Error", "Debes seleccionar una asignatura.");
        return;
      }

      modalCrearClase.classList.add('hidden');
      crearClase(nombreClase, AsignaturaClase, DescripciónClase);
    });
  }

  if (btnUnirseClase && modalUnirseClase) {
    btnUnirseClase.addEventListener('click', () => {
      modalUnirseClase.classList.remove('hidden');
      inputCódigoClase.value = "";
    });

    btnCancelarUnirse.addEventListener('click', () => {
      modalUnirseClase.classList.add('hidden');
    });

    btnConfirmarUnirse.addEventListener('click', () => {
      const Código = inputCódigoClase.value.trim();
      if (Código.length !== 5) {
        window.showCustomAlert("Error", "El Código debe tener 5 caracteres.");
        return;
      }
      modalUnirseClase.classList.add('hidden');
      unirseAClase(Código.toUpperCase());
    });
  }
});

async function crearClase(nombre, asignatura, Descripción) {
  const user = auth.currentUser;
  if (!user) return;

  // Generar Código de 5 caracteres
  const Código = Math.random().toString(36).substring(2, 7).toUpperCase();

  // Color aleatorio del 2 al 12 para evitar el color primario (cat-1 suele ser azul)
  const randomCat = Math.floor(Math.random() * 11) + 2;
  const colorInicial = `cat-${randomCat}`;

  try {
    const claseRef = await addDoc(collection(db, "clases"), {
      nombre: nombre,
      Asignatura: asignatura,
      Descripción: Descripción || "",
      Código: Código,
      color: colorInicial,
      id_docente: user.uid,
      fecha_creacion: serverTimestamp(),
      alumnos: []
    });

    // Añadir clase al perfil del docente
    const userRef = doc(db, "usuarios", user.uid);
    await updateDoc(userRef, {
      clases: arrayUnion(claseRef.id)
    });

    window.showCustomAlert("¡Clase creada!", `¡Clase creada con Éxito!\nCódigo: ${Código}`, "Aceptar", () => {
        window.location.reload();
    });
  } catch (error) {
    console.error("Error al crear clase:", error);
    window.showCustomAlert("Error", "Error al crear la clase.");
  }
}

async function unirseAClase(Código) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const q = query(collection(db, "clases"), where("Código", "==", Código));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      window.showCustomAlert("Error", "El Código de clase no es válido.");
      return;
    }

    const claseDoc = querySnapshot.docs[0];
    const claseId = claseDoc.id;

    // Añadir alumno a la clase
    await updateDoc(doc(db, "clases", claseId), {
      alumnos: arrayUnion(user.uid)
    });

    // Añadir clase al perfil del alumno
    const userRef = doc(db, "usuarios", user.uid);
    await updateDoc(userRef, {
      clases: arrayUnion(claseId)
    });

    // Registrar novedad de unión
    const perfil = await obtenerPerfilUsuario(user.uid);
    await addDoc(collection(db, "clases", claseId, "novedades"), {
      tipo: 'unirse',
      autor_id: user.uid,
      autor_nombre: perfil.nombre || "Un alumno",
      mensaje: `${perfil.nombre || "Un alumno"} se ha unido a la clase.`,
      fecha: serverTimestamp()
    });

    window.showCustomAlert("¡Bienvenido!", "¡Te has unido a la clase con Éxito!", "Aceptar", () => {
        window.location.reload();
    });
  } catch (error) {
    console.error("Error al unirse a la clase:", error);
    window.showCustomAlert("Error", "Error al unirse a la clase.");
  }
}



