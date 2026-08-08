use crate::paths;
use crate::runtime;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;

pub struct Runners {
    pub pids: Mutex<Vec<u32>>,
}

impl Default for Runners {
    fn default() -> Self {
        Self {
            pids: Mutex::new(Vec::new()),
        }
    }
}

impl Runners {
    pub fn kill(&self, pid: u32) {
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }

    pub fn kill_all(&self) {
        let pids: Vec<u32> = std::mem::take(&mut *self.pids.lock().unwrap());
        for pid in pids {
            self.kill(pid);
        }
    }
}

fn which_projector() -> Result<PathBuf, String> {
    let dirs = runtime::projector_dirs()?;
    for d in dirs.iter().rev() {
        let exe = d.join("Projector.exe");
        if exe.exists() {
            return Ok(exe);
        }
    }
    Err("no projector skeleton found".into())
}

/// Launch an extracted file (its absolute path) with the system shell / direct spawn.
/// Uses `start ""` semantics so GUI apps and exe games run detached.
pub fn launch_external(path: &std::path::Path, workdir: Option<PathBuf>) -> Result<u32, String> {
    if !path.exists() {
        return Err(format!("file not found: {}", path.display()));
    }
    let mut cmd = Command::new("cmd");
    cmd.arg("/C")
        .arg("start")
        .arg("")
        .arg(path.as_os_str());
    if let Some(wd) = workdir {
        cmd.current_dir(wd);
    }
    let child = cmd.spawn().map_err(|e| e.to_string())?;
    let pid = child.id();
    let _ = child; // detached cmd host
    Ok(pid)
}

/// Run a native Windows program from an extracted volume; returns child pid + label.
pub fn run_native(abs: PathBuf) -> Result<u32, String> {
    let workdir = abs
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    launch_external(&abs, Some(workdir))
}

pub fn run_shockwave(slug: &str, path: &str) -> Result<u32, String> {
    let vol_dir = paths::volume_dir(slug);
    let movie = vol_dir.join(path);
    if !movie.exists() {
        return Err(format!("dcr not extracted: {}", movie.display()));
    }
    let dirs = runtime::projector_dirs()?;
    // newest first
    for d in dirs.iter().rev() {
        let exe = d.join("Projector.exe");
        if exe.exists() {
            return spawn_projector(exe, movie.clone());
        }
    }
    Err("no projector skeleton found".into())
}

fn spawn_projector(exe: PathBuf, movie: PathBuf) -> Result<u32, String> {
    let child = Command::new(&exe)
        .arg(movie.as_os_str())
        .current_dir(movie.parent().unwrap_or(std::path::Path::new(".")))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(child.id())
}

/// Transcode a FLV to MP4 in the transcode cache; returns the output file path.
pub fn transcode_flv(slug: &str, path: &str) -> Result<PathBuf, String> {
    let ff = runtime::ffmpeg_path()?;
    let src = paths::volume_dir(slug).join(path);
    if !src.exists() {
        return Err(format!("flv not extracted: {}", src.display()));
    }
    let base = src
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "video".into());
    let out_dir = paths::transcode_dir().join(slug);
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;
    let out = out_dir.join(format!("{base}.mp4"));
    if out.exists() {
        return Ok(out);
    }
    let status = Command::new(&ff)
        .args(["-hide_banner", "-y", "-i"])
        .arg(&src)
        .args(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"])
        .arg(&out)
        .status()
        .map_err(|e| format!("ffmpeg: {e}"))?;
    if status.success() && out.exists() {
        Ok(out)
    } else {
        Err("ffmpeg conversion failed".into())
    }
}

/// Absolute path of an extracted file (vols/{slug}/{path}).
pub fn extracted_path(slug: &str, path: &str) -> PathBuf {
    paths::volume_dir(slug).join(path)
}