function startGlow() {
    const c = document.getElementById("canvas");
    const ctx = c.getContext("2d");

    function resize() {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    let particles = [];

    function addParticle() {
        particles.push({
            x: Math.random() * c.width,
            y: c.height + 10,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 0.5 + 0.2,
            alpha: 1
        });
    }

    function draw() {
        ctx.clearRect(0, 0, c.width, c.height);

        const remaining = [];

        for (let p of particles) {
            ctx.fillStyle = `rgba(255,255,200,${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            p.y -= p.speed;
            p.alpha -= 0.002;

            if (p.alpha > 0) remaining.push(p);
        }

        particles = remaining;
        requestAnimationFrame(draw);
    }

    setInterval(addParticle, 100);
    draw();
}

// Esperar a que la ventana ya esté en fullscreen
setTimeout(startGlow, 300);
