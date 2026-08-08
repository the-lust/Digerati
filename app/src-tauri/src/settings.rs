use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct Settings {
    pub storage_policy: String, // "full" | "file"
    pub menu_music: bool,
    pub intro_sounds: bool,
    pub close_sounds: bool,
    pub favorites: Vec<String>,   // slug:path
    pub recent: Vec<RecentEntry>, // most recent first
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            storage_policy: "full".into(),
            menu_music: true,
            intro_sounds: true,
            close_sounds: true,
            favorites: Vec::new(),
            recent: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentEntry {
    pub slug: String,
    pub path: String,
    pub name: String,
    pub kind: String,
    pub ts: u64,
}

impl Settings {
    pub fn load() -> Self {
        let p = crate::paths::settings_path();
        match std::fs::read_to_string(&p) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => Settings::default(),
        }
    }

    pub fn save(&self) {
        if let Ok(s) = serde_json::to_string_pretty(self) {
            if let Ok(mut f) = std::fs::File::create(crate::paths::settings_path()) {
                let _ = std::io::Write::write_all(&mut f, s.as_bytes());
            }
        }
    }

    pub fn toggle_favorite(&mut self, key: &str) -> bool {
        if let Some(i) = self.favorites.iter().position(|k| k == key) {
            self.favorites.remove(i);
            false
        } else {
            self.favorites.push(key.to_string());
            true
        }
    }

    pub fn is_favorite(&self, key: &str) -> bool {
        self.favorites.iter().any(|k| k == key)
    }

    pub fn push_recent(&mut self, r: RecentEntry) {
        self.recent.retain(|x| !(x.slug == r.slug && x.path == r.path));
        self.recent.insert(0, r);
        self.recent.truncate(12);
    }
}