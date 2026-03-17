use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::engine::canvas_state::ManagedCanvasState;
use crate::engine::selection::ManagedSelectionState;
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

#[derive(Deserialize)]
struct ComfyUISystemStats {
    system: Option<ComfyUISystem>,
}

#[derive(Deserialize)]
struct ComfyUISystem {
    comfyui_version: Option<String>,
}

// ---------- ComfyUI generation types ----------

#[derive(Debug, Serialize)]
pub struct ComfyUIQueueResult {
    pub prompt_id: String,
}

#[derive(Debug, Serialize)]
pub struct ComfyUIJobStatus {
    pub prompt_id: String,
    pub done: bool,
    pub images: Vec<ComfyUIOutputImage>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ComfyUIOutputImage {
    pub filename: String,
    pub subfolder: String,
    pub image_type: String,
}

#[derive(Debug, Serialize)]
pub struct ComfyUIImageData {
    pub base64_png: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Deserialize)]
struct ComfyUIPromptResponse {
    prompt_id: Option<String>,
}

#[derive(Deserialize)]
struct ComfyUIHistoryEntry {
    status: Option<ComfyUIHistoryStatus>,
    outputs: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct ComfyUIHistoryStatus {
    completed: Option<bool>,
    status_str: Option<String>,
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

// ---------- ComfyUI Generation Commands ----------

/// Queue a ComfyUI workflow for execution.
/// `workflow_json` is the full API-format workflow JSON string.
#[command]
pub async fn ai_comfyui_generate(
    endpoint: String,
    workflow_json: String,
) -> Result<ComfyUIQueueResult, AppError> {
    let url = format!("{}/prompt", endpoint.trim_end_matches('/'));

    // Validate that the workflow is valid JSON
    let workflow: serde_json::Value = serde_json::from_str(&workflow_json)
        .map_err(|e| AppError::Internal(format!("Invalid workflow JSON: {e}")))?;

    let payload = serde_json::json!({ "prompt": workflow });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {e}")))?;

    let resp = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ComfyUI unreachable: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "ComfyUI returned HTTP {status}: {body}"
        )));
    }

    let body: ComfyUIPromptResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Invalid ComfyUI response: {e}")))?;

    let prompt_id = body
        .prompt_id
        .ok_or_else(|| AppError::Internal("ComfyUI returned no prompt_id".into()))?;

    Ok(ComfyUIQueueResult { prompt_id })
}

/// Poll ComfyUI for the status of a queued prompt.
/// Returns done=true when images are ready.
#[command]
pub async fn ai_comfyui_poll(
    endpoint: String,
    prompt_id: String,
) -> Result<ComfyUIJobStatus, AppError> {
    let url = format!(
        "{}/history/{}",
        endpoint.trim_end_matches('/'),
        prompt_id
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {e}")))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ComfyUI unreachable: {e}")))?;

    if !resp.status().is_success() {
        return Ok(ComfyUIJobStatus {
            prompt_id,
            done: false,
            images: vec![],
            error: Some(format!("HTTP {}", resp.status())),
        });
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Invalid response: {e}")))?;

    // ComfyUI returns { "<prompt_id>": { status, outputs } }
    let entry = match body.get(&prompt_id) {
        Some(v) => v,
        None => {
            // Not in history yet — still queued or running
            return Ok(ComfyUIJobStatus {
                prompt_id,
                done: false,
                images: vec![],
                error: None,
            });
        }
    };

    let entry: ComfyUIHistoryEntry = serde_json::from_value(entry.clone())
        .map_err(|e| AppError::Internal(format!("Failed to parse history entry: {e}")))?;

    let completed = entry
        .status
        .as_ref()
        .and_then(|s| s.completed)
        .unwrap_or(false);

    let errored = entry
        .status
        .as_ref()
        .and_then(|s| s.status_str.as_deref())
        .map(|s| s == "error")
        .unwrap_or(false);

    if errored {
        return Ok(ComfyUIJobStatus {
            prompt_id,
            done: true,
            images: vec![],
            error: Some("ComfyUI reported an error for this prompt".into()),
        });
    }

    if !completed {
        return Ok(ComfyUIJobStatus {
            prompt_id,
            done: false,
            images: vec![],
            error: None,
        });
    }

    // Extract output images from all nodes
    let mut images = Vec::new();
    if let Some(outputs) = &entry.outputs {
        if let Some(obj) = outputs.as_object() {
            for (_node_id, node_output) in obj {
                if let Some(imgs) = node_output.get("images") {
                    if let Some(arr) = imgs.as_array() {
                        for img in arr {
                            if let (Some(filename), Some(subfolder), Some(img_type)) = (
                                img.get("filename").and_then(|v| v.as_str()),
                                img.get("subfolder").and_then(|v| v.as_str()),
                                img.get("type").and_then(|v| v.as_str()),
                            ) {
                                images.push(ComfyUIOutputImage {
                                    filename: filename.to_string(),
                                    subfolder: subfolder.to_string(),
                                    image_type: img_type.to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(ComfyUIJobStatus {
        prompt_id,
        done: true,
        images,
        error: None,
    })
}

/// Fetch a generated image from ComfyUI and return it as base64-encoded PNG.
#[command]
pub async fn ai_comfyui_fetch_image(
    endpoint: String,
    filename: String,
    subfolder: String,
    image_type: String,
) -> Result<ComfyUIImageData, AppError> {
    let url = format!(
        "{}/view?filename={}&subfolder={}&type={}",
        endpoint.trim_end_matches('/'),
        urlencoding(&filename),
        urlencoding(&subfolder),
        urlencoding(&image_type),
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {e}")))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ComfyUI unreachable: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "ComfyUI returned HTTP {} fetching image",
            resp.status()
        )));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read image bytes: {e}")))?;

    // Decode PNG to get dimensions
    let decoder = png::Decoder::new(std::io::Cursor::new(&bytes));
    let reader = decoder
        .read_info()
        .map_err(|e| AppError::Internal(format!("Invalid PNG: {e}")))?;
    let info = reader.info();
    let width = info.width;
    let height = info.height;

    let base64_png = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &bytes,
    );

    Ok(ComfyUIImageData {
        base64_png,
        width,
        height,
    })
}

/// Simple percent-encoding for URL query params.
fn urlencoding(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u32),
        })
        .collect()
}

// ---------- Ollama Chat (Stage 48) ----------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaChatResponse {
    pub content: String,
    pub tool_calls: Vec<serde_json::Value>,
    pub done: bool,
    pub total_duration_ns: Option<u64>,
}

/// Send a chat message to Ollama with optional tool definitions.
/// Returns the assistant's response including any tool calls.
#[command]
pub async fn ai_ollama_chat(
    endpoint: String,
    model: String,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
) -> Result<OllamaChatResponse, AppError> {
    let url = format!("{}/api/chat", endpoint.trim_end_matches('/'));

    let mut payload = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": false,
    });

    if let Some(tools) = tools {
        if !tools.is_empty() {
            payload["tools"] = serde_json::Value::Array(tools);
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {e}")))?;

    let resp = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Ollama unreachable: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Ollama returned HTTP {status}: {body}"
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Invalid Ollama response: {e}")))?;

    let message = body.get("message").cloned().unwrap_or(serde_json::json!({}));
    let content = message
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let tool_calls = message
        .get("tool_calls")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let done = body.get("done").and_then(|v| v.as_bool()).unwrap_or(true);
    let total_duration_ns = body
        .get("total_duration")
        .and_then(|v| v.as_u64());

    Ok(OllamaChatResponse {
        content,
        tool_calls,
        done,
        total_duration_ns,
    })
}

// ---------- Canvas Context Assembly (Stage 46) ----------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasContext {
    pub document: DocumentMeta,
    pub layers: Vec<ContextLayer>,
    pub selection: Option<SelectionInfo>,
    pub animation: AnimationInfo,
    pub history: HistoryInfo,
    pub snapshot_base64: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentMeta {
    pub width: u32,
    pub height: u32,
    pub active_frame_name: String,
    pub active_layer_name: Option<String>,
    pub package_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextLayer {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f32,
    pub z_index: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionInfo {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimationInfo {
    pub frame_count: usize,
    pub active_frame_index: usize,
    pub frames: Vec<FrameInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameInfo {
    pub id: String,
    pub name: String,
    pub duration_ms: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryInfo {
    pub can_undo: bool,
    pub can_redo: bool,
    pub undo_depth: usize,
    pub redo_depth: usize,
    pub recent_tools: Vec<String>,
}

/// Encode raw RGBA pixel data as a PNG and return base64.
fn rgba_to_base64_png(data: &[u8], width: u32, height: u32) -> Result<String, AppError> {
    let mut buf = Vec::new();
    {
        let mut encoder = png::Encoder::new(std::io::Cursor::new(&mut buf), width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder
            .write_header()
            .map_err(|e| AppError::Internal(format!("PNG header error: {e}")))?;
        writer
            .write_image_data(data)
            .map_err(|e| AppError::Internal(format!("PNG write error: {e}")))?;
    }
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &buf,
    ))
}

/// Assemble the full canvas context for LLM consumption.
/// Returns structured metadata + optional base64 PNG snapshot of the current frame.
#[command]
pub fn ai_get_canvas_context(
    include_snapshot: bool,
    canvas_state: State<'_, ManagedCanvasState>,
    selection_state: State<'_, ManagedSelectionState>,
) -> Result<CanvasContext, AppError> {
    let guard = canvas_state.0.lock().unwrap();
    let canvas = guard
        .as_ref()
        .ok_or_else(|| AppError::Internal("No canvas initialized".into()))?;

    let sel_guard = selection_state.0.lock().unwrap();

    // Document meta
    let active_layer_name = canvas.active_layer_id.as_ref().and_then(|lid| {
        canvas.layers.iter().find(|l| &l.id == lid).map(|l| l.name.clone())
    });

    let document = DocumentMeta {
        width: canvas.width,
        height: canvas.height,
        active_frame_name: canvas.active_frame_name().to_string(),
        active_layer_name,
        package_name: canvas.package_metadata.package_name.clone(),
    };

    // Layers (bottom-to-top z-order)
    let layers: Vec<ContextLayer> = canvas
        .layers
        .iter()
        .enumerate()
        .map(|(i, l)| ContextLayer {
            id: l.id.clone(),
            name: l.name.clone(),
            visible: l.visible,
            locked: l.locked,
            opacity: l.opacity,
            z_index: i,
        })
        .collect();

    // Selection
    let selection = sel_guard.selection.as_ref().map(|s| SelectionInfo {
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
    });

    // Animation
    let frames: Vec<FrameInfo> = canvas
        .frames
        .iter()
        .enumerate()
        .map(|(i, f)| {
            let name = if i == canvas.active_frame_index {
                canvas.active_frame_name().to_string()
            } else {
                f.name.clone()
            };
            FrameInfo {
                id: f.id.clone(),
                name,
                duration_ms: f.duration_ms,
            }
        })
        .collect();

    let animation = AnimationInfo {
        frame_count: canvas.frames.len(),
        active_frame_index: canvas.active_frame_index,
        frames,
    };

    // History — extract last 10 unique tool names from undo stack
    let recent_tools: Vec<String> = canvas
        .undo_stack
        .iter()
        .rev()
        .take(10)
        .map(|s| s.tool.clone())
        .collect();

    let history = HistoryInfo {
        can_undo: !canvas.undo_stack.is_empty(),
        can_redo: !canvas.redo_stack.is_empty(),
        undo_depth: canvas.undo_stack.len(),
        redo_depth: canvas.redo_stack.len(),
        recent_tools,
    };

    // Visual snapshot
    let snapshot_base64 = if include_snapshot {
        let frame_data = canvas.composite_frame();
        Some(rgba_to_base64_png(&frame_data, canvas.width, canvas.height)?)
    } else {
        None
    };

    Ok(CanvasContext {
        document,
        layers,
        selection,
        animation,
        history,
        snapshot_base64,
    })
}
