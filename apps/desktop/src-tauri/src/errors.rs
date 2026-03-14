use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    #[error("Invalid project format: {0}")]
    InvalidProjectFormat(String),

    #[error("Save failed: {0}")]
    SaveFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        #[derive(Serialize)]
        struct ErrorPayload {
            code: String,
            message: String,
        }

        let (code, message) = match self {
            AppError::ProjectNotFound(m) => ("project/not_found".to_string(), m.clone()),
            AppError::InvalidProjectFormat(m) => ("project/invalid_format".to_string(), m.clone()),
            AppError::SaveFailed(m) => ("project/save_failed".to_string(), m.clone()),
            AppError::Io(e) => ("internal/io".to_string(), e.to_string()),
            AppError::Serde(e) => ("internal/serde".to_string(), e.to_string()),
            AppError::Internal(m) => ("internal/unexpected".to_string(), m.clone()),
        };

        ErrorPayload { code, message }.serialize(serializer)
    }
}
