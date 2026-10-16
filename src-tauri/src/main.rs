#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod monitor;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Genera la URL para cargar un gadget desde el frontendDist embebido.
fn gadget_url(name: &str) -> WebviewUrl {
    WebviewUrl::App(format!("gadgets/{name}/index.html").into())
}

/// Normaliza el nombre del gadget para obtener una etiqueta de ventana valida.
/// Tauri permite caracteres alfanumericos, -, _, /, :, .; reemplazamos espacios y raros por '_'.
fn gadget_label(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '/' || c == ':' || c == '.'
            {
                c
            } else {
                '_'
            }
        })
        .collect();
    format!("gadget_{sanitized}")
}

fn bool_field(v: &serde_json::Value, key: &str, default: bool) -> bool {
    v.get(key).and_then(|x| x.as_bool()).unwrap_or(default)
}

fn num_field(v: &serde_json::Value, key: &str, default: f64) -> f64 {
    v.get(key).and_then(|x| x.as_f64()).unwrap_or(default)
}

/// Area de trabajo logica del monitor primario (x, y, w, h).
fn primary_work_area(app: &AppHandle) -> (f64, f64, f64, f64) {
    if let Ok(Some(m)) = app.primary_monitor() {
        let wa = m.work_area();
        let sf = m.scale_factor();
        (
            wa.position.x as f64 / sf,
            wa.position.y as f64 / sf,
            wa.size.width as f64 / sf,
            wa.size.height as f64 / sf,
        )
    } else {
        (0.0, 0.0, 1920.0, 1080.0)
    }
}

fn show_panel(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("control") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn create_gadget(app: &AppHandle, name: &str) -> tauri::Result<()> {
    let label = gadget_label(name);
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    let cfg = config::load_gadget_config(name);
    let fullscreen = bool_field(&cfg, "fullscreen", false);
    let always_top = bool_field(&cfg, "_alwaysTop", false);
    let ignore_mouse = bool_field(&cfg, "ignoreMouse", false);

    let (x, y, width, height) = if fullscreen {
        let (wx, wy, ww, wh) = primary_work_area(app);
        (wx, wy, ww, wh)
    } else {
        (
            num_field(&cfg, "x", 100.0),
            num_field(&cfg, "y", 100.0),
            num_field(&cfg, "width", 300.0),
            num_field(&cfg, "height", 200.0),
        )
    };

    let mut builder = WebviewWindowBuilder::new(app, &label, gadget_url(name))
        .title(name)
        .inner_size(width, height)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false);

    builder = if always_top {
        builder.always_on_top(true)
    } else {
        builder.always_on_bottom(true)
    };

    let win = builder.build()?;
    let _ = win.set_ignore_cursor_events(ignore_mouse);

    // Persistir posicion al mover
    let name_owned = name.to_string();
    let win_for_move = win.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::Moved(pos) = event {
            let cfgm = config::load_gadget_config(&name_owned);
            if bool_field(&cfgm, "fullscreen", false) {
                return;
            }
            let sf = win_for_move.scale_factor().unwrap_or(1.0);
            let lx = ((pos.x as f64) / sf).round();
            let ly = ((pos.y as f64) / sf).round();
            let mut newcfg = cfgm;
            if let Some(obj) = newcfg.as_object_mut() {
                obj.insert("x".to_string(), serde_json::json!(lx));
                obj.insert("y".to_string(), serde_json::json!(ly));
            }
            config::save_gadget_config(&name_owned, &newcfg);
        }
    });

    Ok(())
}

fn create_control_panel(app: &AppHandle) -> tauri::Result<()> {
    if app.get_webview_window("control").is_some() {
        return Ok(());
    }
    let (wx, wy, ww, _wh) = primary_work_area(app);
    let width = 600.0;
    let height = 600.0;
    let x = wx + (ww - width);
    let y = wy + 50.0;

    let win = WebviewWindowBuilder::new(app, "control", WebviewUrl::App("control.html".into()))
        .title("Panel de Control")
        .inner_size(width, height)
        .position(x, y)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .focused(true)
        .build()?;

    let w = win.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = w.hide();
        }
    });

    Ok(())
}

fn create_tray(app: &App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Mostrar Panel").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Salir").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Gadgets Navideños")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_panel(app),
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let h = tray.app_handle();
                if let Some(w) = h.get_webview_window("control") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

// Commands
#[tauri::command]
fn get_user_data_path() -> String {
    config::user_config_root().to_string_lossy().to_string()
}

#[tauri::command]
fn gadgets_list() -> Vec<String> {
    config::GADGETS.iter().map(|(n, _)| n.to_string()).collect()
}

#[tauri::command]
fn load_gadget_config(name: String) -> serde_json::Value {
    config::load_gadget_config(&name)
}

#[tauri::command]
fn save_gadget_config(app: AppHandle, name: String, config: serde_json::Value) -> Result<(), String> {
    config::save_gadget_config(&name, &config);

    let label = gadget_label(&name);
    if let Some(win) = app.get_webview_window(&label) {
        if let (Some(x), Some(y)) = (
            config.get("x").and_then(|v| v.as_f64()),
            config.get("y").and_then(|v| v.as_f64()),
        ) {
            let _ = win.set_position(tauri::LogicalPosition::new(x, y));
        }
        if let (Some(w), Some(h)) = (
            config.get("width").and_then(|v| v.as_f64()),
            config.get("height").and_then(|v| v.as_f64()),
        ) {
            let _ = win.set_size(tauri::LogicalSize::new(w, h));
        }
        let always_top = bool_field(&config, "_alwaysTop", false);
        let _ = win.set_always_on_top(always_top);
        let _ = win.set_always_on_bottom(!always_top);
        let ignore_mouse = bool_field(&config, "ignoreMouse", false);
        let _ = win.set_ignore_cursor_events(ignore_mouse);
    }

    let active = bool_field(&config, "_active", false);
    if active && app.get_webview_window(&label).is_none() {
        create_gadget(&app, &name).map_err(|e| e.to_string())?;
    } else if !active {
        if let Some(win) = app.get_webview_window(&label) {
            let _ = win.destroy();
        }
    }
    Ok(())
}

#[tauri::command]
fn set_gadget_top(app: AppHandle, name: String, always_top: bool) -> Result<(), String> {
    let label = gadget_label(&name);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_always_on_top(always_top);
        let _ = win.set_always_on_bottom(!always_top);
    }
    Ok(())
}

#[tauri::command]
fn sticky_load() -> String {
    config::sticky_load()
}

#[tauri::command]
fn sticky_save(text: String) {
    config::sticky_save(&text);
}

#[tauri::command]
fn window_close(app: AppHandle) {
    if let Some(w) = app.get_webview_window("control") {
        let _ = w.hide();
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            config::ensure_user_gadget_configs();
            let handle = app.handle().clone();
            create_control_panel(&handle)?;
            create_tray(app)?;
            for (name, _) in config::GADGETS {
                let cfg = config::load_gadget_config(name);
                if bool_field(&cfg, "_active", false) {
                    let _ = create_gadget(&handle, name);
                }
            }
            monitor::spawn(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_user_data_path,
            gadgets_list,
            load_gadget_config,
            save_gadget_config,
            set_gadget_top,
            sticky_load,
            sticky_save,
            window_close
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Tauri");
}
