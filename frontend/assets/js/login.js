// Esperamos a que la página se cargue totalmente antes de vincular eventos
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Referencias a los contenedores y los dos campos clave del login
const formulario = document.getElementById("formLogin");
const usuarioInput = document.getElementById("username"); // It's username visually but an email practically for Firebase
const contraseñaInput = document.getElementById("password");
const mensajeError = document.getElementById("mensajeError");

// Escuchador que intercepta la recarga de página al darle al botón "Iniciar Sesión"
if (formulario) {
    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault(); // Evita que se recargue la web

        const email = usuarioInput.value.trim();
        const contraseña = contraseñaInput.value.trim();

        // Validación básica frontend
        if (email === "" || contraseña === "") {
            mensajeError.textContent = "Todos los campos son obligatorios.";
            return;
        }

        try {
            // Intentar hacer login en Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, contraseña);
            const user = userCredential.user;

            // Login exitoso, borrar error y redirigir
            mensajeError.textContent = "";
            window.location.href = "pages/principal.html";
        } catch (error) {
            console.error("Error signing in", error);
            const errorCode = error.code;

            if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
                mensajeError.textContent = "Correo o contraseña incorrectos.";
            } else if (errorCode === 'auth/invalid-email') {
                mensajeError.textContent = "El formato del correo es inválido.";
            } else {
                mensajeError.textContent = "Error al iniciar sesión. Inténtalo de nuevo.";
            }
        }
    });
}