pub mod commands;
pub mod engine;
pub mod errors;
pub mod persistence;
pub mod types;

use std::sync::Mutex;

use commands::{canvas, project};
use engine::canvas_state::ManagedCanvasState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ManagedCanvasState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            project::create_project,
            project::open_project,
            project::save_project,
            project::list_recent_projects,
            canvas::init_canvas,
            canvas::get_canvas_state,
            canvas::write_pixel,
            canvas::read_pixel,
            canvas::begin_stroke,
            canvas::stroke_points,
            canvas::end_stroke,
            canvas::undo,
            canvas::redo,
            canvas::create_layer,
            canvas::delete_layer,
            canvas::rename_layer,
            canvas::select_layer,
            canvas::set_layer_visibility,
            canvas::set_layer_lock,
            canvas::set_layer_opacity,
            canvas::reorder_layer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PixelStudio");
}
