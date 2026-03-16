import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCanvasViewStore } from '@glyphstudio/state';
import { useToolStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import { useTimelineStore } from '@glyphstudio/state';
import { useSnapshotStore } from '@glyphstudio/state';
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

    ctx.strokeStyle = '#3a3a40';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX - 0.5, originY - 0.5, spriteW + 1, spriteH + 1);
  }, [zoom, panX, panY, showPixelGrid, showSilhouette, silhouetteColor, compareSnapshotId, previewBackground, frame, frameVersion, selectionBounds, dragSelection, transformPreview, onionSkinEnabled, onionSkinData, onionSkinShowPrev, onionSkinShowNext, onionSkinPrevOpacity, onionSkinNextOpacity]);

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

      // Move tool or drag inside selection during transform — begin or continue transform
      if (e.button === 0 && (activeTool === 'move' || isTransforming)) {
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

      if (e.button === 0 && (activeTool === 'pencil' || activeTool === 'eraser')) {
        // Pause playback on edit
        if (useTimelineStore.getState().playing) useTimelineStore.getState().setPlaying(false);
        const color = activeTool === 'pencil' ? primaryColor : { r: 0, g: 0, b: 0, a: 0 };
        try {
          await invoke<string>('begin_stroke', {
            input: { tool: activeTool, r: color.r, g: color.g, b: color.b, a: color.a },
          });
        } catch (err) {
          console.error('begin_stroke failed:', err);
          return;
        }

        isDrawingRef.current = true;
        canvas.setPointerCapture(e.pointerId);
        const pixel = screenToPixel(e.clientX, e.clientY);
        if (pixel) {
          lastPixelRef.current = pixel;
          sendStrokePoints([[pixel.x, pixel.y]]);
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
        if (last && (last.x !== pixel.x || last.y !== pixel.y)) {
          const points = bresenhamLine(last.x, last.y, pixel.x, pixel.y);
          const newPoints = points.slice(1);
          if (newPoints.length > 0) sendStrokePoints(newPoints);
        } else if (!last) {
          sendStrokePoints([[pixel.x, pixel.y]]);
        }
        lastPixelRef.current = pixel;
      }
    },
    [screenToPixel, screenToPixelUnclamped, panBy, sendStrokePoints, frame, setTransform],
  );

  const handlePointerUp = useCallback(async () => {
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

      // Toggle onion skin with O
      if (e.code === 'KeyO' && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
    : activeTool === 'pencil' || activeTool === 'eraser'
      ? 'crosshair'
      : activeTool === 'marquee'
        ? 'crosshair'
        : activeTool === 'move'
          ? 'move'
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
