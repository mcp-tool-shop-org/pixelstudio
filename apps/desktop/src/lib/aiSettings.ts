import { invoke } from '@tauri-apps/api/core';

const STORAGE_KEY = 'glyphstudio_ai_settings';

export interface AiServiceStatus {
  available: boolean;
  endpoint: string;
  version: string | null;
  error: string | null;
}

export interface OllamaModel {
  name: string;
  size: number;
  parameter_size: string | null;
  quantization: string | null;
}

export interface OllamaModelList {
  models: OllamaModel[];
  endpoint: string;
}

export interface AiSettings {
  ollamaEndpoint: string;
  comfyuiEndpoint: string;
  ollamaTextModel: string;
  ollamaVisionModel: string;
}

const DEFAULTS: AiSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  comfyuiEndpoint: 'http://localhost:8188',
  ollamaTextModel: 'qwen2.5:14b',
  ollamaVisionModel: 'llava:13b',
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      ollamaEndpoint: typeof parsed.ollamaEndpoint === 'string' ? parsed.ollamaEndpoint : DEFAULTS.ollamaEndpoint,
      comfyuiEndpoint: typeof parsed.comfyuiEndpoint === 'string' ? parsed.comfyuiEndpoint : DEFAULTS.comfyuiEndpoint,
      ollamaTextModel: typeof parsed.ollamaTextModel === 'string' ? parsed.ollamaTextModel : DEFAULTS.ollamaTextModel,
      ollamaVisionModel: typeof parsed.ollamaVisionModel === 'string' ? parsed.ollamaVisionModel : DEFAULTS.ollamaVisionModel,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAiSettings(settings: Partial<AiSettings>): void {
  try {
    const current = loadAiSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* localStorage unavailable */
  }
}

export function getAiSettingsDefaults(): AiSettings {
  return { ...DEFAULTS };
}

export async function checkOllamaStatus(endpoint: string): Promise<AiServiceStatus> {
  return invoke<AiServiceStatus>('ai_ollama_status', { endpoint });
}

export async function checkComfyuiStatus(endpoint: string): Promise<AiServiceStatus> {
  return invoke<AiServiceStatus>('ai_comfyui_status', { endpoint });
}

export async function fetchOllamaModels(endpoint: string): Promise<OllamaModelList> {
  return invoke<OllamaModelList>('ai_ollama_models', { endpoint });
}

export function formatModelSize(bytes: number): string {
  if (bytes === 0) return 'unknown';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

// ---------- ComfyUI generation ----------

export interface ComfyUIQueueResult {
  prompt_id: string;
}

export interface ComfyUIOutputImage {
  filename: string;
  subfolder: string;
  image_type: string;
}

export interface ComfyUIJobStatus {
  prompt_id: string;
  done: boolean;
  images: ComfyUIOutputImage[];
  error: string | null;
}

export interface ComfyUIImageData {
  base64_png: string;
  width: number;
  height: number;
}

export async function comfyuiGenerate(endpoint: string, workflowJson: string): Promise<ComfyUIQueueResult> {
  return invoke<ComfyUIQueueResult>('ai_comfyui_generate', { endpoint, workflowJson });
}

export async function comfyuiPoll(endpoint: string, promptId: string): Promise<ComfyUIJobStatus> {
  return invoke<ComfyUIJobStatus>('ai_comfyui_poll', { endpoint, promptId });
}

export async function comfyuiFetchImage(
  endpoint: string,
  filename: string,
  subfolder: string,
  imageType: string,
): Promise<ComfyUIImageData> {
  return invoke<ComfyUIImageData>('ai_comfyui_fetch_image', { endpoint, filename, subfolder, imageType });
}

/**
 * Poll ComfyUI until the job is done or timeout is reached.
 * Returns the final status.
 */
export async function comfyuiWaitForCompletion(
  endpoint: string,
  promptId: string,
  pollIntervalMs: number = 2000,
  timeoutMs: number = 120000,
  onProgress?: (status: ComfyUIJobStatus) => void,
): Promise<ComfyUIJobStatus> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await comfyuiPoll(endpoint, promptId);
    onProgress?.(status);
    if (status.done) return status;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return { prompt_id: promptId, done: false, images: [], error: 'Timeout waiting for ComfyUI' };
}
