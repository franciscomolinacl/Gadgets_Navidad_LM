const invoke = window.__TAURI__.core.invoke;

const photoEl = document.getElementById('photo');
let images = [];
let index = 0;
let interval = 5000;

const imagePattern = /\.(jpe?g|png|gif)$/i;

async function init() {
	try {
		const cfg = await invoke('load_gadget_config', { name: 'Marco Fotos' });
		const folder = cfg.folder || 'images';
		interval = cfg.interval || 5000;

		const files = await invoke('gadget_media_files', { name: 'Marco Fotos', subfolder: folder });
		images = files.filter((f) => imagePattern.test(f));

		if (images.length === 0) {
			console.warn('No se encontraron imagenes en', folder);
			return;
		}
		showNext();
		setInterval(showNext, interval);
	} catch (e) {
		console.error('No se pudo inicializar Marco Fotos:', e);
	}
}

function showNext() {
	if (images.length === 0 || !photoEl) return;
	photoEl.src = encodeURI(images[index]);
	photoEl.classList.remove('active');
	void photoEl.offsetWidth;
	photoEl.classList.add('active');
	index = (index + 1) % images.length;
}

init();
