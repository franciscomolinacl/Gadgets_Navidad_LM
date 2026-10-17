const { listen } = window.__TAURI__.event;

listen('cpu-ram', (event) => {
	const stats = event.payload;
	const { cpu, ram } = stats;

	document.getElementById('cpuFill').style.width = cpu + "%";
	document.getElementById('cpuValue').textContent = cpu + "%";

	document.getElementById('ramFill').style.width = ram + "%";
	document.getElementById('ramValue').textContent = ram + "%";
});
