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
} from '@glyphstudio/domain';
import {
  createSpriteDocument,
  createSpriteFrame,
  createBlankPixelBuffer,
  createDefaultSpriteEditorState,
  DEFAULT_SPRITE_TOOL_CONFIG,
  DEFAULT_SPRITE_ONION_SKIN,
} from '@glyphstudio/domain';

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

  // -- Actions: Document lifecycle --
  newDocument: (name: string, width: number, height: number) => void;
  closeDocument: () => void;

  // -- Actions: Frame management --
  addFrame: () => void;
  removeFrame: (frameId: string) => void;
  setActiveFrame: (index: number) => void;
  setFrameDuration: (frameId: string, durationMs: number) => void;

  // -- Actions: Tool --
  setTool: (tool: SpriteToolId) => void;
  setBrushSize: (size: number) => void;
  setBrushShape: (shape: SpriteBrushShape) => void;
  setPixelPerfect: (enabled: boolean) => void;

  // -- Actions: Palette --
  setForegroundColor: (index: number) => void;
  setBackgroundColor: (index: number) => void;
  swapColors: () => void;

  // -- Actions: Onion skin --
  setOnionSkin: (config: Partial<SpriteOnionSkin>) => void;

  // -- Actions: Pixel editing --
  /** Commit a finished pixel buffer to the active frame. One call per completed tool action. */
  commitPixels: (buffer: SpritePixelBuffer) => void;
  /** Set foreground color by RGBA value (for eyedropper). */
  setForegroundColorByRgba: (rgba: [number, number, number, number]) => void;

  // -- Actions: Viewport --
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
}

// ── Store ──

export const useSpriteEditorStore = create<SpriteEditorStoreState>((set, get) => ({
  // -- Initial state --
  document: null,
  pixelBuffers: {},
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
      ...createDefaultSpriteEditorState(),
    });
  },

  // -- Frame management --
  addFrame: () => {
    const { document: doc, pixelBuffers } = get();
    if (!doc) return;

    const newIndex = doc.frames.length;
    const frame = createSpriteFrame(newIndex);
    const buffer = createBlankPixelBuffer(doc.width, doc.height);
    const updatedFrames = [...doc.frames, frame];

    set({
      document: { ...doc, frames: updatedFrames, updatedAt: new Date().toISOString() },
      pixelBuffers: { ...pixelBuffers, [frame.id]: buffer },
      activeFrameIndex: newIndex,
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
    set({ activeFrameIndex: index });
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

  // -- Viewport --
  setZoom: (zoom) => {
    if (zoom < 1 || zoom > 64) return;
    set({ zoom });
  },
  setPan: (x, y) => set({ panX: x, panY: y }),
}));
