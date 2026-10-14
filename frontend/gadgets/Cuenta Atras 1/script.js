// ---- LUCES EN EL BORDE ----
function addLights() {
	const container = document.querySelector(".countdown-container");
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

// ---- COUNTDOWN ----
function updateCountdown() {
	const now = new Date();
	const year = now.getFullYear();

	let target = new Date(`December 25, ${year} 00:00:00`);

	if (now > target) {
		// Si ya pasó Navidad, contar hacia Año Nuevo
		target = new Date(`January 1, ${year + 1} 00:00:00`);
	}

	let diff = target - now;

	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
	const minutes = Math.floor((diff / (1000 * 60)) % 60);
	const seconds = Math.floor((diff / 1000) % 60);

	let message = "";
	if (now.getMonth() === 11 && now.getDate() === 25) {
		message = "¡Feliz Navidad! 🎄";
	} else if (now.getMonth() === 11 && now.getDate() > 25) {
		message = `🎉 Faltan ${days} días, ${hours}h ${minutes}m ${seconds}s para Año Nuevo`;
	} else {
		message = `🎅 Faltan ${days} días, ${hours}h ${minutes}m ${seconds}s para Navidad`;
	}

	document.getElementById("countdown").textContent = message;
}

setInterval(updateCountdown, 1000);
updateCountdown();
