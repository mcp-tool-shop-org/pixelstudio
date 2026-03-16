import { useRef, useEffect, useCallback, useState, type WheelEvent as ReactWheelEvent } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import {
  samplePixel,
  drawBrushDab,
  bresenhamLine,
  floodFill,
  clonePixelBuffer,
  normalizeRect,
  extractSelection,
  clearSelectionArea,
  blitSelection,
  TRANSPARENT,
} from '@glyphstudio/state';
import type { Rgba } from '@glyphstudio/state';
import type { SpritePixelBuffer, SpriteSelectionRect } from '@glyphstudio/domain';
import { pointerToPixel, getSpriteOrigin } from '../lib/spriteCanvasMath';
import type { SpriteViewport } from '../lib/spriteCanvasMath';

const CANVAS_BG = '#1a1a1e';
const CHECK_LIGHT = '#2a2a2e';
const CHECK_DARK = '#222226';
const CHECK_SIZE = 8;
const GRID_COLOR = 'rgba(255,255,255,0.12)';
const GRID_ZOOM_THRESHOLD = 4;
const ONION_BEFORE_TINT = [0, 120, 255]; // blue tint for previous frames
const ONION_AFTER_TINT = [255, 80, 0];   // orange tint for next frames
const SELECTION_DASH = [4, 4];
const SELECTION_COLOR = 'rgba(255,255,255,0.8)';
const SELECTION_SHADOW = 'rgba(0,0,0,0.6)';

/** Render a pixel buffer as an onion skin overlay with tinting and opacity. */
function renderOnionBuffer(
  ctx: CanvasRenderingContext2D,
  buf: SpritePixelBuffer,
  spriteWidth: number,
  spriteHeight: number,
  originX: number,
  originY: number,
  zoom: number,
  opacity: number,
  tint: number[],
): void {
  ctx.globalAlpha = opacity;
  for (let py = 0; py < spriteHeight; py++) {
    for (let px = 0; px < spriteWidth; px++) {
      const i = (py * buf.width + px) * 4;
      const a = buf.data[i + 3];
      if (a === 0) continue;
      // Blend original color with tint (50/50)
      const r = Math.round((buf.data[i] + tint[0]) / 2);
      const g = Math.round((buf.data[i + 1] + tint[1]) / 2);
      const b = Math.round((buf.data[i + 2] + tint[2]) / 2);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(originX + px * zoom, originY + py * zoom, zoom, zoom);
    }
  }
  ctx.globalAlpha = 1.0;
}

/** Render a dashed selection rectangle overlay. */
function renderSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  rect: SpriteSelectionRect,
  originX: number,
  originY: number,
  zoom: number,
): void {
  const sx = originX + rect.x * zoom;
  const sy = originY + rect.y * zoom;
  const sw = rect.width * zoom;
  const sh = rect.height * zoom;

  ctx.save();
  ctx.lineWidth = 1;

  // Shadow pass (offset by 1px for contrast)
  ctx.strokeStyle = SELECTION_SHADOW;
  ctx.setLineDash(SELECTION_DASH);
  ctx.lineDashOffset = 0;
  ctx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);

  // Bright pass
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineDashOffset = 4;
  ctx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);

  ctx.restore();
}

/** Check whether a pixel coordinate is inside a selection rectangle. */
function isInsideSelection(px: number, py: number, rect: SpriteSelectionRect): boolean {
  return px >= rect.x && px < rect.x + rect.width && py >= rect.y && py < rect.y + rect.height;
}

/**
 * Real pixel canvas with nearest-neighbor rendering, pixel grid,
 * and tool interaction (pencil, eraser, fill, eyedropper, select).
 *
 * Draft stroke state is local to this component. Pointer down starts
 * a draft on a cloned buffer; pointer moves paint into the draft;
 * pointer up commits the final buffer through the store once.
 */
export function SpriteCanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number } | null>(null);

  // Store selectors
  const doc = useSpriteEditorStore((s) => s.document);
  const pixelBuffers = useSpriteEditorStore((s) => s.pixelBuffers);
  const activeFrameIndex = useSpriteEditorStore((s) => s.activeFrameIndex);
  const zoom = useSpriteEditorStore((s) => s.zoom);
  const panX = useSpriteEditorStore((s) => s.panX);
  const panY = useSpriteEditorStore((s) => s.panY);
  const tool = useSpriteEditorStore((s) => s.tool);
  const onionSkin = useSpriteEditorStore((s) => s.onionSkin);
  const selectionRect = useSpriteEditorStore((s) => s.selectionRect);
  const showGrid = useSpriteEditorStore((s) => s.showGrid);
  const commitPixels = useSpriteEditorStore((s) => s.commitPixels);
  const setForegroundColorByRgba = useSpriteEditorStore((s) => s.setForegroundColorByRgba);
  const setSelection = useSpriteEditorStore((s) => s.setSelection);
  const clearSelection = useSpriteEditorStore((s) => s.clearSelection);
  const zoomIn = useSpriteEditorStore((s) => s.zoomIn);
  const zoomOut = useSpriteEditorStore((s) => s.zoomOut);

  // Draft stroke state — local, never in store
  const draftRef = useRef<{
    buffer: SpritePixelBuffer;
    lastPixelX: number;
    lastPixelY: number;
  } | null>(null);

  // Selection drag state — local
  const selectDragRef = useRef<{
    mode: 'creating' | 'moving';
    // For creating: drag start pixel
    startX: number;
    startY: number;
    // For moving: original selection rect + extracted buffer + offset
    origRect?: SpriteSelectionRect;
    selBuffer?: SpritePixelBuffer;
    draftBuffer?: SpritePixelBuffer;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Get active frame buffer
  const activeFrame = doc?.frames[activeFrameIndex];
  const activeBuffer = activeFrame ? pixelBuffers[activeFrame.id] : undefined;

  // Build viewport
  const viewport: SpriteViewport | null = doc && canvasSize.width > 0
    ? {
        zoom,
        panX,
        panY,
        spriteWidth: doc.width,
        spriteHeight: doc.height,
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
      }
    : null;

  // Get current foreground color
  const getForegroundRgba = useCallback((): Rgba => {
    const d = useSpriteEditorStore.getState().document;
    if (!d) return [0, 0, 0, 255];
    const c = d.palette.colors[d.palette.foregroundIndex];
    return c ? c.rgba : [0, 0, 0, 255];
  }, []);

  // ── Resize observer ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Render loop ──
  const renderCanvas = useCallback(
    (bufferToRender?: SpritePixelBuffer, selOverlay?: SpriteSelectionRect | null) => {
      const canvas = canvasRef.current;
      if (!canvas || !doc || !viewport) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const buf = bufferToRender ?? activeBuffer;
      if (!buf) return;

      const { width: cw, height: ch } = canvasSize;
      canvas.width = cw;
      canvas.height = ch;

      // Background
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, cw, ch);

      const { originX, originY } = getSpriteOrigin(viewport);
      const scaledW = doc.width * zoom;
      const scaledH = doc.height * zoom;

      // Checkerboard transparency pattern
      for (let py = 0; py < doc.height; py++) {
        for (let px = 0; px < doc.width; px++) {
          const sx = originX + px * zoom;
          const sy = originY + py * zoom;
          const checkX = Math.floor(px / (CHECK_SIZE / zoom)) % 2;
          const checkY = Math.floor(py / (CHECK_SIZE / zoom)) % 2;
          ctx.fillStyle = (checkX + checkY) % 2 === 0 ? CHECK_LIGHT : CHECK_DARK;
          ctx.fillRect(sx, sy, zoom, zoom);
        }
      }

      // Onion skin overlays (rendered BEFORE active frame so active stays dominant)
      const currentOnionSkin = useSpriteEditorStore.getState().onionSkin;
      if (currentOnionSkin.enabled && doc.frames.length > 1) {
        const currentBuffers = useSpriteEditorStore.getState().pixelBuffers;
        const afi = useSpriteEditorStore.getState().activeFrameIndex;

        // Previous frames (blue tint)
        for (let delta = 1; delta <= currentOnionSkin.framesBefore; delta++) {
          const fi = afi - delta;
          if (fi < 0) break;
          const frame = doc.frames[fi];
          const frameBuf = frame ? currentBuffers[frame.id] : undefined;
          if (!frameBuf) continue;
          const fadeOpacity = currentOnionSkin.opacity / delta;
          renderOnionBuffer(ctx, frameBuf, doc.width, doc.height, originX, originY, zoom, fadeOpacity, ONION_BEFORE_TINT);
        }

        // Next frames (orange tint)
        for (let delta = 1; delta <= currentOnionSkin.framesAfter; delta++) {
          const fi = afi + delta;
          if (fi >= doc.frames.length) break;
          const frame = doc.frames[fi];
          const frameBuf = frame ? currentBuffers[frame.id] : undefined;
          if (!frameBuf) continue;
          const fadeOpacity = currentOnionSkin.opacity / delta;
          renderOnionBuffer(ctx, frameBuf, doc.width, doc.height, originX, originY, zoom, fadeOpacity, ONION_AFTER_TINT);
        }
      }

      // Pixel data — nearest neighbor (active frame, always on top of onion skin)
      for (let py = 0; py < doc.height; py++) {
        for (let px = 0; px < doc.width; px++) {
          const i = (py * buf.width + px) * 4;
          const a = buf.data[i + 3];
          if (a === 0) continue;
          const r = buf.data[i];
          const g = buf.data[i + 1];
          const b = buf.data[i + 2];
          ctx.fillStyle = a === 255
            ? `rgb(${r},${g},${b})`
            : `rgba(${r},${g},${b},${a / 255})`;
          ctx.fillRect(originX + px * zoom, originY + py * zoom, zoom, zoom);
        }
      }

      // Pixel grid
      if (useSpriteEditorStore.getState().showGrid && zoom >= GRID_ZOOM_THRESHOLD) {
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let px = 0; px <= doc.width; px++) {
          const x = Math.round(originX + px * zoom) + 0.5;
          ctx.moveTo(x, originY);
          ctx.lineTo(x, originY + scaledH);
        }
        for (let py = 0; py <= doc.height; py++) {
          const y = Math.round(originY + py * zoom) + 0.5;
          ctx.moveTo(originX, y);
          ctx.lineTo(originX + scaledW, y);
        }
        ctx.stroke();
      }

      // Selection overlay
      const selRect = selOverlay !== undefined ? selOverlay : useSpriteEditorStore.getState().selectionRect;
      if (selRect) {
        renderSelectionOverlay(ctx, selRect, originX, originY, zoom);
      }
    },
    [doc, activeBuffer, viewport, zoom, canvasSize, onionSkin, showGrid],
  );

  // Re-render when state changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas, selectionRect]);

  // ── Pointer event helpers ──

  const getPointerPixel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!viewport) return null;
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      return pointerToPixel(pointerX, pointerY, viewport);
    },
    [viewport],
  );

  // ── Tool handlers ──

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!doc || !activeBuffer || !viewport) return;

      const pixel = getPointerPixel(e);
      if (!pixel) return;

      const activeTool = useSpriteEditorStore.getState().tool.activeTool;

      if (activeTool === 'eyedropper') {
        const color = samplePixel(activeBuffer, pixel.x, pixel.y);
        if (color && color[3] > 0) {
          setForegroundColorByRgba(color);
        }
        return;
      }

      if (activeTool === 'fill') {
        const fillBuffer = clonePixelBuffer(activeBuffer);
        const fillColor = getForegroundRgba();
        floodFill(fillBuffer, pixel.x, pixel.y, fillColor);
        commitPixels(fillBuffer);
        return;
      }

      if (activeTool === 'select') {
        const currentSel = useSpriteEditorStore.getState().selectionRect;
        const currentSelBuf = useSpriteEditorStore.getState().selectionBuffer;

        // If clicking inside existing selection → start move
        if (currentSel && isInsideSelection(pixel.x, pixel.y, currentSel) && currentSelBuf) {
          const draft = clonePixelBuffer(activeBuffer);
          // Clear original selection area in draft
          clearSelectionArea(draft, currentSel);
          // Blit selection buffer at current position for preview
          blitSelection(draft, currentSelBuf, currentSel.x, currentSel.y);

          selectDragRef.current = {
            mode: 'moving',
            startX: pixel.x,
            startY: pixel.y,
            origRect: { ...currentSel },
            selBuffer: currentSelBuf,
            draftBuffer: draft,
            currentX: pixel.x,
            currentY: pixel.y,
          };
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          renderCanvas(draft, currentSel);
          return;
        }

        // Otherwise → clear old selection and start new drag
        clearSelection();
        selectDragRef.current = {
          mode: 'creating',
          startX: pixel.x,
          startY: pixel.y,
          currentX: pixel.x,
          currentY: pixel.y,
        };
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        return;
      }

      // Pencil or eraser — start draft stroke
      const draft = clonePixelBuffer(activeBuffer);
      const color: Rgba = activeTool === 'eraser' ? TRANSPARENT : getForegroundRgba();
      const { brushSize, brushShape } = useSpriteEditorStore.getState().tool;
      drawBrushDab(draft, pixel.x, pixel.y, color, brushSize, brushShape);

      draftRef.current = { buffer: draft, lastPixelX: pixel.x, lastPixelY: pixel.y };

      // Capture pointer for drag
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);

      // Render draft preview
      renderCanvas(draft);
    },
    [doc, activeBuffer, viewport, getPointerPixel, commitPixels, setForegroundColorByRgba, getForegroundRgba, renderCanvas, clearSelection, setSelection],
  );

  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else if (e.deltaY > 0) {
        zoomOut();
      }
    },
    [zoomIn, zoomOut],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Track hover pixel for coordinate display
      const hp = getPointerPixel(e);
      if (hp && doc && hp.x >= 0 && hp.x < doc.width && hp.y >= 0 && hp.y < doc.height) {
        setHoverPixel({ x: hp.x, y: hp.y });
      } else {
        setHoverPixel(null);
      }

      // Selection drag
      if (selectDragRef.current && viewport) {
        const pixel = getPointerPixel(e);
        if (!pixel) return;

        const drag = selectDragRef.current;
        if (pixel.x === drag.currentX && pixel.y === drag.currentY) return;
        drag.currentX = pixel.x;
        drag.currentY = pixel.y;

        if (drag.mode === 'creating') {
          const previewRect = normalizeRect(drag.startX, drag.startY, pixel.x, pixel.y);
          renderCanvas(undefined, previewRect);
          return;
        }

        if (drag.mode === 'moving' && drag.origRect && drag.selBuffer && activeBuffer) {
          const dx = pixel.x - drag.startX;
          const dy = pixel.y - drag.startY;
          const movedRect: SpriteSelectionRect = {
            x: drag.origRect.x + dx,
            y: drag.origRect.y + dy,
            width: drag.origRect.width,
            height: drag.origRect.height,
          };

          // Rebuild draft: clear original area, blit at new position
          const draft = clonePixelBuffer(activeBuffer);
          clearSelectionArea(draft, drag.origRect);
          blitSelection(draft, drag.selBuffer, movedRect.x, movedRect.y);
          drag.draftBuffer = draft;

          renderCanvas(draft, movedRect);
          return;
        }
        return;
      }

      // Paint tool drag
      if (!draftRef.current || !viewport) return;

      const pixel = getPointerPixel(e);
      if (!pixel) return;

      const draft = draftRef.current;
      if (pixel.x === draft.lastPixelX && pixel.y === draft.lastPixelY) return;

      const activeTool = useSpriteEditorStore.getState().tool.activeTool;
      const color: Rgba = activeTool === 'eraser' ? TRANSPARENT : getForegroundRgba();
      const { brushSize, brushShape } = useSpriteEditorStore.getState().tool;

      // Bresenham interpolation between last and current pixel
      const points = bresenhamLine(draft.lastPixelX, draft.lastPixelY, pixel.x, pixel.y);
      for (const [px, py] of points) {
        drawBrushDab(draft.buffer, px, py, color, brushSize, brushShape);
      }

      draft.lastPixelX = pixel.x;
      draft.lastPixelY = pixel.y;

      // Render draft preview
      renderCanvas(draft.buffer);
    },
    [viewport, getPointerPixel, getForegroundRgba, renderCanvas, activeBuffer],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Selection drag finalize
      if (selectDragRef.current && activeBuffer) {
        const drag = selectDragRef.current;

        if (drag.mode === 'creating') {
          const rect = normalizeRect(drag.startX, drag.startY, drag.currentX, drag.currentY);
          // Extract pixels from active buffer
          const selBuf = extractSelection(activeBuffer, rect);
          setSelection(rect, selBuf);
          selectDragRef.current = null;
          renderCanvas(undefined, rect);
          return;
        }

        if (drag.mode === 'moving' && drag.origRect && drag.selBuffer) {
          const dx = drag.currentX - drag.startX;
          const dy = drag.currentY - drag.startY;
          const movedRect: SpriteSelectionRect = {
            x: drag.origRect.x + dx,
            y: drag.origRect.y + dy,
            width: drag.origRect.width,
            height: drag.origRect.height,
          };

          // Commit: clear original area + blit at new position
          const final = clonePixelBuffer(activeBuffer);
          clearSelectionArea(final, drag.origRect);
          blitSelection(final, drag.selBuffer, movedRect.x, movedRect.y);
          commitPixels(final);

          // Update selection to new position
          setSelection(movedRect, drag.selBuffer);
          selectDragRef.current = null;
          return;
        }

        selectDragRef.current = null;
        return;
      }

      // Paint tool finalize
      if (!draftRef.current) return;

      // Commit the final draft buffer — one authored edit
      commitPixels(draftRef.current.buffer);
      draftRef.current = null;
    },
    [commitPixels, activeBuffer, setSelection, renderCanvas],
  );

  if (!doc) return null;

  return (
    <div className="sprite-canvas-area" data-testid="sprite-canvas-area" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="sprite-canvas"
        data-testid="sprite-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={(e) => { handlePointerUp(e); setHoverPixel(null); }}
        onWheel={handleWheel}
        style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
      />
      <div className="sprite-canvas-info" data-testid="sprite-canvas-info">
        <span data-testid="canvas-dimensions">
          {doc.width} x {doc.height}
        </span>
        <span data-testid="canvas-zoom">{zoom}x</span>
        <span data-testid="canvas-frame">
          Frame {activeFrameIndex + 1}/{doc.frames.length}
        </span>
        {activeFrame && (
          <span data-testid="canvas-frame-duration">{activeFrame.durationMs}ms</span>
        )}
        {hoverPixel && (
          <span data-testid="canvas-pixel-coords">{hoverPixel.x},{hoverPixel.y}</span>
        )}
      </div>
    </div>
  );
}
