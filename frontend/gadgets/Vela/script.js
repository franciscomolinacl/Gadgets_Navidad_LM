let encendida = true;

const llama = document.querySelector(".llama");

let sonido = null;
try {
    sonido = new Audio("flame.mp3");
} catch (e) {
    console.warn("Sonido no cargado (opcional).");
}

document.getElementById("vela-container").addEventListener("click", () => {
    encendida = !encendida;

    if (encendida) {
        // Enciende
        llama.style.display = "block";
        if (sonido) {
            sonido.currentTime = 0;
            sonido.volume = 0.2;
            sonido.play().catch(() => {});
        }
    } else {
        // Apaga
        llama.style.display = "none";
    }
});
