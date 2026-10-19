// Servidor HTTP local mínimo para servir audio/vídeo al webview.
//
// WebKitGTK no reproduce medios desde esquemas custom (tauri://, asset://) y el
// workaround blob falla (salta a ~50% al estimar duración). Un HTTP local con
// soporte de Range es la única vía fiable en Linux. Sin dependencias extra.

use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::sync::OnceLock;
use std::thread;

use crate::config;

static BASE_URL: OnceLock<String> = OnceLock::new();

pub fn base_url() -> String {
    BASE_URL.get().cloned().unwrap_or_default()
}

/// Arranca el servidor (una sola vez) y devuelve la URL base con token.
pub fn start() -> String {
    if let Some(u) = BASE_URL.get() {
        return u.clone();
    }
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(l) => l,
        Err(e) => {
            eprintln!("no se pudo iniciar el servidor de medios: {e}");
            return String::new();
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    let token = random_token();
    let base = format!("http://127.0.0.1:{port}/{token}");
    let _ = BASE_URL.set(base.clone());
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let token = token.clone();
            thread::spawn(move || {
                let _ = serve(stream, &token);
            });
        }
    });
    base
}

fn random_token() -> String {
    let mut buf = [0u8; 16];
    if let Ok(mut f) = std::fs::File::open("/dev/urandom") {
        let _ = f.read_exact(&mut buf);
    }
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

fn serve(stream: TcpStream, token: &str) -> std::io::Result<()> {
    stream.set_nodelay(true).ok();
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut out = stream;

    let mut line = String::new();
    if reader.read_line(&mut line)? == 0 {
        return Ok(());
    }
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("").to_string();

    let mut range: Option<String> = None;
    loop {
        let mut h = String::new();
        if reader.read_line(&mut h)? == 0 {
            break;
        }
        let h = h.trim_end_matches(['\r', '\n']);
        if h.is_empty() {
            break;
        }
        if let Some((k, v)) = h.split_once(':') {
            if k.eq_ignore_ascii_case("range") {
                range = Some(v.trim().to_string());
            }
        }
    }

    let prefix = format!("/{token}/");
    let Some(rest) = target.strip_prefix(&prefix) else {
        return not_found(&mut out);
    };

    if let Some(after) = rest.strip_prefix("a/") {
        let (gadget, rel) = match after.split_once('/') {
            Some((g, r)) => (percent_decode(g), percent_decode(r)),
            None => return not_found(&mut out),
        };
        let data = config::GADGET_AUDIO
            .iter()
            .find(|(g, r, _)| *g == gadget && *r == rel)
            .map(|(_, _, d)| *d);
        match data {
            Some(bytes) => serve_bytes(&mut out, &method, bytes, mime_for(&rel), range.as_deref()),
            None => not_found(&mut out),
        }
    } else if let Some(after) = rest.strip_prefix("f/") {
        let abs = percent_decode(after);
        let path = Path::new(&abs);
        if !path.is_absolute() || !is_media_ext(&abs) {
            return not_found(&mut out);
        }
        let file = match std::fs::File::open(path) {
            Ok(f) => f,
            Err(_) => return not_found(&mut out),
        };
        let len = file.metadata().map(|m| m.len()).unwrap_or(0);
        serve_file(&mut out, &method, file, len, mime_for(&abs), range.as_deref())
    } else {
        not_found(&mut out)
    }
}

fn serve_bytes(
    out: &mut TcpStream,
    method: &str,
    data: &[u8],
    mime: &str,
    range: Option<&str>,
) -> std::io::Result<()> {
    let len = data.len() as u64;
    match range.and_then(|r| parse_range(r, len)) {
        Some((start, end)) => {
            let n = end - start + 1;
            write!(
                out,
                "HTTP/1.1 206 Partial Content\r\nContent-Type: {mime}\r\nAccept-Ranges: bytes\r\nContent-Length: {n}\r\nContent-Range: bytes {start}-{end}/{len}\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
            )?;
            if method != "HEAD" {
                out.write_all(&data[start as usize..=end as usize])?;
            }
        }
        None => {
            write!(
                out,
                "HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nAccept-Ranges: bytes\r\nContent-Length: {len}\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
            )?;
            if method != "HEAD" {
                out.write_all(data)?;
            }
        }
    }
    out.flush()
}

fn serve_file(
    out: &mut TcpStream,
    method: &str,
    mut file: std::fs::File,
    len: u64,
    mime: &str,
    range: Option<&str>,
) -> std::io::Result<()> {
    match range.and_then(|r| parse_range(r, len)) {
        Some((start, end)) => {
            let n = (end - start + 1) as usize;
            file.seek(SeekFrom::Start(start))?;
            let mut buf = vec![0u8; n];
            let read = file.read(&mut buf)?;
            buf.truncate(read);
            write!(
                out,
                "HTTP/1.1 206 Partial Content\r\nContent-Type: {mime}\r\nAccept-Ranges: bytes\r\nContent-Length: {}\r\nContent-Range: bytes {start}-{end}/{len}\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
                buf.len()
            )?;
            if method != "HEAD" {
                out.write_all(&buf)?;
            }
        }
        None => {
            let mut buf = Vec::with_capacity(len as usize);
            file.read_to_end(&mut buf)?;
            write!(
                out,
                "HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nAccept-Ranges: bytes\r\nContent-Length: {}\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
                buf.len()
            )?;
            if method != "HEAD" {
                out.write_all(&buf)?;
            }
        }
    }
    out.flush()
}

fn not_found(out: &mut TcpStream) -> std::io::Result<()> {
    out.write_all(
        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
    )?;
    out.flush()
}

/// Parsea un unico rango `bytes=...` contra un largo dado.
fn parse_range(header: &str, len: u64) -> Option<(u64, u64)> {
    let spec = header
        .trim()
        .strip_prefix("bytes=")?
        .split(',')
        .next()?
        .trim();
    let (a, b) = spec.split_once('-')?;
    if len == 0 {
        return None;
    }
    if a.is_empty() {
        let n: u64 = b.trim().parse().ok()?;
        let n = n.min(len);
        if n == 0 {
            return None;
        }
        Some((len - n, len - 1))
    } else {
        let start: u64 = a.trim().parse().ok()?;
        let end = if b.trim().is_empty() {
            len - 1
        } else {
            b.trim().parse::<u64>().ok()?.min(len - 1)
        };
        if start > end || start >= len {
            return None;
        }
        Some((start, end))
    }
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            let hi = (b[i + 1] as char).to_digit(16);
            let lo = (b[i + 2] as char).to_digit(16);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn is_media_ext(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    [
        ".mp3", ".wav", ".ogg", ".oga", ".opus", ".m4a", ".aac", ".flac", ".mp4", ".webm",
        ".mkv", ".mov", ".m4v", ".ogv",
    ]
    .iter()
    .any(|ext| lower.ends_with(ext))
}

fn mime_for(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".mp3") {
        "audio/mpeg"
    } else if lower.ends_with(".wav") {
        "audio/wav"
    } else if lower.ends_with(".ogg") || lower.ends_with(".oga") || lower.ends_with(".opus") {
        "audio/ogg"
    } else if lower.ends_with(".m4a") {
        "audio/mp4"
    } else if lower.ends_with(".aac") {
        "audio/aac"
    } else if lower.ends_with(".flac") {
        "audio/flac"
    } else if lower.ends_with(".mp4") || lower.ends_with(".m4v") {
        "video/mp4"
    } else if lower.ends_with(".webm") {
        "video/webm"
    } else if lower.ends_with(".mkv") {
        "video/x-matroska"
    } else if lower.ends_with(".mov") {
        "video/quicktime"
    } else if lower.ends_with(".ogv") {
        "video/ogg"
    } else {
        "application/octet-stream"
    }
}
