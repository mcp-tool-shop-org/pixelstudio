import { create } from 'zustand';
import type {
  SpriteDocument,
  SpriteFrame,
  SpriteToolId,
  SpriteBrushShape,
  SpriteToolConfig,
  SpriteOnionSkin,
  SpritePixelBuffer,
  SpriteColor,
  SpriteColorGroup,
  SpriteSelectionRect,
  VectorSourceLink,
  PaletteSet,
} from '@glyphstudio/domain';
import {
  createSpriteDocument,
  createSpriteFrame,
  createSpriteLayer,
  createBlankPixelBuffer,
  createDefaultSpriteEditorState,
  generatePaletteSetId,
  DEFAULT_SPRITE_TOOL_CONFIG,
  DEFAULT_SPRITE_ONION_SKIN,
} from '@glyphstudio/domain';
import { clonePixelBuffer, clearSelectionArea, flipBufferHorizontal, flipBufferVertical, flattenLayers } from './spriteRaster';
import { buildColorMap, remapPixelBuffer } from './paletteRemap';
import { sliceSpriteSheet, assembleSpriteSheet, isImportExportError } from './spriteImportExport';
import { generateSpriteSheetMeta, encodeAnimatedGif } from './spriteExport';
import { serializeSpriteFile, deserializeSpriteFile } from './spritePersistence';
import type { SpriteSheetMeta } from '@glyphstudio/domain';

// ── Store state ──

export interface SpriteEditorStoreState {
  // -- Document --
  document: SpriteDocument | null;
  /** Per-layer pixel buffers keyed by layer ID. */
  pixelBuffers: Record<string, SpritePixelBuffer>;
  /** ID of the active layer in the current frame. */
  activeLayerId: string | null;
  /** Path of the currently open .glyph file (null = never saved). */
  filePath: string | null;

  // -- Editor state (transient) --
  activeFrameIndex: number;
  tool: SpriteToolConfig;
  onionSkin: SpriteOnionSkin;
  zoom: number;
  panX: number;
  panY: number;
  dirty: boolean;
  showGrid: boolean;

  // -- Selection state (editor-only, not persisted) --
  selectionRect: SpriteSelectionRect | null;
  selectionBuffer: SpritePixelBuffer | null;

  // -- Clipboard (editor-only, survives frame switches) --
  clipboardBuffer: SpritePixelBuffer | null;

  // -- Vector source provenance (set during handoff, null otherwise) --
  vectorSourceLink: VectorSourceLink | null;

  // -- Preview state (transient view state, never affects document) --
  isPlaying: boolean;
  isLooping: boolean;
  previewFrameIndex: number;
  /** ID of palette set being previewed (null = no preview active). */
  previewPaletteSetId: string | null;

  // -- Actions: Document lifecycle --
  newDocument: (name: string, width: number, height: number) => void;
  closeDocument: () => void;

  // -- Actions: Persistence --
  /** Serialize and save the current document. writeFn handles actual I/O. */
  saveDocument: (filePath: string, writeFn: (path: string, content: string) => Promise<void>) => Promise<string | null>;
  /** Load a .glyph file from JSON string. Returns error string or null. */
  loadDocument: (json: string, filePath: string) => string | null;

  // -- Actions: Frame management --
  addFrame: () => void;
  duplicateFrame: () => void;
  removeFrame: (frameId: string) => void;
  setActiveFrame: (index: number) => void;
  setFrameDuration: (frameId: string, durationMs: number) => void;
  moveFrame: (fromIndex: number, toIndex: number) => void;

  // -- Actions: Layer management --
  /** Add a new blank layer to the active frame. */
  addLayer: () => void;
  /** Remove a layer from the active frame. Must keep at least one. */
  removeLayer: (layerId: string) => void;
  /** Set the active layer for editing. */
  setActiveLayer: (layerId: string) => void;
  /** Toggle a layer's visibility. */
  toggleLayerVisibility: (layerId: string) => void;
  /** Rename a layer. */
  renameLayer: (layerId: string, name: string) => void;
  /** Move a layer within the active frame's layer stack. */
  moveLayer: (fromIndex: number, toIndex: number) => void;

  // -- Actions: Tool --
  setTool: (tool: SpriteToolId) => void;
  setBrushSize: (size: number) => void;
  setBrushShape: (shape: SpriteBrushShape) => void;
  setPixelPerfect: (enabled: boolean) => void;

  // -- Actions: Palette --
  setForegroundColor: (index: number) => void;
  setBackgroundColor: (index: number) => void;
  swapColors: () => void;
  addPaletteColor: (color: SpriteColor) => void;
  removePaletteColor: (index: number) => void;
  renamePaletteColor: (index: number, name: string) => void;
  lockPaletteColor: (index: number, locked: boolean) => void;
  setPaletteColorRole: (index: number, role: string | undefined) => void;
  createColorGroup: (name: string) => string;
  renameColorGroup: (groupId: string, name: string) => void;
  deleteColorGroup: (groupId: string) => void;
  assignColorToGroup: (colorIndex: number, groupId: string | undefined) => void;

  // -- Actions: Palette sets --
  /** Save current palette colors as a new named palette set. */
  createPaletteSet: (name: string) => string | null;
  /** Rename an existing palette set. */
  renamePaletteSet: (id: string, name: string) => void;
  /** Duplicate a palette set with " (Copy)" suffix. */
  duplicatePaletteSet: (id: string) => string | null;
  /** Delete a palette set. Clears activePaletteSetId if it was the active one. */
  deletePaletteSet: (id: string) => void;
  /** Set the active palette set (or null for base palette). */
  setActivePaletteSet: (id: string | null) => void;
  /** Enter preview mode for a palette set (display only, no pixel mutation). */
  previewPaletteSet: (id: string | null) => void;
  /** Apply the previewed palette set to the active frame, recording history. */
  applyPaletteSetToFrame: (id: string) => void;
  /** Cancel palette set preview without applying. */
  cancelPalettePreview: () => void;

  // -- Actions: Selection --
  /** Set the selection rectangle and extracted pixel buffer. */
  setSelection: (rect: SpriteSelectionRect, buffer: SpritePixelBuffer) => void;
  /** Clear selection state without any pixel changes. */
  clearSelection: () => void;

  // -- Actions: Clipboard --
  /** Copy selection to clipboard. No pixel mutation. */
  copySelection: () => void;
  /** Cut selection: copy to clipboard + clear selected pixels. One authored edit. */
  cutSelection: () => void;
  /** Paste clipboard as new selection at top-left. No pixel mutation until moved. */
  pasteSelection: () => void;
  /** Flip selection buffer horizontally. */
  flipSelectionHorizontal: () => void;
  /** Flip selection buffer vertically. */
  flipSelectionVertical: () => void;

  // -- Actions: Onion skin --
  setOnionSkin: (config: Partial<SpriteOnionSkin>) => void;

  // -- Actions: Pixel editing --
  /** Commit a finished pixel buffer to the active frame. One call per completed tool action. */
  commitPixels: (buffer: SpritePixelBuffer) => void;
  /** Set foreground color by RGBA value (for eyedropper). */
  setForegroundColorByRgba: (rgba: [number, number, number, number]) => void;

  // -- Actions: Import/export --
  /** Import a sprite sheet, replacing current frames. Returns error string or null. */
  importSpriteSheet: (sheetData: Uint8ClampedArray, sheetWidth: number, sheetHeight: number) => string | null;
  /** Export all frames as a horizontal sprite sheet buffer. Returns buffer or error string. */
  exportSpriteSheet: () => SpritePixelBuffer | string;
  /** Export the active frame as a standalone pixel buffer. Returns buffer or null if no document. */
  exportCurrentFrame: () => SpritePixelBuffer | null;
  /** Export sprite sheet with JSON metadata. Returns { sheet, meta } or error string. */
  exportSheetWithMeta: () => { sheet: SpritePixelBuffer; meta: SpriteSheetMeta } | string;
  /** Export animated GIF. Returns Uint8Array of GIF binary or error string. */
  exportGif: (loop?: boolean) => Uint8Array | string;

  // -- Actions: Preview --
  /** Start animation playback. */
  play: () => void;
  /** Stop animation playback. */
  stop: () => void;
  /** Toggle play/stop. */
  togglePlay: () => void;
  /** Toggle loop mode. */
  toggleLoop: () => void;
  /** Advance preview by one frame (respects loop). Returns true if advanced, false if at end and not looping. */
  advancePreview: () => boolean;
  /** Step preview forward one frame (manual scrub). */
  stepPreviewForward: () => void;
  /** Step preview backward one frame (manual scrub). */
  stepPreviewBackward: () => void;
  /** Reset preview to first frame. */
  resetPreview: () => void;
  /** Set preview to a specific frame index (scrubbing). */
  scrubPreview: (index: number) => void;

  // -- Actions: Viewport --
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  toggleGrid: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

// ── Store ──

export const useSpriteEditorStore = create<SpriteEditorStoreState>((set, get) => ({
  // -- Initial state --
  document: null,
  pixelBuffers: {},
  activeLayerId: null,
  filePath: null,
  selectionRect: null,
  selectionBuffer: null,
  clipboardBuffer: null,
  vectorSourceLink: null,
  showGrid: true,
  isPlaying: false,
  isLooping: true,
  previewFrameIndex: 0,
  previewPaletteSetId: null,
  ...createDefaultSpriteEditorState(),

  // -- Document lifecycle --
  newDocument: (name, width, height) => {
    const doc = createSpriteDocument(name, width, height);
    const firstFrame = doc.frames[0];
    const firstLayer = firstFrame.layers[0];
    const buffer = createBlankPixelBuffer(width, height);
    set({
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
      previewPaletteSetId: null,
      zoom: 8,
      panX: 0,
      panY: 0,
      dirty: false,
    });
  },

  closeDocument: () => {
    set({
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
      previewPaletteSetId: null,
      ...createDefaultSpriteEditorState(),
    });
  },

  // -- Persistence --
  saveDocument: async (filePath, writeFn) => {
    const { document: doc, pixelBuffers } = get();
    if (!doc) return 'No document open';

    try {
      const json = serializeSpriteFile(doc, pixelBuffers);
      await writeFn(filePath, json);
      set({ filePath, dirty: false });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Failed to save';
    }
  },

  loadDocument: (json, filePath) => {
    const result = deserializeSpriteFile(json);
    if ('error' in result) return result.error;

    const { document: doc, pixelBuffers } = result;
    const firstFrame = doc.frames[0];
    const firstLayer = firstFrame?.layers[0];

    set({
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
  },

  // -- Frame management --
  addFrame: () => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;

    const insertAt = activeFrameIndex + 1;
    const frame = createSpriteFrame(insertAt);
    const layer = frame.layers[0];
    const buffer = createBlankPixelBuffer(doc.width, doc.height);
    const updatedFrames = [
      ...doc.frames.slice(0, insertAt),
      frame,
      ...doc.frames.slice(insertAt),
    ].map((f, i) => ({ ...f, index: i }));

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: { ...pixelBuffers, [layer.id]: buffer },
      activeFrameIndex: insertAt,
      activeLayerId: layer.id,
      dirty: true,
    });
  },

  duplicateFrame: () => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;
    const sourceFrame = doc.frames[activeFrameIndex];
    if (!sourceFrame) return;

    const insertAt = activeFrameIndex + 1;
    // Create new frame with fresh layers that mirror the source frame's layers
    const newLayers = sourceFrame.layers.map((srcLayer, i) => createSpriteLayer(i, srcLayer.name));
    const newFrame = { ...createSpriteFrame(insertAt, sourceFrame.durationMs), layers: newLayers.map((l, i) => ({ ...l, visible: sourceFrame.layers[i].visible })) };

    // Clone pixel buffers for each layer
    const newBuffers = { ...pixelBuffers };
    for (let i = 0; i < sourceFrame.layers.length; i++) {
      const srcBuf = pixelBuffers[sourceFrame.layers[i].id];
      newBuffers[newLayers[i].id] = srcBuf ? clonePixelBuffer(srcBuf) : createBlankPixelBuffer(doc.width, doc.height);
    }

    const updatedFrames = [
      ...doc.frames.slice(0, insertAt),
      newFrame,
      ...doc.frames.slice(insertAt),
    ].map((f, i) => ({ ...f, index: i }));

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: newBuffers,
      activeFrameIndex: insertAt,
      activeLayerId: newLayers[0]?.id ?? null,
      dirty: true,
    });
  },

  removeFrame: (frameId) => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;
    if (doc.frames.length <= 1) return; // must keep at least one frame

    const frameIndex = doc.frames.findIndex((f) => f.id === frameId);
    if (frameIndex === -1) return;

    // Collect all layer IDs from the frame being removed
    const removedFrame = doc.frames[frameIndex];
    const removedLayerIds = new Set(removedFrame.layers.map((l) => l.id));

    const updatedFrames = doc.frames
      .filter((f) => f.id !== frameId)
      .map((f, i) => ({ ...f, index: i }));

    // Remove all layer buffers for the deleted frame
    const remainingBuffers: Record<string, SpritePixelBuffer> = {};
    for (const [key, buf] of Object.entries(pixelBuffers)) {
      if (!removedLayerIds.has(key)) remainingBuffers[key] = buf;
    }

    const newActiveIndex = Math.min(activeFrameIndex, updatedFrames.length - 1);
    const newActiveFrame = updatedFrames[newActiveIndex];
    const newActiveLayerId = newActiveFrame?.layers[0]?.id ?? null;

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: remainingBuffers,
      activeFrameIndex: newActiveIndex,
      activeLayerId: newActiveLayerId,
      dirty: true,
    });
  },

  setActiveFrame: (index) => {
    const { document: doc } = get();
    if (!doc) return;
    if (index < 0 || index >= doc.frames.length) return;
    const targetFrame = doc.frames[index];
    set({ activeFrameIndex: index, activeLayerId: targetFrame?.layers[0]?.id ?? null, selectionRect: null, selectionBuffer: null });
  },

  setFrameDuration: (frameId, durationMs) => {
    const { document: doc } = get();
    if (!doc) return;
    if (durationMs <= 0) return;

    const updatedFrames = doc.frames.map((f) =>
      f.id === frameId ? { ...f, durationMs } : f,
    );
    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      dirty: true,
    });
  },

  moveFrame: (fromIndex, toIndex) => {
    const { document: doc, activeFrameIndex } = get();
    if (!doc) return;
    if (fromIndex < 0 || fromIndex >= doc.frames.length) return;
    if (toIndex < 0 || toIndex >= doc.frames.length) return;
    if (fromIndex === toIndex) return;

    const frames = [...doc.frames];
    const [moved] = frames.splice(fromIndex, 1);
    frames.splice(toIndex, 0, moved);
    const updatedFrames = frames.map((f, i) => ({ ...f, index: i }));

    // Track active frame: if the active frame was the one moved, follow it
    let newActiveIndex = activeFrameIndex;
    if (activeFrameIndex === fromIndex) {
      newActiveIndex = toIndex;
    } else if (fromIndex < activeFrameIndex && toIndex >= activeFrameIndex) {
      newActiveIndex = activeFrameIndex - 1;
    } else if (fromIndex > activeFrameIndex && toIndex <= activeFrameIndex) {
      newActiveIndex = activeFrameIndex + 1;
    }

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      activeFrameIndex: newActiveIndex,
      dirty: true,
    });
  },

  // -- Layer management --
  addLayer: () => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return;

    const newLayer = createSpriteLayer(frame.layers.length);
    const updatedLayers = [...frame.layers, newLayer];
    const updatedFrame = { ...frame, layers: updatedLayers };
    const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: { ...pixelBuffers, [newLayer.id]: createBlankPixelBuffer(doc.width, doc.height) },
      activeLayerId: newLayer.id,
      dirty: true,
    });
  },

  removeLayer: (layerId) => {
    const { document: doc, pixelBuffers, activeFrameIndex, activeLayerId } = get();
    if (!doc) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame || frame.layers.length <= 1) return;

    const layerIndex = frame.layers.findIndex((l) => l.id === layerId);
    if (layerIndex === -1) return;

    const updatedLayers = frame.layers
      .filter((l) => l.id !== layerId)
      .map((l, i) => ({ ...l, index: i }));
    const updatedFrame = { ...frame, layers: updatedLayers };
    const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

    // Remove layer buffer
    const remainingBuffers: Record<string, SpritePixelBuffer> = {};
    for (const [key, buf] of Object.entries(pixelBuffers)) {
      if (key !== layerId) remainingBuffers[key] = buf;
    }

    // If we removed the active layer, switch to the nearest remaining layer
    const newActiveLayerId = activeLayerId === layerId
      ? updatedLayers[Math.min(layerIndex, updatedLayers.length - 1)]?.id ?? null
      : activeLayerId;

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: remainingBuffers,
      activeLayerId: newActiveLayerId,
      dirty: true,
    });
  },

  setActiveLayer: (layerId) => {
    const { document: doc, activeFrameIndex } = get();
    if (!doc) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return;
    if (!frame.layers.some((l) => l.id === layerId)) return;
    set({ activeLayerId: layerId });
  },

  toggleLayerVisibility: (layerId) => {
    const { document: doc, activeFrameIndex } = get();
    if (!doc) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return;

    const updatedLayers = frame.layers.map((l) =>
      l.id === layerId ? { ...l, visible: !l.visible } : l,
    );
    const updatedFrame = { ...frame, layers: updatedLayers };
    const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      dirty: true,
    });
  },

  renameLayer: (layerId, name) => {
    const { document: doc, activeFrameIndex } = get();
    if (!doc || !name.trim()) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return;

    const updatedLayers = frame.layers.map((l) =>
      l.id === layerId ? { ...l, name: name.trim() } : l,
    );
    const updatedFrame = { ...frame, layers: updatedLayers };
    const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      dirty: true,
    });
  },

  moveLayer: (fromIndex, toIndex) => {
    const { document: doc, activeFrameIndex } = get();
    if (!doc) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return;
    if (fromIndex < 0 || fromIndex >= frame.layers.length) return;
    if (toIndex < 0 || toIndex >= frame.layers.length) return;
    if (fromIndex === toIndex) return;

    const layers = [...frame.layers];
    const [moved] = layers.splice(fromIndex, 1);
    layers.splice(toIndex, 0, moved);
    const updatedLayers = layers.map((l, i) => ({ ...l, index: i }));
    const updatedFrame = { ...frame, layers: updatedLayers };
    const updatedFrames = doc.frames.map((f) => f.id === frame.id ? updatedFrame : f);

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      dirty: true,
    });
  },

  // -- Tool --
  setTool: (activeTool) => set((s) => ({ tool: { ...s.tool, activeTool } })),
  setBrushSize: (brushSize) => {
    if (brushSize < 1) return;
    set((s) => ({ tool: { ...s.tool, brushSize } }));
  },
  setBrushShape: (brushShape) => set((s) => ({ tool: { ...s.tool, brushShape } })),
  setPixelPerfect: (pixelPerfect) => set((s) => ({ tool: { ...s.tool, pixelPerfect } })),

  // -- Palette --
  setForegroundColor: (index) => {
    const { document: doc } = get();
    if (!doc) return;
    if (index < 0 || index >= doc.palette.colors.length) return;
    set({
      document: { ...doc, palette: { ...doc.palette, foregroundIndex: index } },
    });
  },

  setBackgroundColor: (index) => {
    const { document: doc } = get();
    if (!doc) return;
    if (index < 0 || index >= doc.palette.colors.length) return;
    set({
      document: { ...doc, palette: { ...doc.palette, backgroundIndex: index } },
    });
  },

  swapColors: () => {
    const { document: doc } = get();
    if (!doc) return;
    set({
      document: {
        ...doc,
        palette: {
          ...doc.palette,
          foregroundIndex: doc.palette.backgroundIndex,
          backgroundIndex: doc.palette.foregroundIndex,
        },
      },
    });
  },

  addPaletteColor: (color) => {
    const { document: doc } = get();
    if (!doc) return;
    const colors = [...doc.palette.colors, color];
    set({ document: { ...doc, palette: { ...doc.palette, colors } } });
  },

  removePaletteColor: (index) => {
    const { document: doc } = get();
    if (!doc) return;
    if (index < 0 || index >= doc.palette.colors.length) return;
    if (doc.palette.colors[index]?.locked) return;
    const colors = doc.palette.colors.filter((_, i) => i !== index);
    if (colors.length === 0) return;
    const fg = doc.palette.foregroundIndex >= colors.length ? 0 : doc.palette.foregroundIndex > index ? doc.palette.foregroundIndex - 1 : doc.palette.foregroundIndex;
    const bg = doc.palette.backgroundIndex >= colors.length ? 0 : doc.palette.backgroundIndex > index ? doc.palette.backgroundIndex - 1 : doc.palette.backgroundIndex;
    set({ document: { ...doc, palette: { ...doc.palette, colors, foregroundIndex: fg, backgroundIndex: bg } } });
  },

  renamePaletteColor: (index, name) => {
    const { document: doc } = get();
    if (!doc) return;
    if (index < 0 || index >= doc.palette.colors.length) return;
    const colors = doc.palette.colors.map((c, i) => i === index ? { ...c, name } : c);
    set({ document: { ...doc, palette: { ...doc.palette, colors } } });
  },

  lockPaletteColor: (index, locked) => {
    const { document: doc } = get();
    if (!doc) return;
    if (index < 0 || index >= doc.palette.colors.length) return;
    const colors = doc.palette.colors.map((c, i) => i === index ? { ...c, locked } : c);
    set({ document: { ...doc, palette: { ...doc.palette, colors } } });
  },

  setPaletteColorRole: (index, role) => {
    const { document: doc } = get();
    if (!doc) return;
    if (index < 0 || index >= doc.palette.colors.length) return;
    const colors = doc.palette.colors.map((c, i) => i === index ? { ...c, semanticRole: role } : c);
    set({ document: { ...doc, palette: { ...doc.palette, colors } } });
  },

  createColorGroup: (name) => {
    const { document: doc } = get();
    const id = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (!doc) return id;
    const groups = [...(doc.palette.groups ?? []), { id, name }];
    set({ document: { ...doc, palette: { ...doc.palette, groups } } });
    return id;
  },

  renameColorGroup: (groupId, name) => {
    const { document: doc } = get();
    if (!doc) return;
    const groups = (doc.palette.groups ?? []).map((g) => g.id === groupId ? { ...g, name } : g);
    set({ document: { ...doc, palette: { ...doc.palette, groups } } });
  },

  deleteColorGroup: (groupId) => {
    const { document: doc } = get();
    if (!doc) return;
    const groups = (doc.palette.groups ?? []).filter((g) => g.id !== groupId);
    const colors = doc.palette.colors.map((c) => c.groupId === groupId ? { ...c, groupId: undefined } : c);
    set({ document: { ...doc, palette: { ...doc.palette, groups, colors } } });
  },

  assignColorToGroup: (colorIndex, groupId) => {
    const { document: doc } = get();
    if (!doc) return;
    if (colorIndex < 0 || colorIndex >= doc.palette.colors.length) return;
    const colors = doc.palette.colors.map((c, i) => i === colorIndex ? { ...c, groupId } : c);
    set({ document: { ...doc, palette: { ...doc.palette, colors } } });
  },

  // -- Palette sets --
  createPaletteSet: (name) => {
    const { document: doc } = get();
    if (!doc) return null;
    const id = generatePaletteSetId();
    const paletteSet: PaletteSet = {
      id,
      name,
      colors: doc.palette.colors.map((c) => ({ ...c })),
    };
    const paletteSets = [...(doc.paletteSets ?? []), paletteSet];
    set({ document: { ...doc, paletteSets, updatedAt: new Date().toISOString() }, dirty: true });
    return id;
  },

  renamePaletteSet: (id, name) => {
    const { document: doc } = get();
    if (!doc) return;
    const paletteSets = (doc.paletteSets ?? []).map((ps) =>
      ps.id === id ? { ...ps, name } : ps,
    );
    set({ document: { ...doc, paletteSets, updatedAt: new Date().toISOString() }, dirty: true });
  },

  duplicatePaletteSet: (id) => {
    const { document: doc } = get();
    if (!doc) return null;
    const source = (doc.paletteSets ?? []).find((ps) => ps.id === id);
    if (!source) return null;
    const newId = generatePaletteSetId();
    const duplicate: PaletteSet = {
      id: newId,
      name: `${source.name} (Copy)`,
      colors: source.colors.map((c) => ({ ...c })),
    };
    const paletteSets = [...(doc.paletteSets ?? []), duplicate];
    set({ document: { ...doc, paletteSets, updatedAt: new Date().toISOString() }, dirty: true });
    return newId;
  },

  deletePaletteSet: (id) => {
    const { document: doc } = get();
    if (!doc) return;
    const paletteSets = (doc.paletteSets ?? []).filter((ps) => ps.id !== id);
    const activePaletteSetId = doc.activePaletteSetId === id ? null : doc.activePaletteSetId;
    set({ document: { ...doc, paletteSets, activePaletteSetId, updatedAt: new Date().toISOString() }, dirty: true });
  },

  setActivePaletteSet: (id) => {
    const { document: doc } = get();
    if (!doc) return;
    if (id !== null && !(doc.paletteSets ?? []).some((ps) => ps.id === id)) return;
    set({ document: { ...doc, activePaletteSetId: id, updatedAt: new Date().toISOString() } });
  },

  previewPaletteSet: (id) => {
    const { document: doc } = get();
    if (!doc) return;
    if (id !== null && !(doc.paletteSets ?? []).some((ps) => ps.id === id)) return;
    set({ previewPaletteSetId: id });
  },

  applyPaletteSetToFrame: (id) => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;
    const paletteSet = (doc.paletteSets ?? []).find((ps) => ps.id === id);
    if (!paletteSet) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return;

    const colorMap = buildColorMap(doc.palette.colors, paletteSet.colors);
    if (colorMap.size === 0) {
      set({ previewPaletteSetId: null });
      return;
    }

    const newBuffers = { ...pixelBuffers };
    for (const layer of frame.layers) {
      const buf = pixelBuffers[layer.id];
      if (buf) {
        newBuffers[layer.id] = remapPixelBuffer(buf, colorMap);
      }
    }

    set({
      pixelBuffers: newBuffers,
      document: { ...doc, updatedAt: new Date().toISOString() },
      dirty: true,
      previewPaletteSetId: null,
    });
  },

  cancelPalettePreview: () => {
    set({ previewPaletteSetId: null });
  },

  // -- Selection --
  setSelection: (rect, buffer) => set({ selectionRect: rect, selectionBuffer: buffer }),
  clearSelection: () => set({ selectionRect: null, selectionBuffer: null }),

  // -- Clipboard --
  copySelection: () => {
    const { selectionBuffer } = get();
    if (!selectionBuffer) return;
    set({ clipboardBuffer: clonePixelBuffer(selectionBuffer) });
  },

  cutSelection: () => {
    const { selectionRect, selectionBuffer, document: doc, pixelBuffers, activeLayerId } = get();
    if (!selectionRect || !selectionBuffer || !doc || !activeLayerId) return;

    const currentBuf = pixelBuffers[activeLayerId];
    if (!currentBuf) return;

    // Copy to clipboard
    const clipboard = clonePixelBuffer(selectionBuffer);

    // Clear selected area in active layer buffer — one authored edit
    const updated = clonePixelBuffer(currentBuf);
    clearSelectionArea(updated, selectionRect);

    set({
      clipboardBuffer: clipboard,
      pixelBuffers: { ...pixelBuffers, [activeLayerId]: updated },
      document: { ...doc, updatedAt: new Date().toISOString() },
      selectionRect: null,
      selectionBuffer: null,
      dirty: true,
    });
  },

  pasteSelection: () => {
    const { clipboardBuffer, document: doc } = get();
    if (!clipboardBuffer || !doc) return;

    // Place pasted selection at (0, 0) as a new selection
    const rect: SpriteSelectionRect = {
      x: 0,
      y: 0,
      width: clipboardBuffer.width,
      height: clipboardBuffer.height,
    };
    set({
      selectionRect: rect,
      selectionBuffer: clonePixelBuffer(clipboardBuffer),
    });
  },

  flipSelectionHorizontal: () => {
    const { selectionBuffer } = get();
    if (!selectionBuffer) return;
    set({ selectionBuffer: flipBufferHorizontal(selectionBuffer) });
  },

  flipSelectionVertical: () => {
    const { selectionBuffer } = get();
    if (!selectionBuffer) return;
    set({ selectionBuffer: flipBufferVertical(selectionBuffer) });
  },

  // -- Onion skin --
  setOnionSkin: (config) => set((s) => ({ onionSkin: { ...s.onionSkin, ...config } })),

  // -- Pixel editing --
  commitPixels: (buffer) => {
    const { document: doc, pixelBuffers, activeLayerId } = get();
    if (!doc || !activeLayerId) return;
    set({
      pixelBuffers: { ...pixelBuffers, [activeLayerId]: buffer },
      document: { ...doc, updatedAt: new Date().toISOString() },
      dirty: true,
    });
  },

  setForegroundColorByRgba: (rgba) => {
    const { document: doc } = get();
    if (!doc) return;
    // Find exact match in palette, or add to palette
    const existingIndex = doc.palette.colors.findIndex(
      (c) => c.rgba[0] === rgba[0] && c.rgba[1] === rgba[1] && c.rgba[2] === rgba[2] && c.rgba[3] === rgba[3],
    );
    if (existingIndex >= 0) {
      set({ document: { ...doc, palette: { ...doc.palette, foregroundIndex: existingIndex } } });
    } else {
      const newColor: SpriteColor = { rgba };
      const newColors = [...doc.palette.colors, newColor];
      set({
        document: {
          ...doc,
          palette: { ...doc.palette, colors: newColors, foregroundIndex: newColors.length - 1 },
        },
      });
    }
  },

  // -- Import/export --
  importSpriteSheet: (sheetData, sheetWidth, sheetHeight) => {
    const { document: doc } = get();
    if (!doc) return 'No document open';

    const result = sliceSpriteSheet(sheetData, sheetWidth, sheetHeight, doc.width, doc.height);
    if (isImportExportError(result)) return result.error;

    // Build new frames and pixel buffers from sliced data (one layer per frame)
    const newFrames: SpriteFrame[] = result.frames.map((_, i) => createSpriteFrame(i));
    const newBuffers: Record<string, SpritePixelBuffer> = {};
    for (let i = 0; i < newFrames.length; i++) {
      const layer = newFrames[i].layers[0];
      newBuffers[layer.id] = result.frames[i];
    }

    const firstLayer = newFrames[0]?.layers[0];
    set({
      document: {
        ...doc,
        frames: newFrames,
        updatedAt: new Date().toISOString(),
      },
      pixelBuffers: newBuffers,
      activeFrameIndex: 0,
      activeLayerId: firstLayer?.id ?? null,
      selectionRect: null,
      selectionBuffer: null,
      dirty: true,
    });
    return null;
  },

  exportSpriteSheet: () => {
    const { document: doc, pixelBuffers } = get();
    if (!doc) return 'No document open';

    const frameBuffers = doc.frames.map((f) =>
      flattenLayers(f.layers, pixelBuffers, doc.width, doc.height),
    );
    const result = assembleSpriteSheet(frameBuffers);
    if (isImportExportError(result)) return result.error;
    return result;
  },

  exportCurrentFrame: () => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return null;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return null;
    return flattenLayers(frame.layers, pixelBuffers, doc.width, doc.height);
  },

  exportSheetWithMeta: () => {
    const { document: doc, pixelBuffers } = get();
    if (!doc) return 'No document open';

    const frameBuffers = doc.frames.map((f) =>
      flattenLayers(f.layers, pixelBuffers, doc.width, doc.height),
    );
    const sheet = assembleSpriteSheet(frameBuffers);
    if (isImportExportError(sheet)) return sheet.error;

    const meta = generateSpriteSheetMeta(doc);
    if (isImportExportError(meta)) return meta.error;

    return { sheet, meta };
  },

  exportGif: (loop = true) => {
    const { document: doc, pixelBuffers } = get();
    if (!doc) return 'No document open';

    const frameBuffers = doc.frames.map((f) =>
      flattenLayers(f.layers, pixelBuffers, doc.width, doc.height),
    );
    const durations = doc.frames.map((f) => f.durationMs);

    const result = encodeAnimatedGif(frameBuffers, durations, loop);
    if (isImportExportError(result)) return (result as { error: string }).error;
    return result as Uint8Array;
  },

  // -- Preview --
  play: () => {
    const { document: doc } = get();
    if (!doc || doc.frames.length < 2) return;
    set({ isPlaying: true, previewFrameIndex: get().activeFrameIndex });
  },

  stop: () => {
    const { isPlaying, previewFrameIndex } = get();
    if (!isPlaying) return;
    set({ isPlaying: false, activeFrameIndex: previewFrameIndex });
  },

  togglePlay: () => {
    const { isPlaying } = get();
    if (isPlaying) {
      get().stop();
    } else {
      get().play();
    }
  },

  toggleLoop: () => set((s) => ({ isLooping: !s.isLooping })),

  advancePreview: () => {
    const { document: doc, previewFrameIndex, isLooping } = get();
    if (!doc) return false;
    const next = previewFrameIndex + 1;
    if (next >= doc.frames.length) {
      if (isLooping) {
        set({ previewFrameIndex: 0 });
        return true;
      }
      // Not looping — stop playback at last frame
      set({ isPlaying: false, activeFrameIndex: previewFrameIndex });
      return false;
    }
    set({ previewFrameIndex: next });
    return true;
  },

  stepPreviewForward: () => {
    const { document: doc, activeFrameIndex, isPlaying } = get();
    if (!doc || isPlaying) return;
    const next = activeFrameIndex + 1;
    if (next < doc.frames.length) {
      set({ activeFrameIndex: next, previewFrameIndex: next });
    }
  },

  stepPreviewBackward: () => {
    const { document: doc, activeFrameIndex, isPlaying } = get();
    if (!doc || isPlaying) return;
    if (activeFrameIndex > 0) {
      const prev = activeFrameIndex - 1;
      set({ activeFrameIndex: prev, previewFrameIndex: prev });
    }
  },

  resetPreview: () => {
    set({ previewFrameIndex: 0, activeFrameIndex: 0, isPlaying: false });
  },

  scrubPreview: (index) => {
    const { document: doc, isPlaying } = get();
    if (!doc || isPlaying) return;
    if (index < 0 || index >= doc.frames.length) return;
    set({ activeFrameIndex: index, previewFrameIndex: index });
  },

  // -- Viewport --
  setZoom: (zoom) => {
    if (zoom < 1 || zoom > 64) return;
    set({ zoom });
  },
  setPan: (x, y) => set({ panX: x, panY: y }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  zoomIn: () => {
    const { zoom } = get();
    const next = Math.min(64, zoom < 4 ? zoom + 1 : zoom + 4);
    set({ zoom: next });
  },
  zoomOut: () => {
    const { zoom } = get();
    const next = Math.max(1, zoom <= 4 ? zoom - 1 : zoom - 4);
    set({ zoom: next });
  },
}));
