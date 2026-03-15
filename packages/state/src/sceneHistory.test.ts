import { describe, it, expect } from 'vitest';
import type { SceneAssetInstance } from '@glyphstudio/domain';
import {
  describeSceneHistoryOperation,
  isSceneHistoryChange,
  createSceneHistoryEntry,
  captureSceneSnapshot,
  ALL_SCENE_HISTORY_OPERATION_KINDS,
} from './sceneHistory';
import type {
  SceneHistoryOperationKind,
  SceneHistorySnapshot,
  SceneHistoryEntry,
} from './sceneHistory';

// ── Fixtures ──

const INST_ASSET: SceneAssetInstance = {
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

const INST_CHAR: SceneAssetInstance = {
  instanceId: 'i2',
  name: 'Knight',
  sourcePath: '',
  x: 30,
  y: 40,
  zOrder: 3,
  visible: true,
  opacity: 1.0,
  parallax: 1.0,
  instanceKind: 'character',
  sourceCharacterBuildId: 'build-1',
  sourceCharacterBuildName: 'Knight Build',
  characterSlotSnapshot: {
    slots: { head: 'helm-iron', torso: 'plate-steel' },
    equippedCount: 2,
    totalSlots: 12,
  },
};

const INST_CHAR_UNLINKED: SceneAssetInstance = {
  ...INST_CHAR,
  instanceId: 'i3',
  name: 'Rogue',
  characterLinkMode: 'unlinked',
  characterSlotSnapshot: {
    slots: { head: 'hood-leather', torso: 'vest-dark' },
    equippedCount: 2,
    totalSlots: 12,
  },
};

const INST_CHAR_WITH_OVERRIDES: SceneAssetInstance = {
  ...INST_CHAR,
  instanceId: 'i4',
  name: 'Paladin',
  characterOverrides: {
    head: { slot: 'head', mode: 'replace', replacementPartId: 'helm-gold' },
    torso: { slot: 'torso', mode: 'remove' },
  },
};

function snap(instances: SceneAssetInstance[]): SceneHistorySnapshot {
  return { instances };
}

// ── Contract tests: operation kinds ──

describe('SceneHistory — operation kinds', () => {
  it('ALL_SCENE_HISTORY_OPERATION_KINDS covers all reversible scene edits', () => {
    // Must include instance operations
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('add-instance');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('remove-instance');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('move-instance');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('set-instance-visibility');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('set-instance-opacity');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('set-instance-layer');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('set-instance-clip');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('set-instance-parallax');
    // Must include source relationship operations as distinct kinds
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('reapply-character-source');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('unlink-character-source');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('relink-character-source');
    // Must include override operations as distinct kinds
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('set-character-override');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('remove-character-override');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('clear-all-character-overrides');
    // Must include camera and playback
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('set-scene-camera');
    expect(ALL_SCENE_HISTORY_OPERATION_KINDS).toContain('set-scene-playback');
  });

  it('reapply, unlink, and relink are distinct operation kinds', () => {
    const sourceOps = ALL_SCENE_HISTORY_OPERATION_KINDS.filter((k) =>
      k.includes('character-source'),
    );
    expect(sourceOps).toHaveLength(3);
    expect(new Set(sourceOps).size).toBe(3);
  });

  it('set and remove override are distinct operation kinds', () => {
    const overrideOps = ALL_SCENE_HISTORY_OPERATION_KINDS.filter((k) =>
      k.includes('character-override'),
    );
    expect(overrideOps).toHaveLength(3);
    expect(new Set(overrideOps).size).toBe(3);
  });
});

// ── Contract tests: labels ──

describe('SceneHistory — describeSceneHistoryOperation', () => {
  it('every operation kind has a human-readable label', () => {
    for (const kind of ALL_SCENE_HISTORY_OPERATION_KINDS) {
      const label = describeSceneHistoryOperation(kind);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('source relationship operations have distinct labels', () => {
    const reapplyLabel = describeSceneHistoryOperation('reapply-character-source');
    const unlinkLabel = describeSceneHistoryOperation('unlink-character-source');
    const relinkLabel = describeSceneHistoryOperation('relink-character-source');
    const labels = new Set([reapplyLabel, unlinkLabel, relinkLabel]);
    expect(labels.size).toBe(3);
  });

  it('labels are operator-clear, not code-jargon', () => {
    expect(describeSceneHistoryOperation('unlink-character-source')).toBe('Unlink From Source');
    expect(describeSceneHistoryOperation('relink-character-source')).toBe('Relink To Source');
    expect(describeSceneHistoryOperation('reapply-character-source')).toBe('Reapply From Source');
    expect(describeSceneHistoryOperation('move-instance')).toBe('Move Instance');
  });
});

// ── No-op detection ──

describe('SceneHistory — isSceneHistoryChange', () => {
  it('identical snapshots are not a history change', () => {
    const before = snap([INST_ASSET, INST_CHAR]);
    const after = snap([INST_ASSET, INST_CHAR]);
    expect(isSceneHistoryChange(before, after)).toBe(false);
  });

  it('empty snapshots are not a history change', () => {
    expect(isSceneHistoryChange(snap([]), snap([]))).toBe(false);
  });

  it('position change is detected', () => {
    const before = snap([INST_ASSET]);
    const after = snap([{ ...INST_ASSET, x: 999 }]);
    expect(isSceneHistoryChange(before, after)).toBe(true);
  });

  it('characterLinkMode change is detected', () => {
    const before = snap([INST_CHAR]);
    const after = snap([{ ...INST_CHAR, characterLinkMode: 'unlinked' as const }]);
    expect(isSceneHistoryChange(before, after)).toBe(true);
  });

  it('override change is detected', () => {
    const before = snap([INST_CHAR]);
    const after = snap([{
      ...INST_CHAR,
      characterOverrides: { head: { slot: 'head', mode: 'replace' as const, replacementPartId: 'helm-gold' } },
    }]);
    expect(isSceneHistoryChange(before, after)).toBe(true);
  });

  it('instance added is detected', () => {
    const before = snap([INST_ASSET]);
    const after = snap([INST_ASSET, INST_CHAR]);
    expect(isSceneHistoryChange(before, after)).toBe(true);
  });

  it('instance removed is detected', () => {
    const before = snap([INST_ASSET, INST_CHAR]);
    const after = snap([INST_ASSET]);
    expect(isSceneHistoryChange(before, after)).toBe(true);
  });
});

// ── Entry creation ──

describe('SceneHistory — createSceneHistoryEntry', () => {
  it('creates entry with correct kind and label', () => {
    const before = snap([INST_CHAR]);
    const after = snap([{ ...INST_CHAR, x: 999 }]);
    const entry = createSceneHistoryEntry('move-instance', before, after, { instanceId: 'i2' });
    expect(entry).toBeDefined();
    expect(entry!.kind).toBe('move-instance');
    expect(entry!.label).toBe('Move Instance');
  });

  it('preserves before and after snapshots unchanged', () => {
    const before = snap([INST_CHAR]);
    const after = snap([{ ...INST_CHAR, x: 999 }]);
    const entry = createSceneHistoryEntry('move-instance', before, after);
    expect(entry!.before.instances[0].x).toBe(30);
    expect(entry!.after.instances[0].x).toBe(999);
  });

  it('returns undefined for no-op (identical snapshots)', () => {
    const s = snap([INST_ASSET]);
    const entry = createSceneHistoryEntry('move-instance', s, s);
    expect(entry).toBeUndefined();
  });

  it('attaches instance metadata', () => {
    const before = snap([INST_CHAR]);
    const after = snap([{ ...INST_CHAR, x: 100 }]);
    const entry = createSceneHistoryEntry('move-instance', before, after, { instanceId: 'i2' });
    expect(entry!.metadata).toEqual({ instanceId: 'i2' });
  });

  it('attaches override metadata with slotId', () => {
    const before = snap([INST_CHAR]);
    const after = snap([INST_CHAR_WITH_OVERRIDES]);
    const entry = createSceneHistoryEntry('set-character-override', before, after, {
      instanceId: 'i2',
      slotId: 'head',
    });
    expect(entry!.metadata).toEqual({ instanceId: 'i2', slotId: 'head' });
  });
});

// ── Snapshot capture ──

describe('SceneHistory — captureSceneSnapshot', () => {
  it('deep-clones instances (no aliasing)', () => {
    const instances = [INST_CHAR];
    const snapshot = captureSceneSnapshot(instances);
    // Mutate source — snapshot must not be affected
    instances[0] = { ...instances[0], x: 9999 };
    expect(snapshot.instances[0].x).toBe(30);
  });

  it('preserves all character fields through capture', () => {
    const snapshot = captureSceneSnapshot([INST_CHAR_WITH_OVERRIDES]);
    const inst = snapshot.instances[0];
    expect(inst.instanceKind).toBe('character');
    expect(inst.sourceCharacterBuildId).toBe('build-1');
    expect(inst.sourceCharacterBuildName).toBe('Knight Build');
    expect(inst.characterSlotSnapshot!.slots.head).toBe('helm-iron');
    expect(inst.characterSlotSnapshot!.equippedCount).toBe(2);
    expect(inst.characterOverrides!.head.mode).toBe('replace');
    expect(inst.characterOverrides!.head.replacementPartId).toBe('helm-gold');
    expect(inst.characterOverrides!.torso.mode).toBe('remove');
  });
});

// ── Snapshot integrity through entry creation ──

describe('SceneHistory — snapshot integrity', () => {
  it('characterLinkMode preserved in history entry', () => {
    const before = snap([INST_CHAR]);
    const after = snap([INST_CHAR_UNLINKED]);
    const entry = createSceneHistoryEntry('unlink-character-source', before, after)!;
    expect(entry.before.instances[0].characterLinkMode).toBeUndefined();
    expect(entry.after.instances[0].characterLinkMode).toBe('unlinked');
  });

  it('sourceCharacterBuildId preserved in history entry', () => {
    const before = snap([INST_CHAR]);
    const after = snap([{ ...INST_CHAR, characterLinkMode: 'unlinked' as const }]);
    const entry = createSceneHistoryEntry('unlink-character-source', before, after)!;
    expect(entry.before.instances[0].sourceCharacterBuildId).toBe('build-1');
    expect(entry.after.instances[0].sourceCharacterBuildId).toBe('build-1');
  });

  it('slot snapshot preserved in history entry', () => {
    const before = snap([INST_CHAR]);
    const reapplied = {
      ...INST_CHAR,
      characterSlotSnapshot: {
        slots: { head: 'helm-v2', torso: 'plate-v2', boots: 'greaves' },
        equippedCount: 3,
        totalSlots: 12,
      },
    };
    const after = snap([reapplied]);
    const entry = createSceneHistoryEntry('reapply-character-source', before, after)!;
    expect(entry.before.instances[0].characterSlotSnapshot!.equippedCount).toBe(2);
    expect(entry.after.instances[0].characterSlotSnapshot!.equippedCount).toBe(3);
    expect(entry.after.instances[0].characterSlotSnapshot!.slots.boots).toBe('greaves');
  });

  it('overrides preserved in history entry', () => {
    const before = snap([INST_CHAR]);
    const after = snap([INST_CHAR_WITH_OVERRIDES]);
    const entry = createSceneHistoryEntry('set-character-override', before, after)!;
    expect(entry.before.instances[0].characterOverrides).toBeUndefined();
    expect(entry.after.instances[0].characterOverrides!.head.mode).toBe('replace');
    expect(entry.after.instances[0].characterOverrides!.torso.mode).toBe('remove');
  });

  it('remove-mode override preserved in history entry', () => {
    const before = snap([INST_CHAR_WITH_OVERRIDES]);
    const after = snap([{
      ...INST_CHAR_WITH_OVERRIDES,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace' as const, replacementPartId: 'helm-gold' },
        // torso remove-override removed
      },
    }]);
    const entry = createSceneHistoryEntry('remove-character-override', before, after)!;
    expect(entry.before.instances[0].characterOverrides!.torso.mode).toBe('remove');
    expect(entry.after.instances[0].characterOverrides!.torso).toBeUndefined();
  });
});

// ── Metadata shape stability ──

describe('SceneHistory — metadata shape', () => {
  it('instance metadata is narrow (only instanceId)', () => {
    const meta = { instanceId: 'i1' };
    expect(Object.keys(meta)).toEqual(['instanceId']);
  });

  it('override metadata is narrow (instanceId + slotId)', () => {
    const meta = { instanceId: 'i1', slotId: 'head' };
    expect(Object.keys(meta)).toEqual(['instanceId', 'slotId']);
  });

  it('camera metadata is narrow (optional changedFields)', () => {
    const meta = { changedFields: ['x', 'y'] };
    expect(Object.keys(meta)).toEqual(['changedFields']);
  });

  it('metadata is optional — entry works without it', () => {
    const before = snap([INST_ASSET]);
    const after = snap([{ ...INST_ASSET, x: 999 }]);
    const entry = createSceneHistoryEntry('move-instance', before, after);
    expect(entry).toBeDefined();
    expect(entry!.metadata).toBeUndefined();
  });
});
