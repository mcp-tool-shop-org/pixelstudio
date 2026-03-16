import { describe, it, expect, beforeEach } from 'vitest';
import { useLayerStore } from './layerStore';
import { flattenLayers, TRANSPARENT } from './spriteRaster';
import type { LayerNode } from '@glyphstudio/domain';
import type { SpritePixelBuffer, SpriteLayer } from '@glyphstudio/domain';

function makeLayer(overrides: Partial<LayerNode> = {}): LayerNode {
  const now = new Date().toISOString();
  return {
    id: `layer-${Math.random().toString(36).slice(2, 8)}`,
    type: 'raster',
    name: 'Test Layer',
    parentId: null,
    childIds: [],
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    pixelRefId: null,
    maskLayerId: null,
    socketIds: [],
    origin: 'manual',
    acceptedFromCandidateId: null,
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...overrides,
  };
}

function getState() {
  return useLayerStore.getState();
}

describe('sketch layer — store operations', () => {
  beforeEach(() => {
    useLayerStore.setState({
      rootLayerIds: [],
      layerById: {},
      activeLayerId: null,
      selectedLayerIds: [],
    });
  });

  it('toggleSketch converts raster to sketch', () => {
    const layer = makeLayer({ id: 'a', type: 'raster' });
    getState().addLayer(layer);
    getState().toggleSketch('a');
    expect(getState().layerById['a'].type).toBe('sketch');
  });

  it('toggleSketch converts sketch back to raster', () => {
    const layer = makeLayer({ id: 'a', type: 'sketch' });
    getState().addLayer(layer);
    getState().toggleSketch('a');
    expect(getState().layerById['a'].type).toBe('raster');
  });

  it('toggleSketch lowers opacity to 0.4 if it was 1.0', () => {
    const layer = makeLayer({ id: 'a', opacity: 1 });
    getState().addLayer(layer);
    getState().toggleSketch('a');
    expect(getState().layerById['a'].opacity).toBe(0.4);
  });

  it('toggleSketch preserves existing low opacity', () => {
    const layer = makeLayer({ id: 'a', opacity: 0.6 });
    getState().addLayer(layer);
    getState().toggleSketch('a');
    expect(getState().layerById['a'].opacity).toBe(0.6);
  });

  it('toggleSketch updates updatedAt', () => {
    const layer = makeLayer({ id: 'a', updatedAt: '2020-01-01T00:00:00.000Z' });
    getState().addLayer(layer);
    getState().toggleSketch('a');
    expect(getState().layerById['a'].updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('toggleSketch is a no-op for missing layer', () => {
    getState().toggleSketch('nonexistent');
    expect(getState().layerById).toEqual({});
  });

  it('setSketchTint sets tint color in metadata', () => {
    const layer = makeLayer({ id: 'a' });
    getState().addLayer(layer);
    getState().setSketchTint('a', '#ff0000');
    expect(getState().layerById['a'].metadata).toEqual({ sketchTint: '#ff0000' });
  });

  it('setSketchTint clears tint when null', () => {
    const layer = makeLayer({ id: 'a', metadata: { sketchTint: '#ff0000', other: 42 } });
    getState().addLayer(layer);
    getState().setSketchTint('a', null);
    expect(getState().layerById['a'].metadata).toEqual({ other: 42 });
  });

  it('setSketchTint preserves other metadata', () => {
    const layer = makeLayer({ id: 'a', metadata: { customFlag: true } });
    getState().addLayer(layer);
    getState().setSketchTint('a', '#00ff00');
    expect(getState().layerById['a'].metadata).toEqual({
      customFlag: true,
      sketchTint: '#00ff00',
    });
  });
});

describe('sketch layer — export exclusion', () => {
  function makeBuffer(w: number, h: number, rgba: [number, number, number, number]): SpritePixelBuffer {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
    return { data, width: w, height: h };
  }

  it('flattenLayers skips sketch layers', () => {
    const layers: SpriteLayer[] = [
      { id: 'bg', name: 'BG', visible: true, index: 0 },
      { id: 'sketch', name: 'Sketch', visible: true, index: 1, sketch: true },
    ];
    const buffers: Record<string, SpritePixelBuffer> = {
      bg: makeBuffer(2, 2, [255, 0, 0, 255]),       // red
      sketch: makeBuffer(2, 2, [0, 0, 255, 255]),    // blue
    };
    const result = flattenLayers(layers, buffers, 2, 2);
    // Should only have red (BG), not blue (sketch)
    expect(result.data[0]).toBe(255); // R
    expect(result.data[1]).toBe(0);   // G
    expect(result.data[2]).toBe(0);   // B
    expect(result.data[3]).toBe(255); // A
  });

  it('flattenLayers includes non-sketch layers normally', () => {
    const layers: SpriteLayer[] = [
      { id: 'bg', name: 'BG', visible: true, index: 0 },
      { id: 'fg', name: 'FG', visible: true, index: 1 },
    ];
    const buffers: Record<string, SpritePixelBuffer> = {
      bg: makeBuffer(2, 2, [255, 0, 0, 255]),
      fg: makeBuffer(2, 2, [0, 255, 0, 255]),
    };
    const result = flattenLayers(layers, buffers, 2, 2);
    // FG (green) over BG (red) — green wins (fully opaque)
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(0);
  });

  it('flattenLayers skips hidden layers and sketch layers independently', () => {
    const layers: SpriteLayer[] = [
      { id: 'bg', name: 'BG', visible: true, index: 0 },
      { id: 'hidden', name: 'Hidden', visible: false, index: 1 },
      { id: 'sketch', name: 'Sketch', visible: true, index: 2, sketch: true },
    ];
    const buffers: Record<string, SpritePixelBuffer> = {
      bg: makeBuffer(1, 1, [100, 100, 100, 255]),
      hidden: makeBuffer(1, 1, [200, 200, 200, 255]),
      sketch: makeBuffer(1, 1, [50, 50, 50, 255]),
    };
    const result = flattenLayers(layers, buffers, 1, 1);
    // Only BG layer should contribute
    expect(result.data[0]).toBe(100);
  });

  it('sketch: false does not skip the layer', () => {
    const layers: SpriteLayer[] = [
      { id: 'a', name: 'A', visible: true, index: 0, sketch: false },
    ];
    const buffers: Record<string, SpritePixelBuffer> = {
      a: makeBuffer(1, 1, [42, 42, 42, 255]),
    };
    const result = flattenLayers(layers, buffers, 1, 1);
    expect(result.data[0]).toBe(42);
  });
});
