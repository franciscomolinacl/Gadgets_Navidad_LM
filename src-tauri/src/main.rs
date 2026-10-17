#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod monitor;

use tauri::menu::{
    CheckMenuItemBuilder, IsMenuItem, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem,
    Submenu,
};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    App, AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

/// Script inyectado en cada gadget: arrastre libre con clic izquierdo.
/// Solo arma el arrastre si el puntero supera un umbral, para no romper
/// los clics de los gadgets. `__ENABLED__` se reemplaza al crear la ventana.
const GADGET_DRAG_INIT: &str = r#"
(() => {
  let enabled = __ENABLED__;
  const THRESHOLD = 4;
  let armed = false, startX = 0, startY = 0;
  const CLICKABLE = new Set(["A","BUTTON","INPUT","SELECT","TEXTAREA","LABEL","SUMMARY"]);
  const ROLES = new Set(["button","link","menuitem","tab","checkbox","radio","switch","option"]);
  function isInteractive(el) {
    return CLICKABLE.has(el.tagName)
      || (el.hasAttribute("contenteditable") && el.getAttribute("contenteditable") !== "false")
      || (el.hasAttribute("tabindex") && el.getAttribute("tabindex") !== "-1")
      || ROLES.has(el.getAttribute("role"));
  }
  function blocked(el) {
    for (let n = el; n instanceof Element; n = n.parentElement) {
      const attr = n.getAttribute("data-tauri-drag-region");
      if (attr === "false") return true;
      if (isInteractive(n) && attr === null) return true;
    }
    return false;
  }
  document.addEventListener("mousedown", (e) => {
    if (!enabled || e.button !== 0 || e.defaultPrevented) return;
    if (!(e.target instanceof Element) || blocked(e.target)) return;
    armed = true;
    startX = e.clientX;
    startY = e.clientY;
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!armed) return;
    if (!(e.buttons & 1)) { armed = false; return; }
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > THRESHOLD) {
      armed = false;
      window.__TAURI_INTERNALS__.invoke("plugin:window|start_dragging");
    }
  });
  const disarm = () => { armed = false; };
  document.addEventListener("mouseup", disarm);
  window.addEventListener("blur", disarm);
  const registerToggle = () => {
    window.__TAURI__.event.listen("gadget:drag", (ev) => { enabled = !!ev.payload; });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerToggle, { once: true });
  } else {
    registerToggle();
  }
})();
"#;

/// Script inyectado en cada gadget: menu contextual con clic derecho.
/// Tauri 2 no expone `set_context_menu` para ventanas, asi que lo construimos
/// en JS con un tema propio (mismo dorado/verde del panel).
/// `__NAME__` se reemplaza por el nombre del gadget.
const GADGET_CONTEXT_MENU: &str = r#"
(() => {
  const NAME = __NAME__;
  const invoke = window.__TAURI__.core.invoke;
  const CLICKABLE = new Set(["A","BUTTON","INPUT","SELECT","TEXTAREA","LABEL","SUMMARY"]);
  const ROLES = new Set(["button","link","menuitem","tab","checkbox","radio","switch","option"]);
  function isInteractive(el) {
    return CLICKABLE.has(el.tagName)
      || (el.hasAttribute("contenteditable") && el.getAttribute("contenteditable") !== "false")
      || (el.hasAttribute("tabindex") && el.getAttribute("tabindex") !== "-1")
      || ROLES.has(el.getAttribute("role"));
  }
  const st = document.createElement("style");
  st.textContent = `#__gctx{position:fixed;z-index:2147483647;display:none;min-width:176px;padding:5px;
    background:rgba(9,20,17,.96);border:1px solid rgba(212,175,55,.35);border-radius:10px;
    box-shadow:0 12px 34px rgba(0,0,0,.55);user-select:none;
    font-family:Inter,system-ui,-apple-system,sans-serif;font-size:12px;color:#ece7db;line-height:1.2}
  #__gctx button{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;margin:0;
    font:inherit;color:inherit;background:transparent;border:0;border-radius:7px;cursor:pointer;text-align:left}
  #__gctx button:hover{background:rgba(212,175,55,.16)}
  #__gctx .ck{width:12px;color:#d4af37;font-weight:700}
  #__gctx .sep{height:1px;margin:4px 6px;background:rgba(212,175,55,.22)}`;
  document.documentElement.appendChild(st);

  const menu = document.createElement("div");
  menu.id = "__gctx";
  document.body.appendChild(menu);

  function item(label, fn, checked) {
    const b = document.createElement("button");
    const c = document.createElement("span");
    c.className = "ck";
    c.textContent = checked ? "✓" : "";
    const t = document.createElement("span");
    t.textContent = label;
    b.append(c, t);
    b.addEventListener("click", (e) => { e.stopPropagation(); hide(); fn(); });
    menu.appendChild(b);
  }
  function sep() {
    const d = document.createElement("div");
    d.className = "sep";
    menu.appendChild(d);
  }
  function hide() { menu.style.display = "none"; }

  async function show(x, y) {
    menu.innerHTML = "";
    item("Panel de control", () => { invoke("show_panel"); });
    let top = false;
    try {
      const cfg = await invoke("load_gadget_config", { name: NAME });
      top = !!cfg._alwaysTop;
    } catch (_) {}
    item("Siempre arriba", () => {
      invoke("set_gadget_top", { name: NAME, alwaysTop: !top });
    }, top);
    sep();
    item("Desactivar", () => {
      invoke("set_gadget_active", { name: NAME, active: false });
    });
    menu.style.display = "block";
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    menu.style.left = Math.max(4, Math.min(x, window.innerWidth - mw - 4)) + "px";
    menu.style.top = Math.max(4, Math.min(y, window.innerHeight - mh - 4)) + "px";
  }

  document.addEventListener("contextmenu", (e) => {
    if (!(e.target instanceof Element) || isInteractive(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    show(e.clientX, e.clientY);
  }, true);
  document.addEventListener("mousedown", (e) => {
    if (menu.contains(e.target)) return;
    hide();
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  window.addEventListener("blur", hide);
  window.addEventListener("resize", hide);
})();
"#;

/// Genera la URL para cargar un gadget desde el frontendDist embebido.
fn gadget_url(name: &str) -> WebviewUrl {
    WebviewUrl::App(format!("gadgets/{name}/index.html").into())
}

/// Reemplaza los caracteres no validos en un nombre de gadget por '_'.
fn sanitize_id(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '/' || c == ':' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// Normaliza el nombre del gadget para obtener una etiqueta de ventana valida.
/// Tauri permite caracteres alfanumericos, -, _, /, :, .; reemplazamos espacios y raros por '_'.
fn gadget_label(name: &str) -> String {
    format!("gadget_{}", sanitize_id(name))
}

/// Recupera el nombre real de un gadget a partir del id sanitizado usado en los menus.
fn gadget_name_from_id(sanitized: &str) -> Option<String> {
    config::GADGETS
        .iter()
        .map(|(n, _)| n.to_string())
        .find(|n| sanitize_id(&n) == sanitized)
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

#[tauri::command]
fn show_panel(app: AppHandle) {
    if let Some(w) = app.get_webview_window("control") {
        let _ = w.set_always_on_top(true);
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Sube el panel si esta visible. Los gadgets `always_on_top` comparten la capa
/// "above" con el panel y se apilan segun quien se levanto ultimo; llamando a
/// esto tras apilar un gadget encima, el panel queda siempre accesible.
fn raise_panel_if_visible(app: &AppHandle) {
    if let Some(panel) = app.get_webview_window("control") {
        if panel.is_visible().unwrap_or(false) {
            let _ = panel.set_focus();
        }
    }
}

/// Escape de emergencia: desactiva todos los gadgets (los cierra y marca
/// `_active = false` en su config). Util si un gadget a pantalla completa
/// queda encima de todo y no deja interactuar con el escritorio.
fn deactivate_all_gadgets(app: &AppHandle) {
    for (name, _) in config::GADGETS {
        let mut cfg = config::load_gadget_config(name);
        if let Some(obj) = cfg.as_object_mut() {
            obj.insert("_active".to_string(), serde_json::json!(false));
        }
        config::save_gadget_config(name, &cfg);
        if let Some(win) = app.get_webview_window(&gadget_label(name)) {
            let _ = win.destroy();
        }
    }
}

/// Activa o desactiva un gadget abriendo/cerrando su ventana.
/// Avisa a la bandeja para que los checks queden sincronizados.
fn apply_gadget_active(app: &AppHandle, name: &str, active: bool) -> Result<(), String> {
    let mut cfg = config::load_gadget_config(name);
    if let Some(obj) = cfg.as_object_mut() {
        obj.insert("_active".to_string(), serde_json::json!(active));
    }
    config::save_gadget_config(name, &cfg);

    let label = gadget_label(name);
    if active {
        if app.get_webview_window(&label).is_none() {
            create_gadget(app, name).map_err(|e| e.to_string())?;
        }
    } else if let Some(win) = app.get_webview_window(&label) {
        let _ = win.destroy();
    }
    refresh_tray(app);
    Ok(())
}

/// Notifica al panel que la config de un gadget cambio (por el menu contextual
/// o la bandeja), para que refresque el badge y el punto verde.
fn emit_config_changed(app: &AppHandle, name: &str) {
    let cfg = config::load_gadget_config(name);
    let _ = app.emit("gadget:config-changed", serde_json::json!({ "name": name, "config": cfg }));
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
        .min_inner_size(80.0, 30.0)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(true)
        .focused(false);

    let draggable = bool_field(&cfg, "draggable", true) && !fullscreen;
    let drag_script = GADGET_DRAG_INIT
        .replace("__ENABLED__", if draggable { "true" } else { "false" });
    let ctx_script = GADGET_CONTEXT_MENU.replace(
        "__NAME__",
        &serde_json::json!(name).to_string(),
    );
    builder = builder.initialization_script(&format!("{drag_script}\n{ctx_script}"));

    builder = if always_top {
        builder.always_on_top(true)
    } else {
        builder.always_on_bottom(true)
    };

    let win = builder.build()?;
    let _ = win.set_ignore_cursor_events(ignore_mouse);

    // Un gadget `always_on_top` se apila sobre el panel (misma capa "above").
    // Si el panel esta visible, lo volvemos a subir para que siempre quede
    // accesible por encima de los gadgets.
    if always_top {
        raise_panel_if_visible(app);
    }

    // Persistir posicion al mover.
    // En Linux/X11 el evento `Moved` reporta la posicion del marco (outer), que
    // difiere de la posicion del cliente por el alto del marco del WM. Como
    // `set_position` usa coordenadas del cliente, persistimos `inner_position`
    // para que la posicion guardada coincida con la aplicada al reiniciar.
    let name_owned = name.to_string();
    let win_for_move = win.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::Moved(_) = event {
            let cfgm = config::load_gadget_config(&name_owned);
            if bool_field(&cfgm, "fullscreen", false) {
                return;
            }
            let Ok(inner) = win_for_move.inner_position() else {
                return;
            };
            let sf = win_for_move.scale_factor().unwrap_or(1.0);
            let lx = ((inner.x as f64) / sf).round();
            let ly = ((inner.y as f64) / sf).round();
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
        .always_on_top(true)
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

/// Construye el menu de la bandeja: Mostrar Panel, lista de gadgets con
/// checkboxes de estado, desactivar todos y salir.
fn build_tray_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let show = MenuItemBuilder::with_id("show", "Mostrar Panel").build(app)?;
    let deactivate = MenuItemBuilder::with_id("deactivate_all", "Desactivar todos los gadgets")
        .build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Salir").build(app)?;

    let mut checks: Vec<_> = Vec::new();
    for (name, _) in config::GADGETS {
        let cfg = config::load_gadget_config(name);
        let active = bool_field(&cfg, "_active", false);
        let item = CheckMenuItemBuilder::with_id(format!("g:{}", sanitize_id(name)), name)
            .checked(active)
            .build(app)?;
        checks.push(item);
    }
    let items: Vec<&dyn IsMenuItem<tauri::Wry>> =
        checks.iter().map(|c| c as &dyn IsMenuItem<tauri::Wry>).collect();
    let gadgets_menu = Submenu::with_items(app, "Gadgets", true, &items)?;

    let sep = PredefinedMenuItem::separator(app)?;

    MenuBuilder::new(app)
        .items(&[&show as &dyn IsMenuItem<tauri::Wry>, &sep, &gadgets_menu])
        .item(&deactivate)
        .item(&quit)
        .build()
}

/// Reconstruye el menu de la bandeja con el estado actual de los gadgets.
fn refresh_tray(app: &AppHandle) {
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(menu) = build_tray_menu(app) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

fn create_tray(app: &App) -> tauri::Result<()> {
    let menu = build_tray_app(app)?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Gadgets Navideños")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_panel(app.clone()),
            "deactivate_all" => {
                deactivate_all_gadgets(app);
                refresh_tray(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {
                if let Some(rest) = event.id.as_ref().strip_prefix("g:") {
                    if let Some(name) = gadget_name_from_id(rest) {
                        let cfg = config::load_gadget_config(&name);
                        let active = bool_field(&cfg, "_active", false);
                        let _ = apply_gadget_active(app, &name, !active);
                    }
                }
            }
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

// ---------------------------------------------------------------------------
// Perfiles / Presets
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct Perfil {
    nombre: String,
    gadgets: serde_json::Value,
}

fn perfiles_from(value: &serde_json::Value) -> Vec<Perfil> {
    value
        .get("perfiles")
        .and_then(|p| p.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|p| serde_json::from_value(p.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

fn perfiles_store(list: &[Perfil]) -> serde_json::Value {
    serde_json::json!({ "perfiles": list })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

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
        if always_top {
            raise_panel_if_visible(&app);
        }
        let ignore_mouse = bool_field(&config, "ignoreMouse", false);
        let _ = win.set_ignore_cursor_events(ignore_mouse);
        let draggable = bool_field(&config, "draggable", true)
            && !bool_field(&config, "fullscreen", false);
        let _ = win.emit("gadget:drag", draggable);
    }

    let active = bool_field(&config, "_active", false);
    if active && app.get_webview_window(&label).is_none() {
        create_gadget(&app, &name).map_err(|e| e.to_string())?;
    } else if !active {
        if let Some(win) = app.get_webview_window(&label) {
            let _ = win.destroy();
        }
    }
    refresh_tray(&app);
    Ok(())
}

#[tauri::command]
fn set_gadget_top(app: AppHandle, name: String, always_top: bool) -> Result<(), String> {
    let mut cfg = config::load_gadget_config(&name);
    if let Some(obj) = cfg.as_object_mut() {
        obj.insert("_alwaysTop".to_string(), serde_json::json!(always_top));
    }
    config::save_gadget_config(&name, &cfg);

    let label = gadget_label(&name);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_always_on_top(always_top);
        let _ = win.set_always_on_bottom(!always_top);
    }
    if always_top {
        raise_panel_if_visible(&app);
    }
    emit_config_changed(&app, &name);
    Ok(())
}

#[tauri::command]
fn set_gadget_active(app: AppHandle, name: String, active: bool) -> Result<(), String> {
    let result = apply_gadget_active(&app, &name, active);
    emit_config_changed(&app, &name);
    result
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
fn gadget_media_files(name: String, subfolder: Option<String>) -> Vec<String> {
    config::gadget_media(&name, subfolder.as_deref())
}

#[tauri::command]
fn window_close(app: AppHandle) {
    if let Some(w) = app.get_webview_window("control") {
        let _ = w.hide();
    }
}

// Favoritos
#[tauri::command]
fn favorites_get() -> Vec<String> {
    config::favorites()
}

#[tauri::command]
fn favorites_set(name: String, favorite: bool) {
    config::set_favorite(&name, favorite);
}

// Perfiles / Presets
#[tauri::command]
fn perfiles_list() -> Vec<Perfil> {
    perfiles_from(&config::perfiles())
}

#[tauri::command]
fn perfil_save(nombre: String, gadgets: serde_json::Value) -> Vec<Perfil> {
    let mut list = perfiles_from(&config::perfiles());
    list.retain(|p| p.nombre != nombre);
    list.push(Perfil { nombre, gadgets });
    config::perfiles_save(&perfiles_store(&list));
    list
}

#[tauri::command]
fn perfil_apply(app: AppHandle, nombre: String) -> Result<Vec<String>, String> {
    let list = perfiles_from(&config::perfiles());
    let perfil = list
        .into_iter()
        .find(|p| p.nombre == nombre)
        .ok_or_else(|| format!("No existe el perfil «{nombre}»"))?;

    let mut aplicados = Vec::new();
    if let Some(map) = perfil.gadgets.as_object() {
        for (name, val) in map {
            let active = val.as_bool().unwrap_or(false);
            apply_gadget_active(&app, name, active)?;
            aplicados.push(name.clone());
        }
    }
    Ok(aplicados)
}

#[tauri::command]
fn perfil_delete(nombre: String) -> Vec<Perfil> {
    let mut list = perfiles_from(&config::perfiles());
    list.retain(|p| p.nombre != nombre);
    config::perfiles_save(&perfiles_store(&list));
    list
}

// Arranque automatico
#[tauri::command]
fn autostart_get() -> bool {
    config::autostart_is_enabled()
}

#[tauri::command]
fn autostart_set(enable: bool) -> Result<bool, String> {
    config::autostart_set(enable).map_err(|e| format!("No se pudo escribir el arranque automatico: {e}"))?;
    Ok(config::autostart_is_enabled())
}

fn build_tray_app(app: &App) -> tauri::Result<Menu<tauri::Wry>> {
    build_tray_menu(app.handle())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            config::ensure_user_gadget_configs();
            let handle = app.handle().clone();
            create_tray(app)?;
            for (name, _) in config::GADGETS {
                let cfg = config::load_gadget_config(name);
                if bool_field(&cfg, "_active", false) {
                    let _ = create_gadget(&handle, name);
                }
            }
            // El panel se crea al final para quedar por encima de los gadgets
            // `always_on_top` (comparten la capa "above" y gana el ultimo en
            // apilarse). Asi el panel nunca queda sepultado por un gadget.
            create_control_panel(&handle)?;
            monitor::spawn(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_user_data_path,
            gadgets_list,
            load_gadget_config,
            save_gadget_config,
            set_gadget_top,
            set_gadget_active,
            show_panel,
            sticky_load,
            sticky_save,
            window_close,
            gadget_media_files,
            favorites_get,
            favorites_set,
            perfiles_list,
            perfil_save,
            perfil_apply,
            perfil_delete,
            autostart_get,
            autostart_set
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Tauri");
}
