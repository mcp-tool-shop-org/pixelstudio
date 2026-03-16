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
  setPixel,
  samplePixel,
  bresenhamLine,
  floodFill,
  extractSelection,
  blitSelection,
  isInBounds,
} from '@glyphstudio/state';
import type { Rgba } from '@glyphstudio/state';
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

// ── Drawing / raster operations ──

export interface PixelEntry { x: number; y: number; rgba: [number, number, number, number] }
export interface ChangedBounds { minX: number; minY: number; maxX: number; maxY: number; pixelCount: number }

/** Resolve the active layer buffer, returning an error string if anything is missing. */
function resolveActiveBuffer(store: HeadlessStore, layerId?: string): { buf: SpritePixelBuffer; id: string; doc: SpriteDocument } | { error: string } {
  const state = store.getState();
  if (!state.document) return { error: 'No document open' };
  const targetLayerId = layerId ?? state.activeLayerId;
  if (!targetLayerId) return { error: 'No active layer' };
  const buf = state.pixelBuffers[targetLayerId];
  if (!buf) return { error: `Layer buffer not found: ${targetLayerId}` };
  return { buf, id: targetLayerId, doc: state.document };
}

export function storeDrawPixels(store: HeadlessStore, pixels: PixelEntry[], layerId?: string): { bounds: ChangedBounds } | { error: string } {
  const resolved = resolveActiveBuffer(store, layerId);
  if ('error' in resolved) return resolved;
  const { buf, id, doc } = resolved;

  const updated = clonePixelBuffer(buf);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let count = 0;

  for (const p of pixels) {
    if (!isInBounds(p.x, p.y, updated.width, updated.height)) continue;
    setPixel(updated, p.x, p.y, p.rgba as Rgba);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    count++;
  }

  if (count === 0) return { bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, pixelCount: 0 } };

  store.setState({
    pixelBuffers: { ...store.getState().pixelBuffers, [id]: updated },
    document: { ...doc, updatedAt: new Date().toISOString() },
    dirty: true,
  });
  return { bounds: { minX, minY, maxX, maxY, pixelCount: count } };
}

export function storeDrawLine(store: HeadlessStore, x0: number, y0: number, x1: number, y1: number, rgba: Rgba, layerId?: string): { bounds: ChangedBounds } | { error: string } {
  const resolved = resolveActiveBuffer(store, layerId);
  if ('error' in resolved) return resolved;
  const { buf, id, doc } = resolved;

  const updated = clonePixelBuffer(buf);
  const points = bresenhamLine(x0, y0, x1, y1);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let count = 0;

  for (const [px, py] of points) {
    if (!isInBounds(px, py, updated.width, updated.height)) continue;
    setPixel(updated, px, py, rgba);
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
    count++;
  }

  store.setState({
    pixelBuffers: { ...store.getState().pixelBuffers, [id]: updated },
    document: { ...doc, updatedAt: new Date().toISOString() },
    dirty: true,
  });
  return { bounds: { minX: count ? minX : 0, minY: count ? minY : 0, maxX: count ? maxX : 0, maxY: count ? maxY : 0, pixelCount: count } };
}

export function storeFill(store: HeadlessStore, x: number, y: number, rgba: Rgba, layerId?: string): { error: string } | { filled: true } {
  const resolved = resolveActiveBuffer(store, layerId);
  if ('error' in resolved) return resolved;
  const { buf, id, doc } = resolved;

  if (!isInBounds(x, y, buf.width, buf.height)) return { error: `Coordinates out of bounds: (${x}, ${y})` };

  const updated = clonePixelBuffer(buf);
  floodFill(updated, x, y, rgba);

  store.setState({
    pixelBuffers: { ...store.getState().pixelBuffers, [id]: updated },
    document: { ...doc, updatedAt: new Date().toISOString() },
    dirty: true,
  });
  return { filled: true };
}

export function storeErasePixels(store: HeadlessStore, pixels: { x: number; y: number }[], layerId?: string): { bounds: ChangedBounds } | { error: string } {
  const entries: PixelEntry[] = pixels.map((p) => ({ x: p.x, y: p.y, rgba: [0, 0, 0, 0] as [number, number, number, number] }));
  return storeDrawPixels(store, entries, layerId);
}

export function storeSamplePixel(store: HeadlessStore, x: number, y: number, layerId?: string): { rgba: Rgba } | { error: string } {
  const resolved = resolveActiveBuffer(store, layerId);
  if ('error' in resolved) return resolved;
  const { buf } = resolved;

  if (!isInBounds(x, y, buf.width, buf.height)) return { error: `Coordinates out of bounds: (${x}, ${y})` };
  const color = samplePixel(buf, x, y);
  if (!color) return { error: 'Sample failed' };
  return { rgba: color };
}

// ── Selection / clipboard operations ──

export function storeSetSelection(store: HeadlessStore, rect: SpriteSelectionRect): string | null {
  const state = store.getState();
  if (!state.document) return 'No document open';
  if (!state.activeLayerId) return 'No active layer';

  const buf = state.pixelBuffers[state.activeLayerId];
  if (!buf) return 'No active layer buffer';

  const extracted = extractSelection(buf, rect);
  store.setState({ selectionRect: rect, selectionBuffer: extracted });
  return null;
}

export function storeClearSelection(store: HeadlessStore): void {
  store.setState({ selectionRect: null, selectionBuffer: null });
}

export function storeGetSelection(store: HeadlessStore): { rect: SpriteSelectionRect; width: number; height: number } | null {
  const state = store.getState();
  if (!state.selectionRect || !state.selectionBuffer) return null;
  return {
    rect: state.selectionRect,
    width: state.selectionBuffer.width,
    height: state.selectionBuffer.height,
  };
}

export function storeCopySelection(store: HeadlessStore): string | null {
  const { selectionBuffer } = store.getState();
  if (!selectionBuffer) return 'No selection';
  store.setState({ clipboardBuffer: clonePixelBuffer(selectionBuffer) });
  return null;
}

export function storeCutSelection(store: HeadlessStore): string | null {
  const state = store.getState();
  if (!state.selectionRect || !state.selectionBuffer) return 'No selection';
  if (!state.document || !state.activeLayerId) return 'No document open';

  const buf = state.pixelBuffers[state.activeLayerId];
  if (!buf) return 'No active layer buffer';

  const clipboard = clonePixelBuffer(state.selectionBuffer);
  const updated = clonePixelBuffer(buf);
  clearSelectionArea(updated, state.selectionRect);

  store.setState({
    clipboardBuffer: clipboard,
    pixelBuffers: { ...state.pixelBuffers, [state.activeLayerId]: updated },
    document: { ...state.document, updatedAt: new Date().toISOString() },
    selectionRect: null,
    selectionBuffer: null,
    dirty: true,
  });
  return null;
}

export function storePasteSelection(store: HeadlessStore): string | null {
  const { clipboardBuffer, document: doc } = store.getState();
  if (!clipboardBuffer) return 'Clipboard is empty';
  if (!doc) return 'No document open';

  const rect: SpriteSelectionRect = {
    x: 0,
    y: 0,
    width: clipboardBuffer.width,
    height: clipboardBuffer.height,
  };
  store.setState({
    selectionRect: rect,
    selectionBuffer: clonePixelBuffer(clipboardBuffer),
  });
  return null;
}

export function storeFlipSelectionHorizontal(store: HeadlessStore): string | null {
  const { selectionBuffer } = store.getState();
  if (!selectionBuffer) return 'No selection';
  store.setState({ selectionBuffer: flipBufferHorizontal(selectionBuffer) });
  return null;
}

export function storeFlipSelectionVertical(store: HeadlessStore): string | null {
  const { selectionBuffer } = store.getState();
  if (!selectionBuffer) return 'No selection';
  store.setState({ selectionBuffer: flipBufferVertical(selectionBuffer) });
  return null;
}

export function storeCommitSelection(store: HeadlessStore): string | null {
  const state = store.getState();
  if (!state.selectionRect || !state.selectionBuffer) return 'No selection';
  if (!state.document || !state.activeLayerId) return 'No document open';

  const buf = state.pixelBuffers[state.activeLayerId];
  if (!buf) return 'No active layer buffer';

  const updated = clonePixelBuffer(buf);
  blitSelection(updated, state.selectionBuffer, state.selectionRect.x, state.selectionRect.y);

  store.setState({
    pixelBuffers: { ...state.pixelBuffers, [state.activeLayerId]: updated },
    document: { ...state.document, updatedAt: new Date().toISOString() },
    selectionRect: null,
    selectionBuffer: null,
    dirty: true,
  });
  return null;
}

// ── Tool settings operations ──

export function storeSetTool(store: HeadlessStore, tool: SpriteToolId): string | null {
  const validTools: SpriteToolId[] = ['pencil', 'eraser', 'fill', 'eyedropper', 'select'];
  if (!validTools.includes(tool)) return `Invalid tool: ${tool}`;
  const state = store.getState();
  store.setState({ tool: { ...state.tool, activeTool: tool } });
  return null;
}

export function storeGetTool(store: HeadlessStore): SpriteToolConfig {
  return store.getState().tool;
}

export function storeSetBrushSize(store: HeadlessStore, size: number): string | null {
  if (size < 1) return 'Brush size must be at least 1';
  const state = store.getState();
  store.setState({ tool: { ...state.tool, brushSize: size } });
  return null;
}

export function storeSetBrushShape(store: HeadlessStore, shape: SpriteBrushShape): string | null {
  if (shape !== 'square' && shape !== 'circle') return `Invalid brush shape: ${shape}`;
  const state = store.getState();
  store.setState({ tool: { ...state.tool, brushShape: shape } });
  return null;
}

export function storeSetPixelPerfect(store: HeadlessStore, enabled: boolean): void {
  const state = store.getState();
  store.setState({ tool: { ...state.tool, pixelPerfect: enabled } });
}

export function storeSetOnionSkin(store: HeadlessStore, config: Partial<SpriteOnionSkin>): void {
  const state = store.getState();
  store.setState({ onionSkin: { ...state.onionSkin, ...config } });
}

export function storeGetOnionSkin(store: HeadlessStore): SpriteOnionSkin {
  return store.getState().onionSkin;
}

export function storeSetZoom(store: HeadlessStore, zoom: number): string | null {
  if (zoom < 1 || zoom > 64) return 'Zoom must be between 1 and 64';
  store.setState({ zoom });
  return null;
}

export function storeSetPan(store: HeadlessStore, x: number, y: number): void {
  store.setState({ panX: x, panY: y });
}

export function storeResetView(store: HeadlessStore): void {
  store.setState({ zoom: 8, panX: 0, panY: 0 });
}

// ── Playback — authored config ──

export interface PlaybackConfig {
  isLooping: boolean;
  frameDurations: { frameId: string; durationMs: number }[];
}

export function storeGetPlaybackConfig(store: HeadlessStore): PlaybackConfig | { error: string } {
  const { document: doc, isLooping } = store.getState();
  if (!doc) return { error: 'No document open' };
  return {
    isLooping,
    frameDurations: doc.frames.map((f) => ({ frameId: f.id, durationMs: f.durationMs })),
  };
}

export function storeSetPlaybackConfig(store: HeadlessStore, config: { isLooping?: boolean }): string | null {
  const { document: doc } = store.getState();
  if (!doc) return 'No document open';
  if (config.isLooping !== undefined) {
    store.setState({ isLooping: config.isLooping });
  }
  return null;
}

// ── Playback — transient preview ──

export interface PreviewState {
  isPlaying: boolean;
  previewFrameIndex: number;
  isLooping: boolean;
}

export function storeGetPreviewState(store: HeadlessStore): PreviewState {
  const state = store.getState();
  return {
    isPlaying: state.isPlaying,
    previewFrameIndex: state.previewFrameIndex,
    isLooping: state.isLooping,
  };
}

export function storePreviewPlay(store: HeadlessStore): string | null {
  const { document: doc } = store.getState();
  if (!doc) return 'No document open';
  if (doc.frames.length < 2) return 'Need at least 2 frames to play';
  store.setState({ isPlaying: true, previewFrameIndex: store.getState().activeFrameIndex });
  return null;
}

export function storePreviewStop(store: HeadlessStore): void {
  const { isPlaying, previewFrameIndex } = store.getState();
  if (!isPlaying) return;
  store.setState({ isPlaying: false, activeFrameIndex: previewFrameIndex });
}

export function storePreviewSetFrame(store: HeadlessStore, index: number): string | null {
  const { document: doc, isPlaying } = store.getState();
  if (!doc) return 'No document open';
  if (isPlaying) return 'Cannot scrub while playing';
  if (index < 0 || index >= doc.frames.length) return `Frame index out of range: ${index}`;
  store.setState({ activeFrameIndex: index, previewFrameIndex: index });
  return null;
}

export function storePreviewStepNext(store: HeadlessStore): string | null {
  const { document: doc, activeFrameIndex, isPlaying } = store.getState();
  if (!doc) return 'No document open';
  if (isPlaying) return 'Cannot step while playing';
  const next = activeFrameIndex + 1;
  if (next >= doc.frames.length) return 'Already at last frame';
  store.setState({ activeFrameIndex: next, previewFrameIndex: next });
  return null;
}

export function storePreviewStepPrev(store: HeadlessStore): string | null {
  const { document: doc, activeFrameIndex, isPlaying } = store.getState();
  if (!doc) return 'No document open';
  if (isPlaying) return 'Cannot step while playing';
  if (activeFrameIndex <= 0) return 'Already at first frame';
  const prev = activeFrameIndex - 1;
  store.setState({ activeFrameIndex: prev, previewFrameIndex: prev });
  return null;
}

// ── Render operations ──

export interface RenderedFrame {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  frameIndex: number;
  frameId: string;
}

/**
 * Flatten the active frame's visible layers into a single RGBA buffer.
 */
export function storeRenderFrame(store: HeadlessStore, frameIndex?: number): RenderedFrame | { error: string } {
  const { document: doc, pixelBuffers, activeFrameIndex } = store.getState();
  if (!doc) return { error: 'No document open' };

  const idx = frameIndex ?? activeFrameIndex;
  if (idx < 0 || idx >= doc.frames.length) return { error: `Frame index out of range: ${idx}` };

  const frame = doc.frames[idx];
  const flat = flattenLayers(frame.layers, pixelBuffers, doc.width, doc.height);
  return { width: flat.width, height: flat.height, rgba: flat.data, frameIndex: idx, frameId: frame.id };
}

/**
 * Render all frames and assemble into a horizontal sprite sheet RGBA buffer.
 */
export function storeRenderSheet(store: HeadlessStore): { width: number; height: number; rgba: Uint8ClampedArray; frameCount: number } | { error: string } {
  const { document: doc, pixelBuffers } = store.getState();
  if (!doc) return { error: 'No document open' };

  const frameBuffers = doc.frames.map((f) =>
    flattenLayers(f.layers, pixelBuffers, doc.width, doc.height),
  );
  const sheet = assembleSpriteSheet(frameBuffers);
  if (isImportExportError(sheet)) return { error: sheet.error };
  return { width: sheet.width, height: sheet.height, rgba: sheet.data, frameCount: doc.frames.length };
}

/**
 * Import a sprite sheet by slicing it into frames, replacing the current document frames.
 */
export function storeImportSheet(
  store: HeadlessStore,
  sheetData: Uint8ClampedArray,
  sheetWidth: number,
  sheetHeight: number,
  frameWidth: number,
  frameHeight: number,
): { frameCount: number } | { error: string } {
  const { document: doc } = store.getState();
  if (!doc) return { error: 'No document open' };

  if (frameWidth !== doc.width || frameHeight !== doc.height) {
    return { error: `Frame dimensions (${frameWidth}x${frameHeight}) must match document dimensions (${doc.width}x${doc.height})` };
  }

  const result = sliceSpriteSheet(sheetData, sheetWidth, sheetHeight, frameWidth, frameHeight);
  if (isImportExportError(result)) return { error: result.error };

  const newFrames = result.frames.map((buf, i) => {
    const frame = createSpriteFrame(i);
    return { frame, buffer: buf, layerId: frame.layers[0].id };
  });

  const newPixelBuffers: Record<string, SpritePixelBuffer> = {};
  const docFrames = newFrames.map(({ frame, buffer, layerId }) => {
    newPixelBuffers[layerId] = buffer;
    return frame;
  });

  store.setState({
    document: { ...doc, frames: docFrames, updatedAt: new Date().toISOString() },
    pixelBuffers: newPixelBuffers,
    activeFrameIndex: 0,
    activeLayerId: docFrames[0]?.layers[0]?.id ?? null,
    dirty: true,
  });

  return { frameCount: docFrames.length };
}

/**
 * Export metadata JSON for the current sprite sheet layout.
 */
export function storeExportMetadataJson(store: HeadlessStore): { json: string; meta: SpriteSheetMeta } | { error: string } {
  const { document: doc } = store.getState();
  if (!doc) return { error: 'No document open' };

  const meta = generateSpriteSheetMeta(doc);
  if ('error' in meta) return { error: meta.error };
  return { json: JSON.stringify(meta, null, 2), meta };
}

// ── Compact state snapshot ──

export interface SessionStateSummary {
  document: { id: string; name: string; width: number; height: number; frameCount: number } | null;
  activeFrameIndex: number;
  activeLayerId: string | null;
  tool: SpriteToolConfig;
  onionSkin: SpriteOnionSkin;
  selection: { rect: SpriteSelectionRect; width: number; height: number } | null;
  hasClipboard: boolean;
  playbackConfig: { isLooping: boolean };
  preview: PreviewState;
  dirty: boolean;
  zoom: number;
  panX: number;
  panY: number;
}

export function storeGetStateSummary(store: HeadlessStore): SessionStateSummary {
  const s = store.getState();
  return {
    document: s.document ? { id: s.document.id, name: s.document.name, width: s.document.width, height: s.document.height, frameCount: s.document.frames.length } : null,
    activeFrameIndex: s.activeFrameIndex,
    activeLayerId: s.activeLayerId,
    tool: s.tool,
    onionSkin: s.onionSkin,
    selection: s.selectionRect && s.selectionBuffer ? { rect: s.selectionRect, width: s.selectionBuffer.width, height: s.selectionBuffer.height } : null,
    hasClipboard: s.clipboardBuffer !== null,
    playbackConfig: { isLooping: s.isLooping },
    preview: { isPlaying: s.isPlaying, previewFrameIndex: s.previewFrameIndex, isLooping: s.isLooping },
    dirty: s.dirty,
    zoom: s.zoom,
    panX: s.panX,
    panY: s.panY,
  };
}
