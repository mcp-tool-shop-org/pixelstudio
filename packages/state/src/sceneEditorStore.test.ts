import { describe, it, expect, beforeEach } from 'vitest';
import type { SceneAssetInstance } from '@glyphstudio/domain';
import { useSceneEditorStore } from './sceneEditorStore';
import { createEmptySceneHistoryState } from './sceneHistoryEngine';
import { resetProvenanceSequence } from './sceneProvenance';

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
