// Variables globales para almacenar trabajos, marcadores en el mapa y controlar el modo de creación
let trabajos = [], myMarkers = [], tempMarker = null, creatingMode = false;
// Inicialización del mapa pasándole el elemento HTML con id 'map'
const map = L.map('map').setView([0, 0], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

let userMarker = null, userCircle = null;
let userLat = 0, userLng = 0;

/* ===== UBICACIÓN REAL USUARIO ===== */
// Pedimos permiso al navegador para usar el GPS o localización de la IP
if (navigator.geolocation) {
    // Si accede, ubicamos el marcador rojo ("Tú estás aquí")
    navigator.geolocation.getCurrentPosition(pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;

        userMarker = L.marker([userLat, userLng], { icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png', iconSize: [25, 25] }) })
            .addTo(map).bindPopup("Tú estás aquí").openPopup();
        map.setView([userLat, userLng], 13);

        updateVisibleMarkers(); // Círculo de rango inicial
    }, () => { // Si no permite ubicación
        userLat = 43.2630; userLng = -2.9349; // Bilbao por defecto
        userMarker = L.marker([userLat, userLng], { icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png', iconSize: [25, 25] }) })
            .addTo(map).bindPopup("Ubicación por defecto: Bilbao").openPopup();
        map.setView([userLat, userLng], 13);
        updateVisibleMarkers();
    });
}

/* ===== COLORES ===== */
// Diccionario de colores según la categoría elegida para pintar el marcador en el mapa
function getColor(cat) {
    const colors = {
        "Carpintería": "brown", "Construcción/Reforma": "gray", "Cuidado personal": "pink",
        "Diseño": "cadetblue", "Evento": "red", "Gastronomía": "gold", "Informática": "blue",
        "Jardinería": "green", "Limpieza": "purple", "Mascotas": "darkgreen",
        "Mudanza/Traslado": "darkred", "Transporte": "orange", "Otros": "black"
    };
    return colors[cat] || "black";
}

/* CREAR MARCADOR */
// Función invocada al hacer click en el mapa en "modo creación". Dibuja un pin temporal y abre el formulario Lateral.
function crearMarcador(latlng) {
    if (tempMarker) map.removeLayer(tempMarker);
    // Dibujamos un círculo marcando el lugar exacto pulsado
    tempMarker = L.circleMarker(latlng, { radius: 8, color: getColor("Otros"), fillColor: getColor("Otros"), fillOpacity: 0.9 }).addTo(map);

    document.getElementById("marker-view-box").classList.add("hidden");
    document.getElementById("marker-form-box").classList.remove("hidden");

    // Desliza para que se vea form
    document.getElementById("marker-form-box").scrollIntoView({ behavior: "smooth" });
}

/* CLICK MAPA */
map.on("click", e => { if (creatingMode) { creatingMode = false; crearMarcador(e.latlng); } });

/* PRECIO TIEMPO REAL */
// Actualiza la previsualización de las ganancias ("Trabajador gana") restándole un supuesto 10% de comisión (0.9) al precio base
document.getElementById("job-price").addEventListener("input", function () {
    let v = parseFloat(this.value);
    if (!isNaN(v)) document.getElementById("price-preview").innerText = "Trabajador gana: " + (v * 0.9).toFixed(2) + "€";
});

/* GUARDAR TRABAJO */
document.getElementById("save-job-btn").addEventListener("click", () => {
    const t = document.getElementById("job-title").value,
        d = document.getElementById("job-desc").value,
        a = document.getElementById("job-address").value,
        dl = document.getElementById("job-deadline").value,
        pU = parseFloat(document.getElementById("job-price").value),
        time = parseInt(document.getElementById("job-time").value),
        cat = document.getElementById("job-category").value;

    if (!t || !d || !a || !dl || isNaN(pU) || !time || !cat) {
        showCustomAlert("Error en Formulario", "Todos los campos son obligatorios.");
        return;
    }
    if (pU < 2 || !Number.isInteger(time)) {
        showCustomAlert("Datos Inválidos", "El precio debe ser ≥ 2€ y el tiempo estimado un número entero.");
        return;
    }

    const pW_raw = pU * 0.9;
    const pW = Number.isInteger(pW_raw) ? pW_raw : Number(pW_raw).toFixed(2);
    const xp = Math.ceil(pW_raw * 10);
    tempMarker.setStyle({ color: getColor(cat), fillColor: getColor(cat) });
    tempMarker.bindPopup(`<b>${t}</b><br><img src="../assets/img/icons/icono-categoria-color.png" class="icon-img-small" alt=""> ${cat}<br><img src="../assets/img/icons/icono-dinero-color.png" class="icon-img-small" alt=""> ${pW}€<br><img src="../assets/img/icons/icono-xp-color.png" class="icon-img-small" alt=""> ${xp} XP<br><button onclick="verMas('${t}')">Más</button>`);

    trabajos.push({ title: t, desc: d, addr: a, deadline: dl, priceUser: pU, priceWorker: pW, time, category: cat, xp, marker: tempMarker });
    myMarkers.push(tempMarker);

    ["job-title", "job-desc", "job-address", "job-deadline", "job-price", "job-time"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("job-category").value = "";
    document.getElementById("marker-form-box").classList.add("hidden");
    updateVisibleMarkers();
});

/* CANCELAR */
document.getElementById("cancel-job-btn").addEventListener("click", () => {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = null;
    document.getElementById("marker-form-box").classList.add("hidden");
});

/* VER MÁS */
// Función llamada desde el popup del marcador que abre el panel lateral derecho con detalles
function verMas(title) {
    const t = trabajos.find(x => x.title === title);
    if (!t) return;
    document.getElementById("view-title").innerText = t.title;
    document.getElementById("view-desc").innerText = t.desc;
    document.getElementById("view-address").innerText = t.addr;
    document.getElementById("view-deadline").innerText = t.deadline;
    document.getElementById("view-price").innerText = t.priceWorker;
    document.getElementById("view-category").innerText = t.category;
    document.getElementById("view-xp").innerText = t.xp;

    // Configurar acción del botón Ver Todo para redirigir a trabajo.html
    const btnVerTodo = document.getElementById("view-all-btn");
    if (btnVerTodo) {
        btnVerTodo.onclick = () => {
            window.location.href = "trabajo.html";
        };
    }

    document.getElementById("marker-form-box").classList.add("hidden");
    document.getElementById("marker-view-box").classList.remove("hidden");
    document.getElementById("marker-view-box").scrollIntoView({ behavior: "smooth" });
}
document.getElementById("close-view-btn").addEventListener("click", () => document.getElementById("marker-view-box").classList.add("hidden"));

/* BOTÓN AÑADIR MARCADOR DERECHA */
const btnAdd = document.getElementById("create-marker-btn");
if (btnAdd) {
    btnAdd.addEventListener("click", () => {
        creatingMode = true;
        tempMarker = null;
        showCustomAlert("Añadir Marcador", "Haz click en un lugar del mapa para ubicar tu nuevo trabajo.", "Entendido");
    });
}

/* CARGAR EVENTOS DE FILTROS AL INICIO FIJO */
window.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("filter-range");
    const out = document.getElementById("range-val");
    if (slider && out) {
        slider.addEventListener("input", function () {
            out.textContent = this.value;
            updateVisibleMarkers();
        });
    }

    const btnApply = document.getElementById("apply-filters-btn");
    if (btnApply) {
        btnApply.addEventListener("click", () => { aplicarFiltros(); });
    }
});

/* BORRAR */
function borrarMarcadores() { myMarkers.forEach(m => map.removeLayer(m)); myMarkers = []; trabajos = []; }



/* EDITAR (No visible ahora mismo publicamente) */
function editarMarcador(i) {
    const t = trabajos[i];
    tempMarker = t.marker;
    creatingMode = false;
    document.getElementById("marker-view-box").classList.add("hidden");
    document.getElementById("marker-form-box").classList.remove("hidden");
    document.getElementById("job-title").value = t.title;
    document.getElementById("job-desc").value = t.desc;
    document.getElementById("job-address").value = t.addr;
    document.getElementById("job-deadline").value = t.deadline;
    document.getElementById("job-price").value = t.priceUser;
    document.getElementById("job-time").value = t.time;
    document.getElementById("job-category").value = t.category;
    trabajos.splice(i, 1);
    myMarkers.splice(i, 1);
}

/* CÍRCULO RANGO DINÁMICO */
// Dibuja o actualiza un círculo rojo semitransparente indicando el área de rango cubierta
function updateVisibleMarkers() {
    if (!userMarker) return;
    const range = parseFloat(document.getElementById("filter-range")?.value || 10);
    if (userCircle) map.removeLayer(userCircle);
    userCircle = L.circle([userLat, userLng], { radius: range * 1000, color: 'rgb(220,108,108)', fillOpacity: 0.1 }).addTo(map);
}

/* FILTROS TRABAJOS */
// Evento para aplicar un filtro de distancia (en km) y precio basado en coordenadas y los inputs de formulario
function aplicarFiltros() {
    const cat = document.getElementById("filter-cat").value;
    const range = parseFloat(document.getElementById("filter-range").value);
    const priceMin = parseFloat(document.getElementById("filter-price-min").value);
    const priceMax = parseFloat(document.getElementById("filter-price-max").value);

    const isFiltered = cat !== "" || range !== 1 || priceMin !== 2 || priceMax !== 1000;
    const title = document.getElementById('mapa-title');
    const iconHtml = '<img src="../assets/img/icons/icono-ajustes.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    if (title) {
        title.innerHTML = isFiltered ? iconHtml + "MAPA: Filtrado" : iconHtml + "MAPA: Todos";
    }

    if (userCircle) map.removeLayer(userCircle);
    userCircle = L.circle([userLat, userLng], { radius: range * 1000, color: 'rgb(220,108,108)', fillOpacity: 0.1 }).addTo(map);

    myMarkers.forEach(m => map.removeLayer(m));

    trabajos.forEach(t => {
        let distancia = calcDist(userLat, userLng, t.marker.getLatLng().lat, t.marker.getLatLng().lng);
        if (distancia <= range && t.priceWorker >= priceMin && t.priceWorker <= priceMax && (cat === "" || t.category === cat)) {
            t.marker.addTo(map);
        }
    });
}

/* DISTANCIA Haversine */
function calcDist(lat1, lon1, lat2, lon2) {
    let R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    let a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}