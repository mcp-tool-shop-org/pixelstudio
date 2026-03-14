use tauri::command;
use uuid::Uuid;

use crate::errors::AppError;
use crate::types::api::{CreateProjectInput, ProjectSummary, RecentProjectItem};

#[command]
pub async fn create_project(input: CreateProjectInput) -> Result<ProjectSummary, AppError> {
    let project_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // TODO: Create project file on disk via persistence module

    Ok(ProjectSummary {
        project_id,
        name: input.name,
        file_path: input.file_path,
        canvas_width: input.canvas_width,
        canvas_height: input.canvas_height,
        color_mode: input.color_mode,
        created_at: now,
    })
}

#[command]
pub async fn open_project(file_path: String) -> Result<ProjectSummary, AppError> {
    // TODO: Load and deserialize project from disk
    Err(AppError::ProjectNotFound(file_path))
}

#[command]
pub async fn save_project(project_id: String, _reason: String) -> Result<String, AppError> {
    // TODO: Serialize and persist project state
    let now = chrono::Utc::now().to_rfc3339();
    let _ = project_id;
    Ok(now)
}

#[command]
pub async fn list_recent_projects() -> Result<Vec<RecentProjectItem>, AppError> {
    // TODO: Read from local recent-projects store
    Ok(vec![])
}
