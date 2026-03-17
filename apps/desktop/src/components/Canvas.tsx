import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCanvasViewStore } from '@glyphstudio/state';
import { useToolStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import { useTimelineStore } from '@glyphstudio/state';
import { useSnapshotStore } from '@glyphstudio/state';
import { useBrushSettingsStore, expandStrokeDabs } from '@glyphstudio/state';
import { useAnchorStore } from '@glyphstudio/state';
import { isSketchTool, TOOL_KEY_MAP, TOOL_SHIFT_KEY_MAP } from '@glyphstudio/domain';
import type { AnchorKind } from '@glyphstudio/domain';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';

const CHECK_LIGHT = '#2a2a2e';
const CHECK_DARK = '#222226';
const CHECK_SIZE = 8;
const CANVAS_BG = '#111114';
const GRID_COLOR = 'rgba(255,255,255,0.08)';
const SELECTION_COLOR = 'rgba(100,160,255,0.5)';
const SELECTION_DASH = [4, 4];

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
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

function rectangleOutline(x0: number, y0: number, x1: number, y1: number): [number, number][] {
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

function ellipseOutline(x0: number, y0: number, x1: number, y1: number): [number, number][] {
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
  let rx2 = rx * rx, ry2 = ry * ry;
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

const SHAPE_TOOLS = new Set(['line', 'rectangle', 'ellipse']);

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const isDrawingRef = useRef(false);
  const lastPixelRef = useRef<{ x: number; y: number } | null>(null);
  const renderRequestRef = useRef<number | null>(null);

  // Marquee drag state
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // Marching ants animation
  const antOffsetRef = useRef(0);
  const antAnimRef = useRef<number | null>(null);
  // Transform drag state
  const isTransformDraggingRef = useRef(false);
  const transformDragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  // Shape tool drag state (line, rectangle, ellipse)
  const isShapeDraggingRef = useRef(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeEndRef = useRef<{ x: number; y: number } | null>(null);
  // Lasso tool drag state
  const isLassoDraggingRef = useRef(false);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  // Slice tool drag state
  const isSliceDraggingRef = useRef(false);
  const sliceStartRef = useRef<{ x: number; y: number } | null>(null);
  const sliceEndRef = useRef<{ x: number; y: number } | null>(null);
  const [sliceRegions, setSliceRegions] = useState<{ x: number; y: number; width: number; height: number; name: string }[]>([]);
  // Measure tool state
  const measureStartRef = useRef<{ x: number; y: number } | null>(null);
  const measureEndRef = useRef<{ x: number; y: number } | null>(null);

  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const liveFrame = useCanvasFrameStore((s) => s.frame);
  const frameVersion = useCanvasFrameStore((s) => s.version);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);

  const zoom = useCanvasViewStore((s) => s.zoom);
  const panX = useCanvasViewStore((s) => s.panX);
  const panY = useCanvasViewStore((s) => s.panY);
  const showPixelGrid = useCanvasViewStore((s) => s.showPixelGrid);
  const showSilhouette = useCanvasViewStore((s) => s.showSilhouette);
  const silhouetteColor = useCanvasViewStore((s) => s.silhouetteColor);
  const compareSnapshotId = useCanvasViewStore((s) => s.compareSnapshotId);

  const compareSnapshot = useSnapshotStore((s) =>
    compareSnapshotId ? s.snapshots.find((snap) => snap.id === compareSnapshotId) ?? null : null,
  );
  const frame = useMemo(() => {
    if (compareSnapshot && liveFrame) {
      return { ...liveFrame, data: compareSnapshot.data };
    }
    return liveFrame;
  }, [liveFrame, compareSnapshot]);
  const previewBackground = useCanvasViewStore((s) => s.previewBackground);
  const panBy = useCanvasViewStore((s) => s.panBy);
  const zoomIn = useCanvasViewStore((s) => s.zoomIn);
  const zoomOut = useCanvasViewStore((s) => s.zoomOut);

  const activeTool = useToolStore((s) => s.activeTool);
  const primaryColor = useToolStore((s) => s.primaryColor);
  const canvasSize = useProjectStore((s) => s.canvasSize);
  const markDirty = useProjectStore((s) => s.markDirty);

  const selectionBounds = useSelectionStore((s) => s.selectionBounds);
  const setSelection = useSelectionStore((s) => s.setSelection);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const hasSelection = useSelectionStore((s) => s.hasSelection);
  const isTransforming = useSelectionStore((s) => s.isTransforming);
  const transformPreview = useSelectionStore((s) => s.transformPreview);
  const setTransform = useSelectionStore((s) => s.setTransform);
  const clearTransform = useSelectionStore((s) => s.clearTransform);

  const activeFrameIndex = useTimelineStore((s) => s.activeFrameIndex);
  const frameCount = useTimelineStore((s) => s.frames.length);
  const playing = useTimelineStore((s) => s.playing);
  const onionSkinEnabled = useTimelineStore((s) => s.onionSkinEnabled);
  const onionSkinShowPrev = useTimelineStore((s) => s.onionSkinShowPrev);
  const onionSkinShowNext = useTimelineStore((s) => s.onionSkinShowNext);
  const onionSkinPrevOpacity = useTimelineStore((s) => s.onionSkinPrevOpacity);
  const onionSkinNextOpacity = useTimelineStore((s) => s.onionSkinNextOpacity);
  const onionSkinData = useTimelineStore((s) => s.onionSkinData);
  const setOnionSkinData = useTimelineStore((s) => s.setOnionSkinData);

  // Unclamped screen-to-pixel (allows coords outside canvas for drag)
  const screenToPixelUnclamped = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas || !frame) return null;

      const rect = canvas.getBoundingClientRect();
      const cx = screenX - rect.left;
      const cy = screenY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const spriteW = frame.width * zoom;
      const spriteH = frame.height * zoom;
      const originX = centerX - spriteW / 2 + panX;
      const originY = centerY - spriteH / 2 + panY;

      const px = Math.floor((cx - originX) / zoom);
      const py = Math.floor((cy - originY) / zoom);

      return { x: px, y: py };
    },
    [zoom, panX, panY, frame],
  );

  const screenToPixel = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } | null => {
      const p = screenToPixelUnclamped(screenX, screenY);
      if (!p || !frame) return null;
      if (p.x < 0 || p.y < 0 || p.x >= frame.width || p.y >= frame.height) return null;
      return p;
    },
    [screenToPixelUnclamped, frame],
  );

  // Initialize canvas from Rust
  useEffect(() => {
    async function init() {
      try {
        const f = await invoke<CanvasFrameData>('init_canvas', {
          width: canvasSize.width,
          height: canvasSize.height,
        });
        setFrame(f);
        syncLayersFromFrame(f);
        setCanvasReady(true);
      } catch (err) {
        console.error('Failed to init canvas:', err);
      }
    }
    init();
  }, [canvasSize.width, canvasSize.height, setFrame]);

  // Fetch onion skin data when enabled and frame changes
  useEffect(() => {
    if (!onionSkinEnabled || !canvasReady || frameCount <= 1) {
      setOnionSkinData(null);
      return;
    }
    invoke<{ width: number; height: number; prevData: number[] | null; nextData: number[] | null }>('get_onion_skin_frames')
      .then((data) => setOnionSkinData(data))
      .catch(() => setOnionSkinData(null));
  }, [onionSkinEnabled, activeFrameIndex, frameVersion, canvasReady, frameCount, setOnionSkinData]);

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
    }

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, w, h);

    const spriteW = frame.width * zoom;
    const spriteH = frame.height * zoom;
    const originX = Math.floor(w / 2 - spriteW / 2 + panX);
    const originY = Math.floor(h / 2 - spriteH / 2 + panY);

    if (previewBackground === 'checker') {
      const checkScreenSize = Math.max(1, Math.floor(CHECK_SIZE * (zoom / 8)));
      for (let py = 0; py < frame.height; py++) {
        for (let px = 0; px < frame.width; px++) {
          const sx = originX + px * zoom;
          const sy = originY + py * zoom;
          if (sx + zoom < 0 || sy + zoom < 0 || sx > w || sy > h) continue;
          const cellsX = Math.ceil(zoom / checkScreenSize);
          const cellsY = Math.ceil(zoom / checkScreenSize);
          for (let cy = 0; cy < cellsY; cy++) {
            for (let cx = 0; cx < cellsX; cx++) {
              ctx.fillStyle = (cx + cy) % 2 === 0 ? CHECK_LIGHT : CHECK_DARK;
              const csX = sx + cx * checkScreenSize;
              const csY = sy + cy * checkScreenSize;
              ctx.fillRect(csX, csY, Math.min(checkScreenSize, sx + zoom - csX), Math.min(checkScreenSize, sy + zoom - csY));
            }
          }
        }
      }
    } else {
      ctx.fillStyle = previewBackground === 'dark' ? '#111114' : '#e0e0e0';
      ctx.fillRect(originX, originY, spriteW, spriteH);
    }

    // --- Onion skin overlays (before active frame) ---
    if (onionSkinData && onionSkinEnabled) {
      const osW = onionSkinData.width;
      const osH = onionSkinData.height;

      // Previous frame ghost (blue tint)
      if (onionSkinShowPrev && onionSkinData.prevData) {
        const prevData = onionSkinData.prevData;
        ctx.globalAlpha = onionSkinPrevOpacity;
        for (let py = 0; py < osH; py++) {
          for (let px = 0; px < osW; px++) {
            const i = (py * osW + px) * 4;
            const a = prevData[i + 3];
            if (a === 0) continue;
            const sx = originX + px * zoom;
            const sy = originY + py * zoom;
            if (sx + zoom < 0 || sy + zoom < 0 || sx > w || sy > h) continue;
            // Tint toward blue
            const r = Math.round(prevData[i] * 0.3);
            const g = Math.round(prevData[i + 1] * 0.3);
            const b = Math.min(255, Math.round(prevData[i + 2] * 0.5 + 128));
            ctx.fillStyle = a === 255
              ? `rgb(${r},${g},${b})`
              : `rgba(${r},${g},${b},${a / 255})`;
            ctx.fillRect(sx, sy, zoom, zoom);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Next frame ghost (red tint)
      if (onionSkinShowNext && onionSkinData.nextData) {
        const nextData = onionSkinData.nextData;
        ctx.globalAlpha = onionSkinNextOpacity;
        for (let py = 0; py < osH; py++) {
          for (let px = 0; px < osW; px++) {
            const i = (py * osW + px) * 4;
            const a = nextData[i + 3];
            if (a === 0) continue;
            const sx = originX + px * zoom;
            const sy = originY + py * zoom;
            if (sx + zoom < 0 || sy + zoom < 0 || sx > w || sy > h) continue;
            // Tint toward red
            const r = Math.min(255, Math.round(nextData[i] * 0.5 + 128));
            const g = Math.round(nextData[i + 1] * 0.3);
            const b = Math.round(nextData[i + 2] * 0.3);
            ctx.fillStyle = a === 255
              ? `rgb(${r},${g},${b})`
              : `rgba(${r},${g},${b},${a / 255})`;
            ctx.fillRect(sx, sy, zoom, zoom);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // --- Active frame pixels ---
    const frameData = frame.data;
    const silR = silhouetteColor[0];
    const silG = silhouetteColor[1];
    const silB = silhouetteColor[2];
    for (let py = 0; py < frame.height; py++) {
      for (let px = 0; px < frame.width; px++) {
        const i = (py * frame.width + px) * 4;
        const a = frameData[i + 3];
        if (a === 0) continue;
        const sx = originX + px * zoom;
        const sy = originY + py * zoom;
        if (sx + zoom < 0 || sy + zoom < 0 || sx > w || sy > h) continue;
        const r = showSilhouette ? silR : frameData[i];
        const g = showSilhouette ? silG : frameData[i + 1];
        const b = showSilhouette ? silB : frameData[i + 2];
        if (a === 255) {
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
        }
        ctx.fillRect(sx, sy, zoom, zoom);
      }
    }

    if (showPixelGrid && zoom >= 4) {
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px = 0; px <= frame.width; px++) {
        const sx = originX + px * zoom + 0.5;
        ctx.moveTo(sx, originY);
        ctx.lineTo(sx, originY + spriteH);
      }
      for (let py = 0; py <= frame.height; py++) {
        const sy = originY + py * zoom + 0.5;
        ctx.moveTo(originX, sy);
        ctx.lineTo(originX + spriteW, sy);
      }
      ctx.stroke();
    }

    // --- Transform preview overlay ---
    if (transformPreview) {
      const tp = transformPreview;
      const tpX = originX + (tp.sourceX + tp.offsetX) * zoom;
      const tpY = originY + (tp.sourceY + tp.offsetY) * zoom;

      // Draw each pixel of the payload
      for (let py = 0; py < tp.payloadHeight; py++) {
        for (let px = 0; px < tp.payloadWidth; px++) {
          const i = (py * tp.payloadWidth + px) * 4;
          const a = tp.payloadData[i + 3];
          if (a === 0) continue;
          const sx = tpX + px * zoom;
          const sy = tpY + py * zoom;
          if (sx + zoom < 0 || sy + zoom < 0 || sx > w || sy > h) continue;
          if (a === 255) {
            ctx.fillStyle = `rgb(${tp.payloadData[i]},${tp.payloadData[i + 1]},${tp.payloadData[i + 2]})`;
          } else {
            ctx.fillStyle = `rgba(${tp.payloadData[i]},${tp.payloadData[i + 1]},${tp.payloadData[i + 2]},${a / 255})`;
          }
          ctx.fillRect(sx, sy, zoom, zoom);
        }
      }

      // Marching ants around transform payload
      const tpSW = tp.payloadWidth * zoom;
      const tpSH = tp.payloadHeight * zoom;
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash(SELECTION_DASH);
      ctx.lineDashOffset = -antOffsetRef.current;
      ctx.strokeRect(tpX + 0.5, tpY + 0.5, tpSW - 1, tpSH - 1);
      ctx.strokeStyle = '#000';
      ctx.lineDashOffset = -(antOffsetRef.current + 4);
      ctx.strokeRect(tpX + 0.5, tpY + 0.5, tpSW - 1, tpSH - 1);
      ctx.restore();
    } else {
      // --- Selection overlay (only when not transforming) ---
      const sel = dragSelection || selectionBounds;
      if (sel) {
        const sx = originX + sel.x * zoom;
        const sy = originY + sel.y * zoom;
        const sw = sel.width * zoom;
        const sh = sel.height * zoom;

        // Semi-transparent fill
        ctx.fillStyle = 'rgba(100,160,255,0.08)';
        ctx.fillRect(sx, sy, sw, sh);

        // Marching ants border
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.setLineDash(SELECTION_DASH);
        ctx.lineDashOffset = -antOffsetRef.current;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

        ctx.strokeStyle = '#000';
        ctx.lineDashOffset = -(antOffsetRef.current + 4);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        ctx.restore();
      }
    }

    // Slice regions overlay
    if (sliceRegions.length > 0 || isSliceDraggingRef.current) {
      ctx.save();
      // Draw existing slice regions
      for (const region of sliceRegions) {
        const sx = originX + region.x * zoom;
        const sy = originY + region.y * zoom;
        const sw = region.width * zoom;
        const sh = region.height * zoom;
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        ctx.fillStyle = 'rgba(255,107,53,0.1)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = '#ff6b35';
        ctx.font = '10px monospace';
        ctx.fillText(region.name, sx + 2, sy + 10);
      }
      // Draw active slice drag
      if (isSliceDraggingRef.current && sliceStartRef.current && sliceEndRef.current) {
        const s = sliceStartRef.current;
        const en = sliceEndRef.current;
        const sx = originX + Math.min(s.x, en.x) * zoom;
        const sy = originY + Math.min(s.y, en.y) * zoom;
        const sw = (Math.abs(en.x - s.x) + 1) * zoom;
        const sh = (Math.abs(en.y - s.y) + 1) * zoom;
        ctx.strokeStyle = '#ffab00';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        ctx.fillStyle = 'rgba(255,171,0,0.15)';
        ctx.fillRect(sx, sy, sw, sh);
      }
      ctx.restore();
    }

    // Anchor overlay (socket tool or when anchors exist)
    {
      const anchorState = useAnchorStore.getState();
      if (anchorState.overlayVisible && anchorState.anchors.length > 0) {
        for (const anchor of anchorState.anchors) {
          const ax = originX + (anchor.x + 0.5) * zoom;
          const ay = originY + (anchor.y + 0.5) * zoom;
          const r = Math.max(3, zoom * 0.4);
          ctx.save();
          ctx.beginPath();
          ctx.arc(ax, ay, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(144,164,174,0.6)';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
          if (zoom >= 4) {
            ctx.fillStyle = '#fff';
            ctx.font = '9px monospace';
            ctx.fillText(anchor.name, ax + r + 2, ay + 3);
          }
        }
      }
    }

    // Lasso preview overlay
    if (isLassoDraggingRef.current && lassoPointsRef.current.length >= 2) {
      const pts = lassoPointsRef.current;
      ctx.save();
      ctx.strokeStyle = 'rgba(100,200,255,0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(originX + (pts[0].x + 0.5) * zoom, originY + (pts[0].y + 0.5) * zoom);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(originX + (pts[i].x + 0.5) * zoom, originY + (pts[i].y + 0.5) * zoom);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Shape tool preview overlay
    if (isShapeDraggingRef.current && shapeStartRef.current && shapeEndRef.current) {
      const s = shapeStartRef.current;
      const en = shapeEndRef.current;
      let previewPoints: [number, number][] = [];
      if (activeTool === 'line') previewPoints = bresenhamLine(s.x, s.y, en.x, en.y);
      else if (activeTool === 'rectangle') previewPoints = rectangleOutline(s.x, s.y, en.x, en.y);
      else if (activeTool === 'ellipse') previewPoints = ellipseOutline(s.x, s.y, en.x, en.y);
      const pc = primaryColor;
      ctx.fillStyle = `rgba(${pc.r},${pc.g},${pc.b},0.7)`;
      for (const [px, py] of previewPoints) {
        const sx = originX + px * zoom;
        const sy = originY + py * zoom;
        ctx.fillRect(sx, sy, zoom, zoom);
      }
    }

    // Measure tool overlay
    if (activeTool === 'measure' && measureStartRef.current) {
      const ms = measureStartRef.current;
      const me = measureEndRef.current;
      const sx1 = originX + (ms.x + 0.5) * zoom;
      const sy1 = originY + (ms.y + 0.5) * zoom;
      // Start point marker
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(originX + ms.x * zoom, originY + ms.y * zoom, zoom, zoom);
      if (me) {
        ctx.fillStyle = '#44ff44';
        ctx.fillRect(originX + me.x * zoom, originY + me.y * zoom, zoom, zoom);
        const sx2 = originX + (me.x + 0.5) * zoom;
        const sy2 = originY + (me.y + 0.5) * zoom;
        ctx.save();
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.restore();
        const dx = me.x - ms.x;
        const dy = me.y - ms.y;
        const dist = Math.sqrt(dx * dx + dy * dy).toFixed(1);
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px monospace';
        ctx.fillText(`${dist}px (${Math.abs(dx)}×${Math.abs(dy)})`, (sx1 + sx2) / 2 + 6, (sy1 + sy2) / 2 - 6);
      }
    }

    ctx.strokeStyle = '#3a3a40';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX - 0.5, originY - 0.5, spriteW + 1, spriteH + 1);
  }, [zoom, panX, panY, showPixelGrid, showSilhouette, silhouetteColor, compareSnapshotId, previewBackground, frame, frameVersion, selectionBounds, dragSelection, transformPreview, onionSkinEnabled, onionSkinData, onionSkinShowPrev, onionSkinShowNext, onionSkinPrevOpacity, onionSkinNextOpacity, activeTool, primaryColor, sliceRegions]);

  useEffect(() => { render(); }, [render]);

  // Marching ants animation loop
  useEffect(() => {
    const sel = dragSelection || selectionBounds;
    if (!sel) {
      if (antAnimRef.current) {
        cancelAnimationFrame(antAnimRef.current);
        antAnimRef.current = null;
      }
      return;
    }

    let lastTime = 0;
    const animate = (time: number) => {
      if (time - lastTime > 80) {
        antOffsetRef.current = (antOffsetRef.current + 1) % 8;
        lastTime = time;
        render();
      }
      antAnimRef.current = requestAnimationFrame(animate);
    };
    antAnimRef.current = requestAnimationFrame(animate);
    return () => {
      if (antAnimRef.current) cancelAnimationFrame(antAnimRef.current);
    };
  }, [!!dragSelection, !!selectionBounds, !!transformPreview, render]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => render());
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  // Stroke lifecycle
  const sendStrokePoints = useCallback(
    async (points: [number, number][]) => {
      if (points.length === 0) return;
      try {
        const f = await invoke<CanvasFrameData>('stroke_points', { input: { points } });
        setFrame(f);
      } catch (err) {
        console.error('stroke_points failed:', err);
      }
    },
    [setFrame],
  );

  const handlePointerDown = useCallback(
    async (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (e.button === 1) {
        isPanningRef.current = true;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Move/Transform tool or drag inside selection during transform — begin or continue transform
      if (e.button === 0 && (activeTool === 'move' || activeTool === 'transform' || isTransforming)) {
        const pixel = screenToPixelUnclamped(e.clientX, e.clientY);
        if (!pixel) return;

        const selState = useSelectionStore.getState();

        // If we have a selection but no active transform yet, begin one
        if (selState.hasSelection && !selState.isTransforming) {
          const sel = selState.selectionBounds;
          if (sel && pixel.x >= sel.x && pixel.x < sel.x + sel.width && pixel.y >= sel.y && pixel.y < sel.y + sel.height) {
            try {
              const result = await invoke<{ sourceX: number; sourceY: number; payloadWidth: number; payloadHeight: number; offsetX: number; offsetY: number; payloadData: number[]; frame: CanvasFrameData }>('begin_selection_transform');
              setFrame(result.frame);
              syncLayersFromFrame(result.frame);
              setTransform({ sourceX: result.sourceX, sourceY: result.sourceY, payloadWidth: result.payloadWidth, payloadHeight: result.payloadHeight, offsetX: result.offsetX, offsetY: result.offsetY, payloadData: result.payloadData });
              isTransformDraggingRef.current = true;
              transformDragStartRef.current = { x: pixel.x, y: pixel.y, offsetX: 0, offsetY: 0 };
              canvas.setPointerCapture(e.pointerId);
            } catch (err) { console.error('begin_selection_transform failed:', err); }
            return;
          }
        }

        // Already transforming — drag to move
        if (selState.isTransforming && selState.transformPreview) {
          isTransformDraggingRef.current = true;
          transformDragStartRef.current = { x: pixel.x, y: pixel.y, offsetX: selState.transformPreview.offsetX, offsetY: selState.transformPreview.offsetY };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }

      // Marquee tool
      if (e.button === 0 && activeTool === 'marquee') {
        const pixel = screenToPixelUnclamped(e.clientX, e.clientY);
        if (pixel && frame) {
          // If transforming and clicking outside, commit first
          if (isTransforming) {
            try {
              const f = await invoke<CanvasFrameData>('commit_selection_transform');
              setFrame(f);
              syncLayersFromFrame(f);
              clearTransform();
              markDirty();
              invoke('mark_dirty').catch(() => {});
            } catch (err) { console.error('commit_selection_transform failed:', err); }
          }
          isSelectingRef.current = true;
          selectionStartRef.current = pixel;
          canvas.setPointerCapture(e.pointerId);
          setDragSelection(null);
        }
        return;
      }

      // Eyedropper (color-select)
      if (e.button === 0 && activeTool === 'color-select') {
        const pixel = screenToPixel(e.clientX, e.clientY);
        if (pixel) {
          try {
            const color = await invoke<{ r: number; g: number; b: number; a: number }>('read_pixel', { x: pixel.x, y: pixel.y, layerId: null });
            useToolStore.getState().setPrimaryColor(color);
          } catch (err) { console.error('read_pixel failed:', err); }
        }
        return;
      }

      // Fill (flood fill)
      if (e.button === 0 && activeTool === 'fill') {
        const pixel = screenToPixel(e.clientX, e.clientY);
        if (pixel) {
          if (useTimelineStore.getState().playing) useTimelineStore.getState().setPlaying(false);
          try {
            const f = await invoke<CanvasFrameData>('flood_fill', {
              input: { x: pixel.x, y: pixel.y, r: primaryColor.r, g: primaryColor.g, b: primaryColor.b, a: primaryColor.a },
            });
            setFrame(f);
            syncLayersFromFrame(f);
            markDirty();
            invoke('mark_dirty').catch(() => {});
          } catch (err) { console.error('flood_fill failed:', err); }
        }
        return;
      }

      // Shape tools (line, rectangle, ellipse) — start drag
      if (e.button === 0 && SHAPE_TOOLS.has(activeTool)) {
        const pixel = screenToPixelUnclamped(e.clientX, e.clientY);
        if (pixel && frame) {
          if (useTimelineStore.getState().playing) useTimelineStore.getState().setPlaying(false);
          isShapeDraggingRef.current = true;
          shapeStartRef.current = pixel;
          shapeEndRef.current = pixel;
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      // Magic wand (magic-select) — flood fill → selection rect
      if (e.button === 0 && activeTool === 'magic-select') {
        const pixel = screenToPixel(e.clientX, e.clientY);
        if (pixel) {
          try {
            const result = await invoke<{ x: number; y: number; width: number; height: number; pixelCount: number }>('magic_select', {
              input: { x: pixel.x, y: pixel.y },
            });
            if (result.pixelCount > 0) {
              setSelection({ x: result.x, y: result.y, width: result.width, height: result.height });
              invoke('set_selection_rect', {
                input: { x: result.x, y: result.y, width: result.width, height: result.height },
              }).catch(() => {});
            }
          } catch (err) { console.error('magic_select failed:', err); }
        }
        return;
      }

      // Lasso tool — start freehand path
      if (e.button === 0 && activeTool === 'lasso') {
        const pixel = screenToPixelUnclamped(e.clientX, e.clientY);
        if (pixel && frame) {
          isLassoDraggingRef.current = true;
          lassoPointsRef.current = [pixel];
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      // Socket tool — place anchor at clicked pixel
      if (e.button === 0 && activeTool === 'socket') {
        const pixel = screenToPixel(e.clientX, e.clientY);
        if (pixel) {
          try {
            const result = await invoke<{ id: string; name: string; kind: string; x: number; y: number; bounds: null; parentName: string | null; falloffWeight: number }>('create_anchor', {
              kind: 'custom' as AnchorKind,
              x: pixel.x,
              y: pixel.y,
            });
            useAnchorStore.getState().addAnchor({
              id: result.id,
              name: result.name,
              kind: result.kind as AnchorKind,
              x: result.x,
              y: result.y,
              bounds: result.bounds,
              parentName: result.parentName ?? null,
              falloffWeight: result.falloffWeight ?? 1.0,
            });
          } catch (err) { console.error('create_anchor failed:', err); }
        }
        return;
      }

      // Slice tool — drag to define export region
      if (e.button === 0 && activeTool === 'slice') {
        const pixel = screenToPixelUnclamped(e.clientX, e.clientY);
        if (pixel && frame) {
          isSliceDraggingRef.current = true;
          sliceStartRef.current = pixel;
          sliceEndRef.current = pixel;
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      // Measure tool — click to set start/end points
      if (e.button === 0 && activeTool === 'measure') {
        const pixel = screenToPixel(e.clientX, e.clientY);
        if (pixel) {
          if (!measureStartRef.current || measureEndRef.current) {
            measureStartRef.current = pixel;
            measureEndRef.current = null;
          } else {
            measureEndRef.current = pixel;
          }
          render();
        }
        return;
      }

      if (e.button === 0 && (activeTool === 'pencil' || activeTool === 'eraser' || isSketchTool(activeTool))) {
        // Pause playback on edit
        if (useTimelineStore.getState().playing) useTimelineStore.getState().setPlaying(false);

        const isSketch = isSketchTool(activeTool);
        const isErase = activeTool === 'eraser' || activeTool === 'sketch-eraser';
        const brushState = useBrushSettingsStore.getState();

        let color: { r: number; g: number; b: number; a: number };
        if (isErase) {
          color = { r: 0, g: 0, b: 0, a: 0 };
        } else if (isSketch) {
          // Apply brush opacity to the primary color alpha
          const opacity = brushState.sketchBrush.opacity;
          color = { ...primaryColor, a: Math.round(primaryColor.a * opacity) };
        } else {
          color = primaryColor;
        }

        try {
          await invoke<string>('begin_stroke', {
            input: { tool: activeTool, r: color.r, g: color.g, b: color.b, a: color.a },
          });
        } catch (err) {
          console.error('begin_stroke failed:', err);
          return;
        }

        if (isSketch) {
          useBrushSettingsStore.getState().setRoughModeActive(true);
        }

        isDrawingRef.current = true;
        canvas.setPointerCapture(e.pointerId);
        const pixel = screenToPixel(e.clientX, e.clientY);
        if (pixel) {
          lastPixelRef.current = pixel;
          if (isSketch && frame) {
            const settings = activeTool === 'sketch-eraser' ? brushState.sketchEraser : brushState.sketchBrush;
            const dabPoints = expandStrokeDabs(
              [[pixel.x, pixel.y]],
              { size: settings.size, scatter: settings.scatter, spacing: settings.spacing, canvasWidth: frame.width, canvasHeight: frame.height },
            );
            sendStrokePoints(dabPoints);
          } else {
            sendStrokePoints([[pixel.x, pixel.y]]);
          }
        }
      }
    },
    [activeTool, primaryColor, screenToPixel, screenToPixelUnclamped, sendStrokePoints, frame, isTransforming, setTransform, setFrame, clearTransform, markDirty],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pixel = screenToPixel(e.clientX, e.clientY);
      setHoveredPixel(pixel);

      if (isPanningRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        panBy(dx, dy);
        return;
      }

      // Transform drag
      if (isTransformDraggingRef.current) {
        const current = screenToPixelUnclamped(e.clientX, e.clientY);
        const start = transformDragStartRef.current;
        if (current && start) {
          const newOffsetX = start.offsetX + (current.x - start.x);
          const newOffsetY = start.offsetY + (current.y - start.y);
          invoke<{ sourceX: number; sourceY: number; payloadWidth: number; payloadHeight: number; offsetX: number; offsetY: number; payloadData: number[]; frame: CanvasFrameData }>('move_selection_preview', { offsetX: newOffsetX, offsetY: newOffsetY })
            .then((result) => {
              setTransform({ sourceX: result.sourceX, sourceY: result.sourceY, payloadWidth: result.payloadWidth, payloadHeight: result.payloadHeight, offsetX: result.offsetX, offsetY: result.offsetY, payloadData: result.payloadData });
            })
            .catch(() => {});
        }
        return;
      }

      // Slice drag
      if (isSliceDraggingRef.current) {
        const current = screenToPixelUnclamped(e.clientX, e.clientY);
        if (current) {
          sliceEndRef.current = current;
          render();
        }
        return;
      }

      // Lasso drag
      if (isLassoDraggingRef.current) {
        const current = screenToPixelUnclamped(e.clientX, e.clientY);
        if (current) {
          const pts = lassoPointsRef.current;
          const last = pts[pts.length - 1];
          if (!last || last.x !== current.x || last.y !== current.y) {
            pts.push(current);
            render();
          }
        }
        return;
      }

      // Shape tool drag
      if (isShapeDraggingRef.current) {
        const current = screenToPixelUnclamped(e.clientX, e.clientY);
        if (current) {
          shapeEndRef.current = current;
          render();
        }
        return;
      }

      // Marquee drag
      if (isSelectingRef.current && frame) {
        const current = screenToPixelUnclamped(e.clientX, e.clientY);
        const start = selectionStartRef.current;
        if (current && start) {
          // Clamp to canvas bounds
          const cx = Math.max(0, Math.min(current.x, frame.width));
          const cy = Math.max(0, Math.min(current.y, frame.height));
          const sx = Math.max(0, Math.min(start.x, frame.width));
          const sy = Math.max(0, Math.min(start.y, frame.height));

          const x = Math.min(sx, cx);
          const y = Math.min(sy, cy);
          const w = Math.abs(cx - sx);
          const h = Math.abs(cy - sy);

          if (w > 0 && h > 0) {
            setDragSelection({ x, y, width: w, height: h });
          } else {
            setDragSelection(null);
          }
        }
        return;
      }

      if (isDrawingRef.current && pixel) {
        const last = lastPixelRef.current;
        const isSketch = isSketchTool(activeTool);

        if (last && (last.x !== pixel.x || last.y !== pixel.y)) {
          const points = bresenhamLine(last.x, last.y, pixel.x, pixel.y);
          const newPoints = points.slice(1);
          if (newPoints.length > 0) {
            if (isSketch && frame) {
              const brushState = useBrushSettingsStore.getState();
              const settings = activeTool === 'sketch-eraser' ? brushState.sketchEraser : brushState.sketchBrush;
              const dabPoints = expandStrokeDabs(
                newPoints,
                { size: settings.size, scatter: settings.scatter, spacing: settings.spacing, canvasWidth: frame.width, canvasHeight: frame.height },
              );
              if (dabPoints.length > 0) sendStrokePoints(dabPoints);
            } else {
              sendStrokePoints(newPoints);
            }
          }
        } else if (!last) {
          if (isSketch && frame) {
            const brushState = useBrushSettingsStore.getState();
            const settings = activeTool === 'sketch-eraser' ? brushState.sketchEraser : brushState.sketchBrush;
            const dabPoints = expandStrokeDabs(
              [[pixel.x, pixel.y]],
              { size: settings.size, scatter: settings.scatter, spacing: settings.spacing, canvasWidth: frame.width, canvasHeight: frame.height },
            );
            sendStrokePoints(dabPoints);
          } else {
            sendStrokePoints([[pixel.x, pixel.y]]);
          }
        }
        lastPixelRef.current = pixel;
      }
    },
    [screenToPixel, screenToPixelUnclamped, panBy, sendStrokePoints, frame, setTransform],
  );

  const handlePointerUp = useCallback(async () => {
    // Slice complete — add region
    if (isSliceDraggingRef.current) {
      isSliceDraggingRef.current = false;
      const start = sliceStartRef.current;
      const end = sliceEndRef.current;
      sliceStartRef.current = null;
      sliceEndRef.current = null;
      if (start && end && frame) {
        const minX = Math.max(0, Math.min(start.x, end.x));
        const minY = Math.max(0, Math.min(start.y, end.y));
        const maxX = Math.min(frame.width - 1, Math.max(start.x, end.x));
        const maxY = Math.min(frame.height - 1, Math.max(start.y, end.y));
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        if (w > 1 && h > 1) {
          setSliceRegions((prev) => [
            ...prev,
            { x: minX, y: minY, width: w, height: h, name: `slice_${prev.length + 1}` },
          ]);
        }
      }
      render();
      return;
    }

    // Lasso complete — compute bounding rect of freehand path
    if (isLassoDraggingRef.current) {
      isLassoDraggingRef.current = false;
      const pts = lassoPointsRef.current;
      lassoPointsRef.current = [];
      if (pts.length >= 3 && frame) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        // Clamp to canvas bounds
        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = Math.min(frame.width - 1, maxX);
        maxY = Math.min(frame.height - 1, maxY);
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        if (w > 0 && h > 0) {
          setSelection({ x: minX, y: minY, width: w, height: h });
          invoke('set_selection_rect', {
            input: { x: minX, y: minY, width: w, height: h },
          }).catch(() => {});
        }
      }
      render();
      return;
    }

    // Shape tool complete — commit shape to canvas
    if (isShapeDraggingRef.current) {
      isShapeDraggingRef.current = false;
      const start = shapeStartRef.current;
      const end = shapeEndRef.current;
      shapeStartRef.current = null;
      shapeEndRef.current = null;
      if (start && end && (start.x !== end.x || start.y !== end.y)) {
        let points: [number, number][] = [];
        if (activeTool === 'line') {
          points = bresenhamLine(start.x, start.y, end.x, end.y);
        } else if (activeTool === 'rectangle') {
          points = rectangleOutline(start.x, start.y, end.x, end.y);
        } else if (activeTool === 'ellipse') {
          points = ellipseOutline(start.x, start.y, end.x, end.y);
        }
        if (points.length > 0) {
          try {
            await invoke('begin_stroke', {
              input: { tool: activeTool, r: primaryColor.r, g: primaryColor.g, b: primaryColor.b, a: primaryColor.a },
            });
            await sendStrokePoints(points);
            const f = await invoke<CanvasFrameData>('end_stroke');
            setFrame(f);
            syncLayersFromFrame(f);
            markDirty();
            invoke('mark_dirty').catch(() => {});
          } catch (err) { console.error('shape commit failed:', err); }
        }
      }
      render();
      return;
    }

    // Transform drag complete (just stop dragging, don't commit)
    if (isTransformDraggingRef.current) {
      isTransformDraggingRef.current = false;
      transformDragStartRef.current = null;
      return;
    }

    // Marquee complete
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      selectionStartRef.current = null;
      if (dragSelection && dragSelection.width > 0 && dragSelection.height > 0) {
        setSelection({
          x: dragSelection.x,
          y: dragSelection.y,
          width: dragSelection.width,
          height: dragSelection.height,
        });
        // Sync to backend
        invoke('set_selection_rect', {
          input: { x: dragSelection.x, y: dragSelection.y, width: dragSelection.width, height: dragSelection.height },
        }).catch(() => {});
      } else {
        clearSelection();
        invoke('clear_selection').catch(() => {});
      }
      setDragSelection(null);
      return;
    }

    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPixelRef.current = null;
      useBrushSettingsStore.getState().setRoughModeActive(false);
      try {
        const f = await invoke<CanvasFrameData>('end_stroke');
        setFrame(f);
        syncLayersFromFrame(f);
        markDirty();
        invoke('mark_dirty').catch(() => {});
      } catch (err) {
        console.error('end_stroke failed:', err);
      }
    }
    isPanningRef.current = false;
  }, [setFrame, markDirty, dragSelection, setSelection, clearSelection]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    },
    [zoomIn, zoomOut],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Focus guard: don't hijack typing in inputs/textareas/contenteditable.
      // Allow Ctrl/Cmd combos (Ctrl+S, Ctrl+Z, etc.) to pass through.
      const target = e.target as HTMLElement;
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
        !e.ctrlKey && !e.metaKey
      ) {
        return;
      }

      // Tool activation from manifest (single keys and Shift+key)
      // Skip during active transform — H/V/R are transform ops, not tool switches
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !useSelectionStore.getState().isTransforming) {
        // Swap colors (X)
        if (e.code === 'KeyX' && !e.shiftKey) {
          e.preventDefault();
          useToolStore.getState().swapColors();
          return;
        }
        // Shift+key tool shortcuts
        if (e.shiftKey) {
          const shiftTool = TOOL_SHIFT_KEY_MAP.get(e.code);
          if (shiftTool) {
            e.preventDefault();
            useToolStore.getState().setTool(shiftTool);
            return;
          }
        }
        // Single-key tool shortcuts (no shift)
        if (!e.shiftKey) {
          const tool = TOOL_KEY_MAP.get(e.code);
          if (tool) {
            e.preventDefault();
            useToolStore.getState().setTool(tool);
            return;
          }
        }
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        // If actively drawing, Space = pan; otherwise Space = play/pause
        if (isDrawingRef.current) {
          isPanningRef.current = true;
        } else {
          const tl = useTimelineStore.getState();
          if (tl.frames.length > 1) {
            if (tl.playing) {
              tl.setPlaying(false);
            } else {
              // Block if transform active
              if (useSelectionStore.getState().isTransforming) return;
              useSelectionStore.getState().clearSelection();
              invoke('clear_selection').catch(() => {});
              tl.setPlaying(true);
            }
          }
        }
        return;
      }

      // Enter commits active transform
      if (e.code === 'Enter' && useSelectionStore.getState().isTransforming) {
        e.preventDefault();
        try {
          const f = await invoke<CanvasFrameData>('commit_selection_transform');
          setFrame(f);
          syncLayersFromFrame(f);
          clearTransform();
          markDirty();
          invoke('mark_dirty').catch(() => {});
        } catch (err) { console.error('commit_selection_transform failed:', err); }
        return;
      }

      // Esc cancels transform or clears selection
      if (e.code === 'Escape') {
        if (useSelectionStore.getState().isTransforming) {
          try {
            const f = await invoke<CanvasFrameData>('cancel_selection_transform');
            setFrame(f);
            syncLayersFromFrame(f);
            clearTransform();
          } catch (err) { console.error('cancel_selection_transform failed:', err); }
          return;
        }
        clearSelection();
        invoke('clear_selection').catch(() => {});
        return;
      }

      // Arrow keys nudge during transform
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && useSelectionStore.getState().isTransforming) {
        e.preventDefault();
        const step = e.shiftKey ? 8 : 1;
        let dx = 0, dy = 0;
        if (e.code === 'ArrowLeft') dx = -step;
        if (e.code === 'ArrowRight') dx = step;
        if (e.code === 'ArrowUp') dy = -step;
        if (e.code === 'ArrowDown') dy = step;
        try {
          const result = await invoke<{ sourceX: number; sourceY: number; payloadWidth: number; payloadHeight: number; offsetX: number; offsetY: number; payloadData: number[]; frame: CanvasFrameData }>('nudge_selection', { dx, dy });
          setTransform({ sourceX: result.sourceX, sourceY: result.sourceY, payloadWidth: result.payloadWidth, payloadHeight: result.payloadHeight, offsetX: result.offsetX, offsetY: result.offsetY, payloadData: result.payloadData });
        } catch (err) { console.error('nudge_selection failed:', err); }
        return;
      }

      // Flip/rotate shortcuts during transform
      if (useSelectionStore.getState().isTransforming && !e.ctrlKey && !e.metaKey) {
        const transformCmd =
          e.code === 'KeyH' ? 'flip_selection_horizontal' :
          e.code === 'KeyV' ? 'flip_selection_vertical' :
          e.code === 'KeyR' && !e.shiftKey ? 'rotate_selection_90_cw' :
          e.code === 'KeyR' && e.shiftKey ? 'rotate_selection_90_ccw' :
          null;
        if (transformCmd) {
          e.preventDefault();
          try {
            const result = await invoke<{ sourceX: number; sourceY: number; payloadWidth: number; payloadHeight: number; offsetX: number; offsetY: number; payloadData: number[]; frame: CanvasFrameData }>(transformCmd);
            setTransform({ sourceX: result.sourceX, sourceY: result.sourceY, payloadWidth: result.payloadWidth, payloadHeight: result.payloadHeight, offsetX: result.offsetX, offsetY: result.offsetY, payloadData: result.payloadData });
          } catch (err) { console.error(`${transformCmd} failed:`, err); }
          return;
        }
      }

      // Delete/Backspace clears selected pixels
      if ((e.code === 'Delete' || e.code === 'Backspace') && useSelectionStore.getState().hasSelection) {
        e.preventDefault();
        try {
          const f = await invoke<CanvasFrameData>('delete_selection');
          setFrame(f);
          syncLayersFromFrame(f);
          markDirty();
          invoke('mark_dirty').catch(() => {});
        } catch (err) { console.error('delete_selection failed:', err); }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.repeat) {
        // Copy selection
        if (e.code === 'KeyC' && useSelectionStore.getState().hasSelection) {
          e.preventDefault();
          try {
            await invoke('copy_selection');
          } catch (err) { console.error('copy_selection failed:', err); }
          return;
        }
        // Cut selection
        if (e.code === 'KeyX' && useSelectionStore.getState().hasSelection) {
          e.preventDefault();
          try {
            const f = await invoke<CanvasFrameData>('cut_selection');
            setFrame(f);
            syncLayersFromFrame(f);
            markDirty();
            invoke('mark_dirty').catch(() => {});
          } catch (err) { console.error('cut_selection failed:', err); }
          return;
        }
        // Paste
        if (e.code === 'KeyV') {
          e.preventDefault();
          try {
            const f = await invoke<CanvasFrameData>('paste_selection');
            setFrame(f);
            syncLayersFromFrame(f);
            markDirty();
            invoke('mark_dirty').catch(() => {});
          } catch (err) { console.error('paste_selection failed:', err); }
          return;
        }

        if (e.code === 'KeyZ' && !e.shiftKey) {
          e.preventDefault();
          if (useTimelineStore.getState().playing) useTimelineStore.getState().setPlaying(false);
          try {
            const f = await invoke<CanvasFrameData>('undo');
            setFrame(f);
            syncLayersFromFrame(f);
            markDirty();
            invoke('mark_dirty').catch(() => {});
          } catch (err) { console.error('undo failed:', err); }
          return;
        }
        if ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY') {
          e.preventDefault();
          if (useTimelineStore.getState().playing) useTimelineStore.getState().setPlaying(false);
          try {
            const f = await invoke<CanvasFrameData>('redo');
            setFrame(f);
            syncLayersFromFrame(f);
            markDirty();
            invoke('mark_dirty').catch(() => {});
          } catch (err) { console.error('redo failed:', err); }
          return;
        }
      }

      // Toggle onion skin with O (not a tool, so handled separately from manifest dispatch)
      if (e.code === 'KeyO' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        useTimelineStore.getState().toggleOnionSkin();
        return;
      }

      // Prev/next frame with , and . (pauses playback)
      if (e.code === 'Comma' || e.code === 'Period') {
        e.preventDefault();
        const tl = useTimelineStore.getState();
        if (tl.playing) tl.setPlaying(false);
        if (tl.frames.length <= 1) return;
        const idx = tl.frames.findIndex((f) => f.id === tl.activeFrameId);
        const targetIdx = e.code === 'Comma' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= tl.frames.length) return;
        const targetId = tl.frames[targetIdx].id;
        invoke<{ frames: Array<{ id: string; name: string; index: number; durationMs: number | null }>; activeFrameIndex: number; activeFrameId: string; frame: CanvasFrameData }>('select_frame', { frameId: targetId })
          .then((result) => {
            tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
            setFrame(result.frame);
            syncLayersFromFrame(result.frame);
            clearSelection();
            clearTransform();
          })
          .catch(() => {});
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') isPanningRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setFrame, markDirty, clearSelection, clearTransform, setTransform]);

  const zoomPercent = `${zoom * 100}%`;
  const pixelCoord = hoveredPixel ? `${hoveredPixel.x}, ${hoveredPixel.y}` : '\u2014';
  const colorHex = `#${primaryColor.r.toString(16).padStart(2, '0')}${primaryColor.g.toString(16).padStart(2, '0')}${primaryColor.b.toString(16).padStart(2, '0')}`;
  const selectionInfo = hasSelection && selectionBounds
    ? `${selectionBounds.width}\u00d7${selectionBounds.height}`
    : null;

  const cursor = isTransforming
    ? 'move'
    : activeTool === 'pencil' || activeTool === 'eraser' || isSketchTool(activeTool)
      ? 'crosshair'
      : activeTool === 'marquee' || SHAPE_TOOLS.has(activeTool) || activeTool === 'fill' || activeTool === 'lasso' || activeTool === 'magic-select' || activeTool === 'slice'
        ? 'crosshair'
        : activeTool === 'socket'
          ? 'cell'
        : activeTool === 'color-select'
          ? 'copy'
          : activeTool === 'move' || activeTool === 'transform'
            ? 'move'
            : activeTool === 'measure'
              ? 'crosshair'
              : 'default';

  return (
    <main className="canvas-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="pixel-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        style={{ cursor }}
      />
      <div className="canvas-status">
        <span>{canvasSize.width}{'\u00d7'}{canvasSize.height}</span>
        <span>{zoomPercent}</span>
        <span>{pixelCoord}</span>
        <span style={{ color: colorHex }}>{colorHex}</span>
        <span>{activeTool}</span>
        {isSketchTool(activeTool) && <span className="status-sketch" title="Rough drawing mode">rough</span>}
        {selectionInfo && <span title="Selection">{selectionInfo}</span>}
        {isTransforming && <span title="Enter to commit, Esc to cancel">transform</span>}
        {frameCount > 1 && <span title=", / . to switch">F{activeFrameIndex + 1}/{frameCount}</span>}
        {playing && <span title="Space to pause">playing</span>}
        {onionSkinEnabled && frameCount > 1 && <span title="O to toggle">onion</span>}
        {frame?.canUndo && <span title="Ctrl+Z">undo</span>}
        {frame?.canRedo && <span title="Ctrl+Shift+Z">redo</span>}
      </div>
    </main>
  );
}
