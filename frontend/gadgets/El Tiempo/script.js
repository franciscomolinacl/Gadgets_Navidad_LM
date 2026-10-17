const invoke = window.__TAURI__.core.invoke;

const DEFAULT_CFG = { lat: -33.0510985, lon: -71.6222294, city: "Viña del Mar" };
let currentCfg = { ...DEFAULT_CFG };

const searchOverlay = document.getElementById('searchOverlay');
const cityInput = document.getElementById('cityInput');
const searchResults = document.getElementById('searchResults');
const cityEl = document.getElementById('city');

async function loadConfig() {
    try {
        const cfg = await invoke('load_gadget_config', { name: 'El Tiempo' });
        currentCfg = { ...DEFAULT_CFG, ...(cfg || {}) };
    } catch (e) {
        console.error('No se pudo cargar config', e);
        currentCfg = { ...DEFAULT_CFG };
    }
    cityEl.textContent = currentCfg.city || '--';
}

async function saveConfig() {
    try {
        await invoke('save_gadget_config', { name: 'El Tiempo', config: currentCfg });
    } catch (e) {
        console.error('No se pudo guardar config', e);
    }
}

async function loadWeather() {
    try {
        const lat = currentCfg.lat;
        const lon = currentCfg.lon;
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

// --- Búsqueda de ciudad ---

let searchTimeout = null;

async function searchCities(query) {
    if (!query || query.length < 2) {
        searchResults.innerHTML = '';
        return;
    }
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=es&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        const results = data.results || [];
        searchResults.innerHTML = '';
        results.forEach(r => {
            const item = document.createElement('div');
            item.className = 'result-item';
            const name = r.name;
            const country = [r.country, r.admin1].filter(Boolean).join(', ');
            item.innerHTML = `${name}<div class="country">${country}</div>`;
            item.addEventListener('click', () => selectCity(r));
            searchResults.appendChild(item);
        });
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="result-item" style="opacity:0.5">Sin resultados</div>';
        }
    } catch (e) {
        console.error('Error en búsqueda:', e);
    }
}

async function selectCity(result) {
    currentCfg.lat = result.latitude;
    currentCfg.lon = result.longitude;
    currentCfg.city = result.name;
    cityEl.textContent = result.name;
    searchOverlay.hidden = true;
    cityInput.value = '';
    searchResults.innerHTML = '';
    await saveConfig();
    loadWeather();
}

cityInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = cityInput.value.trim();
    if (q.length < 2) {
        searchResults.innerHTML = '';
        return;
    }
    searchTimeout = setTimeout(() => searchCities(q), 250);
});

cityEl.addEventListener('click', () => {
    searchOverlay.hidden = false;
    cityInput.focus();
});

searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) {
        searchOverlay.hidden = true;
        cityInput.value = '';
        searchResults.innerHTML = '';
    }
});

// --- Init ---

(async () => {
    await loadConfig();
    await loadWeather();
    setInterval(loadWeather, 10 * 60 * 1000);
})();
