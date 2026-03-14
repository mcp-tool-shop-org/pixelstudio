pub mod commands;
pub mod engine;
pub mod errors;
pub mod persistence;
pub mod types;

use commands::project;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            project::create_project,
            project::open_project,
            project::save_project,
            project::list_recent_projects,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PixelStudio");
}
