import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, query, where, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const formRegister = document.getElementById("formRegister");
const fase1 = document.getElementById("fase1");
const fase2 = document.getElementById("fase2");

// Fields
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordRptInput = document.getElementById("passwordRpt");
const nombreInput = document.getElementById("nombre");
const apellidosInput = document.getElementById("apellidos");
const fechaNacInput = document.getElementById("fechaNac");
const dniInput = document.getElementById("dni");

// Buttons & Error
const btnSiguiente = document.getElementById("btnSiguiente");
const btnAtras = document.getElementById("btnAtras");
const togglePassword = document.getElementById("togglePassword");
const togglePasswordRpt = document.getElementById("togglePasswordRpt");
const errorMsg = document.getElementById("registerError");
const successMsg = document.getElementById("registerSuccess");

// 1. Mostrar/Ocultar contraseñas
function toggleVisibility(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    const img = button.querySelector('img');

    if (input.type === "password") {
        input.type = "text";
        if (img) img.src = "../assets/img/icons/icono-ojo-no.png";
    } else {
        input.type = "password";
        if (img) img.src = "../assets/img/icons/icono-ojo-si.png";
    }
}

if (togglePassword) {
    togglePassword.addEventListener("click", () => toggleVisibility("password", "togglePassword"));
}
if (togglePasswordRpt) {
    togglePasswordRpt.addEventListener("click", () => toggleVisibility("passwordRpt", "togglePasswordRpt"));
}

// 2. Navegación entre fases
if (btnSiguiente) {
    btnSiguiente.addEventListener("click", () => {
        errorMsg.textContent = ""; // Limpiar errores

        // Basic check for required Phase 1 fields
        if (!emailInput.value || !passwordInput.value || !passwordRptInput.value) {
            errorMsg.textContent = "Rellena todos los campos de la fase 1.";
            return;
        }

        // Check if passwords match
        if (passwordInput.value !== passwordRptInput.value) {
            errorMsg.textContent = "Las contraseñas no coinciden.";
            return;
        }

        // Password length check (Firebase requires at least 6)
        if (passwordInput.value.length < 6) {
            errorMsg.textContent = "La contraseña debe tener al menos 6 caracteres.";
            return;
        }

        // Proceed to Phase 2
        fase1.classList.add("hidden");
        fase2.classList.remove("hidden");
    });
}

if (btnAtras) {
    btnAtras.addEventListener("click", () => {
        fase2.classList.add("hidden");
        fase1.classList.remove("hidden");
        errorMsg.textContent = "";
    });
}

// 3. Validación de DNI (básica)
function isDniValid(dni) {
    const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;
    return dniRegex.test(dni);
}

// 4. Enviar formulario a Firebase
if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("Iniciando proceso de registro...");
        errorMsg.textContent = "";
        successMsg.textContent = "";

        const btnReg = document.getElementById("btnRegistrarse");
        if (btnReg) {
            btnReg.disabled = true;
            btnReg.textContent = "Registrando...";
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const nombre = nombreInput.value.trim();
        const apellidos = apellidosInput.value.trim();
        const dNac = fechaNacInput ? fechaNacInput.value.trim() : "";
        const dni = dniInput.value.trim().toUpperCase();

        // Validaciones de la fase 2
        if (!nombre || !apellidos || !dni || !dNac) {
            errorMsg.textContent = "Todos los campos de datos personales (incluyendo Fecha Nac.) son obligatorios.";
            if (btnReg) {
                btnReg.disabled = false;
                btnReg.textContent = "Registrarse";
            }
            return;
        }

        if (nombre.length > 30) {
            errorMsg.textContent = "El nombre no puede tener más de 30 caracteres.";
            return;
        }

        if (apellidos.length > 70) {
            errorMsg.textContent = "Los apellidos no pueden tener más de 70 caracteres.";
            return;
        }

        if (!isDniValid(dni)) {
            errorMsg.textContent = "El formato del DNI no es válido (ej: 12345678A).";
            return;
        }

        // --- VALIDACIÓN DE EDAD (Mínimo 16 años) ---
        const birthDate = new Date(dNac);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        console.log("Validando datos personales...");
        if (age < 16) {
            errorMsg.textContent = "Debes tener al menos 16 años para registrarte.";
            if (btnReg) {
                btnReg.disabled = false;
                btnReg.textContent = "Registrarse";
            }
            return;
        }

        // Format date to DD-MM-YYYY if it comes from date input as YYYY-MM-DD
        let formattedDate = dNac;
        if (dNac.includes("-") && dNac.split("-")[0].length === 4) {
            const parts = dNac.split("-");
            formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        try {
            console.log("Verificando DNI único...");
            const q = query(collection(db, "usuarios"), where("dni", "==", dni));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                errorMsg.textContent = "Ya existe un usuario registrado con este DNI.";
                return;
            }

            // 4.1. Crear usuario en Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 4.2. Guardar datos extra en Firestore (colección 'usuarios')
            // Usamos setDoc con el ID del usuario de Auth para enlazar los perfiles fácilmente
            await setDoc(doc(db, "usuarios", user.uid), {
                nombre: nombre,
                nombre_completo: nombre + " " + apellidos,
                apellidos: apellidos,
                dni: dni,
                email: email,
                fecha_nacimiento: formattedDate,  // Fecha de nacimiento introducida por el usuario
                fecha_ingreso: serverTimestamp(),  // Fecha real de registro en la plataforma
                nivel: 1,
                experiencia_total: 0,
                experiencia_nivel_actual: 0,
                valoracion_media: 2.5,
                num_valoraciones: 1, // La valoración inicial de 2.5 cuenta como la primera
                dinero_ganado_total: 0,
                id_suscripcion_trabajador: "ninguna",
                id_suscripcion_cliente: "ninguna"
            });

            // 4.3. Éxito
            formRegister.reset(); // Limpiar el formulario
            window.showCustomAlert("¡Registro exitoso!", "Tu cuenta ha sido creada. Pulsa aceptar para ir al login.", "Aceptar", () => {
                window.location.href = "../index.html";
            });

        } catch (error) {
            console.error("Error al registrar:", error);
            if (btnReg) {
                btnReg.disabled = false;
                btnReg.textContent = "Registrarse";
            }
            if (error.code === 'auth/email-already-in-use') {
                errorMsg.textContent = "Este correo ya está registrado.";
            } else if (error.code === 'auth/invalid-email') {
                errorMsg.textContent = "El correo no tiene un formato válido.";
            } else if (error.code === 'auth/weak-password') {
                errorMsg.textContent = "La contraseña es muy débil (mínimo 6 caracteres).";
            } else {
                errorMsg.textContent = "Error al registrar el usuario: " + error.message;
            }
        }
    });
}
