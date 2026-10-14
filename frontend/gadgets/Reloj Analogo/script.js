function addLightsCircular() {
	const border = document.querySelector(".lights");
	const totalLights = 36;
	const colors = ["red", "green", "gold", "blue"];
	const radius = 115; // alrededor del reloj

	for (let i = 0; i < totalLights; i++) {
		const angle = (i / totalLights) * Math.PI * 2;
		const x = Math.cos(angle) * radius;
		const y = Math.sin(angle) * radius;

		const light = document.createElement("span");
		const c = colors[Math.floor(Math.random() * colors.length)];

		light.style.background = c;
		light.style.boxShadow = `0 0 8px ${c}`;

		light.style.left = `${110 + x - 6}px`; // centro (110px) - radio (6px)
		light.style.top = `${110 + y - 6}px`;

		border.appendChild(light);
	}
}

function updateClock() {
    const now = new Date();

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const secondDeg = seconds * 6;
    const minuteDeg = minutes * 6;
    const hourDeg = (hours % 12) * 30 + minutes * 0.5;

    document.querySelector('.hand.hour').style.transform = `rotate(${hourDeg}deg)`;
    document.querySelector('.hand.minute').style.transform = `rotate(${minuteDeg}deg)`;
    document.querySelector('.hand.second').style.transform = `rotate(${secondDeg}deg)`;

}

function addCircularLights() {
    const lightsContainer = document.querySelector(".lights");

    const totalLights = 36;
    const radius = 138;
    const colors = ["red", "green", "gold", "blue"];

    for (let i = 0; i < totalLights; i++) {
        const light = document.createElement("div");
        light.classList.add("light");

        const c = colors[Math.floor(Math.random() * colors.length)];
        light.style.background = c;
        light.style.boxShadow = `0 0 8px ${c}`;

        const angle = (i / totalLights) * 2 * Math.PI;

        const x = radius + Math.cos(angle) * (radius - 8);
        const y = radius + Math.sin(angle) * (radius - 8);

        light.style.left = `${x - 6}px`;
        light.style.top = `${y - 6}px`;

        light.style.animationDelay = `${Math.random()}s`;

        lightsContainer.appendChild(light);
    }
}

function addNumbers() {
    const numbersContainer = document.querySelector(".numbers");

    const positions = [
        { num: "12", angle: -90 },
        { num: "3",  angle: 0 },
        { num: "6",  angle: 90 },
        { num: "9",  angle: 180 }
    ];

    const radius = 100; // distancia del centro

    positions.forEach(p => {
        const number = document.createElement("div");
        number.classList.add("number");
        number.textContent = p.num;

        const rad = (p.angle * Math.PI) / 180;

        const x = 138 + Math.cos(rad) * radius;
        const y = 138 + Math.sin(rad) * radius;

        number.style.left = `${x}px`;
        number.style.top = `${y}px`;

        numbersContainer.appendChild(number);
    });
}

window.onload = () => {
    addCircularLights();
    addNumbers();
    updateClock();
    setInterval(updateClock, 1000);
};
