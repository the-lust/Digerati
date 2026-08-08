use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::paths;

pub static META_JSON: &str = include_str!("../data/meta.json");
pub static VOLUMES_JSON: &str = include_str!("../data/volumes.json");
pub static GAMES_JSON: &str = include_str!("../data/games.json");

fn no_bom(s: &str) -> &str {
    s.strip_prefix('\u{feff}').unwrap_or(s)
}

fn log_parse_err(kind: &str, name: &str, e: &serde_json::Error) {
    paths::log(&format!("catalog: {name} failed to parse ({kind}): {e}"));
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Volume {
    pub vol: String,
    pub slug: String,
    #[serde(default)]
    pub damaged: bool,
    #[serde(default)]
    pub has_iso: bool,
    #[serde(default)]
    pub cover: bool,
    #[serde(default)]
    pub file_count: u64,
    #[serde(default)]
    pub raw_bytes: u64,
    #[serde(default)]
    pub games7z: u64,
    #[serde(default)]
    pub iso7z: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub volume_count: u64,
    pub game_count: u64,
    pub raw_bytes: u64,
    pub games7z_bytes: u64,
    pub iso7z_bytes: u64,
    pub iso_volume_count: u64,
    pub cover_count: u64,
    pub pages_url: String,
    pub repo_url: String,
}

#[derive(Clone)]
pub struct GameEntry {
    pub v: String,
    pub n: String,
    pub s: u64,
}

#[derive(Serialize, Clone)]
pub struct GameItem {
    pub v: String,
    pub n: String,
    pub s: u64,
    pub name: String,
    pub ext: String,
    pub kind: &'static str,
    pub icon: &'static str,
    pub section: &'static str,
    pub art: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct SectionCounts {
    pub games: usize,
    pub tools: usize,
    pub shockwave: usize,
    pub wallpapers: usize,
    pub colouring: usize,
    pub media: usize,
    pub docs: usize,
    pub paint: usize,
    pub extras: usize,
}

pub fn section_of(path: &str) -> &'static str {
    let base = path.rsplit('/').next().unwrap_or(path);
    let low = base.to_lowercase();
    let ext = low.rsplit('.').next().unwrap_or("");
    match ext {
        "swf" => "games",
        "exe" => "tools",
        "dcr" | "dir" => "shockwave",
        "mp3" | "wav" => "media",
        "flv" => "media",
        "pdf" | "txt" | "html" | "htm" => "docs",
        "cp" | "dpt" | "dpc" => "paint",
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "pcx" | "rgb" => {
            if low.contains("colouring") || low.contains("colorir") {
                "colouring"
            } else {
                "wallpapers"
            }
        }
        _ => "extras",
    }
}

pub fn kind_of(path: &str) -> (&'static str, &'static str) {
    let base = path.rsplit('/').next().unwrap_or(path);
    let ext = base.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "swf" => ("Flash game", "🎮"),
        "exe" => ("Windows program", "🖥️"),
        "dcr" | "dir" => ("Shockwave title", "💿"),
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "pcx" | "rgb" => ("Image", "🖼️"),
        "mp3" | "wav" => ("Audio", "🎵"),
        "flv" => ("Video", "🎬"),
        "pdf" => ("Document", "📄"),
        "txt" | "html" | "htm" => ("Document", "📄"),
        "cp" | "dpt" | "dpc" => ("Click and Paint", "🎨"),
        _ => ("File", "📁"),
    }
}

pub fn clean_name(path: &str) -> String {
    let base = path.rsplit('/').next().unwrap_or(path);
    let no_ext = base.split('.').next().unwrap_or(base);
    no_ext
        .replace(['[', ']'], "")
        .split(|c: char| c == '_' || c.is_whitespace())
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

pub struct Catalog {
    pub meta: Meta,
    pub volumes: Vec<Volume>,
    pub games: Vec<GameEntry>,
    pub sections: SectionCounts,
    arts: HashMap<String, Vec<String>>, // (v, folder) -> image paths
}

fn norm_key(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

impl Catalog {
    pub fn load() -> Self {
        let meta: serde_json::Value = serde_json::from_str(no_bom(META_JSON))
            .map_err(|e| log_parse_err("meta", "meta.json", &e))
            .unwrap_or_default();
        let m = Meta {
            volume_count: meta["volumeCount"].as_u64().unwrap_or(0),
            game_count: meta["gameCount"].as_u64().unwrap_or(0),
            raw_bytes: meta["rawBytes"].as_u64().unwrap_or(0),
            games7z_bytes: meta["games7zBytes"].as_u64().unwrap_or(0),
            iso7z_bytes: meta["iso7zBytes"].as_u64().unwrap_or(0),
            iso_volume_count: meta["isoVolumeCount"].as_u64().unwrap_or(0),
            cover_count: meta["coverCount"].as_u64().unwrap_or(0),
            pages_url: meta["pagesUrl"].as_str().unwrap_or("").into(),
            repo_url: meta["repoUrl"].as_str().unwrap_or("").into(),
        };
        let vols: Vec<Volume> = serde_json::from_str(no_bom(VOLUMES_JSON))
            .map_err(|e| log_parse_err("volumes", "volumes.json", &e))
            .unwrap_or_default();
        #[derive(Deserialize)]
        struct RawEntry {
            v: String,
            n: String,
            s: u64,
        }
        let raw: Vec<RawEntry> = serde_json::from_str(no_bom(GAMES_JSON))
            .map_err(|e| log_parse_err("games", "games.json", &e))
            .unwrap_or_default();
        let games: Vec<GameEntry> = raw
            .into_iter()
            .map(|e| GameEntry {
                v: e.v,
                n: e.n,
                s: e.s,
            })
            .collect();

        let mut sections = SectionCounts {
            games: 0,
            tools: 0,
            shockwave: 0,
            wallpapers: 0,
            colouring: 0,
            media: 0,
            docs: 0,
            paint: 0,
            extras: 0,
        };
        for g in &games {
            match section_of(&g.n) {
                "games" => sections.games += 1,
                "tools" => sections.tools += 1,
                "shockwave" => sections.shockwave += 1,
                "wallpapers" => sections.wallpapers += 1,
                "colouring" => sections.colouring += 1,
                "media" => sections.media += 1,
                "docs" => sections.docs += 1,
                "paint" => sections.paint += 1,
                _ => sections.extras += 1,
            }
        }

        let mut arts: HashMap<String, Vec<String>> = HashMap::new();
        for g in &games {
            let low = g.n.to_lowercase();
            if low.ends_with(".jpg")
                || low.ends_with(".jpeg")
                || low.ends_with(".png")
                || low.ends_with(".gif")
                || low.ends_with(".bmp")
            {
                let folder = g.n.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or_default();
                arts.entry(format!("{}|{}", g.v, folder)).or_default().push(g.n.clone());
            }
        }

        Catalog {
            meta: m,
            volumes: vols,
            games,
            sections,
            arts,
        }
    }

    pub fn volume(&self, slug: &str) -> Option<&Volume> {
        self.volumes.iter().find(|v| v.slug == slug)
    }

    pub fn archive_bytes(&self, slug: &str, kind: &str) -> Option<u64> {
        let v = self.volume(slug)?;
        if kind == "iso" {
            Some(v.iso7z)
        } else {
            Some(v.games7z)
        }
    }

    pub fn item(&self, g: &GameEntry) -> GameItem {
        let (kind, icon) = kind_of(&g.n);
        GameItem {
            v: g.v.clone(),
            n: g.n.clone(),
            s: g.s,
            name: clean_name(&g.n),
            ext: g.n.rsplit('.').next().unwrap_or("").to_lowercase(),
            kind,
            icon,
            section: section_of(&g.n),
            art: self.find_art(g),
        }
    }

    pub fn find_art(&self, g: &GameEntry) -> Option<String> {
        let base = g.n.rsplit('/').next()?;
        let base_key = norm_key(base.split('.').next()?);
        let folder = g.n.rsplit_once('/').map(|(d, _)| d.to_string()).unwrap_or_default();

        // 1. image in same folder
        if let Some(imgs) = self.arts.get(&format!("{}|{}", g.v, folder)) {
            for im in imgs {
                let im_key = norm_key(im.rsplit('/').next().unwrap_or(""));
                if im_key.contains(&base_key) || base_key.contains(&im_key) {
                    return Some(im.clone());
                }
            }
        }
        // 2. DEPOSITO/imagens or Interface/Imagens by name
        for art_dir in ["DEPOSITO/imagens", "Interface/Imagens", "interface/imagens", "interface/Imagens"] {
            if let Some(imgs) = self.arts.get(&format!("{}|{}", g.v, art_dir)) {
                for im in imgs {
                    let im_key = norm_key(im.rsplit('/').next().unwrap_or(""));
                    if im_key.contains(&base_key) || base_key.contains(&im_key) {
                        return Some(im.clone());
                    }
                }
            }
        }
        None
    }

    pub fn search(&self, section: &str, q: &str, vol: &str, page: usize, per: usize) -> (Vec<GameItem>, usize) {
        let ql = q.trim().to_lowercase();
        let matches_section = |s: &str| -> bool {
            if section == "all" {
                true
            } else if section == "art" {
                matches!(s, "wallpapers" | "colouring" | "paint")
            } else {
                s == section
            }
        };
        let mut out: Vec<GameItem> = self
            .games
            .iter()
            .filter(|g| {
                if !vol.is_empty() && g.v != vol {
                    return false;
                }
                if !matches_section(section_of(&g.n)) {
                    return false;
                }
                if !ql.is_empty() {
                    let name = clean_name(&g.n).to_lowercase();
                    let path = g.n.to_lowercase();
                    if !(name.contains(&ql) || path.contains(&ql)) {
                        return false;
                    }
                }
                true
            })
            .map(|g| self.item(g))
            .collect();
        out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        let total = out.len();
        let start = page.saturating_mul(per);
        let end = (start + per).min(total);
        let slice = if start < total { out.split_off(start) } else { vec![] };
        let slice = slice.into_iter().take(end.saturating_sub(start)).collect();
        (slice, total)
    }

    pub fn all_volume_items(&self, slug: &str) -> Vec<GameItem> {
        self.games
            .iter()
            .filter(|g| g.v == slug)
            .map(|g| self.item(g))
            .collect()
    }

    pub fn volume_items_section(&self, slug: &str, section: &str) -> Vec<GameItem> {
        let matches_section = |s: &str| -> bool {
            if section == "art" {
                matches!(s, "wallpapers" | "colouring" | "paint")
            } else {
                s == section
            }
        };
        self.games
            .iter()
            .filter(|g| g.v == slug && matches_section(section_of(&g.n)))
            .map(|g| self.item(g))
            .collect()
    }
}
