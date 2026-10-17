const invoke = window.__TAURI__.core.invoke;
const NAME = "Calendario de Adviento";

const WORDS = [
	"Paz", "Amor", "Luz", "Fe", "Gozo", "Union",
	"Amistad", "Familia", "Gratitud", "Ilusion", "Magia", "Suenos",
	"Nieve", "Brindis", "Regalos", "Villancicos", "Abrazos", "Hogar",
	"Estrella", "Renos", "Arbol", "Velas", "Dulces", "Navidad"
];

let cfg = {};
let opened = new Set();

function decemberDay() {
	const now = new Date();
	return now.getMonth() === 11 ? now.getDate() : 0;
}

function render() {
	const grid = document.getElementById("grid");
	const limit = decemberDay();
	grid.innerHTML = "";

	for (let d = 1; d <= 24; d++) {
		const isOpen = opened.has(d);
		const unlocked = d <= limit || isOpen;

		const cell = document.createElement("button");
		cell.className = "door" + (isOpen ? " open" : "") + (!unlocked ? " locked" : "");

		const num = document.createElement("span");
		num.className = "num";
		num.textContent = d;
		cell.appendChild(num);

		if (isOpen) {
			const sym = document.createElement("span");
			sym.className = "sym";
			const star = document.createElement("span");
			star.className = "star";
			const word = document.createElement("span");
			word.textContent = WORDS[d - 1];
			sym.append(star, word);
			cell.appendChild(sym);
		}

		if (unlocked) {
			cell.addEventListener("click", () => openDoor(d));
		} else {
			cell.disabled = true;
		}

		grid.appendChild(cell);
	}

	updateHint(limit);
}

function openDoor(d) {
	if (opened.has(d)) return;
	opened.add(d);
	cfg.opened = [...opened].sort((a, b) => a - b);
	invoke("save_gadget_config", { name: NAME, config: cfg });
	render();
}

function updateHint(limit) {
	const hint = document.getElementById("hint");
	if (limit === 0) {
		hint.textContent = "El calendario empieza el 1 de diciembre";
	} else if (limit >= 24) {
		hint.textContent = "Feliz Navidad";
	} else {
		hint.textContent = "Hoy se abre el dia " + limit;
	}
}

async function init() {
	try {
		cfg = await invoke("load_gadget_config", { name: NAME });
	} catch (e) {
		cfg = {};
	}
	opened = new Set(cfg.opened || []);
	render();
	setInterval(render, 60000);
}

init();
