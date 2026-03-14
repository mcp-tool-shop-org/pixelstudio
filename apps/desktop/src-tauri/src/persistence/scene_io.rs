use std::path::Path;
use crate::engine::scene::SceneDocument;
use crate::errors::AppError;

const SCENE_SCHEMA_VERSION: u32 = 1;

/// On-disk scene file format.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneFile {
    pub schema_version: u32,
    #[serde(flatten)]
    pub document: SceneDocument,
}

impl SceneFile {
    pub fn from_document(doc: &SceneDocument) -> Self {
        Self {
            schema_version: SCENE_SCHEMA_VERSION,
            document: doc.clone(),
        }
    }
}

/// Save a scene document to a .pscn file.
pub fn save_scene(doc: &SceneDocument, path: &str) -> Result<(), AppError> {
    let file = SceneFile::from_document(doc);
    let json = serde_json::to_string_pretty(&file)?;
    std::fs::write(path, json)?;
    Ok(())
}

/// Load a scene document from a .pscn file.
pub fn load_scene(path: &str) -> Result<SceneDocument, AppError> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(AppError::ProjectNotFound(format!(
            "Scene file not found: {}",
            path
        )));
    }
    let data = std::fs::read_to_string(p)?;
    let file: SceneFile = serde_json::from_str(&data).map_err(|e| {
        AppError::InvalidProjectFormat(format!("Invalid scene file: {}", e))
    })?;
    Ok(file.document)
}
