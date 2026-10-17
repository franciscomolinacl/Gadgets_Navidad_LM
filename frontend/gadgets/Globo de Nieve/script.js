const canvas = document.getElementById("globe");
const ctx = canvas.getContext("2d");

const W = 260, H = 300;
const CX = 130, CY = 124, R = 100;
const GROUND_Y = CY + R - 18;

let DPR = Math.min(window.devicePixelRatio || 1, 2);
let flakes = [];
let t = 0;

function fit() {
	canvas.width = W * DPR;
	canvas.height = H * DPR;
	canvas.style.width = W + "px";
	canvas.style.height = H + "px";
	ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function halfWidth(y) {
	const dy = y - CY;
	const v = R * R - dy * dy;
	return v > 0 ? Math.sqrt(v) : 0;
}

function newFlake(y) {
	const x = CX + (Math.random() * 2 - 1) * R * 0.8;
	return {
		x: x,
		y: y !== undefined ? y : CY - R + Math.random() * 30,
		vx: (Math.random() - 0.5) * 0.4,
		vy: Math.random() * 0.6 + 0.3,
		r: Math.random() * 1.8 + 0.8
	};
}

function makeFlakes() {
	flakes = [];
	for (let i = 0; i < 90; i++) flakes.push(newFlake(Math.random() * H));
}

function update() {
	t += 1;
	for (const f of flakes) {
		f.vy += 0.012;
		f.vx += Math.sin((t + f.y) * 0.02) * 0.01;
		f.vx *= 0.99;
		f.vy *= 0.995;
		f.x += f.vx;
		f.y += f.vy;

		const hw = halfWidth(Math.min(f.y, CY + R - 4)) - 4;
		if (f.x < CX - hw) { f.x = CX - hw; f.vx = Math.abs(f.vx) * 0.5; }
		if (f.x > CX + hw) { f.x = CX + hw; f.vx = -Math.abs(f.vx) * 0.5; }

		if (f.y > GROUND_Y) {
			f.y = GROUND_Y;
			f.vy = 0;
			f.vx *= 0.6;
			if (Math.random() < 0.02) Object.assign(f, newFlake(CY - R + 10));
		}
	}
}

function circle(x, y, r, fill) {
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fillStyle = fill;
	ctx.fill();
}

function drawScene() {
	const sky = ctx.createLinearGradient(0, CY - R, 0, CY + R);
	sky.addColorStop(0, "#12304a");
	sky.addColorStop(1, "#0a1f33");
	ctx.fillStyle = sky;
	ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

	circle(CX + 52, CY - 56, 12, "rgba(240,244,255,0.85)");
	ctx.globalCompositeOperation = "destination-out";
	circle(CX + 46, CY - 60, 11, "#000");
	ctx.globalCompositeOperation = "source-over";

	ctx.beginPath();
	ctx.moveTo(CX - R, GROUND_Y + 20);
	ctx.quadraticCurveTo(CX - 40, GROUND_Y - 14, CX + 10, GROUND_Y - 2);
	ctx.quadraticCurveTo(CX + 50, GROUND_Y + 8, CX + R, GROUND_Y - 6);
	ctx.lineTo(CX + R, CY + R);
	ctx.lineTo(CX - R, CY + R);
	ctx.closePath();
	ctx.fillStyle = "#eef3fb";
	ctx.fill();

	drawTree(CX - 46, GROUND_Y + 6, 96);
	drawSnowman(CX + 40, GROUND_Y + 4);
}

function drawTree(x, baseY, h) {
	ctx.fillStyle = "#5b3a1e";
	ctx.fillRect(x - 4, baseY - 10, 8, 14);
	const greens = ["#2f8c53", "#35a061", "#3fb26d"];
	for (let i = 0; i < 3; i++) {
		const w = 34 - i * 7;
		const yTop = baseY - h + i * (h * 0.3);
		const yBot = yTop + h * 0.42;
		ctx.beginPath();
		ctx.moveTo(x, yTop);
		ctx.lineTo(x - w, yBot);
		ctx.lineTo(x + w, yBot);
		ctx.closePath();
		ctx.fillStyle = greens[i];
		ctx.fill();
	}
	ctx.fillStyle = "#d4af37";
	ctx.beginPath();
	ctx.moveTo(x, baseY - h - 8);
	ctx.lineTo(x + 5, baseY - h + 2);
	ctx.lineTo(x - 5, baseY - h + 2);
	ctx.closePath();
	ctx.fill();
}

function drawSnowman(x, baseY) {
	circle(x, baseY - 16, 15, "#f7f9ff");
	circle(x, baseY - 42, 11, "#f7f9ff");
	circle(x, baseY - 60, 8, "#f7f9ff");
	circle(x - 3, baseY - 62, 1.4, "#2a2a2a");
	circle(x + 3, baseY - 62, 1.4, "#2a2a2a");
	ctx.fillStyle = "#e07a2f";
	ctx.beginPath();
	ctx.moveTo(x, baseY - 59);
	ctx.lineTo(x + 8, baseY - 57);
	ctx.lineTo(x, baseY - 55);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = "#b3261e";
	ctx.fillRect(x - 9, baseY - 72, 18, 4);
	ctx.fillRect(x - 6, baseY - 84, 12, 12);
}

function drawFlakes() {
	ctx.fillStyle = "rgba(255,255,255,0.95)";
	for (const f of flakes) {
		ctx.beginPath();
		ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawGlass() {
	const g = ctx.createRadialGradient(CX - 40, CY - 50, 10, CX, CY, R);
	g.addColorStop(0, "rgba(255,255,255,0.18)");
	g.addColorStop(0.5, "rgba(255,255,255,0.02)");
	g.addColorStop(1, "rgba(255,255,255,0)");
	ctx.beginPath();
	ctx.arc(CX, CY, R, 0, Math.PI * 2);
	ctx.fillStyle = g;
	ctx.fill();

	ctx.beginPath();
	ctx.arc(CX, CY, R, 0, Math.PI * 2);
	ctx.lineWidth = 4;
	ctx.strokeStyle = "rgba(180,205,230,0.55)";
	ctx.stroke();

	ctx.beginPath();
	ctx.arc(CX - 34, CY - 40, 26, Math.PI * 0.9, Math.PI * 1.5);
	ctx.lineWidth = 6;
	ctx.strokeStyle = "rgba(255,255,255,0.5)";
	ctx.lineCap = "round";
	ctx.stroke();
}

function drawBase() {
	const topY = CY + R - 14;
	const g = ctx.createLinearGradient(CX - 70, topY, CX + 70, topY + 60);
	g.addColorStop(0, "#8a6d1f");
	g.addColorStop(0.5, "#d4af37");
	g.addColorStop(1, "#8a6d1f");
	ctx.beginPath();
	ctx.moveTo(CX - 52, topY);
	ctx.quadraticCurveTo(CX, topY + 14, CX + 52, topY);
	ctx.lineTo(CX + 66, topY + 46);
	ctx.quadraticCurveTo(CX, topY + 64, CX - 66, topY + 46);
	ctx.closePath();
	ctx.fillStyle = g;
	ctx.fill();
	ctx.strokeStyle = "rgba(60,45,10,0.6)";
	ctx.lineWidth = 1;
	ctx.stroke();
}

function draw() {
	ctx.clearRect(0, 0, W, H);
	drawBase();
	ctx.save();
	ctx.beginPath();
	ctx.arc(CX, CY, R - 3, 0, Math.PI * 2);
	ctx.clip();
	drawScene();
	update();
	drawFlakes();
	ctx.restore();
	drawGlass();
	requestAnimationFrame(draw);
}

function shake() {
	for (const f of flakes) {
		f.vx += (Math.random() - 0.5) * 6;
		f.vy -= Math.random() * 7 + 2;
	}
}

canvas.addEventListener("click", shake);
window.addEventListener("resize", fit);

fit();
makeFlakes();
draw();
