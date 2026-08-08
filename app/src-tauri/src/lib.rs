pub mod catalog;
pub mod commands;
pub mod download;
pub mod extract;
pub mod paths;
pub mod player;
pub mod runners;
pub mod runtime;
pub mod settings;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

pub fn run() {
    paths::ensure_base_dirs();
    paths::log("starting digerati");

    let app = tauri::Builder::default()
        .manage(catalog::Catalog::load())
        .manage(Mutex::new(settings::Settings::load()))
        .manage(download::Downloads::default())
        .manage(runners::Runners::default())
        .manage(player::ServerState {
            port: Mutex::new(None),
        })
        .invoke_handler(commands::handlers())
        .setup(|app| {
            // pre-heat only (no extraction in dev); runtime ready are prepared lazily
            let _ = runtime::ensure_runtime();
            paths::log("setup ok, emitting app-ready");
            let _ = app.emit("app-ready", serde_json::json!({}));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Digerati");

    paths::log("app built; entering run loop");
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            paths::log("exit event; killing child processes");
            app_handle.state::<runners::Runners>().kill_all();
        }
    });
    paths::log("run loop exited");
}