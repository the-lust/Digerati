use std::io::Write;
use std::path::PathBuf;

pub fn appdata_dir() -> PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| {
        std::env::var("USERPROFILE")
            .map(|u| format!("{u}\\AppData\\Roaming"))
            .unwrap_or_else(|_| ".".into())
    });
    PathBuf::from(base).join("Digerati")
}

pub fn cache_dir() -> PathBuf {
    appdata_dir().join("cache")
}

pub fn vols_dir() -> PathBuf {
    appdata_dir().join("vols")
}

pub fn iso_dir() -> PathBuf {
    appdata_dir().join("iso")
}

pub fn transcode_dir() -> PathBuf {
    appdata_dir().join("transcode")
}

pub fn runtime_dir() -> PathBuf {
    appdata_dir().join("runtime")
}

pub fn settings_path() -> PathBuf {
    appdata_dir().join("settings.json")
}

pub fn log_path() -> PathBuf {
    appdata_dir().join("digerati.log")
}

pub fn volume_archive(slug: &str, kind: &str) -> PathBuf {
    cache_dir().join(format!("{slug}.{kind}.7z"))
}

pub fn volume_dir(slug: &str) -> PathBuf {
    vols_dir().join(slug)
}

pub fn ensure_base_dirs() {
    for d in [
        appdata_dir(),
        cache_dir(),
        vols_dir(),
        iso_dir(),
        transcode_dir(),
        runtime_dir(),
    ] {
        let _ = std::fs::create_dir_all(&d);
    }
}

pub fn log(msg: &str) {
    let line = format!("[{}] {}\n", now_epoch(), msg);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_path()) {
        let _ = f.write_all(line.as_bytes());
    }
}

fn now_epoch() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}