function startGinger() {
    const ginger = document.getElementById("ginger");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    // Seguir el mouse
    document.addEventListener("mousemove", e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        ginger.classList.add("walk");

        // Mirar hacia la dirección del mouse
        const dx = e.clientX - (ginger.offsetLeft + ginger.offsetWidth / 2);
        ginger.style.transform = `translate(-50%, -50%) scaleX(${dx >= 0 ? 1 : -1})`;
    });

    // Loop de movimiento
    function loop() {
        const rect = ginger.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const dx = (mouseX - x) * 0.07;
        const dy = (mouseY - y) * 0.07;

        ginger.style.left = (x + dx) + "px";
        ginger.style.top = (y + dy) + "px";

        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
            ginger.classList.remove("walk");
        }

        requestAnimationFrame(loop);
    }

    loop();

    // Click = salto
    ginger.addEventListener("click", () => {
        ginger.classList.remove("jump");
        void ginger.offsetWidth; // reiniciar animación
        ginger.classList.add("jump");
    });
}

// Esperar fullscreen
setTimeout(startGinger, 300);
