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
  SpriteSelectionRect,
} from '@glyphstudio/domain';
import {
  createSpriteDocument,
  createSpriteFrame,
  createBlankPixelBuffer,
  createDefaultSpriteEditorState,
  DEFAULT_SPRITE_TOOL_CONFIG,
  DEFAULT_SPRITE_ONION_SKIN,
} from '@glyphstudio/domain';
import { clonePixelBuffer, clearSelectionArea, flipBufferHorizontal, flipBufferVertical } from './spriteRaster';
import { sliceSpriteSheet, assembleSpriteSheet, isImportExportError } from './spriteImportExport';

// ── Store state ──

export interface SpriteEditorStoreState {
  // -- Document --
  document: SpriteDocument | null;
  /** Per-frame pixel buffers keyed by frame ID. */
  pixelBuffers: Record<string, SpritePixelBuffer>;

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

  // -- Actions: Document lifecycle --
  newDocument: (name: string, width: number, height: number) => void;
  closeDocument: () => void;

  // -- Actions: Frame management --
  addFrame: () => void;
  duplicateFrame: () => void;
  removeFrame: (frameId: string) => void;
  setActiveFrame: (index: number) => void;
  setFrameDuration: (frameId: string, durationMs: number) => void;
  moveFrame: (fromIndex: number, toIndex: number) => void;

  // -- Actions: Tool --
  setTool: (tool: SpriteToolId) => void;
  setBrushSize: (size: number) => void;
  setBrushShape: (shape: SpriteBrushShape) => void;
  setPixelPerfect: (enabled: boolean) => void;

  // -- Actions: Palette --
  setForegroundColor: (index: number) => void;
  setBackgroundColor: (index: number) => void;
  swapColors: () => void;

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
  selectionRect: null,
  selectionBuffer: null,
  clipboardBuffer: null,
  showGrid: true,
  ...createDefaultSpriteEditorState(),

  // -- Document lifecycle --
  newDocument: (name, width, height) => {
    const doc = createSpriteDocument(name, width, height);
    const firstFrame = doc.frames[0];
    const buffer = createBlankPixelBuffer(width, height);
    set({
      document: doc,
      pixelBuffers: { [firstFrame.id]: buffer },
      activeFrameIndex: 0,
      tool: { ...DEFAULT_SPRITE_TOOL_CONFIG },
      onionSkin: { ...DEFAULT_SPRITE_ONION_SKIN },
      selectionRect: null,
      selectionBuffer: null,
      clipboardBuffer: null,
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
      selectionRect: null,
      selectionBuffer: null,
      clipboardBuffer: null,
      ...createDefaultSpriteEditorState(),
    });
  },

  // -- Frame management --
  addFrame: () => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;

    const insertAt = activeFrameIndex + 1;
    const frame = createSpriteFrame(insertAt);
    const buffer = createBlankPixelBuffer(doc.width, doc.height);
    const updatedFrames = [
      ...doc.frames.slice(0, insertAt),
      frame,
      ...doc.frames.slice(insertAt),
    ].map((f, i) => ({ ...f, index: i }));

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: { ...pixelBuffers, [frame.id]: buffer },
      activeFrameIndex: insertAt,
      dirty: true,
    });
  },

  duplicateFrame: () => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;
    const sourceFrame = doc.frames[activeFrameIndex];
    if (!sourceFrame) return;

    const insertAt = activeFrameIndex + 1;
    const newFrame = createSpriteFrame(insertAt, sourceFrame.durationMs);
    const sourceBuffer = pixelBuffers[sourceFrame.id];
    const newBuffer = sourceBuffer ? clonePixelBuffer(sourceBuffer) : createBlankPixelBuffer(doc.width, doc.height);

    const updatedFrames = [
      ...doc.frames.slice(0, insertAt),
      newFrame,
      ...doc.frames.slice(insertAt),
    ].map((f, i) => ({ ...f, index: i }));

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: { ...pixelBuffers, [newFrame.id]: newBuffer },
      activeFrameIndex: insertAt,
      dirty: true,
    });
  },

  removeFrame: (frameId) => {
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;
    if (doc.frames.length <= 1) return; // must keep at least one frame

    const frameIndex = doc.frames.findIndex((f) => f.id === frameId);
    if (frameIndex === -1) return;

    const updatedFrames = doc.frames
      .filter((f) => f.id !== frameId)
      .map((f, i) => ({ ...f, index: i }));
    const { [frameId]: _, ...remainingBuffers } = pixelBuffers;
    const newActiveIndex = Math.min(activeFrameIndex, updatedFrames.length - 1);

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: remainingBuffers,
      activeFrameIndex: newActiveIndex,
      dirty: true,
    });
  },

  setActiveFrame: (index) => {
    const { document: doc } = get();
    if (!doc) return;
    if (index < 0 || index >= doc.frames.length) return;
    set({ activeFrameIndex: index, selectionRect: null, selectionBuffer: null });
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
    const { selectionRect, selectionBuffer, document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!selectionRect || !selectionBuffer || !doc) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return;

    const currentBuf = pixelBuffers[frame.id];
    if (!currentBuf) return;

    // Copy to clipboard
    const clipboard = clonePixelBuffer(selectionBuffer);

    // Clear selected area in frame buffer — one authored edit
    const updated = clonePixelBuffer(currentBuf);
    clearSelectionArea(updated, selectionRect);

    set({
      clipboardBuffer: clipboard,
      pixelBuffers: { ...pixelBuffers, [frame.id]: updated },
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
    const { document: doc, pixelBuffers, activeFrameIndex } = get();
    if (!doc) return;
    const frame = doc.frames[activeFrameIndex];
    if (!frame) return;
    set({
      pixelBuffers: { ...pixelBuffers, [frame.id]: buffer },
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

    // Build new frames and pixel buffers from sliced data
    const newFrames: SpriteFrame[] = result.frames.map((_, i) => createSpriteFrame(i));
    const newBuffers: Record<string, SpritePixelBuffer> = {};
    for (let i = 0; i < newFrames.length; i++) {
      newBuffers[newFrames[i].id] = result.frames[i];
    }

    set({
      document: {
        ...doc,
        frames: newFrames,
        updatedAt: new Date().toISOString(),
      },
      pixelBuffers: newBuffers,
      activeFrameIndex: 0,
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
      pixelBuffers[f.id] ?? createBlankPixelBuffer(doc.width, doc.height),
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
    const buf = pixelBuffers[frame.id];
    return buf ? clonePixelBuffer(buf) : null;
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
