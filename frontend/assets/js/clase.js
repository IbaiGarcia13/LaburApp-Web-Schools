import { auth, db } from './firebase-config.js';

import { obtenerPerfilUsuario, obtenerClasePorId, actualizarPerfilUsuario } from './database.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";



document.addEventListener('DOMContentLoaded', () => {



  const urlParams = new URLSearchParams(window.location.search);

  const claseId = urlParams.get('id');



  if (!claseId) {

    window.location.href = "principal.html";

    return;

  }



  const claseHeaderNav = document.getElementById('claseHeaderNav');

  const claseMobileNav = document.getElementById('claseMobileNav');

  const classHeroCard = document.getElementById('classHeroCard');

  const docenteActions = document.getElementById('docenteActions');

  

  // Novedades

  const feedList = document.getElementById('feedList');

  const feedInputText = document.getElementById('feedInputText');

  const btnEnviarMensajeFeed = document.getElementById('btnEnviarMensajeFeed');



  // Modales Tarea

  const btnNuevaTarea = document.getElementById('btnNuevaTarea');

  const modalCrearTarea = document.getElementById('modalCrearTarea');

  const btnCancelarTarea = document.getElementById('btnCancelarTarea');

  const formCrearTareaClase = document.getElementById('formCrearTareaClase');



  let currentUserProfile = null;

  let currentClaseData = null; // Guardar datos de la clase para acceso global



  onAuthStateChanged(auth, async (user) => {

    if (user) {

      try {

        currentUserProfile = await obtenerPerfilUsuario(user.uid);

        const clase = await obtenerClasePorId(claseId);

        currentClaseData = clase; // Guardar referencia



        if (!clase || !currentUserProfile) {

          window.location.href = "principal.html";

          return;

        }



        const esDocente = clase.id_docente === user.uid;

        const esAlumno = clase.alumnos && clase.alumnos.includes(user.uid);



        if (!esDocente && !esAlumno) {

          // No pertenece a la clase

          window.location.href = "principal.html";

          return;

        }



        // --- HEADER DINÁMICO ---

        const nombreUsuarios = esDocente ? "Alumnos" : "Compañeros";

        const htmlNav = `

          <li><a href="usuarios.html?clase=${claseId}">${nombreUsuarios}</a></li>

          <li><a href="tareas.html?clase=${claseId}">Tareas</a></li>

        `;

        if(claseHeaderNav) claseHeaderNav.innerHTML = htmlNav;

        

        if(claseMobileNav) {

          claseMobileNav.innerHTML = `

            <a href="usuarios.html?clase=${claseId}" class="nav-item">

              <img src="../assets/img/icons/icono-perfil.png" alt="${nombreUsuarios}">

              <span>${nombreUsuarios}</span>

            </a>

            <a href="tareas.html?clase=${claseId}" class="nav-item">

              <img src="../assets/img/icons/icono-trabajos.png" alt="Tareas">

              <span>Tareas</span>

            </a>

          `;

        }



        // --- DATOS DEL HERO ---

        const docenteInfo = await obtenerPerfilUsuario(clase.id_docente);

        document.getElementById('classHeroTitle').textContent = clase.nombre;

        document.getElementById('classHeroDocente').textContent = "Profesor: " + (docenteInfo ? docenteInfo.nombre_completo : "Desconocido");

        document.getElementById('classHeroDesc').textContent = clase.Descripción || "";

        document.getElementById('classHeroCode').textContent = "Código: " + clase.Código;



        const colorCat = clase.color || `cat-${claseId.charCodeAt(0) % 12 + 1}`;

        classHeroCard.style.background = `var(--${colorCat})`;



        // --- Código DE CLASE: MODAL (ESTILO CLASSROOM) ---

        const btnToggleCode = document.getElementById('btnToggleCode');

        const modalCódigoClase = document.getElementById('modalCódigoClase');

        const btnCloseCodeModal = document.getElementById('btnCloseCodeModal');

        const modalCodeTitle = document.getElementById('modalCodeTitle');

        const modalCodeValue = document.getElementById('modalCodeValue');



        if (currentUserProfile.rol === 'docente') {

        const btnEdit = document.getElementById('btnEditarClase');

        if (btnEdit) {

          btnEdit.style.display = 'block';

          btnEdit.classList.remove('hidden');

        }

        if (btnToggleCode) btnToggleCode.style.display = 'block';

        const btnCrear = document.getElementById('btnCrearTarea');

        if (btnCrear) btnCrear.style.display = 'inline-flex';

      } else {

        // Alumno

        const btnColorAlu = document.getElementById('btnColorAlumno');

        if (btnColorAlu) {

          btnColorAlu.style.display = 'block';

          btnColorAlu.classList.remove('hidden');

        }

        

        // Aplicar preferencia de color si existe

        const prefs = currentUserProfile.preferencias_clases || {};

        if (prefs[claseId]) {

          if (classHeroCard) {

            classHeroCard.style.background = `var(--${prefs[claseId]})`;

            const innerCircle = document.getElementById('alumnoColorPreview');

            if (innerCircle) innerCircle.style.background = `var(--${prefs[claseId]})`;

          }

        }

      }



        if (btnToggleCode && modalCódigoClase) {

          btnToggleCode.addEventListener('click', () => {

            modalCodeTitle.textContent = clase.nombre;

            modalCodeValue.textContent = clase.Código;

            modalCódigoClase.classList.remove('hidden');

          });



          if(btnCloseCodeModal) {

            btnCloseCodeModal.addEventListener('click', () => {

              modalCódigoClase.classList.add('hidden');

            });

          }



          modalCódigoClase.addEventListener('click', (e) => {

            if (e.target === modalCódigoClase) modalCódigoClase.classList.add('hidden');

          });

        }



        // --- MOSTRAR CONTROLES POR ROL ---

        const btnColorAlumno = document.getElementById('btnColorAlumno');

        const btnEditarClaseInline = document.getElementById('btnEditarClase');

        const alumnoColorPreview = document.getElementById('alumnoColorPreview');



        if (esDocente) {

          if (btnEditarClaseInline) {

            btnEditarClaseInline.style.display = 'block';

            btnEditarClaseInline.classList.remove('hidden');

          }

          if (docenteActions) docenteActions.style.display = 'flex';

          

          const btnPanelControl = document.getElementById('btnPanelControl');

          if (btnPanelControl) {

            btnPanelControl.href = `panel-control.html?id=${claseId}`;

          }

        } else {

          if (btnColorAlumno) {

            btnColorAlumno.style.display = 'block';

            btnColorAlumno.classList.remove('hidden');

          }

        }



        // --- GESTIÓN DE COLOR (PREFERENCIA PERSONAL) ---

        let colorActual = clase.color || `cat-${claseId.charCodeAt(0) % 12 + 1}`;

        

        // Si el alumno tiene un color guardado para esta clase, usarlo

        if (currentUserProfile.preferencias_clases && currentUserProfile.preferencias_clases[claseId]) {

          colorActual = currentUserProfile.preferencias_clases[claseId];

        }

        

        classHeroCard.style.background = `var(--${colorActual})`;

        if (alumnoColorPreview) alumnoColorPreview.style.background = `var(--${colorActual})`;



        // Lógica modal color alumno

        if (btnColorAlumno) {

          const modalColorAlumno = document.getElementById('modalColorAlumno');

          const btnCancelarColorAlumno = document.getElementById('btnCancelarColorAlumno');

          const swatches = document.querySelectorAll('#alumnoColorPicker .color-swatch');



          btnColorAlumno.addEventListener('click', () => modalColorAlumno.classList.remove('hidden'));

          btnCancelarColorAlumno.addEventListener('click', () => modalColorAlumno.classList.add('hidden'));



          swatches.forEach(swatch => {

            swatch.addEventListener('click', async () => {

              const nuevoColor = swatch.dataset.color;

              colorActual = nuevoColor;

              classHeroCard.style.background = `var(--${nuevoColor})`;

              if (alumnoColorPreview) alumnoColorPreview.style.background = `var(--${nuevoColor})`;

              

              // Guardar en perfil

              const nuevasPreferencia = currentUserProfile.preferencias_clases || {};

              nuevasPreferencia[claseId] = nuevoColor;

              

              try {

                await actualizarPerfilUsuario(user.uid, { preferencias_clases: nuevasPreferencia });

                modalColorAlumno.classList.add('hidden');

              } catch (error) {

                console.error("Error al guardar color:", error);

              }

            });

          });

        }



        // --- ACTUALIZAR AVATAR INPUT ---

        const feedInputAvatar = document.getElementById('feedInputAvatar');

        if (feedInputAvatar) {

          feedInputAvatar.src = currentUserProfile.foto_perfil || 

            (currentUserProfile.rol === 'docente' ? '../assets/img/avatar-defecto-docente.png' : '../assets/img/avatar-defecto-alumno.png');

        }



        // --- INICIAR FEED DE NOVEDADES ---

        cargarFeed(claseId);



      } catch (error) {

        console.error("Error cargando clase:", error);

      }

    } else {

      window.location.href = "../index.html";

    }

  });



  // --- ENVIAR MENSAJE AL FEED (con archivos) ---

  let feedFilesSelected = [];



  const feedFileInput = document.getElementById('feedFileInput');

  const feedFilesPreview = document.getElementById('feedFilesPreview');



  if (feedFileInput) {

    feedFileInput.addEventListener('change', () => {

      feedFilesSelected = Array.from(feedFileInput.files);

      renderFeedFilesPreview();

    });

  }



  function renderFeedFilesPreview() {

    if (!feedFilesPreview) return;

    if (feedFilesSelected.length === 0) {

      feedFilesPreview.style.display = 'none';

      feedFilesPreview.innerHTML = '';

      return;

    }

    feedFilesPreview.style.display = 'flex';

    feedFilesPreview.innerHTML = feedFilesSelected.map((f, i) => `

      <div class="feed-file-chip">

        �� ${f.name}

        <button type="button" data-idx="${i}">×</button>

      </div>

    `).join('');

    feedFilesPreview.querySelectorAll('button').forEach(btn => {

      btn.onclick = () => {

        feedFilesSelected.splice(Number(btn.dataset.idx), 1);

        renderFeedFilesPreview();

      };

    });

  }



  if (btnEnviarMensajeFeed) {

    btnEnviarMensajeFeed.addEventListener('click', async () => {

      const texto = feedInputText.value.trim();

      if (!texto && feedFilesSelected.length === 0) return;



      // Convertir archivos a base64

      const archivosData = await Promise.all(feedFilesSelected.map(file => {

        return new Promise((resolve) => {

          const reader = new FileReader();

          reader.onload = (e) => resolve({

            nombre: file.name,

            tipo: file.type,

            data: e.target.result // base64 data URL

          });

          reader.readAsDataURL(file);

        });

      }));



      try {

        await addDoc(collection(db, "mensajes_clase"), {

          id_clase: claseId,

          id_autor: auth.currentUser.uid,

          nombre_autor: currentUserProfile.nombre_completo || "Usuario",

          rol_autor: currentUserProfile.rol || "alumno",

          foto_autor: currentUserProfile.foto_perfil || "",

          texto: texto,

          archivos: archivosData,

          fecha: serverTimestamp(),

          tipo: "mensaje"

        });

        feedInputText.value = "";

        feedFilesSelected = [];

        renderFeedFilesPreview();

        if (feedFileInput) feedFileInput.value = '';

      } catch (e) {

        console.error("Error enviando mensaje:", e);

        alert("No se pudo enviar el mensaje.");

      }

    });

  }



  // --- CARGAR FEED EN TIEMPO REAL ---

  function cargarFeed(idClase) {

    const q = query(

      collection(db, "mensajes_clase"), 

      where("id_clase", "==", idClase)

    );



    onSnapshot(q, (snapshot) => {

      if (snapshot.empty) {

        feedList.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--gray-5);">Aún no hay novedades en esta clase. ¡Escribe el primer mensaje!</div>`;

        return;

      }



      feedList.innerHTML = "";

      

      const mensajes = [];

      snapshot.forEach((docSnap) => {

        mensajes.push({ id: docSnap.id, ...docSnap.data() });

      });



      // Ordenar por fecha descendente (más recientes primero)

      mensajes.sort((a, b) => {

        const fA = a.fecha ? a.fecha.toMillis() : 0;

        const fB = b.fecha ? b.fecha.toMillis() : 0;

        return fB - fA;

      });



      mensajes.forEach((data) => {

        const div = document.createElement('div');

        div.className = "feed-msg" + (data.tipo === 'novedad' ? " novedad-automatica" : "");

        

        // Formateo simple de fecha

        let fechaStr = "";

        if(data.fecha) {

          const date = data.fecha.toDate();

          fechaStr = date.toLocaleDateString() + " " + date.getHours() + ":" + String(date.getMinutes()).padStart(2, '0');

        }



        const msgAvatar = data.foto_autor || 

          (data.rol_autor === 'docente' ? '../assets/img/avatar-defecto-docente.png' : '../assets/img/avatar-defecto-alumno.png');



        // Renderizar archivos adjuntos

        let archivosHtml = '';

        if (data.archivos && data.archivos.length > 0) {

          const items = data.archivos.map(f => {

            // Soporte tanto formato nuevo {nombre,tipo,data} como nombre solo (legacy)

            const nombre = typeof f === 'string' ? f : f.nombre;

            const tipo = typeof f === 'string' ? '' : (f.tipo || '');

            const dataUrl = typeof f === 'string' ? null : f.data;



            if (dataUrl && tipo.startsWith('image/')) {

              return `<div class="msg-file-item">

                <img src="${dataUrl}" class="msg-file-img" alt="${nombre}" onclick="window.open('${dataUrl}')" title="${nombre}">

              </div>`;

            } else if (dataUrl && tipo === 'application/pdf') {

              return `<div class="msg-file-item msg-file-pdf">

                <embed src="${dataUrl}" type="application/pdf" class="msg-file-embed">

                <a href="${dataUrl}" download="${nombre}" class="msg-file-download">&#8681; ${nombre}</a>

              </div>`;

            } else if (dataUrl) {

              return `<a href="${dataUrl}" download="${nombre}" class="msg-file-chip">

                &#128196; ${nombre}

              </a>`;

            } else {

              return `<span class="msg-file-chip">&#128196; ${nombre}</span>`;

            }

          }).join('');

          archivosHtml = `<div class="msg-files">${items}</div>`;

        }



        div.innerHTML = `

          <img src="${msgAvatar}" class="msg-avatar" alt="Avatar">

          <div class="msg-content">

            <div class="msg-header">

              <span class="msg-author">${data.nombre_autor}</span>

              <span class="msg-time">${fechaStr}</span>

            </div>

            <div class="msg-text">${data.texto}</div>

            ${archivosHtml}

          </div>

        `;

        feedList.appendChild(div);

      });

    });

  }



  // --- LÓGICA MODAL CREAR TAREA ---

  if (btnNuevaTarea && modalCrearTarea) {

    btnNuevaTarea.addEventListener('click', () => {

      modalCrearTarea.classList.remove('hidden');

      initFileSlots();

    });



    btnCancelarTarea.addEventListener('click', () => {

      modalCrearTarea.classList.add('hidden');

    });



    function initFileSlots() {

      const slots = document.querySelectorAll('.file-slot');

      slots.forEach(slot => {

        // Reset slot

        slot.classList.remove('slot-locked');

        slot.innerHTML = `<input type="file" hidden accept="image/*,.pdf,.doc,.docx,.zip,.ppt,.pptx,.xls,.xlsx"><span class="slot-plus">+</span>`;

        slot.style.pointerEvents = '';



        const fileInput = slot.querySelector('input[type="file"]');

        slot.addEventListener('click', () => {

          if (!slot.classList.contains('slot-locked')) fileInput.click();

        }, { once: false });



        fileInput.addEventListener('change', () => {

          const file = fileInput.files[0];

          if (!file) return;



          slot.classList.add('slot-locked');

          slot.style.pointerEvents = 'none';



          const isImage = file.type.startsWith('image/');

          if (isImage) {

            const reader = new FileReader();

            reader.onload = (e) => {

              slot.innerHTML = `<img src="${e.target.result}" class="slot-preview-img" alt="${file.name}">`;

            };

            reader.readAsDataURL(file);

          } else {

            const ext = file.name.split('.').pop().toUpperCase();

            slot.innerHTML = `<div class="slot-preview-name">${ext}<br><small style="font-size:0.5rem">${file.name.substring(0,12)}...</small></div>`;

          }

        });

      });

    }



    formCrearTareaClase.addEventListener('submit', async (e) => {

      e.preventDefault();

      

      const Título = document.getElementById('tareaTítulo').value;

      const desc = document.getElementById('tareaDesc').value;

      const fechaIn = document.getElementById('tareaFechaInicio').value;

      const fechaLim = document.getElementById('tareaFechaLimite').value;

      const partic = document.getElementById('tareaParticipantes').value;

      const puntos = parseInt(document.getElementById('tareaPuntos').value) || 1;



      // Aquí se integraría con la colección "trabajos"

      try {

        // Crear tarea en BD

        const docRef = await addDoc(collection(db, "trabajos"), {

          id_clase: claseId,

          id_Categoría: currentClaseData.id_Categoría || "otros", // La tarea hereda la asignatura de la clase

          Título: Título,

          Descripción: desc,

          fecha_inicio: fechaIn,

          fecha_limite: fechaLim,

          participantes_tipo: partic,

          tipo_obligatoriedad: tipoOblig,

          puntos_asignatura: puntos,

          creador_id: auth.currentUser.uid,

          estado: "abierta",

          fecha_creacion: serverTimestamp()

        });



        // Lanzar novedad automática al feed

        await addDoc(collection(db, "mensajes_clase"), {

          id_clase: claseId,

          id_autor: auth.currentUser.uid,

          nombre_autor: currentUserProfile.nombre_completo || "Docente",

          rol_autor: "docente",

          foto_autor: currentUserProfile.foto_perfil || "",

          texto: `Se ha publicado una nueva tarea: "${Título}". Límite: ${fechaLim}`,

          fecha: serverTimestamp(),

          tipo: "novedad"

        });



        modalCrearTarea.classList.add('hidden');

        formCrearTareaClase.reset();

        alert("Tarea creada Éxitosamente.");



      } catch (error) {

        console.error("Error al crear la tarea:", error);

        alert("Error al crear la tarea.");

      }

    });

  }



  // --- LÓGICA MODAL EDITAR CLASE (DOCENTE) ---

  const btnEditarClase = document.getElementById('btnEditarClase');

  const modalEditarClase = document.getElementById('modalEditarClase');

  const btnCancelarEditarClase = document.getElementById('btnCancelarEditarClase');

  const formEditarClase = document.getElementById('formEditarClase');



  if (btnEditarClase && modalEditarClase) {

    btnEditarClase.addEventListener('click', async () => {

      const clase = await obtenerClasePorId(claseId);

      document.getElementById('editNombreClase').value = clase.nombre || "";

      document.getElementById('editDescClase').value = clase.Descripción || "";

      

      const colorCat = clase.color || `cat-${claseId.charCodeAt(0) % 12 + 1}`;

      document.getElementById('editColorClase').value = colorCat;



      // Configurar swatches

      document.querySelectorAll('#editColorPicker .color-swatch').forEach(swatch => {

        swatch.classList.toggle('selected', swatch.dataset.color === colorCat);

        swatch.onclick = () => {

          document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));

          swatch.classList.add('selected');

          document.getElementById('editColorClase').value = swatch.dataset.color;

        };

      });



      modalEditarClase.classList.remove('hidden');

    });



    if (btnCancelarEditarClase) {

      btnCancelarEditarClase.addEventListener('click', () => {

        modalEditarClase.classList.add('hidden');

      });

    }



    if (formEditarClase) {

      formEditarClase.addEventListener('submit', async (e) => {

        e.preventDefault();

        const nuevoNombre = document.getElementById('editNombreClase').value.trim();

        const nuevaDesc = document.getElementById('editDescClase').value.trim();

        const nuevoColor = document.getElementById('editColorClase').value;



        if (!nuevoNombre) return;



        try {

          const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

          const claseRef = doc(db, "clases", claseId);

          await updateDoc(claseRef, {

            nombre: nuevoNombre,

            Descripción: nuevaDesc,

            color: nuevoColor

          });

          

          modalEditarClase.classList.add('hidden');

          alert("Clase actualizada correctamente");

          window.location.reload();

        } catch (error) {

          console.error("Error al actualizar la clase:", error);

          alert("Hubo un error al actualizar la clase.");

        }

      });

    }

  }



  // --- LÓGICA MODAL COLOR ALUMNO ---

  const btnColorAlumno = document.getElementById('btnColorAlumno');

  const modalColorAlumno = document.getElementById('modalColorAlumno');

  const alumnoColorPicker = document.getElementById('alumnoColorPicker');

  const btnCancelarColorAlumno = document.getElementById('btnCancelarColorAlumno');



  if (btnColorAlumno && modalColorAlumno) {

    btnColorAlumno.onclick = () => {

      modalColorAlumno.classList.remove('hidden');

    };



    btnCancelarColorAlumno.onclick = () => modalColorAlumno.classList.add('hidden');



    alumnoColorPicker.querySelectorAll('.color-swatch').forEach(swatch => {

      swatch.onclick = async () => {

        const newColor = swatch.dataset.color;

        try {

          const { doc, updateDoc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

          const user = auth.currentUser;

          const prefRef = doc(db, "usuarios", user.uid);

          

          // Guardamos la preferencia en el objeto preferencias_clases del perfil

          await setDoc(prefRef, {

            preferencias_clases: {

              [claseId]: newColor

            }

          }, { merge: true });



          // Actualizar UI instantáneamente

          const hero = document.getElementById('classHero');

          if (hero) hero.style.background = `var(--${newColor})`;

          const innerCircle = document.getElementById('currentAlumnoColor');

          if (innerCircle) innerCircle.style.background = `var(--${newColor})`;



          modalColorAlumno.classList.add('hidden');

        } catch (err) {

          console.error("Error guardando preferencia de color:", err);

        }

      };

    });

  }



});




