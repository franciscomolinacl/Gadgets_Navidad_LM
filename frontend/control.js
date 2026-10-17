const invoke = window.__TAURI__.core.invoke;
// El namespace de eventos puede no estar disponible en algunos contextos;
// sin este guard, un error en top-level abortaria todo el script del panel.
const listen =
	(window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.listen) ||
	(() => Promise.resolve(() => {}));

const listEl = document.getElementById("gadget-list");
const area = document.getElementById("configArea");
const searchEl = document.getElementById("search");
const emptyEl = document.getElementById("list-empty");
const profileSelect = document.getElementById("profile-select");
const profileNameInput = document.getElementById("profile-name-input");
const profileActions = document.getElementById("profile-actions");
const profileApplyBtn = document.getElementById("profile-apply");
const profileSaveBtn = document.getElementById("profile-save");
const profileDelBtn = document.getElementById("profile-del");
const autostartSeg = document.getElementById("autostart-seg");

let gadgets = [];
let favorites = [];
let profiles = [];
let currentName = null;
let editingProfile = false;

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

// ---- Control segmentado OFF | ON ----
// Devuelve el elemento de control y el input interno, para que quien lo use
// pueda suscribirse al evento "change".
function buildSeg(checked) {
	const wrap = document.createElement("span");
	wrap.className = "seg";

	const input = document.createElement("input");
	input.type = "checkbox";
	input.checked = checked;

	const off = document.createElement("span");
	off.className = "seg-opt";
	off.textContent = "OFF";

	const on = document.createElement("span");
	on.className = "seg-opt";
	on.textContent = "ON";

	wrap.append(input, off, on);

	const paint = (v) => {
		off.classList.toggle("is-on", !v);
		on.classList.toggle("is-on", v);
	};
	paint(checked);

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

	return { wrap, input };
}

function isFavorite(name) {
	return favorites.includes(name);
}

function sortedGadgets(list) {
	return [...list].sort((a, b) => {
		const fa = isFavorite(a.name);
		const fb = isFavorite(b.name);
		if (fa !== fb) {
			return fa ? -1 : 1;
		}
		return a.name.localeCompare(b.name, "es");
	});
}

async function init() {
	try {
		favorites = await invoke("favorites_get");
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
		profiles = await invoke("perfiles_list");
		renderProfiles();
		renderList();
		if (gadgets.length) {
			selectGadget(sortedGadgets(gadgets)[0].name);
		}
	} catch (err) {
		console.error("No se pudo cargar la lista de gadgets:", err);
	}
}

function renderList() {
	const query = searchEl.value.trim().toLowerCase();
	listEl.innerHTML = "";
	let shown = 0;

	sortedGadgets(gadgets).forEach((g) => {
		if (query && !g.name.toLowerCase().includes(query)) {
			return;
		}
		shown += 1;

		const btn = document.createElement("div");
		btn.className = "gadget-entry";
		btn.setAttribute("role", "button");
		btn.tabIndex = 0;
		btn.dataset.name = g.name;
		if (g.name === currentName) {
			btn.classList.add("active");
		}
		btn.addEventListener("click", () => selectGadget(g.name));
		btn.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				selectGadget(g.name);
			}
		});

		const star = document.createElement("span");
		star.className = "g-star" + (isFavorite(g.name) ? " fav" : "");
		star.textContent = isFavorite(g.name) ? "★" : "☆";
		star.title = isFavorite(g.name)
			? "Quitar de favoritos"
			: "Marcar como favorito";
		star.addEventListener("click", async (e) => {
			e.stopPropagation();
			const nowFav = !isFavorite(g.name);
			if (nowFav) {
				favorites.push(g.name);
			} else {
				favorites = favorites.filter((n) => n !== g.name);
			}
			star.classList.toggle("fav", nowFav);
			star.textContent = nowFav ? "★" : "☆";
			await invoke("favorites_set", { name: g.name, favorite: nowFav });
			// Reordenar tras un pequeño delay para que el cambio se vea.
			setTimeout(renderList, 120);
		});

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
		dot.title = g.active ? "Activo" : "Inactivo";

		btn.append(star, icon, name, dot);
		listEl.appendChild(btn);
	});

	emptyEl.hidden = shown !== 0;
}

function setActive(name, active) {
	const g = gadgets.find((item) => item.name === name);
	if (g) {
		g.active = active;
	}
	updateDot(name);
}

function updateDot(name) {
	const g = gadgets.find((item) => item.name === name);
	const el = [...listEl.children].find((c) => c.dataset.name === name);
	const dot = el && el.querySelector(".g-dot");
	if (dot && g) {
		dot.classList.toggle("on", g.active);
		dot.title = g.active ? "Activo" : "Inactivo";
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
			const seg = buildSeg(value);
			input = seg.input;
			input.id = "f_" + key;
			control = seg.wrap;
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

// ---- Perfiles / Presets ----
function renderProfiles() {
	profileSelect.innerHTML = "";
	if (!profiles.length) {
		const opt = document.createElement("option");
		opt.value = "";
		opt.textContent = "Sin perfiles guardados";
		profileSelect.appendChild(opt);
		profileSelect.disabled = true;
		profileApplyBtn.disabled = true;
		profileDelBtn.disabled = true;
	} else {
		profiles.forEach((p) => {
			const opt = document.createElement("option");
			opt.value = p.nombre;
			opt.textContent = p.nombre;
			profileSelect.appendChild(opt);
		});
		profileSelect.disabled = false;
		profileApplyBtn.disabled = false;
		profileDelBtn.disabled = false;
	}
	setEditingProfile(false);
}

function setEditingProfile(on) {
	editingProfile = on;
	profileSelect.hidden = on;
	profileNameInput.hidden = !on;
	if (on) {
		profileNameInput.value = "";
		profileNameInput.focus();
	} else {
		profileSelect.focus({ preventScroll: true });
	}
}

async function applyProfile() {
	const nombre = profileSelect.value;
	if (!nombre) {
		return;
	}
	try {
		await invoke("perfil_apply", { nombre });
		// Recargar el estado real de todos los gadgets tras aplicar.
		gadgets = await Promise.all(
			gadgets.map(async (g) => {
				const cfg = await invoke("load_gadget_config", { name: g.name });
				return { name: g.name, active: !!cfg._active };
			}),
		);
		renderList();
		if (currentName) {
			const cfg = await invoke("load_gadget_config", { name: currentName });
			renderConfig(currentName, cfg);
		}
	} catch (err) {
		console.error("Error al aplicar el perfil:", err);
	}
}

async function saveProfile() {
	const nombre = profileNameInput.value.trim();
	if (!nombre) {
		setEditingProfile(false);
		return;
	}
	const map = {};
	gadgets.forEach((g) => {
		map[g.name] = !!g.active;
	});
	profiles = await invoke("perfil_save", { nombre, gadgets: map });
	renderProfiles();
	profileSelect.value = nombre;
}

async function deleteProfile() {
	const nombre = profileSelect.value;
	if (!nombre) {
		return;
	}
	profiles = await invoke("perfil_delete", { nombre });
	renderProfiles();
}

profileApplyBtn.addEventListener("click", applyProfile);
profileDelBtn.addEventListener("click", deleteProfile);
profileSaveBtn.addEventListener("click", () => {
	if (editingProfile) {
		saveProfile();
	} else {
		setEditingProfile(true);
	}
});
profileNameInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		saveProfile();
	} else if (e.key === "Escape") {
		setEditingProfile(false);
	}
});
profileNameInput.addEventListener("blur", () => {
	// No salir si el click fue en el boton de guardar.
	setTimeout(() => {
		if (editingProfile) {
			setEditingProfile(false);
		}
	}, 150);
});

// ---- Arranque automatico ----
async function initAutostart() {
	const seg = buildSeg(await invoke("autostart_get"));
	autostartSeg.className = seg.wrap.className;
	autostartSeg.innerHTML = seg.wrap.innerHTML;
	seg.input.addEventListener("change", async () => {
		try {
			await invoke("autostart_set", { enable: seg.input.checked });
		} catch (err) {
			console.error("Error al cambiar el arranque automatico:", err);
		}
	});
}

// ---- Copos de nieve del panel ----
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

// Cambios hechos desde el menu contextual de un gadget o desde la bandeja:
// hay que refrescar el badge, el punto verde y los segmentados.
listen("gadget:config-changed", (event) => {
	const { name, config } = event.payload || {};
	const g = gadgets.find((item) => item.name === name);
	if (g) {
		g.active = !!config._active;
	}
	updateDot(name);
	if (currentName === name) {
		renderConfig(name, config);
	}
});

init();
initAutostart();
initSnow();
