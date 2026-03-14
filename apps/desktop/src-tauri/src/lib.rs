pub mod commands;
pub mod engine;
pub mod errors;
pub mod persistence;
pub mod types;

use std::sync::Mutex;

use commands::{canvas, project, selection};
use engine::canvas_state::{ManagedCanvasState, ManagedProjectMeta};
use engine::selection::{ManagedSelectionState, SelectionState};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ManagedCanvasState(Mutex::new(None)))
        .manage(ManagedProjectMeta(Mutex::new(None)))
        .manage(ManagedSelectionState(Mutex::new(SelectionState::new())))
        .invoke_handler(tauri::generate_handler![
            project::new_project,
            project::open_project,
            project::save_project,
            project::get_project_info,
            project::mark_dirty,
            project::list_recent_projects,
            project::export_png,
            project::autosave_recovery,
            project::check_recovery,
            project::restore_recovery,
            project::discard_recovery,
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
            selection::set_selection_rect,
            selection::clear_selection,
            selection::get_selection,
            selection::copy_selection,
            selection::cut_selection,
            selection::paste_selection,
            selection::delete_selection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PixelStudio");
}
