import { describe, it, expect, beforeEach } from 'vitest';
import { useLayerStore } from './layerStore';
import type { LayerNode } from '@glyphstudio/domain';

// ── Inline replica of CanvasFrameData + syncLayersFromFrame ──────
// The production code lives in apps/desktop/src/lib/syncLayers.ts.
// We replicate it here so the reconciliation logic is testable from
// the state package without cross-package imports.

interface CanvasFrameLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

interface CanvasFrameData {
  width: number;
  height: number;
  data: number[];
  layers: CanvasFrameLayer[];
  activeLayerId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

function syncLayersFromFrame(frame: CanvasFrameData) {
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
      store.updateLayer(l.id, {
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
      });
    }
  }

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

// ── Helpers ──────────────────────────────────────────────────────

function makeLayer(id: string, overrides?: Partial<LayerNode>): LayerNode {
  return {
    id,
    type: 'raster',
    name: `Layer ${id}`,
    parentId: null,
    childIds: [],
    visible: true,
    locked: false,
    opacity: 1.0,
    blendMode: 'normal',
    pixelRefId: null,
    maskLayerId: null,
    socketIds: [],
    origin: 'manual',
    acceptedFromCandidateId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    metadata: {},
    ...overrides,
  };
}

function makeFrame(
  layers: CanvasFrameLayer[],
  activeLayerId: string | null = null,
): CanvasFrameData {
  return {
    width: 32,
    height: 32,
    data: [],
    layers,
    activeLayerId,
    canUndo: false,
    canRedo: false,
  };
}

function fl(id: string, overrides?: Partial<CanvasFrameLayer>): CanvasFrameLayer {
  return { id, name: `Layer ${id}`, visible: true, locked: false, opacity: 1, ...overrides };
}

beforeEach(() => {
  useLayerStore.setState({
    rootLayerIds: [],
    layerById: {},
    activeLayerId: null,
    selectedLayerIds: [],
  });
});

// ── Tests ────────────────────────────────────────────────────────

describe('syncLayersFromFrame', () => {
  describe('adding new layers', () => {
    it('adds layers that do not exist in the store', () => {
      syncLayersFromFrame(makeFrame([fl('a'), fl('b')]));
      const s = useLayerStore.getState();
      expect(s.rootLayerIds).toEqual(['a', 'b']);
      expect(s.layerById['a']).toBeDefined();
      expect(s.layerById['b']).toBeDefined();
    });

    it('new layers get correct properties', () => {
      syncLayersFromFrame(
        makeFrame([fl('x', { name: 'Outline', visible: false, locked: true, opacity: 0.5 })]),
      );
      const layer = useLayerStore.getState().layerById['x'];
      expect(layer.name).toBe('Outline');
      expect(layer.visible).toBe(false);
      expect(layer.locked).toBe(true);
      expect(layer.opacity).toBe(0.5);
      expect(layer.type).toBe('raster');
      expect(layer.blendMode).toBe('normal');
    });
  });

  describe('updating existing layers', () => {
    it('updates name/visible/locked/opacity on existing layers', () => {
      // Pre-populate store
      useLayerStore.getState().addLayer(makeLayer('a', { name: 'Old', visible: true, locked: false, opacity: 1 }));

      syncLayersFromFrame(
        makeFrame([fl('a', { name: 'Renamed', visible: false, locked: true, opacity: 0.3 })]),
      );
      const layer = useLayerStore.getState().layerById['a'];
      expect(layer.name).toBe('Renamed');
      expect(layer.visible).toBe(false);
      expect(layer.locked).toBe(true);
      expect(layer.opacity).toBe(0.3);
    });

    it('preserves fields not in the Rust frame (blendMode, metadata)', () => {
      useLayerStore.getState().addLayer(
        makeLayer('a', { blendMode: 'multiply', metadata: { custom: 'value' } }),
      );
      syncLayersFromFrame(makeFrame([fl('a')]));
      const layer = useLayerStore.getState().layerById['a'];
      expect(layer.blendMode).toBe('multiply');
      expect(layer.metadata).toEqual({ custom: 'value' });
    });
  });

  describe('removing deleted layers', () => {
    it('removes layers that Rust no longer reports', () => {
      const s = useLayerStore.getState();
      s.addLayer(makeLayer('a'));
      s.addLayer(makeLayer('b'));
      s.addLayer(makeLayer('c'));

      // Rust only reports [b] — a and c should be removed
      syncLayersFromFrame(makeFrame([fl('b')]));
      const after = useLayerStore.getState();
      expect(after.rootLayerIds).toEqual(['b']);
      expect(after.layerById['a']).toBeUndefined();
      expect(after.layerById['c']).toBeUndefined();
    });

    it('clears activeLayerId when active layer is removed', () => {
      const s = useLayerStore.getState();
      s.addLayer(makeLayer('a'));
      s.addLayer(makeLayer('b'));
      // addLayer auto-sets activeLayerId to last added
      expect(useLayerStore.getState().activeLayerId).toBe('b');

      // Rust drops 'b'
      syncLayersFromFrame(makeFrame([fl('a')], 'a'));
      expect(useLayerStore.getState().activeLayerId).toBe('a');
    });
  });

  describe('reordering', () => {
    it('reorders layers to match Rust order', () => {
      const s = useLayerStore.getState();
      s.addLayer(makeLayer('a'));
      s.addLayer(makeLayer('b'));
      s.addLayer(makeLayer('c'));
      expect(useLayerStore.getState().rootLayerIds).toEqual(['a', 'b', 'c']);

      // Rust reports c, a, b order
      syncLayersFromFrame(makeFrame([fl('c'), fl('a'), fl('b')]));
      expect(useLayerStore.getState().rootLayerIds).toEqual(['c', 'a', 'b']);
    });
  });

  describe('active layer selection', () => {
    it('sets activeLayerId when frame specifies one', () => {
      syncLayersFromFrame(makeFrame([fl('a'), fl('b')], 'b'));
      expect(useLayerStore.getState().activeLayerId).toBe('b');
    });

    it('does not clear activeLayerId when frame.activeLayerId is null', () => {
      const s = useLayerStore.getState();
      s.addLayer(makeLayer('a'));
      s.setActiveLayer('a');

      syncLayersFromFrame(makeFrame([fl('a')], null));
      // activeLayerId should stay as 'a' (set by addLayer) since null doesn't trigger setActiveLayer
      expect(useLayerStore.getState().activeLayerId).toBe('a');
    });
  });

  describe('mixed operations in one sync', () => {
    it('adds, updates, removes, and reorders in a single call', () => {
      const s = useLayerStore.getState();
      s.addLayer(makeLayer('keep', { name: 'OldName', opacity: 0.5 }));
      s.addLayer(makeLayer('remove_me'));
      s.addLayer(makeLayer('also_keep'));

      // Rust: also_keep (existing), new_layer (new), keep (existing, updated)
      // remove_me is gone
      syncLayersFromFrame(
        makeFrame(
          [
            fl('also_keep'),
            fl('new_layer'),
            fl('keep', { name: 'NewName', opacity: 0.9 }),
          ],
          'keep',
        ),
      );

      const after = useLayerStore.getState();
      expect(after.rootLayerIds).toEqual(['also_keep', 'new_layer', 'keep']);
      expect(after.layerById['remove_me']).toBeUndefined();
      expect(after.layerById['new_layer']).toBeDefined();
      expect(after.layerById['keep'].name).toBe('NewName');
      expect(after.layerById['keep'].opacity).toBe(0.9);
      expect(after.activeLayerId).toBe('keep');
    });
  });

  describe('edge cases', () => {
    it('syncing empty frame clears all layers', () => {
      const s = useLayerStore.getState();
      s.addLayer(makeLayer('a'));
      s.addLayer(makeLayer('b'));

      syncLayersFromFrame(makeFrame([]));
      const after = useLayerStore.getState();
      expect(after.rootLayerIds).toEqual([]);
      expect(Object.keys(after.layerById)).toEqual([]);
    });

    it('syncing into empty store populates it', () => {
      syncLayersFromFrame(makeFrame([fl('x'), fl('y'), fl('z')], 'y'));
      const after = useLayerStore.getState();
      expect(after.rootLayerIds).toEqual(['x', 'y', 'z']);
      expect(after.activeLayerId).toBe('y');
    });

    it('idempotent: syncing same frame twice produces same state', () => {
      const frame = makeFrame([fl('a'), fl('b')], 'a');
      syncLayersFromFrame(frame);
      const snap1 = { ...useLayerStore.getState() };

      syncLayersFromFrame(frame);
      const snap2 = useLayerStore.getState();
      expect(snap2.rootLayerIds).toEqual(snap1.rootLayerIds);
      expect(snap2.activeLayerId).toBe(snap1.activeLayerId);
      expect(Object.keys(snap2.layerById).sort()).toEqual(Object.keys(snap1.layerById).sort());
    });
  });
});
