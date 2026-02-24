document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuBtn');
    const sideMenu = document.getElementById('sideMenu');

    menuBtn.addEventListener('click', (e) => {
        // Alterna la clase 'active' en el menú lateral para abrirlo
        sideMenu.classList.toggle('active');
        
        // ESTO ES LO NUEVO: Alterna la clase 'active' en el botón para el fondo gris
        menuBtn.classList.toggle('active');
        
        e.stopPropagation();
    });

    // Cerrar el menú y quitar el fondo gris al hacer clic fuera
    document.addEventListener('click', () => {
        sideMenu.classList.remove('active');
        menuBtn.classList.remove('active'); // Quita el fondo gris
    });
});