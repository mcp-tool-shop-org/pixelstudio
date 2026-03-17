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

// ── Path geometry (quadratic curves) ──

/** A point on a path — anchor position + point type. */
export interface PathPoint {
  /** Anchor position X. */
  x: number;
  /** Anchor position Y. */
  y: number;
  /**
   * Point type:
   * - 'corner': sharp junction — no tangent constraint
   * - 'smooth': tangent is continuous across this point
   */
  pointType: 'corner' | 'smooth';
}

/**
 * A segment connects two consecutive path points.
 *
 * - 'line': straight segment from previous point to next point
 * - 'quadratic': quadratic Bézier from previous point through cpX,cpY to next point
 */
export type PathSegment =
  | { kind: 'line' }
  | { kind: 'quadratic'; cpX: number; cpY: number };

/**
 * Path geometry — a sequence of points connected by line or quadratic curve segments.
 *
 * Supports open and closed paths. Mixed line + curve segments in one path.
 * Designed for organic forms: tails, capes, flames, muscle contours.
 *
 * segments[i] connects points[i] to points[i+1] (or points[0] if closed and i === last).
 * For a closed path with N points, there are N segments.
 * For an open path with N points, there are N-1 segments.
 */
export interface PathGeometry {
  kind: 'path';
  /** Ordered anchor points. Minimum 2. */
  points: ReadonlyArray<PathPoint>;
  /** Segments connecting consecutive points. */
  segments: ReadonlyArray<PathSegment>;
  /** Whether the path is closed (last point connects back to first). */
  closed: boolean;
}

/** Union of all supported geometry types. */
export type VectorGeometry =
  | RectGeometry
  | EllipseGeometry
  | LineGeometry
  | PolygonGeometry
  | PathGeometry;

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

/** Create a path shape with sensible defaults. */
export function createPathShape(
  name: string,
  points: ReadonlyArray<PathPoint>,
  segments: ReadonlyArray<PathSegment>,
  closed: boolean,
  fill: Rgba | null = null,
): VectorShape {
  if (points.length < 2) {
    throw new Error('Path requires at least 2 points');
  }
  const expectedSegments = closed ? points.length : points.length - 1;
  if (segments.length !== expectedSegments) {
    throw new Error(
      `Path with ${points.length} points and closed=${closed} requires ${expectedSegments} segments, got ${segments.length}`,
    );
  }
  return {
    id: generateVectorShapeId(),
    name,
    groupId: null,
    zOrder: 0,
    geometry: { kind: 'path', points, segments, closed },
    fill,
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  };
}

// ── Path editing operations ──

/**
 * Evaluate a quadratic Bézier at parameter t.
 * P(t) = (1-t)²·P0 + 2(1-t)t·CP + t²·P1
 */
export function evalQuadratic(
  p0x: number, p0y: number,
  cpx: number, cpy: number,
  p1x: number, p1y: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * p0x + 2 * mt * t * cpx + t * t * p1x,
    y: mt * mt * p0y + 2 * mt * t * cpy + t * t * p1y,
  };
}

/**
 * Flatten a path geometry into polygon points for rasterization.
 *
 * Quadratic curves are subdivided via de Casteljau until segments are
 * shorter than `tolerance` pixels in artboard space. Line segments
 * contribute their endpoints directly.
 *
 * @param geo - Path geometry to flatten
 * @param tolerance - Max distance between subdivision points (default 2px artboard)
 * @returns Array of {x, y} points suitable for scanline fill
 */
export function flattenPath(
  geo: PathGeometry,
  tolerance: number = 2,
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  const pts = geo.points;
  const segs = geo.segments;
  const n = pts.length;

  if (n < 2) return result;

  // Add first point
  result.push({ x: pts[0].x, y: pts[0].y });

  const segCount = geo.closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const seg = segs[i];

    if (seg.kind === 'line') {
      result.push({ x: p1.x, y: p1.y });
    } else {
      // Quadratic Bézier — adaptive subdivision
      flattenQuadratic(
        p0.x, p0.y,
        seg.cpX, seg.cpY,
        p1.x, p1.y,
        tolerance,
        result,
      );
    }
  }

  return result;
}

/**
 * Adaptively subdivide a quadratic Bézier curve into line segments.
 * Uses midpoint distance criterion for subdivision.
 */
function flattenQuadratic(
  p0x: number, p0y: number,
  cpx: number, cpy: number,
  p1x: number, p1y: number,
  tolerance: number,
  result: Array<{ x: number; y: number }>,
): void {
  // Midpoint of the chord
  const mx = (p0x + p1x) / 2;
  const my = (p0y + p1y) / 2;
  // Distance from control point to chord midpoint
  const dx = cpx - mx;
  const dy = cpy - my;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= tolerance) {
    // Flat enough — just add the endpoint
    result.push({ x: p1x, y: p1y });
  } else {
    // Subdivide at t=0.5 using de Casteljau
    const q0x = (p0x + cpx) / 2;
    const q0y = (p0y + cpy) / 2;
    const q1x = (cpx + p1x) / 2;
    const q1y = (cpy + p1y) / 2;
    const midx = (q0x + q1x) / 2;
    const midy = (q0y + q1y) / 2;

    flattenQuadratic(p0x, p0y, q0x, q0y, midx, midy, tolerance, result);
    flattenQuadratic(midx, midy, q1x, q1y, p1x, p1y, tolerance, result);
  }
}

// ── Path point editing ──

/** Add a point to a path at the given index, splitting the segment. */
export function pathAddPoint(
  geo: PathGeometry,
  index: number,
  point: PathPoint,
): PathGeometry {
  const pts = [...geo.points];
  const segs = [...geo.segments];
  const segCount = geo.closed ? pts.length : pts.length - 1;

  if (index < 0 || index > pts.length) {
    throw new Error(`Index ${index} out of bounds for path with ${pts.length} points`);
  }

  // Insert at the end of an open path — add a line segment
  if (index === pts.length && !geo.closed) {
    pts.push(point);
    segs.push({ kind: 'line' });
    return { kind: 'path', points: pts, segments: segs, closed: geo.closed };
  }

  // Insert in the middle — split the preceding segment
  if (index > 0 && index <= segCount) {
    const segIdx = index - 1;
    const oldSeg = segs[segIdx];

    if (oldSeg.kind === 'line') {
      // Split line into two lines
      pts.splice(index, 0, point);
      segs.splice(segIdx, 1, { kind: 'line' }, { kind: 'line' });
    } else {
      // Split quadratic at t=0.5
      const p0 = pts[segIdx];
      const p1 = pts[index % pts.length];
      const q0x = (p0.x + oldSeg.cpX) / 2;
      const q0y = (p0.y + oldSeg.cpY) / 2;
      const q1x = (oldSeg.cpX + p1.x) / 2;
      const q1y = (oldSeg.cpY + p1.y) / 2;

      pts.splice(index, 0, point);
      segs.splice(segIdx, 1,
        { kind: 'quadratic', cpX: q0x, cpY: q0y },
        { kind: 'quadratic', cpX: q1x, cpY: q1y },
      );
    }
    return { kind: 'path', points: pts, segments: segs, closed: geo.closed };
  }

  // Insert at start
  pts.splice(0, 0, point);
  segs.splice(0, 0, { kind: 'line' });
  return { kind: 'path', points: pts, segments: segs, closed: geo.closed };
}

/** Move a point on a path to a new position. */
export function pathMovePoint(
  geo: PathGeometry,
  index: number,
  x: number,
  y: number,
): PathGeometry {
  if (index < 0 || index >= geo.points.length) {
    throw new Error(`Index ${index} out of bounds for path with ${geo.points.length} points`);
  }
  const pts = geo.points.map((p, i) =>
    i === index ? { ...p, x, y } : p,
  );
  return { ...geo, points: pts };
}

/** Delete a point from a path, merging adjacent segments. */
export function pathDeletePoint(
  geo: PathGeometry,
  index: number,
): PathGeometry {
  if (index < 0 || index >= geo.points.length) {
    throw new Error(`Index ${index} out of bounds for path with ${geo.points.length} points`);
  }
  if (geo.points.length <= 2) {
    throw new Error('Cannot delete point: path needs at least 2 points');
  }

  const pts = [...geo.points];
  const segs = [...geo.segments];

  if (geo.closed) {
    // Remove point and one of its adjacent segments
    pts.splice(index, 1);
    const segIdx = index < segs.length ? index : index - 1;
    segs.splice(segIdx, 1);
    // If we removed the last segment in a closed path, adjust
    if (segs.length > pts.length) {
      segs.splice(segs.length - 1, 1);
    }
  } else {
    if (index === 0) {
      // Remove first point and first segment
      pts.splice(0, 1);
      segs.splice(0, 1);
    } else if (index === pts.length - 1) {
      // Remove last point and last segment
      pts.splice(index, 1);
      segs.splice(index - 1, 1);
    } else {
      // Remove middle point — merge to a line segment
      pts.splice(index, 1);
      segs.splice(index - 1, 2, { kind: 'line' });
    }
  }

  return { kind: 'path', points: pts, segments: segs, closed: geo.closed };
}

/** Set point type (smooth or corner) at given index. */
export function pathSetPointType(
  geo: PathGeometry,
  index: number,
  pointType: 'corner' | 'smooth',
): PathGeometry {
  if (index < 0 || index >= geo.points.length) {
    throw new Error(`Index ${index} out of bounds`);
  }
  const pts = geo.points.map((p, i) =>
    i === index ? { ...p, pointType } : p,
  );
  return { ...geo, points: pts };
}

/** Convert a segment between line and quadratic curve. */
export function pathConvertSegment(
  geo: PathGeometry,
  segIndex: number,
  toKind: 'line' | 'quadratic',
): PathGeometry {
  const maxSeg = geo.closed ? geo.points.length : geo.points.length - 1;
  if (segIndex < 0 || segIndex >= maxSeg) {
    throw new Error(`Segment index ${segIndex} out of bounds`);
  }

  const segs = [...geo.segments];
  const current = segs[segIndex];

  if (current.kind === toKind) return geo; // no-op

  if (toKind === 'line') {
    segs[segIndex] = { kind: 'line' };
  } else {
    // Convert line to quadratic — place control point at midpoint
    const p0 = geo.points[segIndex];
    const p1 = geo.points[(segIndex + 1) % geo.points.length];
    segs[segIndex] = {
      kind: 'quadratic',
      cpX: (p0.x + p1.x) / 2,
      cpY: (p0.y + p1.y) / 2,
    };
  }

  return { ...geo, segments: segs };
}

/** Toggle a path between open and closed. */
export function pathToggleClosed(geo: PathGeometry): PathGeometry {
  const segs = [...geo.segments];
  if (geo.closed) {
    // Close → open: remove last segment
    segs.pop();
  } else {
    // Open → close: add a line segment from last to first
    segs.push({ kind: 'line' });
  }
  return { kind: 'path', points: geo.points, segments: segs, closed: !geo.closed };
}

/** Move a control point on a quadratic segment. */
export function pathMoveControlPoint(
  geo: PathGeometry,
  segIndex: number,
  cpX: number,
  cpY: number,
): PathGeometry {
  const maxSeg = geo.closed ? geo.points.length : geo.points.length - 1;
  if (segIndex < 0 || segIndex >= maxSeg) {
    throw new Error(`Segment index ${segIndex} out of bounds`);
  }
  const seg = geo.segments[segIndex];
  if (seg.kind !== 'quadratic') {
    throw new Error('Cannot move control point on a line segment');
  }
  const segs = geo.segments.map((s, i) =>
    i === segIndex ? { kind: 'quadratic' as const, cpX, cpY } : s,
  );
  return { ...geo, segments: segs };
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
