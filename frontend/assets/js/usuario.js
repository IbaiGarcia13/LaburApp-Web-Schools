// Lógica cargada al visualizar el perfil de un usuario externo
document.addEventListener('DOMContentLoaded', () => {
    const btnChat = document.getElementById('btn-chat');

    if (btnChat) {
        // Evento para abrir chat: muestra modal confirmando si desea chatear con él/ella
        btnChat.addEventListener('click', (e) => {
            e.preventDefault(); // Evita navegar directamente

            showCustomConfirm(
                "Chatear con usuario",
                "¿Quieres chatear con este usuario?",
                () => {
                    window.location.href = btnChat.getAttribute('href');
                },
                "Aceptar",
                "Cancelar"
            );
        });
    }
});