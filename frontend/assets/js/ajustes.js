import { auth, db } from './firebase-config.js';
import { obtenerPerfilUsuario, actualizarPerfilUsuario, eliminarCuentaUsuario, cambiarPassword } from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    const passLabel = document.getElementById('passLabel');
    const btnChangePass = document.getElementById('btnChangePass');
    const btnDeleteAccount = document.getElementById('btnDeleteAccount');

   // --- MODAL DE EDICIÓN DE DATOS PERSONALES ---
    const editModal = document.getElementById('editSettingsModal');
    const btnEditProfile = document.getElementById('btnEditProfile');
    const btnCancelEditSettings = document.getElementById('btnCancelEditSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');

    const displayNombre = document.getElementById('displayNombre');
    const displayApellidos = document.getElementById('displayApellidos');
    const displayFechaNac = document.getElementById('displayFechaNac');
    const displayTelefono = document.getElementById('displayTelefono');
    const displayCurso = document.getElementById('displayCurso');
    const cursoRow = document.getElementById('cursoRow');



    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = '../index.html';
            return;
        }

        try {
            const perfil = await obtenerPerfilUsuario(user.uid);
                if (perfil) {
                    if (displayNombre) displayNombre.textContent = perfil.nombre || "";
                    if (displayApellidos) displayApellidos.textContent = perfil.apellidos || "";
                    if (displayFechaNac) displayFechaNac.textContent = perfil.fecha_nacimiento || "";
                    if (displayTelefono) displayTelefono.textContent = perfil.telefono || "No especificado";
                    
                    if (displayCurso) displayCurso.textContent = perfil.curso || "No especificado";
                    if (cursoRow) {
                        // Solo mostrar curso a alumnos
                        cursoRow.style.display = (perfil.rol === 'docente') ? 'none' : 'block';
                    }

                    const emailDisplays = document.querySelectorAll('p strong');
                    emailDisplays.forEach(el => {
                        if (el.textContent.includes('Correo electrónico')) {
                            el.parentElement.innerHTML = `<strong>Correo electrónico:</strong> ${user.email}`;
                        }
                    });



                }
            } catch (error) {
                console.error("Error obteniendo perfil/pagos en Ajustes:", error);
            }
    });

   // --- LÓGICA DE CERRAR SESIÓN (MANEJADA GLOBALMENTE POR GENERAL.JS CLASE .LOGOUT-ACTION) ---

   // --- LÓGICA PARA CAMBIAR LA CONTRASEÑA ---
    if (btnChangePass) {
        btnChangePass.addEventListener('click', (e) => {
            e.preventDefault();
            showChangePasswordModal(async (nuevaPass) => {
                try {
                    await cambiarPassword(nuevaPass);
                    showCustomAlert("¡Éxito!", "Contraseña actualizada correctamente.");
                    if (passLabel) passLabel.textContent = " " + "*".repeat(nuevaPass.length);
                } catch (error) {
                    console.error("Error al cambiar contraseña:", error);
                    if (error.code === 'auth/requires-recent-login') {
                        showCustomAlert(
                            "Seguridad",
                            "Por razones de seguridad, debes haber iniciado sesión recientemente para cambiar tu contraseña. Por favor, cierra sesión y vuelve a entrar antes de intentarlo de nuevo."
                        );
                    } else {
                        showCustomAlert("Error", "No se pudo actualizar la contraseña. Inténtalo de nuevo más tarde.");
                    }
                }
            });
        });
    }

   // --- LÓGICA PARA BORRAR LA CUENTA ---
    if (btnDeleteAccount) {
        btnDeleteAccount.addEventListener('click', (e) => {
            e.preventDefault();
            showCustomConfirm(
                "Borrar Cuenta",
                "¿Estás ABSOLUTAMENTE seguro de borrar tu cuenta? Todos tus datos, historial y saldo se perderán de forma permanente. Esta acción no se puede deshacer.",
                async () => {
                    try {
                        await eliminarCuentaUsuario();
                        window.location.href = "../index.html";
                    } catch (error) {
                        console.error("Error al borrar cuenta:", error);
                        if (error.code === 'auth/requires-recent-login') {
                            showCustomAlert(
                                "Seguridad",
                                "Por razones de seguridad, debes haber iniciado sesión recientemente para borrar tu cuenta. Por favor, cierra sesión y vuelve a entrar antes de intentarlo de nuevo."
                            );
                        } else {
                            showCustomAlert("Error", "No se pudo borrar la cuenta. Inténtalo de nuevo más tarde.");
                        }
                    }
                },
                "Borrar definitivamente",
                "Cancelar",
                "delete",
                true
            );
        });
    }

    if (btnEditProfile) {
        btnEditProfile.onclick = async () => {
            const user = auth.currentUser;
            const perfil = await obtenerPerfilUsuario(user.uid);
            
            editModal.classList.remove('hidden');
            document.getElementById('inputSetNombre').value = perfil.nombre || "";
            document.getElementById('inputSetApellidos').value = perfil.apellidos || "";
            
            const dateStr = perfil.fecha_nacimiento || ""; // dd-mm-yyyy
            if (dateStr && dateStr.includes("-") && dateStr.split("-")[0].length === 2) {
                const parts = dateStr.split("-");
                document.getElementById('inputSetFechaNac').value = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
                document.getElementById('inputSetFechaNac').value = dateStr;
            }

            document.getElementById('inputSetTelefono').value = perfil.telefono || "";
            
            const inputSetCurso = document.getElementById('inputSetCurso');
            const groupSetCurso = document.getElementById('groupSetCurso');
            if (inputSetCurso) inputSetCurso.value = perfil.curso || "";
            if (groupSetCurso) {
                groupSetCurso.style.display = (perfil.rol === 'docente') ? 'none' : 'block';
            }
        };
    }

    if (btnCancelEditSettings) btnCancelEditSettings.onclick = () => editModal.classList.add('hidden');

    if (btnSaveSettings) {
        btnSaveSettings.onclick = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const nom = document.getElementById('inputSetNombre').value.trim();
            const ape = document.getElementById('inputSetApellidos').value.trim();
            const rawFnac = document.getElementById('inputSetFechaNac').value.trim();
            const tel = document.getElementById('inputSetTelefono').value.trim();
            const cur = document.getElementById('inputSetCurso') ? document.getElementById('inputSetCurso').value.trim() : "";

            if (!nom || !ape || !rawFnac) {
                showCustomAlert("Error", "Los campos Nombre, Apellidos y Fecha de Nacimiento son obligatorios.");
                return;
            }

            let formattedFnac = rawFnac;
            if (rawFnac.includes("-") && rawFnac.split("-")[0].length === 4) {
                const parts = rawFnac.split("-");
                formattedFnac = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            try {
                const updateData = {
                    nombre: nom,
                    apellidos: ape,
                    nombre_completo: nom + " " + ape,
                    fecha_nacimiento: formattedFnac,
                    telefono: tel
                };
                
                // Solo guardar curso si es alumno (o si existe el input)
                if (document.getElementById('groupSetCurso').style.display !== 'none') {
                    updateData.curso = cur;
                }

                await actualizarPerfilUsuario(user.uid, updateData);

                if (displayNombre) displayNombre.innerText = nom;
                if (displayApellidos) displayApellidos.innerText = ape;
                if (displayFechaNac) displayFechaNac.innerText = formattedFnac;
                if (displayTelefono) displayTelefono.innerText = tel || 'No especificado';
                if (displayCurso) displayCurso.innerText = cur || 'No especificado';

                editModal.classList.add('hidden');
                showCustomAlert("Éxito", "Datos actualizados correctamente.");

            } catch (e) {
                console.error("Error guardando ajustes: ", e);
                showCustomAlert("Error", "Fallo al guardar los cambios.");
            }
        };
    }

    window.addEventListener('click', (event) => {
        if (event.target == editModal) editModal.classList.add('hidden');
    });

});
