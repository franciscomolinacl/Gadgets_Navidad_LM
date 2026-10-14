// ---- COUNTDOWN ----
function updateCountdown() {
	const now = new Date();
	const year = now.getFullYear();

	let target = new Date(`December 25, ${year} 00:00:00`);

	if (now > target) {
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
