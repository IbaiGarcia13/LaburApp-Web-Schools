import { auth, db } from './firebase-config.js';
import { collection, addDoc, doc, updateDoc, arrayUnion, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
      const DescripciónClase = inputDescClase.value.trim();
      if (!nombreClase) {
        alert("El nombre de la clase es obligatorio.");
        return;
      }
      modalCrearClase.classList.add('hidden');
      crearClase(nombreClase, DescripciónClase);
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
        alert("El Código debe tener 5 caracteres.");
        return;
      }
      modalUnirseClase.classList.add('hidden');
      unirseAClase(Código.toUpperCase());
    });
  }
});

async function crearClase(nombre, Descripción) {
  const user = auth.currentUser;
  if (!user) return;

  // Generar Código de 5 caracteres
  const Código = Math.random().toString(36).substring(2, 7).toUpperCase();

  const randomCat = Math.floor(Math.random() * 12) + 1;
  const colorInicial = `cat-${randomCat}`;

  try {
    const claseRef = await addDoc(collection(db, "clases"), {
      nombre: nombre,
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

    alert(`¡Clase creada con Éxito!\nCódigo: ${Código}`);
    window.location.reload();
  } catch (error) {
    console.error("Error al crear clase:", error);
    alert("Error al crear la clase.");
  }
}

async function unirseAClase(Código) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const q = query(collection(db, "clases"), where("Código", "==", Código));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("El Código de clase no es válido.");
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

    alert("¡Te has unido a la clase con Éxito!");
    window.location.reload();
  } catch (error) {
    console.error("Error al unirse a la clase:", error);
    alert("Error al unirse a la clase.");
  }
}



