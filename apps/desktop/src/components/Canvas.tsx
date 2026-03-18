import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCanvasViewStore } from '@glyphstudio/state';
import { useToolStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import { useTimelineStore } from '@glyphstudio/state';
import { useSnapshotStore } from '@glyphstudio/state';
import { useRangeSnapshotStore } from '@glyphstudio/state';
import { useAnchorStore } from '@glyphstudio/state';
import { useSliceStore } from '@glyphstudio/state';
import { isSketchTool, TOOL_KEY_MAP, TOOL_SHIFT_KEY_MAP } from '@glyphstudio/domain';
import { useCanvasFrameStore, type CanvasFrameData } from '../lib/canvasFrameStore';
import { syncLayersFromFrame } from '../lib/syncLayers';
import { bresenhamLine, rectangleOutline, ellipseOutline, constrainShapeEnd, applyMirrorPoints } from '../lib/canvasPixelMath';
import { buildFramePixelBuffer, buildTintedPixelBuffer, buildCheckerBuffer } from '../lib/canvasRenderHelpers';
import { useCanvasPointerHandlers } from '../lib/useCanvasPointerHandlers';
import { toast } from '../lib/toast';

/** Shared shape returned by all timeline Tauri commands. */
interface TimelineResult {
  frames: Array<{ id: string; name: string; index: number; durationMs: number | null }>;
  activeFrameIndex: number;
  activeFrameId: string;
  frame: CanvasFrameData;
}

const CHECK_LIGHT = '#2a2a2e';
const CHECK_DARK = '#222226';
// Pre-parsed RGBA tuples for buildCheckerBuffer (avoids hex parsing in hot path)
const CHECK_LIGHT_RGBA: [number, number, number, number] = [0x2a, 0x2a, 0x2e, 255];
const CHECK_DARK_RGBA:  [number, number, number, number] = [0x22, 0x22, 0x26, 255];
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

  // Offscreen canvas cache for the checker background.
  // Rebuilt only when frame dimensions change — does not depend on zoom.
  const checkerOffscreenRef = useRef<HTMLCanvasElement | null>(null);
  const checkerOffscreenKeyRef = useRef('');

  // Offscreen canvas cache for frame pixels — rebuilt only when frame data changes.
  // Avoids O(W×H) fillRect + string-allocation loop every render.
  const frameOffscreenRef = useRef<HTMLCanvasElement | null>(null);
  const frameOffscreenKeyRef = useRef('');

  // Offscreen canvas caches for onion skin (prev = blue, next = red).
  // Rebuilt only when onionSkinData reference changes (infrequent backend fetch).
  const onionPrevOffscreenRef = useRef<HTMLCanvasElement | null>(null);
  const onionNextOffscreenRef = useRef<HTMLCanvasElement | null>(null);
  const onionSkinDataCacheRef = useRef<typeof onionSkinData>(null);

  // Offscreen canvas cache for transform preview payload.
  // Rebuilt only when the transformPreview object reference changes
  // (i.e., on each move_selection_preview response from Rust).
  const transformOffscreenRef = useRef<HTMLCanvasElement | null>(null);
  const transformPreviewCacheRef = useRef<typeof transformPreview>(null);

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

  // zoom/panX/panY are read imperatively inside the render callback so that
  // panning/zooming do not cause React re-renders. The reactive `zoomForUI`
  // subscription exists only to update the status-bar zoom label in JSX.
  const zoomForUI = useCanvasViewStore((s) => s.zoom);
  const showPixelGrid = useCanvasViewStore((s) => s.showPixelGrid);
  const showSilhouette = useCanvasViewStore((s) => s.showSilhouette);
  const silhouetteColor = useCanvasViewStore((s) => s.silhouetteColor);
  const compareSnapshotId = useCanvasViewStore((s) => s.compareSnapshotId);

  const compareSnapshot = useSnapshotStore((s) =>
    compareSnapshotId ? s.snapshots.find((snap) => snap.id === compareSnapshotId) ?? null : null,
  );

  // Range checkpoint compare — shows checkpoint frame data for the active frame
  const rangeCompareId = useRangeSnapshotStore((s) => s.compareCheckpointId);
  const rangeCompareFrame = useRangeSnapshotStore((s) => {
    if (!s.compareCheckpointId) return null;
    const cp = s.checkpoints.find((c) => c.id === s.compareCheckpointId);
    if (!cp) return null;
    const activeIdx = useTimelineStore.getState().activeFrameIndex;
    return cp.frameSnapshots.find((f) => f.frameIndex === activeIdx) ?? null;
  });

  const frame = useMemo(() => {
    // Range checkpoint compare takes priority over single-frame compare
    if (rangeCompareFrame && liveFrame) {
      return { ...liveFrame, data: rangeCompareFrame.data };
    }
    if (compareSnapshot && liveFrame) {
      return { ...liveFrame, data: compareSnapshot.data };
    }
    return liveFrame;
  }, [liveFrame, compareSnapshot, rangeCompareFrame]);
  const showMotionTrail = useCanvasViewStore((s) => s.showMotionTrail);
  const motionTrailData = useCanvasViewStore((s) => s.motionTrailData);
  const setMotionTrailData = useCanvasViewStore((s) => s.setMotionTrailData);
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
  const activeFrameName = useTimelineStore((s) => s.frames[s.activeFrameIndex]?.name ?? '');
  const frameCount = useTimelineStore((s) => s.frames.length);
  const selectedFrameCount = useTimelineStore((s) => s.selectedFrameIndices.length);
  const timelineFps = useTimelineStore((s) => s.fps);
  const activeFrameDurationMs = useTimelineStore((s) => s.frames[s.activeFrameIndex]?.durationMs ?? null);
  const loopSeamMode = useTimelineStore((s) => s.loopSeamMode);

  // Compute total sequence duration from authored timing
  const totalDurationMs = useTimelineStore((s) => {
    const baseDur = Math.round(1000 / s.fps);
    return s.frames.reduce((sum, f) => sum + (f.durationMs ?? baseDur), 0);
  });
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
        performance.mark('canvas_init:start');
        const f = await invoke<CanvasFrameData>('init_canvas', {
          width: canvasSize.width,
          height: canvasSize.height,
        });
        performance.mark('canvas_init:end');
        performance.measure('canvas_init', 'canvas_init:start', 'canvas_init:end');
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

  // Fetch motion trail data when enabled or frame changes
  useEffect(() => {
    if (!showMotionTrail || !canvasReady || frameCount <= 1) {
      if (!showMotionTrail) setMotionTrailData(null);
      return;
    }
    invoke<{ centroids: Array<{ frameIndex: number; cx: number; cy: number; empty: boolean }>; canvasWidth: number; canvasHeight: number }>('compute_motion_trail')
      .then((result) => setMotionTrailData(result.centroids))
      .catch(() => setMotionTrailData(null));
  }, [showMotionTrail, canvasReady, frameCount, frameVersion, setMotionTrailData]);

  // Loop seam overlay — composited data for the "other end" frame
  const [loopSeamData, setLoopSeamData] = useState<{ width: number; height: number; data: number[] } | null>(null);
  useEffect(() => {
    if (!loopSeamMode || !canvasReady || frameCount <= 1) {
      setLoopSeamData(null);
      return;
    }
    // When on first frame, fetch last; when on last, fetch first; otherwise show first
    const targetIdx = activeFrameIndex === 0 ? frameCount - 1
      : activeFrameIndex === frameCount - 1 ? 0
      : 0; // Default: show first frame as seam reference
    invoke<{ centroids: never; canvasWidth: number; canvasHeight: number } | Array<{ frameIndex: number; data: number[]; width: number; height: number }>>('snapshot_frame_range', {
      frameIndices: [targetIdx],
    })
      .then((result) => {
        const arr = result as Array<{ frameIndex: number; data: number[]; width: number; height: number }>;
        if (arr.length > 0) setLoopSeamData({ width: arr[0].width, height: arr[0].height, data: arr[0].data });
      })
      .catch(() => setLoopSeamData(null));
  }, [loopSeamMode, canvasReady, frameCount, activeFrameIndex, frameVersion]);

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

    // Read pan/zoom imperatively — these are not reactive subscriptions so
    // changing them does not cause a React re-render of this component.
    const { zoom, panX, panY } = useCanvasViewStore.getState();

    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, w, h);

    const spriteW = frame.width * zoom;
    const spriteH = frame.height * zoom;
    const originX = Math.floor(w / 2 - spriteW / 2 + panX);
    const originY = Math.floor(h / 2 - spriteH / 2 + panY);

    if (previewBackground === 'checker') {
      // Offscreen checker: alternates CHECK_LIGHT/CHECK_DARK per sprite pixel
      // based on (px+py)%2. Rebuilt only when frame dimensions change.
      // drawImage scales to current zoom — no per-pixel fillRect needed.
      const checkerKey = `${frame.width}:${frame.height}`;
      if (checkerOffscreenKeyRef.current !== checkerKey) {
        if (!checkerOffscreenRef.current) checkerOffscreenRef.current = document.createElement('canvas');
        const coc = checkerOffscreenRef.current;
        coc.width = frame.width;
        coc.height = frame.height;
        const cocCtx = coc.getContext('2d')!;
        const buf = buildCheckerBuffer(frame.width, frame.height, CHECK_LIGHT_RGBA, CHECK_DARK_RGBA);
        const id = cocCtx.createImageData(frame.width, frame.height);
        id.data.set(buf);
        cocCtx.putImageData(id, 0, 0);
        checkerOffscreenKeyRef.current = checkerKey;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(checkerOffscreenRef.current!, originX, originY, spriteW, spriteH);
    } else {
      ctx.fillStyle = previewBackground === 'dark' ? '#111114' : '#e0e0e0';
      ctx.fillRect(originX, originY, spriteW, spriteH);
    }

    // --- Onion skin overlays (before active frame) ---
    // Use offscreen canvases + drawImage for the same reason as the active
    // frame: avoid O(W×H) per-pixel fillRect + string-allocation loops.
    // Both offscreens are rebuilt only when onionSkinData itself changes
    // (i.e., when the backend returns new data — infrequent).
    if (onionSkinData && onionSkinEnabled) {
      const osW = onionSkinData.width;
      const osH = onionSkinData.height;

      // Rebuild both offscreens when the data reference changes.
      if (onionSkinData !== onionSkinDataCacheRef.current) {
        onionSkinDataCacheRef.current = onionSkinData;

        const uploadOnion = (
          canvasRef2: React.MutableRefObject<HTMLCanvasElement | null>,
          src: number[] | null,
          tint: 'blue' | 'red',
        ) => {
          if (!src) { canvasRef2.current = null; return; }
          if (!canvasRef2.current) canvasRef2.current = document.createElement('canvas');
          const oc = canvasRef2.current;
          oc.width = osW;
          oc.height = osH;
          const oc2 = oc.getContext('2d')!;
          const buf = buildTintedPixelBuffer(src, osW, osH, tint);
          const id = oc2.createImageData(osW, osH);
          id.data.set(buf);
          oc2.putImageData(id, 0, 0);
        };

        uploadOnion(onionPrevOffscreenRef, onionSkinData.prevData, 'blue');
        uploadOnion(onionNextOffscreenRef, onionSkinData.nextData, 'red');
      }

      // Draw previous frame ghost (blue tint)
      if (onionSkinShowPrev && onionPrevOffscreenRef.current) {
        ctx.globalAlpha = onionSkinPrevOpacity;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(onionPrevOffscreenRef.current, originX, originY, osW * zoom, osH * zoom);
        ctx.globalAlpha = 1;
      }

      // Draw next frame ghost (red tint)
      if (onionSkinShowNext && onionNextOffscreenRef.current) {
        ctx.globalAlpha = onionSkinNextOpacity;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(onionNextOffscreenRef.current, originX, originY, osW * zoom, osH * zoom);
        ctx.globalAlpha = 1;
      }
    }

    // --- Loop seam overlay (magenta tint, shows first↔last frame) ---
    if (loopSeamMode && loopSeamData && loopSeamData.data.length > 0) {
      const seamW = loopSeamData.width;
      const seamH = loopSeamData.height;
      const seamOff = new OffscreenCanvas(seamW, seamH);
      const seamCtx2 = seamOff.getContext('2d')!;
      const seamImg = seamCtx2.createImageData(seamW, seamH);
      for (let i = 0; i < loopSeamData.data.length; i += 4) {
        const a = loopSeamData.data[i + 3];
        if (a > 0) {
          // Magenta tint
          seamImg.data[i] = 200;
          seamImg.data[i + 1] = 80;
          seamImg.data[i + 2] = 200;
          seamImg.data[i + 3] = Math.round(a * 0.35);
        }
      }
      seamCtx2.putImageData(seamImg, 0, 0);
      ctx.drawImage(seamOff, originX, originY, spriteW, spriteH);
    }

    // --- Active frame pixels ---
    // Use an offscreen canvas + drawImage instead of per-pixel fillRect.
    // The offscreen is rebuilt only when the frame data or silhouette state
    // changes (keyed by frameVersion + compareSnapshotId + silhouette).
    {
      const silhouetteKey = `${showSilhouette}:${silhouetteColor.join(',')}`;
      const cacheKey = `${frameVersion}:${compareSnapshotId ?? ''}:${silhouetteKey}`;

      if (!frameOffscreenRef.current) {
        frameOffscreenRef.current = document.createElement('canvas');
      }
      const offscreen = frameOffscreenRef.current;

      if (frameOffscreenKeyRef.current !== cacheKey
          || offscreen.width !== frame.width
          || offscreen.height !== frame.height) {
        offscreen.width = frame.width;
        offscreen.height = frame.height;
        const offCtx = offscreen.getContext('2d')!;
        const buf = buildFramePixelBuffer(
          frame.data, frame.width, frame.height,
          showSilhouette, silhouetteColor[0], silhouetteColor[1], silhouetteColor[2],
        );
        const id = offCtx.createImageData(frame.width, frame.height);
        id.data.set(buf);
        offCtx.putImageData(id, 0, 0);
        frameOffscreenKeyRef.current = cacheKey;
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, originX, originY, frame.width * zoom, frame.height * zoom);
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

      // Draw payload via offscreen canvas — same pattern as active frame pixels.
      // Rebuild only when transformPreview reference changes (each Rust response).
      if (transformPreview !== transformPreviewCacheRef.current) {
        transformPreviewCacheRef.current = transformPreview;
        if (!transformOffscreenRef.current) {
          transformOffscreenRef.current = document.createElement('canvas');
        }
        const toc = transformOffscreenRef.current;
        toc.width  = tp.payloadWidth;
        toc.height = tp.payloadHeight;
        const tocCtx = toc.getContext('2d')!;
        const buf = buildFramePixelBuffer(
          tp.payloadData, tp.payloadWidth, tp.payloadHeight,
          false, 0, 0, 0,
        );
        const id = tocCtx.createImageData(tp.payloadWidth, tp.payloadHeight);
        id.data.set(buf);
        tocCtx.putImageData(id, 0, 0);
      }
      if (transformOffscreenRef.current) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(transformOffscreenRef.current, tpX, tpY, tp.payloadWidth * zoom, tp.payloadHeight * zoom);
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

    // Motion trail overlay — centroid path across frames
    if (showMotionTrail && motionTrailData && motionTrailData.length > 1) {
      const viewState = useCanvasViewStore.getState();
      const z = viewState.zoom;
      const px = viewState.panX;
      const py = viewState.panY;
      const spriteW = canvasSize.width * z;
      const spriteH = canvasSize.height * z;
      const ox = Math.floor(w / 2 - spriteW / 2 + px);
      const oy = Math.floor(h / 2 - spriteH / 2 + py);
      const activeIdx = useTimelineStore.getState().activeFrameIndex;

      const nonEmpty = motionTrailData.filter((p) => !p.empty);
      if (nonEmpty.length > 1) {
        ctx.save();

        // Compute segment distances for spacing analysis
        const dists: number[] = [];
        for (let i = 1; i < nonEmpty.length; i++) {
          const dx = nonEmpty[i].cx - nonEmpty[i - 1].cx;
          const dy = nonEmpty[i].cy - nonEmpty[i - 1].cy;
          dists.push(Math.sqrt(dx * dx + dy * dy));
        }
        const meanDist = dists.reduce((a, b) => a + b, 0) / dists.length;
        const stdDev = Math.sqrt(dists.reduce((a, d) => a + (d - meanDist) ** 2, 0) / dists.length);

        // Draw spacing-aware colored segments
        ctx.lineWidth = 1.5;
        for (let i = 1; i < nonEmpty.length; i++) {
          const d = dists[i - 1];
          const deviation = stdDev > 0.01 ? Math.abs(d - meanDist) / stdDev : 0;
          // Green = even, Yellow = mild, Red = significant deviation
          const color = deviation < 0.8 ? 'rgba(80, 220, 120, 0.6)'
            : deviation < 1.5 ? 'rgba(240, 200, 60, 0.6)'
            : 'rgba(240, 80, 60, 0.6)';
          ctx.strokeStyle = color;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(ox + nonEmpty[i - 1].cx * z, oy + nonEmpty[i - 1].cy * z);
          ctx.lineTo(ox + nonEmpty[i].cx * z, oy + nonEmpty[i].cy * z);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Draw dots at each centroid
        for (const pt of nonEmpty) {
          const sx = ox + pt.cx * z;
          const sy = oy + pt.cy * z;
          const isActive = pt.frameIndex === activeIdx;
          const radius = isActive ? Math.max(4, z * 0.5) : Math.max(2.5, z * 0.3);

          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fillStyle = isActive ? '#ff6040' : 'rgba(100, 200, 255, 0.7)';
          ctx.fill();
          ctx.strokeStyle = isActive ? '#fff' : 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = isActive ? 1.5 : 0.8;
          ctx.stroke();

          // Frame index label at higher zoom
          if (z >= 4) {
            ctx.fillStyle = isActive ? '#fff' : 'rgba(200, 230, 255, 0.8)';
            ctx.font = `${isActive ? 'bold ' : ''}9px sans-serif`;
            ctx.fillText(`${pt.frameIndex + 1}`, sx + radius + 2, sy + 3);
          }
        }
        ctx.restore();
      }
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

      ctx.save();
      const pc = primaryColor;

      // 1. Preview pixels — expand with mirror so preview matches commit exactly
      const allPreviewPoints = frame && mirrorMode !== 'none'
        ? applyMirrorPoints(previewPoints, frame.width, frame.height, mirrorMode)
        : previewPoints;
      ctx.fillStyle = `rgba(${pc.r},${pc.g},${pc.b},0.85)`;
      for (const [px, py] of allPreviewPoints) {
        ctx.fillRect(originX + px * zoom, originY + py * zoom, zoom, zoom);
      }

      // 2. Bounding box ghost — dashed outline shows extents before commit
      const bbMinX = Math.min(s.x, en.x);
      const bbMinY = Math.min(s.y, en.y);
      const bbMaxX = Math.max(s.x, en.x);
      const bbMaxY = Math.max(s.y, en.y);
      const bbSX = originX + bbMinX * zoom;
      const bbSY = originY + bbMinY * zoom;
      const bbSW = (bbMaxX - bbMinX + 1) * zoom;
      const bbSH = (bbMaxY - bbMinY + 1) * zoom;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(bbSX - 0.5, bbSY - 0.5, bbSW + 1, bbSH + 1);
      ctx.setLineDash([]);

      // 3. Start anchor — white-ringed pixel so origin is never lost during drag
      const ax = originX + s.x * zoom;
      const ay = originY + s.y * zoom;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(ax - 1, ay - 1, zoom + 2, zoom + 2);
      ctx.fillStyle = `rgb(${pc.r},${pc.g},${pc.b})`;
      ctx.fillRect(ax, ay, zoom, zoom);

      // 4. Dimension label — W×H for shapes, length for lines
      const ddx = en.x - s.x;
      const ddy = en.y - s.y;
      let label = '';
      if (activeTool === 'line') {
        label = `${Math.round(Math.sqrt(ddx * ddx + ddy * ddy))}px`;
      } else {
        label = `${Math.abs(ddx) + 1}\u00d7${Math.abs(ddy) + 1}`;
      }
      const labelScreenX = originX + en.x * zoom + zoom + 6;
      const labelScreenY = originY + en.y * zoom + zoom / 2;
      ctx.font = '11px monospace';
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(labelScreenX - 3, labelScreenY - 11, textW + 6, 15);
      ctx.fillStyle = '#e8e8ff';
      ctx.fillText(label, labelScreenX, labelScreenY);

      ctx.restore();
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
  // zoom/panX/panY intentionally omitted — read imperatively inside render.
  // Pan/zoom changes trigger a direct scheduleRender subscription below.
  }, [showPixelGrid, showSilhouette, silhouetteColor, compareSnapshotId, previewBackground, frame, frameVersion, selectionBounds, dragSelection, transformPreview, onionSkinEnabled, onionSkinData, onionSkinShowPrev, onionSkinShowNext, onionSkinPrevOpacity, onionSkinNextOpacity, activeTool, primaryColor, sliceRegions, selectedSliceId, hoveredSliceId, mirrorMode, showMotionTrail, motionTrailData, loopSeamMode, loopSeamData]);

  useEffect(() => { render(); }, [render]);

  // Schedule a render via rAF, coalescing multiple calls within the same frame.
  // renderRequestRef was previously allocated but never wired up.
  // Pointer handler callbacks (shape drag, lasso, slice preview) call
  // renderRef.current(), which points here. Multiple pointer events arriving
  // before the next frame collapse into a single render call.
  const scheduleRender = useCallback(() => {
    if (renderRequestRef.current !== null) return;
    renderRequestRef.current = requestAnimationFrame(() => {
      renderRequestRef.current = null;
      render();
    });
  }, [render]);

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

  // Keep renderRef pointing at the rAF-coalesced scheduler so the pointer
  // handler hook triggers renders without duplicating frames.
  // State-driven renders (useEffect on [render] above) still fire immediately
  // since they're already rate-limited by React's scheduler.
  useEffect(() => { renderRef.current = scheduleRender; }, [scheduleRender]);

  // Subscribe to pan/zoom changes directly — bypasses React re-renders.
  // When panX, panY, or zoom change, we schedule a render via rAF without
  // re-creating the render callback or triggering useEffect cascades.
  // All other view state changes (showPixelGrid, silhouette, etc.) still
  // travel through React's reactive path since they're infrequent.
  useEffect(() => {
    let prevZoom  = useCanvasViewStore.getState().zoom;
    let prevPanX  = useCanvasViewStore.getState().panX;
    let prevPanY  = useCanvasViewStore.getState().panY;
    const unsub = useCanvasViewStore.subscribe((state) => {
      if (state.zoom !== prevZoom || state.panX !== prevPanX || state.panY !== prevPanY) {
        prevZoom = state.zoom;
        prevPanX = state.panX;
        prevPanY = state.panY;
        scheduleRender();
      }
    });
    return unsub;
  }, [scheduleRender]);


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

      // Esc clears frame range selection first, then transform/selection
      if (e.code === 'Escape') {
        const tl = useTimelineStore.getState();
        if (tl.selectedFrameIndices.length > 0) {
          tl.clearFrameSelection();
          return;
        }
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

      // Alt+H/V/R — batch transform selected frames (whole-canvas flip/rotate)
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const batchCmd =
          e.code === 'KeyH' ? 'flip_horizontal' :
          e.code === 'KeyV' ? 'flip_vertical' :
          e.code === 'KeyR' ? 'rotate_90_cw' :
          null;
        if (batchCmd) {
          const tl = useTimelineStore.getState();
          const indices = tl.selectedFrameIndices.length > 0
            ? tl.selectedFrameIndices
            : [tl.activeFrameIndex];
          if (tl.playing) tl.setPlaying(false);
          e.preventDefault();
          try {
            const result = await invoke<TimelineResult>('transform_frame_range', {
              frameIndices: indices,
              transform: batchCmd,
            });
            tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
            setFrame(result.frame);
            syncLayersFromFrame(result.frame);
            markDirty();
            invoke('mark_dirty').catch(() => {});
            tl.setLastBatchTransform(batchCmd);
            const scope = tl.selectedFrameIndices.length > 0
              ? `${indices.length} frames`
              : `Frame ${tl.activeFrameIndex + 1}`;
            toast.info(`${batchCmd.replace('_', ' ')} → ${scope}`);
          } catch (err) { console.error('transform_frame_range failed:', err); }
          return;
        }
      }

      // Alt+1/2/3/4 — set hold ×1/2/3/4 on current frame or selected range
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const holdMap: Record<string, number> = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
        const holdN = holdMap[e.code];
        if (holdN !== undefined) {
          e.preventDefault();
          const tl = useTimelineStore.getState();
          if (tl.playing) tl.setPlaying(false);
          const currentFps = tl.fps;
          const baseDuration = Math.round(1000 / currentFps);
          const durationMs = holdN === 1 ? null : baseDuration * holdN;
          const indices = tl.selectedFrameIndices.length > 0
            ? tl.selectedFrameIndices
            : [tl.activeFrameIndex];
          try {
            const result = await invoke<TimelineResult>('set_frame_duration_range', {
              frameIndices: indices,
              durationMs: durationMs,
            });
            tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
            setFrame(result.frame);
            syncLayersFromFrame(result.frame);
            markDirty();
            invoke('mark_dirty').catch(() => {});
            const scope = indices.length > 1 ? `${indices.length} frames` : `Frame ${tl.activeFrameIndex + 1}`;
            toast.info(holdN === 1 ? `Reset timing → ${scope}` : `Hold ×${holdN} → ${scope}`);
          } catch (err) { console.error('set_frame_duration_range failed:', err); }
          return;
        }
      }

      // Alt+[ / Alt+] — compress/expand timing on selected range
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
        e.preventDefault();
        const tl = useTimelineStore.getState();
        if (tl.playing) tl.setPlaying(false);
        const indices = tl.selectedFrameIndices.length > 0
          ? tl.selectedFrameIndices
          : [tl.activeFrameIndex];
        const baseDuration = Math.round(1000 / tl.fps);
        const compress = e.code === 'BracketLeft';

        // Compute new durations per frame
        for (const idx of indices) {
          const frame = tl.frames[idx];
          if (!frame) continue;
          const currentMs = frame.durationMs ?? baseDuration;
          let newMs: number;
          if (compress) {
            newMs = Math.max(baseDuration, Math.round(currentMs / 2));
          } else {
            newMs = Math.round(currentMs * 2);
          }
          // If newMs equals base duration, clear override
          const durationMs = Math.abs(newMs - baseDuration) < 1 ? null : newMs;
          // Fire individual set_frame_duration to keep it simple
          invoke('set_frame_duration', { frameId: frame.id, durationMs }).catch(() => {});
        }
        // Refresh timeline state after all updates
        try {
          const result = await invoke<TimelineResult>('get_timeline');
          tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
          markDirty();
          invoke('mark_dirty').catch(() => {});
          const scope = indices.length > 1 ? `${indices.length} frames` : `Frame ${tl.activeFrameIndex + 1}`;
          toast.info(`${compress ? 'Compress' : 'Expand'} timing → ${scope}`);
        } catch (err) { console.error('retime failed:', err); }
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

        // Ctrl+D — duplicate frame(s): range if selected, otherwise active
        if (e.code === 'KeyD' && !e.shiftKey) {
          e.preventDefault();
          const tl = useTimelineStore.getState();
          if (tl.playing) tl.setPlaying(false);
          const hasRange = tl.selectedFrameIndices.length > 0;
          try {
            if (hasRange) {
              const result = await invoke<TimelineResult>('duplicate_frame_range', {
                frameIndices: tl.selectedFrameIndices,
              });
              tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
              setFrame(result.frame);
              syncLayersFromFrame(result.frame);
              markDirty();
              invoke('mark_dirty').catch(() => {});
              tl.clearFrameSelection();
              toast.info(`Duplicated ${tl.selectedFrameIndices.length} frames → Frame ${result.activeFrameIndex + 1}`);
            } else {
              const result = await invoke<TimelineResult>('duplicate_frame');
              tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
              setFrame(result.frame);
              syncLayersFromFrame(result.frame);
              markDirty();
              invoke('mark_dirty').catch(() => {});
              toast.info(`Duplicated → Frame ${result.activeFrameIndex + 1}`);
            }
          } catch (err) { console.error('duplicate_frame failed:', err); }
          return;
        }

        // Ctrl+Alt+D — experiment: snapshot range → duplicate → compare mode
        if (e.code === 'KeyD' && e.altKey && !e.shiftKey) {
          const tl = useTimelineStore.getState();
          if (tl.selectedFrameIndices.length === 0) return;
          if (tl.playing) tl.setPlaying(false);
          e.preventDefault();
          try {
            // 1. Snapshot the selected range
            const snapData = await invoke<Array<{ frameIndex: number; frameId: string; frameName: string; width: number; height: number; data: number[] }>>('snapshot_frame_range', {
              frameIndices: tl.selectedFrameIndices,
            });
            const rs = useRangeSnapshotStore.getState();
            const cpCount = rs.checkpoints.length;
            const cpId = rs.createCheckpoint(
              `Experiment ${cpCount + 1} (${snapData.length} frames)`,
              snapData,
            );

            // 2. Duplicate the range
            const result = await invoke<TimelineResult>('duplicate_frame_range', {
              frameIndices: tl.selectedFrameIndices,
            });
            tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
            setFrame(result.frame);
            syncLayersFromFrame(result.frame);
            markDirty();
            invoke('mark_dirty').catch(() => {});
            tl.clearFrameSelection();

            // 3. Enter range compare mode against the checkpoint
            rs.setCompareCheckpoint(cpId);
            toast.info(`Experiment: ${snapData.length} frames duplicated · Shift+\` to compare originals`);
          } catch (err) { console.error('experiment duplicate failed:', err); }
          return;
        }

        // Ctrl+Delete / Ctrl+Backspace — delete frame(s): range if selected, else active
        if ((e.code === 'Delete' || e.code === 'Backspace') && !e.shiftKey) {
          const tl = useTimelineStore.getState();
          if (tl.frames.length <= 1) return;
          if (tl.playing) tl.setPlaying(false);
          e.preventDefault();
          const hasRange = tl.selectedFrameIndices.length > 0;
          try {
            if (hasRange) {
              if (tl.selectedFrameIndices.length >= tl.frames.length) {
                toast.info('Cannot delete all frames');
                return;
              }
              const result = await invoke<TimelineResult>('delete_frame_range', {
                frameIndices: tl.selectedFrameIndices,
              });
              tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
              setFrame(result.frame);
              syncLayersFromFrame(result.frame);
              markDirty();
              invoke('mark_dirty').catch(() => {});
              // Exit range compare if active
              const rs = useRangeSnapshotStore.getState();
              if (rs.compareCheckpointId) rs.setCompareCheckpoint(null);
              tl.clearFrameSelection();
              toast.info(`Deleted ${tl.selectedFrameIndices.length} frames → now Frame ${result.activeFrameIndex + 1}`);
            } else {
              const result = await invoke<TimelineResult>('delete_frame', { frameId: tl.activeFrameId });
              tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
              setFrame(result.frame);
              syncLayersFromFrame(result.frame);
              markDirty();
              invoke('mark_dirty').catch(() => {});
              toast.info(`Deleted → now Frame ${result.activeFrameIndex + 1}`);
            }
          } catch (err) { console.error('delete_frame failed:', err); }
          return;
        }

        // Ctrl+Shift+T — repeat last batch transform on selected range / current frame
        // Ctrl+Alt+T — repeat last batch transform from current frame onward
        if (e.code === 'KeyT' && (e.shiftKey || e.altKey) && !useSelectionStore.getState().isTransforming) {
          const tl = useTimelineStore.getState();
          if (!tl.lastBatchTransform) return;
          e.preventDefault();
          if (tl.playing) tl.setPlaying(false);

          let indices: number[];
          let scopeLabel: string;
          if (e.altKey) {
            // Current frame onward
            indices = [];
            for (let i = tl.activeFrameIndex; i < tl.frames.length; i++) indices.push(i);
            scopeLabel = `frames ${tl.activeFrameIndex + 1}→${tl.frames.length}`;
          } else if (tl.selectedFrameIndices.length > 0) {
            indices = tl.selectedFrameIndices;
            scopeLabel = `${indices.length} selected frames`;
          } else {
            indices = [tl.activeFrameIndex];
            scopeLabel = `Frame ${tl.activeFrameIndex + 1}`;
          }

          try {
            const result = await invoke<TimelineResult>('transform_frame_range', {
              frameIndices: indices,
              transform: tl.lastBatchTransform,
            });
            tl.setFrames(result.frames, result.activeFrameId, result.activeFrameIndex);
            setFrame(result.frame);
            syncLayersFromFrame(result.frame);
            markDirty();
            invoke('mark_dirty').catch(() => {});
            toast.info(`Repeat ${tl.lastBatchTransform.replace('_', ' ')} → ${scopeLabel}`);
          } catch (err) { console.error('repeat transform_frame_range failed:', err); }
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

        // Ctrl+Shift+S — snapshot: range checkpoint if frames selected, else single-frame
        if (e.code === 'KeyS' && e.shiftKey) {
          e.preventDefault();
          const tl = useTimelineStore.getState();
          if (tl.selectedFrameIndices.length > 0) {
            // Range snapshot
            try {
              const snapData = await invoke<Array<{ frameIndex: number; frameId: string; frameName: string; width: number; height: number; data: number[] }>>('snapshot_frame_range', {
                frameIndices: tl.selectedFrameIndices,
              });
              const { useRangeSnapshotStore } = await import('@glyphstudio/state');
              const checkpoints = useRangeSnapshotStore.getState().checkpoints;
              const id = useRangeSnapshotStore.getState().createCheckpoint(
                `Range ${checkpoints.length + 1} (${snapData.length} frames)`,
                snapData,
              );
              toast.info(`Checkpoint saved: ${snapData.length} frames`);
            } catch (err) { console.error('snapshot_frame_range failed:', err); }
          } else {
            // Single-frame snapshot (existing behavior)
            const fr = useCanvasFrameStore.getState().frame;
            if (fr) {
              const snaps = useSnapshotStore.getState().snapshots;
              useSnapshotStore.getState().createSnapshot(
                `Snapshot ${snaps.length + 1}`,
                fr.width, fr.height, fr.data,
              );
              toast.info('Snapshot captured');
            }
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

      // Blink compare: ` (Backquote) toggles compare
      // Shift+` toggles range checkpoint compare; plain ` toggles single-frame compare
      if (e.code === 'Backquote' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
        e.preventDefault();
        if (e.shiftKey) {
          // Range checkpoint compare
          const rs = useRangeSnapshotStore.getState();
          if (rs.checkpoints.length === 0) return;
          if (rs.compareCheckpointId) {
            rs.setCompareCheckpoint(null);
          } else {
            rs.setCompareCheckpoint(rs.checkpoints[rs.checkpoints.length - 1].id);
          }
        } else {
          // Single-frame compare
          const snaps = useSnapshotStore.getState().snapshots;
          if (snaps.length === 0) return;
          const viewState = useCanvasViewStore.getState();
          if (viewState.compareSnapshotId) {
            viewState.setCompareSnapshot(null);
          } else {
            viewState.setCompareSnapshot(snaps[snaps.length - 1].id);
          }
        }
        return;
      }

      // Toggle onion skin with O (not a tool, so handled separately from manifest dispatch)
      if (e.code === 'KeyO' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        useTimelineStore.getState().toggleOnionSkin();
        return;
      }

      // Toggle loop seam mode with L
      if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        useTimelineStore.getState().toggleLoopSeamMode();
        return;
      }

      // Toggle motion trail with M
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        useCanvasViewStore.getState().toggleOverlay('showMotionTrail');
        return;
      }

      // Prev/next frame with , and . (pauses playback, wraps when loop on)
      if (e.code === 'Comma' || e.code === 'Period') {
        e.preventDefault();
        const tl = useTimelineStore.getState();
        if (tl.playing) tl.setPlaying(false);
        if (tl.frames.length <= 1) return;
        const idx = tl.frames.findIndex((f) => f.id === tl.activeFrameId);
        let targetIdx = e.code === 'Comma' ? idx - 1 : idx + 1;
        if (targetIdx < 0) targetIdx = tl.loop ? tl.frames.length - 1 : -1;
        else if (targetIdx >= tl.frames.length) targetIdx = tl.loop ? 0 : -1;
        if (targetIdx < 0) return;
        const targetId = tl.frames[targetIdx].id;
        invoke<TimelineResult>('select_frame', { frameId: targetId })
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

  const zoomPercent = `${zoomForUI * 100}%`;
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
      {!canvasReady && (
        <div className="canvas-init-overlay" aria-label="Initializing canvas…">
          <span className="canvas-init-label">Loading…</span>
        </div>
      )}
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
        {frameCount > 0 && (
          <span className="status-frame-indicator" title={frameCount > 1 ? ', / . to step · Ctrl+D to duplicate · O for onion skin' : 'Ctrl+D to duplicate frame'}>
            {frameCount > 1 ? `${activeFrameIndex + 1}/${frameCount} ${activeFrameName}` : '1 frame'}
          </span>
        )}
        {frameCount > 1 && (
          <span className="status-timing" title={`${timelineFps}fps · ${(totalDurationMs / 1000).toFixed(2)}s total${activeFrameDurationMs ? ` · this frame: ${activeFrameDurationMs}ms` : ''} · Alt+1/2/3/4 to set hold`}>
            {(totalDurationMs / 1000).toFixed(1)}s{activeFrameDurationMs ? ` ×${Math.round(activeFrameDurationMs / (1000 / timelineFps))}` : ''}
          </span>
        )}
        {selectedFrameCount > 0 && (
          <span className="status-frame-range" title="Alt+H/V/R transform · Ctrl+D duplicate · Ctrl+Alt+D experiment · Ctrl+Del discard · Esc clear">
            {selectedFrameCount} frames · Alt+H/V/R · Ctrl+D · Ctrl+Del
          </span>
        )}
        {playing && <span title="Space to pause">playing</span>}
        {onionSkinEnabled && frameCount > 1 && (
          <span className="status-onion" title="O to toggle onion skin">
            onion{onionSkinShowPrev && onionSkinShowNext ? ': prev+next' : onionSkinShowPrev ? ': prev' : onionSkinShowNext ? ': next' : ''}
          </span>
        )}
        {showMotionTrail && frameCount > 1 && (
          <span className="status-onion" title="M to toggle motion trail">trail</span>
        )}
        {loopSeamMode && frameCount > 1 && (
          <span className="status-loop-seam" title="L to toggle loop seam · magenta = seam reference">seam</span>
        )}
        {frame?.canUndo && <span title="Ctrl+Z">undo</span>}
        {frame?.canRedo && <span title="Ctrl+Shift+Z">redo</span>}
        {compareSnapshotId && (
          <span className="status-compare" title="` to toggle compare" data-testid="compare-indicator">
            comparing
          </span>
        )}
        {rangeCompareId && (
          <span className="status-compare" title="Shift+` to exit range compare">
            {rangeCompareFrame ? 'range compare' : 'range (no data for this frame)'}
          </span>
        )}
      </div>
      {compareSnapshotId && (
        <div className="canvas-compare-banner" data-testid="canvas-compare-banner">
          Comparing: {compareSnapshot?.name ?? 'snapshot'} — press ` to return to live
        </div>
      )}
      {rangeCompareId && (
        <div className="canvas-compare-banner">
          Range compare — step through frames to see checkpoint data · Shift+` to exit
        </div>
      )}
    </main>
  );
}
