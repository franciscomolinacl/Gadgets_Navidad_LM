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
    if path.exists() && fs::metadata(path).map(|m| m.len() > 0).unwrap_or(false) {
        return;
    }
    if let Some(dir) = path.parent() {
        ensure_dir(dir);
    }
    write_atomic(path, initial);
}

pub fn notas_path() -> PathBuf {
    user_config_root().join("notas.json")
}

/// Ajustes globales de la app (favoritos, etc.).
pub fn app_settings_path() -> PathBuf {
    user_config_root().join("app.json")
}

/// Perfiles/Presets: combinaciones guardadas de gadgets activos.
pub fn perfiles_path() -> PathBuf {
    user_config_root().join("perfiles.json")
}

fn load_json_file(path: &Path, initial: &str) -> serde_json::Value {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::from_str(initial).unwrap_or(serde_json::json!({})))
}

/// Escribe atómicamente: primero a un .tmp y luego rename. Evita que un kill
/// en medio de la escritura deje el archivo vacío o a medias.
fn write_atomic(path: &Path, content: &str) {
    let tmp = path.with_extension("json.tmp");
    if fs::write(&tmp, content).is_ok() {
        let _ = fs::rename(&tmp, path);
    }
}

fn save_json_file(path: &Path, value: &serde_json::Value) {
    if let Some(dir) = path.parent() {
        ensure_dir(dir);
    }
    if let Ok(s) = serde_json::to_string_pretty(value) {
        write_atomic(path, &s);
    }
}

pub fn app_settings() -> serde_json::Value {
    let v = load_json_file(&app_settings_path(), r#"{"favorites": []}"#);
    // Garantiza la forma esperada aunque el archivo este corrupto o a medias.
    serde_json::json!({
        "favorites": v.get("favorites").and_then(|f| f.as_array()).cloned().unwrap_or_default(),
        "panel_visible": v.get("panel_visible").and_then(|x| x.as_bool()).unwrap_or(true),
    })
}

/// Visibilidad del panel de control al iniciar la app.
pub fn panel_visible() -> bool {
    app_settings()
        .get("panel_visible")
        .and_then(|x| x.as_bool())
        .unwrap_or(true)
}

pub fn set_panel_visible(visible: bool) {
    let mut settings = app_settings();
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("panel_visible".to_string(), serde_json::json!(visible));
    }
    app_settings_save(&settings);
}

pub fn app_settings_save(value: &serde_json::Value) {
    save_json_file(&app_settings_path(), value);
}

pub fn favorites() -> Vec<String> {
    app_settings()
        .get("favorites")
        .and_then(|f| f.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

pub fn set_favorite(name: &str, favorite: bool) {
    let mut settings = app_settings();
    if let Some(obj) = settings.as_object_mut() {
        let mut favs = obj
            .get("favorites")
            .and_then(|f| f.as_array())
            .cloned()
            .unwrap_or_default();
        favs.retain(|v| v.as_str() != Some(name));
        if favorite {
            favs.push(serde_json::json!(name));
        }
        obj.insert("favorites".to_string(), serde_json::Value::Array(favs));
    }
    app_settings_save(&settings);
}

pub fn perfiles() -> serde_json::Value {
    load_json_file(&perfiles_path(), r#"{"perfiles": []}"#)
}

pub fn perfiles_save(value: &serde_json::Value) {
    save_json_file(&perfiles_path(), value);
}

/// Archivo .desktop del escritorio que arranca la app con la sesión.
pub fn autostart_file() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join(".config")
        .join("autostart")
        .join("gadgets-navidenos.desktop")
}

/// El arranque automatico esta activo si existe el archivo .desktop.
pub fn autostart_is_enabled() -> bool {
    autostart_file().exists()
}

pub fn autostart_set(enable: bool) -> std::io::Result<()> {
    let path = autostart_file();
    if !enable {
        // Si el archivo no existe, desactivado ya es el estado deseado.
        let _ = fs::remove_file(&path);
        return Ok(());
    }
    let exe = std::env::current_exe()?;
    // El spec .desktop exige escapar '%' y entrecomillar rutas con espacios.
    let exec = format!("\"{}\"", exe.display().to_string().replace('%', "%%"));
    let content = format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Name=Gadgets Navideños\n\
         Comment=Gadgets navideños para el escritorio\n\
         Exec={}\n\
         Icon=gadgets-navidenos\n\
         Terminal=false\n\
         X-GNOME-Autostart-enabled=true\n",
        exec
    );
    if let Some(dir) = path.parent() {
        ensure_dir(dir);
    }
    fs::write(&path, content)?;
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755))
}

pub fn gadget_config_path(name: &str) -> PathBuf {
    user_config_root().join(name).join("config.json")
}

/// Copia los config.json por defecto de cada gadget embebido a la carpeta del
/// usuario, si aun no existen.
pub fn ensure_user_gadget_configs() {
    ensure_dir(&user_config_root());
    ensure_file(&notas_path(), "{}");
    ensure_file(&app_settings_path(), r#"{"favorites": []}"#);
    ensure_file(&perfiles_path(), r#"{"perfiles": []}"#);
    for (name, default_json) in GADGETS {
        let path = gadget_config_path(name);
        if !path.exists() || fs::metadata(&path).map(|m| m.len() == 0).unwrap_or(false) {
            if let Some(dir) = path.parent() {
                ensure_dir(dir);
            }
            write_atomic(&path, default_json);
        }
    }
}

pub fn load_gadget_config(name: &str) -> serde_json::Value {
    let path = gadget_config_path(name);
    let parsed = fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
    // Archivo vacío o corrupto (kill a mitad de escritura): restaurar el
    // default embebido en vez de devolver {} (el panel perdería controles).
    let mut value = match parsed {
        Some(v) if v.is_object() => v,
        _ => {
            let default = GADGETS
                .iter()
                .find(|(n, _)| *n == name)
                .and_then(|(_, cfg)| serde_json::from_str::<serde_json::Value>(cfg).ok())
                .unwrap_or_else(|| serde_json::json!({}));
            if let Some(dir) = path.parent() {
                ensure_dir(dir);
            }
            if let Ok(s) = serde_json::to_string_pretty(&default) {
                write_atomic(&path, &s);
            }
            default
        }
    };
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
        write_atomic(&path, &s);
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
        write_atomic(&path, &s);
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
