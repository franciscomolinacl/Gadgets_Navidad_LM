const { ipcRenderer } = require('electron');
const WIDTH = 150;
const HEIGHT = 50;
const MAX_POINTS = 60;
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
const rxArr = new Array(MAX_POINTS).fill(0);
const txArr = new Array(MAX_POINTS).fill(0);
const rxLabel = document.getElementById('rx');
const txLabel = document.getElementById('tx');
const ifaceLabel = document.getElementById('iface');

function formatBytesPerSec(bps) {
	if (bps >= 1024 * 1024) return (bps / (1024 * 1024)).toFixed(1) + ' MB/s';
	if (bps >= 1024) return (bps / 1024).toFixed(1) + ' KB/s';
	return bps + ' B/s';
}

function pushSample(rx, tx) {
	rxArr.shift();
	txArr.shift();
	rxArr.push(rx);
	txArr.push(tx);
}

function draw() {
	ctx.clearRect(0, 0, WIDTH, HEIGHT);
	const maxVal = Math.max(...rxArr, ...txArr, 1);

	function plotLine(arr, color, alpha=1) {
		ctx.beginPath();
		ctx.lineWidth = 2;
		ctx.strokeStyle = color;
		ctx.globalAlpha = alpha;
		for (let i = 0; i < arr.length; i++) {
			const x = (i / (MAX_POINTS - 1)) * (WIDTH - 2) + 1;
			const y = HEIGHT - 2 - (arr[i] / maxVal) * (HEIGHT - 4);
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	plotLine(rxArr, '#66c2ff', 0.95);
	plotLine(txArr, '#ffa366', 0.95);
}

ipcRenderer.on('net-stats', (e, stats) => {
	const { rx, tx, iface } = stats;
	pushSample(rx, tx);

	rxLabel.textContent = '↓ ' + formatBytesPerSec(rx);
	txLabel.textContent = '↑ ' + formatBytesPerSec(tx);
	ifaceLabel.textContent = iface;

	draw();
});

window.addEventListener('DOMContentLoaded', () => {
	draw();
});
