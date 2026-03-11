import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const formRegister = document.getElementById("formRegister");
const fase1 = document.getElementById("fase1");
const fase2 = document.getElementById("fase2");

// Fields
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordRptInput = document.getElementById("passwordRpt");
const nombreInput = document.getElementById("nombre");
const apellidosInput = document.getElementById("apellidos");
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
    if (input.type === "password") {
        input.type = "text";
        button.textContent = "🙈";
    } else {
        input.type = "password";
        button.textContent = "👁️";
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
        errorMsg.textContent = "";

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const nombre = nombreInput.value.trim();
        const apellidos = apellidosInput.value.trim();
        const dni = dniInput.value.trim().toUpperCase();

        // Validaciones de la fase 2
        if (!nombre || !apellidos || !dni) {
            errorMsg.textContent = "Todos los campos de datos personales son obligatorios.";
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

        try {
            // 4.1. Crear usuario en Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 4.2. Guardar datos extra en Firestore (colección 'usuarios')
            // Usamos setDoc con el ID del usuario de Auth para enlazar los perfiles fácilmente
            await setDoc(doc(db, "usuarios", user.uid), {
                nombre: nombre,
                apellidos: apellidos,
                dni: dni,
                email: email
            });

            // 4.3. Éxito
            successMsg.textContent = "¡Registro exitoso! Redirigiendo al login...";
            formRegister.reset(); // Limpiar el formulario

            // Redirigir al login en 2 segundos
            setTimeout(() => {
                window.location.href = "../index.html";
            }, 2000);

        } catch (error) {
            console.error("Error al registrar:", error);
            if (error.code === 'auth/email-already-in-use') {
                errorMsg.textContent = "Este correo ya está registrado.";
            } else if (error.code === 'auth/invalid-email') {
                errorMsg.textContent = "El correo no tiene un formato válido.";
            } else {
                errorMsg.textContent = "Error al registrar el usuario: " + error.message;
            }
        }
    });
}