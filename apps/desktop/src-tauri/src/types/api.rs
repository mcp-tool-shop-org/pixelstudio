use serde::{Deserialize, Serialize};
use super::domain::ColorMode;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub file_path: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub color_mode: ColorMode,
    pub palette_id: Option<String>,
    pub timeline_enabled: bool,
    pub starter_rig_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub project_id: String,
    pub name: String,
    pub file_path: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub color_mode: ColorMode,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProjectItem {
    pub file_path: String,
    pub name: String,
    pub thumbnail_path: Option<String>,
    pub last_modified_at: String,
}
