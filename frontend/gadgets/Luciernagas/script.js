function startFirefly() {
	
	const container = document.getElementById("container");

	function w() { return window.innerWidth; }
	function h() { return window.innerHeight; }

	const FIREFLY_COUNT = 40;
	const CROSS_DISTANCE = 30;

	let fireflies = [];

	function randomCurvePath() {
		const x1 = Math.random() * w();
		const y1 = Math.random() * h();
		const x2 = Math.random() * w();
		const y2 = Math.random() * h();

		const cx = (x1 + x2) / 2 + (Math.random() * 400 - 200);
		const cy = (y1 + y2) / 2 + (Math.random() * 400 - 200);

		return `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
	}

	function organicTransform(time) {
		const waveX = Math.sin(time / 500) * 2;
		const waveY = Math.cos(time / 700) * 2;

		const jitterX = (Math.random() - 0.5) * 0.4;
		const jitterY = (Math.random() - 0.5) * 0.4;

		return `translate(${waveX + jitterX}px, ${waveY + jitterY}px)`;
	}

	function createFirefly() {
		const el = document.createElement("div");
		el.classList.add("firefly");
		container.appendChild(el);

		const obj = { el, x: 0, y: 0 };
		fireflies.push(obj);

		moveFirefly(el);
		animateOrganic(obj);
	}

	function moveFirefly(el) {
		const path = randomCurvePath();
		const duration = 10000 + Math.random() * 10000;

		el.style.offsetPath = `path("${path}")`;

		el.animate(
			[
				{ offsetDistance: "0%" },
				{ offsetDistance: "100%" }
			],
			{
				duration,
				easing: "ease-in-out",
				fill: "forwards"
			}
		).onfinish = () => moveFirefly(el);
	}

	function animateOrganic(obj) {
		let start = performance.now();

		function frame(now) {
			const t = now - start;

			obj.el.style.transform = organicTransform(t);

			// posición exacta en pantalla
			const rect = obj.el.getBoundingClientRect();
			obj.x = rect.x + rect.width / 2;
			obj.y = rect.y + rect.height / 2;

			detectCrosses(obj);

			requestAnimationFrame(frame);
		}

		requestAnimationFrame(frame);
	}

	/* 🔥 Detecta cuando dos luciérnagas se cruzan */
	function detectCrosses(fly) {
		for (let other of fireflies) {
			if (other === fly) continue;

			const dx = fly.x - other.x;
			const dy = fly.y - other.y;
			const dist = Math.sqrt(dx*dx + dy*dy);

			if (dist < CROSS_DISTANCE) {
				createBurst((fly.x + other.x) / 2, (fly.y + other.y) / 2);
			}
		}
	}

	/* 💥 Crea destello suave en la posición detectada */
	function createBurst(x, y) {
		const b = document.createElement("div");
		b.classList.add("burst");
		b.style.left = x + "px";
		b.style.top = y + "px";

		container.appendChild(b);

		// remover después de la animación
		setTimeout(() => b.remove(), 600);
	}

	for (let i = 0; i < FIREFLY_COUNT; i++) {
		createFirefly();
	}

}

setTimeout(startFirefly, 300);
