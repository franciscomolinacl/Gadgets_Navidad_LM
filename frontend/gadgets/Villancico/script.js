const fs = require('fs');
const path = require('path');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const audio = document.getElementById('audio');
const notesContainer = document.getElementById('notes');
const title = document.querySelector('h3');

let interval;
const gadgetDir = __dirname;
const files = fs.readdirSync(gadgetDir);
const mp3File = files.find(f => f.endsWith('.mp3'));

if (mp3File) {
	audio.src = path.join(gadgetDir, mp3File);
	const songName = path.basename(mp3File, '.mp3');
	title.textContent = songName + ' 🎵';
} else {
	title.textContent = 'Sin villancico 🎵';
}

function createNote() {
	const note = document.createElement('div');
	note.className = 'note';
	note.textContent = '🎵';
	note.style.left = Math.random() * 250 + 'px';
	note.style.animationDuration = (2 + Math.random() * 2) + 's';
	notesContainer.appendChild(note);
	setTimeout(() => note.remove(), 4000);
}

playBtn.addEventListener('click', () => {
	if (!audio.src) return;
	audio.play();
	interval = setInterval(createNote, 300);
});

pauseBtn.addEventListener('click', () => {
	audio.pause();
});

stopBtn.addEventListener('click', () => {
	audio.pause();
	audio.currentTime = 0;
	clearInterval(interval);
});
