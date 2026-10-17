const invoke = window.__TAURI__.core.invoke;

const listEl = document.getElementById("gadget-list");
const area = document.getElementById("configArea");
const searchEl = document.getElementById("search");
const emptyEl = document.getElementById("list-empty");

let gadgets = [];
let currentName = null;

const prettyNames = {
	width: "Ancho",
	height: "Alto",
	x: "Pos. horizontal",
	y: "Pos. vertical",
	fullscreen: "Pantalla completa",
	draggable: "Arrastrable",
	movable: "Movible",
	ignoreMouse: "Ignorar mouse",
	speed: "Velocidad",
	size: "Tamaño",
	lat: "Latitud",
	lon: "Longitud",
	folder: "Directorio",
	interval: "Intervalo",
	effect: "Efecto",
	marqueeSpeed: "Vel. efecto",
	_active: "Activo",
	_alwaysTop: "Siempre arriba",
};

async function init() {
	try {
		const names = await invoke("gadgets_list");
		gadgets = await Promise.all(
			names.map(async (name) => {
				let active = false;
				try {
					const cfg = await invoke("load_gadget_config", { name });
					active = !!cfg._active;
				} catch (_) {}
				return { name, active };
			}),
		);
		renderList();
		if (gadgets.length) {
			selectGadget(gadgets[0].name);
		}
	} catch (err) {
		console.error("No se pudo cargar la lista de gadgets:", err);
	}
}

function renderList() {
	const query = searchEl.value.trim().toLowerCase();
	listEl.innerHTML = "";
	let shown = 0;

	gadgets.forEach((g) => {
		if (query && !g.name.toLowerCase().includes(query)) {
			return;
		}
		shown += 1;

		const btn = document.createElement("button");
		btn.className = "gadget-entry";
		btn.dataset.name = g.name;
		if (g.name === currentName) {
			btn.classList.add("active");
		}
		btn.addEventListener("click", () => selectGadget(g.name));

		const icon = document.createElement("img");
		icon.className = "g-icon";
		icon.src = `gadgets/${g.name}/icon.png`;
		icon.alt = "";
		icon.onerror = () => {
			icon.onerror = null;
			icon.src = "icon.png";
		};

		const name = document.createElement("span");
		name.className = "g-name";
		name.textContent = g.name;

		const dot = document.createElement("span");
		dot.className = "g-dot" + (g.active ? " on" : "");

		btn.append(icon, name, dot);
		listEl.appendChild(btn);
	});

	emptyEl.hidden = shown !== 0;
}

function setActive(name, active) {
	const g = gadgets.find((item) => item.name === name);
	if (g) {
		g.active = active;
	}
	const el = [...listEl.children].find((c) => c.dataset.name === name);
	if (el) {
		const dot = el.querySelector(".g-dot");
		if (dot) {
			dot.classList.toggle("on", active);
		}
	}
}

async function selectGadget(name) {
	currentName = name;
	[...listEl.children].forEach((el) => {
		el.classList.toggle("active", el.dataset.name === name);
	});
	try {
		const config = await invoke("load_gadget_config", { name });
		renderConfig(name, config);
	} catch (err) {
		console.error("Error al cargar configuracion de " + name, err);
	}
}

function renderConfig(name, config) {
	area.innerHTML = "";

	const header = document.createElement("div");
	header.className = "cfg-header";

	const icon = document.createElement("img");
	icon.className = "c-icon";
	icon.src = `gadgets/${name}/icon.png`;
	icon.alt = "";
	icon.onerror = () => {
		icon.onerror = null;
		icon.src = "icon.png";
	};

	const title = document.createElement("h2");
	title.textContent = name;

	const badge = document.createElement("span");
	badge.className = "badge " + (config._active ? "on" : "off");
	badge.textContent = config._active ? "Activo" : "Inactivo";

	header.append(icon, title, badge);
	area.appendChild(header);

	const form = document.createElement("div");
	form.className = "config-form";

	Object.entries(config).forEach(([key, value]) => {
		if (key.startsWith("_comment") || key === "fullscreen") {
			return;
		}

		const row = document.createElement("div");
		row.className = "cfg-row";

		const label = document.createElement("label");
		label.textContent = prettyNames[key] || key;
		label.htmlFor = "f_" + key;

		let input;
		let control;

		if (typeof value === "boolean") {
			control = document.createElement("span");
			control.className = "seg";

			input = document.createElement("input");
			input.type = "checkbox";
			input.checked = value;
			input.id = "f_" + key;

			const off = document.createElement("span");
			off.className = "seg-opt";
			off.textContent = "OFF";

			const on = document.createElement("span");
			on.className = "seg-opt";
			on.textContent = "ON";

			control.append(input, off, on);

			const paint = (v) => {
				off.classList.toggle("is-on", !v);
				on.classList.toggle("is-on", v);
			};
			paint(value);

			off.addEventListener("click", () => {
				if (!input.checked) {
					return;
				}
				input.checked = false;
				paint(false);
				input.dispatchEvent(new Event("change"));
			});
			on.addEventListener("click", () => {
				if (input.checked) {
					return;
				}
				input.checked = true;
				paint(true);
				input.dispatchEvent(new Event("change"));
			});
			input.addEventListener("change", () => paint(input.checked));
		} else {
			input = document.createElement("input");
			input.id = "f_" + key;
			input.type = typeof value === "number" ? "number" : "text";
			input.value = value;
			control = input;
		}

		input.dataset.key = key;

		input.addEventListener("change", async () => {
			if (input.type === "checkbox") {
				config[key] = input.checked;
			} else if (input.type === "number") {
				config[key] = Number(input.value);
			} else {
				config[key] = input.value;
			}

			if (key === "_alwaysTop") {
				await invoke("set_gadget_top", { name, alwaysTop: input.checked });
			}
			await invoke("save_gadget_config", { name, config });

			if (key === "_active") {
				badge.className = "badge " + (input.checked ? "on" : "off");
				badge.textContent = input.checked ? "Activo" : "Inactivo";
				setActive(name, input.checked);
			}
		});

		row.append(label, control);
		form.appendChild(row);
	});

	area.appendChild(form);
}

function initSnow() {
	const canvas = document.getElementById("snow");
	if (!canvas) {
		return;
	}
	const ctx = canvas.getContext("2d");
	let width = 0;
	let height = 0;
	let flakes = [];
	let time = 0;

	function newFlake(initial) {
		return {
			x: Math.random() * width,
			y: initial ? Math.random() * height : -10,
			r: 0.6 + Math.random() * 1.8,
			speed: 0.15 + Math.random() * 0.5,
			drift: (Math.random() - 0.5) * 0.3,
			alpha: 0.15 + Math.random() * 0.45,
			gold: Math.random() < 0.18,
			phase: Math.random() * Math.PI * 2,
		};
	}

	function draw() {
		ctx.clearRect(0, 0, width, height);
		for (const f of flakes) {
			ctx.beginPath();
			ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
			ctx.fillStyle = f.gold
				? `rgba(232, 200, 116, ${f.alpha})`
				: `rgba(255, 255, 255, ${f.alpha})`;
			ctx.fill();
		}
	}

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const count = Math.round((width * height) / 12000);
		flakes = Array.from({ length: count }, () => newFlake(true));
	}

	function frame() {
		time += 0.01;
		for (const f of flakes) {
			f.y += f.speed;
			f.x += f.drift + Math.sin(time + f.phase) * 0.25;
			if (f.y > height + 5 || f.x < -8 || f.x > width + 8) {
				Object.assign(f, newFlake(false));
			}
		}
		draw();
		requestAnimationFrame(frame);
	}

	resize();
	window.addEventListener("resize", resize);

	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		draw();
	} else {
		requestAnimationFrame(frame);
	}
}

searchEl.addEventListener("input", renderList);

document.getElementById("close-btn").addEventListener("click", async () => {
	try {
		await invoke("window_close");
	} catch (err) {
		console.error("No se pudo cerrar el panel:", err);
	}
});

init();
initSnow();
