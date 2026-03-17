import { describe, it, expect, afterEach } from 'vitest';
import { loadAiSettings, saveAiSettings, getAiSettingsDefaults, formatModelSize } from './aiSettings';

afterEach(() => {
  localStorage.clear();
});

describe('aiSettings', () => {
  it('returns defaults when nothing stored', () => {
    const settings = loadAiSettings();
    expect(settings.ollamaEndpoint).toBe('http://localhost:11434');
    expect(settings.comfyuiEndpoint).toBe('http://localhost:8188');
    expect(settings.ollamaTextModel).toBe('qwen2.5:14b');
    expect(settings.ollamaVisionModel).toBe('llava:13b');
  });

  it('persists and loads changes', () => {
    saveAiSettings({ ollamaEndpoint: 'http://myhost:11434' });
    const loaded = loadAiSettings();
    expect(loaded.ollamaEndpoint).toBe('http://myhost:11434');
    expect(loaded.comfyuiEndpoint).toBe('http://localhost:8188'); // unchanged
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('glyphstudio_ai_settings', 'not-json');
    const settings = loadAiSettings();
    expect(settings).toEqual(getAiSettingsDefaults());
  });

  it('ignores invalid typed fields', () => {
    localStorage.setItem('glyphstudio_ai_settings', JSON.stringify({
      ollamaEndpoint: 42,
      comfyuiEndpoint: null,
    }));
    const settings = loadAiSettings();
    expect(settings.ollamaEndpoint).toBe('http://localhost:11434');
    expect(settings.comfyuiEndpoint).toBe('http://localhost:8188');
  });

  it('merges partial saves', () => {
    saveAiSettings({ ollamaTextModel: 'llama3:8b' });
    saveAiSettings({ ollamaVisionModel: 'moondream' });
    const loaded = loadAiSettings();
    expect(loaded.ollamaTextModel).toBe('llama3:8b');
    expect(loaded.ollamaVisionModel).toBe('moondream');
  });
});

describe('formatModelSize', () => {
  it('formats GB values', () => {
    expect(formatModelSize(9_000_000_000)).toBe('8.4 GB');
  });

  it('formats MB values', () => {
    expect(formatModelSize(500_000_000)).toBe('477 MB');
  });

  it('returns unknown for 0', () => {
    expect(formatModelSize(0)).toBe('unknown');
  });
});
