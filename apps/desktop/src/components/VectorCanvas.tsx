import { useRef, useEffect, useCallback, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import { useVectorMasterStore } from '@glyphstudio/state';
import type {
  VectorShape,
  VectorGeometry,
  VectorTransform,
  Rgba,
} from '@glyphstudio/domain';
import { DEFAULT_VECTOR_TRANSFORM } from '@glyphstudio/domain';

// ── Constants ──

const GRID_COLOR = 'rgba(255,255,255,0.04)';
const ARTBOARD_BG = '#1a1a1a';
const SELECTION_COLOR = '#4fc3f7';
const HOVER_COLOR = 'rgba(79, 195, 247, 0.3)';
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

function renderSelectionOutline(ctx: CanvasRenderingContext2D, shape: VectorShape): void {
  const geo = shape.geometry;
  const t = shape.transform;

  ctx.save();
  ctx.translate(t.x, t.y);
  if (t.rotation !== 0) ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.flipX || t.flipY) ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
  ctx.scale(t.scaleX, t.scaleY);
  ctx.translate(-t.x, -t.y);
  ctx.translate(t.x, t.y);

  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 2 / Math.max(t.scaleX, t.scaleY);
  ctx.setLineDash([6, 3]);

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
  }
  return false;
}

// ── Vector tool types ──

export type VectorToolId = 'v-select' | 'v-rect' | 'v-ellipse' | 'v-line' | 'v-polygon';

// ── Component ──

interface VectorCanvasProps {
  activeTool: VectorToolId;
  fillColor: Rgba | null;
  strokeColor: Rgba | null;
  strokeWidth: number;
}

export function VectorCanvas({ activeTool, fillColor, strokeColor, strokeWidth }: VectorCanvasProps) {
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

  const doc = useVectorMasterStore((s) => s.document);
  const selectedIds = useVectorMasterStore((s) => s.selectedShapeIds);
  const selectShape = useVectorMasterStore((s) => s.selectShape);
  const deselectAllShapes = useVectorMasterStore((s) => s.deselectAllShapes);
  const addShape = useVectorMasterStore((s) => s.addShape);
  const setShapeTransform = useVectorMasterStore((s) => s.setShapeTransform);

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

    // Selection outlines
    for (const id of selectedIds) {
      const shape = doc.shapes.find((s) => s.id === id);
      if (shape) renderSelectionOutline(ctx, shape);
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
  }, [doc, selectedIds, zoom, panX, panY, drawStart, drawCurrent, activeTool, polyPoints]);

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
      // Hit test shapes in reverse z-order (top first)
      if (!doc) return;
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
        // Start drag
        setDragStart({ x: ax, y: ay, shapeX: hit.transform.x, shapeY: hit.transform.y });
      } else {
        deselectAllShapes();
      }
    } else if (activeTool === 'v-polygon') {
      // Polygon: click to add point, double-click to close
      setPolyPoints((prev) => [...prev, { x: ax, y: ay }]);
    } else {
      // Drawing tools: start drag
      setDrawStart({ x: ax, y: ay });
      setDrawCurrent({ x: ax, y: ay });
    }
  }, [activeTool, doc, toArtboard, selectShape, deselectAllShapes]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanX((prev) => prev + e.movementX / zoom);
      setPanY((prev) => prev + e.movementY / zoom);
      return;
    }

    const [ax, ay] = toArtboard(e.clientX, e.clientY);

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
    if (activeTool === 'v-polygon' && polyPoints.length > 0) {
      setDrawCurrent({ x: ax, y: ay });
    }
  }, [isPanning, zoom, toArtboard, activeTool, dragStart, drawStart, selectedIds, setShapeTransform, polyPoints]);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
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
  }, [isPanning, dragStart, drawStart, drawCurrent, activeTool, addShape, fillColor, strokeColor, strokeWidth]);

  // Double-click to close polygon
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
  }, [activeTool, polyPoints, addShape, fillColor, strokeColor, strokeWidth]);

  // Zoom with scroll wheel
  const handleWheel = useCallback((e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * delta)));
  }, []);

  // Escape to cancel polygon
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPolyPoints([]);
        setDrawStart(null);
        setDrawCurrent(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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
