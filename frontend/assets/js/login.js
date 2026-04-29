
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// --- REFERENCIAS A LOS CONTENEDORES Y LOS DOS CAMPOS CLAVE DEL LOGIN ---
const formulario = document.getElementById("formLogin");
const usuarioInput = document.getElementById("username");
const contraseñaInput = document.getElementById("password");
const recordarCheckbox = document.getElementById("remember");
const mensajeError = document.getElementById("mensajeError");
const togglePassword = document.getElementById("togglePassword");

function toggleVisibility() {
    const img = togglePassword.querySelector('img');
    if (contraseñaInput.type === "password") {
        contraseñaInput.type = "text";
        if (img) img.src = "assets/img/icons/icono-ojo-no.png";
    } else {
        contraseñaInput.type = "password";
        if (img) img.src = "assets/img/icons/icono-ojo-si.png";
    }
}

if (togglePassword) {
    togglePassword.addEventListener("click", toggleVisibility);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
       
        const loginTimestamp = localStorage.getItem("loginTimestamp");
        if (loginTimestamp) {
            const sieteDiasEnMs = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - parseInt(loginTimestamp) > sieteDiasEnMs) {
                console.log("Sesión expirada (7 días). Cerrando sesión...");
                localStorage.removeItem("loginTimestamp");
                auth.signOut();
                return;
            }
        }
        window.location.href = "pages/principal.html";
    }
});

if (formulario) {
    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const email = usuarioInput.value.trim();
        const contraseña = contraseñaInput.value.trim();
        const recordar = recordarCheckbox.checked;

        if (email === "" || contraseña === "") {
            mensajeError.textContent = "Todos los campos son obligatorios.";
            return;
        }

        try {
           
            const persistence = recordar ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

           // --- INTENTAR HACER LOGIN EN FIREBASE ---
            const userCredential = await signInWithEmailAndPassword(auth, email, contraseña);

            if (recordar) {
                localStorage.setItem("loginTimestamp", Date.now().toString());
            } else {
                localStorage.removeItem("loginTimestamp");
            }

            const user = userCredential.user;

            // --- VERIFICAR BANEO ---
            const { obtenerPerfilUsuario } = await import('./database.js');
            const perfil = await obtenerPerfilUsuario(user.uid);
            if (perfil && perfil.baneado) {
                const ahora = Date.now();
                if (perfil.baneado_hasta === -1 || ahora < perfil.baneado_hasta) {
                    const hastaStr = perfil.baneado_hasta === -1 ? "de forma permanente" : "hasta el " + new Date(perfil.baneado_hasta).toLocaleString();
                    mensajeError.textContent = `Acceso denegado: Tu cuenta está restringida ${hastaStr}.`;
                    await auth.signOut();
                    return;
                }
            }

           // --- LOGIN EXITOSO, BORRAR ERROR Y REDIRIGIR ---
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

const olvidarLink = document.getElementById("olvidar");
if (olvidarLink) {
    olvidarLink.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = usuarioInput.value.trim();

        if (!email) {
            mensajeError.textContent = "Introduce tu correo para restablecer la contraseña.";
            mensajeError.style.color = "var(--red-2)";
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            mensajeError.textContent = "Se ha enviado un correo de recuperación a " + email;
            mensajeError.style.color = "var(--green-1)";
        } catch (error) {
            console.error("Error al enviar email de recuperación:", error);
            if (error.code === 'auth/user-not-found') {
                mensajeError.textContent = "No hay ningún usuario registrado con ese correo.";
            } else if (error.code === 'auth/invalid-email') {
                mensajeError.textContent = "Formato de correo inválido.";
            } else {
                mensajeError.textContent = "Error al enviar el email. Inténtalo de nuevo.";
            }
            mensajeError.style.color = "var(--red-2)";
        }
    });
}
