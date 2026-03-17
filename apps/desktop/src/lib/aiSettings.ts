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
