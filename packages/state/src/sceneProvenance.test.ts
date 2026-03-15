import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSceneProvenanceEntry,
  describeSceneProvenanceEntry,
  resetProvenanceSequence,
  peekProvenanceSequence,
} from './sceneProvenance';
import type { SceneProvenanceEntry } from './sceneProvenance';
import { ALL_SCENE_HISTORY_OPERATION_KINDS } from './sceneHistory';
import type { SceneHistoryOperationKind } from './sceneHistory';

beforeEach(() => {
  resetProvenanceSequence();
});

// ── Entry creation ──

describe('SceneProvenance — entry creation', () => {
  it('creates entry with correct kind', () => {
    const entry = createSceneProvenanceEntry('add-instance', { instanceId: 'i1' });
    expect(entry.kind).toBe('add-instance');
  });

  it('creates entry with monotonic sequence', () => {
    const e1 = createSceneProvenanceEntry('add-instance');
    const e2 = createSceneProvenanceEntry('move-instance');
    const e3 = createSceneProvenanceEntry('remove-instance');
    expect(e1.sequence).toBe(1);
    expect(e2.sequence).toBe(2);
    expect(e3.sequence).toBe(3);
  });

  it('creates entry with ISO timestamp', () => {
    const entry = createSceneProvenanceEntry('move-instance');
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('creates entry with label from operation kind', () => {
    const entry = createSceneProvenanceEntry('add-instance');
    expect(entry.label).toBe('Add Instance');
  });

  it('preserves instanceId metadata', () => {
    const entry = createSceneProvenanceEntry('move-instance', { instanceId: 'i1' });
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('preserves override metadata with slotId', () => {
    const entry = createSceneProvenanceEntry('set-character-override', {
      instanceId: 'i2',
      slotId: 'head',
    });
    expect(entry.metadata).toEqual({ instanceId: 'i2', slotId: 'head' });
  });

  it('preserves camera metadata', () => {
    const entry = createSceneProvenanceEntry('set-scene-camera', {
      changedFields: ['x', 'zoom'],
    });
    expect(entry.metadata).toEqual({ changedFields: ['x', 'zoom'] });
  });

  it('creates entry with undefined metadata when none provided', () => {
    const entry = createSceneProvenanceEntry('set-scene-playback');
    expect(entry.metadata).toBeUndefined();
  });
});

// ── Labels ──

describe('SceneProvenance — labels', () => {
  it('every operation kind has a non-empty label', () => {
    for (const kind of ALL_SCENE_HISTORY_OPERATION_KINDS) {
      const label = describeSceneProvenanceEntry(kind);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('unlink/relink/reapply have distinct labels', () => {
    const labels = new Set([
      describeSceneProvenanceEntry('unlink-character-source'),
      describeSceneProvenanceEntry('relink-character-source'),
      describeSceneProvenanceEntry('reapply-character-source'),
    ]);
    expect(labels.size).toBe(3);
  });

  it('label includes instanceId when metadata has instanceId', () => {
    const label = describeSceneProvenanceEntry('move-instance', { instanceId: 'tree-01' });
    expect(label).toContain('tree-01');
  });

  it('label includes slotId when metadata has slotId', () => {
    const label = describeSceneProvenanceEntry('set-character-override', {
      instanceId: 'i1',
      slotId: 'head',
    });
    expect(label).toContain('head');
  });

  it('label includes changed fields for camera edits', () => {
    const label = describeSceneProvenanceEntry('set-scene-camera', {
      changedFields: ['x', 'zoom'],
    });
    expect(label).toContain('x');
    expect(label).toContain('zoom');
  });

  it('label falls back to base when metadata is undefined', () => {
    const label = describeSceneProvenanceEntry('add-instance');
    expect(label).toBe('Add Instance');
  });

  it('add and remove have distinct labels', () => {
    expect(describeSceneProvenanceEntry('add-instance'))
      .not.toBe(describeSceneProvenanceEntry('remove-instance'));
  });

  it('label includes tick for keyframe metadata', () => {
    const label = describeSceneProvenanceEntry('add-camera-keyframe', { tick: 30 });
    expect(label).toContain('tick 30');
  });

  it('label includes previousTick for move keyframe', () => {
    const label = describeSceneProvenanceEntry('move-camera-keyframe', { tick: 60, previousTick: 30 });
    expect(label).toContain('tick 60');
    expect(label).toContain('tick 30');
  });

  it('label includes changedFields for edit keyframe', () => {
    const label = describeSceneProvenanceEntry('edit-camera-keyframe', { tick: 30, changedFields: ['zoom', 'x'] });
    expect(label).toContain('tick 30');
    expect(label).toContain('zoom');
    expect(label).toContain('x');
  });

  it('keyframe kinds have distinct labels', () => {
    const labels = new Set([
      describeSceneProvenanceEntry('add-camera-keyframe', { tick: 0 }),
      describeSceneProvenanceEntry('remove-camera-keyframe', { tick: 0 }),
      describeSceneProvenanceEntry('move-camera-keyframe', { tick: 0, previousTick: 10 }),
      describeSceneProvenanceEntry('edit-camera-keyframe', { tick: 0 }),
    ]);
    expect(labels.size).toBe(4);
  });
});

// ── Sequence mechanics ──

describe('SceneProvenance — sequence', () => {
  it('resetProvenanceSequence resets to 1', () => {
    createSceneProvenanceEntry('add-instance');
    createSceneProvenanceEntry('add-instance');
    expect(peekProvenanceSequence()).toBe(3);
    resetProvenanceSequence();
    expect(peekProvenanceSequence()).toBe(1);
  });

  it('first entry after reset is sequence 1', () => {
    createSceneProvenanceEntry('add-instance');
    resetProvenanceSequence();
    const entry = createSceneProvenanceEntry('move-instance');
    expect(entry.sequence).toBe(1);
  });

  it('sequence is strictly monotonic across mixed kinds', () => {
    const kinds: SceneHistoryOperationKind[] = [
      'add-instance',
      'unlink-character-source',
      'set-instance-parallax',
      'move-instance',
      'relink-character-source',
    ];
    const entries = kinds.map((k) => createSceneProvenanceEntry(k));
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].sequence).toBe(entries[i - 1].sequence + 1);
    }
  });
});

// ── Exhaustiveness ──

describe('SceneProvenance — exhaustiveness', () => {
  it('every operation kind produces a valid entry', () => {
    for (const kind of ALL_SCENE_HISTORY_OPERATION_KINDS) {
      const entry = createSceneProvenanceEntry(kind);
      expect(entry.kind).toBe(kind);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.sequence).toBeGreaterThan(0);
      expect(entry.timestamp.length).toBeGreaterThan(0);
    }
  });

  it('all 20 operation kinds are covered', () => {
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toHaveLength(20);
  });
});

// ── Type shape ──

describe('SceneProvenance — entry shape', () => {
  it('entry has all required fields', () => {
    const entry = createSceneProvenanceEntry('add-instance', { instanceId: 'i1' });
    const keys = Object.keys(entry);
    expect(keys).toContain('sequence');
    expect(keys).toContain('kind');
    expect(keys).toContain('label');
    expect(keys).toContain('timestamp');
    expect(keys).toContain('metadata');
  });

  it('entry satisfies SceneProvenanceEntry interface', () => {
    const entry: SceneProvenanceEntry = createSceneProvenanceEntry('move-instance');
    expect(entry.sequence).toBe(1);
    expect(typeof entry.kind).toBe('string');
    expect(typeof entry.label).toBe('string');
    expect(typeof entry.timestamp).toBe('string');
  });
});
