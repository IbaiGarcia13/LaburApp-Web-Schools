import { auth } from './firebase-config.js';
import {
    obtenerMetodosPago,
    actualizarSuscripcionUsuario,
    registrarPagoHistorial,
    obtenerPerfilUsuario,
    cancelarSuscripcionUsuario
} from './database.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    const cards = document.querySelectorAll('.sub-card:not(.card-none)');
    const modal = document.getElementById('subscriptionModal');
    const modalSubTitle = document.getElementById('modalSubTitle');
    const selectPayment = document.getElementById('selectSavedPayment');
    const noPaymentWarning = document.getElementById('noPaymentWarning');
    const btnCancel = document.getElementById('btnCancelSub');
    const btnConfirm = document.getElementById('btnConfirmPurchase');



    let selectedSub = null; // { type, id, price, name }
    let userProfile = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userProfile = await obtenerPerfilUsuario(user.uid);
        }
    });



    // --- CARGAR MÉTODOS DE PAGO AL ABRIR EL MODAL ---
    async function cargarMetodosPago(uid) {
        try {
            const metodos = await obtenerMetodosPago(uid);
            selectPayment.innerHTML = "";

            if (metodos.length === 0) {
                selectPayment.classList.add('hidden');
                noPaymentWarning.classList.remove('hidden');
                btnConfirm.disabled = true;
                btnConfirm.style.opacity = "0.5";
            } else {
                selectPayment.classList.remove('hidden');
                noPaymentWarning.classList.add('hidden');
                btnConfirm.disabled = false;
                btnConfirm.style.opacity = "1";

                metodos.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id_metodo;
                    opt.textContent = `${m.tipo}: ${m.detalle}`;
                    if (m.favorito) opt.selected = true;
                    selectPayment.appendChild(opt);
                });
            }
        } catch (error) {
            console.error("Error cargando métodos de pago:", error);
        }
    }

    // --- CLIC EN TARJETA DE SUSCRIPCIÓN ---
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const user = auth.currentUser;
            if (!user) {
                window.showCustomAlert("Acceso Restringido", "Debes iniciar sesión para adquirir una suscripción.");
                return;
            }

            const subType = card.dataset.type; // 'trabajador' o 'cliente'
            const subId = card.dataset.id;     // 'currante' o 'jefe'

            // Si ya tiene esta suscripción activa, no hacer nada
            if (userProfile) {
                const alreadyHas = (subType === 'trabajador' && userProfile.id_suscripcion_trabajador === subId) ||
                    (subType === 'cliente' && userProfile.id_suscripcion_cliente === subId);

                if (alreadyHas) return;
            }

            selectedSub = {
                type: subType,
                id: subId,
                price: card.dataset.price,
                name: card.querySelector('h3').textContent
            };

            if (modalSubTitle) {
                modalSubTitle.textContent = `Adquirir Suscripción ${selectedSub.name}`;
            }
            cargarMetodosPago(user.uid);
            modal.classList.remove('hidden');
        });
    });

    // --- CERRAR MODAL ---
    btnCancel.onclick = () => {
        modal.classList.add('hidden');
        selectedSub = null;
    };

    // --- CONFIRMAR COMPRA ---
    btnConfirm.onclick = async () => {
        const user = auth.currentUser;
        if (!user || !selectedSub) return;

        const idMetodo = selectPayment.value;
        if (!idMetodo) {
            window.showCustomAlert("Error", "Selecciona un método de pago.");
            return;
        }

        try {
            btnConfirm.disabled = true;
            btnConfirm.textContent = "Procesando...";

            // 1. Actualizar suscripción en el perfil
            await actualizarSuscripcionUsuario(user.uid, selectedSub.type, selectedSub.id);

            // 2. Registrar en el historial de pagos
            const detalle = `Compra suscripción ${selectedSub.name}`;
            const montoNegativo = -Math.abs(Number(selectedSub.price));
            await registrarPagoHistorial(user.uid, idMetodo, montoNegativo, detalle);

            window.showCustomAlert("¡Éxito!", `Suscripción ${selectedSub.name} activada correctamente.`);
            modal.classList.add('hidden');
            location.reload(); // Recargar para mostrar el estado actualizado

        } catch (error) {
            console.error("Error al procesar compra:", error);
            window.showCustomAlert("Error", "Hubo un problema al procesar el pago. Inténtalo de nuevo.");
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.textContent = "Confirmar Pago";
        }
    };

    // Cerrar al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            selectedSub = null;
        }
    });
});
