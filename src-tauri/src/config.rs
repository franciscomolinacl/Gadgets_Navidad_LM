use std::fs;
use std::path::{Path, PathBuf};

include!(concat!(env!("OUT_DIR"), "/gadgets_generated.rs"));

/// Raiz de configuracion del usuario: ~/.config/gadgets-navidenos
pub fn user_config_root() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".config").join("gadgets-navidenos")
}

fn ensure_dir(dir: &Path) {
    let _ = fs::create_dir_all(dir);
}

/// Crea el archivo con `initial` solo si no existe.
fn ensure_file(path: &Path, initial: &str) {
    if path.exists() {
        return;
    }
    if let Some(dir) = path.parent() {
        ensure_dir(dir);
    }
    let _ = fs::write(path, initial);
}

pub fn notas_path() -> PathBuf {
    user_config_root().join("notas.json")
}

pub fn gadget_config_path(name: &str) -> PathBuf {
    user_config_root().join(name).join("config.json")
}

/// Copia los config.json por defecto de cada gadget embebido a la carpeta del
/// usuario, si aun no existen.
pub fn ensure_user_gadget_configs() {
    ensure_dir(&user_config_root());
    ensure_file(&notas_path(), "{}");
    for (name, default_json) in GADGETS {
        let path = gadget_config_path(name);
        if !path.exists() {
            if let Some(dir) = path.parent() {
                ensure_dir(dir);
            }
            let _ = fs::write(&path, default_json);
        }
    }
}

pub fn load_gadget_config(name: &str) -> serde_json::Value {
    let mut value = fs::read_to_string(gadget_config_path(name))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    if let Some(obj) = value.as_object_mut() {
        obj.entry("draggable".to_string())
            .or_insert(serde_json::json!(true));
    }
    value
}

pub fn save_gadget_config(name: &str, config: &serde_json::Value) {
    let path = gadget_config_path(name);
    if let Some(dir) = path.parent() {
        ensure_dir(dir);
    }
    if let Ok(s) = serde_json::to_string_pretty(config) {
        let _ = fs::write(path, s);
    }
}

pub fn sticky_load() -> String {
    fs::read_to_string(notas_path())
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v.get("text").and_then(|t| t.as_str()).map(str::to_string))
        .unwrap_or_default()
}

pub fn sticky_save(text: &str) {
    let path = notas_path();
    if let Some(dir) = path.parent() {
        ensure_dir(dir);
    }
    let value = serde_json::json!({ "text": text });
    if let Ok(s) = serde_json::to_string_pretty(&value) {
        let _ = fs::write(path, s);
    }
}

/// Devuelve los archivos multimedia embebidos de un gadget, opcionalmente
/// filtrados por subcarpeta (por ejemplo "musica" o "images").
pub fn gadget_media(name: &str, subfolder: Option<&str>) -> Vec<String> {
    for (g, files) in GADGET_MEDIA {
        if *g != name {
            continue;
        }
        return match subfolder {
            Some(sub) if !sub.is_empty() => {
                let prefix = format!("{sub}/");
                files
                    .iter()
                    .filter(|f| f.starts_with(&prefix))
                    .map(|f| f.to_string())
                    .collect()
            }
            _ => files.iter().map(|f| f.to_string()).collect(),
        };
    }
    Vec::new()
}
