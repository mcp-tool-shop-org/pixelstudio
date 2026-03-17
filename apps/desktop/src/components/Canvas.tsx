import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCanvasViewStore } from '@glyphstudio/state';
import { useToolStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import { useTimelineStore } from '@glyphstudio/state';
import { useSnapshotStore } from '@glyphstudio/state';
import { useAnchorStore } from '@glyphstudio/state';
import { useSliceStore } from '@glyphstudio/state';
import { isSketchTool, TOOL_KEY_MAP, TOOL_SHIFT_KEY_MAP } from '@glyphstudio/domain';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';
import { bresenhamLine, rectangleOutline, ellipseOutline } from '../lib/canvasPixelMath';
import { useCanvasPointerHandlers } from '../lib/useCanvasPointerHandlers';

const CHECK_LIGHT = '#2a2a2e';
const CHECK_DARK = '#222226';
const CHECK_SIZE = 8;
const CANVAS_BG = '#111114';
const GRID_COLOR = 'rgba(255,255,255,0.08)';
const SELECTION_COLOR = 'rgba(100,160,255,0.5)';
const SELECTION_DASH = [4, 4];
const SELECTION_HANDLE_SIZE = 5;

const SHAPE_TOOLS = new Set(['line', 'rectangle', 'ellipse']);

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRequestRef = useRef<number | null>(null);
  // Marching ants animation
  const antOffsetRef = useRef(0);
  const antAnimRef = useRef<number | null>(null);

  const [canvasReady, setCanvasReady] = useState(false);

  // renderRef is kept current each render cycle so the pointer handler hook
  // can call render() without a stale-closure dependency.
  const renderRef = useRef<() => void>(() => {});

  // All pointer handler logic, drag refs, and related state live in this hook.
  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    dragSelection,
    sliceRegions,
    loadSliceRegions,
    hoveredPixel,
    clearHoveredPixel,
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
  } = useCanvasPointerHandlers({ canvasRef, renderRef });

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
  const setCursorPixel = useCanvasViewStore((s) => s.setCursorPixel);
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

  const selectedSliceId = useSliceStore((s) => s.selectedSliceId);
  const hoveredSliceId = useSliceStore((s) => s.hoveredSliceId);
  const mirrorMode = useToolStore((s) => s.mirrorMode);

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

  // Reload slice regions when frame version changes (hook owns loadSliceRegions)
  useEffect(() => {
    if (canvasReady) loadSliceRegions();
  }, [frameVersion, canvasReady, loadSliceRegions]);

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

      // Dark outer ring
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tpX - 0.5, tpY - 0.5, tpSW + 1, tpSH + 1);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash(SELECTION_DASH);
      ctx.lineDashOffset = -antOffsetRef.current;
      ctx.strokeRect(tpX + 0.5, tpY + 0.5, tpSW - 1, tpSH - 1);
      ctx.strokeStyle = '#000';
      ctx.lineDashOffset = -(antOffsetRef.current + 4);
      ctx.strokeRect(tpX + 0.5, tpY + 0.5, tpSW - 1, tpSH - 1);

      // Corner handles
      ctx.setLineDash([]);
      const tpHs = SELECTION_HANDLE_SIZE;
      const tpHh = Math.floor(tpHs / 2);
      const tpCorners: [number, number][] = [
        [tpX - tpHh, tpY - tpHh],
        [tpX + tpSW - tpHh, tpY - tpHh],
        [tpX - tpHh, tpY + tpSH - tpHh],
        [tpX + tpSW - tpHh, tpY + tpSH - tpHh],
      ];
      for (const [cx, cy] of tpCorners) {
        ctx.fillStyle = '#64a0ff';
        ctx.fillRect(cx, cy, tpHs, tpHs);
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, tpHs - 1, tpHs - 1);
      }

      ctx.restore();
    } else {
      // --- Selection overlay (only when not transforming) ---
      const sel = dragSelection || selectionBounds;
      if (sel) {
        const sx = originX + sel.x * zoom;
        const sy = originY + sel.y * zoom;
        const sw = sel.width * zoom;
        const sh = sel.height * zoom;

        // Semi-transparent fill — visible on both dark and checker backgrounds
        ctx.fillStyle = 'rgba(100,160,255,0.15)';
        ctx.fillRect(sx, sy, sw, sh);

        ctx.save();

        // Dark outer ring for contrast against light pixels
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 0.5, sy - 0.5, sw + 1, sh + 1);

        // Marching ants border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.setLineDash(SELECTION_DASH);
        ctx.lineDashOffset = -antOffsetRef.current;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        ctx.strokeStyle = '#000';
        ctx.lineDashOffset = -(antOffsetRef.current + 4);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

        // Corner handles — 5px filled squares at each corner
        ctx.setLineDash([]);
        const hs = SELECTION_HANDLE_SIZE;
        const hh = Math.floor(hs / 2);
        const corners: [number, number][] = [
          [sx - hh, sy - hh],
          [sx + sw - hh, sy - hh],
          [sx - hh, sy + sh - hh],
          [sx + sw - hh, sy + sh - hh],
        ];
        for (const [cx, cy] of corners) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(cx, cy, hs, hs);
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx + 0.5, cy + 0.5, hs - 1, hs - 1);
        }

        ctx.restore();
      }
    }

    // Slice regions overlay
    if (sliceRegions.length > 0 || isSliceDraggingRef.current) {
      ctx.save();
      // Draw existing slice regions
      for (const region of sliceRegions) {
        const isSelected = selectedSliceId === region.id;
        const isHovered = !isSelected && hoveredSliceId === region.id;
        const sx = originX + region.x * zoom;
        const sy = originY + region.y * zoom;
        const sw = region.width * zoom;
        const sh = region.height * zoom;
        ctx.strokeStyle = isSelected ? '#ffe066' : isHovered ? '#ffb347' : '#ff6b35';
        ctx.lineWidth = isSelected ? 2 : isHovered ? 1.5 : 1;
        ctx.setLineDash(isSelected ? [] : [4, 2]);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        ctx.fillStyle = isSelected ? 'rgba(255,224,102,0.18)' : isHovered ? 'rgba(255,179,71,0.15)' : 'rgba(255,107,53,0.1)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = isSelected ? '#ffe066' : isHovered ? '#ffb347' : '#ff6b35';
        ctx.font = `${isSelected ? 'bold ' : ''}10px monospace`;
        ctx.fillText(region.name, sx + 2, sy + 10);
        // Show dimensions when selected or hovered
        if (isSelected || isHovered) {
          const dimLabel = `${region.width}×${region.height}`;
          ctx.font = '9px monospace';
          ctx.fillText(dimLabel, sx + 2, sy + sh - 3);
        }
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

    // Mirror guides
    if (mirrorMode !== 'none' && frame) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,180,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      if (mirrorMode === 'h' || mirrorMode === 'both') {
        const midX = originX + spriteW / 2;
        ctx.beginPath();
        ctx.moveTo(midX + 0.5, originY);
        ctx.lineTo(midX + 0.5, originY + spriteH);
        ctx.stroke();
      }
      if (mirrorMode === 'v' || mirrorMode === 'both') {
        const midY = originY + spriteH / 2;
        ctx.beginPath();
        ctx.moveTo(originX, midY + 0.5);
        ctx.lineTo(originX + spriteW, midY + 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.strokeStyle = '#3a3a40';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX - 0.5, originY - 0.5, spriteW + 1, spriteH + 1);
  }, [zoom, panX, panY, showPixelGrid, showSilhouette, silhouetteColor, compareSnapshotId, previewBackground, frame, frameVersion, selectionBounds, dragSelection, transformPreview, onionSkinEnabled, onionSkinData, onionSkinShowPrev, onionSkinShowNext, onionSkinPrevOpacity, onionSkinNextOpacity, activeTool, primaryColor, sliceRegions, selectedSliceId, hoveredSliceId, mirrorMode]);

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

  // Keep renderRef pointing at the latest render callback so the pointer
  // handler hook can call render() without a stale-closure dep.
  useEffect(() => { renderRef.current = render; }, [render]);


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

      // [ / ] — darken / lighten primary color by a step
      // Shift+[ / Shift+] — larger step
      if ((e.code === 'BracketLeft' || e.code === 'BracketRight') && !e.ctrlKey && !e.metaKey && !e.repeat) {
        e.preventDefault();
        const step = e.shiftKey ? 30 : 15;
        const delta = e.code === 'BracketLeft' ? -step : step;
        const pc = useToolStore.getState().primaryColor;
        const clamp = (v: number) => Math.max(0, Math.min(255, v));
        const next = { r: clamp(pc.r + delta), g: clamp(pc.g + delta), b: clamp(pc.b + delta), a: pc.a };
        useToolStore.getState().setPrimaryColor(next);
        return;
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

        // Ctrl+Shift+T — repeat last transform (only while in transform mode)
        if (e.code === 'KeyT' && e.shiftKey && useSelectionStore.getState().isTransforming) {
          const lastCmd = useSelectionStore.getState().lastTransformCommand;
          if (lastCmd) {
            e.preventDefault();
            try {
              const result = await invoke<{ sourceX: number; sourceY: number; payloadWidth: number; payloadHeight: number; offsetX: number; offsetY: number; payloadData: number[]; frame: CanvasFrameData }>(lastCmd);
              setTransform({ sourceX: result.sourceX, sourceY: result.sourceY, payloadWidth: result.payloadWidth, payloadHeight: result.payloadHeight, offsetX: result.offsetX, offsetY: result.offsetY, payloadData: result.payloadData });
              useSelectionStore.getState().setLastTransformCommand(lastCmd);
            } catch (err) { console.error(`repeat transform (${lastCmd}) failed:`, err); }
          }
          return;
        }

        // Ctrl+Shift+D — duplicate active layer (experiment on a copy)
        if (e.code === 'KeyD' && e.shiftKey) {
          e.preventDefault();
          try {
            const f = await invoke<CanvasFrameData>('duplicate_layer');
            setFrame(f);
            syncLayersFromFrame(f);
            markDirty();
            invoke('mark_dirty').catch(() => {});
          } catch (err) { console.error('duplicate_layer failed:', err); }
          return;
        }

        // Ctrl+Shift+S — quick snapshot capture
        if (e.code === 'KeyS' && e.shiftKey) {
          e.preventDefault();
          const fr = useCanvasFrameStore.getState().frame;
          if (fr) {
            const snaps = useSnapshotStore.getState().snapshots;
            useSnapshotStore.getState().createSnapshot(
              `Snapshot ${snaps.length + 1}`,
              fr.width, fr.height, fr.data,
            );
          }
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
            loadSliceRegions();
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
            loadSliceRegions();
            invoke('mark_dirty').catch(() => {});
          } catch (err) { console.error('redo failed:', err); }
          return;
        }
      }

      // Blink compare: ` (Backquote) toggles compare to most recent snapshot
      if (e.code === 'Backquote' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !e.repeat) {
        e.preventDefault();
        const snaps = useSnapshotStore.getState().snapshots;
        if (snaps.length === 0) return;
        const viewState = useCanvasViewStore.getState();
        if (viewState.compareSnapshotId) {
          viewState.setCompareSnapshot(null);
        } else {
          viewState.setCompareSnapshot(snaps[snaps.length - 1].id);
        }
        return;
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
            loadSliceRegions();
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
  }, [setFrame, markDirty, clearSelection, clearTransform, setTransform, loadSliceRegions]);

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
        onPointerLeave={() => { handlePointerUp(); setCursorPixel(null, null); clearHoveredPixel(); }}
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
        {compareSnapshotId && (
          <span className="status-compare" title="` to toggle compare" data-testid="compare-indicator">
            comparing
          </span>
        )}
      </div>
      {compareSnapshotId && (
        <div className="canvas-compare-banner" data-testid="canvas-compare-banner">
          Comparing: {compareSnapshot?.name ?? 'snapshot'} — press ` to return to live
        </div>
      )}
    </main>
  );
}
