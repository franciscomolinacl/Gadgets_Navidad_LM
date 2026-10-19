const invoke = window.__TAURI__.core.invoke;

const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const audio = document.getElementById('audio');
const notesContainer = document.getElementById('notes');
const title = document.querySelector('h3');
let interval;

async function loadVillancico() {
	try {
		const files = await invoke('gadget_media_files', { name: 'Villancico', subfolder: null });
		const mp3 = files.find((f) => f.toLowerCase().endsWith('.mp3'));
		if (mp3 && audio) {
			audio.src = await resolveSrc(mp3);
			title.textContent = decodeURIComponent(mp3).replace(/\.mp3$/i, '') + ' 🎵';
		} else {
			title.textContent = 'Sin villancico 🎵';
		}
	} catch (e) {
		console.error('No se pudo cargar el villancico:', e);
		title.textContent = 'Sin villancico 🎵';
	}
}

// GStreamer (backend de WebKitGTK) no reproduce el esquema custom "tauri://",
// asi que el archivo se resuelve a un blob URL via fetch.
async function resolveSrc(file) {
	const url = encodeURI(file);
	try {
		const res = await fetch(url);
		const blob = await res.blob();
		return URL.createObjectURL(blob);
	} catch (e) {
		return url;
	}
}

function createNote() {
	if (!notesContainer) return;
	const note = document.createElement('div');
	note.className = 'note';
	note.textContent = '🎵';
	note.style.left = Math.random() * 250 + 'px';
	note.style.animationDuration = (2 + Math.random() * 2) + 's';
	notesContainer.appendChild(note);
	setTimeout(() => note.remove(), 4000);
}

playBtn.addEventListener('click', () => {
	if (!audio || !audio.src) return;
	audio.play();
	interval = setInterval(createNote, 300);
});

pauseBtn.addEventListener('click', () => {
	if (audio) audio.pause();
});

stopBtn.addEventListener('click', () => {
	if (audio) {
		audio.pause();
		audio.currentTime = 0;
	}
	clearInterval(interval);
});

loadVillancico();
