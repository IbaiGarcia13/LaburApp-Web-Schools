/**
 * Sistema de Gestión de Cookies para LaburApp
 * Maneja el banner de consentimiento y la configuración granular.
 */

export function initCookieConsent() {
    const consent = localStorage.getItem('cookie_consent');
    const isPage = window.location.pathname.includes('/pages/');
    const policyUrl = isPage ? 'politica-cookies.html' : 'pages/politica-cookies.html';

    // Inyectar HTML del banner si no hay consentimiento sacado
    if (!consent) {
        injectBanner(policyUrl);
    }

    // Escuchar eventos para abrir configuración desde la página de política
    window.addEventListener('openCookieBanner', () => {
        showConfigModal();
    });
}

function injectBanner(policyUrl) {
    if (document.getElementById('cookie-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = `
        <h3>🍪 Configuración de Cookies</h3>
        <p>Utilizamos cookies para personalizar contenido, anuncios y analizar nuestro tráfico. 
           Puedes aceptar todas o configurar tus preferencias. Más info en nuestra 
           <a href="${policyUrl}">Política de Cookies</a>.</p>
        <div class="cookie-buttons">
            <button class="cookie-btn configure" id="btn-cookie-config">Configurar</button>
            <button class="cookie-btn accept" id="btn-cookie-accept">Aceptar todas</button>
        </div>
    `;
    document.body.appendChild(banner);
    banner.style.display = 'flex';

    document.getElementById('btn-cookie-accept').onclick = () => {
        saveConsent({ technical: true, analytical: true, marketing: true });
        banner.style.display = 'none';
    };

    document.getElementById('btn-cookie-config').onclick = () => {
        showConfigModal();
    };
}

function showConfigModal() {
    let modal = document.getElementById('cookie-config-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cookie-config-modal';
        modal.innerHTML = `
            <div class="cookie-modal-content">
                <h3>Preferencias de Privacidad</h3>
                <p>Selecciona qué tipos de cookies permites:</p>
                
                <div class="cookie-option">
                    <div class="cookie-option-info">
                        <h4>Técnicas (Necesarias)</h4>
                        <p>Imprescindibles para el funcionamiento de la web.</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" checked disabled>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="cookie-option">
                    <div class="cookie-option-info">
                        <h4>Analíticas</h4>
                        <p>Nos ayudan a entender cómo usas la web (Google Analytics).</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="cookie-analytical" checked>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="cookie-buttons" style="margin-top: 20px;">
                    <button class="cookie-btn accept" id="btn-save-config">Guardar configuración</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    document.getElementById('btn-save-config').onclick = () => {
        const analytical = document.getElementById('cookie-analytical').checked;
        saveConsent({ technical: true, analytical, marketing: true });
        modal.style.display = 'none';
        const banner = document.getElementById('cookie-banner');
        if (banner) banner.style.display = 'none';
    };

    // Cerrar al hacer clic fuera
    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}

function saveConsent(preferences) {
    localStorage.setItem('cookie_consent', JSON.stringify(preferences));
    // Aquí se podrían activar/desactivar los scripts dinámicamente
    console.log('Consentimiento guardado:', preferences);

    // Si no se acepta marketing, podríamos informar a AdSense si fuera necesario
    if (!preferences.marketing) {
        // Lógica para npa (non-personalized ads) de Google
        (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1;
    }
}
