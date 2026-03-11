let misTareasData = [
    { id: 1, titulo: "Cortar el césped", desc: "Necesito a una persona que me corte el césped, se requiere maquinaria propia y...", loc: "Barakaldo, Bizkaia, Calle La Paz 21, 2ºF", tiempo: 5, pago: 30.75, cat: "jardineria", xp: 307, img: "../assets/img/principal1.png" },
    { id: 2, titulo: "Sacar al perro", desc: "Requiero de una persona para sacar a mi perro durante 2 horas por mi vecindario.", loc: "Castro Urdiales, Cantabria", tiempo: 2, pago: 20.5, cat: "mascotas", xp: 205, img: "../assets/img/trabajos/perro.jpg" },
    { id: 3, titulo: "Montar un Ordenador", desc: "Necesito que alguien me monte el ordenador, tengo los componentes...", loc: "Sestao, Bizkaia", tiempo: 4, pago: 40, cat: "informatica", xp: 400, img: "../assets/img/trabajos/pc.jpg" },
    { id: 4, titulo: "Tarta Cumpleaños", desc: "Es el cumpleaños de mi hija, y necesito una tarta para su cumpleaños. La tarta debe...", loc: "Sestao, Bizkaia", tiempo: 1, pago: 20, cat: "informatica", xp: 200, img: "../assets/img/trabajos/tarta.jpg" }
];

let filteredTareas = [...misTareasData];
let currentPage = 1;
const itemsPerPage = 4;

function displayTareas() {
    const container = document.getElementById('tareas-list');
    container.innerHTML = "";

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredTareas.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:white; text-align:center;'>No hay tareas para mostrar.</p>";
    }

    pageItems.forEach(tarea => {
        const catStr = tarea.cat.charAt(0).toUpperCase() + tarea.cat.slice(1);

        const card = `
            <article class="job-card" data-id="${tarea.id}" onclick="window.location.href='mi-tarea.html?id=${tarea.id}'">
                <div class="action-buttons">
                    <button class="action-btn edit-btn" title="Editar Tarea" onclick="event.stopPropagation(); editarTarea(${tarea.id})"><img src="../assets/img/icons/icono-editar.png" alt="Editar"></button>
                    <button class="action-btn delete-btn" title="Eliminar Tarea" onclick="event.stopPropagation(); confirmarEliminar(${tarea.id})"><img src="../assets/img/icons/icono-eliminar.png" alt="Eliminar"></button>
                </div>
                <!-- Usaremos un placeholder de imagen genérico si no se encuentra la imagen real, pero por la ref usaremos principal1.png -->
                <img src="../assets/img/principal1.png" class="job-img" onerror="this.src='../assets/img/principal1.png'">
                <div class="job-info">
                    <h3>${tarea.titulo}</h3>
                    <p class="job-desc">${tarea.desc}</p>
                    <div class="job-details">
                        <p><img src="../assets/img/icons/icono-ubicacion.png" class="icon-img-small" alt=""> ${tarea.loc}</p>
                        <p><img src="../assets/img/icons/icono-relog.png" class="icon-img-small" alt=""> Tiempo estimado: ${tarea.tiempo}h</p>
                        <p><img src="../assets/img/icons/icono-categoria.png" class="icon-img-small" alt=""> Categoría: ${catStr}</p>
                        <p><img src="../assets/img/icons/icono-xp.png" class="icon-img-small" alt=""> Experiencia: <strong>${tarea.xp} XP</strong></p>
                        <p><img src="../assets/img/icons/icono-dinero.png" class="icon-img-small" style="width:16px" alt=""> Pago: <strong>${Number.isInteger(tarea.pago) ? tarea.pago : Number(tarea.pago).toFixed(2)} €</strong></p>
                    </div>
                </div>
            </article>`;
        container.innerHTML += card;
    });

    const totalPages = Math.ceil(filteredTareas.length / itemsPerPage) || 1;
    document.getElementById('page-info').innerText = `${currentPage} - ${totalPages}`;
}

document.getElementById('update-btn').onclick = () => {
    const cat = document.getElementById('filter-category').value;
    const tMin = parseInt(document.getElementById('time-min').value) || 0;
    const tMax = parseInt(document.getElementById('time-max').value) || 1000;
    const pMin = parseFloat(document.getElementById('pay-min').value) || 0;
    const pMax = parseFloat(document.getElementById('pay-max').value) || 10000;

    const tMinRaw = document.getElementById('time-min').value;
    const tMaxRaw = document.getElementById('time-max').value;
    const pMinRaw = document.getElementById('pay-min').value;
    const pMaxRaw = document.getElementById('pay-max').value;
    
    const isFiltered = cat !== "todas" || tMinRaw !== "1" || tMaxRaw !== "100" || pMinRaw !== "2" || pMaxRaw !== "1000";
    const iconHtml = '<img src="../assets/img/icons/icono-ajustes.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    document.querySelector('.section-title').innerHTML = isFiltered ? iconHtml + "MIS TAREAS: Filtradas" : iconHtml + "MIS TAREAS: Todas";

    filteredTareas = misTareasData.filter(j => {
        const matchCat = (cat === "todas" || j.cat === cat);
        const matchTime = j.tiempo >= tMin && j.tiempo <= tMax;
        const matchPay = j.pago >= pMin && j.pago <= pMax;
        return matchCat && matchTime && matchPay;
    });

    currentPage = 1;
    displayTareas();
};

document.getElementById('next-page').onclick = () => {
    if (currentPage < Math.ceil(filteredTareas.length / itemsPerPage)) {
        currentPage++;
        displayTareas();
        window.scrollTo(0, 0);
    }
};

document.getElementById('prev-page').onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        displayTareas();
        window.scrollTo(0, 0);
    }
};

function editarTarea(id) {
    window.location.href = "mi-tarea.html?id=" + id;
}

function confirmarEliminar(id) {
    showCustomConfirm(
        "Borrar Tarea",
        "¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer.",
        () => {
            misTareasData = misTareasData.filter(t => t.id !== id);
            document.getElementById('update-btn').click(); // Re-aplicar filtros y renderizar
        },
        "Eliminar",
        "Cancelar"
    );
}

// Start
displayTareas();
