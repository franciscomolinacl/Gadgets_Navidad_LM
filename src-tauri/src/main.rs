#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

/// URL de un gadget dentro de frontendDist.
/// Tauri codifica los espacios automáticamente al resolver el asset.
fn gadget_url(name: &str) -> WebviewUrl {
    WebviewUrl::App(format!("gadgets/{name}/index.html").into())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Árbol 1: gadget CSS pequeño, nivel escritorio (abajo), click-through
            let arbol = WebviewWindowBuilder::new(app, "arbol-1", gadget_url("Arbol 1"))
                .title("Árbol 1")
                .inner_size(250.0, 300.0)
                .position(120.0, 120.0)
                .transparent(true)
                .decorations(false)
                .skip_taskbar(true)
                .always_on_top(true) // TEMP PoC: probar carga de asset
                .resizable(false)
                .focused(false)
                .build()?;
            arbol.set_ignore_cursor_events(true)?;

            // Nieve: canvas a pantalla completa, capa superior (dock), click-through
            let monitor = app
                .primary_monitor()?
                .expect("no se detectó monitor principal");
            let pos = monitor.position();
            let size = monitor.size();
            let nieve = WebviewWindowBuilder::new(app, "nieve", gadget_url("Nieve"))
                .title("Nieve")
                .inner_size(size.width as f64, size.height as f64)
                .position(pos.x as f64, pos.y as f64)
                .transparent(true)
                .decorations(false)
                .skip_taskbar(true)
                .always_on_top(true)
                .resizable(false)
                .focused(false)
                .build()?;
            nieve.set_ignore_cursor_events(true)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Tauri");
}
