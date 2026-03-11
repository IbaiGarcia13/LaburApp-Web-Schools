// Evento que se ejecuta al cargar la página de detalle de un trabajo
document.addEventListener("DOMContentLoaded", function () {
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        // Al pulsar el botón de Iniciar Chat con el anunciante, pedimos confirmación
        btnChat.addEventListener("click", function (e) {
            e.preventDefault(); // Evitamos salto de enlace inmediato

            showCustomConfirm(
                "Aviso",
                "¿Quieres chatear con el usuario que ha publicado el trabajo?",
                () => {
                    window.location.href = "chat.html";
                },
                "Aceptar",
                "Cancelar",
                "confirm"
            );
        });
    }
});