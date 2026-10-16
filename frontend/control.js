const invoke = window.__TAURI__.core.invoke;
const { listen } = window.__TAURI__.event;

const sidebar = document.getElementById("sidebar");
const area = document.getElementById("configArea");
let activeBtn = null;

const prettyNames = {
	width: "Ancho",
	height: "Alto",
	x: "Pos. horizontal",
	y: "Pos. vertical",
	fullscreen: "Pantalla completa",
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
		const gadgets = await invoke("gadgets_list");
		gadgets.forEach((name) => {
			const btn = document.createElement("button");
			btn.textContent = name;
			btn.classList.add("gadget-entry");
			btn.addEventListener("click", () => {
				if (activeBtn) {
					activeBtn.classList.remove("active");
				}
				btn.classList.add("active");
				activeBtn = btn;
				loadConfig(name);
			});
			sidebar.appendChild(btn);
		});
	} catch (err) {
		console.error("No se pudo cargar la lista de gadgets:", err);
	}
}

async function loadConfig(name) {
	try {
		const config = await invoke("load_gadget_config", { name });
		renderConfig(name, config);
	} catch (err) {
		console.error("Error al cargar configuracion de " + name, err);
	}
}

function renderConfig(name, config) {
	area.innerHTML = "";

	// Header
	const header = document.createElement("div");
	header.style.display = "flex";
	header.style.alignItems = "center";
	header.style.marginBottom = "20px";
	header.style.gap = "10px";
	header.style.padding = "10px 15px";
	header.style.borderRadius = "10px";
	header.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
	header.style.border = config._active ? "2px solid #4caf50" : "2px solid #f44336";
	header.style.background = config._active ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.1)";
	header.style.transition = "all 0.3s ease";

	const img = document.createElement("img");
	img.src = `gadgets/${name}/icon.png`;
	img.onerror = () => {
		img.onerror = null;
		img.src = "icon.png";
	};
	img.style.width = "40px";
	img.style.height = "40px";
	img.style.objectFit = "contain";
	img.style.borderRadius = "8px";
	img.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";

	const title = document.createElement("h2");
	title.textContent = name;
	title.style.margin = 0;
	title.style.color = "#222";
	title.style.fontSize = "1.5em";
	title.style.fontWeight = "bold";

	header.appendChild(img);
	header.appendChild(title);
	area.appendChild(header);

	const form = document.createElement("div");
	form.classList.add("config-form");

	Object.entries(config).forEach(([key, value]) => {
		if (key.startsWith("_comment") || key === "fullscreen") {
			return;
		}

		const row = document.createElement("div");
		row.classList.add("cfg-row");

		const label = document.createElement("label");
		label.textContent = prettyNames[key] || key;

		let input;
		if (typeof value === "boolean") {
			input = document.createElement("input");
			input.type = "checkbox";
			input.checked = value;
		} else if (typeof value === "number") {
			input = document.createElement("input");
			input.type = "number";
			input.value = value;
		} else {
			input = document.createElement("input");
			input.type = "text";
			input.value = value;
		}

		input.dataset.key = key;

		if (key === "_alwaysTop") {
			input.onchange = async () => {
				config._alwaysTop = input.checked;
				await invoke("set_gadget_top", { name, alwaysTop: input.checked });
				await invoke("save_gadget_config", { name, config });
				setTimeout(() => loadConfig(name), 500);
			};
		} else {
			input.onchange = async () => {
				if (input.type === "checkbox") {
					config[key] = input.checked;
				} else if (input.type === "number") {
					config[key] = Number(input.value);
				} else {
					config[key] = input.value;
				}
				await invoke("save_gadget_config", { name, config });
				setTimeout(() => loadConfig(name), 500);
			};
		}

		row.appendChild(label);
		row.appendChild(input);
		form.appendChild(row);
	});

	area.appendChild(form);
}

document.getElementById("close-btn").addEventListener("click", async () => {
	try {
		await invoke("window_close");
	} catch (err) {
		console.error("No se pudo cerrar el panel:", err);
	}
});

init();
