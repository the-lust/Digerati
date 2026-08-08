use crate::paths;
use std::path::PathBuf;

#[cfg(embed_runtime)]
use crate::extract;

#[cfg(embed_runtime)]
const RUNTIME_BLOB: &[u8] = include_bytes!("../embedded/runtime.7z");
#[cfg(not(embed_runtime))]
const RUNTIME_BLOB: &[u8] = &[];

#[cfg(embed_runtime)]
const MARKER: &str = "ready.marker";

fn dev_bundles_dir() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("DIGERAT_DEV_RUNTIME") {
        if !p.is_empty() && PathBuf::from(&p).is_dir() {
            return Some(PathBuf::from(p));
        }
    }
    let guess = PathBuf::from("D:\\disks\\repo\\app\\bundles");
    if guess.is_dir() {
        Some(guess)
    } else {
        None
    }
}

/// Ensure bundled runtime files (ruffle, projectors, ffmpeg, music) are present.
/// Returns the absolute directory that holds them.
pub fn ensure_runtime() -> Result<PathBuf, String> {
    let target = paths::runtime_dir();
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;

    #[cfg(embed_runtime)]
    {
        let marker = target.join(MARKER);
        if marker.exists() {
            return Ok(target);
        }
        if RUNTIME_BLOB.is_empty() {
            return Err("embedded runtime blob missing - run scripts/build-runtime before building".into());
        }
        paths::log("extracting embedded runtime...");
        extract::extract_blob_to_dir(RUNTIME_BLOB, &target)?;
        let n = std::fs::read_dir(&target).map(|rd| rd.count()).unwrap_or(0);
        let _ = std::fs::write(&marker, format!("{n}\n"));
        paths::log("runtime extracted");
        return Ok(target);
    }

    #[cfg(not(embed_runtime))]
    {
        if let Some(dir) = dev_bundles_dir() {
            return Ok(dir);
        }
        Err("dev runtime not found: set DIGERAT_DEV_RUNTIME to the app/bundles directory".into())
    }
}

pub fn ruffle_dir() -> Result<PathBuf, String> {
    let d = ensure_runtime()?.join("ruffle");
    if d.is_dir() {
        Ok(d)
    } else {
        Err(format!("ruffle missing: {}", d.display()))
    }
}

pub fn projector_dirs() -> Result<Vec<PathBuf>, String> {
    let base = ensure_runtime()?.join("projectors");
    let Ok(rd) = std::fs::read_dir(&base) else {
        return Err(format!("no projectors under {}", base.display()));
    };
    let mut v: Vec<PathBuf> = rd
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.is_dir())
        .collect();
    v.sort();
    Ok(v)
}

pub fn ffmpeg_path() -> Result<PathBuf, String> {
    let base = ensure_runtime()?;
    let root = base.join("ffmpeg.exe");
    if root.exists() {
        return Ok(root);
    }
    let sub = base.join("runtime").join("ffmpeg.exe");
    if sub.exists() {
        return Ok(sub);
    }
    Err(format!("ffmpeg missing under {}", base.display()))
}

pub fn menu_music() -> Option<PathBuf> {
    let p = paths::runtime_dir().join("trilha.mp3");
    if p.exists() {
        return Some(p);
    }
    dev_bundles_dir()
        .map(|d| d.join("audio").join("trilha.mp3"))
        .filter(|p| p.exists())
}