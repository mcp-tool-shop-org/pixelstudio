use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProjectItem {
    pub file_path: String,
    pub name: String,
    pub thumbnail_path: Option<String>,
    pub last_modified_at: String,
}
