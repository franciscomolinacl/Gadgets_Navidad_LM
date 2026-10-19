const invoke = window.__TAURI__.core.invoke;
const listen =
	(window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.listen) ||
	(() => Promise.resolve(() => {}));

const frameEl = document.getElementById('frame');
const photoEl = document.getElementById('photo');

const imagePattern = /\.(jpe?g|png|gif|webp)$/i;
const dataCache = new Map();
const CACHE_MAX = 3;

let cfg = {};
let images = [];
let index = 0;
let interval = 5000;
let timer = null;
let busy = false;

function isExternal(file) {
	return file.startsWith('/');
}

async function mediaSrc(file) {
	if (!isExternal(file)) return encodeURI(file);
	if (dataCache.has(file)) return dataCache.get(file);
	try {
		const uri = await invoke('media_file_data_uri', { path: file });
		if (dataCache.size >= CACHE_MAX) dataCache.delete(dataCache.keys().next().value);
		dataCache.set(file, uri);
		return uri;
	} catch (e) {
		console.error('No se pudo leer la imagen:', file, e);
		return '';
	}
}

async function showNext() {
	if (busy || images.length === 0 || !photoEl) return;
	busy = true;
	try {
		const src = await mediaSrc(images[index]);
		if (src) {
			photoEl.src = src;
			photoEl.classList.remove('active');
			void photoEl.offsetWidth;
			photoEl.classList.add('active');
		}
		index = (index + 1) % images.length;
		mediaSrc(images[index]).catch(() => {});
	} finally {
		busy = false;
	}
}

async function reload() {
	cfg = await invoke('load_gadget_config', { name: 'Marco Fotos' });
	interval = cfg.interval || 5000;
	frameEl.dataset.effect = cfg.effect || 'fade';

	const files = await invoke('gadget_media_files', {
		name: 'Marco Fotos',
		subfolder: cfg.folder || 'images',
	});
	images = files.filter((f) => imagePattern.test(f));
	index = 0;
	dataCache.clear();

	if (timer) clearInterval(timer);
	timer = null;

	if (images.length === 0) {
		console.warn('No se encontraron imagenes en', cfg.folder);
		return;
	}
	await showNext();
	timer = setInterval(showNext, interval);
}

listen('gadget:config-saved', async (event) => {
	const { name, config } = event.payload || {};
	if (name !== 'Marco Fotos' || !config) return;
	try {
		const folderChanged = (config.folder || 'images') !== (cfg.folder || 'images');
		const intervalChanged = (config.interval || 5000) !== interval;
		const effectChanged = (config.effect || 'fade') !== (frameEl.dataset.effect || 'fade');
		if (folderChanged || intervalChanged) {
			await reload();
		} else if (effectChanged) {
			frameEl.dataset.effect = config.effect || 'fade';
		}
	} catch (e) {
		console.error('No se pudo recargar la configuración:', e);
	}
});

reload().catch((e) => {
	console.error('No se pudo inicializar Marco Fotos:', e);
});
