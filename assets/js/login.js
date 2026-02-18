document.addEventListener("DOMContentLoaded", function () {

    const formulario = document.getElementById("formLogin");
    const usuarioInput = document.getElementById("username");
    const contraseñaInput = document.getElementById("password");
    const mensajeError = document.getElementById("mensajeError");

    formulario.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const usuario = usuarioInput.value.trim();
        const contraseña = contraseñaInput.value.trim();

        // Validación básica frontend
        if (usuario === "" || contraseña === "") {
            mensajeError.textContent = "Todos los campos son obligatorios.";
            return;
        }

        if (usuario === "admin" && contraseña === "1234") {
            window.location.href = "principal.html";
            return;
        }

        try {
            // Preparado para backend futuro
            const respuesta = await fetch("http://localhost:8080/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: usuario,
                    password: contraseña
                })
            });

            if (respuesta.ok) {
                const datos = await respuesta.json();

                // Guardamos token cuando exista backend
                localStorage.setItem("token", datos.token);

                window.location.href = "dashboard.html";
            } else {
                mensajeError.textContent = "Usuario o contraseña incorrectos.";
            }

        } catch (error) {
            mensajeError.textContent = "Servidor no disponible.";
        }

    });

});