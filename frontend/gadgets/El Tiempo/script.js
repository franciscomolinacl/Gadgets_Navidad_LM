const fs = require("fs");
const path = require("path");
const { ipcRenderer } = require("electron");

const userData = ipcRenderer.sendSync("get-user-data-path");

const gadgetName = path.basename(__dirname);

const configPath = path.join(userData, gadgetName, "config.json");

let config = {};
try {
    config = JSON.parse(fs.readFileSync(configPath));
} catch (err) {
    console.error("No se pudo leer config.json, usando valores por defecto", err);
    config = { lat: -33.0510985, lon: -71.6222294 };
}

const lat = config.lat;
const lon = config.lon;

async function loadWeather() {

    try {
	
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,apparent_temperature`;

        const res = await fetch(url);
        const data = await res.json();

        const t = data.current.temperature_2m;
        const feels = data.current.apparent_temperature;
        const code = data.current.weather_code;

        document.getElementById("temp").textContent = Math.round(t);
        document.getElementById("feels").textContent = Math.round(feels);
        document.getElementById("desc").textContent = codeToText(code);
        document.getElementById("weather-icon").textContent = weatherEmoji(code);

    } catch (e) {
        console.error(e);
        document.getElementById("desc").textContent = "Error";
    }
}

function codeToText(code) {
    if ([0].includes(code)) return "Despejado";
    if ([1,2,3].includes(code)) return "Parcial/Nublado";
    if ([45,48].includes(code)) return "Niebla";
    if ([51,53,55].includes(code)) return "Llovizna";
    if ([61,63,65].includes(code)) return "Lluvia";
    if ([71,73,75].includes(code)) return "Nieve";
    if ([95,96,99].includes(code)) return "Tormenta";
    return "Clima desconocido";
}

function weatherEmoji(code) {
    if ([71,73,75].includes(code)) return "❄️";        // nieve
    if ([0].includes(code)) return "🎄";                // despejado navideño
    if ([1,2,3].includes(code)) return "☁️";
    if ([61,63,65].includes(code)) return "🌧️";
    if ([45,48].includes(code)) return "🌫️";
    if ([95,96,99].includes(code)) return "⛈️";
    return "🎅";
}

// cargar al inicio
loadWeather();

// actualizar cada 10 min
setInterval(loadWeather, 10 * 60 * 1000);
