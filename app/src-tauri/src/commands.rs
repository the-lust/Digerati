use crate::catalog::Catalog;
use crate::download::{self, Downloads};
use crate::extract as ex;
use crate::paths;
use crate::player::ServerState;
use crate::runners::{self, Runners};
use crate::runtime;
use crate::settings::{RecentEntry, Settings};
use base64::Engine;
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize)]
struct VolState {
    slug: String,
    downloaded: bool,
    iso_downloaded: bool,
    extracted: bool,
    size_mb: f64,
}

fn storage_state(cat: &Catalog, slug: &str) -> VolState {
    let arch = paths::volume_archive(slug, "games");
    let iso = paths::volume_archive(slug, "iso");
    let sz = cat.volume(slug).map(|v| v.games7z).unwrap_or(0);
    VolState {
        slug: slug.to_string(),
        downloaded: arch.exists(),
        iso_downloaded: iso.exists(),
        extracted: ex::has_volume(slug),
        size_mb: sz as f64 / 1024.0 / 1024.0,
    }
}

fn settings_getter(s: &State<'_, Mutex<Settings>>) -> Settings {
    s.lock().unwrap().clone()
}

// ---------------- catalog ----------------

#[tauri::command]
fn get_catalog(cat: State<'_, Catalog>) -> serde_json::Value {
    serde_json::json!({
        "meta": cat.meta,
        "volumes": cat.volumes,
        "sections": cat.sections,
    })
}

#[tauri::command]
fn search(
    cat: State<'_, Catalog>,
    section: String,
    q: String,
    vol: String,
    page: usize,
    per: usize,
) -> serde_json::Value {
    let (items, total) = cat.search(&section, &q, &vol, page, per);
    serde_json::json!({ "items": items, "total": total, "page": page })
}

#[tauri::command]
fn volume_items(cat: State<'_, Catalog>, vol: String, section: String) -> serde_json::Value {
    let items = if section.is_empty() || section == "all" {
        cat.all_volume_items(&vol)
    } else {
        cat.volume_items_section(&vol, &section)
    };
    serde_json::json!({ "items": items })
}

#[tauri::command]
fn volume_states(cat: State<'_, Catalog>) -> Vec<VolState> {
    cat.volumes.iter().map(|v| storage_state(&cat, &v.slug)).collect()
}

// ---------------- settings ----------------

#[tauri::command]
fn settings_get(s: State<'_, Mutex<Settings>>) -> Settings {
    settings_getter(&s)
}

#[tauri::command]
fn settings_set(s: State<'_, Mutex<Settings>>, key: String, value: serde_json::Value) -> Result<(), String> {
    let mut st = s.lock().unwrap();
    match key.as_str() {
        "storage_policy" => st.storage_policy = value.as_str().unwrap_or("full").to_string(),
        "menu_music" => st.menu_music = value.as_bool().unwrap_or(true),
        "intro_sounds" => st.intro_sounds = value.as_bool().unwrap_or(true),
        "close_sounds" => st.close_sounds = value.as_bool().unwrap_or(true),
        _ => return Err("unknown setting".into()),
    }
    st.save();
    Ok(())
}

#[tauri::command]
fn favorites_add(s: State<'_, Mutex<Settings>>, key: String) -> bool {
    let mut st = s.lock().unwrap();
    let out = st.toggle_favorite(&key);
    st.save();
    out
}

#[tauri::command]
fn favorites_remove(s: State<'_, Mutex<Settings>>, key: String) {
    let mut st = s.lock().unwrap();
    st.favorites.retain(|k| k != &key);
    st.save();
}

// ---------------- prepare / download / extract ----------------

async fn prepare_volume(app: &AppHandle, slug: &str) -> Result<(), String> {
    if ex::has_volume(slug) {
        return Ok(());
    }
    let arch = paths::volume_archive(slug, "games");
    if !arch.exists() {
        download::download_volume(app.clone(), slug.to_string(), "games".to_string()).await?;
    }
    if !ex::has_volume(slug) {
        let out = paths::vols_dir().join(slug);
        let a = app.clone();
        let sl = slug.to_string();
        ex::extract_all(&arch, &out, move |_b, files| {
            let _ = a.emit(
                "extract-progress",
                serde_json::json!({ "slug": sl, "files": files, "state": "extracting" }),
            );
        })?;
        let _ = app.emit("extract-progress", serde_json::json!({ "slug": slug, "state": "done" }));
    }
    Ok(())
}

#[tauri::command]
async fn download_volume(app: AppHandle, slug: String, kind: String) -> Result<String, String> {
    let p = download::download_volume(app, slug, kind).await?;
    Ok(p.display().to_string())
}

#[tauri::command]
fn cancel_download(dl: State<'_, Downloads>, slug: String, kind: String) {
    dl.request_cancel(&format!("{slug}:{kind}"));
}

#[tauri::command]
async fn extract_volume(app: AppHandle, slug: String) -> Result<String, String> {
    let _ = prepare_volume(&app, &slug).await?;
    Ok("ok".into())
}

#[tauri::command]
fn delete_volume(slug: String) -> Result<(), String> {
    let dir = paths::volume_dir(&slug);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    download::remove_archive(&slug, "games");
    download::remove_archive(&slug, "iso");
    Ok(())
}

#[tauri::command]
fn delete_all() -> Result<(), String> {
    for d in [paths::vols_dir(), paths::cache_dir(), paths::iso_dir(), paths::transcode_dir()] {
        if d.exists() {
            let _ = std::fs::remove_dir_all(&d);
            let _ = std::fs::create_dir_all(&d);
        }
    }
    Ok(())
}

// ---------------- playback ----------------

fn encode_part(rel: &str) -> String {
    utf8_percent_encode(rel, NON_ALPHANUMERIC).to_string()
}

async fn ensure_extracted_file(app: &AppHandle, slug: &str, path: &str) -> Result<(), String> {
    let abs = paths::volume_dir(slug).join(path);
    if abs.exists() {
        return Ok(());
    }
    if ex::has_volume(slug) {
        let arch = paths::volume_archive(slug, "games");
        if arch.exists() {
            let _ = ex::extract_one(&arch, path, &paths::vols_dir())?;
            if abs.exists() {
                return Ok(());
            }
        }
    }
    prepare_volume(app, slug).await?;
    if !abs.exists() {
        return Err(format!("file missing after prepare: {}", abs.display()));
    }
    Ok(())
}

#[tauri::command]
async fn play_swf(app: AppHandle, slug: String, path: String) -> Result<String, String> {
    ensure_extracted_file(&app, &slug, &path).await?;
    let port = crate::player::ensure_server(&app.state::<ServerState>())?;
    let rel = path.trim_start_matches('/');
    let url = format!(
        "http://127.0.0.1:{port}/player.html?src=/vols/{}/{}",
        encode_part(&slug),
        encode_part(rel)
    );
    let name = crate::catalog::clean_name(&path);
    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    let win = WebviewWindowBuilder::new(&app, "player", WebviewUrl::External(parsed))
        .title(format!("{name} — Digerati"))
        .inner_size(1024.0, 768.0)
        .min_inner_size(480.0, 360.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    let _ = win.set_focus();
    push_recent(&app, &slug, &path, &name, "game");
    Ok(url)
}

#[tauri::command]
async fn open_media(app: AppHandle, slug: String, path: String) -> Result<String, String> {
    ensure_extracted_file(&app, &slug, &path).await?;
    let port = crate::player::ensure_server(&app.state::<ServerState>())?;
    let base = path.trim_start_matches('/').to_string();
    let ext = base.rsplit('.').next().unwrap_or("").to_lowercase();
    let (rel, view_ext) = if ext == "flv" {
        let mp4 = runners::transcode_flv(&slug, &path)?;
        let fname = mp4
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "video.mp4".into());
        (format!("/media/{}/{}", encode_part(&slug), encode_part(&fname)), "mp4")
    } else {
        (format!("/vols/{}/{}", encode_part(&slug), encode_part(&base)), ext.as_str())
    };
    let url = format!("http://127.0.0.1:{port}/player.html?src={rel}&ext={view_ext}");
    let name = crate::catalog::clean_name(&path);
    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    let win = WebviewWindowBuilder::new(&app, "media", WebviewUrl::External(parsed))
        .title(format!("{name} — Digerati"))
        .inner_size(960.0, 720.0)
        .min_inner_size(480.0, 360.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    let _ = win.set_focus();
    push_recent(&app, &slug, &path, &name, "media");
    Ok(url)
}

#[tauri::command]
async fn run_tool(runners: State<'_, Runners>, app: AppHandle, slug: String, path: String) -> Result<u32, String> {
    ensure_extracted_file(&app, &slug, &path).await?;
    let abs = paths::volume_dir(&slug).join(&path);
    let pid = runners::run_native(abs)?;
    runners.pids.lock().unwrap().push(pid);
    push_recent(&app, &slug, &path, &crate::catalog::clean_name(&path), "tool");
    Ok(pid)
}

#[tauri::command]
async fn play_shockwave(runners: State<'_, Runners>, app: AppHandle, slug: String, path: String) -> Result<u32, String> {
    ensure_extracted_file(&app, &slug, &path).await?;
    let pid = runners::run_shockwave(&slug, &path)?;
    runners.pids.lock().unwrap().push(pid);
    push_recent(&app, &slug, &path, &crate::catalog::clean_name(&path), "shockwave");
    Ok(pid)
}

#[tauri::command]
fn kill_process(runners: State<'_, Runners>, pid: u32) {
    runners.kill(pid);
}

#[tauri::command]
fn running_processes(runners: State<'_, Runners>) -> Vec<serde_json::Value> {
    runners
        .pids
        .lock()
        .unwrap()
        .iter()
        .map(|&p| serde_json::json!({ "pid": p }))
        .collect()
}

#[tauri::command]
fn open_file(slug: String, path: String) -> Result<(), String> {
    let abs = paths::volume_dir(&slug).join(&path);
    if !abs.exists() {
        return Err(format!("not extracted: {}", abs.display()));
    }
    let wd = abs.parent().map(|p| p.to_path_buf());
    runners::launch_external(&abs, wd)?;
    Ok(())
}

#[tauri::command]
fn asset_path(slug: String, path: String) -> Result<String, String> {
    Ok(paths::volume_dir(&slug).join(&path).display().to_string())
}

#[tauri::command]
async fn transcode(app: AppHandle, slug: String, path: String) -> Result<String, String> {
    ensure_extracted_file(&app, &slug, &path).await?;
    let mp4 = tauri::async_runtime::spawn_blocking(move || runners::transcode_flv(&slug, &path))
        .await
        .map_err(|e| e.to_string())??;
    Ok(mp4.display().to_string())
}

// ---------------- misc ----------------

#[tauri::command]
fn music_b64() -> Result<Option<String>, String> {
    match runtime::menu_music() {
        Some(p) => {
            let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
            Ok(Some(base64::engine::general_purpose::STANDARD.encode(bytes)))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn player_port(state: State<'_, ServerState>) -> Option<u16> {
    *state.port.lock().unwrap()
}

#[tauri::command]
fn storage_stats() -> serde_json::Value {
    let mut extracted = 0usize;
    let mut extracted_bytes = 0u64;
    if let Ok(rd) = std::fs::read_dir(paths::vols_dir()) {
        for e in rd.flatten() {
            if e.path().is_dir() {
                extracted += 1;
                extracted_bytes += dir_size(&e.path());
            }
        }
    }
    let cache = dir_size(&paths::cache_dir());
    let transcode = dir_size(&paths::transcode_dir());
    let root = dir_size(&paths::appdata_dir());
    serde_json::json!({
        "appdata_path": paths::appdata_dir().display().to_string(),
        "extracted_volumes": extracted,
        "extracted_bytes": extracted_bytes,
        "cache_bytes": cache,
        "transcode_bytes": transcode,
        "appdata_bytes": root,
    })
}

fn dir_size(p: &Path) -> u64 {
    let mut sum = 0u64;
    if let Ok(rd) = std::fs::read_dir(p) {
        for e in rd.flatten() {
            let f = e.path();
            if f.is_dir() {
                sum += dir_size(&f);
            } else if let Ok(m) = f.metadata() {
                sum += m.len();
            }
        }
    }
    sum
}

fn push_recent(app: &AppHandle, slug: &str, path: &str, name: &str, kind: &str) {
    let st: State<'_, Mutex<Settings>> = app.state();
    let mut st = st.lock().unwrap();
    st.push_recent(RecentEntry {
        slug: slug.to_string(),
        path: path.to_string(),
        name: name.to_string(),
        kind: kind.to_string(),
        ts: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    });
    st.save();
}

pub fn handlers() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        get_catalog,
        search,
        volume_items,
        volume_states,
        settings_get,
        settings_set,
        favorites_add,
        favorites_remove,
        download_volume,
        cancel_download,
        extract_volume,
        delete_volume,
        delete_all,
        play_swf,
        open_media,
        run_tool,
        play_shockwave,
        open_file,
        asset_path,
        transcode,
        music_b64,
        storage_stats,
        player_port,
        running_processes,
        kill_process
    ]
}