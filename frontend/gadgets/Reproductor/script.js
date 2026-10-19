const invoke = window.__TAURI__.core.invoke;
const listen =
	(window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.listen) ||
	(() => Promise.resolve(() => {}));

const coverEl = document.getElementById('cover');
const songNameEl = document.getElementById('song-name');
const visualizerEl = document.getElementById('visualizer');
const progressEl = document.getElementById('progress');
const volumeEl = document.getElementById('volume');
const muteBtn = document.getElementById('muteBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const randomBtn = document.getElementById('randomBtn');
const playlistEl = document.getElementById('playlist');

let cfg = {};
let playlist = [];
let currentIndex = 0;
let audio = null;
let audioCtx, source, analyser, dataArray, bars;
let lastVolume = 1;

const imageExtensions = ['.jpg', '.jpeg', '.png'];

function songLabel(file) {
	return decodeURIComponent(file).split('/').pop().replace(/\.[a-z0-9]+$/i, '');
}

function isExternal(file) {
	return file.startsWith('/');
}

function dataUriToBlob(dataUri) {
	const comma = dataUri.indexOf(',');
	const mime = dataUri.slice(5, dataUri.indexOf(';'));
	const bin = atob(dataUri.slice(comma + 1));
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new Blob([bytes], { type: mime });
}

function updatePlaylistHighlight() {
	const items = playlistEl.children;
	for (let i = 0; i < items.length; i++) {
		items[i].classList.toggle('current', i === currentIndex);
	}
	const current = items[currentIndex];
	if (current) current.scrollIntoView({ block: 'nearest' });
}

function renderPlaylist() {
	playlistEl.innerHTML = '';
	playlist.forEach((file, i) => {
		const item = document.createElement('button');
		item.className = 'pl-item' + (i === currentIndex ? ' current' : '');

		const num = document.createElement('span');
		num.className = 'pl-num';
		num.textContent = String(i + 1);

		const title = document.createElement('span');
		title.className = 'pl-title';
		title.textContent = songLabel(file);

		item.appendChild(num);
		item.appendChild(title);
		item.addEventListener('click', () => goTo(i, true));
		playlistEl.appendChild(item);
	});
}

function setupVisualizer() {
	audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	source = audioCtx.createMediaElementSource(audio);
	analyser = audioCtx.createAnalyser();
	source.connect(analyser);
	analyser.connect(audioCtx.destination);
	analyser.fftSize = 64;
	const bufferLength = analyser.frequencyBinCount;
	dataArray = new Uint8Array(bufferLength);
	for (let i = 0; i < bufferLength; i++) {
		visualizerEl.appendChild(document.createElement('div'));
	}
	bars = Array.from(visualizerEl.children);
}

function render() {
	requestAnimationFrame(render);
	if (!analyser) return;
	analyser.getByteFrequencyData(dataArray);
	bars.forEach((bar, i) => {
		bar.style.height = (dataArray[i] / 255 * 100) + '%';
	});
}

// El backend GStreamer de WebKitGTK no puede reproducir el esquema custom
// "tauri://", asi que el archivo se resuelve a un blob URL via fetch.
// Para rutas externas el backend entrega un data URI que se convierte a Blob.
async function resolveSrc(file) {
	if (isExternal(file)) {
		try {
			const dataUri = await invoke('media_file_data_uri', { path: file });
			return URL.createObjectURL(dataUriToBlob(dataUri));
		} catch (e) {
			console.error('No se pudo leer el archivo:', file, e);
			return '';
		}
	}
	const url = encodeURI(file);
	try {
		const res = await fetch(url);
		const blob = await res.blob();
		return URL.createObjectURL(blob);
	} catch (e) {
		return url;
	}
}

async function loadSong(index) {
	const file = playlist[index];
	if (!file) return;
	const src = await resolveSrc(file);
	if (!src) return;
	if (audio.__blobUrl) URL.revokeObjectURL(audio.__blobUrl);
	audio.__blobUrl = src.startsWith('blob:') ? src : null;
	audio.src = src;
	songNameEl.textContent = songLabel(file);
	songNameEl.style.animationDuration = (window.__marqueeSpeed || 50) + 's';
	updatePlaylistHighlight();
}

async function goTo(index, autoplay) {
	if (!playlist.length) return;
	currentIndex = index;
	await loadSong(currentIndex);
	if (autoplay) {
		try { audioCtx.resume(); } catch (e) {}
		const p = audio.play();
		if (p && p.catch) p.catch(() => {});
	}
}

function bindControls() {
	playBtn.onclick = () => {
		if (!audio.src) return;
		try { audioCtx.resume(); } catch (e) {}
		const p = audio.play();
		if (p && p.catch) p.catch(() => {});
	};
	pauseBtn.onclick = () => audio.pause();
	stopBtn.onclick = () => { audio.pause(); audio.currentTime = 0; };
	nextBtn.onclick = () => goTo((currentIndex + 1) % playlist.length, true);
	prevBtn.onclick = () => goTo((currentIndex - 1 + playlist.length) % playlist.length, true);
	randomBtn.onclick = () => goTo(Math.floor(Math.random() * playlist.length), true);
	audio.addEventListener('timeupdate', () => {
		progressEl.value = (audio.currentTime / audio.duration) * 100;
	});
	progressEl.addEventListener('input', () => {
		audio.currentTime = (progressEl.value / 100) * audio.duration;
	});
	audio.addEventListener('ended', () => goTo((currentIndex + 1) % playlist.length, true));
	volumeEl.oninput = () => { audio.volume = volumeEl.value; };
	muteBtn.onclick = () => {
		if (audio.volume > 0) {
			lastVolume = audio.volume;
			audio.volume = 0;
			volumeEl.value = 0;
			muteBtn.textContent = '🔊';
		} else {
			audio.volume = lastVolume;
			volumeEl.value = lastVolume;
			muteBtn.textContent = '🔇';
		}
	};
}

async function loadLibrary() {
	cfg = await invoke('load_gadget_config', { name: 'Reproductor' });
	window.__marqueeSpeed = cfg.marqueeSpeed || 50;

	const files = await invoke('gadget_media_files', {
		name: 'Reproductor',
		subfolder: cfg.folder || 'musica',
	});
	playlist = files.filter((f) => f.toLowerCase().endsWith('.mp3'));

	const cover = files.find((f) => imageExtensions.some((ext) => f.toLowerCase().endsWith(ext)));
	if (cover) {
		coverEl.src = isExternal(cover)
			? await invoke('media_file_data_uri', { path: cover }).catch(() => 'icon.png')
			: encodeURI(cover);
	} else {
		coverEl.src = 'icon.png';
	}

	renderPlaylist();
	if (playlist.length > 0) {
		if (currentIndex >= playlist.length) currentIndex = 0;
		await loadSong(currentIndex);
	} else {
		songNameEl.textContent = '';
	}
}

async function init() {
	try {
		audio = new Audio();
		setupVisualizer();
		render();
		bindControls();
		await loadLibrary();
	} catch (e) {
		console.error('No se pudo inicializar el reproductor:', e);
	}
}

listen('gadget:config-saved', async (event) => {
	const { name, config } = event.payload || {};
	if (name !== 'Reproductor' || !config) return;
	try {
		const folderChanged = (config.folder || 'musica') !== (cfg.folder || 'musica');
		const speedChanged = (config.marqueeSpeed || 50) !== (window.__marqueeSpeed || 50);
		if (folderChanged) {
			const wasPlaying = audio && !audio.paused;
			await loadLibrary();
			if (wasPlaying && playlist.length) {
				try { audioCtx.resume(); } catch (e) {}
				const p = audio.play();
				if (p && p.catch) p.catch(() => {});
			}
		} else if (speedChanged) {
			window.__marqueeSpeed = config.marqueeSpeed || 50;
			songNameEl.style.animationDuration = window.__marqueeSpeed + 's';
		}
	} catch (e) {
		console.error('No se pudo recargar la configuración:', e);
	}
});

init();
