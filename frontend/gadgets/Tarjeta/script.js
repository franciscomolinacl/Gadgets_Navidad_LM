const invoke = window.__TAURI__.core.invoke;
const NAME = "Tarjeta";

const messageEl = document.getElementById("message");
const signatureEl = document.getElementById("signature");

let cfg = {};
let saveTimer = null;

function scheduleSave() {
	clearTimeout(saveTimer);
	saveTimer = setTimeout(save, 600);
}

function save() {
	cfg.message = messageEl.innerText.replace(/\n+$/, "");
	cfg.signature = signatureEl.innerText.replace(/\n+$/, "");
	invoke("save_gadget_config", { name: NAME, config: cfg });
}

signatureEl.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		e.preventDefault();
		signatureEl.blur();
	}
});

messageEl.addEventListener("input", scheduleSave);
signatureEl.addEventListener("input", scheduleSave);
messageEl.addEventListener("blur", save);
signatureEl.addEventListener("blur", save);

async function init() {
	try {
		cfg = await invoke("load_gadget_config", { name: NAME });
	} catch (e) {
		cfg = {};
	}
	messageEl.textContent = cfg.message || "";
	signatureEl.textContent = cfg.signature || "";
}

init();
