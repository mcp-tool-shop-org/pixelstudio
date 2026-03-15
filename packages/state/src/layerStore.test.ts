import { describe, it, expect, beforeEach } from 'vitest';
import { useLayerStore } from './layerStore';
import type { LayerNode } from '@glyphstudio/domain';

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

beforeEach(() => {
  useLayerStore.setState({
    rootLayerIds: [],
    layerById: {},
    activeLayerId: null,
    selectedLayerIds: [],
  });
});

describe('addLayer', () => {
  it('adds layer to layerById and activates it', () => {
    const layer = makeLayer('a');
    useLayerStore.getState().addLayer(layer);
    const s = useLayerStore.getState();
    expect(s.layerById['a']).toBeDefined();
    expect(s.activeLayerId).toBe('a');
  });

  it('adds root layer to rootLayerIds', () => {
    useLayerStore.getState().addLayer(makeLayer('a'));
    expect(useLayerStore.getState().rootLayerIds).toEqual(['a']);
  });

  it('does not add child layer to rootLayerIds', () => {
    useLayerStore.getState().addLayer(makeLayer('child', { parentId: 'parent' }));
    expect(useLayerStore.getState().rootLayerIds).toEqual([]);
    expect(useLayerStore.getState().layerById['child']).toBeDefined();
  });
});

describe('removeLayer', () => {
  it('removes layer from layerById and rootLayerIds', () => {
    useLayerStore.getState().addLayer(makeLayer('a'));
    useLayerStore.getState().addLayer(makeLayer('b'));
    useLayerStore.getState().removeLayer('a');
    const s = useLayerStore.getState();
    expect(s.layerById['a']).toBeUndefined();
    expect(s.rootLayerIds).toEqual(['b']);
  });

  it('clears activeLayerId if removed layer was active', () => {
    useLayerStore.getState().addLayer(makeLayer('a'));
    expect(useLayerStore.getState().activeLayerId).toBe('a');
    useLayerStore.getState().removeLayer('a');
    expect(useLayerStore.getState().activeLayerId).toBeNull();
  });

  it('does not affect activeLayerId if removed layer was not active', () => {
    useLayerStore.getState().addLayer(makeLayer('a'));
    useLayerStore.getState().addLayer(makeLayer('b')); // b is now active
    useLayerStore.getState().removeLayer('a');
    expect(useLayerStore.getState().activeLayerId).toBe('b');
  });
});

describe('updateLayer', () => {
  it('updates partial fields', () => {
    useLayerStore.getState().addLayer(makeLayer('a'));
    useLayerStore.getState().updateLayer('a', { visible: false, opacity: 0.5 });
    const layer = useLayerStore.getState().layerById['a'];
    expect(layer.visible).toBe(false);
    expect(layer.opacity).toBe(0.5);
    expect(layer.name).toBe('Layer a'); // unchanged
  });

  it('no-ops for nonexistent layer', () => {
    useLayerStore.getState().updateLayer('nonexistent', { visible: false });
    expect(useLayerStore.getState().layerById['nonexistent']).toBeUndefined();
  });
});

describe('setLayerOrder', () => {
  it('reorders rootLayerIds', () => {
    useLayerStore.getState().addLayer(makeLayer('a'));
    useLayerStore.getState().addLayer(makeLayer('b'));
    useLayerStore.getState().addLayer(makeLayer('c'));
    useLayerStore.getState().setLayerOrder(['c', 'a', 'b']);
    expect(useLayerStore.getState().rootLayerIds).toEqual(['c', 'a', 'b']);
  });
});
