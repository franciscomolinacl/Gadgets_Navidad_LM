const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require("electron");
const userData = ipcRenderer.sendSync("get-user-data-path");
const gadgetName = path.basename(__dirname);
const configPath = path.join(userData, gadgetName, "config.json");
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

const config = JSON.parse(fs.readFileSync(path.join(configPath)));
const musicFolder = path.resolve(__dirname, config.folder);

let playlist = fs.readdirSync(musicFolder).filter(f => f.endsWith(".mp3"));
let currentIndex = 0;

let coverImage = "default_cover.png";
const imageExtensions = [".jpg", ".jpeg", ".png"];

for (const file of fs.readdirSync(musicFolder)) {
	if (imageExtensions.some(ext => file.toLowerCase().endsWith(ext))) {
		coverImage = path.join(musicFolder, file);
		break;
	}
}
coverEl.src = coverImage;

let audio = new Audio();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const source = audioCtx.createMediaElementSource(audio);
const analyser = audioCtx.createAnalyser();

source.connect(analyser);
analyser.connect(audioCtx.destination);
analyser.fftSize = 64;

let bufferLength = analyser.frequencyBinCount;
let dataArray = new Uint8Array(bufferLength);

for (let i = 0; i < bufferLength; i++) {
	const bar = document.createElement("div");
	visualizerEl.appendChild(bar);
}

let bars = Array.from(visualizerEl.children);

function loadSong(index) {
	const file = playlist[index];
	audio.src = path.join(musicFolder, file);
	songNameEl.innerHTML = file.replace(".mp3", "");
	songNameEl.style.animationDuration = (config.marqueeSpeed || 50) + "s";
}

playBtn.onclick = () => {
	audio.play();
	audioCtx.resume();
};

pauseBtn.onclick = () => audio.pause();
stopBtn.onclick = () => { audio.pause(); audio.currentTime = 0; };

nextBtn.onclick = () => {
	currentIndex = (currentIndex + 1) % playlist.length;
	loadSong(currentIndex);
	audio.play();
};

prevBtn.onclick = () => {
	currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
	loadSong(currentIndex);
	audio.play();
};

randomBtn.onclick = () => {
	currentIndex = Math.floor(Math.random() * playlist.length);
	loadSong(currentIndex);
	audio.play();
};

audio.addEventListener("timeupdate", () => {
	progressEl.value = (audio.currentTime / audio.duration) * 100;
});

progressEl.addEventListener("input", () => {
	audio.currentTime = (progressEl.value / 100) * audio.duration;
});

audio.addEventListener("ended", () => {
	currentIndex = (currentIndex + 1) % playlist.length;
	loadSong(currentIndex);
	audio.play();
});

volumeEl.oninput = () => audio.volume = volumeEl.value;

let lastVolume = 1;
muteBtn.onclick = () => {
	if (audio.volume > 0) {
		lastVolume = audio.volume;
		audio.volume = 0;
		volumeEl.value = 0;
		muteBtn.textContent = "🔊";
	} else {
		audio.volume = lastVolume;
		volumeEl.value = lastVolume;
		muteBtn.textContent = "🔇";
	}
};

function render() {
	requestAnimationFrame(render);
	analyser.getByteFrequencyData(dataArray);

	bars.forEach((bar, i) => {
		bar.style.height = (dataArray[i] / 255 * 100) + "%";
	});
}
render();

if (playlist.length > 0) loadSong(currentIndex);
