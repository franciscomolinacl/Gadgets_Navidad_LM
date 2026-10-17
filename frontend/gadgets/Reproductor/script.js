const invoke = window.__TAURI__.core.invoke;

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

let playlist = [];
let currentIndex = 0;
let audio = null;
let audioCtx, source, analyser, dataArray, bars;
let lastVolume = 1;

const imageExtensions = ['.jpg', '.jpeg', '.png'];

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
		const bar = document.createElement('div');
		visualizerEl.appendChild(bar);
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

function loadSong(index) {
	const file = playlist[index];
	if (!file) return;
	audio.src = encodeURI(file);
	songNameEl.innerHTML = decodeURIComponent(file).replace(/\.mp3$/i, '');
	songNameEl.style.animationDuration = (window.__marqueeSpeed || 50) + 's';
}

function bindControls() {
	playBtn.onclick = () => {
		if (!audio.src) return;
		try { audioCtx.resume(); } catch (e) {}
		audio.play();
	};
	pauseBtn.onclick = () => audio.pause();
	stopBtn.onclick = () => { audio.pause(); audio.currentTime = 0; };
	nextBtn.onclick = () => {
		if (!playlist.length) return;
		currentIndex = (currentIndex + 1) % playlist.length;
		loadSong(currentIndex);
		audio.play();
	};
	prevBtn.onclick = () => {
		if (!playlist.length) return;
		currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
		loadSong(currentIndex);
		audio.play();
	};
	randomBtn.onclick = () => {
		if (!playlist.length) return;
		currentIndex = Math.floor(Math.random() * playlist.length);
		loadSong(currentIndex);
		audio.play();
	};
	audio.addEventListener('timeupdate', () => {
		progressEl.value = (audio.currentTime / audio.duration) * 100;
	});
	progressEl.addEventListener('input', () => {
		audio.currentTime = (progressEl.value / 100) * audio.duration;
	});
	audio.addEventListener('ended', () => {
		if (!playlist.length) return;
		currentIndex = (currentIndex + 1) % playlist.length;
		loadSong(currentIndex);
		audio.play();
	});
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

async function init() {
	try {
		const cfg = await invoke('load_gadget_config', { name: 'Reproductor' });
		const folder = cfg.folder || 'musica';
		window.__marqueeSpeed = cfg.marqueeSpeed || 50;

		const files = await invoke('gadget_media_files', { name: 'Reproductor', subfolder: folder });
		playlist = files.filter((f) => f.toLowerCase().endsWith('.mp3'));

		const cover = files.find((f) => imageExtensions.some((ext) => f.toLowerCase().endsWith(ext)));
		coverEl.src = cover ? encodeURI(cover) : 'default_cover.png';

		audio = new Audio();
		setupVisualizer();
		render();
		bindControls();
		if (playlist.length > 0) loadSong(currentIndex);
	} catch (e) {
		console.error('No se pudo inicializar el reproductor:', e);
	}
}

init();
