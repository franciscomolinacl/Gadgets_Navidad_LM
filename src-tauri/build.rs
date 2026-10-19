use std::env;
use std::fs;
use std::path::Path;

fn main() {
    tauri_build::build();
    generate_gadgets_manifest();
}

fn is_media_file(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".mp3")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".png")
        || lower.ends_with(".gif")
        || lower.ends_with(".webp")
}

fn is_audio_file(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    [
        ".mp3", ".wav", ".ogg", ".oga", ".opus", ".m4a", ".aac", ".flac", ".mp4", ".webm",
        ".mkv", ".mov", ".m4v", ".ogv",
    ]
    .iter()
    .any(|ext| lower.ends_with(ext))
}

/// Recorre el gadget juntando el audio/video con su ruta relativa y absoluta.
fn collect_audio(dir: &Path, rel: &String, out: &mut Vec<(String, String)>) {
    let read = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return,
    };
    for e in read.flatten() {
        let path = e.path();
        let fname = e.file_name().to_string_lossy().to_string();
        let sub_rel = if rel.is_empty() {
            fname.clone()
        } else {
            format!("{rel}/{fname}")
        };
        if path.is_dir() {
            collect_audio(&path, &sub_rel, out);
        } else if is_audio_file(&fname) {
            out.push((sub_rel, path.to_string_lossy().to_string()));
        }
    }
}

fn collect_media(dir: &Path, rel: &String, out: &mut Vec<String>) {
    let read = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return,
    };
    for e in read.flatten() {
        let path = e.path();
        let fname = e.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            let sub_rel = if rel.is_empty() {
                fname
            } else {
                format!("{rel}/{fname}")
            };
            collect_media(&path, &sub_rel, out);
        } else if is_media_file(&fname) {
            let full = if rel.is_empty() {
                fname
            } else {
                format!("{rel}/{fname}")
            };
            out.push(full);
        }
    }
}

/// Genera un modulo Rust con la lista de gadgets, sus config.json por defecto y
/// un inventario de archivos multimedia embebidos.
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
    let mut media: Vec<(String, Vec<String>)> = Vec::new();
    let mut audio: Vec<(String, Vec<(String, String)>)> = Vec::new();

    if let Ok(read) = fs::read_dir(&gadgets_dir) {
        for e in read.flatten() {
            let path = e.path();
            if !path.is_dir() || !path.join("index.html").exists() {
                continue;
            }
            let name = e.file_name().to_string_lossy().to_string();
            let cfg = fs::read_to_string(path.join("config.json"))
                .unwrap_or_else(|_| "{}".to_string());
            entries.push((name.clone(), cfg));

            let mut files = Vec::new();
            collect_media(&path, &String::new(), &mut files);
            files.sort();
            if !files.is_empty() {
                media.push((name.clone(), files));
            }

            let mut sounds = Vec::new();
            collect_audio(&path, &String::new(), &mut sounds);
            sounds.sort();
            if !sounds.is_empty() {
                audio.push((name, sounds));
            }
        }
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    media.sort_by(|a, b| a.0.cmp(&b.0));
    audio.sort_by(|a, b| a.0.cmp(&b.0));

    let mut code = String::from("pub const GADGETS: &[(&str, &str)] = &[\n");
    for (name, cfg) in &entries {
        code.push_str(&format!("    ({:?}, {:?}),\n", name, cfg));
    }
    code.push_str("];\n");

    code.push_str("pub const GADGET_MEDIA: &[(&str, &[&str])] = &[\n");
    for (name, files) in &media {
        code.push_str(&format!("    ({:?}, &[\n", name));
        for f in files {
            code.push_str(&format!("        {:?},\n", f));
        }
        code.push_str("    ]),\n");
    }
    code.push_str("];\n");

    code.push_str("pub const GADGET_AUDIO: &[(&str, &str, &[u8])] = &[\n");
    for (name, files) in &audio {
        for (rel, abs) in files {
            code.push_str(&format!(
                "    ({:?}, {:?}, include_bytes!(r#\"{}\"#)),\n",
                name, rel, abs
            ));
        }
    }
    code.push_str("];\n");

    fs::write(&dest, code).unwrap();

    println!("cargo:rerun-if-changed=../frontend/gadgets");
    for (name, _) in &entries {
        println!("cargo:rerun-if-changed=../frontend/gadgets/{name}/config.json");
        println!("cargo:rerun-if-changed=../frontend/gadgets/{name}/index.html");
    }
}
