import { auth } from './firebase-config.js';
import { obtenerTrabajos, crearTrabajo } from './database.js';

// Variables globales para almacenar trabajos, marcadores en el mapa y controlar el modo de creación
let allTrabajosDB = [], myMarkers = [], tempMarker = null, creatingMode = false;
// Inicialización del mapa pasándole el elemento HTML con id 'map'
const map = L.map('map').setView([0, 0], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

let userMarker = null, userCircle = null;
let userLat = 0, userLng = 0;

/* ===== UBICACIÓN REAL USUARIO ===== */
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;

        userMarker = L.marker([userLat, userLng], { icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png', iconSize: [25, 25] }) })
            .addTo(map).bindPopup("Tú estás aquí").openPopup();
        map.setView([userLat, userLng], 13);

        updateVisibleMarkers();
        loadRealJobs();
    }, () => {
        userLat = 43.2630; userLng = -2.9349; // Bilbao por defecto
        userMarker = L.marker([userLat, userLng], { icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png', iconSize: [25, 25] }) })
            .addTo(map).bindPopup("Ubicación por defecto: Bilbao").openPopup();
        map.setView([userLat, userLng], 13);
        updateVisibleMarkers();
        loadRealJobs();
    });
}

/**
 * Carga los trabajos reales de la base de datos y los pinta como marcadores
 */
async function loadRealJobs() {
    try {
        // Borrar marcadores anteriores
        myMarkers.forEach(m => map.removeLayer(m));
        myMarkers = [];

        allTrabajosDB = await obtenerTrabajos(); // Obtenemos todos los pendientes

        allTrabajosDB.forEach(t => {
            if (t.latitud && t.longitud) {
                const color = getColor(t.id_categoria);
                const marker = L.circleMarker([t.latitud, t.longitud], {
                    radius: 8,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.9
                });

                const xp = t.xp_otorgada || Math.round(t.pago_cliente * 10);
                const pagoDisplay = t.pago_cliente || 0;

                const popupContent = `
            <div style="font-family: inherit; min-width: 180px;">
                <h3 style="margin: 0 0 8px; color: #333; font-size: 16px;">${t.titulo}</h3>
                <p style="margin: 0 0 5px; font-size: 13px; color: #666;">
                    <img src="../assets/img/icons/icono-dinero.png" style="width:14px; vertical-align:middle;"> <b>${Number(t.pago_cliente).toFixed(2)} €</b>
                </p>
                <p style="margin: 0 0 10px; font-size: 13px; color: #666;">
                    <img src="../assets/img/icons/icono-xp.png" style="width:14px; vertical-align:middle;"> <b>${xp} XP</b>
                </p>
    <button class="popup-btn" data-id="${t.id}" style="cursor:pointer; background: black; color: white; border: none; padding: 2px 8px; border-radius: 4px; margin-top: 5px;">Más</button>
                </div>`;

                marker.bindPopup(popupContent);

                // Evento para el botón dentro del popup
                marker.on('popupopen', () => {
                    const btn = document.querySelector(`.popup-btn[data-id="${t.id}"]`);
                    if (btn) btn.onclick = () => verMasReal(t.id);
                });

                myMarkers.push(marker);
            }
        });

        aplicarFiltros(); // Aplicar filtros iniciales
    } catch (e) {
        console.error("Error cargando marcadores:", e);
    }
}

/* ===== COLORES ===== */
function getColor(cat) {
    const rootStyle = getComputedStyle(document.documentElement);

    const categoryMap = {
        "carpinteria": "--cat-1",
        "construccion": "--cat-2",
        "cuidado_personal": "--cat-3",
        "diseno": "--cat-4",
        "evento": "--cat-5",
        "gastronomia": "--cat-6",
        "informatica": "--cat-7",
        "jardineria": "--cat-8",
        "limpieza": "--cat-9",
        "mascotas": "--cat-10",
        "mudanza": "--cat-11",
        "transporte": "--cat-12",
        "otros": "--cat-13"
    };

    const key = cat ? cat.toLowerCase() : "otros";
    const varName = categoryMap[key] || "--cat-13";

    // Obtener el valor de la variable CSS y limpiar espacios
    return rootStyle.getPropertyValue(varName).trim() || "#000000";
}

/* CREAR MARCADOR */
function crearMarcador(latlng) {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.circleMarker(latlng, { radius: 8, color: "black", fillColor: "black", fillOpacity: 0.9 }).addTo(map);

    document.getElementById("marker-view-box").classList.add("hidden");
    document.getElementById("marker-form-box").classList.remove("hidden");
    document.getElementById("marker-form-box").scrollIntoView({ behavior: "smooth" });
}

map.on("click", e => { if (creatingMode) { creatingMode = false; crearMarcador(e.latlng); } });

/* GUARDAR TRABAJO REAL */
document.getElementById("save-job-btn").addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
        showCustomAlert("Acceso Denegado", "Debes estar logueado para crear un trabajo.");
        return;
    }

    const t = document.getElementById("job-title").value,
        d = document.getElementById("job-desc").value,
        a = document.getElementById("job-address").value,
        dl = document.getElementById("job-deadline").value,
        pU = parseFloat(document.getElementById("job-price").value),
        time = parseInt(document.getElementById("job-time").value),
        cat = document.getElementById("job-category").value.toLowerCase();

    if (!t || !d || !a || !dl || isNaN(pU) || !time || !cat) {
        showCustomAlert("Error en Formulario", "Todos los campos son obligatorios.");
        return;
    }

    try {
        const coords = tempMarker.getLatLng();
        await crearTrabajo({
            titulo: t,
            descripcion: d,
            direccion: a,
            fecha_limite: new Date(dl),
            pagoCliente: pU,
            tiempo_estimado_horas: time,
            id_categoria: cat,
            latitud: coords.lat,
            longitud: coords.lng
        });

        showCustomAlert("Éxito", "Trabajo publicado correctamente en el mapa.");
        ["job-title", "job-desc", "job-address", "job-deadline", "job-price", "job-time"].forEach(id => document.getElementById(id).value = "");
        document.getElementById("job-category").value = "";
        document.getElementById("marker-form-box").classList.add("hidden");
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = null;

        await loadRealJobs(); // Recargar todos
    } catch (e) {
        console.error("Error al guardar:", e);
        showCustomAlert("Error", "No se pudo publicar el trabajo.");
    }
});

/* CANCELAR CREACIÓN */
document.getElementById("cancel-job-btn").addEventListener("click", () => {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = null;
    document.getElementById("marker-form-box").classList.add("hidden");
});

/* VER MÁS REAL */
function verMasReal(jobId) {
    const t = allTrabajosDB.find(x => x.id === jobId);
    if (!t) return;

    document.getElementById("view-title").innerText = t.titulo;
    document.getElementById("view-desc").innerText = t.descripcion || "Sin descripción";
    document.getElementById("view-address").innerText = t.direccion || "No especificada";

    let dlStr = "Sin fecha";
    if (t.fecha_limite) {
        const d = t.fecha_limite.toDate ? t.fecha_limite.toDate() : new Date(t.fecha_limite);
        dlStr = d.toLocaleDateString();
    }
    document.getElementById("view-deadline").innerText = dlStr;

    const xp = t.xp_otorgada || Math.round(t.pago_cliente * 10);
    const pagoDisplay = t.pago_cliente || 0;

    document.getElementById("view-price").innerText = Number(pagoDisplay).toFixed(2);
    document.getElementById("view-category").innerText = t.id_categoria ? t.id_categoria.charAt(0).toUpperCase() + t.id_categoria.slice(1) : "Otros";
    document.getElementById("view-xp").innerText = xp;

    const btnVerTodo = document.getElementById("view-all-btn");
    if (btnVerTodo) {
        btnVerTodo.onclick = () => {
            window.location.href = `trabajo.html?id=${t.id}`;
        };
    }

    document.getElementById("marker-form-box").classList.add("hidden");
    document.getElementById("marker-view-box").classList.remove("hidden");
    document.getElementById("marker-view-box").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("close-view-btn").addEventListener("click", () => document.getElementById("marker-view-box").classList.add("hidden"));

/* BOTÓN AÑADIR MARCADOR */
const btnAdd = document.getElementById("create-marker-btn");
if (btnAdd) {
    btnAdd.addEventListener("click", () => {
        creatingMode = true;
        tempMarker = null;
        showCustomAlert("Añadir Marcador", "Haz click en un lugar del mapa para ubicar tu nuevo trabajo.", "Entendido");
    });
}

function updateVisibleMarkers() {
    if (!userMarker) return;
    const range = parseFloat(document.getElementById("filter-range")?.value || 10);
    if (userCircle) map.removeLayer(userCircle);
    userCircle = L.circle([userLat, userLng], { radius: range * 1000, color: 'rgb(220,108,108)', fillOpacity: 0.1 }).addTo(map);
}

function aplicarFiltros() {
    const cat = document.getElementById("filter-cat").value.toLowerCase();
    const range = parseFloat(document.getElementById("filter-range").value);
    const priceMin = parseFloat(document.getElementById("filter-price-min").value);
    const priceMax = parseFloat(document.getElementById("filter-price-max").value);

    // Actualizar título
    const isFiltered = cat !== "" || range !== 1 || priceMin !== 2 || priceMax !== 1000;
    const title = document.getElementById('mapa-title');
    const iconHtml = '<img src="../assets/img/icons/icono-ajustes.png" style="width: 35px; vertical-align: middle; margin-right: 10px;" alt=""> ';
    if (title) {
        title.innerHTML = isFiltered ? iconHtml + "MAPA: Filtrado" : iconHtml + "MAPA: Todos";
    }

    updateVisibleMarkers();

    // Mostrar/ocultar marcadores según distancia y filtros
    myMarkers.forEach(m => map.removeLayer(m));

    allTrabajosDB.forEach((t, index) => {
        const marker = myMarkers[index];
        if (!marker) return;

        const dist = calcDist(userLat, userLng, t.latitud, t.longitud);
        const pagoFiltro = t.pago_cliente || 0;

        const matchCat = cat === "" || (t.id_categoria && t.id_categoria.toLowerCase() === cat);
        const matchRange = dist <= range;
        const matchPrice = pagoFiltro >= priceMin && pagoFiltro <= priceMax;

        if (matchCat && matchRange && matchPrice) {
            marker.addTo(map);
        }
    });
}

function calcDist(lat1, lon1, lat2, lon2) {
    let R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    let a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Eventos de filtros
document.getElementById("filter-range").addEventListener("input", function () {
    document.getElementById("range-val").textContent = this.value;
    updateVisibleMarkers();
});

document.getElementById("apply-filters-btn").addEventListener("click", aplicarFiltros);
