const canvas = document.getElementById('snowCanvas');
const ctx = canvas.getContext('2d');

let w, h, snowGround, flakes, angle;

function initSnow() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    snowGround = new Array(w).fill(0);

    const numFlakes = 200;
    flakes = [];

    for (let i = 0; i < numFlakes; i++) {
        flakes.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 4 + 1,
            d: Math.random() * numFlakes
        });
    }

    angle = 0;
}

window.addEventListener('resize', () => {
    // Recalcular al cambiar tamaño
    initSnow();
});

function drawFlakes() {
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(0, h);

    for (let x = 0; x < w; x++) {
        ctx.lineTo(x, h - snowGround[x]);
    }

    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();

    for (let f of flakes) {
        ctx.moveTo(f.x, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    }

    ctx.fill();
    moveFlakes();
}

function moveFlakes() {
    angle += 0.01;

    for (let f of flakes) {
        f.y += Math.cos(angle + f.d) + 1 + f.r / 2;
        f.x += Math.sin(angle) * 2;

        if (f.x > w + 5) f.x = -5;
        if (f.x < -5) f.x = w + 5;

        const x = Math.floor(f.x);
        if (f.y >= h - snowGround[x]) {
            snowGround[x] += f.r * 5;
            if (snowGround[x] > h / 4) snowGround[x] = h / 4;

            f.y = -10;
            f.x = Math.random() * w;
        }
    }

    for (let x = 1; x < w - 1; x++) {
        snowGround[x] = (snowGround[x - 1] + snowGround[x] + snowGround[x + 1]) / 3;
    }

    for (let x = 0; x < w; x++) {
        snowGround[x] *= 0.998;
    }

    requestAnimationFrame(drawFlakes);
}

// ----------- Esperar a que Electron aplique fullscreen ----------
function startSnowAfterFullscreen() {
    initSnow();     // recalcular todo completo
    drawFlakes();   // iniciar animación
}

// Espera 400–500 ms según PC → evita parpadeo
setTimeout(startSnowAfterFullscreen, 500);
