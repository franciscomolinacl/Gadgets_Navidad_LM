const lights = document.getElementById("xmas-lights");

const colors = ["red", "gold", "green", "blue"];

function createBulb(x, y, i) {
	let b = document.createElement("div");
	b.classList.add("bulb");

	const color = colors[i % colors.length];
	b.style.background = color;
	b.style.boxShadow = `0 0 10px ${color}`;

	b.style.animationDelay = `${(i % 4) * 0.4}s`;

	b.style.left = x + "px";
	b.style.top = y + "px";

	lights.appendChild(b);
}

function generateLights() {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const spacing = 40;
	let idx = 0;

	// TOP
	for (let x = 0; x < w; x += spacing) createBulb(x, 0, idx++);

	// RIGHT
	for (let y = 0; y < h; y += spacing) createBulb(w - 12, y, idx++);

	// BOTTOM
	for (let x = w; x > 0; x -= spacing) createBulb(x, h - 12, idx++);

	// LEFT
	for (let y = h; y > 0; y -= spacing) createBulb(0, y, idx++);
}

function startLights() {
    lights.innerHTML = "";
    generateLights();
}

setTimeout(startLights, 300);  // esperar fullscreen
