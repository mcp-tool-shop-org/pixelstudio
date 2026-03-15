import { describe, it, expect } from 'vitest';
import type {
  SceneAssetInstance,
  SceneCamera,
  PersistedSceneProvenanceEntry,
  PersistedSceneProvenanceDrilldownSource,
  PersistedSceneProvenanceDrilldownMap,
} from '@glyphstudio/domain';

// ── Fixtures ──

const INST: SceneAssetInstance = {
  instanceId: 'i1',
  name: 'Tree',
  sourcePath: '/assets/tree.pxs',
  x: 50,
  y: 100,
  zOrder: 0,
  visible: true,
  opacity: 1.0,
  parallax: 1.0,
};

const CAM_ORIGIN: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
const CAM_PANNED: SceneCamera = { x: 120, y: 80, zoom: 1.0 };

// ── Serialized shape tests ──

describe('Persisted provenance contract — serialized shape', () => {
  it('provenance entry includes all required fields', () => {
    const entry: PersistedSceneProvenanceEntry = {
      sequence: 1,
      kind: 'add-instance',
      label: 'Added Tree',
      timestamp: '2026-03-15T12:00:00Z',
    };
    expect(entry.sequence).toBe(1);
    expect(entry.kind).toBe('add-instance');
    expect(entry.label).toBe('Added Tree');
    expect(entry.timestamp).toBe('2026-03-15T12:00:00Z');
    expect(entry.metadata).toBeUndefined();
  });

  it('provenance entry with instance metadata', () => {
    const entry: PersistedSceneProvenanceEntry = {
      sequence: 2,
      kind: 'move-instance',
      label: 'Moved Tree',
      timestamp: '2026-03-15T12:01:00Z',
      metadata: { instanceId: 'i1' },
    };
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('provenance entry with camera metadata', () => {
    const entry: PersistedSceneProvenanceEntry = {
      sequence: 3,
      kind: 'set-scene-camera',
      label: 'Camera pan',
      timestamp: '2026-03-15T12:02:00Z',
      metadata: {
        changedFields: ['x', 'y'],
        beforeCamera: CAM_ORIGIN,
        afterCamera: CAM_PANNED,
      },
    };
    const meta = entry.metadata as { changedFields?: string[]; beforeCamera?: SceneCamera; afterCamera?: SceneCamera };
    expect(meta.changedFields).toEqual(['x', 'y']);
    expect(meta.beforeCamera).toEqual(CAM_ORIGIN);
    expect(meta.afterCamera).toEqual(CAM_PANNED);
  });

  it('drilldown source includes instance slices', () => {
    const source: PersistedSceneProvenanceDrilldownSource = {
      kind: 'move-instance',
      metadata: { instanceId: 'i1' },
      beforeInstance: { ...INST },
      afterInstance: { ...INST, x: 200, y: 300 },
    };
    expect(source.beforeInstance?.x).toBe(50);
    expect(source.afterInstance?.x).toBe(200);
    expect(source.beforeCamera).toBeUndefined();
    expect(source.afterCamera).toBeUndefined();
  });

  it('drilldown source includes camera slices', () => {
    const source: PersistedSceneProvenanceDrilldownSource = {
      kind: 'set-scene-camera',
      metadata: { changedFields: ['x', 'y'] },
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_PANNED,
    };
    expect(source.beforeCamera).toEqual(CAM_ORIGIN);
    expect(source.afterCamera).toEqual(CAM_PANNED);
    expect(source.beforeInstance).toBeUndefined();
    expect(source.afterInstance).toBeUndefined();
  });

  it('drilldown map uses string keys', () => {
    const map: PersistedSceneProvenanceDrilldownMap = {
      '1': {
        kind: 'add-instance',
        beforeInstance: undefined,
        afterInstance: { ...INST },
      },
      '2': {
        kind: 'move-instance',
        metadata: { instanceId: 'i1' },
        beforeInstance: { ...INST },
        afterInstance: { ...INST, x: 200 },
      },
    };
    expect(Object.keys(map)).toEqual(['1', '2']);
    expect(map['1'].kind).toBe('add-instance');
    expect(map['2'].afterInstance?.x).toBe(200);
  });
});

// ── JSON round-trip tests ──

describe('Persisted provenance contract — JSON round-trip', () => {
  it('provenance entries survive JSON serialization', () => {
    const entries: PersistedSceneProvenanceEntry[] = [
      { sequence: 1, kind: 'add-instance', label: 'Added Tree', timestamp: '2026-03-15T12:00:00Z' },
      { sequence: 2, kind: 'move-instance', label: 'Moved Tree', timestamp: '2026-03-15T12:01:00Z', metadata: { instanceId: 'i1' } },
    ];
    const json = JSON.stringify(entries);
    const parsed: PersistedSceneProvenanceEntry[] = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].sequence).toBe(1);
    expect(parsed[1].metadata).toEqual({ instanceId: 'i1' });
  });

  it('sequence and timestamp survive round-trip exactly', () => {
    const entry: PersistedSceneProvenanceEntry = {
      sequence: 42,
      kind: 'set-scene-camera',
      label: 'Camera pan',
      timestamp: '2026-03-15T08:30:45.123Z',
    };
    const parsed: PersistedSceneProvenanceEntry = JSON.parse(JSON.stringify(entry));
    expect(parsed.sequence).toBe(42);
    expect(parsed.timestamp).toBe('2026-03-15T08:30:45.123Z');
  });

  it('drilldown source with instance slices survives round-trip', () => {
    const source: PersistedSceneProvenanceDrilldownSource = {
      kind: 'move-instance',
      metadata: { instanceId: 'i1' },
      beforeInstance: { ...INST },
      afterInstance: { ...INST, x: 200, y: 300 },
    };
    const parsed: PersistedSceneProvenanceDrilldownSource = JSON.parse(JSON.stringify(source));
    expect(parsed.beforeInstance?.x).toBe(50);
    expect(parsed.afterInstance?.x).toBe(200);
    expect(parsed.afterInstance?.y).toBe(300);
  });

  it('drilldown source with camera slices survives round-trip', () => {
    const source: PersistedSceneProvenanceDrilldownSource = {
      kind: 'set-scene-camera',
      metadata: { changedFields: ['zoom'] },
      beforeCamera: CAM_ORIGIN,
      afterCamera: { x: 0, y: 0, zoom: 2.5 },
    };
    const parsed: PersistedSceneProvenanceDrilldownSource = JSON.parse(JSON.stringify(source));
    expect(parsed.beforeCamera?.zoom).toBe(1.0);
    expect(parsed.afterCamera?.zoom).toBe(2.5);
  });

  it('drilldown map survives round-trip with string keys', () => {
    const map: PersistedSceneProvenanceDrilldownMap = {
      '1': { kind: 'add-instance', afterInstance: { ...INST } },
      '3': { kind: 'set-scene-camera', beforeCamera: CAM_ORIGIN, afterCamera: CAM_PANNED },
    };
    const parsed: PersistedSceneProvenanceDrilldownMap = JSON.parse(JSON.stringify(map));
    expect(Object.keys(parsed)).toEqual(['1', '3']);
    expect(parsed['1'].afterInstance?.name).toBe('Tree');
    expect(parsed['3'].afterCamera?.x).toBe(120);
  });

  it('absent provenance fields default to empty on parse', () => {
    // Simulate a legacy scene document payload with no provenance
    const scenePayload = {
      sceneId: 's1',
      name: 'Test',
      canvasWidth: 320,
      canvasHeight: 240,
      instances: [],
      playback: { fps: 12, looping: true },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    const parsed = JSON.parse(JSON.stringify(scenePayload));
    // Absent fields should be undefined (frontend hydration will default to empty)
    expect(parsed.provenance).toBeUndefined();
    expect(parsed.provenanceDrilldown).toBeUndefined();
  });
});
