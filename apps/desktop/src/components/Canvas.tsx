import { useRef, useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCanvasViewStore } from '@pixelstudio/state';
import { useToolStore } from '@pixelstudio/state';
import { useProjectStore } from '@pixelstudio/state';
import { useLayerStore } from '@pixelstudio/state';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';

const CHECK_LIGHT = '#2a2a2e';
const CHECK_DARK = '#222226';
const CHECK_SIZE = 8;
const CANVAS_BG = '#111114';
const GRID_COLOR = 'rgba(255,255,255,0.08)';

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

  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const frame = useCanvasFrameStore((s) => s.frame);
  const frameVersion = useCanvasFrameStore((s) => s.version);
  const setFrame = useCanvasFrameStore((s) => s.setFrame);

  const zoom = useCanvasViewStore((s) => s.zoom);
  const panX = useCanvasViewStore((s) => s.panX);
  const panY = useCanvasViewStore((s) => s.panY);
  const showPixelGrid = useCanvasViewStore((s) => s.showPixelGrid);
  const previewBackground = useCanvasViewStore((s) => s.previewBackground);
  const panBy = useCanvasViewStore((s) => s.panBy);
  const zoomIn = useCanvasViewStore((s) => s.zoomIn);
  const zoomOut = useCanvasViewStore((s) => s.zoomOut);

  const activeTool = useToolStore((s) => s.activeTool);
  const primaryColor = useToolStore((s) => s.primaryColor);
  const canvasSize = useProjectStore((s) => s.canvasSize);
  const markDirty = useProjectStore((s) => s.markDirty);

  const screenToPixel = useCallback(
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

      if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) return null;
      return { x: px, y: py };
    },
    [zoom, panX, panY, frame],
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

    const frameData = frame.data;
    for (let py = 0; py < frame.height; py++) {
      for (let px = 0; px < frame.width; px++) {
        const i = (py * frame.width + px) * 4;
        const a = frameData[i + 3];
        if (a === 0) continue;
        const sx = originX + px * zoom;
        const sy = originY + py * zoom;
        if (sx + zoom < 0 || sy + zoom < 0 || sx > w || sy > h) continue;
        if (a === 255) {
          ctx.fillStyle = `rgb(${frameData[i]},${frameData[i + 1]},${frameData[i + 2]})`;
        } else {
          ctx.fillStyle = `rgba(${frameData[i]},${frameData[i + 1]},${frameData[i + 2]},${a / 255})`;
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

    ctx.strokeStyle = '#3a3a40';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX - 0.5, originY - 0.5, spriteW + 1, spriteH + 1);
  }, [zoom, panX, panY, showPixelGrid, previewBackground, frame, frameVersion]);

  useEffect(() => { render(); }, [render]);

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

      if (e.button === 0 && (activeTool === 'pencil' || activeTool === 'eraser')) {
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
    [activeTool, primaryColor, screenToPixel, sendStrokePoints],
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
    [screenToPixel, panBy, sendStrokePoints],
  );

  const handlePointerUp = useCallback(async () => {
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
  }, [setFrame, markDirty]);

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
        isPanningRef.current = true;
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.repeat) {
        if (e.code === 'KeyZ' && !e.shiftKey) {
          e.preventDefault();
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
  }, [setFrame, markDirty]);

  const zoomPercent = `${zoom * 100}%`;
  const pixelCoord = hoveredPixel ? `${hoveredPixel.x}, ${hoveredPixel.y}` : '\u2014';
  const colorHex = `#${primaryColor.r.toString(16).padStart(2, '0')}${primaryColor.g.toString(16).padStart(2, '0')}${primaryColor.b.toString(16).padStart(2, '0')}`;

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
        style={{ cursor: activeTool === 'pencil' || activeTool === 'eraser' ? 'crosshair' : 'default' }}
      />
      <div className="canvas-status">
        <span>{canvasSize.width}{'\u00d7'}{canvasSize.height}</span>
        <span>{zoomPercent}</span>
        <span>{pixelCoord}</span>
        <span style={{ color: colorHex }}>{colorHex}</span>
        <span>{activeTool}</span>
        {frame?.canUndo && <span title="Ctrl+Z">undo</span>}
        {frame?.canRedo && <span title="Ctrl+Shift+Z">redo</span>}
      </div>
    </main>
  );
}
