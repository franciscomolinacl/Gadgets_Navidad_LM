const santa = document.getElementById("santa");
const locText = document.getElementById("location");
const etaText = document.getElementById("eta");

// Ruta de Santa (coordenadas X,Y dentro del div)
const ruta = [
    { x: 80,  y: 0,  lugar: "Polo Norte" },
    { x: 130, y: 20,  lugar: "Groenlandia" },
    { x: 200, y: 70,  lugar: "Noruega" },
    { x: 310, y: 70, lugar: "Rusia" },
    { x: 310, y: 110, lugar: "China" },
    { x: 340, y: 210, lugar: "Australia" },
    { x: 210, y: 210, lugar: "Sudafrica" },
    { x: 225, y: 130, lugar: "Egipto" },
    { x: 210, y: 105, lugar: "Italia" },
    { x: 185, y: 105, lugar: "España" },
    { x: 130, y: 180, lugar: "Brasil" },
    { x: 100, y: 210, lugar: "Chile" },
    { x: 100, y: 160,  lugar: "Colombia" },
    { x: 70, y: 135,  lugar: "Mexico" },
    { x: 70, y: 110,  lugar: "USA" },
    { x: 60, y: 70,  lugar: "Canada" },
];

let index = 0;

function moverSanta() {
    const punto = ruta[index];

    santa.style.left = punto.x + "px";
    santa.style.top = punto.y + "px";

    locText.textContent = "🎅 Sobrevolando: " + punto.lugar;

    // ETA estimado (simple)
    let eta = Math.floor(Math.random() * 6) + 3;
    etaText.textContent = "ETA: " + eta + " min";

    index = (index + 1) % ruta.length; // Loop
}

moverSanta();
setInterval(moverSanta, 5000); // Santa avanza cada 5 segundos
