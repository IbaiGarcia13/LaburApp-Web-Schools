document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('manualSidebar');
    const toggleBtn = document.getElementById('toggleIndex');

    if (!sidebar || !toggleBtn) return;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
        toggleBtn.textContent = sidebar.classList.contains('active') ? 'Cerrar' : 'Índice';
    });

    const menuLinks = document.querySelectorAll('.menu-header');

    menuLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const parent = this.parentElement;

            if (parent.classList.contains('has-submenu')) {
                const isActive = parent.classList.contains('active');

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

    const allLinks = sidebar.querySelectorAll('a[href^="#"]');

    allLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                e.preventDefault();

                history.pushState(null, null, targetId);

               // --- SUB-MENU LINKS CENTER THE TARGET, MAIN MENU HEADERS SCROLL TO START ---

                const shouldCenter = this.classList.contains('scroll-center') || this.parentElement.classList.contains('scroll-center');

                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: shouldCenter ? 'center' : 'start'
                });

                document.querySelectorAll('.highlight-target').forEach(el => {
                    el.classList.remove('highlight-target');
                });

                targetElement.classList.add('highlight-target');

                setTimeout(() => {
                    targetElement.classList.remove('highlight-target');
                }, 2700);

                if (window.innerWidth <= 768 && !this.classList.contains('menu-header')) {
                    sidebar.classList.remove('active');
                    toggleBtn.textContent = 'Índice';
                }
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
                sidebar.classList.remove('active');
                toggleBtn.textContent = 'Índice';
            }
        }
    });
});
