/** Unique sprite document identifier. */
export type SpriteId = string;

// ── Pixel data ──

/**
 * A flat RGBA pixel buffer for a single cel.
 *
 * Stored as a Uint8ClampedArray of length width * height * 4.
 * Pixel at (x, y) starts at index (y * width + x) * 4.
 */
export interface SpritePixelBuffer {
  width: number;
  height: number;
  /** RGBA pixel data — length = width * height * 4. */
  data: Uint8ClampedArray;
}

// ── Palette ──

/** A single color entry in a sprite palette. */
export interface SpriteColor {
  /** RGBA tuple — each channel 0–255. */
  rgba: [number, number, number, number];
  /** Optional human-readable name. */
  name?: string;
  /** Whether this color is locked (cannot be edited or removed). */
  locked?: boolean;
  /** Semantic role label (e.g. "skin", "outline", "shadow"). */
  semanticRole?: string;
  /** ID of the color group/ramp this slot belongs to. */
  groupId?: string;
}

/** A named group of palette colors (e.g. a value ramp). */
export interface SpriteColorGroup {
  id: string;
  name: string;
}

/** A sprite-local palette — flat ordered list of colors. */
export interface SpritePalette {
  /** Ordered color entries. Index 0 is typically transparent. */
  colors: SpriteColor[];
  /** Index of the currently selected foreground color. */
  foregroundIndex: number;
  /** Index of the currently selected background color. */
  backgroundIndex: number;
  /** Named color groups/ramps. */
  groups?: SpriteColorGroup[];
}

// ── Layer ──

/** A single raster layer within a frame. */
export interface SpriteLayer {
  id: string;
  /** Human-readable layer name. */
  name: string;
  /** Whether this layer is visible in preview/export. */
  visible: boolean;
  /** 0-based index in the layer stack (0 = bottom). */
  index: number;
  /** Sketch layers are excluded from export by default. */
  sketch?: boolean;
}

// ── Frame ──

/** A single frame in a sprite animation. */
export interface SpriteFrame {
  id: string;
  /** 0-based index in the frame sequence. */
  index: number;
  /** Frame duration in milliseconds. */
  durationMs: number;
  /** Ordered layer stack (index 0 = bottom). */
  layers: SpriteLayer[];
}

// ── Tools ──

/**
 * Sprite editing tool identifiers.
 *
 * Core set: pencil, eraser, fill, eyedropper, select.
 * Shape tools will follow in later stages.
 */
export type SpriteToolId = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'select';

/** Axis-aligned selection rectangle in pixel coordinates. */
export interface SpriteSelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Brush shape for stroke-based tools. */
export type SpriteBrushShape = 'square' | 'circle';

/** Tool configuration state. */
export interface SpriteToolConfig {
  activeTool: SpriteToolId;
  brushSize: number;
  brushShape: SpriteBrushShape;
  /** Pixel-perfect mode — prevents L-shaped corners in 1px strokes. */
  pixelPerfect: boolean;
}

// ── Onion skin ──

/** Onion skin display configuration. */
export interface SpriteOnionSkin {
  enabled: boolean;
  /** Number of frames to show before the current frame. */
  framesBefore: number;
  /** Number of frames to show after the current frame. */
  framesAfter: number;
  /** Opacity for onion skin overlays (0.0–1.0). */
  opacity: number;
}

// ── Document ──

/**
 * The sprite document — the root authored artifact.
 *
 * Pixel data lives outside the document (in the pixel buffer store).
 * The document holds structure: canvas size, frames, palette, metadata.
 */
export interface SpriteDocument {
  id: SpriteId;
  name: string;
  /** Canvas width in pixels. */
  width: number;
  /** Canvas height in pixels. */
  height: number;
  /** Ordered list of frames. */
  frames: SpriteFrame[];
  /** Sprite-local palette. */
  palette: SpritePalette;
  createdAt: string;
  updatedAt: string;
}

// ── Editor state (non-persisted) ──

/**
 * Transient sprite editor state — not persisted with the document.
 *
 * Tracks UI concerns: active frame, zoom, tool state, onion skin config.
 */
export interface SpriteEditorState {
  /** Currently active frame index. */
  activeFrameIndex: number;
  /** Tool configuration. */
  tool: SpriteToolConfig;
  /** Onion skin settings. */
  onionSkin: SpriteOnionSkin;
  /** Canvas zoom level (1 = 1 pixel = 1 screen pixel). */
  zoom: number;
  /** Canvas pan offset X in screen pixels. */
  panX: number;
  /** Canvas pan offset Y in screen pixels. */
  panY: number;
  /** Whether the sprite has unsaved changes. */
  dirty: boolean;
}

// ── Export metadata ──

/** Per-frame metadata in a sprite sheet export manifest. */
export interface SpriteSheetFrameMeta {
  /** 0-based index in the frame sequence. */
  index: number;
  /** X offset of this frame in the sheet (pixels). */
  x: number;
  /** Y offset of this frame in the sheet (pixels). */
  y: number;
  /** Frame width in pixels. */
  w: number;
  /** Frame height in pixels. */
  h: number;
  /** Frame duration in milliseconds. */
  durationMs: number;
}

/**
 * JSON metadata manifest for a sprite sheet export.
 *
 * Describes the layout, timing, and dimensions of an exported sprite sheet
 * so that runtimes and tools can load it without guessing.
 */
export interface SpriteSheetMeta {
  /** Format identifier — always "glyphstudio-sprite-sheet". */
  format: 'glyphstudio-sprite-sheet';
  /** Schema version for forward compatibility. */
  version: 1;
  /** Sprite document name. */
  name: string;
  /** Total sheet width in pixels. */
  sheetWidth: number;
  /** Total sheet height in pixels. */
  sheetHeight: number;
  /** Individual frame width in pixels. */
  frameWidth: number;
  /** Individual frame height in pixels. */
  frameHeight: number;
  /** Number of frames in the sheet. */
  frameCount: number;
  /** Layout direction — currently always "horizontal". */
  layout: 'horizontal';
  /** Per-frame metadata in sequence order. */
  frames: SpriteSheetFrameMeta[];
}

// ── Defaults ──

export const DEFAULT_SPRITE_TOOL_CONFIG: SpriteToolConfig = {
  activeTool: 'pencil',
  brushSize: 1,
  brushShape: 'square',
  pixelPerfect: false,
};

export const DEFAULT_SPRITE_ONION_SKIN: SpriteOnionSkin = {
  enabled: false,
  framesBefore: 1,
  framesAfter: 1,
  opacity: 0.3,
};

export const DEFAULT_SPRITE_PALETTE: SpritePalette = {
  colors: [
    { rgba: [0, 0, 0, 0], name: 'Transparent' },
    { rgba: [0, 0, 0, 255], name: 'Black' },
    { rgba: [255, 255, 255, 255], name: 'White' },
    { rgba: [255, 0, 0, 255], name: 'Red' },
    { rgba: [0, 255, 0, 255], name: 'Green' },
    { rgba: [0, 0, 255, 255], name: 'Blue' },
    { rgba: [255, 255, 0, 255], name: 'Yellow' },
    { rgba: [255, 0, 255, 255], name: 'Magenta' },
    { rgba: [0, 255, 255, 255], name: 'Cyan' },
    { rgba: [128, 128, 128, 255], name: 'Gray' },
  ],
  foregroundIndex: 1,
  backgroundIndex: 0,
};

/** Generate a unique sprite layer ID. */
export function generateSpriteLayerId(): string {
  return `sl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique sprite frame ID. */
export function generateSpriteFrameId(): string {
  return `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique sprite document ID. */
export function generateSpriteId(): string {
  return `sprite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a new sprite layer. */
export function createSpriteLayer(index: number, name?: string): SpriteLayer {
  return {
    id: generateSpriteLayerId(),
    name: name ?? `Layer ${index + 1}`,
    visible: true,
    index,
  };
}

/** Create a blank sprite frame at a given index with one default layer. */
export function createSpriteFrame(index: number, durationMs: number = 100): SpriteFrame {
  return {
    id: generateSpriteFrameId(),
    index,
    durationMs,
    layers: [createSpriteLayer(0, 'Layer 1')],
  };
}

/** Create a new empty sprite document with default settings. */
export function createSpriteDocument(
  name: string,
  width: number,
  height: number,
): SpriteDocument {
  const now = new Date().toISOString();
  return {
    id: generateSpriteId(),
    name,
    width,
    height,
    frames: [createSpriteFrame(0)],
    palette: { ...DEFAULT_SPRITE_PALETTE, colors: [...DEFAULT_SPRITE_PALETTE.colors] },
    createdAt: now,
    updatedAt: now,
  };
}

/** Create a blank pixel buffer filled with transparent pixels. */
export function createBlankPixelBuffer(width: number, height: number): SpritePixelBuffer {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

/** Create default sprite editor state. */
export function createDefaultSpriteEditorState(): SpriteEditorState {
  return {
    activeFrameIndex: 0,
    tool: { ...DEFAULT_SPRITE_TOOL_CONFIG },
    onionSkin: { ...DEFAULT_SPRITE_ONION_SKIN },
    zoom: 8,
    panX: 0,
    panY: 0,
    dirty: false,
  };
}
