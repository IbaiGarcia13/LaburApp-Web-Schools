import { auth, db } from './firebase-config.js';
import { obtenerPerfilUsuario, actualizarPerfilUsuario, obtenerTodosPuntosCategorias } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    // Referencias a la UI Base
    const passLabel = document.getElementById('passLabel');
    const btnChangePass = document.getElementById('btnChangePass');

    // Referencias a los datos mostrados
    const displayName = document.getElementById('displayName');
    const displayDescription = document.getElementById('displayDescription');
    const displayAddress = document.getElementById('displayAddress');
    const displayPic = document.getElementById('displayPic');

    // Referencias Estadísticas Nuevas
    const lvlVal = document.querySelector('.lvl-val'); // Nivel
    const lvlBars = document.querySelectorAll('.xp-header span'); // [0 XP, Actual XP, Max XP]
    const xpFill = document.querySelector('.xp-fill'); // Barra de XP
    const statItems = document.querySelectorAll('.stat-item strong'); // [Valoracion, Especialidad, Dinero]
    const catGrid = document.querySelector('.cat-grid');

    // Referencias a las Tarjetas de Cuenta y Suscripciones
    const infoCards = document.querySelectorAll('.info-card');
    let subsBody = null;
    let cuentaBody = null;
    infoCards.forEach(card => {
        if (card.querySelector('.card-title') && card.querySelector('.card-title').textContent.includes('Suscripciones')) {
            subsBody = card.querySelector('.card-body');
        }
        if (card.querySelector('.card-title') && card.querySelector('.card-title').textContent.includes('Cuenta')) {
            cuentaBody = card.querySelector('.card-body');
        }
    });

    // Referencias Modal
    const modal = document.getElementById('editModal');
    const btnOpen = document.getElementById('btnOpenEdit');
    const btnClose = document.getElementById('modal-btn cancel');
    const btnSave = document.getElementById('modal-btn confirm');

    const catInfo = {
        'gastronomia': { nombre: 'Gastronomía', color: 'd-yellow' },
        'informatica': { nombre: 'Informática', color: 'd-blue' },
        'limpieza': { nombre: 'Limpieza', color: 'd-purple' },
        'mascotas': { nombre: 'Mascotas', color: 'd-green-dark' },
        'carpinteria': { nombre: 'Carpintería', color: 'd-brown' },
        'otros': { nombre: 'Otros', color: 'd-black' },
        'jardineria': { nombre: 'Jardinería', color: 'd-green-light' },
        'cuidado_personal': { nombre: 'Cuidado Personal', color: 'd-pink' },
        'evento': { nombre: 'Evento', color: 'd-red' },
        'diseno': { nombre: 'Diseño', color: 'd-teal' }
    };

    // Cargar los datos desde Firebase al abrir la app o iniciar sesión
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Actualizar correo real en la tarjeta 'Cuenta'
                if (cuentaBody) {
                    const emailP = cuentaBody.querySelector('p');
                    if (emailP) emailP.innerHTML = `<strong>Correo electrónico:</strong> ${user.email}`;
                }

                const perfil = await obtenerPerfilUsuario(user.uid);
                const ptsCat = await obtenerTodosPuntosCategorias(user.uid);

                if (perfil) {
                    // Cadenas principales
                    displayName.textContent = perfil.nombre_completo || (perfil.nombre + " " + perfil.apellidos);

                    if (perfil.bio) {
                        displayDescription.textContent = perfil.bio;
                    } else {
                        displayDescription.textContent = "¡Hola! Soy nuevo en LaburApp. Todavía no he escrito mi biografía.";
                    }

                    if (perfil.direccion_principal) {
                        displayAddress.textContent = perfil.direccion_principal;
                    }

                    // --- 1. LÓGICA DE NIVEL Y BARRA DE XP ---
                    const nLvl = perfil.nivel || 1;
                    const xpActual = perfil.experiencia_nivel_actual || 0;
                    // MaxXP requerida para pasar de nivel = (nLvl) * 100 + 100 => (nLvl + 1) * 100.
                    const maxXP = (nLvl + 1) * 100;

                    if (lvlVal) lvlVal.textContent = nLvl;
                    if (lvlBars.length >= 3) {
                        lvlBars[0].textContent = "0 XP";
                        lvlBars[1].textContent = xpActual.toLocaleString() + " XP";
                        lvlBars[2].textContent = maxXP.toLocaleString() + " XP";
                    }
                    if (xpFill) {
                        let percent = (xpActual / maxXP) * 100;
                        if (percent > 100) percent = 100;
                        xpFill.style.width = percent + "%";
                    }

                    // --- 2. VALORACIÓN, ESPECIALIDAD Y DINERO ---
                    if (statItems.length >= 3) {
                        const valMedia = perfil.valoracion_media && perfil.valoracion_media > 0 ? perfil.valoracion_media : 3.0;
                        statItems[0].textContent = valMedia.toFixed(1);

                        let maxPts = -1;
                        let bestCat = null;
                        for (let c of ptsCat) {
                            if (c.puntos > maxPts) {
                                maxPts = c.puntos;
                                bestCat = c.id_categoria;
                            }
                        }

                        if (bestCat && maxPts > 0) {
                            const n = catInfo[bestCat] ? catInfo[bestCat].nombre : bestCat;
                            statItems[1].textContent = `${n} (${maxPts} pts)`;
                        } else {
                            statItems[1].textContent = "Ninguna (0 pts)";
                        }

                        statItems[2].textContent = (perfil.dinero_ganado_total || 0).toLocaleString() + " €";
                    }

                    // --- 3. RENDIMIENTO DE TABLA DE CATEGORIAS ---
                    if (catGrid) {
                        catGrid.innerHTML = "";
                        let hasCats = false;
                        for (let c of ptsCat) {
                            if (c.puntos > 0) {
                                hasCats = true;
                                const info = catInfo[c.id_categoria] || { nombre: c.id_categoria, color: 'd-black' };
                                const div = document.createElement('div');
                                div.className = 'cat-item';
                                div.innerHTML = `<span class="dot ${info.color}"></span> <strong>${info.nombre}:</strong> ${c.puntos} puntos`;
                                catGrid.appendChild(div);
                            }
                        }
                        if (!hasCats) {
                            catGrid.innerHTML = "<p style='color: #666; font-style: italic; grid-column: 1 / -1;'>Aún no tienes puntos en ninguna categoría de trabajo.</p>";
                        }
                    }

                    // --- 4. RENDER DE SUSCRIPCIONES ---
                    if (subsBody) {
                        const sTrabajador = perfil.id_suscripcion_trabajador || "ninguna";
                        const sCliente = perfil.id_suscripcion_cliente || "ninguna";

                        let tHtml = `<strong>Suscripcion Trabajador:</strong> `;
                        if (sTrabajador.toLowerCase() !== "ninguna") {
                            tHtml += `<img src="../assets/img/icons/icono-suscripciones.png" class="icon-img" alt="Diamante"> ${sTrabajador.toUpperCase()}`;
                        } else {
                            tHtml += `Ninguna`;
                        }

                        let cHtml = `<strong>Suscripción Cliente:</strong> `;
                        if (sCliente.toLowerCase() !== "ninguna") {
                            cHtml += `<img src="../assets/img/icons/icono-suscripciones.png" class="icon-img" alt="Diamante"> ${sCliente.toUpperCase()}`;
                        } else {
                            cHtml += `Ninguna`;
                        }

                        subsBody.innerHTML = `<p>${tHtml}</p><p>${cHtml}</p>`;
                    }

                    // --- 5. RENDER FOTO DE PERFIL Y CV ---
                    if (displayPic) {
                        displayPic.src = perfil.foto_perfil || "../assets/img/avatar-defecto.png";
                    }

                    const displayPDF = document.getElementById('displayPDF');
                    if (displayPDF) {
                        if (perfil.curriculum_url) {
                            displayPDF.href = perfil.curriculum_url;
                            displayPDF.style.display = "inline";
                        } else {
                            displayPDF.removeAttribute('href');
                            displayPDF.style.display = "none";
                            // Ocultar fila entera si no hay CV
                            const pdfRow = displayPDF.closest('.link-row');
                            if (pdfRow) pdfRow.style.display = "none";
                        }
                    }
                }
            } catch (error) {
                console.error("Error cargando perfil:", error);
            }
        }
    });

    // --- LÓGICA DE CAMBIAR CONTRASEÑA ---
    if (btnChangePass) {
        btnChangePass.addEventListener('click', (e) => {
            e.preventDefault();
            showCustomPrompt(
                "Cambiar Contraseña",
                "Introduce tu nueva contraseña:",
                (nuevaPass) => {
                    if (nuevaPass && nuevaPass.trim() !== "") {
                        showCustomAlert("Éxito", "Contraseña actualizada correctamente.");
                        if (passLabel) passLabel.textContent = "*".repeat(nuevaPass.length);
                    }
                },
                "Actualizar",
                "Cancelar",
                "password"
            );
        });
    }

    // --- LÓGICA DEL MODAL DE EDICIÓN ---
    if (btnOpen) {
        btnOpen.onclick = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const perfil = await obtenerPerfilUsuario(user.uid);
            modal.style.display = "flex";

            document.getElementById('inputName').value = perfil.nombre || "";
            document.getElementById('inputLastname').value = perfil.apellidos || "";

            // Si la bio es la por defecto, vaciar el input para que pueda escribir la suya.
            const currDesc = displayDescription.textContent.trim();
            if (currDesc.includes("Todavía no he escrito mi biografía")) {
                document.getElementById('inputDescription').value = "";
            } else {
                document.getElementById('inputDescription').value = currDesc;
            }

            const addressMatch = displayAddress.textContent;
            const dirSana = (addressMatch.includes("Uribarri") || addressMatch.includes("Bilbao 48007")) ? "" : addressMatch;
            document.getElementById('inputAddress').value = dirSana;
        };
    }

    if (btnClose) btnClose.onclick = () => modal.style.display = "none";

    // GUARDAR CAMBIOS: Enviar a Firestore y refrescar interfaz localmente
    if (btnSave) {
        btnSave.onclick = async () => {
            const user = auth.currentUser;
            if (!user) {
                showCustomAlert("Error", "No estás logueado.");
                return;
            }

            // Datos Extraidos del Modal
            const newName = document.getElementById('inputName').value.trim();
            const newLastname = document.getElementById('inputLastname').value.trim();
            const newDescription = document.getElementById('inputDescription').value.trim();
            const newAddress = document.getElementById('inputAddress').value.trim();
            const photoFile = document.getElementById('inputPhoto').files[0];
            const pdfFile = document.getElementById('inputPDF').files[0];

            try {
                const updateData = {
                    nombre: newName,
                    apellidos: newLastname,
                    nombre_completo: `${newName} ${newLastname}`.trim(),
                    bio: newDescription,
                    direccion_principal: newAddress
                };

                // Actualizar foto localmente y preparar para DB
                if (photoFile) {
                    const reader = new FileReader();
                    const base64Photo = await new Promise((resolve, reject) => {
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = (e) => reject(e);
                        reader.readAsDataURL(photoFile);
                    });
                    updateData.foto_perfil = base64Photo;
                    displayPic.src = base64Photo;
                }

                // Actualizar CV PDF
                if (pdfFile) {
                    const reader = new FileReader();
                    const base64PDF = await new Promise((resolve, reject) => {
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = (e) => reject(e);
                        reader.readAsDataURL(pdfFile);
                    });
                    updateData.curriculum_url = base64PDF;

                    const displayPDF = document.getElementById('displayPDF');
                    if (displayPDF) {
                        displayPDF.href = base64PDF;
                        displayPDF.style.display = "inline";
                        const pdfRow = displayPDF.closest('.link-row');
                        if (pdfRow) pdfRow.style.display = "flex";
                    }
                }

                // Escribir en la Base de Datos NoSQL
                await actualizarPerfilUsuario(user.uid, updateData);

                // Refrescar Visual Texto
                displayName.textContent = updateData.nombre_completo;
                displayDescription.textContent = newDescription || "¡Hola! Soy nuevo en LaburApp. Todavía no he escrito mi biografía.";
                displayAddress.textContent = newAddress || "Ubicación no especificada";

                showCustomAlert("Éxito", "Perfil guardado correctamente en la Base de Datos.");
                modal.style.display = "none";

            } catch (error) {
                console.error("Error actualizando perfil:", error);
                showCustomAlert("Error", "No se pudo actualizar el perfil. Inténtalo de nuevo.");
            }
        };
    }

    // Cerrar al hacer clic fuera del modal
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    };
});