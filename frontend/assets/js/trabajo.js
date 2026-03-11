document.addEventListener("DOMContentLoaded", function () {
    const btnChat = document.getElementById("btn-chat");
    if (btnChat) {
        btnChat.addEventListener("click", function (e) {
            e.preventDefault();
            
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