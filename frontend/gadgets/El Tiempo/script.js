const invoke = window.__TAURI__.core.invoke;

async function loadConfig() {
    try {
        const cfg = await invoke('load_gadget_config', { name: 'El Tiempo' });
        return cfg || { lat: -33.0510985, lon: -71.6222294 };
    } catch (e) {
        console.error('No se pudo cargar config', e);
        return { lat: -33.0510985, lon: -71.6222294 };
    }
}

async function loadWeather() {
    try {
        const cfg = await loadConfig();
        const lat = cfg.lat || -33.0510985;
        const lon = cfg.lon || -71.6222294;
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
    if ([71,73,75].includes(code)) return "❄️";
    if ([0].includes(code)) return "🎄";
    if ([1,2,3].includes(code)) return "☁️";
    if ([61,63,65].includes(code)) return "🌧️";
    if ([45,48].includes(code)) return "🌫️";
    if ([95,96,99].includes(code)) return "⛈️";
    return "🎅";
}

loadWeather();
setInterval(loadWeather, 10 * 60 * 1000);
