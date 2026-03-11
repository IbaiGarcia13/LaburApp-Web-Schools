document.addEventListener('DOMContentLoaded', () => {
    const btnChat = document.getElementById('btn-chat');
    
    if (btnChat) {
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