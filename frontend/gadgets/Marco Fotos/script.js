const fs = require("fs");
const path = require("path");
const { ipcRenderer } = require("electron");
const userData = ipcRenderer.sendSync("get-user-data-path");
const gadgetName = path.basename(__dirname);
const configPath = path.join(userData, gadgetName, "config.json");

let config = {};
try {
	config = JSON.parse(fs.readFileSync(configPath));
} catch (err) {
	console.error("No se pudo leer config.json del usuario", err);
	config = { folder: "images", interval: 5000 };
}

let folderPath;
if (path.isAbsolute(config.folder)) {
	folderPath = config.folder;
} else {
	folderPath = path.resolve(__dirname, config.folder);
}


let images = [];
try {
	images = fs.readdirSync(folderPath).filter(f => /\.(jpe?g|png|gif)$/i.test(f));
} catch (err) {
	console.error("No se pudo leer carpeta de imágenes", folderPath, err);
}

const photoEl = document.getElementById("photo");
let index = 0;
function showNext() {
	if (images.length === 0) return;

	const imgPath = path.join(folderPath, images[index]);

	photoEl.src = `file://${imgPath}`;
	photoEl.classList.remove("active");
	void photoEl.offsetWidth;
	photoEl.classList.add("active");

	index = (index + 1) % images.length;
}

showNext();
setInterval(showNext, config.interval);
