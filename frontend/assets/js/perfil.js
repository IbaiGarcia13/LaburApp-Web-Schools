document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DE CERRAR SESIÓN ---
    // (Ahora manejada globalmente en general.js)

    // --- LÓGICA DE CAMBIAR CONTRASEÑA ---
    const btnChangePass = document.getElementById('btnChangePass');
    const passLabel = document.getElementById('passLabel');

    btnChangePass.addEventListener('click', (e) => {
        e.preventDefault();
        showCustomPrompt(
            "Cambiar Contraseña",
            "Introduce tu nueva contraseña:",
            (nuevaPass) => {
                if (nuevaPass && nuevaPass.trim() !== "") {
                    showCustomAlert("Éxito", "Contraseña actualizada correctamente.");
                    passLabel.textContent = "*".repeat(nuevaPass.length);
                }
            },
            "Actualizar",
            "Cancelar",
            "password"
        );
    });

    // --- LÓGICA DEL MODAL DE EDICIÓN ---
    const modal = document.getElementById('editModal');
    const btnOpen = document.getElementById('btnOpenEdit');
    const btnClose = document.getElementById('modal-btn cancel');
    const btnSave = document.getElementById('modal-btn confirm');

    // Elementos de la página a actualizar
    const displayName = document.getElementById('displayName');
    const displayDescription = document.getElementById('displayDescription');
    const displayAddress = document.getElementById('displayAddress');
    const displayPic = document.getElementById('displayPic');

    // Abrir Modal
    btnOpen.onclick = () => {
        modal.style.display = "flex";
        // Cargar valores actuales en los inputs
        document.getElementById('inputName').value = displayName.textContent;
        document.getElementById('inputDescription').value = displayDescription.textContent.trim();
        const addressMatch = displayAddress.textContent;
        document.getElementById('inputAddress').value = addressMatch !== "" ? addressMatch : "";
    };

    // Cerrar Modal
    btnClose.onclick = () => modal.style.display = "none";

    // Guardar Cambios
    btnSave.onclick = () => {
        const newName = document.getElementById('inputName').value;
        const newDescription = document.getElementById('inputDescription').value;
        const newAddress = document.getElementById('inputAddress').value;
        const photoFile = document.getElementById('inputPhoto').files[0];
        const pdfFile = document.getElementById('inputPDF').files[0];
        const displayPDF = document.getElementById('displayPDF');

        // Si el usuario seleccionó un nuevo archivo PDF
        if (pdfFile) {
            // Creamos una URL temporal para el archivo subido
            const pdfUrl = URL.createObjectURL(pdfFile);

            // Cambiamos el destino del enlace al nuevo archivo
            displayPDF.href = pdfUrl;

            // Opcional: Cambiar el texto para mostrar el nombre del archivo subido
            displayPDF.textContent = "Currículum: " + pdfFile.name;

            showCustomAlert("Éxito", "Nuevo currículum cargado correctamente.");
        }
        // Actualizar Nombre
        if (newName.trim() !== "") displayName.textContent = newName;

        // Actualizar Descripción
        if (newDescription.trim() !== "") displayDescription.textContent = newDescription;

        // Actualizar Dirección (Opcional)
        if (newAddress.trim() !== "") displayAddress.textContent = newAddress;

        // Actualizar Foto (Vista previa)
        if (photoFile) {
            const reader = new FileReader();
            reader.onload = (e) => displayPic.src = e.target.result;
            reader.readAsDataURL(photoFile);
        }

        // Notificación PDF
        if (pdfFile) {
            showCustomAlert("Éxito", `Currículum seleccionado: ${pdfFile.name}\nPerfil guardado con éxito.`);
        } else {
            showCustomAlert("Éxito", "Perfil guardado con éxito.");
        }

        modal.style.display = "none";
    };

    // Cerrar al hacer clic fuera del modal
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    };
});