const lights = document.getElementById("xmas-lights");

const colors = ["red", "green", "gold", "blue"];

function createBulb(x, y, color, delay) {
	let b = document.createElement("div");
	b.classList.add("bulb");
	b.style.left = x + "px";
	b.style.top = y + "px";
	b.style.background = color;
	b.style.boxShadow = `0 0 8px ${color}`;
	b.style.animationDelay = delay + "s";
	lights.appendChild(b);
}

function generateLights() {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const spacing = 40;

	// TOP
	for (let x = 0; x < w; x += spacing) {
		createBulb(x, 0, colors[x % colors.length], Math.random()*2);
	}

	// BOTTOM
	for (let x = 0; x < w; x += spacing) {
		createBulb(x, h - 12, colors[(x+1) % colors.length], Math.random()*2);
	}

	// LEFT
	for (let y = 0; y < h; y += spacing) {
		createBulb(0, y, colors[y % colors.length], Math.random()*2);
	}

	// RIGHT
	for (let y = 0; y < h; y += spacing) {
		createBulb(w - 12, y, colors[(y+1) % colors.length], Math.random()*2);
	}
}

function startLights() {
    lights.innerHTML = "";
    generateLights();
}

setTimeout(startLights, 300);  // esperar fullscreen
