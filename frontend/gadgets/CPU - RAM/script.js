const { ipcRenderer } = require('electron');

ipcRenderer.on('cpu-ram', (e, stats) => {
	const { cpu, ram } = stats;

	document.getElementById('cpuFill').style.width = cpu + "%";
	document.getElementById('cpuValue').textContent = cpu + "%";

	document.getElementById('ramFill').style.width = ram + "%";
	document.getElementById('ramValue').textContent = ram + "%";
});
