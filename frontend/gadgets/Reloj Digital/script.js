function addLights() {
	const container = document.querySelector(".clock-container");
	const border = document.querySelector(".lights");
	const width = container.offsetWidth;
	const height = container.offsetHeight;
	const totalLights = 30;
	const colors = ["red", "green", "gold", "blue"];

	for (let i = 0; i < totalLights; i++) {
		const light = document.createElement("span");
		const c = colors[Math.floor(Math.random() * colors.length)];
		
		light.style.background = c;
		light.style.boxShadow = `0 0 8px ${c}`;

		const ratio = i / totalLights;
		const perimeter = (width + height) * 2;

		let pos = ratio * perimeter;
		let x, y;

		if (pos < width) { x = pos; y = 0; }
		else if (pos < width + height) { x = width; y = pos - width; }
		else if (pos < width*2 + height) { x = (width*2 + height) - pos; y = height; }
		else { x = 0; y = perimeter - pos; }

		light.style.left = `${x - 7}px`;
		light.style.top = `${y - 7}px`;
		light.style.animationDelay = `${Math.random()}s`;
		border.appendChild(light);
	}
}

window.onload = addLights;

function updateClock() {
	const now = new Date();
	const h = String(now.getHours()).padStart(2, "0");
	const m = String(now.getMinutes()).padStart(2, "0");
	const s = String(now.getSeconds()).padStart(2, "0");

	document.getElementById("clock").textContent = `${h}:${m}:${s}`;
}

setInterval(updateClock, 1000);
updateClock();
