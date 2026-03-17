/**
 * Pure pixel-math utilities extracted from Canvas.tsx.
 *
 * These functions have no React or Tauri dependencies — they operate only on
 * numbers and are therefore fully unit-testable without DOM or framework setup.
 */
import type { DitherPattern } from '@glyphstudio/state';

// ---------------------------------------------------------------------------
// Shape rasterization
// ---------------------------------------------------------------------------

export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let cx = x0;
  let cy = y0;

  for (;;) {
    points.push([cx, cy]);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; cx += sx; }
    if (e2 <= dx) { err += dx; cy += sy; }
  }
  return points;
}

export function rectangleOutline(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const set = new Set<string>();
  const points: [number, number][] = [];
  const add = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (!set.has(key)) { set.add(key); points.push([x, y]); }
  };
  for (let x = minX; x <= maxX; x++) { add(x, minY); add(x, maxY); }
  for (let y = minY + 1; y < maxY; y++) { add(minX, y); add(maxX, y); }
  return points;
}

export function ellipseOutline(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  if (rx < 0.5 && ry < 0.5) return [[Math.round(cx), Math.round(cy)]];
  if (rx < 0.5) {
    const points: [number, number][] = [];
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) points.push([Math.round(cx), y]);
    return points;
  }
  if (ry < 0.5) {
    const points: [number, number][] = [];
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) points.push([x, Math.round(cy)]);
    return points;
  }
  // Midpoint ellipse algorithm
  const set = new Set<string>();
  const points: [number, number][] = [];
  const plot = (px: number, py: number) => {
    const ix = Math.round(cx + px);
    const iy = Math.round(cy + py);
    const key = `${ix},${iy}`;
    if (!set.has(key)) { set.add(key); points.push([ix, iy]); }
  };
  const plotSymmetric = (px: number, py: number) => {
    plot(px, py); plot(-px, py); plot(px, -py); plot(-px, -py);
  };
  let x = 0, y = ry;
  const rx2 = rx * rx, ry2 = ry * ry;
  let p1 = ry2 - rx2 * ry + 0.25 * rx2;
  let dx = 2 * ry2 * x, dy = 2 * rx2 * y;
  // Region 1
  while (dx < dy) {
    plotSymmetric(x, y);
    x++;
    dx += 2 * ry2;
    if (p1 < 0) { p1 += dx + ry2; }
    else { y--; dy -= 2 * rx2; p1 += dx - dy + ry2; }
  }
  // Region 2
  let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
  while (y >= 0) {
    plotSymmetric(x, y);
    y--;
    dy -= 2 * rx2;
    if (p2 > 0) { p2 += rx2 - dy; }
    else { x++; dx += 2 * ry2; p2 += dx - dy + rx2; }
  }
  return points;
}

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

export interface CanvasViewport {
  rectLeft: number;
  rectTop: number;
  rectWidth: number;
  rectHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  frameWidth: number;
  frameHeight: number;
}

/**
 * Convert a screen position (clientX/clientY) to canvas pixel coordinates.
 * Returns coordinates that may be outside [0, frameWidth) × [0, frameHeight).
 */
export function screenToCanvasPixelUnclamped(
  screenX: number,
  screenY: number,
  vp: CanvasViewport,
): { x: number; y: number } {
  const cx = screenX - vp.rectLeft;
  const cy = screenY - vp.rectTop;
  const centerX = vp.rectWidth / 2;
  const centerY = vp.rectHeight / 2;
  const originX = centerX - (vp.frameWidth * vp.zoom) / 2 + vp.panX;
  const originY = centerY - (vp.frameHeight * vp.zoom) / 2 + vp.panY;
  return {
    x: Math.floor((cx - originX) / vp.zoom),
    y: Math.floor((cy - originY) / vp.zoom),
  };
}

/**
 * Convert a screen position to canvas pixel coordinates, returning null if
 * the result falls outside the frame bounds.
 */
export function screenToCanvasPixelClamped(
  screenX: number,
  screenY: number,
  vp: CanvasViewport,
): { x: number; y: number } | null {
  const p = screenToCanvasPixelUnclamped(screenX, screenY, vp);
  if (p.x < 0 || p.y < 0 || p.x >= vp.frameWidth || p.y >= vp.frameHeight) return null;
  return p;
}

// ---------------------------------------------------------------------------
// Mirror drawing
// ---------------------------------------------------------------------------

export type MirrorMode = 'none' | 'h' | 'v' | 'both';

/**
 * Expand a set of stroke points by adding mirrored counterparts.
 *
 * For horizontal mirror: adds (w-1-x, y)
 * For vertical mirror:   adds (x, h-1-y)
 * For both:              adds all three mirror variants
 *
 * Duplicate points (e.g. when drawing exactly on the mirror axis) are
 * deduplicated so the backend does not paint them twice.
 */
export function applyMirrorPoints(
  points: [number, number][],
  frameWidth: number,
  frameHeight: number,
  mode: MirrorMode,
): [number, number][] {
  if (mode === 'none' || points.length === 0) return points;

  const seen = new Set<string>();
  const result: [number, number][] = [];

  function add(x: number, y: number) {
    const key = `${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push([x, y]);
    }
  }

  for (const [x, y] of points) {
    add(x, y);
    if (mode === 'h' || mode === 'both') add(frameWidth - 1 - x, y);
    if (mode === 'v' || mode === 'both') add(x, frameHeight - 1 - y);
    if (mode === 'both') add(frameWidth - 1 - x, frameHeight - 1 - y);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Shape construction helpers
// ---------------------------------------------------------------------------

/**
 * Constrain a shape's end point when Shift is held during drag.
 *
 * - line:              snaps to the nearest cardinal/diagonal (8-direction octagonal).
 * - rectangle/ellipse: forces a square/circle by equating dx and dy to the smaller axis.
 *
 * The function operates in pixel space. Any unknown tool passes through unchanged.
 *
 * @param tool  'line' | 'rectangle' | 'ellipse' (or any other string = no-op)
 * @param start drag origin pixel
 * @param end   current drag endpoint pixel (unconstrained)
 */
export function constrainShapeEnd(
  tool: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number } {
  let dx = end.x - start.x;
  let dy = end.y - start.y;

  if (dx === 0 && dy === 0) return end;

  if (tool === 'line') {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX >= 2 * absY) {
      // Horizontal — flatten y
      dy = 0;
    } else if (absY >= 2 * absX) {
      // Vertical — flatten x
      dx = 0;
    } else {
      // Diagonal — equalize to the shorter axis (true 45°)
      const size = Math.min(absX, absY);
      dx = Math.sign(dx) * size;
      dy = Math.sign(dy) * size;
    }
  } else if (tool === 'rectangle' || tool === 'ellipse') {
    // Force square / circle — use the shorter axis
    const size = Math.min(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx) * size;
    dy = Math.sign(dy) * size;
  }

  return { x: start.x + dx, y: start.y + dy };
}

// ---------------------------------------------------------------------------
// Dither pattern filter
// ---------------------------------------------------------------------------

/**
 * Whether pixel (x, y) passes the geometric pattern gate for the given dither
 * pattern. Independent of density.
 */
function patternGate(x: number, y: number, pattern: DitherPattern): boolean {
  switch (pattern) {
    case 'checker':      return (x + y) % 2 === 0;
    case 'diagonal':     return Math.abs(x - y) % 4 === 0;
    case 'cross':        return x % 4 === 0 || y % 4 === 0;
    case 'sparse-noise': return true; // density-only gate
  }
}

/**
 * Whether pixel (x, y) passes the density thinning gate.
 * Uses a position-stable hash so repeated strokes give consistent coverage.
 */
function densityGate(x: number, y: number, density: number): boolean {
  if (density >= 1.0) return true;
  // Multiplicative hash — stable, fast, no imports needed
  const h = (Math.abs((x * 2654435761) ^ (y * 2246822519)) >>> 0) % 1000;
  return h < density * 1000;
}

/**
 * Returns true if pixel (x, y) should be painted for the given dither pattern
 * and density. Used both by the point filter and by the ToolRail preview swatch.
 */
export function getDitherCellActive(
  x: number,
  y: number,
  pattern: DitherPattern,
  density: number,
): boolean {
  return patternGate(x, y, pattern) && densityGate(x, y, density);
}

/**
 * Filter a set of stroke points through the dither pattern + density gate,
 * optionally clipping to a selection rectangle.
 *
 * Call this BEFORE applyMirrorPoints so both mirror arms share the same
 * geometric pattern (giving symmetric dither when drawing with mirror on).
 */
export function applyDitherFilter(
  points: [number, number][],
  pattern: DitherPattern,
  density: number,
  selectionBounds?: { x: number; y: number; width: number; height: number } | null,
): [number, number][] {
  return points.filter(([x, y]) => {
    if (selectionBounds) {
      const { x: sx, y: sy, width: sw, height: sh } = selectionBounds;
      if (x < sx || x >= sx + sw || y < sy || y >= sy + sh) return false;
    }
    return getDitherCellActive(x, y, pattern, density);
  });
}
