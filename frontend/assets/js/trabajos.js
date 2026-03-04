const trabajosData = [
    { titulo: "Cortar el césped", desc: "Necesito a una persona que me corte el césped, se requiere maquinaria propia.", loc: "Barakaldo, Bizkaia", tiempo: 5, pago: 30, cat: "jardineria", xp: 300 },
    { titulo: "Sacar al perro", desc: "Requiero de una persona para sacar a mi perro durante 2 horas.", loc: "Bilbao, Bizkaia", tiempo: 2, pago: 20, cat: "mascotas", xp: 200 },
    { titulo: "Montar un Ordenador", desc: "Alguien para montar componentes nuevos en una torre gaming.", loc: "Sestao, Bizkaia", tiempo: 3, pago: 45, cat: "informatica", xp: 450 },
    { titulo: "Tarta Cumpleaños", desc: "Una tarta personalizada de chocolate para 12 personas.", loc: "Bilbao, Bizkaia", tiempo: 2, pago: 35, cat: "gastronomia", xp: 350 },
    { titulo: "Limpieza de Garaje", desc: "Limpieza general de un garaje privado tras obra.", loc: "Portugalete, Bizkaia", tiempo: 6, pago: 60, cat: "limpieza", xp: 600 },
    { titulo: "Poda de Setos", desc: "Recortar setos perimetrales de una finca.", loc: "Laredo, Cantabria", tiempo: 4, pago: 40, cat: "jardineria", xp: 400 },
    { titulo: "Paseo diario perros", desc: "Paseo de 1 hora por la mañana para dos Golden Retriever.", loc: "Getxo, Bizkaia", tiempo: 1, pago: 15, cat: "mascotas", xp: 150 },
    { titulo: "Formatear Portátil", desc: "Instalación de sistema operativo y copia de seguridad.", loc: "Santander, Cantabria", tiempo: 2, pago: 25, cat: "informatica", xp: 250 },
    { titulo: "Cena de Empresa", desc: "Catering para 10 personas en oficina pequeña.", loc: "Basauri, Bizkaia", tiempo: 3, pago: 120, cat: "gastronomia", xp: 1200 },
    { titulo: "Limpieza Ventanas", desc: "Limpieza de cristales en un piso de 3 habitaciones.", loc: "Barakaldo, Bizkaia", tiempo: 4, pago: 50, cat: "limpieza", xp: 500 },
    { titulo: "Desbrozar Terreno", desc: "Eliminar maleza de un terreno de 100m2.", loc: "Castro Urdiales, Cantabria", tiempo: 8, pago: 100, cat: "jardineria", xp: 1000 },
    { titulo: "Cuidado de Gatos", desc: "Visitar y alimentar a dos gatos durante el fin de semana.", loc: "Bilbao, Bizkaia", tiempo: 1, pago: 12, cat: "mascotas", xp: 120 },
    { titulo: "Reparar Impresora", desc: "Atasco de papel recurrente y configuración wifi.", loc: "Erandio, Bizkaia", tiempo: 1, pago: 20, cat: "informatica", xp: 200 },
    { titulo: "Preparación de Tupper", desc: "Cocinar menú semanal variado para una persona.", loc: "Sestao, Bizkaia", tiempo: 5, pago: 70, cat: "gastronomia", xp: 700 },
    { titulo: "Limpieza Cocina", desc: "Limpieza a fondo de campana y electrodomésticos.", loc: "Portugalete, Bizkaia", tiempo: 3, pago: 45, cat: "limpieza", xp: 450 },
    { titulo: "Mantenimiento Huerto", desc: "Quitar malas hierbas y abonar huerto pequeño.", loc: "Getxo, Bizkaia", tiempo: 3, pago: 30, cat: "jardineria", xp: 300 },
    { titulo: "Alojamiento Mascotas", desc: "Cuidar a un cachorro una noche en casa del cuidador.", loc: "Barakaldo, Bizkaia", tiempo: 10, pago: 40, cat: "mascotas", xp: 400 },
    { titulo: "Recuperar Datos USB", desc: "Recuperar fotos de un pendrive dañado.", loc: "Bilbao, Bizkaia", tiempo: 2, pago: 30, cat: "informatica", xp: 300 },
    { titulo: "Buffet para Fiesta", desc: "Preparar aperitivos para fiesta de 15 personas.", loc: "Laredo, Cantabria", tiempo: 4, pago: 90, cat: "gastronomia", xp: 900 },
    { titulo: "Limpieza de Sofá", desc: "Limpieza con vaporeta de sofá de 3 plazas.", loc: "Basauri, Bizkaia", tiempo: 2, pago: 35, cat: "limpieza", xp: 350 }
];

let filteredJobs = [...trabajosData];
let currentPage = 1;
const itemsPerPage = 5;

function displayJobs() {
    const container = document.getElementById('jobs-list');
    container.innerHTML = "";

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredJobs.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:white; text-align:center;'>No hay trabajos disponibles.</p>";
    }

    pageItems.forEach(job => {
        const card = `
            <article class="job-card">
                <img src="../assets/img/principal1.png" class="job-img">
                <div class="job-info">
                    <h3>${job.titulo}</h3>
                    <p class="job-desc">${job.desc}</p>
                    <div class="job-details">
                        <p>📍 ${job.loc}</p>
                        <p>🕒 Tiempo estimado: ${job.tiempo}h</p>
                        <p>💰 Pago: ${job.pago} €</p>
                        <p>🧠 Categoría: ${job.cat.charAt(0).toUpperCase() + job.cat.slice(1)}</p>
                        <p><span class="xp-icon"></span> Experiencia: ${job.xp} XP</p>
                    </div>
                </div>
            </article>`;
        container.innerHTML += card;
    });

    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage) || 1;
    document.getElementById('page-info').innerText = `${currentPage} - ${totalPages}`;
}

document.getElementById('update-btn').onclick = () => {
    const cat = document.getElementById('filter-category').value;
    const tMin = parseInt(document.getElementById('time-min').value);
    const tMax = parseInt(document.getElementById('time-max').value);
    const pMin = parseFloat(document.getElementById('pay-min').value);
    const pMax = parseFloat(document.getElementById('pay-max').value);

    filteredJobs = trabajosData.filter(j => {
        const matchCat = (cat === "todas" || j.cat === cat);
        const matchTime = j.tiempo >= tMin && j.tiempo <= tMax;
        const matchPay = j.pago >= pMin && j.pago <= pMax;
        return matchCat && matchTime && matchPay;
    });

    currentPage = 1;
    displayJobs();
};

document.getElementById('next-page').onclick = () => {
    if (currentPage < Math.ceil(filteredJobs.length / itemsPerPage)) {
        currentPage++;
        displayJobs();
        window.scrollTo(0, 0);
    }
};

document.getElementById('prev-page').onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        displayJobs();
        window.scrollTo(0, 0);
    }
};

displayJobs();