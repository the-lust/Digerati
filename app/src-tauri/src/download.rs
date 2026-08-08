use crate::catalog::Catalog;
use crate::paths;
use futures_util::StreamExt;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

pub struct Downloads {
    cancel: Mutex<HashSet<String>>,
}

impl Default for Downloads {
    fn default() -> Self {
        Self {
            cancel: Mutex::new(HashSet::new()),
        }
    }
}

impl Downloads {
    pub fn request_cancel(&self, key: &str) {
        self.cancel.lock().unwrap().insert(key.to_string());
    }

    pub fn is_cancelled(&self, key: &str) -> bool {
        self.cancel.lock().unwrap().contains(key)
    }

    pub fn clear_cancel(&self, key: &str) {
        self.cancel.lock().unwrap().remove(key);
    }
}

pub fn download_url(slug: &str, kind: &str) -> String {
    let file = if kind == "iso" {
        format!("Vol_{slug}.iso.7z")
    } else {
        format!("Vol_{slug}.games.7z")
    };
    format!("https://github.com/the-lust/Digerati/releases/download/vol-{slug}/{file}")
}

/// Stream `kind` archive for `slug` into %APPDATA%/Digerati/cache.
/// Emits "dl-progress" events. Returns local file path.
pub async fn download_volume(app: AppHandle, slug: String, kind: String) -> Result<std::path::PathBuf, String> {
    let url = download_url(&slug, &kind);
    let dest = paths::volume_archive(&slug, &kind);
    let part = std::path::PathBuf::from(format!("{}.part", dest.display()));
    if let Some(parent) = part.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let key = format!("{slug}:{kind}");
    let downloads: tauri::State<'_, Downloads> = app.state::<Downloads>();
    downloads.clear_cancel(&key);

    paths::log(&format!("download start {slug} {kind}"));

    let client = reqwest::Client::builder()
        .user_agent("Digerati/1.0")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or_else(|| {
        let cat: tauri::State<'_, Catalog> = app.state::<Catalog>();
        cat.archive_bytes(&slug, &kind).unwrap_or(0)
    });
    let mut file = std::fs::File::create(&part).map_err(|e| e.to_string())?;
    let mut received: u64 = 0;
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        if downloads.is_cancelled(&key) {
            drop(file);
            let _ = std::fs::remove_file(&part);
            let _ = app.emit("dl-progress", {
                let v = serde_json::json!({ "slug": slug, "kind": kind, "received": received, "total": total, "pct": 0.0, "state": "cancelled" });
                v
            });
            return Err("cancelled".into());
        }
        let chunk = chunk.map_err(|e| e.to_string())?;
        use std::io::Write;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        if received % (1024 * 256) == 0 || received == total {
            let pct = if total > 0 { (received as f64 / total as f64) * 100.0 } else { 0.0 };
            let _ = app.emit(
                "dl-progress",
                serde_json::json!({
                    "slug": slug, "kind": kind, "received": received, "total": total,
                    "pct": (pct * 10.0).round() / 10.0, "state": "downloading"
                }),
            );
        }
    }
    drop(file);
    std::fs::rename(&part, &dest).map_err(|e| format!("finalize: {e}"))?;
    downloads.clear_cancel(&key);
    let _ = app.emit(
        "dl-progress",
        serde_json::json!({ "slug": slug, "kind": kind, "received": received, "total": total, "pct": 100.0, "state": "done" }),
    );
    paths::log(&format!("download done {slug} {kind} ({received} bytes)"));
    Ok(dest)
}

pub fn remove_archive(slug: &str, kind: &str) {
    let p = paths::volume_archive(slug, kind);
    if p.exists() {
        let _ = std::fs::remove_file(p);
    }
}

pub fn is_downloaded(slug: &str, kind: &str) -> bool {
    paths::volume_archive(slug, kind).exists()
}

pub fn archive_size(path: &Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}