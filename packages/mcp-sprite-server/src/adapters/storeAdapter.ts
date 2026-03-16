/**
 * Headless store adapter — creates standalone Zustand store instances
 * that the MCP server can drive without React or a browser.
 *
 * Each session gets its own store instance via createHeadlessStore().
 * The adapter wraps the same store logic that the desktop app uses,
 * ensuring MCP tools call real domain/state logic.
 */

import { createStore } from 'zustand/vanilla';
import type {
  SpriteDocument,
  SpritePixelBuffer,
  SpriteToolConfig,
  SpriteOnionSkin,
  SpriteSelectionRect,
  SpriteSheetMeta,
  SpriteToolId,
  SpriteBrushShape,
} from '@glyphstudio/domain';
import {
  createSpriteDocument,
  createSpriteFrame,
  createSpriteLayer,
  createBlankPixelBuffer,
  createDefaultSpriteEditorState,
  DEFAULT_SPRITE_TOOL_CONFIG,
  DEFAULT_SPRITE_ONION_SKIN,
} from '@glyphstudio/domain';
import {
  clonePixelBuffer,
  clearSelectionArea,
  flipBufferHorizontal,
  flipBufferVertical,
  flattenLayers,
} from '@glyphstudio/state';
import {
  sliceSpriteSheet,
  assembleSpriteSheet,
  isImportExportError,
} from '@glyphstudio/state';
import { generateSpriteSheetMeta, encodeAnimatedGif } from '@glyphstudio/state';
import { serializeSpriteFile, deserializeSpriteFile } from '@glyphstudio/state';

// ── State shape (mirrors SpriteEditorStoreState but without React hooks) ──

export interface HeadlessStoreState {
  document: SpriteDocument | null;
  pixelBuffers: Record<string, SpritePixelBuffer>;
  activeLayerId: string | null;
  filePath: string | null;
  activeFrameIndex: number;
  tool: SpriteToolConfig;
  onionSkin: SpriteOnionSkin;
  zoom: number;
  panX: number;
  panY: number;
  dirty: boolean;
  showGrid: boolean;
  selectionRect: SpriteSelectionRect | null;
  selectionBuffer: SpritePixelBuffer | null;
  clipboardBuffer: SpritePixelBuffer | null;
  isPlaying: boolean;
  isLooping: boolean;
  previewFrameIndex: number;
}

export type HeadlessStore = ReturnType<typeof createHeadlessStore>;

/**
 * Create a standalone Zustand store instance for headless (non-React) use.
 * This mirrors the spriteEditorStore logic exactly.
 */
export function createHeadlessStore() {
  return createStore<HeadlessStoreState>()((set, get) => ({
    document: null,
    pixelBuffers: {},
    activeLayerId: null,
    filePath: null,
    selectionRect: null,
    selectionBuffer: null,
    clipboardBuffer: null,
    showGrid: true,
    isPlaying: false,
    isLooping: true,
    previewFrameIndex: 0,
    ...createDefaultSpriteEditorState(),
  }));
}

// ── Imperative operations on a headless store ──

export function storeNewDocument(store: HeadlessStore, name: string, width: number, height: number): void {
  const doc = createSpriteDocument(name, width, height);
  const firstFrame = doc.frames[0];
  const firstLayer = firstFrame.layers[0];
  const buffer = createBlankPixelBuffer(width, height);
  store.setState({
    document: doc,
    pixelBuffers: { [firstLayer.id]: buffer },
    activeLayerId: firstLayer.id,
    filePath: null,
    activeFrameIndex: 0,
    tool: { ...DEFAULT_SPRITE_TOOL_CONFIG },
    onionSkin: { ...DEFAULT_SPRITE_ONION_SKIN },
    selectionRect: null,
    selectionBuffer: null,
    clipboardBuffer: null,
    isPlaying: false,
    isLooping: true,
    previewFrameIndex: 0,
    zoom: 8,
    panX: 0,
    panY: 0,
    dirty: false,
  });
}

export function storeCloseDocument(store: HeadlessStore): void {
  store.setState({
    document: null,
    pixelBuffers: {},
    activeLayerId: null,
    filePath: null,
    selectionRect: null,
    selectionBuffer: null,
    clipboardBuffer: null,
    isPlaying: false,
    isLooping: true,
    previewFrameIndex: 0,
    ...createDefaultSpriteEditorState(),
  });
}

export function storeLoadDocument(store: HeadlessStore, json: string, filePath: string): string | null {
  const result = deserializeSpriteFile(json);
  if ('error' in result) return result.error;

  const { document: doc, pixelBuffers } = result;
  const firstFrame = doc.frames[0];
  const firstLayer = firstFrame?.layers[0];

  store.setState({
    document: doc,
    pixelBuffers,
    activeLayerId: firstLayer?.id ?? null,
    filePath,
    activeFrameIndex: 0,
    tool: { ...DEFAULT_SPRITE_TOOL_CONFIG },
    onionSkin: { ...DEFAULT_SPRITE_ONION_SKIN },
    selectionRect: null,
    selectionBuffer: null,
    clipboardBuffer: null,
    isPlaying: false,
    isLooping: true,
    previewFrameIndex: 0,
    zoom: 8,
    panX: 0,
    panY: 0,
    dirty: false,
  });
  return null;
}

export function storeSaveDocument(store: HeadlessStore): { json: string } | { error: string } {
  const { document: doc, pixelBuffers } = store.getState();
  if (!doc) return { error: 'No document open' };

  try {
    const json = serializeSpriteFile(doc, pixelBuffers);
    store.setState({ dirty: false });
    return { json };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to serialize' };
  }
}

export function storeGetDocumentSummary(store: HeadlessStore): DocumentSummary | null {
  const state = store.getState();
  const doc = state.document;
  if (!doc) return null;

  return {
    id: doc.id,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    frameCount: doc.frames.length,
    frames: doc.frames.map((f) => ({
      id: f.id,
      index: f.index,
      durationMs: f.durationMs,
      layerCount: f.layers.length,
      layers: f.layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        index: l.index,
      })),
    })),
    palette: {
      colorCount: doc.palette.colors.length,
      foregroundIndex: doc.palette.foregroundIndex,
      backgroundIndex: doc.palette.backgroundIndex,
    },
    activeFrameIndex: state.activeFrameIndex,
    activeLayerId: state.activeLayerId,
    dirty: state.dirty,
    filePath: state.filePath,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface DocumentSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  frameCount: number;
  frames: {
    id: string;
    index: number;
    durationMs: number;
    layerCount: number;
    layers: { id: string; name: string; visible: boolean; index: number }[];
  }[];
  palette: {
    colorCount: number;
    foregroundIndex: number;
    backgroundIndex: number;
  };
  activeFrameIndex: number;
  activeLayerId: string | null;
  dirty: boolean;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Frame operations ──

export function storeAddFrame(store: HeadlessStore): string | null {
  const { document: doc, pixelBuffers, activeFrameIndex } = store.getState();
  if (!doc) return 'No document open';

  const insertAt = activeFrameIndex + 1;
  const frame = createSpriteFrame(insertAt);
  const layer = frame.layers[0];
  const buffer = createBlankPixelBuffer(doc.width, doc.height);
  const updatedFrames = [
    ...doc.frames.slice(0, insertAt),
    frame,
    ...doc.frames.slice(insertAt),
  ].map((f, i) => ({ ...f, index: i }));

  store.setState({
    document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
    pixelBuffers: { ...pixelBuffers, [layer.id]: buffer },
    activeFrameIndex: insertAt,
    activeLayerId: layer.id,
    dirty: true,
  });
  return null;
}

export function storeRemoveFrame(store: HeadlessStore, frameId: string): string | null {
  const { document: doc, pixelBuffers, activeFrameIndex } = store.getState();
  if (!doc) return 'No document open';
  if (doc.frames.length <= 1) return 'Cannot remove the last frame';

  const frameIndex = doc.frames.findIndex((f) => f.id === frameId);
  if (frameIndex === -1) return `Frame not found: ${frameId}`;

  const removedFrame = doc.frames[frameIndex];
  const removedLayerIds = new Set(removedFrame.layers.map((l) => l.id));

  const updatedFrames = doc.frames
    .filter((f) => f.id !== frameId)
    .map((f, i) => ({ ...f, index: i }));

  const remainingBuffers: Record<string, SpritePixelBuffer> = {};
  for (const [key, buf] of Object.entries(pixelBuffers)) {
    if (!removedLayerIds.has(key)) remainingBuffers[key] = buf;
  }

  const newActiveIndex = Math.min(activeFrameIndex, updatedFrames.length - 1);
  const newActiveFrame = updatedFrames[newActiveIndex];

  store.setState({
    document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
    pixelBuffers: remainingBuffers,
    activeFrameIndex: newActiveIndex,
    activeLayerId: newActiveFrame?.layers[0]?.id ?? null,
    dirty: true,
  });
  return null;
}

export function storeSetActiveFrame(store: HeadlessStore, index: number): string | null {
  const { document: doc } = store.getState();
  if (!doc) return 'No document open';
  if (index < 0 || index >= doc.frames.length) return `Frame index out of range: ${index}`;
  const targetFrame = doc.frames[index];
  store.setState({ activeFrameIndex: index, activeLayerId: targetFrame?.layers[0]?.id ?? null });
  return null;
}

export function storeSetFrameDuration(store: HeadlessStore, frameId: string, durationMs: number): string | null {
  const { document: doc } = store.getState();
  if (!doc) return 'No document open';
  if (durationMs <= 0) return 'Duration must be positive';

  const frame = doc.frames.find((f) => f.id === frameId);
  if (!frame) return `Frame not found: ${frameId}`;

  const updatedFrames = doc.frames.map((f) => f.id === frameId ? { ...f, durationMs } : f);
  store.setState({
    document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
    dirty: true,
  });
  return null;
}

// ── Layer operations ──

export function storeAddLayer(store: HeadlessStore): string | null {
  const { document: doc, pixelBuffers, activeFrameIndex } = store.getState();
  if (!doc) return 'No document open';
  const frame = doc.frames[activeFrameIndex];
  if (!frame) return 'No active frame';

  const newLayer = createSpriteLayer(frame.layers.length);
  const updatedLayers = [...frame.layers, newLayer];
  const updatedFrame = { ...frame, layers: updatedLayers };
  const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

  store.setState({
    document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
    pixelBuffers: { ...pixelBuffers, [newLayer.id]: createBlankPixelBuffer(doc.width, doc.height) },
    activeLayerId: newLayer.id,
    dirty: true,
  });
  return null;
}

export function storeRemoveLayer(store: HeadlessStore, layerId: string): string | null {
  const { document: doc, pixelBuffers, activeFrameIndex, activeLayerId } = store.getState();
  if (!doc) return 'No document open';
  const frame = doc.frames[activeFrameIndex];
  if (!frame) return 'No active frame';
  if (frame.layers.length <= 1) return 'Cannot remove the last layer';

  const layerIndex = frame.layers.findIndex((l) => l.id === layerId);
  if (layerIndex === -1) return `Layer not found: ${layerId}`;

  const updatedLayers = frame.layers.filter((l) => l.id !== layerId).map((l, i) => ({ ...l, index: i }));
  const updatedFrame = { ...frame, layers: updatedLayers };
  const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

  const remainingBuffers: Record<string, SpritePixelBuffer> = {};
  for (const [key, buf] of Object.entries(pixelBuffers)) {
    if (key !== layerId) remainingBuffers[key] = buf;
  }

  const newActiveLayerId = activeLayerId === layerId
    ? updatedLayers[Math.min(layerIndex, updatedLayers.length - 1)]?.id ?? null
    : activeLayerId;

  store.setState({
    document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
    pixelBuffers: remainingBuffers,
    activeLayerId: newActiveLayerId,
    dirty: true,
  });
  return null;
}

export function storeSetActiveLayer(store: HeadlessStore, layerId: string): string | null {
  const { document: doc, activeFrameIndex } = store.getState();
  if (!doc) return 'No document open';
  const frame = doc.frames[activeFrameIndex];
  if (!frame) return 'No active frame';
  if (!frame.layers.some((l) => l.id === layerId)) return `Layer not found: ${layerId}`;
  store.setState({ activeLayerId: layerId });
  return null;
}

export function storeToggleLayerVisibility(store: HeadlessStore, layerId: string): string | null {
  const { document: doc, activeFrameIndex } = store.getState();
  if (!doc) return 'No document open';
  const frame = doc.frames[activeFrameIndex];
  if (!frame) return 'No active frame';
  if (!frame.layers.some((l) => l.id === layerId)) return `Layer not found: ${layerId}`;

  const updatedLayers = frame.layers.map((l) => l.id === layerId ? { ...l, visible: !l.visible } : l);
  const updatedFrame = { ...frame, layers: updatedLayers };
  const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

  store.setState({
    document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
    dirty: true,
  });
  return null;
}

export function storeRenameLayer(store: HeadlessStore, layerId: string, name: string): string | null {
  const { document: doc, activeFrameIndex } = store.getState();
  if (!doc) return 'No document open';
  if (!name.trim()) return 'Layer name cannot be empty';
  const frame = doc.frames[activeFrameIndex];
  if (!frame) return 'No active frame';
  if (!frame.layers.some((l) => l.id === layerId)) return `Layer not found: ${layerId}`;

  const updatedLayers = frame.layers.map((l) => l.id === layerId ? { ...l, name: name.trim() } : l);
  const updatedFrame = { ...frame, layers: updatedLayers };
  const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

  store.setState({
    document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
    dirty: true,
  });
  return null;
}

// ── Palette operations ──

export function storeSetForegroundColor(store: HeadlessStore, index: number): string | null {
  const { document: doc } = store.getState();
  if (!doc) return 'No document open';
  if (index < 0 || index >= doc.palette.colors.length) return `Color index out of range: ${index}`;
  store.setState({
    document: { ...doc, palette: { ...doc.palette, foregroundIndex: index } },
  });
  return null;
}

export function storeSetBackgroundColor(store: HeadlessStore, index: number): string | null {
  const { document: doc } = store.getState();
  if (!doc) return 'No document open';
  if (index < 0 || index >= doc.palette.colors.length) return `Color index out of range: ${index}`;
  store.setState({
    document: { ...doc, palette: { ...doc.palette, backgroundIndex: index } },
  });
  return null;
}

export function storeSwapColors(store: HeadlessStore): string | null {
  const { document: doc } = store.getState();
  if (!doc) return 'No document open';
  store.setState({
    document: {
      ...doc,
      palette: {
        ...doc.palette,
        foregroundIndex: doc.palette.backgroundIndex,
        backgroundIndex: doc.palette.foregroundIndex,
      },
    },
  });
  return null;
}

// ── Pixel operations ──

export function storeCommitPixels(store: HeadlessStore, layerId: string, buffer: SpritePixelBuffer): string | null {
  const { document: doc, pixelBuffers } = store.getState();
  if (!doc) return 'No document open';
  if (!pixelBuffers[layerId]) return `Layer not found: ${layerId}`;

  store.setState({
    pixelBuffers: { ...pixelBuffers, [layerId]: buffer },
    document: { ...doc, updatedAt: new Date().toISOString() },
    dirty: true,
  });
  return null;
}

// ── Export operations ──

export function storeExportSpriteSheet(store: HeadlessStore): SpritePixelBuffer | { error: string } {
  const { document: doc, pixelBuffers } = store.getState();
  if (!doc) return { error: 'No document open' };

  const frameBuffers = doc.frames.map((f) =>
    flattenLayers(f.layers, pixelBuffers, doc.width, doc.height),
  );
  const result = assembleSpriteSheet(frameBuffers);
  if (isImportExportError(result)) return { error: result.error };
  return result;
}

export function storeExportSheetWithMeta(store: HeadlessStore): { sheet: SpritePixelBuffer; meta: SpriteSheetMeta } | { error: string } {
  const { document: doc, pixelBuffers } = store.getState();
  if (!doc) return { error: 'No document open' };

  const frameBuffers = doc.frames.map((f) =>
    flattenLayers(f.layers, pixelBuffers, doc.width, doc.height),
  );
  const sheet = assembleSpriteSheet(frameBuffers);
  if (isImportExportError(sheet)) return { error: sheet.error };

  const meta = generateSpriteSheetMeta(doc);
  if ('error' in meta) return { error: meta.error };

  return { sheet, meta };
}

export function storeExportGif(store: HeadlessStore, loop = true): Uint8Array | { error: string } {
  const { document: doc, pixelBuffers } = store.getState();
  if (!doc) return { error: 'No document open' };

  const frameBuffers = doc.frames.map((f) =>
    flattenLayers(f.layers, pixelBuffers, doc.width, doc.height),
  );
  const durations = doc.frames.map((f) => f.durationMs);

  const result = encodeAnimatedGif(frameBuffers, durations, loop);
  if (result && typeof result === 'object' && 'error' in result) return { error: (result as { error: string }).error };
  return result as Uint8Array;
}
