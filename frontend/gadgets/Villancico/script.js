const invoke = window.__TAURI__.core.invoke;

const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const audio = document.getElementById('audio');
const notesContainer = document.getElementById('notes');
const title = document.querySelector('h3');
let interval;
let mediaBase = '';

async function loadVillancico() {
	try {
		mediaBase = await invoke('media_server_base');
		const files = await invoke('gadget_media_files', { name: 'Villancico', subfolder: null });
		const mp3 = files.find((f) => f.toLowerCase().endsWith('.mp3'));
		if (mp3 && audio) {
			audio.src = resolveSrc(mp3);
			title.textContent = decodeURIComponent(mp3).replace(/\.mp3$/i, '') + ' 🎵';
		} else {
			title.textContent = 'Sin villancico 🎵';
		}
	} catch (e) {
		console.error('No se pudo cargar el villancico:', e);
		title.textContent = 'Sin villancico 🎵';
	}
}

// WebKitGTK no reproduce audio desde esquemas custom (tauri://) ni desde blob
// (al estimar duración salta a ~50% del archivo). El backend expone un HTTP
// local con soporte de Range, que es la única vía fiable en Linux.
function resolveSrc(file) {
	return mediaBase + '/a/Villancico/' + file.split('/').map(encodeURIComponent).join('/');
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
