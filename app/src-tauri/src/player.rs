use crate::paths;
use crate::runtime;
use percent_encoding::percent_decode_str;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tiny_http::{Header, Response, Server};

pub struct PlayerServer {
    pub port: u16,
}

static PLAYER_HTML: &str = include_str!("../../frontend/player.html");

pub struct ServerState {
    pub port: Mutex<Option<u16>>,
}

pub fn ensure_server(state: &ServerState) -> Result<u16, String> {
    if let Some(p) = *state.port.lock().unwrap() {
        return Ok(p);
    }
    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = server
        .server_addr()
        .to_ip()
        .map(|a| a.port())
        .unwrap_or(0);
    *state.port.lock().unwrap() = Some(port);

    let ruffle = runtime::ruffle_dir().map_err(|e| e.to_string())?;
    let vols = paths::vols_dir();
    let transcode = paths::transcode_dir();
    let srv = Arc::new(server);

    std::thread::spawn(move || serve_loop(srv, ruffle, vols, transcode));
    Ok(port)
}

fn mime_for(ext: &str) -> &'static str {
    match ext {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript",
        "wasm" => "application/wasm",
        "swf" => "application/x-shockwave-flash",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "css" => "text/css",
        "json" => "application/json",
        "txt" => "text/plain",
        _ => "application/octet-stream",
    }
}

fn serve_loop(server: Arc<Server>, ruffle: PathBuf, vols: PathBuf, transcode: PathBuf) {
    for request in server.incoming_requests() {
        let path = request.url().split('?').next().unwrap_or("/").to_string();
        let result = match path.as_str() {
            "/" | "/player.html" => respond(request, PLAYER_HTML.as_bytes(), "text/html; charset=utf-8"),
            p if p.starts_with("/ruffle/") => {
                let rel = &p["/ruffle/".len()..];
                let file = ruffle.join(rel);
                let ext = file.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                read_respond(request, &file, mime_for(&ext))
            }
            p if p.starts_with("/media/") => {
                let rest = &p["/media/".len()..];
                let slug = rest.split('/').next().unwrap_or("").to_string();
                let rel = rest.splitn(2, '/').nth(1).unwrap_or("").to_string();
                if slug.is_empty() || rel.is_empty() {
                    respond(request, b"bad path", "text/plain")
                } else {
                    let decoded = percent_decode_str(&rel).decode_utf8_lossy().to_string();
                    let file = transcode.join(&slug).join(decoded);
                    let ext = file.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                    read_respond(request, &file, mime_for(&ext))
                }
            }
            p if p.starts_with("/vols/") => {
                let rest = &p["/vols/".len()..];
                let slug = rest.split('/').next().unwrap_or("").to_string();
                let rel = rest.splitn(2, '/').nth(1).unwrap_or("").to_string();
                if slug.is_empty() || rel.is_empty() {
                    respond(request, b"bad path", "text/plain")
                } else {
                    let decoded = percent_decode_str(&rel).decode_utf8_lossy().to_string();
                    let file = vols.join(&slug).join(decoded);
                    let ext = file.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                    read_respond(request, &file, mime_for(&ext))
                }
            }
            _ => respond(request, b"not found", "text/plain"),
        };
        let _ = result;
    }
}

fn read_respond(request: tiny_http::Request, path: &std::path::Path, ctype: &str) -> Result<(), String> {
    let data = std::fs::read(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    respond(request, &data, ctype)
}

fn respond(request: tiny_http::Request, data: &[u8], ctype: &str) -> Result<(), String> {
    let header = Header::from_bytes("Content-Type", ctype).map_err(|_| "invalid header".to_string())?;
    let mut response = Response::from_data(data.to_vec());
    response.add_header(header);
    response.add_header(Header::from_bytes("Cache-Control", "no-cache").unwrap());
    request
        .respond(response)
        .map_err(|e| e.to_string())
}