document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('manualSidebar');
    const toggleBtn = document.getElementById('toggleIndex');

    if (!sidebar || !toggleBtn) return;

    // Toggle mobile sidebar
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
        toggleBtn.textContent = sidebar.classList.contains('active') ? 'Cerrar' : 'Índice';
    });

    // Toggle submenus and navigate
    const menuLinks = document.querySelectorAll('.menu-header');

    menuLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const parent = this.parentElement;

            if (parent.classList.contains('has-submenu')) {
                const isActive = parent.classList.contains('active');

                // Cerrar otros (opcional, para mantener el índice limpio)
                document.querySelectorAll('.has-submenu.active').forEach(item => {
                    if (item !== parent) item.classList.remove('active');
                });

                if (isActive) {
                    parent.classList.remove('active');
                } else {
                    parent.classList.add('active');
                }
            }
        });
    });

    // Enhanced Navigation: Scroll to center and Highlight
    const allLinks = sidebar.querySelectorAll('a[href^="#"]');

    allLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                e.preventDefault(); // Prevent default jump

                // Update URL hash without jumping
                history.pushState(null, null, targetId);

                // Scroll to target (uses scroll-margin-top from CSS)
                // Sub-menu links center the target, main menu headers scroll to start
                const isSubMenuLink = this.closest('.submenu');

                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: isSubMenuLink ? 'center' : 'start'
                });

                // Highlight Effect
                document.querySelectorAll('.highlight-target').forEach(el => {
                    el.classList.remove('highlight-target');
                });

                targetElement.classList.add('highlight-target');

                // Match CSS animation duration (2.5s)
                setTimeout(() => {
                    targetElement.classList.remove('highlight-target');
                }, 2700);

                // Mobile specific: Close sidebar if it's not a submenu parent link
                if (window.innerWidth <= 768 && !this.classList.contains('menu-header')) {
                    sidebar.classList.remove('active');
                    toggleBtn.textContent = 'Índice';
                }
            }
        });
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
                sidebar.classList.remove('active');
                toggleBtn.textContent = 'Índice';
            }
        }
    });
});
