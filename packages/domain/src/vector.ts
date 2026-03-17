/**
 * Vector Master domain types.
 *
 * A vector master (.glyphvec) is a design-phase document built for reduction.
 * It stores layered vector shapes at a comfortable artboard size (default 500×500)
 * that rasterize cleanly to multiple target sprite sizes.
 *
 * Law: vector is the upstream design tool; pixel is the downstream final.
 */

// ── Identifiers ──

/** Unique vector master document identifier. */
export type VectorMasterId = string;

/** Unique vector shape identifier. */
export type VectorShapeId = string;

/** Unique vector group identifier. */
export type VectorGroupId = string;

// ── Geometry primitives ──

/** Axis-aligned rectangle geometry. */
export interface RectGeometry {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional corner radius (0 = sharp). */
  cornerRadius?: number;
}

/** Ellipse geometry (center + radii). */
export interface EllipseGeometry {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Line segment geometry. */
export interface LineGeometry {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Closed polygon geometry — ordered vertex list. */
export interface PolygonGeometry {
  kind: 'polygon';
  /** Ordered vertex list. Minimum 3 points. Auto-closed (last→first). */
  points: ReadonlyArray<{ x: number; y: number }>;
}

/** Union of all supported geometry types. */
export type VectorGeometry =
  | RectGeometry
  | EllipseGeometry
  | LineGeometry
  | PolygonGeometry;

/** Discriminant for geometry kind. */
export type VectorShapeKind = VectorGeometry['kind'];

// ── RGBA color tuple ──

/** RGBA color — each channel 0–255. */
export type Rgba = [number, number, number, number];

// ── Stroke ──

/** Stroke style for a vector shape. */
export interface VectorStroke {
  color: Rgba;
  width: number;
}

// ── Per-shape transform ──

/**
 * Per-shape affine transform.
 *
 * Applied in order: scale → rotate → flip → translate.
 * No skew — skew is where software goes to start lying.
 */
export interface VectorTransform {
  /** Translation X (pixels on artboard). */
  x: number;
  /** Translation Y (pixels on artboard). */
  y: number;
  /** Horizontal scale factor (1 = no scale). */
  scaleX: number;
  /** Vertical scale factor (1 = no scale). */
  scaleY: number;
  /** Rotation in degrees (clockwise). */
  rotation: number;
  /** Flip horizontally. */
  flipX: boolean;
  /** Flip vertically. */
  flipY: boolean;
}

// ── Reduction-aware metadata ──

/**
 * How important a shape is when rasterized small.
 *
 * - must-survive: identity cue — if lost, the character is unreadable
 * - prefer-survive: strongly desired but can degrade gracefully
 * - droppable: fussy detail that should vanish at small sizes
 */
export type SurvivalHint = 'must-survive' | 'prefer-survive' | 'droppable';

/**
 * Reduction metadata attached to each shape.
 *
 * Informs the rasterizer and reduction analysis which shapes
 * carry identity and which are expendable detail.
 */
export interface VectorReductionMeta {
  /** Identity cue tag (e.g. "hood", "bow", "cape", "boots"). */
  cueTag?: string;
  /** How critical this shape is at small sizes. */
  survivalHint?: SurvivalHint;
  /** Drop priority — higher drops first (0 = never auto-drop). */
  dropPriority?: number;
  /** Free-form design notes. */
  notes?: string;
}

// ── Shape ──

/**
 * A single vector shape in the master document.
 *
 * Design rule: one shape per idea — hood, cape, bow, boots, shoulder pad,
 * chest emblem each need a distinct readable mass.
 */
export interface VectorShape {
  id: VectorShapeId;
  /** Human-readable name (e.g. "hood", "bow", "left boot"). */
  name: string;
  /** Which group this shape belongs to (null = ungrouped). */
  groupId: VectorGroupId | null;
  /** Z-order index (0 = bottom). */
  zOrder: number;
  /** Shape geometry. */
  geometry: VectorGeometry;
  /** Fill color (null = no fill). */
  fill: Rgba | null;
  /** Stroke style (null = no stroke). */
  stroke: VectorStroke | null;
  /** Per-shape transform. */
  transform: VectorTransform;
  /** Reduction-aware metadata. */
  reduction: VectorReductionMeta;
  /** Whether this shape is visible. */
  visible: boolean;
  /** Whether this shape is locked (not editable). */
  locked: boolean;
}

// ── Group ──

/**
 * A named group of shapes (one level — no nesting).
 *
 * Groups map to body regions or gear sets:
 * hood + head, bow + hand, chest + belt, lid + glow + gem.
 */
export interface VectorGroup {
  id: VectorGroupId;
  /** Human-readable name (e.g. "head", "torso", "weapon"). */
  name: string;
  /** Z-order for the group as a whole (0 = bottom). */
  zOrder: number;
  /** Whether all shapes in this group are visible. */
  visible: boolean;
  /** Whether all shapes in this group are locked. */
  locked: boolean;
}

// ── Document ──

/**
 * The vector master document — the design-phase source of truth.
 *
 * Stored as .glyphvec. Built for reduction: exaggerated proportions,
 * chunky shapes, clear silhouettes, spaced limbs.
 */
export interface VectorMasterDocument {
  id: VectorMasterId;
  name: string;
  /** Artboard width in design pixels (default 500). */
  artboardWidth: number;
  /** Artboard height in design pixels (default 500). */
  artboardHeight: number;
  /** Ordered shape list (z-order sorted). */
  shapes: VectorShape[];
  /** Shape groups. */
  groups: VectorGroup[];
  /** Design palette for this master. */
  palette: Rgba[];
  createdAt: string;
  updatedAt: string;
}

// ── Source link (stored in .glyph raster docs) ──

/**
 * Lightweight link from a raster sprite back to its vector master source.
 *
 * Stored in the raster .glyph doc to track provenance.
 */
export interface VectorSourceLink {
  /** Path or ID of the source .glyphvec file. */
  sourceFile: string;
  /** Artboard dimensions of the source master. */
  sourceArtboardWidth: number;
  sourceArtboardHeight: number;
  /** Size profile ID used for rasterization. */
  profileId: string;
  /** ISO timestamp of last rasterization. */
  rasterizedAt: string;
}

// ── Defaults ──

export const DEFAULT_ARTBOARD_WIDTH = 500;
export const DEFAULT_ARTBOARD_HEIGHT = 500;

export const DEFAULT_VECTOR_TRANSFORM: VectorTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
};

export const DEFAULT_REDUCTION_META: VectorReductionMeta = {};

// ── ID generators ──

export function generateVectorMasterId(): VectorMasterId {
  return `vm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateVectorShapeId(): VectorShapeId {
  return `vs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateVectorGroupId(): VectorGroupId {
  return `vg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Factory functions ──

/** Create a new empty vector master document. */
export function createVectorMasterDocument(
  name: string,
  artboardWidth: number = DEFAULT_ARTBOARD_WIDTH,
  artboardHeight: number = DEFAULT_ARTBOARD_HEIGHT,
): VectorMasterDocument {
  const now = new Date().toISOString();
  return {
    id: generateVectorMasterId(),
    name,
    artboardWidth,
    artboardHeight,
    shapes: [],
    groups: [],
    palette: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Create a rect shape with sensible defaults. */
export function createRectShape(
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: Rgba | null = null,
): VectorShape {
  return {
    id: generateVectorShapeId(),
    name,
    groupId: null,
    zOrder: 0,
    geometry: { kind: 'rect', x, y, w, h },
    fill,
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  };
}

/** Create an ellipse shape with sensible defaults. */
export function createEllipseShape(
  name: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: Rgba | null = null,
): VectorShape {
  return {
    id: generateVectorShapeId(),
    name,
    groupId: null,
    zOrder: 0,
    geometry: { kind: 'ellipse', cx, cy, rx, ry },
    fill,
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  };
}

/** Create a line shape with sensible defaults. */
export function createLineShape(
  name: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: VectorStroke | null = null,
): VectorShape {
  return {
    id: generateVectorShapeId(),
    name,
    groupId: null,
    zOrder: 0,
    geometry: { kind: 'line', x1, y1, x2, y2 },
    fill: null,
    stroke,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  };
}

/** Create a polygon shape with sensible defaults. */
export function createPolygonShape(
  name: string,
  points: ReadonlyArray<{ x: number; y: number }>,
  fill: Rgba | null = null,
): VectorShape {
  if (points.length < 3) {
    throw new Error('Polygon requires at least 3 points');
  }
  return {
    id: generateVectorShapeId(),
    name,
    groupId: null,
    zOrder: 0,
    geometry: { kind: 'polygon', points },
    fill,
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  };
}

/** Create a vector group. */
export function createVectorGroup(name: string, zOrder: number = 0): VectorGroup {
  return {
    id: generateVectorGroupId(),
    name,
    zOrder,
    visible: true,
    locked: false,
  };
}
