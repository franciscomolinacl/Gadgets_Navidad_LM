const { ipcRenderer, shell } = require('electron');
const container = document.getElementById('gadgets-container');
const fs = require('fs');
const path = require('path');

const gadgetStatus = {};

ipcRenderer.on("gadgets-list", (event, gadgets) => {
    const sidebar = document.getElementById("sidebar");
    sidebar.innerHTML = "";
    let activeBtn = null; 

    gadgets.forEach(name => {
        const btn = document.createElement("button");
        btn.textContent = name;
        btn.classList.add("gadget-entry");

        btn.addEventListener("click", () => {
			if (activeBtn) activeBtn.classList.remove("active");
			btn.classList.add("active");
			activeBtn = btn;
			
            ipcRenderer.send("load-gadget-config", name);
        });

        sidebar.appendChild(btn);
    });
});

ipcRenderer.on("gadget-config-data", (event, { name, config }) => {
    const area = document.getElementById("configArea");
    area.innerHTML = "";

    // --- Header con icono y nombre ---
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.marginBottom = "20px";
    header.style.gap = "10px";
    header.style.padding = "10px 15px";
    header.style.borderRadius = "10px";
    header.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    header.style.transition = "all 0.3s ease";
    header.style.border = config._active ? "2px solid #4caf50" : "2px solid #f44336";
    header.style.background = config._active ? "rgba(76,175,80,0.1)" : "rgba(244,67,54,0.1)";

    const img = document.createElement("img");
    const iconFullPath = path.join(__dirname, "gadgets", name, "icon.png");
    // si existe el icono
    try {
        img.src = fs.existsSync(iconFullPath) ? `gadgets/${name}/icon.png` : "icon.png";
    } catch {
        img.src = "icon.png";
    }
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

    // --- Inputs dinámicos ---
    const form = document.createElement("div");
    form.classList.add("config-form");

	Object.entries(config).forEach(([key, value]) => {
		if (key.startsWith("_comment") || key === "fullscreen") return;

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

		// --- Caso especial para _alwaysTop ---
		if (key === "_alwaysTop") {
			input.onchange = () => {
				config._alwaysTop = input.checked;
				ipcRenderer.send("set-gadget-top", { name, alwaysTop: input.checked });
				ipcRenderer.send("save-gadget-config", { name, config });
				setTimeout(() => {
					ipcRenderer.send("load-gadget-config", name);
				}, 500);				
			};
		}
		else {
			// Comportamiento normal
			input.onchange = () => {
				if (input.type === "checkbox") config[key] = input.checked;
				else if (input.type === "number") config[key] = Number(input.value);
				else config[key] = input.value;

				ipcRenderer.send("save-gadget-config", { name, config });
				setTimeout(() => {
					ipcRenderer.send("load-gadget-config", name);
				}, 500);				
			};
		}

		row.appendChild(label);
		row.appendChild(input);
		form.appendChild(row);
	});


    area.appendChild(form);
});


//BOTON CERRAR

document.getElementById("close-btn").addEventListener("click", () => {
  ipcRenderer.send("window-close");
});
