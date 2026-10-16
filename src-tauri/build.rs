use std::env;
use std::fs;
use std::path::Path;

fn main() {
    tauri_build::build();
    generate_gadgets_manifest();
}

/// Genera un modulo Rust con la lista de gadgets y sus config.json por defecto.
///
/// Los assets del frontend quedan embebidos en el binario (frontendDist), por lo
/// que no se pueden listar en tiempo de ejecucion. En su lugar, el build escanea
/// `../frontend/gadgets` y embebe los datos necesarios.
fn generate_gadgets_manifest() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let gadgets_dir = Path::new(&manifest_dir).join("../frontend/gadgets");
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest = Path::new(&out_dir).join("gadgets_generated.rs");

    let mut entries: Vec<(String, String)> = Vec::new();

    if let Ok(read) = fs::read_dir(&gadgets_dir) {
        for e in read.flatten() {
            let path = e.path();
            if !path.is_dir() || !path.join("index.html").exists() {
                continue;
            }
            let name = e.file_name().to_string_lossy().to_string();
            let cfg = fs::read_to_string(path.join("config.json"))
                .unwrap_or_else(|_| "{}".to_string());
            entries.push((name, cfg));
        }
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    let mut code = String::from("pub const GADGETS: &[(&str, &str)] = &[\n");
    for (name, cfg) in &entries {
        code.push_str(&format!("    ({:?}, {:?}),\n", name, cfg));
    }
    code.push_str("];\n");
    fs::write(&dest, code).unwrap();

    println!("cargo:rerun-if-changed=../frontend/gadgets");
    for (name, _) in &entries {
        println!("cargo:rerun-if-changed=../frontend/gadgets/{name}/config.json");
        println!("cargo:rerun-if-changed=../frontend/gadgets/{name}/index.html");
    }
}
