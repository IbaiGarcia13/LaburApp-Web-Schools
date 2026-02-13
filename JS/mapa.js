// Inicializar mapa centrado en Valencia, por la puta cara
var map = L.map('map').setView([39.4699, -0.3763], 13);

// Cargar mapa base (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Ejemplo de trabajos simulados
var trabajos = [
    {
        titulo: "Reparación eléctrica",
        precio: 60,
        experiencia: "Media",
        duracion: "2 horas",
        lat: 39.4699,
        lng: -0.3763
    },
    {
        titulo: "Limpieza hogar",
        precio: 40,
        experiencia: "Básica",
        duracion: "3 horas",
        lat: 39.4799,
        lng: -0.3663
    }
];

// Pintar trabajos en el mapa
trabajos.forEach(function(trabajo) {

    var marcador = L.marker([trabajo.lat, trabajo.lng]).addTo(map);

    marcador.bindPopup(`
        <div class="popup-card">
            <h4>${trabajo.titulo}</h4>
            💰 <b>${trabajo.precio}€</b><br>
            🧠 Experiencia: ${trabajo.experiencia}<br>
            ⏳ Duración: ${trabajo.duracion}<br>
            <button onclick="verTrabajo('${trabajo.titulo}')">
                Ver detalles
            </button>
        </div>
    `);
});

// Permitir añadir nuevo marcador al hacer click
map.on('click', function(e) {

    L.marker([e.latlng.lat, e.latlng.lng])
        .addTo(map)
        .bindPopup("Nuevo trabajo aquí")
        .openPopup();

    console.log("Lat:", e.latlng.lat);
    console.log("Lng:", e.latlng.lng);
});

// Función ejemplo botón
function verTrabajo(titulo) {
    alert("Abrir página del trabajo: " + titulo);
}
