import { useLayerStore } from '@glyphstudio/state';
import type { CanvasFrameData } from './canvasFrameStore';

/** Sync the frontend layer store from a Rust CanvasFrame response. */
export function syncLayersFromFrame(frame: CanvasFrameData) {
  const store = useLayerStore.getState();
  const existingIds = new Set(store.rootLayerIds);
  const frameIds = new Set(frame.layers.map((l) => l.id));
  const now = new Date().toISOString();

  for (const l of frame.layers) {
    if (!existingIds.has(l.id)) {
      store.addLayer({
        id: l.id,
        name: l.name,
        type: 'raster',
        origin: 'manual',
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blendMode: 'normal',
        parentId: null,
        childIds: [],
        pixelRefId: null,
        maskLayerId: null,
        socketIds: [],
        acceptedFromCandidateId: null,
        createdAt: now,
        updatedAt: now,
        metadata: {},
      });
    } else {
      // Preserve layer type (e.g. sketch) — Rust doesn't know about types
      store.updateLayer(l.id, {
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
      });
    }
  }

  // Remove layers that Rust deleted
  for (const id of existingIds) {
    if (!frameIds.has(id)) {
      store.removeLayer(id);
    }
  }

  store.setLayerOrder(frame.layers.map((l) => l.id));

  if (frame.activeLayerId) {
    store.setActiveLayer(frame.activeLayerId);
  }
}
