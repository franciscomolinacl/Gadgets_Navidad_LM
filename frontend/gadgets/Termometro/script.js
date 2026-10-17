const TOTAL_DAYS = 90;

function nextChristmas() {
	const now = new Date();
	const year = now.getFullYear();
	let xmas = new Date(year, 11, 25, 0, 0, 0);
	if (now > xmas) xmas = new Date(year + 1, 11, 25, 0, 0, 0);
	return xmas;
}

function update() {
	const now = new Date();
	const xmas = nextChristmas();
	const daysLeft = (xmas - now) / 86400000;
	const pct = Math.min(1, Math.max(0, (TOTAL_DAYS - daysLeft) / TOTAL_DAYS));

	document.getElementById("mercury").style.height = (pct * 100).toFixed(1) + "%";

	const daysEl = document.getElementById("days");
	const unitEl = document.getElementById("unit");
	const capEl = document.getElementById("caption");

	if (now.getMonth() === 11 && now.getDate() === 25) {
		daysEl.textContent = "0";
		unitEl.textContent = "";
		capEl.textContent = "Feliz Navidad";
		return;
	}

	const d = Math.ceil(daysLeft);
	daysEl.textContent = d;
	unitEl.textContent = d === 1 ? "dia" : "dias";
	capEl.textContent = d === 1 ? "para Navidad" : "para Navidad";
}

setInterval(update, 1000);
update();
