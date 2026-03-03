document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuBtn');
    const sideMenu = document.getElementById('sideMenu');

    if (menuBtn && sideMenu) {
        menuBtn.addEventListener('click', (e) => {
            // Alterna la clase 'active' en el menú lateral para abrirlo
            sideMenu.classList.toggle('active');

            // Alterna la clase 'active' en el botón para el fondo gris
            menuBtn.classList.toggle('active');

            e.stopPropagation();
        });

        // Cerrar el menú y quitar el fondo gris al hacer clic fuera
        document.addEventListener('click', () => {
            sideMenu.classList.remove('active');
            menuBtn.classList.remove('active'); // Quita el fondo gris
        });
    }

    // Dropdown de perfil
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            profileDropdown.classList.toggle('show');
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            profileDropdown.classList.remove('show');
        });
    }
});
