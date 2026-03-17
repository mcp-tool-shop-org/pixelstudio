import { describe, it, expect, afterEach } from 'vitest';
import { loadAiSettings, saveAiSettings, getAiSettingsDefaults, formatModelSize, getCanvasContext, type CanvasContext } from './aiSettings';
import { mockInvoke } from '../test/setup';

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

describe('getCanvasContext', () => {
  afterEach(() => {
    mockInvoke.reset();
  });

  it('calls ai_get_canvas_context with includeSnapshot', async () => {
    const mockContext: CanvasContext = {
      document: {
        width: 32,
        height: 32,
        activeFrameName: 'Frame 1',
        activeLayerName: 'Layer 1',
        packageName: 'test-project',
      },
      layers: [
        { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 1.0, zIndex: 0 },
        { id: 'layer-bg', name: 'Background', visible: true, locked: true, opacity: 0.5, zIndex: 1 },
      ],
      selection: null,
      animation: {
        frameCount: 3,
        activeFrameIndex: 0,
        frames: [
          { id: 'frame-1', name: 'Frame 1', durationMs: null },
          { id: 'frame-2', name: 'Frame 2', durationMs: 200 },
          { id: 'frame-3', name: 'Frame 3', durationMs: null },
        ],
      },
      history: {
        canUndo: true,
        canRedo: false,
        undoDepth: 5,
        redoDepth: 0,
        recentTools: ['brush', 'eraser', 'brush'],
      },
      snapshotBase64: 'iVBORw0KGgo=',
    };

    mockInvoke.on('ai_get_canvas_context', () => mockContext);

    const result = await getCanvasContext(true);
    expect(result.document.width).toBe(32);
    expect(result.document.height).toBe(32);
    expect(result.layers).toHaveLength(2);
    expect(result.animation.frameCount).toBe(3);
    expect(result.history.canUndo).toBe(true);
    expect(result.snapshotBase64).toBeTruthy();
  });

  it('returns null snapshot when includeSnapshot is false', async () => {
    const mockContext: CanvasContext = {
      document: { width: 16, height: 16, activeFrameName: 'Frame 1', activeLayerName: null, packageName: '' },
      layers: [],
      selection: null,
      animation: { frameCount: 1, activeFrameIndex: 0, frames: [{ id: 'frame-1', name: 'Frame 1', durationMs: null }] },
      history: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0, recentTools: [] },
      snapshotBase64: null,
    };

    mockInvoke.on('ai_get_canvas_context', () => mockContext);

    const result = await getCanvasContext(false);
    expect(result.snapshotBase64).toBeNull();
  });

  it('includes selection when present', async () => {
    const mockContext: CanvasContext = {
      document: { width: 32, height: 32, activeFrameName: 'Frame 1', activeLayerName: 'Layer 1', packageName: '' },
      layers: [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 1.0, zIndex: 0 }],
      selection: { x: 5, y: 10, width: 20, height: 15 },
      animation: { frameCount: 1, activeFrameIndex: 0, frames: [{ id: 'frame-1', name: 'Frame 1', durationMs: null }] },
      history: { canUndo: false, canRedo: false, undoDepth: 0, redoDepth: 0, recentTools: [] },
      snapshotBase64: null,
    };

    mockInvoke.on('ai_get_canvas_context', () => mockContext);

    const result = await getCanvasContext(false);
    expect(result.selection).not.toBeNull();
    expect(result.selection!.x).toBe(5);
    expect(result.selection!.width).toBe(20);
  });
});
