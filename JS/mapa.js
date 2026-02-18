let trabajos=[], myMarkers=[], tempMarker=null, creatingMode=false, currentTab="mis";
const map = L.map('map').setView([0,0],13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);

let userMarker=null, userCircle=null;
let userLat=0, userLng=0;

/* ===== UBICACIÓN REAL USUARIO ===== */
if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
        userLat=pos.coords.latitude;
        userLng=pos.coords.longitude;

        userMarker=L.marker([userLat,userLng],{icon:L.icon({iconUrl:'https://cdn-icons-png.flaticon.com/512/64/64113.png',iconSize:[25,25]})})
            .addTo(map).bindPopup("Tú estás aquí").openPopup();
        map.setView([userLat,userLng],13);

        updateVisibleMarkers(); // Círculo de rango inicial
    }, ()=>{ // Si no permite ubicación
        userLat=43.2630; userLng=-2.9349; // Bilbao por defecto
        userMarker=L.marker([userLat,userLng],{icon:L.icon({iconUrl:'https://cdn-icons-png.flaticon.com/512/64/64113.png',iconSize:[25,25]})})
            .addTo(map).bindPopup("Ubicación por defecto: Bilbao").openPopup();
        map.setView([userLat,userLng],13);
        updateVisibleMarkers();
    });
}

/* ===== COLORES ===== */
function getColor(cat){
    const colors={ "Carpintería":"brown","Informática":"blue","Jardinería":"green","Limpieza":"purple",
        "Transporte":"orange","Mudanza/Traslado":"darkred","Construcción/Reforma":"gray","Cuidado personal":"pink",
        "Mascotas":"darkgreen","Diseño":"cadetblue","Evento":"red","Gastronomía":"gold","Otros":"black"};
    return colors[cat]||"black";
}

/* CREAR MARCADOR */
function crearMarcador(latlng){ 
    tempMarker=L.circleMarker(latlng,{radius:8,color:getColor("Otros"),fillColor:getColor("Otros"),fillOpacity:0.9}).addTo(map);
    document.getElementById("marker-form-container").classList.remove("hidden");
}

/* CLICK MAPA */
map.on("click", e=>{ if(creatingMode){ creatingMode=false; crearMarcador(e.latlng); }});

/* PRECIO TIEMPO REAL */
document.getElementById("job-price").addEventListener("input",function(){
    let v=parseFloat(this.value);
    if(!isNaN(v)) document.getElementById("price-preview").innerText="Trabajador gana: "+(v*0.9).toFixed(2)+"€";
});

/* GUARDAR TRABAJO */
document.getElementById("save-job-btn").addEventListener("click",()=>{
    const t=document.getElementById("job-title").value,
        d=document.getElementById("job-desc").value,
        a=document.getElementById("job-address").value,
        dl=document.getElementById("job-deadline").value,
        pU=parseFloat(document.getElementById("job-price").value),
        time=parseInt(document.getElementById("job-time").value),
        cat=document.getElementById("job-category").value;

    if(!t||!d||!a||!dl||!pU||!time||!cat){ alert("Todos los campos son obligatorios"); return;}
    if(pU<2||!Number.isInteger(time)){alert("Precio≥2€ y tiempo entero"); return;}

    const pW=(pU*0.9).toFixed(2), xp=Math.ceil(pW*10);
    tempMarker.setStyle({color:getColor(cat),fillColor:getColor(cat)});
    tempMarker.bindPopup(`<b>${t}</b><br>🏷️ ${cat}<br>💰 ${pW}€<br>🔵 ${xp} XP<br><button onclick="verMas('${t}')">Más</button>`);

    trabajos.push({title:t,desc:d,addr:a,deadline:dl,priceUser:pU,priceWorker:pW,time,category:cat,xp,marker:tempMarker});
    myMarkers.push(tempMarker);

    ["job-title","job-desc","job-address","job-deadline","job-price","job-time"].forEach(id=>document.getElementById(id).value="");
    document.getElementById("job-category").value="";
    document.getElementById("marker-form-container").classList.add("hidden");
    updateVisibleMarkers();
});

/* CANCELAR */
document.getElementById("cancel-job-btn").addEventListener("click",()=>{
    if(tempMarker) map.removeLayer(tempMarker);
    tempMarker=null;
    document.getElementById("marker-form-container").classList.add("hidden");
});

/* VER MÁS */
function verMas(title){
    const t=trabajos.find(x=>x.title===title);
    if(!t) return;
    document.getElementById("view-title").innerText=t.title;
    document.getElementById("view-desc").innerText=t.desc;
    document.getElementById("view-address").innerText=t.addr;
    document.getElementById("view-deadline").innerText=t.deadline;
    document.getElementById("view-price").innerText=t.priceWorker;
    document.getElementById("view-category").innerText=t.category;
    document.getElementById("view-xp").innerText=t.xp;
    document.getElementById("marker-view-container").classList.remove("hidden");
}
document.getElementById("close-view-btn").addEventListener("click",()=>document.getElementById("marker-view-container").classList.add("hidden"));

/* TABS */
document.getElementById("tab-mis").addEventListener("click",()=>{
    currentTab="mis"; cambiarTab();
});
document.getElementById("tab-trabajos").addEventListener("click",()=>{
    currentTab="trabajos"; cambiarTab();
});
function cambiarTab(){
    document.getElementById("tab-mis").classList.remove("active-tab");
    document.getElementById("tab-trabajos").classList.remove("active-tab");
    if(currentTab==="mis") document.getElementById("tab-mis").classList.add("active-tab");
    else document.getElementById("tab-trabajos").classList.add("active-tab");
    renderPanel();
}

/* RENDER PANEL */
function renderPanel(){
    const panel=document.getElementById("panel-content");
    if(currentTab==="mis"){
        panel.innerHTML=`<button id="create-marker-btn">Crear marcador</button>
        <button onclick="mostrarMisMarcadores()">Mis marcadores</button>
        <button onclick="borrarMarcadores()">Borrar mis marcadores</button>`;
        document.getElementById("create-marker-btn").addEventListener("click",()=>{creatingMode=true; alert("Click en el mapa para poner el marcador");});
    } else {
        panel.innerHTML=`
        <label>Filtrar por categoría:
            <select id="filter-cat">
                <option value="">Todas</option>
                <option>Carpintería</option><option>Informática</option><option>Jardinería</option>
                <option>Limpieza</option><option>Transporte</option><option>Mudanza/Traslado</option>
                <option>Construcción/Reforma</option><option>Cuidado personal</option><option>Mascotas</option>
                <option>Diseño</option><option>Evento</option><option>Gastronomía</option><option>Otros</option>
            </select>
        </label>
        <label>Rango km: <input type="number" id="filter-range" value="10" min="1" max="100"></label>
        <label>Precio desde (€): <input type="number" id="filter-price-min" value="2" min="2"></label>
        <label>Precio hasta (€): <input type="number" id="filter-price-max" value="1000" min="2"></label>
        <button id="apply-filters-btn">Actualizar</button>`;
        document.getElementById("apply-filters-btn").addEventListener("click",()=>{aplicarFiltros();});
    }
}

/* BORRAR */
function borrarMarcadores(){myMarkers.forEach(m=>map.removeLayer(m));myMarkers=[];trabajos=[];}

/* MIS MARCADORES */
function mostrarMisMarcadores(){
    const panel=document.getElementById("panel-content");
    panel.innerHTML="<h4>Mis Marcadores</h4>";
    trabajos.forEach((t,i)=>{
        const div=document.createElement("div");
        div.style.border=`2px solid ${getColor(t.category)}`;
        div.style.padding="5px"; div.style.marginBottom="5px";
        div.innerHTML=`<b>${t.title}</b> - ${t.priceWorker}€ - ${t.category} <button onclick="editarMarcador(${i})">Editar</button>`;
        panel.appendChild(div);
    });
}

/* EDITAR */
function editarMarcador(i){
    const t=trabajos[i];
    tempMarker=t.marker;
    creatingMode=false;
    document.getElementById("marker-form-container").classList.remove("hidden");
    document.getElementById("job-title").value=t.title;
    document.getElementById("job-desc").value=t.desc;
    document.getElementById("job-address").value=t.addr;
    document.getElementById("job-deadline").value=t.deadline;
    document.getElementById("job-price").value=t.priceUser;
    document.getElementById("job-time").value=t.time;
    document.getElementById("job-category").value=t.category;
    trabajos.splice(i,1);
    myMarkers.splice(i,1);
}

/* CÍRCULO RANGO DINÁMICO */
function updateVisibleMarkers(){
    if(!userMarker) return;
    const range=parseFloat(document.getElementById("filter-range")?.value||10);
    if(userCircle) map.removeLayer(userCircle);
    userCircle=L.circle([userLat,userLng],{radius:range*1000,color:'rgb(220,108,108)',fillOpacity:0.1}).addTo(map);
}

/* FILTROS TRABAJOS */
function aplicarFiltros(){
    const cat=document.getElementById("filter-cat").value;
    const range=parseFloat(document.getElementById("filter-range").value);
    const priceMin=parseFloat(document.getElementById("filter-price-min").value);
    const priceMax=parseFloat(document.getElementById("filter-price-max").value);

    if(userCircle) map.removeLayer(userCircle);
    userCircle=L.circle([userLat,userLng],{radius:range*1000,color:'rgb(220,108,108)',fillOpacity:0.1}).addTo(map);

    myMarkers.forEach(m=>map.removeLayer(m));

    trabajos.forEach(t=>{
        let distancia=calcDist(userLat,userLng,t.marker.getLatLng().lat,t.marker.getLatLng().lng);
        if(distancia<=range && t.priceWorker>=priceMin && t.priceWorker<=priceMax && (cat===""||t.category===cat)){
            t.marker.addTo(map);
        }
    });
}

/* DISTANCIA Haversine */
function calcDist(lat1,lon1,lat2,lon2){ 
    let R=6371, dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
    let a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    let c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    return R*c;
}