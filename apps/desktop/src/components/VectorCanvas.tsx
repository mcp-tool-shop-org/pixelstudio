import { useRef, useEffect, useCallback, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import { useVectorMasterStore } from '@glyphstudio/state';
import type { CollapseOverlayData } from '@glyphstudio/state';
import type {
  VectorShape,
  VectorGeometry,
  VectorTransform,
  PathGeometry,
  PathPoint,
  PathSegment,
  Rgba,
} from '@glyphstudio/domain';
import { DEFAULT_VECTOR_TRANSFORM, flattenPath, pathMovePoint, pathMoveControlPoint } from '@glyphstudio/domain';

// ── Constants ──

const GRID_COLOR = 'rgba(255,255,255,0.04)';
const ARTBOARD_BG = '#1a1a1a';
const SELECTION_COLOR = '#4fc3f7';
const SELECTION_SHADOW = 'rgba(0, 0, 0, 0.6)';
const HOVER_COLOR = 'rgba(79, 195, 247, 0.15)';
const HOVER_STROKE = 'rgba(79, 195, 247, 0.4)';
const HANDLE_SIZE = 5; // pixels at 1x zoom
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

// ── Helpers ──

function rgbaToCSS(c: Rgba): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`;
}

function transformPoint(px: number, py: number, t: VectorTransform): [number, number] {
  let x = px * t.scaleX;
  let y = py * t.scaleY;
  if (t.flipX) x = -x;
  if (t.flipY) y = -y;
  if (t.rotation !== 0) {
    const rad = (t.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    x = rx; y = ry;
  }
  return [x + t.x, y + t.y];
}

// ── Shape rendering (Canvas2D) ──

function renderShape(ctx: CanvasRenderingContext2D, shape: VectorShape): void {
  if (!shape.visible) return;
  if (!shape.fill && !shape.stroke) return;

  const geo = shape.geometry;
  const t = shape.transform;

  ctx.save();
  ctx.translate(t.x, t.y);
  if (t.rotation !== 0) ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.flipX || t.flipY) ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
  ctx.scale(t.scaleX, t.scaleY);
  // Undo the translation we did with translate() since it's already in the transform
  ctx.translate(-t.x, -t.y);

  // Now draw the geometry in artboard space, transform handles the rest
  ctx.translate(t.x, t.y);

  switch (geo.kind) {
    case 'rect': {
      ctx.beginPath();
      if (geo.cornerRadius && geo.cornerRadius > 0) {
        roundRect(ctx, geo.x - t.x, geo.y - t.y, geo.w, geo.h, geo.cornerRadius);
      } else {
        ctx.rect(geo.x - t.x, geo.y - t.y, geo.w, geo.h);
      }
      break;
    }
    case 'ellipse': {
      ctx.beginPath();
      ctx.ellipse(geo.cx - t.x, geo.cy - t.y, Math.abs(geo.rx), Math.abs(geo.ry), 0, 0, Math.PI * 2);
      break;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(geo.x1 - t.x, geo.y1 - t.y);
      ctx.lineTo(geo.x2 - t.x, geo.y2 - t.y);
      break;
    }
    case 'polygon': {
      ctx.beginPath();
      if (geo.points.length > 0) {
        ctx.moveTo(geo.points[0].x - t.x, geo.points[0].y - t.y);
        for (let i = 1; i < geo.points.length; i++) {
          ctx.lineTo(geo.points[i].x - t.x, geo.points[i].y - t.y);
        }
        ctx.closePath();
      }
      break;
    }
    case 'path': {
      ctx.beginPath();
      const pts = geo.points;
      const segs = geo.segments;
      if (pts.length >= 2) {
        ctx.moveTo(pts[0].x - t.x, pts[0].y - t.y);
        const segCount = geo.closed ? pts.length : pts.length - 1;
        for (let i = 0; i < segCount; i++) {
          const p1 = pts[(i + 1) % pts.length];
          const seg = segs[i];
          if (seg.kind === 'line') {
            ctx.lineTo(p1.x - t.x, p1.y - t.y);
          } else {
            ctx.quadraticCurveTo(seg.cpX - t.x, seg.cpY - t.y, p1.x - t.x, p1.y - t.y);
          }
        }
        if (geo.closed) ctx.closePath();
      }
      break;
    }
  }

  if (shape.fill && geo.kind !== 'line') {
    ctx.fillStyle = rgbaToCSS(shape.fill);
    ctx.fill();
  }
  if (shape.stroke) {
    ctx.strokeStyle = rgbaToCSS(shape.stroke.color);
    ctx.lineWidth = shape.stroke.width;
    ctx.stroke();
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderSelectionOutline(ctx: CanvasRenderingContext2D, shape: VectorShape, zoom: number): void {
  const geo = shape.geometry;
  const t = shape.transform;

  // Dual-stroke selection: dark shadow underneath for contrast
  for (let pass = 0; pass < 2; pass++) {
    ctx.save();
    ctx.translate(t.x, t.y);
    if (t.rotation !== 0) ctx.rotate((t.rotation * Math.PI) / 180);
    if (t.flipX || t.flipY) ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
    ctx.scale(t.scaleX, t.scaleY);
    ctx.translate(-t.x, -t.y);
    ctx.translate(t.x, t.y);

    if (pass === 0) {
      ctx.strokeStyle = SELECTION_SHADOW;
      ctx.lineWidth = 3 / Math.max(t.scaleX, t.scaleY) / zoom;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5 / Math.max(t.scaleX, t.scaleY) / zoom;
      ctx.setLineDash([6 / zoom, 3 / zoom]);
    }

    switch (geo.kind) {
      case 'rect':
        ctx.strokeRect(geo.x - t.x, geo.y - t.y, geo.w, geo.h);
        break;
      case 'ellipse':
        ctx.beginPath();
        ctx.ellipse(geo.cx - t.x, geo.cy - t.y, Math.abs(geo.rx), Math.abs(geo.ry), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(geo.x1 - t.x, geo.y1 - t.y);
        ctx.lineTo(geo.x2 - t.x, geo.y2 - t.y);
        ctx.stroke();
        break;
      case 'polygon':
        if (geo.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(geo.points[0].x - t.x, geo.points[0].y - t.y);
          for (let i = 1; i < geo.points.length; i++) {
            ctx.lineTo(geo.points[i].x - t.x, geo.points[i].y - t.y);
          }
          ctx.closePath();
          ctx.stroke();
        }
        break;
      case 'path':
        if (geo.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(geo.points[0].x - t.x, geo.points[0].y - t.y);
          const segCount = geo.closed ? geo.points.length : geo.points.length - 1;
          for (let i = 0; i < segCount; i++) {
            const p1 = geo.points[(i + 1) % geo.points.length];
            const seg = geo.segments[i];
            if (seg.kind === 'line') {
              ctx.lineTo(p1.x - t.x, p1.y - t.y);
            } else {
              ctx.quadraticCurveTo(seg.cpX - t.x, seg.cpY - t.y, p1.x - t.x, p1.y - t.y);
            }
          }
          if (geo.closed) ctx.closePath();
          ctx.stroke();
        }
        break;
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  // Draw resize handles for rect/ellipse
  if (geo.kind === 'rect' || geo.kind === 'ellipse') {
    const hs = HANDLE_SIZE / zoom;
    let corners: Array<[number, number]>;
    if (geo.kind === 'rect') {
      corners = [
        [geo.x, geo.y], [geo.x + geo.w, geo.y],
        [geo.x + geo.w, geo.y + geo.h], [geo.x, geo.y + geo.h],
      ];
    } else {
      corners = [
        [geo.cx - geo.rx, geo.cy - geo.ry], [geo.cx + geo.rx, geo.cy - geo.ry],
        [geo.cx + geo.rx, geo.cy + geo.ry], [geo.cx - geo.rx, geo.cy + geo.ry],
      ];
    }
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1 / zoom;
    for (const [hx, hy] of corners) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
  }
}

function renderHoverHighlight(ctx: CanvasRenderingContext2D, shape: VectorShape, zoom: number): void {
  const geo = shape.geometry;
  const t = shape.transform;

  ctx.save();
  ctx.translate(t.x, t.y);
  if (t.rotation !== 0) ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.flipX || t.flipY) ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
  ctx.scale(t.scaleX, t.scaleY);
  ctx.translate(-t.x, -t.y);
  ctx.translate(t.x, t.y);

  ctx.fillStyle = HOVER_COLOR;
  ctx.strokeStyle = HOVER_STROKE;
  ctx.lineWidth = 1.5 / Math.max(t.scaleX, t.scaleY) / zoom;
  ctx.setLineDash([4 / zoom, 2 / zoom]);

  switch (geo.kind) {
    case 'rect':
      ctx.fillRect(geo.x - t.x, geo.y - t.y, geo.w, geo.h);
      ctx.strokeRect(geo.x - t.x, geo.y - t.y, geo.w, geo.h);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(geo.cx - t.x, geo.cy - t.y, Math.abs(geo.rx), Math.abs(geo.ry), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'polygon':
      if (geo.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(geo.points[0].x - t.x, geo.points[0].y - t.y);
        for (let i = 1; i < geo.points.length; i++) {
          ctx.lineTo(geo.points[i].x - t.x, geo.points[i].y - t.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'path':
      if (geo.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(geo.points[0].x - t.x, geo.points[0].y - t.y);
        const segCount = geo.closed ? geo.points.length : geo.points.length - 1;
        for (let i = 0; i < segCount; i++) {
          const p1 = geo.points[(i + 1) % geo.points.length];
          const seg = geo.segments[i];
          if (seg.kind === 'line') {
            ctx.lineTo(p1.x - t.x, p1.y - t.y);
          } else {
            ctx.quadraticCurveTo(seg.cpX - t.x, seg.cpY - t.y, p1.x - t.x, p1.y - t.y);
          }
        }
        if (geo.closed) { ctx.closePath(); ctx.fill(); }
        ctx.stroke();
      }
      break;
    case 'line':
      ctx.beginPath();
      ctx.moveTo(geo.x1 - t.x, geo.y1 - t.y);
      ctx.lineTo(geo.x2 - t.x, geo.y2 - t.y);
      ctx.stroke();
      break;
  }

  ctx.setLineDash([]);
  ctx.restore();
}

// ── Hit testing ──

function hitTestShape(shape: VectorShape, ax: number, ay: number): boolean {
  if (!shape.visible) return false;
  const geo = shape.geometry;
  // Simple AABB hit test (ignoring rotation for now)
  const t = shape.transform;
  const sx = t.scaleX;
  const sy = t.scaleY;

  switch (geo.kind) {
    case 'rect': {
      const x0 = geo.x * sx + t.x;
      const y0 = geo.y * sy + t.y;
      const x1 = (geo.x + geo.w) * sx + t.x;
      const y1 = (geo.y + geo.h) * sy + t.y;
      const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
      const ly = Math.min(y0, y1), ry = Math.max(y0, y1);
      return ax >= lx && ax <= rx && ay >= ly && ay <= ry;
    }
    case 'ellipse': {
      const cx = geo.cx * sx + t.x;
      const cy = geo.cy * sy + t.y;
      const erx = Math.abs(geo.rx * sx);
      const ery = Math.abs(geo.ry * sy);
      if (erx === 0 || ery === 0) return false;
      const dx = (ax - cx) / erx;
      const dy = (ay - cy) / ery;
      return dx * dx + dy * dy <= 1;
    }
    case 'line': {
      const x1 = geo.x1 * sx + t.x, y1 = geo.y1 * sy + t.y;
      const x2 = geo.x2 * sx + t.x, y2 = geo.y2 * sy + t.y;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (len === 0) return false;
      const d = Math.abs((y2 - y1) * ax - (x2 - x1) * ay + x2 * y1 - y2 * x1) / len;
      return d < 5; // 5px tolerance
    }
    case 'polygon': {
      // Even-odd point-in-polygon
      const pts = geo.points.map(p => ({ x: p.x * sx + t.x, y: p.y * sy + t.y }));
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if (((pts[i].y > ay) !== (pts[j].y > ay)) &&
          ax < (pts[j].x - pts[i].x) * (ay - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) {
          inside = !inside;
        }
      }
      return inside;
    }
    case 'path': {
      // Flatten path and use point-in-polygon for closed paths
      const flat = flattenPath(geo, 2).map(p => ({ x: p.x * sx + t.x, y: p.y * sy + t.y }));
      if (geo.closed && flat.length >= 3) {
        let inside = false;
        for (let i = 0, j = flat.length - 1; i < flat.length; j = i++) {
          if (((flat[i].y > ay) !== (flat[j].y > ay)) &&
            ax < (flat[j].x - flat[i].x) * (ay - flat[i].y) / (flat[j].y - flat[i].y) + flat[i].x) {
            inside = !inside;
          }
        }
        return inside;
      }
      // Open path: distance to each segment
      for (let i = 0; i < flat.length - 1; i++) {
        const x1 = flat[i].x, y1 = flat[i].y;
        const x2 = flat[i + 1].x, y2 = flat[i + 1].y;
        const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (len === 0) continue;
        const d = Math.abs((y2 - y1) * ax - (x2 - x1) * ay + x2 * y1 - y2 * x1) / len;
        if (d < 5) return true;
      }
      return false;
    }
  }
  return false;
}

// ── Path point/control-point hit testing ──

const POINT_HIT_RADIUS = 8;

interface PathHitResult {
  kind: 'point' | 'control';
  index: number;
}

function hitTestPathPoints(shape: VectorShape, ax: number, ay: number, zoom: number): PathHitResult | null {
  if (shape.geometry.kind !== 'path') return null;
  const geo = shape.geometry as PathGeometry;
  const t = shape.transform;
  const radius = POINT_HIT_RADIUS / zoom;

  // Test control points first (they're on top visually)
  const segCount = geo.closed ? geo.points.length : geo.points.length - 1;
  for (let i = 0; i < segCount; i++) {
    const seg = geo.segments[i];
    if (seg.kind === 'quadratic') {
      const cx = seg.cpX * t.scaleX + t.x;
      const cy = seg.cpY * t.scaleY + t.y;
      if (Math.abs(ax - cx) < radius && Math.abs(ay - cy) < radius) {
        return { kind: 'control', index: i };
      }
    }
  }

  // Test anchor points
  for (let i = 0; i < geo.points.length; i++) {
    const p = geo.points[i];
    const px = p.x * t.scaleX + t.x;
    const py = p.y * t.scaleY + t.y;
    if (Math.abs(ax - px) < radius && Math.abs(ay - py) < radius) {
      return { kind: 'point', index: i };
    }
  }

  return null;
}

// ── Render path edit overlay (points + handles) ──

function renderPathEditOverlay(ctx: CanvasRenderingContext2D, shape: VectorShape, zoom: number, selectedPointIdx: number | null): void {
  if (shape.geometry.kind !== 'path') return;
  const geo = shape.geometry as PathGeometry;
  const t = shape.transform;
  const pointSize = 5 / zoom;
  const cpSize = 4 / zoom;

  ctx.save();

  // Draw control handles (lines from anchor to control point)
  const segCount = geo.closed ? geo.points.length : geo.points.length - 1;
  for (let i = 0; i < segCount; i++) {
    const seg = geo.segments[i];
    if (seg.kind === 'quadratic') {
      const p0 = geo.points[i];
      const p1 = geo.points[(i + 1) % geo.points.length];
      const p0x = p0.x * t.scaleX + t.x;
      const p0y = p0.y * t.scaleY + t.y;
      const cpx = seg.cpX * t.scaleX + t.x;
      const cpy = seg.cpY * t.scaleY + t.y;
      const p1x = p1.x * t.scaleX + t.x;
      const p1y = p1.y * t.scaleY + t.y;

      // Handle lines — thicker for visibility
      ctx.strokeStyle = 'rgba(255, 150, 50, 0.7)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(cpx, cpy);
      ctx.lineTo(p1x, p1y);
      ctx.stroke();

      // Control point diamond
      ctx.fillStyle = '#ff9632';
      ctx.beginPath();
      ctx.moveTo(cpx, cpy - cpSize);
      ctx.lineTo(cpx + cpSize, cpy);
      ctx.lineTo(cpx, cpy + cpSize);
      ctx.lineTo(cpx - cpSize, cpy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Draw anchor points
  for (let i = 0; i < geo.points.length; i++) {
    const p = geo.points[i];
    const px = p.x * t.scaleX + t.x;
    const py = p.y * t.scaleY + t.y;
    const isSelected = i === selectedPointIdx;

    if (p.pointType === 'smooth') {
      // Smooth = circle
      ctx.fillStyle = isSelected ? '#ffffff' : SELECTION_COLOR;
      ctx.strokeStyle = isSelected ? '#ffffff' : SELECTION_COLOR;
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(px, py, pointSize, 0, Math.PI * 2);
      if (isSelected) { ctx.fill(); } else { ctx.stroke(); }
    } else {
      // Corner = square
      ctx.fillStyle = isSelected ? '#ffffff' : SELECTION_COLOR;
      ctx.strokeStyle = isSelected ? '#ffffff' : SELECTION_COLOR;
      ctx.lineWidth = 2 / zoom;
      if (isSelected) {
        ctx.fillRect(px - pointSize, py - pointSize, pointSize * 2, pointSize * 2);
      } else {
        ctx.strokeRect(px - pointSize, py - pointSize, pointSize * 2, pointSize * 2);
      }
    }
  }

  ctx.restore();
}

// ── Collapse overlay rendering ──

const RISK_COLORS = {
  safe: 'rgba(76, 175, 80, 0.5)',       // green
  'at-risk': 'rgba(255, 193, 7, 0.6)',  // amber
  collapses: 'rgba(244, 67, 54, 0.7)',  // red
};

const RISK_FILL_COLORS = {
  safe: 'rgba(76, 175, 80, 0.08)',
  'at-risk': 'rgba(255, 193, 7, 0.12)',
  collapses: 'rgba(244, 67, 54, 0.15)',
};

function renderCollapseOverlay(
  ctx: CanvasRenderingContext2D,
  shape: VectorShape,
  overlay: CollapseOverlayData,
  zoom: number,
): void {
  const info = overlay.shapes.get(shape.id);
  if (!info || info.level === 'safe') return;

  const geo = shape.geometry;
  const t = shape.transform;

  ctx.save();
  ctx.translate(t.x, t.y);
  if (t.rotation !== 0) ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.flipX || t.flipY) ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
  ctx.scale(t.scaleX, t.scaleY);
  ctx.translate(-t.x, -t.y);
  ctx.translate(t.x, t.y);

  const strokeColor = RISK_COLORS[info.level];
  const fillColor = RISK_FILL_COLORS[info.level];
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.lineWidth = (info.level === 'collapses' ? 3 : 2) / Math.max(t.scaleX, t.scaleY) / zoom;
  ctx.setLineDash(info.level === 'collapses' ? [] : [4 / zoom, 3 / zoom]);

  switch (geo.kind) {
    case 'rect':
      ctx.fillRect(geo.x - t.x, geo.y - t.y, geo.w, geo.h);
      ctx.strokeRect(geo.x - t.x, geo.y - t.y, geo.w, geo.h);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(geo.cx - t.x, geo.cy - t.y, Math.abs(geo.rx), Math.abs(geo.ry), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'line':
      ctx.beginPath();
      ctx.moveTo(geo.x1 - t.x, geo.y1 - t.y);
      ctx.lineTo(geo.x2 - t.x, geo.y2 - t.y);
      ctx.stroke();
      break;
    case 'polygon':
      if (geo.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(geo.points[0].x - t.x, geo.points[0].y - t.y);
        for (let i = 1; i < geo.points.length; i++) {
          ctx.lineTo(geo.points[i].x - t.x, geo.points[i].y - t.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'path':
      if (geo.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(geo.points[0].x - t.x, geo.points[0].y - t.y);
        const segCount = geo.closed ? geo.points.length : geo.points.length - 1;
        for (let i = 0; i < segCount; i++) {
          const p1 = geo.points[(i + 1) % geo.points.length];
          const seg = geo.segments[i];
          if (seg.kind === 'line') {
            ctx.lineTo(p1.x - t.x, p1.y - t.y);
          } else {
            ctx.quadraticCurveTo(seg.cpX - t.x, seg.cpY - t.y, p1.x - t.x, p1.y - t.y);
          }
        }
        if (geo.closed) {
          ctx.closePath();
          ctx.fill();
        }
        ctx.stroke();
      }
      break;
  }

  // Draw risk indicator icon — small circle with ! for at-risk, X for collapses
  const bounds = getShapeBounds(geo, t);
  const iconX = bounds.cx;
  const iconY = bounds.minY - 12 / zoom;
  const iconR = 6 / zoom;

  ctx.setLineDash([]);
  // Reset transform for icon drawing in artboard space
  ctx.restore();
  ctx.save();

  ctx.fillStyle = strokeColor;
  ctx.beginPath();
  ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(10 / zoom)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.level === 'collapses' ? 'X' : '!', iconX, iconY);

  // Must-survive badge (only shown for at-risk/collapses since we early-return on safe)
  if (info.mustSurvive) {
    const badgeX = iconX + iconR + 4 / zoom;
    ctx.fillStyle = 'rgba(244, 67, 54, 0.9)';
    ctx.beginPath();
    ctx.arc(badgeX, iconY, iconR * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(8 / zoom)}px monospace`;
    ctx.fillText('M', badgeX, iconY);
  }

  ctx.restore();
}

function getShapeBounds(geo: VectorGeometry, t: VectorTransform): { cx: number; cy: number; minY: number } {
  switch (geo.kind) {
    case 'rect':
      return { cx: geo.x + geo.w / 2, cy: geo.y + geo.h / 2, minY: geo.y };
    case 'ellipse':
      return { cx: geo.cx, cy: geo.cy, minY: geo.cy - Math.abs(geo.ry) };
    case 'line':
      return { cx: (geo.x1 + geo.x2) / 2, cy: (geo.y1 + geo.y2) / 2, minY: Math.min(geo.y1, geo.y2) };
    case 'polygon': {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of geo.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, minY };
    }
    case 'path': {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of geo.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, minY };
    }
  }
}

// ── Vector tool types ──

export type VectorToolId = 'v-select' | 'v-rect' | 'v-ellipse' | 'v-line' | 'v-polygon' | 'v-path';

// ── Component ──

interface VectorCanvasProps {
  activeTool: VectorToolId;
  fillColor: Rgba | null;
  strokeColor: Rgba | null;
  strokeWidth: number;
  collapseOverlay?: CollapseOverlayData | null;
}

export function VectorCanvas({ activeTool, fillColor, strokeColor, strokeWidth, collapseOverlay }: VectorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.8);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [polyPoints, setPolyPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; shapeX: number; shapeY: number } | null>(null);
  // Path creation state
  const [pathPoints, setPathPoints] = useState<PathPoint[]>([]);
  const [pathSegments, setPathSegments] = useState<PathSegment[]>([]);
  const [pathCurveMode, setPathCurveMode] = useState(false); // Shift = curve
  // Path point editing state
  const [editingPoint, setEditingPoint] = useState<{ shapeId: string; kind: 'point' | 'control'; index: number } | null>(null);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  // Hover state
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  const doc = useVectorMasterStore((s) => s.document);
  const selectedIds = useVectorMasterStore((s) => s.selectedShapeIds);
  const selectShape = useVectorMasterStore((s) => s.selectShape);
  const deselectAllShapes = useVectorMasterStore((s) => s.deselectAllShapes);
  const addShape = useVectorMasterStore((s) => s.addShape);
  const setShapeTransform = useVectorMasterStore((s) => s.setShapeTransform);
  const setShapeGeometry = useVectorMasterStore((s) => s.setShapeGeometry);

  // Convert screen coords to artboard coords
  const toArtboard = useCallback((clientX: number, clientY: number): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) / zoom - panX;
    const sy = (clientY - rect.top) / zoom - panY;
    return [sx, sy];
  }, [zoom, panX, panY]);

  // ── Render loop ──
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    // Apply zoom + pan
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(panX, panY);

    // Artboard background
    ctx.fillStyle = ARTBOARD_BG;
    ctx.fillRect(0, 0, doc.artboardWidth, doc.artboardHeight);

    // Grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    const gridStep = doc.artboardWidth >= 256 ? 50 : 16;
    for (let x = gridStep; x < doc.artboardWidth; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, doc.artboardHeight);
      ctx.stroke();
    }
    for (let y = gridStep; y < doc.artboardHeight; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(doc.artboardWidth, y);
      ctx.stroke();
    }

    // Artboard border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, doc.artboardWidth, doc.artboardHeight);

    // Render shapes (z-order)
    const sorted = [...doc.shapes].sort((a, b) => a.zOrder - b.zOrder);
    for (const shape of sorted) {
      renderShape(ctx, shape);
    }

    // Collapse overlay (before selection so selection outlines draw on top)
    if (collapseOverlay) {
      for (const shape of sorted) {
        renderCollapseOverlay(ctx, shape, collapseOverlay, zoom);
      }
    }

    // Hover highlight (before selection so selection draws on top)
    if (hoveredShapeId && !selectedIds.includes(hoveredShapeId) && activeTool === 'v-select') {
      const hoverShape = doc.shapes.find((s) => s.id === hoveredShapeId);
      if (hoverShape) renderHoverHighlight(ctx, hoverShape, zoom);
    }

    // Selection outlines
    for (const id of selectedIds) {
      const shape = doc.shapes.find((s) => s.id === id);
      if (shape) renderSelectionOutline(ctx, shape, zoom);
    }

    // Draw preview (rect/ellipse/line being drawn)
    if (drawStart && drawCurrent && activeTool !== 'v-select' && activeTool !== 'v-polygon') {
      ctx.save();
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const x0 = drawStart.x, y0 = drawStart.y;
      const x1 = drawCurrent.x, y1 = drawCurrent.y;

      if (activeTool === 'v-rect') {
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      } else if (activeTool === 'v-ellipse') {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool === 'v-line') {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Path edit overlay — show points/handles on selected path shapes
    if (activeTool === 'v-select' || activeTool === 'v-path') {
      for (const id of selectedIds) {
        const shape = doc.shapes.find((s) => s.id === id);
        if (shape && shape.geometry.kind === 'path') {
          renderPathEditOverlay(ctx, shape, zoom, selectedPointIdx);
        }
      }
    }

    // Path creation preview
    if (activeTool === 'v-path' && pathPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
      for (let i = 0; i < pathSegments.length; i++) {
        const p1 = pathPoints[i + 1];
        if (!p1) break;
        const seg = pathSegments[i];
        if (seg.kind === 'line') {
          ctx.lineTo(p1.x, p1.y);
        } else {
          ctx.quadraticCurveTo(seg.cpX, seg.cpY, p1.x, p1.y);
        }
      }
      if (drawCurrent && pathPoints.length > pathSegments.length) {
        ctx.lineTo(drawCurrent.x, drawCurrent.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw vertex dots
      ctx.fillStyle = SELECTION_COLOR;
      for (const p of pathPoints) {
        ctx.beginPath();
        if (p.pointType === 'smooth') {
          ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
        } else {
          ctx.rect(p.x - 4 / zoom, p.y - 4 / zoom, 8 / zoom, 8 / zoom);
        }
        ctx.fill();
      }
      // Draw control point diamonds
      ctx.fillStyle = '#ff9632';
      for (const seg of pathSegments) {
        if (seg.kind === 'quadratic') {
          ctx.beginPath();
          const s = 3 / zoom;
          ctx.moveTo(seg.cpX, seg.cpY - s);
          ctx.lineTo(seg.cpX + s, seg.cpY);
          ctx.lineTo(seg.cpX, seg.cpY + s);
          ctx.lineTo(seg.cpX - s, seg.cpY);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Polygon preview
    if (activeTool === 'v-polygon' && polyPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
      for (let i = 1; i < polyPoints.length; i++) {
        ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
      }
      if (drawCurrent) {
        ctx.lineTo(drawCurrent.x, drawCurrent.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw vertex dots
      ctx.fillStyle = SELECTION_COLOR;
      for (const p of polyPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [doc, selectedIds, zoom, panX, panY, drawStart, drawCurrent, activeTool, polyPoints, pathPoints, pathSegments, selectedPointIdx, collapseOverlay, hoveredShapeId]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render on state changes
  useEffect(() => {
    requestAnimationFrame(render);
  }, [render]);

  // ── Pointer handlers ──

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      return;
    }

    const [ax, ay] = toArtboard(e.clientX, e.clientY);

    if (activeTool === 'v-select') {
      if (!doc) return;

      // First: check if clicking on a path point/control of a selected path
      if (selectedIds.length === 1) {
        const sel = doc.shapes.find((s) => s.id === selectedIds[0]);
        if (sel && sel.geometry.kind === 'path') {
          const pathHit = hitTestPathPoints(sel, ax, ay, zoom);
          if (pathHit) {
            setEditingPoint({ shapeId: sel.id, ...pathHit });
            setSelectedPointIdx(pathHit.kind === 'point' ? pathHit.index : null);
            return;
          }
        }
      }

      // Hit test shapes in reverse z-order (top first)
      const sorted = [...doc.shapes].sort((a, b) => b.zOrder - a.zOrder);
      let hit: VectorShape | null = null;
      for (const shape of sorted) {
        if (hitTestShape(shape, ax, ay)) {
          hit = shape;
          break;
        }
      }
      if (hit) {
        if (!e.shiftKey) deselectAllShapes();
        selectShape(hit.id);
        setSelectedPointIdx(null);
        // Start drag
        setDragStart({ x: ax, y: ay, shapeX: hit.transform.x, shapeY: hit.transform.y });
      } else {
        deselectAllShapes();
        setSelectedPointIdx(null);
      }
    } else if (activeTool === 'v-path') {
      // Path tool: click to add points
      const pointType: 'corner' | 'smooth' = e.shiftKey ? 'smooth' : 'corner';
      const newPoint: PathPoint = { x: ax, y: ay, pointType };

      if (pathPoints.length === 0) {
        // First point
        setPathPoints([newPoint]);
      } else {
        // Add segment from previous point to this new point
        const prevPt = pathPoints[pathPoints.length - 1];
        let seg: PathSegment;
        if (e.shiftKey) {
          // Shift = quadratic curve with control point at midpoint (drag to adjust later)
          seg = { kind: 'quadratic', cpX: (prevPt.x + ax) / 2, cpY: (prevPt.y + ay) / 2 };
        } else {
          seg = { kind: 'line' };
        }
        setPathPoints((prev) => [...prev, newPoint]);
        setPathSegments((prev) => [...prev, seg]);
      }
    } else if (activeTool === 'v-polygon') {
      setPolyPoints((prev) => [...prev, { x: ax, y: ay }]);
    } else {
      // Drawing tools: start drag
      setDrawStart({ x: ax, y: ay });
      setDrawCurrent({ x: ax, y: ay });
    }
  }, [activeTool, doc, toArtboard, selectShape, deselectAllShapes, selectedIds, zoom, pathPoints]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanX((prev) => prev + e.movementX / zoom);
      setPanY((prev) => prev + e.movementY / zoom);
      return;
    }

    const [ax, ay] = toArtboard(e.clientX, e.clientY);

    // Path point/control-point dragging
    if (editingPoint && doc) {
      const shape = doc.shapes.find((s) => s.id === editingPoint.shapeId);
      if (shape && shape.geometry.kind === 'path') {
        const geo = shape.geometry as PathGeometry;
        const t = shape.transform;
        // Convert artboard coords back to geometry space
        const gx = (ax - t.x) / t.scaleX;
        const gy = (ay - t.y) / t.scaleY;
        if (editingPoint.kind === 'point') {
          const newGeo = pathMovePoint(geo, editingPoint.index, gx, gy);
          setShapeGeometry(editingPoint.shapeId, newGeo);
        } else {
          const newGeo = pathMoveControlPoint(geo, editingPoint.index, gx, gy);
          setShapeGeometry(editingPoint.shapeId, newGeo);
        }
      }
      return;
    }

    if (activeTool === 'v-select' && dragStart && selectedIds.length === 1) {
      const dx = ax - dragStart.x;
      const dy = ay - dragStart.y;
      setShapeTransform(selectedIds[0], {
        x: dragStart.shapeX + dx,
        y: dragStart.shapeY + dy,
      });
    }

    if (drawStart) {
      setDrawCurrent({ x: ax, y: ay });
    }
    if ((activeTool === 'v-polygon' || activeTool === 'v-path') && (polyPoints.length > 0 || pathPoints.length > 0)) {
      setDrawCurrent({ x: ax, y: ay });
    }

    // Hover detection for select tool
    if (activeTool === 'v-select' && doc && !dragStart && !editingPoint) {
      const sortedDesc = [...doc.shapes].sort((a, b) => b.zOrder - a.zOrder);
      let found: string | null = null;
      for (const shape of sortedDesc) {
        if (hitTestShape(shape, ax, ay)) {
          found = shape.id;
          break;
        }
      }
      if (found !== hoveredShapeId) {
        setHoveredShapeId(found);
      }
    }
  }, [isPanning, zoom, toArtboard, activeTool, dragStart, drawStart, selectedIds, setShapeTransform, polyPoints, pathPoints, editingPoint, doc, setShapeGeometry, hoveredShapeId]);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (editingPoint) {
      setEditingPoint(null);
      return;
    }

    if (dragStart) {
      setDragStart(null);
      return;
    }

    if (drawStart && drawCurrent && activeTool !== 'v-select' && activeTool !== 'v-polygon') {
      const x0 = drawStart.x, y0 = drawStart.y;
      const x1 = drawCurrent.x, y1 = drawCurrent.y;
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);

      if (w < 2 && h < 2) {
        // Too small, cancel
        setDrawStart(null);
        setDrawCurrent(null);
        return;
      }

      if (activeTool === 'v-rect') {
        addShape({
          name: 'rect',
          groupId: null,
          geometry: { kind: 'rect', x: Math.min(x0, x1), y: Math.min(y0, y1), w, h },
          fill: fillColor,
          stroke: strokeColor ? { color: strokeColor, width: strokeWidth } : null,
          transform: { ...DEFAULT_VECTOR_TRANSFORM },
          reduction: {},
          visible: true,
          locked: false,
        });
      } else if (activeTool === 'v-ellipse') {
        addShape({
          name: 'ellipse',
          groupId: null,
          geometry: { kind: 'ellipse', cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: w / 2, ry: h / 2 },
          fill: fillColor,
          stroke: strokeColor ? { color: strokeColor, width: strokeWidth } : null,
          transform: { ...DEFAULT_VECTOR_TRANSFORM },
          reduction: {},
          visible: true,
          locked: false,
        });
      } else if (activeTool === 'v-line') {
        addShape({
          name: 'line',
          groupId: null,
          geometry: { kind: 'line', x1: x0, y1: y0, x2: x1, y2: y1 },
          fill: null,
          stroke: { color: strokeColor ?? [255, 255, 255, 255], width: strokeWidth },
          transform: { ...DEFAULT_VECTOR_TRANSFORM },
          reduction: {},
          visible: true,
          locked: false,
        });
      }

      setDrawStart(null);
      setDrawCurrent(null);
    }
  }, [isPanning, editingPoint, dragStart, drawStart, drawCurrent, activeTool, addShape, fillColor, strokeColor, strokeWidth]);

  // Double-click to close polygon or finalize path
  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'v-polygon' && polyPoints.length >= 3) {
      addShape({
        name: 'polygon',
        groupId: null,
        geometry: { kind: 'polygon', points: [...polyPoints] },
        fill: fillColor,
        stroke: strokeColor ? { color: strokeColor, width: strokeWidth } : null,
        transform: { ...DEFAULT_VECTOR_TRANSFORM },
        reduction: {},
        visible: true,
        locked: false,
      });
      setPolyPoints([]);
      setDrawCurrent(null);
    }
    if (activeTool === 'v-path' && pathPoints.length >= 2) {
      // Double-click = close path (if >= 3 points) or finalize open path
      const closed = pathPoints.length >= 3;
      const finalSegments = [...pathSegments];
      if (closed) {
        // Add closing segment
        finalSegments.push({ kind: 'line' });
      }
      addShape({
        name: 'path',
        groupId: null,
        geometry: { kind: 'path', points: [...pathPoints], segments: finalSegments, closed },
        fill: closed ? fillColor : null,
        stroke: strokeColor ? { color: strokeColor, width: strokeWidth } : (closed ? null : { color: [255, 255, 255, 255], width: 2 }),
        transform: { ...DEFAULT_VECTOR_TRANSFORM },
        reduction: {},
        visible: true,
        locked: false,
      });
      setPathPoints([]);
      setPathSegments([]);
      setDrawCurrent(null);
    }
  }, [activeTool, polyPoints, pathPoints, pathSegments, addShape, fillColor, strokeColor, strokeWidth]);

  // Zoom with scroll wheel
  const handleWheel = useCallback((e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * delta)));
  }, []);

  // Escape to cancel polygon/path creation, Delete to remove selected point
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPolyPoints([]);
        setPathPoints([]);
        setPathSegments([]);
        setDrawStart(null);
        setDrawCurrent(null);
        setSelectedPointIdx(null);
      }
      // Enter to finalize open path
      if (e.key === 'Enter' && activeTool === 'v-path' && pathPoints.length >= 2) {
        addShape({
          name: 'path',
          groupId: null,
          geometry: { kind: 'path', points: [...pathPoints], segments: [...pathSegments], closed: false },
          fill: null,
          stroke: strokeColor ? { color: strokeColor, width: strokeWidth } : { color: [255, 255, 255, 255], width: 2 },
          transform: { ...DEFAULT_VECTOR_TRANSFORM },
          reduction: {},
          visible: true,
          locked: false,
        });
        setPathPoints([]);
        setPathSegments([]);
        setDrawCurrent(null);
      }
      // Delete/Backspace to remove last point during path creation, or selected point during editing
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeTool === 'v-path' && pathPoints.length > 0) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        setPathPoints((prev) => prev.slice(0, -1));
        setPathSegments((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeTool, pathPoints, pathSegments, addShape, strokeColor, strokeWidth]);

  const cursorStyle = activeTool === 'v-select' ? 'default' : 'crosshair';

  return (
    <div ref={containerRef} className="vector-canvas-container">
      <canvas
        ref={canvasRef}
        className="vector-canvas"
        style={{ cursor: isPanning ? 'grabbing' : cursorStyle }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
      {doc && (
        <div className="vector-canvas-status">
          <span>{doc.artboardWidth}×{doc.artboardHeight}</span>
          <span>{doc.shapes.length} shapes</span>
          <span>{Math.round(zoom * 100)}%</span>
          {selectedIds.length > 0 && <span>{selectedIds.length} selected</span>}
        </div>
      )}
    </div>
  );
}
