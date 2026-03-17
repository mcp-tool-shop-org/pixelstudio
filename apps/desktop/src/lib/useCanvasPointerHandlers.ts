/**
 * Pointer handler logic extracted from Canvas.tsx.
 *
 * Owns: all per-tool drag refs, dragSelection state, sliceRegions state,
 * sendStrokePoints, loadSliceRegions.
 *
 * Returns the three canvas pointer handlers plus shared state/refs that the
 * Canvas render callback and JSX need to read.
 */
import { useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  useToolStore,
  useSelectionStore,
  useTimelineStore,
  useBrushSettingsStore,
  expandStrokeDabs,
  useCanvasViewStore,
  useAnchorStore,
  useSliceStore,
} from '@glyphstudio/state';
import { isSketchTool } from '@glyphstudio/domain';
import type { AnchorKind } from '@glyphstudio/domain';
import { useCanvasFrameStore, type CanvasFrameData } from './canvasFrameStore';
import { syncLayersFromFrame } from './syncLayers';
import { useProjectStore } from '@glyphstudio/state';
import {
  screenToCanvasPixelUnclamped,
  screenToCanvasPixelClamped,
  bresenhamLine,
  rectangleOutline,
  applyMirrorPoints,
  applyDitherFilter,
  constrainShapeEnd,
  ellipseOutline,
} from './canvasPixelMath';

const SHAPE_TOOLS = new Set(['line', 'rectangle', 'ellipse']);

interface UseCanvasPointerHandlersOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Stable ref to the Canvas render callback — updated each render cycle. */
  renderRef: React.RefObject<() => void>;
}

export interface UseCanvasPointerHandlersReturn {
  handlePointerDown: (e: React.PointerEvent) => Promise<void>;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: () => Promise<void>;
  /** Current drag selection rectangle (null when not dragging marquee). */
  dragSelection: { x: number; y: number; width: number; height: number } | null;
  /** Slice regions loaded from backend. */
  sliceRegions: { id: string; x: number; y: number; width: number; height: number; name: string }[];
  loadSliceRegions: () => void;
  /** Hovered canvas pixel for status display (null when cursor is outside). */
  hoveredPixel: { x: number; y: number } | null;
  /** Call on pointerLeave to reset the hover display. */
  clearHoveredPixel: () => void;
  // Drag refs needed by the Canvas render callback for live overlays
  isSliceDraggingRef: React.RefObject<boolean>;
  sliceStartRef: React.RefObject<{ x: number; y: number } | null>;
  sliceEndRef: React.RefObject<{ x: number; y: number } | null>;
  isLassoDraggingRef: React.RefObject<boolean>;
  lassoPointsRef: React.RefObject<{ x: number; y: number }[]>;
  isShapeDraggingRef: React.RefObject<boolean>;
  shapeStartRef: React.RefObject<{ x: number; y: number } | null>;
  shapeEndRef: React.RefObject<{ x: number; y: number } | null>;
  measureStartRef: React.RefObject<{ x: number; y: number } | null>;
  measureEndRef: React.RefObject<{ x: number; y: number } | null>;
  /** Exposed for the keyboard handler's Space-while-drawing logic. */
  isPanningRef: React.RefObject<boolean>;
  isDrawingRef: React.RefObject<boolean>;
}

export function useCanvasPointerHandlers({
  canvasRef,
  renderRef,
}: UseCanvasPointerHandlersOptions): UseCanvasPointerHandlersReturn {
  const setFrame = useCanvasFrameStore((s) => s.setFrame);
  const markDirty = useProjectStore((s) => s.markDirty);
  const setSelection = useSelectionStore((s) => s.setSelection);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const setTransform = useSelectionStore((s) => s.setTransform);
  const clearTransform = useSelectionStore((s) => s.clearTransform);
  const panBy = useCanvasViewStore((s) => s.panBy);
  const setCursorPixel = useCanvasViewStore((s) => s.setCursorPixel);

  const [dragSelection, setDragSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [sliceRegions, setSliceRegions] = useState<
    { id: string; x: number; y: number; width: number; height: number; name: string }[]
  >([]);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);

  // ---------------------------------------------------------------------------
  // Drag refs
  // ---------------------------------------------------------------------------
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const isDrawingRef = useRef(false);
  const lastPixelRef = useRef<{ x: number; y: number } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const isTransformDraggingRef = useRef(false);
  const transformDragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const isShapeDraggingRef = useRef(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeEndRef = useRef<{ x: number; y: number } | null>(null);
  const isLassoDraggingRef = useRef(false);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const isSliceDraggingRef = useRef(false);
  const sliceStartRef = useRef<{ x: number; y: number } | null>(null);
  const sliceEndRef = useRef<{ x: number; y: number } | null>(null);
  const measureStartRef = useRef<{ x: number; y: number } | null>(null);
  const measureEndRef = useRef<{ x: number; y: number } | null>(null);

  // ---------------------------------------------------------------------------
  // Coordinate helpers (read stores imperatively to avoid stale deps)
  // ---------------------------------------------------------------------------
  const toPixelUnclamped = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    const frame = useCanvasFrameStore.getState().frame;
    if (!canvas || !frame) return null;
    const { zoom, panX, panY } = useCanvasViewStore.getState();
    const rect = canvas.getBoundingClientRect();
    return screenToCanvasPixelUnclamped(screenX, screenY, {
      rectLeft: rect.left, rectTop: rect.top, rectWidth: rect.width, rectHeight: rect.height,
      zoom, panX, panY, frameWidth: frame.width, frameHeight: frame.height,
    });
  };

  const toPixelClamped = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    const frame = useCanvasFrameStore.getState().frame;
    if (!canvas || !frame) return null;
    const { zoom, panX, panY } = useCanvasViewStore.getState();
    const rect = canvas.getBoundingClientRect();
    return screenToCanvasPixelClamped(screenX, screenY, {
      rectLeft: rect.left, rectTop: rect.top, rectWidth: rect.width, rectHeight: rect.height,
      zoom, panX, panY, frameWidth: frame.width, frameHeight: frame.height,
    });
  };

  // ---------------------------------------------------------------------------
  // loadSliceRegions
  // ---------------------------------------------------------------------------
  const loadSliceRegions = useCallback(() => {
    invoke<{ id: string; x: number; y: number; width: number; height: number; name: string }[]>('list_slice_regions')
      .then((regions) => {
        setSliceRegions(regions);
        useSliceStore.getState().setSliceRegions(regions);
      })
      .catch(() => {
        setSliceRegions([]);
        useSliceStore.getState().setSliceRegions([]);
      });
  }, []);

  // ---------------------------------------------------------------------------
  // sendStrokePoints
  // ---------------------------------------------------------------------------
  const sendStrokePoints = useCallback(
    async (points: [number, number][]) => {
      if (points.length === 0) return;
      const { mirrorMode, activeTool } = useToolStore.getState();
      const frame = useCanvasFrameStore.getState().frame;
      const brushState = useBrushSettingsStore.getState();

      // 1. Apply dither filter before mirror so both arms share the same pattern.
      let filtered = points;
      if (activeTool === 'sketch-brush' && brushState.activePresetId === 'dither') {
        const sel = useSelectionStore.getState().selectionBounds;
        filtered = applyDitherFilter(points, brushState.ditherPattern, brushState.ditherDensity, sel);
        if (filtered.length === 0) return;
      }

      // 2. Expand with mirror.
      const mirrored = frame && mirrorMode !== 'none'
        ? applyMirrorPoints(filtered, frame.width, frame.height, mirrorMode)
        : filtered;

      try {
        const f = await invoke<CanvasFrameData>('stroke_points', { input: { points: mirrored } });
        setFrame(f);
      } catch (err) {
        console.error('stroke_points failed:', err);
      }
    },
    [setFrame],
  );

  // ---------------------------------------------------------------------------
  // handlePointerDown
  // ---------------------------------------------------------------------------
  const handlePointerDown = useCallback(
    async (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { activeTool } = useToolStore.getState();
      const { primaryColor } = useToolStore.getState();
      const selState = useSelectionStore.getState();
      const isTransforming = selState.isTransforming;
      const frame = useCanvasFrameStore.getState().frame;

      if (e.button === 1) {
        isPanningRef.current = true;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Move/Transform
      if (e.button === 0 && (activeTool === 'move' || activeTool === 'transform' || isTransforming)) {
        const pixel = toPixelUnclamped(e.clientX, e.clientY);
        if (!pixel) return;

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

        if (selState.isTransforming && selState.transformPreview) {
          isTransformDraggingRef.current = true;
          transformDragStartRef.current = { x: pixel.x, y: pixel.y, offsetX: selState.transformPreview.offsetX, offsetY: selState.transformPreview.offsetY };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }

      // Marquee
      if (e.button === 0 && activeTool === 'marquee') {
        const pixel = toPixelUnclamped(e.clientX, e.clientY);
        if (pixel && frame) {
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

      // Eyedropper
      if (e.button === 0 && activeTool === 'color-select') {
        const pixel = toPixelClamped(e.clientX, e.clientY);
        if (pixel) {
          try {
            const color = await invoke<{ r: number; g: number; b: number; a: number }>('read_pixel', { x: pixel.x, y: pixel.y, layerId: null });
            useToolStore.getState().setPrimaryColor(color);
          } catch (err) { console.error('read_pixel failed:', err); }
        }
        return;
      }

      // Fill
      if (e.button === 0 && activeTool === 'fill') {
        const pixel = toPixelClamped(e.clientX, e.clientY);
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

      // Shape tools
      if (e.button === 0 && SHAPE_TOOLS.has(activeTool)) {
        const pixel = toPixelUnclamped(e.clientX, e.clientY);
        if (pixel && frame) {
          if (useTimelineStore.getState().playing) useTimelineStore.getState().setPlaying(false);
          isShapeDraggingRef.current = true;
          shapeStartRef.current = pixel;
          shapeEndRef.current = pixel;
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      // Magic wand
      if (e.button === 0 && activeTool === 'magic-select') {
        const pixel = toPixelClamped(e.clientX, e.clientY);
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

      // Lasso
      if (e.button === 0 && activeTool === 'lasso') {
        const pixel = toPixelUnclamped(e.clientX, e.clientY);
        if (pixel && frame) {
          isLassoDraggingRef.current = true;
          lassoPointsRef.current = [pixel];
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      // Socket
      if (e.button === 0 && activeTool === 'socket') {
        const pixel = toPixelClamped(e.clientX, e.clientY);
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

      // Slice
      if (e.button === 0 && activeTool === 'slice') {
        const pixel = toPixelUnclamped(e.clientX, e.clientY);
        if (pixel && frame) {
          isSliceDraggingRef.current = true;
          sliceStartRef.current = pixel;
          sliceEndRef.current = pixel;
          canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      // Measure
      if (e.button === 0 && activeTool === 'measure') {
        const pixel = toPixelClamped(e.clientX, e.clientY);
        if (pixel) {
          if (!measureStartRef.current || measureEndRef.current) {
            measureStartRef.current = pixel;
            measureEndRef.current = null;
          } else {
            measureEndRef.current = pixel;
          }
          renderRef.current();
        }
        return;
      }

      // Pencil / Eraser / Sketch tools
      if (e.button === 0 && (activeTool === 'pencil' || activeTool === 'eraser' || isSketchTool(activeTool))) {
        if (useTimelineStore.getState().playing) useTimelineStore.getState().setPlaying(false);

        const isSketch = isSketchTool(activeTool);
        const isErase = activeTool === 'eraser' || activeTool === 'sketch-eraser';
        const brushState = useBrushSettingsStore.getState();

        let color: { r: number; g: number; b: number; a: number };
        if (isErase) {
          color = { r: 0, g: 0, b: 0, a: 0 };
        } else if (isSketch) {
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

        if (isSketch) useBrushSettingsStore.getState().setRoughModeActive(true);

        isDrawingRef.current = true;
        canvas.setPointerCapture(e.pointerId);
        const pixel = toPixelClamped(e.clientX, e.clientY);
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
    [canvasRef, renderRef, setFrame, markDirty, setSelection, clearTransform, setTransform, sendStrokePoints, setDragSelection],
  );

  // ---------------------------------------------------------------------------
  // handlePointerMove
  // ---------------------------------------------------------------------------
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pixel = toPixelClamped(e.clientX, e.clientY);
      setHoveredPixel(pixel);
      setCursorPixel(pixel?.x ?? null, pixel?.y ?? null);

      if (isPanningRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        panBy(dx, dy);
        return;
      }

      if (isTransformDraggingRef.current) {
        const current = toPixelUnclamped(e.clientX, e.clientY);
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

      if (isSliceDraggingRef.current) {
        const current = toPixelUnclamped(e.clientX, e.clientY);
        if (current) { sliceEndRef.current = current; renderRef.current(); }
        return;
      }

      if (isLassoDraggingRef.current) {
        const current = toPixelUnclamped(e.clientX, e.clientY);
        if (current) {
          const pts = lassoPointsRef.current;
          const last = pts[pts.length - 1];
          if (!last || last.x !== current.x || last.y !== current.y) {
            pts.push(current);
            renderRef.current();
          }
        }
        return;
      }

      if (isShapeDraggingRef.current) {
        const current = toPixelUnclamped(e.clientX, e.clientY);
        if (current) {
          if (e.shiftKey && shapeStartRef.current) {
            const { activeTool } = useToolStore.getState();
            shapeEndRef.current = constrainShapeEnd(activeTool, shapeStartRef.current, current);
          } else {
            shapeEndRef.current = current;
          }
          renderRef.current();
        }
        return;
      }

      if (isSelectingRef.current) {
        const frame = useCanvasFrameStore.getState().frame;
        const current = toPixelUnclamped(e.clientX, e.clientY);
        const start = selectionStartRef.current;
        if (current && start && frame) {
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
        const { activeTool } = useToolStore.getState();
        const isSketch = isSketchTool(activeTool);
        const frame = useCanvasFrameStore.getState().frame;

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
    [panBy, setCursorPixel, setTransform, setDragSelection, sendStrokePoints],
  );

  // ---------------------------------------------------------------------------
  // handlePointerUp
  // ---------------------------------------------------------------------------
  const handlePointerUp = useCallback(async () => {
    // Slice complete
    if (isSliceDraggingRef.current) {
      isSliceDraggingRef.current = false;
      const start = sliceStartRef.current;
      const end = sliceEndRef.current;
      sliceStartRef.current = null;
      sliceEndRef.current = null;
      const frame = useCanvasFrameStore.getState().frame;
      if (start && end && frame) {
        const minX = Math.max(0, Math.min(start.x, end.x));
        const minY = Math.max(0, Math.min(start.y, end.y));
        const maxX = Math.min(frame.width - 1, Math.max(start.x, end.x));
        const maxY = Math.min(frame.height - 1, Math.max(start.y, end.y));
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        if (w > 1 && h > 1) {
          invoke('create_slice_region', {
            name: `slice_${sliceRegions.length + 1}`,
            x: minX, y: minY, width: w, height: h,
          }).then(() => loadSliceRegions()).catch(() => {});
        }
      }
      renderRef.current();
      return;
    }

    // Lasso complete
    if (isLassoDraggingRef.current) {
      isLassoDraggingRef.current = false;
      const pts = lassoPointsRef.current;
      lassoPointsRef.current = [];
      const frame = useCanvasFrameStore.getState().frame;
      if (pts.length >= 3 && frame) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
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
      renderRef.current();
      return;
    }

    // Shape complete
    if (isShapeDraggingRef.current) {
      isShapeDraggingRef.current = false;
      const start = shapeStartRef.current;
      const end = shapeEndRef.current;
      shapeStartRef.current = null;
      shapeEndRef.current = null;
      const { activeTool } = useToolStore.getState();
      const { primaryColor } = useToolStore.getState();
      if (start && end && (start.x !== end.x || start.y !== end.y)) {
        let points: [number, number][] = [];
        if (activeTool === 'line') points = bresenhamLine(start.x, start.y, end.x, end.y);
        else if (activeTool === 'rectangle') points = rectangleOutline(start.x, start.y, end.x, end.y);
        else if (activeTool === 'ellipse') points = ellipseOutline(start.x, start.y, end.x, end.y);
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
      renderRef.current();
      return;
    }

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
        setSelection({ x: dragSelection.x, y: dragSelection.y, width: dragSelection.width, height: dragSelection.height });
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

    // Stroke complete
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
      } catch (err) { console.error('end_stroke failed:', err); }
    }
    isPanningRef.current = false;
  }, [setFrame, markDirty, setSelection, clearSelection, setDragSelection, loadSliceRegions, sendStrokePoints, sliceRegions, dragSelection]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    dragSelection,
    sliceRegions,
    loadSliceRegions,
    hoveredPixel,
    clearHoveredPixel: () => setHoveredPixel(null),
    isSliceDraggingRef,
    sliceStartRef,
    sliceEndRef,
    isLassoDraggingRef,
    lassoPointsRef,
    isShapeDraggingRef,
    shapeStartRef,
    shapeEndRef,
    measureStartRef,
    measureEndRef,
    isPanningRef,
    isDrawingRef,
  };
}
