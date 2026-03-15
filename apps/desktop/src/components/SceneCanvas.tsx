import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, SceneInfo, SourceAssetFrames } from '@glyphstudio/domain';
import { useScenePlaybackStore, useProjectStore, useSceneEditorStore } from '@glyphstudio/state';

/** Cached frame images for a source asset + clip combination. */
interface CachedFrames {
  blobUrls: string[];
  width: number;
  height: number;
  frameCount: number;
}

/** Cache key for frame data: sourcePath::clipId */
function frameCacheKey(sourcePath: string, clipId: string | null | undefined): string {
  return `${sourcePath}::${clipId ?? 'static'}`;
}

export function SceneCanvas() {
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null);
  const instances = useSceneEditorStore((s) => s.instances);
  const loadInstances = useSceneEditorStore((s) => s.loadInstances);
  const applyEdit = useSceneEditorStore((s) => s.applyEdit);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState<{
    instanceId: string; startX: number; startY: number; origX: number; origY: number;
  } | null>(null);
  const [panning, setPanning] = useState<{
    startX: number; startY: number; origCamX: number; origCamY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Frame cache: cacheKey → CachedFrames
  const frameCacheRef = useRef<Map<string, CachedFrames>>(new Map());
  // Track loading keys to avoid duplicate requests
  const loadingKeysRef = useRef<Set<string>>(new Set());
  // Force re-render when cache updates
  const [cacheVersion, setCacheVersion] = useState(0);

  // Scene clock tick — drives animated frame selection per instance
  const sceneTick = useScenePlaybackStore((s) => s.currentTick);
  const playbackState = useScenePlaybackStore((s) => s.playbackState);
  const cameraX = useScenePlaybackStore((s) => s.cameraX);
  const cameraY = useScenePlaybackStore((s) => s.cameraY);
  const cameraZoom = useScenePlaybackStore((s) => s.cameraZoom);
  const setCameraPosition = useScenePlaybackStore((s) => s.setCameraPosition);
  const setCameraZoom = useScenePlaybackStore((s) => s.setCameraZoom);
  const resetCamera = useScenePlaybackStore((s) => s.resetCamera);

  // Clear all cached frame blob URLs
  const clearFrameCache = useCallback(() => {
    for (const cached of frameCacheRef.current.values()) {
      for (const url of cached.blobUrls) {
        URL.revokeObjectURL(url);
      }
    }
    frameCacheRef.current.clear();
    loadingKeysRef.current.clear();
    setCacheVersion((v) => v + 1);
  }, []);

  // Load scene info and instances
  const refresh = useCallback(async () => {
    try {
      const info = await invoke<SceneInfo>('get_scene_info');
      // If scene changed (different ID), clear caches and reset playback
      if (sceneInfo && info.sceneId !== sceneInfo.sceneId) {
        clearFrameCache();
        useScenePlaybackStore.getState().resetClock();
        useScenePlaybackStore.getState().setPlaying(false);
      }
      setSceneInfo(info);
      // Sync base camera from backend → store
      useScenePlaybackStore.getState().setCamera(info.cameraX, info.cameraY, info.cameraZoom);
      // Load keyframes so tick-based camera resolution works
      const kfs = await invoke<SceneCameraKeyframe[]>('list_scene_camera_keyframes');
      useScenePlaybackStore.getState().setCameraKeyframes(kfs);
      const insts = await invoke<SceneAssetInstance[]>('get_scene_instances');
      loadInstances(insts);
    } catch {
      setSceneInfo(null);
      loadInstances([]);
    }
  }, [sceneInfo, clearFrameCache]);

  useEffect(() => { refresh(); }, []);

  // Load frame images for instances when they change or clip assignments change
  useEffect(() => {
    let cancelled = false;

    for (const inst of instances) {
      const key = frameCacheKey(inst.sourcePath, inst.clipId);
      if (frameCacheRef.current.has(key) || loadingKeysRef.current.has(key)) {
        continue;
      }

      loadingKeysRef.current.add(key);

      invoke<SourceAssetFrames>('get_source_asset_frames', {
        sourcePath: inst.sourcePath,
        clipId: inst.clipId ?? null,
      })
        .then((result) => {
          if (cancelled) return;
          // Convert base64 PNGs to blob URLs
          const blobUrls = result.frames.map((b64) => {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'image/png' });
            return URL.createObjectURL(blob);
          });

          frameCacheRef.current.set(key, {
            blobUrls,
            width: result.width,
            height: result.height,
            frameCount: result.frameCount,
          });
          loadingKeysRef.current.delete(key);
          setCacheVersion((v) => v + 1);
        })
        .catch(() => {
          loadingKeysRef.current.delete(key);
        });
    }

    return () => { cancelled = true; };
  }, [instances]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const cached of frameCacheRef.current.values()) {
        for (const url of cached.blobUrls) {
          URL.revokeObjectURL(url);
        }
      }
      frameCacheRef.current.clear();
    };
  }, []);

  // Clear selection when selected instance is removed
  useEffect(() => {
    if (selectedId && !instances.some((i) => i.instanceId === selectedId)) {
      setSelectedId(null);
    }
  }, [instances, selectedId]);

  // Add asset to scene
  const handleAddAsset = useCallback(async (sourcePath: string, assetId?: string, name?: string) => {
    try {
      const added = await invoke<SceneAssetInstance>('add_scene_instance', {
        sourcePath,
        assetId: assetId ?? null,
        name: name ?? null,
        x: null,
        y: null,
        clipId: null,
      });
      // Refresh and record history
      const refreshed = await invoke<SceneAssetInstance[]>('get_scene_instances');
      applyEdit('add-instance', refreshed, { instanceId: added.instanceId });
      // Refresh scene info (instance count etc)
      const info = await invoke<SceneInfo>('get_scene_info');
      setSceneInfo(info);
    } catch (err) {
      setError(String(err));
    }
  }, [applyEdit]);

  // Drag handlers — allowed during playback
  const handleMouseDown = useCallback((e: React.MouseEvent, instanceId: string) => {
    e.stopPropagation();
    const inst = instances.find((i) => i.instanceId === instanceId);
    if (!inst) return;
    setSelectedId(instanceId);
    setDragging({
      instanceId,
      startX: e.clientX,
      startY: e.clientY,
      origX: inst.x,
      origY: inst.y,
    });
  }, [instances]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Camera panning (middle-click drag)
    if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      const zoom = useScenePlaybackStore.getState().cameraZoom;
      setCameraPosition(panning.origCamX - dx / zoom, panning.origCamY - dy / zoom);
      return;
    }
    // Instance dragging
    if (!dragging) return;
    const zoom = useScenePlaybackStore.getState().cameraZoom;
    const dx = (e.clientX - dragging.startX) / zoom;
    const dy = (e.clientY - dragging.startY) / zoom;
    const newX = Math.round(dragging.origX + dx);
    const newY = Math.round(dragging.origY + dy);
    loadInstances(
      instances.map((inst) =>
        inst.instanceId === dragging.instanceId
          ? { ...inst, x: newX, y: newY }
          : inst,
      ),
    );
  }, [dragging, panning, setCameraPosition, instances, loadInstances]);

  const handleMouseUp = useCallback(async () => {
    if (panning) {
      // Commit camera position to backend
      const cam = useScenePlaybackStore.getState();
      try {
        await invoke('set_scene_camera_position', { x: cam.cameraX, y: cam.cameraY });
      } catch {
        // ignore
      }
      setPanning(null);
      return;
    }
    if (!dragging) return;
    const inst = instances.find((i) => i.instanceId === dragging.instanceId);
    if (inst && (inst.x !== dragging.origX || inst.y !== dragging.origY)) {
      try {
        await invoke('move_scene_instance', {
          instanceId: dragging.instanceId,
          x: inst.x,
          y: inst.y,
        });
        useProjectStore.getState().markDirty();
        invoke('mark_dirty').catch(() => {});
        // Record history: build before snapshot with original position
        const beforeInstances = instances.map((i) =>
          i.instanceId === dragging.instanceId
            ? { ...i, x: dragging.origX, y: dragging.origY }
            : i,
        );
        // Temporarily load before snapshot so applyEdit captures it
        loadInstances(beforeInstances);
        // Now record the edit with the current (moved) instances as after
        const refreshed = await invoke<SceneAssetInstance[]>('get_scene_instances');
        applyEdit('move-instance', refreshed, { instanceId: dragging.instanceId });
      } catch (err) {
        setError(String(err));
      }
    }
    setDragging(null);
  }, [dragging, panning, instances, loadInstances, applyEdit]);

  const handleCanvasClick = useCallback(() => {
    if (!dragging && !panning) setSelectedId(null);
  }, [dragging, panning]);

  // Middle-click to start camera pan
  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      // Middle click — pan
      e.preventDefault();
      const cam = useScenePlaybackStore.getState();
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        origCamX: cam.cameraX,
        origCamY: cam.cameraY,
      });
    }
  }, []);

  // Wheel zoom (centered on mouse position)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cam = useScenePlaybackStore.getState();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.1, Math.min(10.0, cam.cameraZoom * factor));
    setCameraZoom(newZoom);
    // Commit to backend (debounced via next mouseup or explicit save)
    invoke('set_scene_camera_zoom', { zoom: newZoom }).catch(() => {});
  }, [setCameraZoom]);

  // Reset camera handler
  const handleResetCamera = useCallback(async () => {
    resetCamera();
    try {
      await invoke('reset_scene_camera');
    } catch {
      // ignore
    }
  }, [resetCamera]);

  // Scene undo/redo keyboard shortcuts
  const sceneUndo = useSceneEditorStore((s) => s.undo);
  const sceneRedo = useSceneEditorStore((s) => s.redo);
  const sceneCanUndo = useSceneEditorStore((s) => s.canUndo);
  const sceneCanRedo = useSceneEditorStore((s) => s.canRedo);

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const restored = sceneUndo();
        if (restored) {
          await invoke('restore_scene_instances', { instances: restored }).catch(() => {});
          useProjectStore.getState().markDirty();
          invoke('mark_dirty').catch(() => {});
        }
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        const restored = sceneRedo();
        if (restored) {
          await invoke('restore_scene_instances', { instances: restored }).catch(() => {});
          useProjectStore.getState().markDirty();
          invoke('mark_dirty').catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sceneUndo, sceneRedo]);

  // Sort instances by z-order for rendering
  const sortedInstances = [...instances].sort((a, b) => a.zOrder - b.zOrder);

  if (!sceneInfo) {
    return (
      <div className="scene-canvas-empty">
        <div className="scene-canvas-empty-msg">
          <span>No scene open</span>
          <button className="scene-create-btn" onClick={async () => {
            try {
              await invoke('new_scene', { name: 'Untitled Scene', width: 320, height: 240 });
              clearFrameCache();
              useScenePlaybackStore.getState().clearAll();
              useProjectStore.getState().markDirty();
              invoke('mark_dirty').catch(() => {});
              refresh();
            } catch (err) {
              setError(String(err));
            }
          }}>
            New Scene
          </button>
          {error && <span className="scene-error">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="scene-canvas-container"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      <div className="scene-canvas-header">
        <span className="scene-canvas-name">
          {sceneInfo.name}{sceneInfo.dirty ? ' \u2022' : ''}
        </span>
        <span className="scene-canvas-dims">{sceneInfo.canvasWidth} x {sceneInfo.canvasHeight}</span>
        <span className="scene-canvas-count">{sceneInfo.instanceCount} instance{sceneInfo.instanceCount !== 1 ? 's' : ''}</span>
      </div>

      <div
        className="scene-viewport"
        onMouseDown={handleViewportMouseDown}
        onWheel={handleWheel}
      >
        <div
          className="scene-stage"
          style={{
            width: sceneInfo.canvasWidth,
            height: sceneInfo.canvasHeight,
            transform: `scale(${cameraZoom}) translate(${-cameraX}px, ${-cameraY}px)`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid overlay */}
          <div className="scene-grid" />

          {/* Instances */}
          {sortedInstances.map((inst) => {
            const isSelected = selectedId === inst.instanceId;
            if (!inst.visible) return null;

            const key = frameCacheKey(inst.sourcePath, inst.clipId);
            const cached = frameCacheRef.current.get(key);
            const clipState = playbackState?.instances.find(
              (c) => c.instanceId === inst.instanceId,
            );
            const status = clipState?.status ?? 'no_clip';
            const isMissingSource = status === 'missing_source';
            const isMissingClip = status === 'missing_clip' || status === 'no_clips_in_source';

            // Compute current frame index from scene tick
            let frameUrl: string | null = null;
            if (cached && cached.blobUrls.length > 0) {
              if (cached.frameCount <= 1) {
                frameUrl = cached.blobUrls[0];
              } else {
                const clipLoop = clipState?.clipLoop ?? true;
                const frameIdx = clipLoop
                  ? sceneTick % cached.frameCount
                  : Math.min(sceneTick, cached.frameCount - 1);
                frameUrl = cached.blobUrls[frameIdx] ?? cached.blobUrls[0];
              }
            }

            // Missing source → always show missing placeholder
            const showMissingPlaceholder = isMissingSource;
            const instanceClass = [
              'scene-instance',
              isSelected ? 'scene-instance-selected' : '',
              showMissingPlaceholder ? 'scene-instance-missing' : '',
              isMissingClip ? 'scene-instance-clip-warn' : '',
            ].filter(Boolean).join(' ');

            // Parallax: offset instance position relative to camera.
            // The stage already translates by -cameraX/-cameraY (parallax=1.0 plane).
            // Additional offset for this instance: cameraX * (1 - parallax), same for Y.
            const pFactor = inst.parallax ?? 1.0;
            const parallaxOffsetX = cameraX * (1 - pFactor);
            const parallaxOffsetY = cameraY * (1 - pFactor);

            return (
              <div
                key={inst.instanceId}
                className={instanceClass}
                style={{
                  left: inst.x + parallaxOffsetX,
                  top: inst.y + parallaxOffsetY,
                  opacity: inst.opacity,
                  zIndex: inst.zOrder + 10,
                }}
                onMouseDown={(e) => handleMouseDown(e, inst.instanceId)}
              >
                {showMissingPlaceholder ? (
                  <div className="scene-instance-placeholder scene-instance-placeholder-missing">
                    <span>{'\u26A0'}</span>
                    <span className="scene-instance-placeholder-label">{inst.name.slice(0, 6)}</span>
                  </div>
                ) : frameUrl ? (
                  <img
                    className="scene-instance-img"
                    src={frameUrl}
                    alt={inst.name}
                    draggable={false}
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="scene-instance-placeholder">
                    <span>{inst.name.slice(0, 3).toUpperCase()}</span>
                  </div>
                )}
                {isSelected && <div className="scene-instance-outline" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Toolbar: add asset + undo/redo + camera controls */}
      <div className="scene-canvas-toolbar">
        <SceneAddAssetButton onAdd={handleAddAsset} />
        <div className="scene-history-controls">
          <button
            className="scene-history-btn"
            title="Undo (Ctrl+Z)"
            disabled={!sceneCanUndo}
            onClick={async () => {
              const restored = sceneUndo();
              if (restored) {
                await invoke('restore_scene_instances', { instances: restored }).catch(() => {});
                useProjectStore.getState().markDirty();
                invoke('mark_dirty').catch(() => {});
              }
            }}
          >{'\u21A9'}</button>
          <button
            className="scene-history-btn"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!sceneCanRedo}
            onClick={async () => {
              const restored = sceneRedo();
              if (restored) {
                await invoke('restore_scene_instances', { instances: restored }).catch(() => {});
                useProjectStore.getState().markDirty();
                invoke('mark_dirty').catch(() => {});
              }
            }}
          >{'\u21AA'}</button>
        </div>
        <div className="scene-camera-controls">
          <span className="scene-camera-label">{Math.round(cameraZoom * 100)}%</span>
          <button
            className="scene-camera-btn"
            title="Zoom in"
            onClick={() => {
              const z = Math.min(10.0, cameraZoom * 1.25);
              setCameraZoom(z);
              invoke('set_scene_camera_zoom', { zoom: z }).catch(() => {});
            }}
          >+</button>
          <button
            className="scene-camera-btn"
            title="Zoom out"
            onClick={() => {
              const z = Math.max(0.1, cameraZoom / 1.25);
              setCameraZoom(z);
              invoke('set_scene_camera_zoom', { zoom: z }).catch(() => {});
            }}
          >{'\u2212'}</button>
          <button
            className="scene-camera-btn"
            title="Reset camera"
            onClick={handleResetCamera}
          >{'\u2302'}</button>
        </div>
      </div>

      {error && <span className="scene-error">{error}</span>}
    </div>
  );
}

/** Simple "Add Asset" button that invokes asset catalog. */
function SceneAddAssetButton({ onAdd }: { onAdd: (sourcePath: string, assetId?: string, name?: string) => void }) {
  const [assets, setAssets] = useState<Array<{ id: string; name: string; filePath: string; status: string }>>([]);
  const [open, setOpen] = useState(false);

  const loadAssets = useCallback(async () => {
    try {
      const result = await invoke<Array<{ id: string; name: string; filePath: string; status: string }>>('list_assets');
      setAssets(result.filter((a) => a.status !== 'missing'));
    } catch {
      setAssets([]);
    }
  }, []);

  return (
    <div className="scene-add-asset">
      <button
        className="scene-add-asset-btn"
        onClick={() => {
          if (!open) loadAssets();
          setOpen(!open);
        }}
      >
        + Add Asset
      </button>
      {open && (
        <div className="scene-add-asset-list">
          {assets.length === 0 && <span className="scene-add-asset-empty">No assets in catalog</span>}
          {assets.map((a) => (
            <button
              key={a.id}
              className="scene-add-asset-item"
              onClick={() => {
                onAdd(a.filePath, a.id, a.name);
                setOpen(false);
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
