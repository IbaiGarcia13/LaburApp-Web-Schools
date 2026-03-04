const usuariosData = [
    { nombre: "Juan García Méndez", desc: "Informático que hace páginas web y arregla ordenadores en su tiempo libre.", loc: "Barakaldo, Bizkaia", lvl: 6, val: 3.7, esp: "informatica" },
    { nombre: "María Isabel Gómez", desc: "Ama de casa con experiencia paseando perros y cuidando animales.", loc: "Castro Urdiales, Cantabria", lvl: 2, val: 4.2, esp: "mascotas" },
    { nombre: "Asier Uriarte González", desc: "Me gusta la jardinería y la gastronomía, tengo experiencia de cocinero.", loc: "Castro Urdiales, Cantabria", lvl: 4, val: 4.7, esp: "jardineria" },
    { nombre: "Eneko Lozano Fuertes", desc: "Ex-trabajador de Ikea con mucha experiencia montando muebles.", loc: "Sestao, Bizkaia", lvl: 1, val: 3.1, esp: "carpinteria" },
    { nombre: "Laura Martínez", desc: "Limpieza profunda de hogares y oficinas con materiales propios.", loc: "Bilbao, Bizkaia", lvl: 5, val: 4.9, esp: "limpieza" },
    { nombre: "Carlos Ruiz", desc: "Reparación de hardware y configuración de redes locales.", loc: "Barakaldo, Bizkaia", lvl: 8, val: 4.5, esp: "informatica" },
    { nombre: "Sofía Vega", desc: "Paseadora de perros de razas grandes y adiestramiento básico.", loc: "Getxo, Bizkaia", lvl: 3, val: 3.8, esp: "mascotas" },
    { nombre: "Diego San José", desc: "Diseño de jardines y mantenimiento de piscinas.", loc: "Laredo, Cantabria", lvl: 7, val: 4.1, esp: "jardineria" },
    { nombre: "Marta Ibáñez", desc: "Montaje de armarios empotrados y arreglos de madera.", loc: "Portugalete, Bizkaia", lvl: 2, val: 3.5, esp: "carpinteria" },
    { nombre: "Jorge Blanco", desc: "Limpieza de cristales en altura y mantenimiento general.", loc: "Bilbao, Bizkaia", lvl: 4, val: 4.0, esp: "limpieza" },
    { nombre: "Elena Prieto", desc: "Desarrollo de apps móviles y consultoría tecnológica.", loc: "Santander, Cantabria", lvl: 9, val: 5.0, esp: "informatica" },
    { nombre: "Raúl Goti", desc: "Cuidado de gatos a domicilio y visitas veterinarias.", loc: "Barakaldo, Bizkaia", lvl: 1, val: 4.2, esp: "mascotas" },
    { nombre: "Sara Otero", desc: "Podas de frutales y cuidado de huertos urbanos.", loc: "Basauri, Bizkaia", lvl: 6, val: 4.3, esp: "jardineria" },
    { nombre: "Pablo Herrero", desc: "Restauración de muebles antiguos y barnizado.", loc: "Erandio, Bizkaia", lvl: 3, val: 3.9, esp: "carpinteria" },
    { nombre: "Lucía Méndez", desc: "Limpieza de fin de obra y desinfección total.", loc: "Bilbao, Bizkaia", lvl: 7, val: 4.6, esp: "limpieza" },
    { nombre: "Iker Casado", desc: "Técnico de soporte remoto y eliminación de virus.", loc: "Barakaldo, Bizkaia", lvl: 4, val: 3.2, esp: "informatica" },
    { nombre: "Andrea Soler", desc: "Peluquería canina a domicilio.", loc: "Getxo, Bizkaia", lvl: 5, val: 4.8, esp: "mascotas" },
    { nombre: "Víctor Peña", desc: "Corte de setos y desbroce de parcelas.", loc: "Castro Urdiales, Cantabria", lvl: 2, val: 3.4, esp: "jardineria" },
    { nombre: "Nerea Ortiz", desc: "Montaje de cocinas y estanterías metálicas.", loc: "Sestao, Bizkaia", lvl: 8, val: 4.7, esp: "carpinteria" },
    { nombre: "Manuel Garea", desc: "Limpieza de comunidades y portales.", loc: "Bilbao, Bizkaia", lvl: 3, val: 4.1, esp: "limpieza" }
];

let filteredUsers = [...usuariosData];
let currentPage = 1;
const itemsPerPage = 5;

function displayUsers() {
    const container = document.getElementById('users-list');
    container.innerHTML = "";

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredUsers.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = "<p style='color:white; text-align:center;'>No se encontraron usuarios.</p>";
    }

    pageItems.forEach(user => {
        const card = `
            <article class="user-card">
                <img src="../assets/img/Ibai.jpg" class="user-img">
                <div class="user-info">
                    <h3>${user.nombre}</h3>
                    <p class="user-desc">${user.desc}</p>
                    <div class="user-stats">
                        <p>📍 ${user.loc}</p>
                        <p>💼 Nivel: ${user.lvl}</p>
                        <p>⭐ Valoración Media: ${user.val}</p>
                        <p>🧠 Especialidad: ${user.esp.charAt(0).toUpperCase() + user.esp.slice(1)}</p>
                    </div>
                </div>
            </article>`;
        container.innerHTML += card;
    });

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
    document.getElementById('page-info').innerText = `${currentPage} - ${totalPages}`;
}

document.getElementById('update-btn').onclick = () => {
    const cat = document.getElementById('filter-category').value;
    const lvl = parseInt(document.getElementById('filter-level').value);
    const minV = parseFloat(document.getElementById('val-min').value);
    const maxV = parseFloat(document.getElementById('val-max').value);

    filteredUsers = usuariosData.filter(u => {
        const matchCat = (cat === "todas" || u.esp === cat);
        const matchLvl = u.lvl >= lvl;
        const matchVal = parseFloat(u.val) >= minV && parseFloat(u.val) <= maxV;
        return matchCat && matchLvl && matchVal;
    });

    currentPage = 1;
    displayUsers();
};

document.getElementById('next-page').onclick = () => {
    if (currentPage < Math.ceil(filteredUsers.length / itemsPerPage)) {
        currentPage++;
        displayUsers();
        window.scrollTo(0, 0);
    }
};

document.getElementById('prev-page').onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        displayUsers();
        window.scrollTo(0, 0);
    }
};

displayUsers();