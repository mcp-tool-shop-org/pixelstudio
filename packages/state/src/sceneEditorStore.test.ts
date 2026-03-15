import { describe, it, expect, beforeEach } from 'vitest';
import type { SceneAssetInstance, SceneCamera } from '@glyphstudio/domain';
import { useSceneEditorStore } from './sceneEditorStore';
import { createEmptySceneHistoryState } from './sceneHistoryEngine';
import { resetProvenanceSequence } from './sceneProvenance';
import { deriveProvenanceDiff } from './sceneProvenanceDrilldown';
import type { SceneProvenanceDrilldownSource } from './sceneProvenanceDrilldown';

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

// ── Setup ──

beforeEach(() => {
  resetProvenanceSequence();
  useSceneEditorStore.setState({
    instances: [],
    history: createEmptySceneHistoryState(),
    provenance: [],
    drilldownBySequence: {},
    canUndo: false,
    canRedo: false,
  });
});

// ── Mutation wiring tests ──

describe('SceneEditorStore — mutation wiring', () => {
  it('applyEdit records move-instance', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }], { instanceId: 'i1' });
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].kind).toBe('move-instance');
  });

  it('applyEdit records unlink-character-source', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].kind).toBe('unlink-character-source');
  });

  it('applyEdit records relink-character-source', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_UNLINKED]);
    applyEdit('relink-character-source', [{ ...INST_CHAR_UNLINKED, characterLinkMode: undefined }], { instanceId: 'i3' });
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].kind).toBe('relink-character-source');
  });

  it('applyEdit records reapply-character-source', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    const reapplied = { ...INST_CHAR, characterSlotSnapshot: { slots: { head: 'helm-v2' }, equippedCount: 1, totalSlots: 12 } };
    applyEdit('reapply-character-source', [reapplied], { instanceId: 'i2' });
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].kind).toBe('reapply-character-source');
  });

  it('applyEdit records set-instance-parallax', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-parallax', [{ ...INST_ASSET, parallax: 0.5 }], { instanceId: 'i1' });
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].kind).toBe('set-instance-parallax');
  });

  it('applyEdit records set-character-override', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES], { instanceId: 'i4' });
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].kind).toBe('set-character-override');
  });

  it('applyEdit records remove-character-override', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const noOverrides = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyEdit('remove-character-override', [noOverrides], { instanceId: 'i4' });
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].kind).toBe('remove-character-override');
  });

  it('applyEdit records set-instance-visibility', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-visibility', [{ ...INST_ASSET, visible: false }], { instanceId: 'i1' });
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].kind).toBe('set-instance-visibility');
  });
});

// ── Failure / no-op tests ──

describe('SceneEditorStore — no-op and failure guards', () => {
  it('identical instances create no history entry', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [INST_ASSET]);
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(0);
  });

  it('loadInstances does not record history', () => {
    const { loadInstances } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadInstances([{ ...INST_ASSET, x: 999 }]);
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(0);
  });

  it('multiple loadInstances calls do not accumulate history', () => {
    const { loadInstances } = useSceneEditorStore.getState();
    for (let i = 0; i < 5; i++) {
      loadInstances([{ ...INST_ASSET, x: i }]);
    }
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(0);
    expect(history.future).toHaveLength(0);
  });
});

// ── Integrity tests ──

describe('SceneEditorStore — undo/redo integrity', () => {
  it('unlink then undo restores linked exactly', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }]);
    const restored = undo();
    expect(restored).toBeDefined();
    expect(restored!.instances[0].characterLinkMode).toBeUndefined();
    expect(restored!.instances[0].sourceCharacterBuildId).toBe('build-1');
  });

  it('relink then undo restores unlinked exactly', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_UNLINKED]);
    applyEdit('relink-character-source', [{ ...INST_CHAR_UNLINKED, characterLinkMode: undefined }]);
    const restored = undo();
    expect(restored).toBeDefined();
    expect(restored!.instances[0].characterLinkMode).toBe('unlinked');
  });

  it('reapply then undo restores prior snapshot exactly', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    const reapplied = {
      ...INST_CHAR,
      characterSlotSnapshot: {
        slots: { head: 'helm-v2', torso: 'plate-v2', boots: 'greaves' },
        equippedCount: 3,
        totalSlots: 12,
      },
    };
    applyEdit('reapply-character-source', [reapplied]);
    const restored = undo();
    expect(restored!.instances[0].characterSlotSnapshot!.equippedCount).toBe(2);
    expect(restored!.instances[0].characterSlotSnapshot!.slots.head).toBe('helm-iron');
  });

  it('override edit then undo restores prior override exactly', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES]);
    const restored = undo();
    expect(restored!.instances[0].characterOverrides).toBeUndefined();
  });

  it('remove-mode override survives full undo/redo cycle', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES]);
    undo();
    const redone = redo();
    expect(redone!.instances[0].characterOverrides!.torso.mode).toBe('remove');
    expect(redone!.instances[0].characterOverrides!.head.mode).toBe('replace');
    expect(redone!.instances[0].characterOverrides!.head.replacementPartId).toBe('helm-gold');
  });

  it('parallax survives undo/redo', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-parallax', [{ ...INST_ASSET, parallax: 0.5 }]);
    const undone = undo();
    expect(undone!.instances[0].parallax).toBe(1.0);
    const redone = redo();
    expect(redone!.instances[0].parallax).toBe(0.5);
  });

  it('instance transform survives undo/redo', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200, y: 300 }]);
    const undone = undo();
    expect(undone!.instances[0].x).toBe(50);
    expect(undone!.instances[0].y).toBe(100);
    const redone = redo();
    expect(redone!.instances[0].x).toBe(200);
    expect(redone!.instances[0].y).toBe(300);
  });

  it('source build id survives undo/redo', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }]);
    const undone = undo();
    expect(undone!.instances[0].sourceCharacterBuildId).toBe('build-1');
    expect(undone!.instances[0].sourceCharacterBuildName).toBe('Knight Build');
    const redone = redo();
    expect(redone!.instances[0].sourceCharacterBuildId).toBe('build-1');
  });
});

// ── canUndo / canRedo ──

describe('SceneEditorStore — canUndo / canRedo', () => {
  it('starts with canUndo=false, canRedo=false', () => {
    const { canUndo, canRedo } = useSceneEditorStore.getState();
    expect(canUndo).toBe(false);
    expect(canRedo).toBe(false);
  });

  it('canUndo=true after applyEdit', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  it('canRedo=true after undo', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    undo();
    expect(useSceneEditorStore.getState().canUndo).toBe(false);
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
  });

  it('canRedo=false after new forward edit post-undo', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    undo();
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });
});

// ── Undo/redo button behavior ──

describe('SceneEditorStore — undo/redo returns', () => {
  it('undo returns undefined when nothing to undo', () => {
    const { undo } = useSceneEditorStore.getState();
    expect(undo()).toBeUndefined();
  });

  it('redo returns undefined when nothing to redo', () => {
    const { redo } = useSceneEditorStore.getState();
    expect(redo()).toBeUndefined();
  });

  it('undo returns restored instances', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    const restored = undo();
    expect(restored).toBeDefined();
    expect(restored!.instances[0].x).toBe(50);
  });

  it('redo returns restored instances', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    undo();
    const restored = redo();
    expect(restored).toBeDefined();
    expect(restored!.instances[0].x).toBe(999);
  });

  it('undo updates store instances', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    expect(useSceneEditorStore.getState().instances[0].x).toBe(999);
    undo();
    expect(useSceneEditorStore.getState().instances[0].x).toBe(50);
  });
});

// ── resetHistory ──

describe('SceneEditorStore — resetHistory', () => {
  it('clears past and future', () => {
    const { loadInstances, applyEdit, undo, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    undo();
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
    resetHistory();
    expect(useSceneEditorStore.getState().canUndo).toBe(false);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  it('does not clear instances', () => {
    const { loadInstances, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET, INST_CHAR]);
    resetHistory();
    expect(useSceneEditorStore.getState().instances).toHaveLength(2);
  });
});

// ── Multi-step ──

describe('SceneEditorStore — multi-step undo/redo', () => {
  it('two edits undo in reverse order', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    const first = undo();
    expect(first!.instances[0].x).toBe(100);
    const second = undo();
    expect(second!.instances[0].x).toBe(50);
  });

  it('undo+redo+undo returns to correct state', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    undo(); // → x=100
    redo(); // → x=200
    const result = undo(); // → x=100
    expect(result!.instances[0].x).toBe(100);
  });
});

// ── Rollback tests ──

describe('SceneEditorStore — rollback', () => {
  it('undo returns rollback function', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    const result = undo();
    expect(result).toBeDefined();
    expect(typeof result!.rollback).toBe('function');
  });

  it('redo returns rollback function', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    undo();
    const result = redo();
    expect(result).toBeDefined();
    expect(typeof result!.rollback).toBe('function');
  });

  it('undo rollback restores pre-undo instances', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    const result = undo();
    // After undo, store is at x=50
    expect(useSceneEditorStore.getState().instances[0].x).toBe(50);
    // Rollback restores to x=999 (pre-undo state)
    result!.rollback();
    expect(useSceneEditorStore.getState().instances[0].x).toBe(999);
  });

  it('redo rollback restores pre-redo instances', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    undo();
    const result = redo();
    // After redo, store is at x=999
    expect(useSceneEditorStore.getState().instances[0].x).toBe(999);
    // Rollback restores to x=50 (pre-redo state)
    result!.rollback();
    expect(useSceneEditorStore.getState().instances[0].x).toBe(50);
  });

  it('undo rollback restores canUndo/canRedo', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
    const result = undo();
    expect(useSceneEditorStore.getState().canUndo).toBe(false);
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
    result!.rollback();
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  it('redo rollback restores canUndo/canRedo', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    undo();
    expect(useSceneEditorStore.getState().canUndo).toBe(false);
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
    const result = redo();
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
    result!.rollback();
    expect(useSceneEditorStore.getState().canUndo).toBe(false);
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
  });

  it('undo rollback restores history stacks', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    const histBefore = useSceneEditorStore.getState().history;
    const result = undo();
    // History changed after undo
    expect(useSceneEditorStore.getState().history).not.toBe(histBefore);
    result!.rollback();
    // History restored to exact pre-undo reference
    expect(useSceneEditorStore.getState().history).toBe(histBefore);
  });
});

// ── Mixed-chain reversibility ──

describe('SceneEditorStore — mixed-chain reversibility', () => {
  it('add → move → visibility → full undo chain restores original', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([]);
    // Add instance
    applyEdit('add-instance', [INST_ASSET], { instanceId: 'i1' });
    // Move it
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200, y: 300 }], { instanceId: 'i1' });
    // Hide it
    applyEdit('set-instance-visibility', [{ ...INST_ASSET, x: 200, y: 300, visible: false }], { instanceId: 'i1' });

    // Undo visibility → visible again at (200, 300)
    const r1 = undo();
    expect(r1!.instances[0].visible).toBe(true);
    expect(r1!.instances[0].x).toBe(200);

    // Undo move → back at (50, 100)
    const r2 = undo();
    expect(r2!.instances[0].x).toBe(50);
    expect(r2!.instances[0].y).toBe(100);

    // Undo add → empty scene
    const r3 = undo();
    expect(r3!.instances).toHaveLength(0);
  });

  it('mixed operations undo then redo restores forward state', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('set-instance-parallax', [{ ...INST_ASSET, x: 100, parallax: 0.5 }]);
    applyEdit('set-instance-visibility', [{ ...INST_ASSET, x: 100, parallax: 0.5, visible: false }]);

    // Undo all three
    undo();
    undo();
    undo();
    expect(useSceneEditorStore.getState().instances[0].x).toBe(50);
    expect(useSceneEditorStore.getState().instances[0].parallax).toBe(1.0);
    expect(useSceneEditorStore.getState().instances[0].visible).toBe(true);

    // Redo all three
    redo();
    redo();
    const r = redo();
    expect(r!.instances[0].x).toBe(100);
    expect(r!.instances[0].parallax).toBe(0.5);
    expect(r!.instances[0].visible).toBe(false);
  });

  it('character override then move then undo both restores cleanly', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES]);
    applyEdit('move-instance', [{ ...INST_CHAR_WITH_OVERRIDES, x: 500 }]);

    const r1 = undo();
    expect(r1!.instances[0].x).toBe(30); // original x from INST_CHAR_WITH_OVERRIDES
    expect(r1!.instances[0].characterOverrides).toBeDefined();

    const r2 = undo();
    expect(r2!.instances[0].characterOverrides).toBeUndefined();
    expect(r2!.instances[0].x).toBe(30);
  });
});

// ── History pollution tests ──

describe('SceneEditorStore — history pollution', () => {
  it('loadInstances after edits does not affect history', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    // Simulate periodic refresh — should not create history
    loadInstances([{ ...INST_ASSET, x: 100 }]);
    loadInstances([{ ...INST_ASSET, x: 100 }]);
    const { history } = useSceneEditorStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.future).toHaveLength(0);
  });

  it('loadInstances does not clear redo stack', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    undo();
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
    // Simulate periodic refresh
    loadInstances([INST_ASSET]);
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
  });

  it('resetHistory after loadInstances clears stacks but keeps instances', () => {
    const { loadInstances, applyEdit, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    loadInstances([{ ...INST_ASSET, x: 200 }]);
    resetHistory();
    expect(useSceneEditorStore.getState().instances[0].x).toBe(200);
    expect(useSceneEditorStore.getState().canUndo).toBe(false);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  it('identical applyEdit after undo does not create entry', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    undo();
    // Re-apply same state as current — should be no-op
    applyEdit('move-instance', [INST_ASSET]);
    expect(useSceneEditorStore.getState().history.past).toHaveLength(0);
  });
});

// ── Provenance append mechanics ──

describe('SceneEditorStore — provenance append', () => {
  it('successful edit appends one provenance entry', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }], { instanceId: 'i1' });
    const { provenance } = useSceneEditorStore.getState();
    expect(provenance).toHaveLength(1);
  });

  it('entry kind matches operation kind', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-visibility', [{ ...INST_ASSET, visible: false }], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().provenance[0].kind).toBe('set-instance-visibility');
  });

  it('entry metadata matches supplied metadata', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('entry has non-empty label', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    expect(useSceneEditorStore.getState().provenance[0].label.length).toBeGreaterThan(0);
  });

  it('entry has ISO timestamp', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    expect(useSceneEditorStore.getState().provenance[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('two edits append two entries in order', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('set-instance-parallax', [{ ...INST_ASSET, x: 100, parallax: 0.5 }]);
    const { provenance } = useSceneEditorStore.getState();
    expect(provenance).toHaveLength(2);
    expect(provenance[0].kind).toBe('move-instance');
    expect(provenance[1].kind).toBe('set-instance-parallax');
  });

  it('sequence is monotonic across edits', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 300 }]);
    const { provenance } = useSceneEditorStore.getState();
    expect(provenance[0].sequence).toBe(1);
    expect(provenance[1].sequence).toBe(2);
    expect(provenance[2].sequence).toBe(3);
  });
});

// ── Provenance no-op / failure guards ──

describe('SceneEditorStore — provenance guards', () => {
  it('no-op edit appends no provenance', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [INST_ASSET]); // identical — no-op
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  it('loadInstances appends no provenance', () => {
    const { loadInstances } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadInstances([{ ...INST_ASSET, x: 999 }]);
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  it('multiple loadInstances cycles append no provenance', () => {
    const { loadInstances } = useSceneEditorStore.getState();
    for (let i = 0; i < 5; i++) {
      loadInstances([{ ...INST_ASSET, x: i }]);
    }
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  it('identical applyEdit after undo appends no provenance', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    undo();
    applyEdit('move-instance', [INST_ASSET]); // same as current — no-op
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1); // only the first edit
  });
});

// ── Provenance and undo/redo ──

describe('SceneEditorStore — provenance vs undo/redo', () => {
  it('successful edit records both history and provenance', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    expect(useSceneEditorStore.getState().history.past).toHaveLength(1);
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);
  });

  it('undo does not append provenance', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);
    undo();
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);
  });

  it('redo does not append provenance', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    undo();
    redo();
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);
  });

  it('undo then new forward edit appends second provenance entry', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    undo();
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    const { provenance } = useSceneEditorStore.getState();
    expect(provenance).toHaveLength(2);
    expect(provenance[1].sequence).toBe(2);
  });
});

// ── Provenance operation coverage ──

describe('SceneEditorStore — provenance operation coverage', () => {
  it('add-instance appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([]);
    applyEdit('add-instance', [INST_ASSET], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('add-instance');
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('remove-instance appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('remove-instance', [], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('remove-instance');
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('move-instance appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('move-instance');
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('set-instance-visibility appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-visibility', [{ ...INST_ASSET, visible: false }], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('set-instance-visibility');
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('set-instance-opacity appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-opacity', [{ ...INST_ASSET, opacity: 0.5 }], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('set-instance-opacity');
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('set-instance-layer appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-layer', [{ ...INST_ASSET, zOrder: 5 }], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('set-instance-layer');
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('set-instance-clip appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-clip', [{ ...INST_ASSET, clipId: 'walk' }], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('set-instance-clip');
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('set-instance-parallax appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-parallax', [{ ...INST_ASSET, parallax: 0.5 }], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('set-instance-parallax');
    expect(entry.metadata).toEqual({ instanceId: 'i1' });
  });

  it('unlink-character-source appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('unlink-character-source');
    expect(entry.metadata).toEqual({ instanceId: 'i2' });
  });

  it('relink-character-source appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_UNLINKED]);
    applyEdit('relink-character-source', [{ ...INST_CHAR_UNLINKED, characterLinkMode: undefined }], { instanceId: 'i3' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('relink-character-source');
    expect(entry.metadata).toEqual({ instanceId: 'i3' });
  });

  it('reapply-character-source appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    const reapplied = { ...INST_CHAR, characterSlotSnapshot: { slots: { head: 'helm-v2' }, equippedCount: 1, totalSlots: 12 } };
    applyEdit('reapply-character-source', [reapplied], { instanceId: 'i2' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('reapply-character-source');
    expect(entry.metadata).toEqual({ instanceId: 'i2' });
  });

  it('set-character-override appends correct kind + instanceId + slotId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES], { instanceId: 'i2', slotId: 'head' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('set-character-override');
    expect(entry.metadata).toEqual({ instanceId: 'i2', slotId: 'head' });
  });

  it('remove-character-override appends correct kind + instanceId + slotId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const cleared = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: { torso: INST_CHAR_WITH_OVERRIDES.characterOverrides!.torso } };
    applyEdit('remove-character-override', [cleared], { instanceId: 'i4', slotId: 'head' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('remove-character-override');
    expect(entry.metadata).toEqual({ instanceId: 'i4', slotId: 'head' });
  });

  it('clear-all-character-overrides appends correct kind + instanceId', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const noOverrides = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyEdit('clear-all-character-overrides', [noOverrides], { instanceId: 'i4' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('clear-all-character-overrides');
    expect(entry.metadata).toEqual({ instanceId: 'i4' });
  });

  it('set-scene-camera appends correct kind + changedFields', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-scene-camera', [{ ...INST_ASSET, x: 10 }], { changedFields: ['x', 'zoom'] });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('set-scene-camera');
    expect(entry.metadata).toEqual({ changedFields: ['x', 'zoom'] });
  });
});

// ── Provenance distinctness ──

describe('SceneEditorStore — provenance distinctness', () => {
  it('unlink/relink/reapply produce different provenance labels', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    applyEdit('relink-character-source', [{ ...INST_CHAR, characterLinkMode: undefined }], { instanceId: 'i2' });
    const reapplied = { ...INST_CHAR, characterSlotSnapshot: { slots: { head: 'helm-v2' }, equippedCount: 1, totalSlots: 12 } };
    applyEdit('reapply-character-source', [reapplied], { instanceId: 'i2' });
    const { provenance } = useSceneEditorStore.getState();
    const labels = new Set(provenance.map((e) => e.label));
    expect(labels.size).toBe(3);
  });

  it('set/remove override produce different provenance labels', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES], { instanceId: 'i2', slotId: 'head' });
    const cleared = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyEdit('remove-character-override', [cleared], { instanceId: 'i4', slotId: 'head' });
    const { provenance } = useSceneEditorStore.getState();
    expect(provenance[0].label).not.toBe(provenance[1].label);
  });

  it('move-instance is not mislabeled as generic update', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('move-instance');
    expect(entry.label).toContain('Move');
  });

  it('remove-instance is not mislabeled as property change', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('remove-instance', [], { instanceId: 'i1' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect(entry.kind).toBe('remove-instance');
    expect(entry.label).toContain('Remove');
  });
});

// ── Provenance metadata integrity ──

describe('SceneEditorStore — provenance metadata integrity', () => {
  it('slotId preserved for override entries', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES], { instanceId: 'i2', slotId: 'head' });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect((entry.metadata as { slotId: string }).slotId).toBe('head');
  });

  it('changedFields preserved for camera entries', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-scene-camera', [{ ...INST_ASSET, x: 10 }], { changedFields: ['x', 'zoom'] });
    const entry = useSceneEditorStore.getState().provenance[0];
    expect((entry.metadata as { changedFields: string[] }).changedFields).toEqual(['x', 'zoom']);
  });

  it('instanceId preserved across all instance-targeted entries', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }], { instanceId: 'i1' });
    applyEdit('set-instance-visibility', [{ ...INST_ASSET, x: 100, visible: false }], { instanceId: 'i1' });
    applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 100, visible: false, opacity: 0.5 }], { instanceId: 'i1' });
    const { provenance } = useSceneEditorStore.getState();
    for (const entry of provenance) {
      expect((entry.metadata as { instanceId: string }).instanceId).toBe('i1');
    }
  });
});

// ── Provenance guard coverage per operation family ──

describe('SceneEditorStore — provenance guards per family', () => {
  it('no-op move appends nothing', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [INST_ASSET], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  it('no-op visibility change appends nothing', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-visibility', [INST_ASSET], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  it('no-op override change appends nothing', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR], { instanceId: 'i2', slotId: 'head' });
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  it('no-op unlink appends nothing', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_UNLINKED]);
    applyEdit('unlink-character-source', [INST_CHAR_UNLINKED], { instanceId: 'i3' });
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  it('successful edit then refresh cycle still has exactly one entry', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    // Simulate periodic refresh — loadInstances, not applyEdit
    loadInstances([{ ...INST_ASSET, x: 200 }]);
    loadInstances([{ ...INST_ASSET, x: 200 }]);
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);
  });
});

// ── Provenance reset ──

describe('SceneEditorStore — provenance reset', () => {
  it('resetHistory clears provenance', () => {
    const { loadInstances, applyEdit, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    expect(useSceneEditorStore.getState().provenance).toHaveLength(2);
    resetHistory();
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  it('resetHistory resets sequence counter', () => {
    const { loadInstances, applyEdit, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    resetHistory();
    // New edits after reset start at sequence 1
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 300 }]);
    expect(useSceneEditorStore.getState().provenance[0].sequence).toBe(1);
  });

  it('resetHistory does not clear instances', () => {
    const { loadInstances, applyEdit, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    resetHistory();
    expect(useSceneEditorStore.getState().instances).toHaveLength(1);
  });
});

// ── Drilldown capture — operation coverage ──

describe('SceneEditorStore — drilldown capture coverage', () => {
  function getDrilldown(seq: number): SceneProvenanceDrilldownSource | undefined {
    return useSceneEditorStore.getState().drilldownBySequence[seq];
  }

  it('add-instance captures afterInstance only', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([]);
    applyEdit('add-instance', [INST_ASSET], { instanceId: 'i1' });
    const src = getDrilldown(1);
    expect(src).toBeDefined();
    expect(src!.kind).toBe('add-instance');
    expect(src!.afterInstance?.instanceId).toBe('i1');
    expect(src!.beforeInstance).toBeUndefined();
  });

  it('remove-instance captures beforeInstance only', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('remove-instance', [], { instanceId: 'i1' });
    const src = getDrilldown(1);
    expect(src).toBeDefined();
    expect(src!.kind).toBe('remove-instance');
    expect(src!.beforeInstance?.instanceId).toBe('i1');
    expect(src!.afterInstance).toBeUndefined();
  });

  it('move-instance captures before and after target', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }], { instanceId: 'i1' });
    const src = getDrilldown(1);
    expect(src!.beforeInstance?.x).toBe(50);
    expect(src!.afterInstance?.x).toBe(999);
  });

  it('set-instance-visibility captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-visibility', [{ ...INST_ASSET, visible: false }], { instanceId: 'i1' });
    const src = getDrilldown(1);
    expect(src!.beforeInstance?.visible).toBe(true);
    expect(src!.afterInstance?.visible).toBe(false);
  });

  it('set-instance-opacity captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-opacity', [{ ...INST_ASSET, opacity: 0.5 }], { instanceId: 'i1' });
    const src = getDrilldown(1);
    expect(src!.beforeInstance?.opacity).toBe(1.0);
    expect(src!.afterInstance?.opacity).toBe(0.5);
  });

  it('set-instance-layer captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-layer', [{ ...INST_ASSET, zOrder: 5 }], { instanceId: 'i1' });
    const src = getDrilldown(1);
    expect(src!.beforeInstance?.zOrder).toBe(0);
    expect(src!.afterInstance?.zOrder).toBe(5);
  });

  it('set-instance-clip captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-clip', [{ ...INST_ASSET, clipId: 'clip-1' }], { instanceId: 'i1' });
    const src = getDrilldown(1);
    expect(src!.beforeInstance?.clipId).toBeUndefined();
    expect(src!.afterInstance?.clipId).toBe('clip-1');
  });

  it('set-instance-parallax captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-parallax', [{ ...INST_ASSET, parallax: 0.5 }], { instanceId: 'i1' });
    const src = getDrilldown(1);
    expect(src!.beforeInstance?.parallax).toBe(1.0);
    expect(src!.afterInstance?.parallax).toBe(0.5);
  });

  it('unlink-character-source captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    const src = getDrilldown(1);
    expect(src!.kind).toBe('unlink-character-source');
    expect(src!.beforeInstance?.characterLinkMode).toBeUndefined();
    expect(src!.afterInstance?.characterLinkMode).toBe('unlinked');
  });

  it('relink-character-source captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_UNLINKED]);
    applyEdit('relink-character-source', [{ ...INST_CHAR_UNLINKED, characterLinkMode: undefined }], { instanceId: 'i3' });
    const src = getDrilldown(1);
    expect(src!.kind).toBe('relink-character-source');
    expect(src!.beforeInstance?.characterLinkMode).toBe('unlinked');
  });

  it('reapply-character-source captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    const reapplied = { ...INST_CHAR, characterSlotSnapshot: { slots: { head: 'helm-v2' }, equippedCount: 1, totalSlots: 12 } };
    applyEdit('reapply-character-source', [reapplied], { instanceId: 'i2' });
    const src = getDrilldown(1);
    expect(src!.kind).toBe('reapply-character-source');
    expect(src!.beforeInstance?.characterSlotSnapshot?.slots.head).toBe('helm-iron');
    expect(src!.afterInstance?.characterSlotSnapshot?.slots.head).toBe('helm-v2');
  });

  it('set-character-override captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    const withOverride = {
      ...INST_CHAR,
      characterOverrides: { head: { slot: 'head', mode: 'replace' as const, replacementPartId: 'helm-gold' } },
    };
    applyEdit('set-character-override', [withOverride], { instanceId: 'i2', slotId: 'head' });
    const src = getDrilldown(1);
    expect(src!.kind).toBe('set-character-override');
    expect(src!.beforeInstance?.characterOverrides).toBeUndefined();
    expect(src!.afterInstance?.characterOverrides?.head?.replacementPartId).toBe('helm-gold');
  });

  it('remove-character-override captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const cleared = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: { torso: INST_CHAR_WITH_OVERRIDES.characterOverrides!.torso } };
    applyEdit('remove-character-override', [cleared], { instanceId: 'i4', slotId: 'head' });
    const src = getDrilldown(1);
    expect(src!.kind).toBe('remove-character-override');
    expect(src!.beforeInstance?.characterOverrides?.head).toBeDefined();
    expect(src!.afterInstance?.characterOverrides?.head).toBeUndefined();
  });

  it('clear-all-character-overrides captures before and after', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const noOverrides = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyEdit('clear-all-character-overrides', [noOverrides], { instanceId: 'i4' });
    const src = getDrilldown(1);
    expect(src!.kind).toBe('clear-all-character-overrides');
    expect(Object.keys(src!.beforeInstance?.characterOverrides ?? {})).toHaveLength(2);
    expect(src!.afterInstance?.characterOverrides).toBeUndefined();
  });
});

// ── Drilldown capture — keying / lookup ──

describe('SceneEditorStore — drilldown keying', () => {
  it('capture is stored under the correct provenance sequence', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    expect(provenance).toHaveLength(1);
    const seq = provenance[0].sequence;
    expect(drilldownBySequence[seq]).toBeDefined();
    expect(drilldownBySequence[seq].kind).toBe('move-instance');
  });

  it('multiple edits store multiple independent captures', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });
    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    expect(provenance).toHaveLength(2);
    const seq1 = provenance[0].sequence;
    const seq2 = provenance[1].sequence;
    expect(drilldownBySequence[seq1].kind).toBe('move-instance');
    expect(drilldownBySequence[seq2].kind).toBe('set-instance-opacity');
  });

  it('looking up one sequence does not return another edits slices', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    applyEdit('set-instance-visibility', [{ ...INST_ASSET, x: 200, visible: false }], { instanceId: 'i1' });
    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    const moveSrc = drilldownBySequence[provenance[0].sequence];
    const visSrc = drilldownBySequence[provenance[1].sequence];
    // Move source has the original position, visibility source has the moved position
    expect(moveSrc.beforeInstance?.x).toBe(50);
    expect(visSrc.beforeInstance?.x).toBe(200);
  });
});

// ── Drilldown capture — guard tests ──

describe('SceneEditorStore — drilldown guards', () => {
  it('failed/no-op edit stores no drilldown source', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    // No-op: same instances
    applyEdit('move-instance', [INST_ASSET], { instanceId: 'i1' });
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence)).toHaveLength(0);
  });

  it('undo stores no drilldown source', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    const countBefore = Object.keys(useSceneEditorStore.getState().drilldownBySequence).length;
    useSceneEditorStore.getState().undo();
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence).length).toBe(countBefore);
  });

  it('redo stores no drilldown source', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    useSceneEditorStore.getState().undo();
    const countBefore = Object.keys(useSceneEditorStore.getState().drilldownBySequence).length;
    useSceneEditorStore.getState().redo();
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence).length).toBe(countBefore);
  });

  it('loadInstances stores no drilldown source', () => {
    useSceneEditorStore.getState().loadInstances([INST_ASSET]);
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence)).toHaveLength(0);
  });

  it('refresh-only loadInstances cycle stores no drilldown source', () => {
    const { loadInstances } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadInstances([{ ...INST_ASSET, x: 999 }]);
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence)).toHaveLength(0);
  });
});

// ── Drilldown capture — reset ──

describe('SceneEditorStore — drilldown reset', () => {
  it('resetHistory clears drilldown source map', () => {
    const { loadInstances, applyEdit, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence).length).toBeGreaterThan(0);
    resetHistory();
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence)).toHaveLength(0);
  });

  it('resetHistory resets provenance sequence', () => {
    const { loadInstances, applyEdit, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    resetHistory();
    applyEdit('move-instance', [{ ...INST_ASSET, x: 300 }], { instanceId: 'i1' });
    const { provenance } = useSceneEditorStore.getState();
    // After reset, sequence restarts from 1
    expect(provenance[0].sequence).toBe(1);
  });

  it('resetHistory preserves current instances', () => {
    const { loadInstances, applyEdit, resetHistory } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    resetHistory();
    expect(useSceneEditorStore.getState().instances).toHaveLength(1);
  });
});

// ── Drilldown capture — derivation bridge ──

describe('SceneEditorStore — drilldown derivation bridge', () => {
  it('captured unlink source derives valid unlink drilldown', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    const src = drilldownBySequence[provenance[0].sequence];
    const diff = deriveProvenanceDiff(
      src.kind,
      src.beforeInstance ? [src.beforeInstance] : [],
      src.afterInstance ? [src.afterInstance] : [],
      src.metadata,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('unlink');
  });

  it('captured set-override source derives valid slot-aware drilldown', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    const withOverride = {
      ...INST_CHAR,
      characterOverrides: { head: { slot: 'head', mode: 'replace' as const, replacementPartId: 'helm-gold' } },
    };
    applyEdit('set-character-override', [withOverride], { instanceId: 'i2', slotId: 'head' });
    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    const src = drilldownBySequence[provenance[0].sequence];
    const diff = deriveProvenanceDiff(
      src.kind,
      src.beforeInstance ? [src.beforeInstance] : [],
      src.afterInstance ? [src.afterInstance] : [],
      src.metadata,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('set-override');
    if (diff!.type === 'set-override') {
      expect(diff!.slotId).toBe('head');
      expect(diff!.replacementPartId).toBe('helm-gold');
    }
  });

  it('captured clear-all source derives expected clear-all drilldown', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const noOverrides = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyEdit('clear-all-character-overrides', [noOverrides], { instanceId: 'i4' });
    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    const src = drilldownBySequence[provenance[0].sequence];
    const diff = deriveProvenanceDiff(
      src.kind,
      src.beforeInstance ? [src.beforeInstance] : [],
      src.afterInstance ? [src.afterInstance] : [],
      src.metadata,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('clear-all-overrides');
    if (diff!.type === 'clear-all-overrides') {
      expect(diff!.count).toBe(2);
      expect(diff!.clearedSlots).toContain('head');
      expect(diff!.clearedSlots).toContain('torso');
    }
  });
});

// ── Camera through applyEdit ──

describe('sceneEditorStore — camera through applyEdit', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };
  const CAM_C: SceneCamera = { x: -30, y: 80, zoom: 0.5 };

  beforeEach(() => {
    resetProvenanceSequence();
    useSceneEditorStore.setState({
      instances: [INST_ASSET],
      camera: undefined,
      history: createEmptySceneHistoryState(),
      provenance: [],
      drilldownBySequence: {},
      canUndo: false,
      canRedo: false,
    });
  });

  // ── loadCamera ──

  it('loadCamera sets camera without recording history', () => {
    const { loadCamera } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const state = useSceneEditorStore.getState();
    expect(state.camera).toEqual(CAM_A);
    expect(state.canUndo).toBe(false);
    expect(state.provenance).toHaveLength(0);
  });

  // ── applyEdit with camera ──

  it('applyEdit with nextCamera records camera in history and updates store camera', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    // Camera edit — instances differ to avoid no-op
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['x', 'y', 'zoom'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);
    const state = useSceneEditorStore.getState();
    expect(state.camera).toEqual(CAM_B);
    expect(state.canUndo).toBe(true);
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].kind).toBe('set-scene-camera');
  });

  it('applyEdit without nextCamera preserves existing camera', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 200 };
    applyEdit('move-instance', [movedInst], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_A);
  });

  it('camera-only no-op is skipped (identical instances, no camera change)', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    // Same instances, same camera — no-op
    applyEdit('set-scene-camera', [INST_ASSET], {
      changedFields: ['x'],
      beforeCamera: CAM_A,
      afterCamera: CAM_A,
    }, CAM_A);
    expect(useSceneEditorStore.getState().canUndo).toBe(false);
    expect(useSceneEditorStore.getState().provenance).toHaveLength(0);
  });

  // ── undo / redo with camera ──

  it('undo restores camera from before-snapshot', () => {
    const { loadCamera, applyEdit, undo } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['x', 'y', 'zoom'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_B);

    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();
    expect(result!.camera).toEqual(CAM_A);
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_A);
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
  });

  it('redo restores camera from after-snapshot', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['x', 'y', 'zoom'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);

    useSceneEditorStore.getState().undo();
    const result = useSceneEditorStore.getState().redo();
    expect(result).toBeDefined();
    expect(result!.camera).toEqual(CAM_B);
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_B);
  });

  it('undo rollback restores camera to pre-undo state', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['zoom'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);

    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();
    // Simulate backend failure — rollback
    result!.rollback();
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_B);
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
  });

  it('redo rollback restores camera to pre-redo state', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['zoom'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);

    useSceneEditorStore.getState().undo();
    const result = useSceneEditorStore.getState().redo();
    expect(result).toBeDefined();
    result!.rollback();
    // Should restore to pre-redo state (camera A, after undo)
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_A);
  });

  // ── instance-only undo returns no camera ──

  it('undo of instance-only edit returns undefined camera', () => {
    const { applyEdit } = useSceneEditorStore.getState();
    const movedInst = { ...INST_ASSET, x: 200 };
    applyEdit('move-instance', [movedInst], { instanceId: 'i1' });

    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();
    expect(result!.camera).toBeUndefined();
  });

  // ── multi-step camera history ──

  it('multiple camera edits create separate undo entries', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);

    // Edit 1: A → B
    const inst1 = { ...INST_ASSET, x: 111 };
    applyEdit('set-scene-camera', [inst1], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);

    // Edit 2: B → C
    useSceneEditorStore.getState().loadCamera(CAM_B);
    const inst2 = { ...INST_ASSET, x: 222 };
    useSceneEditorStore.getState().applyEdit('set-scene-camera', [inst2], {
      changedFields: ['zoom'],
      beforeCamera: CAM_B,
      afterCamera: CAM_C,
    }, CAM_C);

    expect(useSceneEditorStore.getState().provenance).toHaveLength(2);

    // Undo → back to B
    const r1 = useSceneEditorStore.getState().undo();
    expect(r1!.camera).toEqual(CAM_B);

    // Undo → back to A
    const r2 = useSceneEditorStore.getState().undo();
    expect(r2!.camera).toEqual(CAM_A);

    expect(useSceneEditorStore.getState().canUndo).toBe(false);
    expect(useSceneEditorStore.getState().canRedo).toBe(true);
  });

  // ── provenance + drilldown for camera ──

  it('camera applyEdit produces provenance entry with drilldown source including camera slices', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);

    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    expect(provenance).toHaveLength(1);
    const entry = provenance[0];
    expect(entry.kind).toBe('set-scene-camera');

    const src = drilldownBySequence[entry.sequence];
    expect(src).toBeDefined();
    expect(src.kind).toBe('set-scene-camera');
    expect(src.beforeCamera).toEqual(CAM_A);
    expect(src.afterCamera).toEqual(CAM_B);
    expect(src.beforeInstance).toBeUndefined();
    expect(src.afterInstance).toBeUndefined();
  });

  it('camera drilldown source stores exact before/after values from edit seam', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    const exactBefore: SceneCamera = { x: 42, y: 77, zoom: 1.5 };
    const exactAfter: SceneCamera = { x: 42, y: 77, zoom: 3.0 };
    loadCamera(exactBefore);
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['zoom'],
      beforeCamera: exactBefore,
      afterCamera: exactAfter,
    }, exactAfter);

    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    const src = drilldownBySequence[provenance[0].sequence];
    expect(src.beforeCamera!.x).toBe(42);
    expect(src.beforeCamera!.y).toBe(77);
    expect(src.beforeCamera!.zoom).toBe(1.5);
    expect(src.afterCamera!.zoom).toBe(3.0);
  });

  it('instance edit does not capture camera in drilldown source', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 200 };
    applyEdit('move-instance', [movedInst], { instanceId: 'i1' });

    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    const src = drilldownBySequence[provenance[0].sequence];
    expect(src.beforeCamera).toBeUndefined();
    expect(src.afterCamera).toBeUndefined();
    expect(src.beforeInstance).toBeDefined();
    expect(src.afterInstance).toBeDefined();
  });

  it('camera edit followed by instance edit yields separate clean captures', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    // Camera edit
    const inst1 = { ...INST_ASSET, x: 111 };
    applyEdit('set-scene-camera', [inst1], {
      changedFields: ['zoom'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);
    // Instance edit
    useSceneEditorStore.getState().applyEdit('move-instance', [{ ...INST_ASSET, x: 222 }], { instanceId: 'i1' });

    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    expect(provenance).toHaveLength(2);

    const cameraSrc = drilldownBySequence[provenance[0].sequence];
    expect(cameraSrc.beforeCamera).toEqual(CAM_A);
    expect(cameraSrc.afterCamera).toEqual(CAM_B);
    expect(cameraSrc.beforeInstance).toBeUndefined();

    const instSrc = drilldownBySequence[provenance[1].sequence];
    expect(instSrc.beforeCamera).toBeUndefined();
    expect(instSrc.afterCamera).toBeUndefined();
    expect(instSrc.beforeInstance).toBeDefined();
  });

  it('camera drilldown derives valid diff with exact values via bridge', () => {
    const { loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);

    const { provenance, drilldownBySequence } = useSceneEditorStore.getState();
    const src = drilldownBySequence[provenance[0].sequence];
    const diff = deriveProvenanceDiff(
      src.kind,
      src.beforeInstance ? [src.beforeInstance] : [],
      src.afterInstance ? [src.afterInstance] : [],
      src.metadata,
      src.beforeCamera,
      src.afterCamera,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('camera');
    if (diff!.type === 'camera') {
      expect(diff!.before).toEqual(CAM_A);
      expect(diff!.after).toEqual(CAM_B);
      expect(diff!.changedFields).toEqual(['x', 'y']);
    }
  });

  // ── resetHistory clears camera-related provenance ──

  it('resetHistory clears camera provenance and drilldown', () => {
    const { loadCamera, applyEdit, resetHistory } = useSceneEditorStore.getState();
    loadCamera(CAM_A);
    const movedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [movedInst], {
      changedFields: ['zoom'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);

    useSceneEditorStore.getState().resetHistory();
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(0);
    expect(Object.keys(state.drilldownBySequence)).toHaveLength(0);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });
});
