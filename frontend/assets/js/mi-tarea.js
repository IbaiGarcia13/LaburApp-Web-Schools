// Control de los datos mostrados y modales de edición en la vista de detalle de una tarea personal
document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DE PANTALLA ---
    // Sección 1: Principal
    const displayTitle = document.getElementById('displayTitle');
    const displayDesc = document.getElementById('displayDesc');
    const displayLoc = document.getElementById('displayLoc');

    // Sección 2: Pago
    const displayPay = document.getElementById('displayPay');
    const displayExp = document.getElementById('displayExp');

    // Sección 3: Info
    const displayCat = document.getElementById('displayCat');
    const displayTime = document.getElementById('displayTime');
    const displayDate = document.getElementById('displayDate');

    // --- MODAL 1: PRINCIPAL ---
    const modalMain = document.getElementById('modalMain');
    const btnEditMain = document.getElementById('btnEditMain');
    const btnCancelMain = document.getElementById('btnCancelMain');
    const btnSaveMain = document.getElementById('btnSaveMain');

    // Inputs del Modal 1 (Formularios ocultos que recogen la edición)
    const inputTitle = document.getElementById('inputTitle');
    const inputDesc = document.getElementById('inputDesc');
    const inputLoc = document.getElementById('inputLoc');

    // Botón para editar la primera sección: carga los datos actuales en el formulario y lo hace visible
    btnEditMain.onclick = () => {
        inputTitle.value = displayTitle.textContent;
        // Limpiamos espacios en blanco del HTML al leer la descripción
        inputDesc.value = displayDesc.textContent.trim().replace(/\s+/g, ' ');
        inputLoc.value = displayLoc.textContent;
        modalMain.classList.remove('hidden');
    };

    btnCancelMain.onclick = () => modalMain.classList.add('hidden');

    // Botón para guardar los cambios y cerrar la ventana 1
    btnSaveMain.onclick = () => {
        displayTitle.textContent = inputTitle.value;
        displayDesc.textContent = inputDesc.value;
        displayLoc.textContent = inputLoc.value;
        modalMain.classList.add('hidden');
    };

    // --- MODAL 2: PAGO ---
    const modalPay = document.getElementById('modalPay');
    const btnEditPay = document.getElementById('btnEditPay');
    const btnCancelPay = document.getElementById('btnCancelPay');
    const btnSavePay = document.getElementById('btnSavePay');
    const inputPay = document.getElementById('inputPay');

    btnEditPay.onclick = () => {
        inputPay.value = parseFloat(displayPay.textContent);
        modalPay.classList.remove('hidden');
    };

    btnCancelPay.onclick = () => modalPay.classList.add('hidden');

    // Evento de guardado del pago: actualiza el precio y recalcula mecánicamente la "experiencia" asociada a la tarea
    btnSavePay.onclick = () => {
        const newValue = parseFloat(inputPay.value);
        if (!isNaN(newValue)) {
            displayPay.textContent = newValue.toFixed(2);
            // Experiencia es el 1000% del pago en LaburApp (Pago * 10)
            displayExp.textContent = Math.round(newValue * 10);
        }
        modalPay.classList.add('hidden');
    };

    // --- MODAL 3: INFORMACIÓN EXTRA ---
    const modalInfo = document.getElementById('modalInfo');
    const btnEditInfo = document.getElementById('btnEditInfo');
    const btnCancelInfo = document.getElementById('btnCancelInfo');
    const btnSaveInfo = document.getElementById('btnSaveInfo');

    // Inputs Modal 3
    const inputCat = document.getElementById('inputCat');
    const inputTime = document.getElementById('inputTime');
    const inputDate = document.getElementById('inputDate');

    // Abre y pre-llena el tercer modal dedicado a categorías, fechas y tiempo
    btnEditInfo.onclick = () => {
        // En el caso de un <select>, iteramos para forzar la selección de la opción ya cargada visualmente
        const currentCat = displayCat.textContent;
        for (let i = 0; i < inputCat.options.length; i++) {
            if (inputCat.options[i].value === currentCat) {
                inputCat.selectedIndex = i;
                break;
            }
        }

        inputTime.value = displayTime.textContent.replace('h', '').trim(); // Remove 'h' for editing convenience

        const dateParts = displayDate.textContent.split('/');
        if (dateParts.length === 3) {
            inputDate.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        } else {
            inputDate.value = displayDate.textContent;
        }

        modalInfo.classList.remove('hidden');
    };

    btnCancelInfo.onclick = () => modalInfo.classList.add('hidden');

    btnSaveInfo.onclick = () => {
        // Actualiza el texto con el valor seleccionado
        displayCat.textContent = inputCat.value;

        // Comprueba y añade la unidad 'h' de horas automáticamente si no está escrita
        let timeVal = inputTime.value.trim();
        if (timeVal && !timeVal.toLowerCase().endsWith('h')) {
            timeVal += 'h';
        }
        displayTime.textContent = timeVal;

        const dateVal = inputDate.value;
        if (dateVal && dateVal.includes('-')) {
            const parts = dateVal.split('-');
            displayDate.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
            displayDate.textContent = dateVal;
        }

        modalInfo.classList.add('hidden');
    };

    // --- CERRAR MODALES AL CLICAR FUERA ---
    window.onclick = (event) => {
        if (event.target == modalMain) modalMain.classList.add('hidden');
        if (event.target == modalPay) modalPay.classList.add('hidden');
        if (event.target == modalInfo) modalInfo.classList.add('hidden');
    };

});
