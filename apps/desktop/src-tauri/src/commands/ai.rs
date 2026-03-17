use serde::Serialize;
use tauri::command;

use crate::errors::AppError;

// ---------- Response types ----------

#[derive(Debug, Serialize)]
pub struct AiServiceStatus {
    pub available: bool,
    pub endpoint: String,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub parameter_size: Option<String>,
    pub quantization: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OllamaModelList {
    pub models: Vec<OllamaModel>,
    pub endpoint: String,
}

// ---------- Ollama API response shapes ----------

#[derive(serde::Deserialize)]
struct OllamaVersionResponse {
    version: Option<String>,
}

#[derive(serde::Deserialize)]
struct OllamaTagsResponse {
    models: Option<Vec<OllamaTagModel>>,
}

#[derive(serde::Deserialize)]
struct OllamaTagModel {
    name: Option<String>,
    size: Option<u64>,
    details: Option<OllamaTagDetails>,
}

#[derive(serde::Deserialize)]
struct OllamaTagDetails {
    parameter_size: Option<String>,
    quantization_level: Option<String>,
}

// ---------- ComfyUI API response shapes ----------

#[derive(serde::Deserialize)]
struct ComfyUISystemStats {
    system: Option<ComfyUISystem>,
}

#[derive(serde::Deserialize)]
struct ComfyUISystem {
    comfyui_version: Option<String>,
}

// ---------- Commands ----------

#[command]
pub async fn ai_ollama_status(endpoint: String) -> Result<AiServiceStatus, AppError> {
    let url = format!("{}/api/version", endpoint.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {e}")))?;

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body: OllamaVersionResponse = resp
                .json()
                .await
                .unwrap_or(OllamaVersionResponse { version: None });
            Ok(AiServiceStatus {
                available: true,
                endpoint,
                version: body.version,
                error: None,
            })
        }
        Ok(resp) => Ok(AiServiceStatus {
            available: false,
            endpoint,
            version: None,
            error: Some(format!("HTTP {}", resp.status())),
        }),
        Err(e) => Ok(AiServiceStatus {
            available: false,
            endpoint,
            version: None,
            error: Some(e.to_string()),
        }),
    }
}

#[command]
pub async fn ai_comfyui_status(endpoint: String) -> Result<AiServiceStatus, AppError> {
    let url = format!("{}/system_stats", endpoint.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {e}")))?;

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let body: ComfyUISystemStats = resp
                .json()
                .await
                .unwrap_or(ComfyUISystemStats { system: None });
            let version = body.system.and_then(|s| s.comfyui_version);
            Ok(AiServiceStatus {
                available: true,
                endpoint,
                version,
                error: None,
            })
        }
        Ok(resp) => Ok(AiServiceStatus {
            available: false,
            endpoint,
            version: None,
            error: Some(format!("HTTP {}", resp.status())),
        }),
        Err(e) => Ok(AiServiceStatus {
            available: false,
            endpoint,
            version: None,
            error: Some(e.to_string()),
        }),
    }
}

#[command]
pub async fn ai_ollama_models(endpoint: String) -> Result<OllamaModelList, AppError> {
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {e}")))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama unreachable: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "Ollama returned HTTP {}",
            resp.status()
        )));
    }

    let body: OllamaTagsResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Invalid Ollama response: {e}")))?;

    let models = body
        .models
        .unwrap_or_default()
        .into_iter()
        .map(|m| {
            let details = m.details.unwrap_or(OllamaTagDetails {
                parameter_size: None,
                quantization_level: None,
            });
            OllamaModel {
                name: m.name.unwrap_or_default(),
                size: m.size.unwrap_or(0),
                parameter_size: details.parameter_size,
                quantization: details.quantization_level,
            }
        })
        .collect();

    Ok(OllamaModelList {
        models,
        endpoint,
    })
}
