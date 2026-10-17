const { listen } = window.__TAURI__.event;

const MAX_SAMPLES = 60;

const cpuHistory = [];
const ramHistory = [];

const cpuSpark = document.getElementById('cpuSpark');
const ramSpark = document.getElementById('ramSpark');
const cpuValue = document.getElementById('cpuValue');
const ramValue = document.getElementById('ramValue');

const CPU_COLOR = { line: '#e74c3c', fill: 'rgba(231,76,60,0.35)' };
const RAM_COLOR = { line: '#2ecc71', fill: 'rgba(46,204,113,0.35)' };

function drawSpark(canvas, data, color) {
	const ctx = canvas.getContext('2d');
	const w = canvas.width;
	const h = canvas.height;
	ctx.clearRect(0, 0, w, h);
	if (data.length < 2) return;
	const step = w / (MAX_SAMPLES - 1);
	const offset = w - (data.length - 1) * step;
	const pointAt = (i, v) => [offset + i * step, h - (Math.min(v, 100) / 100) * h];

	ctx.beginPath();
	ctx.moveTo(offset, h);
	for (let i = 0; i < data.length; i++) {
		const [x, y] = pointAt(i, data[i]);
		ctx.lineTo(x, y);
	}
	ctx.lineTo(offset + (data.length - 1) * step, h);
	ctx.closePath();
	const grad = ctx.createLinearGradient(0, 0, 0, h);
	grad.addColorStop(0, color.fill);
	grad.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = grad;
	ctx.fill();

	ctx.beginPath();
	for (let i = 0; i < data.length; i++) {
		const [x, y] = pointAt(i, data[i]);
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.strokeStyle = color.line;
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.stroke();
}

listen('cpu-ram', (event) => {
	const { cpu, ram } = event.payload;

	cpuHistory.push(cpu);
	ramHistory.push(ram);
	if (cpuHistory.length > MAX_SAMPLES) cpuHistory.shift();
	if (ramHistory.length > MAX_SAMPLES) ramHistory.shift();

	cpuValue.textContent = cpu + '%';
	ramValue.textContent = ram + '%';

	drawSpark(cpuSpark, cpuHistory, CPU_COLOR);
	drawSpark(ramSpark, ramHistory, RAM_COLOR);
});

function fitCanvas(canvas) {
	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	if (rect.width > 0 && rect.height > 0) {
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
	}
}

function redraw() {
	fitCanvas(cpuSpark);
	fitCanvas(ramSpark);
	drawSpark(cpuSpark, cpuHistory, CPU_COLOR);
	drawSpark(ramSpark, ramHistory, RAM_COLOR);
}

window.addEventListener('DOMContentLoaded', redraw);
window.addEventListener('resize', redraw);
