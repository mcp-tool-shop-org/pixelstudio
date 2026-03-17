/**
 * Vector-to-pixel rasterizer.
 *
 * Rasterizes a VectorMasterDocument to a SpritePixelBuffer at any target size.
 * All coordinates snap to integer pixels — no anti-aliasing, no sub-pixel blur.
 *
 * Law: a shape that is < 1px wide at target size gets clamped to 1px minimum.
 * It never disappears.
 */

import type {
  VectorMasterDocument,
  VectorShape,
  VectorGeometry,
  VectorTransform,
  RectGeometry,
  EllipseGeometry,
  LineGeometry,
  PolygonGeometry,
  PathGeometry,
  Rgba,
  SpritePixelBuffer,
} from '@glyphstudio/domain';
import { createBlankPixelBuffer, flattenPath } from '@glyphstudio/domain';

// ── Alpha compositing ──

/** Composite src over dst using standard alpha blending. */
function alphaBlend(dst: Rgba, src: Rgba): Rgba {
  const sa = src[3] / 255;
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA === 0) return [0, 0, 0, 0];
  const r = Math.round((src[0] * sa + dst[0] * da * (1 - sa)) / outA);
  const g = Math.round((src[1] * sa + dst[1] * da * (1 - sa)) / outA);
  const b = Math.round((src[2] * sa + dst[2] * da * (1 - sa)) / outA);
  return [r, g, b, Math.round(outA * 255)];
}

/** Read pixel from buffer. */
function readPixel(buf: SpritePixelBuffer, x: number, y: number): Rgba {
  const i = (y * buf.width + x) * 4;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2], buf.data[i + 3]];
}

/** Write pixel to buffer with alpha compositing. */
function compositePixel(buf: SpritePixelBuffer, x: number, y: number, color: Rgba): void {
  if (x < 0 || x >= buf.width || y < 0 || y >= buf.height) return;
  if (color[3] === 0) return;
  if (color[3] === 255) {
    const i = (y * buf.width + x) * 4;
    buf.data[i] = color[0];
    buf.data[i + 1] = color[1];
    buf.data[i + 2] = color[2];
    buf.data[i + 3] = 255;
    return;
  }
  const dst = readPixel(buf, x, y);
  const blended = alphaBlend(dst, color);
  const i = (y * buf.width + x) * 4;
  buf.data[i] = blended[0];
  buf.data[i + 1] = blended[1];
  buf.data[i + 2] = blended[2];
  buf.data[i + 3] = blended[3];
}

// ── Coordinate transform ──

/** Apply VectorTransform to a point, returning transformed artboard coords. */
export function transformPoint(
  px: number,
  py: number,
  t: VectorTransform,
): [number, number] {
  // Apply scale
  let x = px * t.scaleX;
  let y = py * t.scaleY;
  // Apply flip
  if (t.flipX) x = -x;
  if (t.flipY) y = -y;
  // Apply rotation (degrees → radians)
  if (t.rotation !== 0) {
    const rad = (t.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx;
    y = ry;
  }
  // Apply translation
  return [x + t.x, y + t.y];
}

/** Scale an artboard coordinate to target pixel space. */
function toTarget(
  artboardVal: number,
  artboardSize: number,
  targetSize: number,
): number {
  return Math.round((artboardVal / artboardSize) * targetSize);
}

/** Scale a dimension, clamping to minimum 1px. */
function toTargetDim(
  artboardVal: number,
  artboardSize: number,
  targetSize: number,
): number {
  return Math.max(1, Math.round((artboardVal / artboardSize) * targetSize));
}

// ── Shape rasterizers ──

function rasterizeRect(
  geo: RectGeometry,
  t: VectorTransform,
  fill: Rgba | null,
  stroke: { color: Rgba; width: number } | null,
  buf: SpritePixelBuffer,
  artW: number,
  artH: number,
): void {
  // Transform the four corners
  const corners = [
    [geo.x, geo.y],
    [geo.x + geo.w, geo.y],
    [geo.x + geo.w, geo.y + geo.h],
    [geo.x, geo.y + geo.h],
  ].map(([cx, cy]) => transformPoint(cx, cy, t));

  // For axis-aligned (no rotation/flip), use fast path
  if (t.rotation === 0 && !t.flipX && !t.flipY) {
    const x0 = toTarget(corners[0][0], artW, buf.width);
    const y0 = toTarget(corners[0][1], artH, buf.height);
    const x1 = Math.max(x0 + 1, toTarget(corners[2][0], artW, buf.width));
    const y1 = Math.max(y0 + 1, toTarget(corners[2][1], artH, buf.height));

    if (fill) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          compositePixel(buf, x, y, fill);
        }
      }
    }
    if (stroke) {
      const sw = Math.max(1, toTargetDim(stroke.width, artW, buf.width));
      drawRectStroke(buf, x0, y0, x1 - 1, y1 - 1, stroke.color, sw);
    }
    return;
  }

  // Rotated/flipped: rasterize as polygon
  const scaledCorners = corners.map(([cx, cy]): { x: number; y: number } => ({
    x: toTarget(cx, artW, buf.width),
    y: toTarget(cy, artH, buf.height),
  }));

  if (fill) {
    scanlineFillPolygon(buf, scaledCorners, fill);
  }
  if (stroke) {
    drawPolygonStroke(buf, scaledCorners, stroke.color, Math.max(1, toTargetDim(stroke.width, artW, buf.width)));
  }
}

function drawRectStroke(
  buf: SpritePixelBuffer,
  x0: number, y0: number, x1: number, y1: number,
  color: Rgba, sw: number,
): void {
  // Top edge
  for (let dy = 0; dy < sw; dy++) {
    for (let x = x0; x <= x1; x++) compositePixel(buf, x, y0 + dy, color);
  }
  // Bottom edge
  for (let dy = 0; dy < sw; dy++) {
    for (let x = x0; x <= x1; x++) compositePixel(buf, x, y1 - dy, color);
  }
  // Left edge
  for (let dx = 0; dx < sw; dx++) {
    for (let y = y0; y <= y1; y++) compositePixel(buf, x0 + dx, y, color);
  }
  // Right edge
  for (let dx = 0; dx < sw; dx++) {
    for (let y = y0; y <= y1; y++) compositePixel(buf, x1 - dx, y, color);
  }
}

function rasterizeEllipse(
  geo: EllipseGeometry,
  t: VectorTransform,
  fill: Rgba | null,
  stroke: { color: Rgba; width: number } | null,
  buf: SpritePixelBuffer,
  artW: number,
  artH: number,
): void {
  const [tcx, tcy] = transformPoint(geo.cx, geo.cy, t);
  const cx = toTarget(tcx, artW, buf.width);
  const cy = toTarget(tcy, artH, buf.height);

  // Scale radii accounting for transform scale
  const srx = Math.abs(geo.rx * t.scaleX);
  const sry = Math.abs(geo.ry * t.scaleY);
  const rx = Math.max(1, toTargetDim(srx, artW, buf.width));
  const ry = Math.max(1, toTargetDim(sry, artH, buf.height));

  if (fill) {
    // Scanline ellipse fill
    for (let dy = -ry; dy <= ry; dy++) {
      // Solve for x: (dx/rx)^2 + (dy/ry)^2 <= 1
      const xSpan = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
      for (let dx = -xSpan; dx <= xSpan; dx++) {
        compositePixel(buf, cx + dx, cy + dy, fill);
      }
    }
  }

  if (stroke) {
    const sw = Math.max(1, toTargetDim(stroke.width, artW, buf.width));
    // Outline: draw pixels that are on the edge
    for (let dy = -(ry + sw); dy <= ry + sw; dy++) {
      for (let dx = -(rx + sw); dx <= rx + sw; dx++) {
        const d = (dx * dx) / ((rx + 0.5) * (rx + 0.5)) + (dy * dy) / ((ry + 0.5) * (ry + 0.5));
        const dInner = rx > sw && ry > sw
          ? (dx * dx) / ((rx - sw + 0.5) * (rx - sw + 0.5)) + (dy * dy) / ((ry - sw + 0.5) * (ry - sw + 0.5))
          : 0;
        if (d <= 1 && dInner > 1) {
          compositePixel(buf, cx + dx, cy + dy, stroke.color);
        }
      }
    }
  }
}

function rasterizeLine(
  geo: LineGeometry,
  t: VectorTransform,
  stroke: { color: Rgba; width: number } | null,
  buf: SpritePixelBuffer,
  artW: number,
  artH: number,
): void {
  if (!stroke) return; // Lines without stroke are invisible

  const [tx1, ty1] = transformPoint(geo.x1, geo.y1, t);
  const [tx2, ty2] = transformPoint(geo.x2, geo.y2, t);
  const x1 = toTarget(tx1, artW, buf.width);
  const y1 = toTarget(ty1, artH, buf.height);
  const x2 = toTarget(tx2, artW, buf.width);
  const y2 = toTarget(ty2, artH, buf.height);

  const sw = Math.max(1, toTargetDim(stroke.width, artW, buf.width));
  const points = bresenhamLine(x1, y1, x2, y2);

  for (const [px, py] of points) {
    if (sw === 1) {
      compositePixel(buf, px, py, stroke.color);
    } else {
      // Thicken with a square brush
      const half = Math.floor(sw / 2);
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          compositePixel(buf, px + dx, py + dy, stroke.color);
        }
      }
    }
  }
}

function rasterizePolygon(
  geo: PolygonGeometry,
  t: VectorTransform,
  fill: Rgba | null,
  stroke: { color: Rgba; width: number } | null,
  buf: SpritePixelBuffer,
  artW: number,
  artH: number,
): void {
  const scaledPoints = geo.points.map((p) => {
    const [tx, ty] = transformPoint(p.x, p.y, t);
    return {
      x: toTarget(tx, artW, buf.width),
      y: toTarget(ty, artH, buf.height),
    };
  });

  if (fill) {
    scanlineFillPolygon(buf, scaledPoints, fill);
  }
  if (stroke) {
    drawPolygonStroke(buf, scaledPoints, stroke.color, Math.max(1, toTargetDim(stroke.width, artW, buf.width)));
  }
}

function rasterizePath(
  geo: PathGeometry,
  t: VectorTransform,
  fill: Rgba | null,
  stroke: { color: Rgba; width: number } | null,
  buf: SpritePixelBuffer,
  artW: number,
  artH: number,
): void {
  // Flatten curves to polygon points in artboard space
  const flatPoints = flattenPath(geo, 2);
  if (flatPoints.length < 2) return;

  // Transform and scale to target
  const scaledPoints = flatPoints.map((p) => {
    const [tx, ty] = transformPoint(p.x, p.y, t);
    return {
      x: toTarget(tx, artW, buf.width),
      y: toTarget(ty, artH, buf.height),
    };
  });

  if (fill && geo.closed && scaledPoints.length >= 3) {
    scanlineFillPolygon(buf, scaledPoints, fill);
  }
  if (stroke) {
    const sw = Math.max(1, toTargetDim(stroke.width, artW, buf.width));
    if (geo.closed && scaledPoints.length >= 3) {
      drawPolygonStroke(buf, scaledPoints, stroke.color, sw);
    } else {
      // Open path — draw edges but don't close
      drawOpenPathStroke(buf, scaledPoints, stroke.color, sw);
    }
  }
}

/** Stroke an open path (no closing segment). */
function drawOpenPathStroke(
  buf: SpritePixelBuffer,
  points: ReadonlyArray<{ x: number; y: number }>,
  color: Rgba,
  sw: number,
): void {
  for (let i = 0; i < points.length - 1; i++) {
    const line = bresenhamLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    for (const [px, py] of line) {
      if (sw === 1) {
        compositePixel(buf, px, py, color);
      } else {
        const half = Math.floor(sw / 2);
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            compositePixel(buf, px + dx, py + dy, color);
          }
        }
      }
    }
  }
}

// ── Scanline polygon fill (even-odd rule) ──

function scanlineFillPolygon(
  buf: SpritePixelBuffer,
  points: ReadonlyArray<{ x: number; y: number }>,
  color: Rgba,
): void {
  if (points.length < 3) return;

  const n = points.length;
  let minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, minY);
  maxY = Math.min(buf.height - 1, maxY);

  for (let y = minY; y <= maxY; y++) {
    // Collect x-intersections with edges
    const xIntersections: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const yi = points[i].y;
      const yj = points[j].y;
      if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
        const t = (y - yi) / (yj - yi);
        xIntersections.push(Math.round(points[i].x + t * (points[j].x - points[i].x)));
      }
    }
    xIntersections.sort((a, b) => a - b);

    // Fill between pairs (even-odd rule)
    for (let k = 0; k < xIntersections.length - 1; k += 2) {
      const xStart = Math.max(0, xIntersections[k]);
      const xEnd = Math.min(buf.width - 1, xIntersections[k + 1]);
      for (let x = xStart; x <= xEnd; x++) {
        compositePixel(buf, x, y, color);
      }
    }
  }
}

// ── Polygon stroke ──

function drawPolygonStroke(
  buf: SpritePixelBuffer,
  points: ReadonlyArray<{ x: number; y: number }>,
  color: Rgba,
  sw: number,
): void {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const line = bresenhamLine(points[i].x, points[i].y, points[j].x, points[j].y);
    for (const [px, py] of line) {
      if (sw === 1) {
        compositePixel(buf, px, py, color);
      } else {
        const half = Math.floor(sw / 2);
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            compositePixel(buf, px + dx, py + dy, color);
          }
        }
      }
    }
  }
}

// ── Bresenham line (local copy to avoid circular dep) ──

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;

  while (true) {
    points.push([cx, cy]);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return points;
}

// ── Public API ──

/**
 * Rasterize a single vector shape onto a target-size pixel buffer.
 *
 * This is the low-level workhorse — rasterizeVectorMaster calls this
 * for each visible shape in z-order.
 */
export function rasterizeShape(
  shape: VectorShape,
  buf: SpritePixelBuffer,
  artboardWidth: number,
  artboardHeight: number,
): void {
  if (!shape.visible) return;
  if (!shape.fill && !shape.stroke) return;

  const geo = shape.geometry;
  const t = shape.transform;
  const fill = shape.fill;
  const stroke = shape.stroke;

  switch (geo.kind) {
    case 'rect':
      rasterizeRect(geo, t, fill, stroke, buf, artboardWidth, artboardHeight);
      break;
    case 'ellipse':
      rasterizeEllipse(geo, t, fill, stroke, buf, artboardWidth, artboardHeight);
      break;
    case 'line':
      rasterizeLine(geo, t, stroke, buf, artboardWidth, artboardHeight);
      break;
    case 'polygon':
      rasterizePolygon(geo, t, fill, stroke, buf, artboardWidth, artboardHeight);
      break;
    case 'path':
      rasterizePath(geo, t, fill, stroke, buf, artboardWidth, artboardHeight);
      break;
  }
}

/**
 * Rasterize a full VectorMasterDocument to a pixel buffer at a target size.
 *
 * Shapes are composited in z-order (lowest first). Hidden shapes are skipped.
 * All coordinates snap to integer pixels — no anti-aliasing.
 */
export function rasterizeVectorMaster(
  doc: VectorMasterDocument,
  targetWidth: number,
  targetHeight: number,
): SpritePixelBuffer {
  const buf = createBlankPixelBuffer(targetWidth, targetHeight);

  // Sort shapes by z-order (lowest first = painted first = behind)
  const sorted = [...doc.shapes].sort((a, b) => a.zOrder - b.zOrder);

  for (const shape of sorted) {
    rasterizeShape(shape, buf, doc.artboardWidth, doc.artboardHeight);
  }

  return buf;
}

/**
 * Check if a shape would collapse (< 1px in any dimension) at the given target size.
 *
 * Returns true if the shape's bounding extent in either axis rounds to 0 at the target.
 * The rasterizer clamps to 1px minimum, so collapsed shapes still render —
 * but this check is useful for reduction analysis.
 */
export function wouldShapeCollapse(
  shape: VectorShape,
  artboardWidth: number,
  artboardHeight: number,
  targetWidth: number,
  targetHeight: number,
): boolean {
  const geo = shape.geometry;
  let extentX = 0;
  let extentY = 0;

  switch (geo.kind) {
    case 'rect':
      extentX = geo.w * Math.abs(shape.transform.scaleX);
      extentY = geo.h * Math.abs(shape.transform.scaleY);
      break;
    case 'ellipse':
      extentX = geo.rx * 2 * Math.abs(shape.transform.scaleX);
      extentY = geo.ry * 2 * Math.abs(shape.transform.scaleY);
      break;
    case 'line': {
      extentX = Math.abs(geo.x2 - geo.x1) * Math.abs(shape.transform.scaleX);
      extentY = Math.abs(geo.y2 - geo.y1) * Math.abs(shape.transform.scaleY);
      // Lines have extent in at least one axis; check the larger one
      const maxExtent = Math.max(extentX, extentY);
      const maxArt = Math.max(artboardWidth, artboardHeight);
      const maxTarget = Math.max(targetWidth, targetHeight);
      return Math.round((maxExtent / maxArt) * maxTarget) < 1;
    }
    case 'polygon': {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of geo.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      extentX = (maxX - minX) * Math.abs(shape.transform.scaleX);
      extentY = (maxY - minY) * Math.abs(shape.transform.scaleY);
      break;
    }
    case 'path': {
      // Flatten path to get actual bounds including curve bulge
      const flat = flattenPath(geo, 2);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of flat) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      extentX = (maxX - minX) * Math.abs(shape.transform.scaleX);
      extentY = (maxY - minY) * Math.abs(shape.transform.scaleY);
      break;
    }
  }

  const pixW = Math.round((extentX / artboardWidth) * targetWidth);
  const pixH = Math.round((extentY / artboardHeight) * targetHeight);
  return pixW < 1 || pixH < 1;
}
