use std::collections::HashMap;
use std::fs;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter};

/// Instantanea de los tiempos de CPU del sistema: (idle, total).
fn cpu_snapshot() -> (u64, u64) {
    let content = match fs::read_to_string("/proc/stat") {
        Ok(c) => c,
        Err(_) => return (0, 0),
    };
    let line = match content.lines().next() {
        Some(l) => l,
        None => return (0, 0),
    };
    let mut idle = 0u64;
    let mut total = 0u64;
    for (i, field) in line.split_whitespace().skip(1).enumerate() {
        if let Ok(v) = field.parse::<u64>() {
            total += v;
            // 3 = idle, 4 = iowait
            if i == 3 || i == 4 {
                idle += v;
            }
        }
    }
    (idle, total)
}

/// Porcentaje de RAM usada, considerando MemTotal y MemAvailable.
fn ram_percent() -> i64 {
    let content = match fs::read_to_string("/proc/meminfo") {
        Ok(c) => c,
        Err(_) => return 0,
    };
    let mut total = 0f64;
    let mut available = 0f64;
    for line in content.lines() {
        if let Some(rest) = line.strip_prefix("MemTotal:") {
            total = rest.trim().trim_end_matches("kB").trim().parse().unwrap_or(0.0);
        } else if let Some(rest) = line.strip_prefix("MemAvailable:") {
            available = rest.trim().trim_end_matches("kB").trim().parse().unwrap_or(0.0);
        }
    }
    if total <= 0.0 {
        return 0;
    }
    (((total - available) / total) * 100.0).round() as i64
}

/// Lee /proc/net/dev y devuelve por interfaz (rx_bytes, tx_bytes).
fn read_net_dev() -> HashMap<String, (u64, u64)> {
    let mut data = HashMap::new();
    let content = match fs::read_to_string("/proc/net/dev") {
        Ok(c) => c,
        Err(_) => return data,
    };
    for line in content.lines().skip(2) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some((iface, rest)) = line.split_once(':') {
            let vals: Vec<u64> = rest
                .split_whitespace()
                .filter_map(|v| v.parse::<u64>().ok())
                .collect();
            let rx = vals.first().copied().unwrap_or(0);
            let tx = vals.get(8).copied().unwrap_or(0);
            data.insert(iface.trim().to_string(), (rx, tx));
        }
    }
    data
}

/// Interfaz por defecto segun /proc/net/route; fallback: primera no-loopback.
fn default_interface() -> String {
    if let Ok(route) = fs::read_to_string("/proc/net/route") {
        for line in route.lines().skip(1) {
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() >= 2 && cols[1] == "00000000" {
                return cols[0].to_string();
            }
        }
    }
    let devs = read_net_dev();
    let mut names: Vec<&String> = devs.keys().collect();
    names.sort();
    for name in names {
        if name != "lo" {
            return name.clone();
        }
    }
    "lo".to_string()
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Lanza los hilos que emiten `cpu-ram` y `net-stats` cada segundo.
pub fn spawn(app: AppHandle) {
    let cpu_app = app.clone();
    thread::spawn(move || {
        let mut prev = cpu_snapshot();
        loop {
            thread::sleep(Duration::from_secs(1));
            let next = cpu_snapshot();
            let idle_diff = next.0.saturating_sub(prev.0);
            let total_diff = next.1.saturating_sub(prev.1);
            let cpu = if total_diff > 0 {
                (100.0 - (idle_diff as f64 / total_diff as f64) * 100.0).round() as i64
            } else {
                0
            };
            let ram = ram_percent();
            prev = next;
            let _ = cpu_app.emit("cpu-ram", serde_json::json!({ "cpu": cpu, "ram": ram }));
        }
    });

    let net_app = app.clone();
    thread::spawn(move || {
        let iface = default_interface();
        let mut prev = read_net_dev();
        loop {
            thread::sleep(Duration::from_secs(1));
            let now = read_net_dev();
            let (prx, ptx) = prev.get(&iface).copied().unwrap_or((0, 0));
            let (crx, ctx) = now.get(&iface).copied().unwrap_or((0, 0));
            let rx = crx.saturating_sub(prx);
            let tx = ctx.saturating_sub(ptx);
            prev = now;
            let _ = net_app.emit(
                "net-stats",
                serde_json::json!({
                    "iface": iface,
                    "rx": rx,
                    "tx": tx,
                    "ts": now_ms() as u64,
                }),
            );
        }
    });
}
