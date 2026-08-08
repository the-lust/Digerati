use crate::paths;
use sevenz_rust::{Error as SZError, Password, SevenZArchiveEntry, SevenZReader};
use std::path::{Path, PathBuf};

fn is_dir_entry(e: &SevenZArchiveEntry) -> bool {
    e.is_directory || e.name.ends_with('/') || e.name.ends_with('\\')
}

/// Extract every file in the archive to `out_dir`. Returns the file count.
pub fn extract_all(archive: &Path, out_dir: &Path, mut on_progress: impl FnMut(usize, usize)) -> Result<usize, String> {
    let mut reader = SevenZReader::open(archive, Password::empty()).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(out_dir).map_err(|e| e.to_string())?;
    let mut count = 0usize;
    let mut written = 0usize;
    reader
        .for_each_entries(|entry, rs| {
            if is_dir_entry(entry) {
                return Ok(true);
            }
            let rel = entry.name.replace('\\', "/");
            let target = safe_join(out_dir, &rel);
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|e| SZError::io_msg(e, "mkdir"))?;
            }
            let mut f = std::fs::File::create(&target).map_err(|e| SZError::io_msg(e, "create file"))?;
            std::io::copy(rs, &mut f).map_err(|e| SZError::io_msg(e, "copy"))?;
            written += entry.size.max(1) as usize;
            count += 1;
            if written % 4096 == 0 {
                on_progress(written, count);
            }
            Ok(true)
        })
        .map_err(|e| e.to_string())?;
    on_progress(written, count);
    Ok(count)
}

/// Extract a single entry (by exact name) to out_dir, returning the path written.
pub fn extract_one(archive: &Path, entry_name: &str, out_dir: &Path) -> Result<Option<PathBuf>, String> {
    if !archive.exists() {
        return Err(format!("archive missing: {}", archive.display()));
    }
    let mut reader = SevenZReader::open(archive, Password::empty()).map_err(|e| e.to_string())?;
    let target = safe_join(out_dir, entry_name.replace('\\', "/").as_str());
    let mut found: Option<PathBuf> = None;
    reader
        .for_each_entries(|entry, rd| {
            if found.is_some() {
                return Ok(false);
            }
            if entry.name.replace('\\', "/") == entry_name {
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| SZError::io_msg(e, "mkdir"))?;
                }
                let mut f = std::fs::File::create(&target).map_err(|e| SZError::io_msg(e, "create file"))?;
                std::io::copy(rd, &mut f).map_err(|e| SZError::io_msg(e, "copy"))?;
                found = Some(target.clone());
                return Ok(false); // stop: solid archives cannot skip ahead anyway
            }
            Ok(true)
        })
        .map_err(|e| e.to_string())?;
    Ok(found)
}

/// Extract several entries by exact name.
pub fn extract_files(archive: &Path, names: &[String], out_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut reader = SevenZReader::open(archive, Password::empty()).map_err(|e| e.to_string())?;
    let mut found: Vec<PathBuf> = Vec::new();
    reader
        .for_each_entries(|entry, rd| {
            let name = entry.name.replace('\\', "/");
            if names.iter().any(|n| n == &name) {
                let target = safe_join(out_dir, &name);
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| SZError::io_msg(e, "mkdir"))?;
                }
                let mut f = std::fs::File::create(&target).map_err(|e| SZError::io_msg(e, "create file"))?;
                std::io::copy(rd, &mut f).map_err(|e| SZError::io_msg(e, "copy"))?;
                found.push(target);
            }
            Ok(true)
        })
        .map_err(|e| e.to_string())?;
    Ok(found)
}

pub fn entry_count(archive: &Path) -> Result<usize, String> {
    let mut reader = SevenZReader::open(archive, Password::empty()).map_err(|e| e.to_string())?;
    let mut n = 0usize;
    reader
        .for_each_entries(|e, _| {
            if !is_dir_entry(e) {
                n += 1;
            }
            Ok(true)
        })
        .map_err(|e| e.to_string())?;
    Ok(n)
}

pub fn has_volume(slug: &str) -> bool {
    let dir = paths::volume_dir(slug);
    if !dir.exists() {
        return false;
    }
    let Ok(rd) = std::fs::read_dir(&dir) else {
        return false;
    };
    rd.count() > 0
}

/// Extract an in-memory blob (the embedded runtime.7z) into out_dir.
pub fn extract_blob_to_dir(blob: &[u8], out_dir: &Path) -> Result<usize, String> {
    std::fs::create_dir_all(out_dir).map_err(|e| e.to_string())?;
    let cursor = std::io::Cursor::new(blob);
    let mut reader = SevenZReader::new(cursor, blob.len() as u64, Password::empty()).map_err(|e| e.to_string())?;
    let mut count = 0usize;
    reader
        .for_each_entries(|entry, rd| {
            if is_dir_entry(entry) {
                return Ok(true);
            }
            let rel = entry.name.replace('\\', "/");
            let target = safe_join(out_dir, &rel);
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|e| SZError::io_msg(e, "mkdir"))?;
            }
            let mut f = std::fs::File::create(&target).map_err(|e| SZError::io_msg(e, "create file"))?;
            std::io::copy(rd, &mut f).map_err(|e| SZError::io_msg(e, "copy"))?;
            count += 1;
            Ok(true)
        })
        .map_err(|e| e.to_string())?;
    Ok(count)
}

fn safe_join(root: &Path, rel: &str) -> PathBuf {
    let mut out = root.to_path_buf();
    for part in rel.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            continue;
        }
        out.push(part);
    }
    out
}