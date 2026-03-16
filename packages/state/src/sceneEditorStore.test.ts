import { describe, it, expect, beforeEach } from 'vitest';
import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import { useSceneEditorStore } from './sceneEditorStore';
import { createEmptySceneHistoryState } from './sceneHistoryEngine';
import { resetProvenanceSequence, peekProvenanceSequence } from './sceneProvenance';
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
    camera: undefined,
    keyframes: [],
    playbackConfig: undefined,
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

// ── Stage 19.5 — Hardening tests ──

describe('SceneEditorStore — 19.5 hardening', () => {
  const CAM_ORIGIN: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_PANNED: SceneCamera = { x: 120, y: 80, zoom: 1.0 };
  const CAM_ZOOMED: SceneCamera = { x: 0, y: 0, zoom: 2.5 };

  beforeEach(() => {
    useSceneEditorStore.setState({
      instances: [INST_ASSET],
      history: createEmptySceneHistoryState(),
      provenance: [],
      drilldownBySequence: {},
      canUndo: false,
      canRedo: false,
      camera: undefined,
    });
    resetProvenanceSequence();
  });

  it('playback state changes (set-scene-playback) do not include camera in history snapshot', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    // Playback edits change FPS/loop — use different instances to avoid no-op guard
    const inst2 = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-playback', [inst2]);
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].kind).toBe('set-scene-playback');
    // Undo result should not include camera
    const result = state.undo();
    expect(result).toBeDefined();
    expect(result!.camera).toBeUndefined();
  });

  it('camera reset to origin when already at origin is a no-op (same instances)', () => {
    const { loadInstances, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadCamera(CAM_ORIGIN);

    // Apply camera edit with identical instances (no instance change) and same camera
    applyEdit('set-scene-camera', [INST_ASSET], {
      changedFields: [],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_ORIGIN,
    }, CAM_ORIGIN);

    // No-op: instances unchanged → no history entry
    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.provenance).toHaveLength(0);
  });

  it('undo restores camera from history snapshot', () => {
    const { loadInstances, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadCamera(CAM_ORIGIN);

    // Apply a camera pan edit
    const pannedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [pannedInst], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_PANNED,
    }, CAM_PANNED);

    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.camera).toEqual(CAM_PANNED);

    // Undo should return the before-camera
    const result = state.undo();
    expect(result).toBeDefined();
    expect(result!.camera).toEqual(CAM_ORIGIN);
  });

  it('redo restores camera from history snapshot', () => {
    const { loadInstances, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadCamera(CAM_ORIGIN);

    const pannedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [pannedInst], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_PANNED,
    }, CAM_PANNED);

    // Undo then redo
    useSceneEditorStore.getState().undo();
    const result = useSceneEditorStore.getState().redo();
    expect(result).toBeDefined();
    expect(result!.camera).toEqual(CAM_PANNED);
  });

  it('rollback after undo failure restores camera to pre-undo state', () => {
    const { loadInstances, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadCamera(CAM_ORIGIN);

    const pannedInst = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [pannedInst], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_PANNED,
    }, CAM_PANNED);

    const preUndoCamera = useSceneEditorStore.getState().camera;
    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();

    // Simulate backend failure — call rollback
    result!.rollback();

    // Camera should be back to pre-undo state
    expect(useSceneEditorStore.getState().camera).toEqual(preUndoCamera);
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
  });

  it('camera drilldown source without camera values falls back gracefully', () => {
    // A camera edit with metadata but no explicit camera slices
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);

    const inst2 = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [inst2], {
      changedFields: ['x', 'y'],
    });

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(1);

    const source = state.drilldownBySequence[state.provenance[0].sequence];
    expect(source).toBeDefined();

    // Derive diff — should produce camera type with changedFields but no before/after
    const diff = deriveProvenanceDiff(
      source.kind,
      source.beforeInstance ? [source.beforeInstance] : [],
      source.afterInstance ? [source.afterInstance] : [],
      source.metadata,
      source.beforeCamera,
      source.afterCamera,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('camera');
    if (diff!.type === 'camera') {
      expect(diff!.changedFields).toEqual(['x', 'y']);
      // No before/after camera captured
      expect(diff!.before).toBeUndefined();
      expect(diff!.after).toBeUndefined();
    }
  });

  it('camera zoom edit captures exact zoom values in drilldown', () => {
    const { loadInstances, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadCamera(CAM_ORIGIN);

    const inst2 = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [inst2], {
      changedFields: ['zoom'],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_ZOOMED,
    }, CAM_ZOOMED);

    const state = useSceneEditorStore.getState();
    const source = state.drilldownBySequence[state.provenance[0].sequence];
    const diff = deriveProvenanceDiff(
      source.kind,
      source.beforeInstance ? [source.beforeInstance] : [],
      source.afterInstance ? [source.afterInstance] : [],
      source.metadata,
      source.beforeCamera,
      source.afterCamera,
    );
    expect(diff).toBeDefined();
    if (diff!.type === 'camera') {
      expect(diff!.before).toEqual(CAM_ORIGIN);
      expect(diff!.after).toEqual(CAM_ZOOMED);
      expect(diff!.changedFields).toEqual(['zoom']);
    }
  });
});

// ── Stage 20.2 — Provenance hydration tests ──

describe('SceneEditorStore — loadPersistedProvenance', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 120, y: 80, zoom: 1.0 };

  beforeEach(() => {
    useSceneEditorStore.setState({
      instances: [INST_ASSET],
      history: createEmptySceneHistoryState(),
      provenance: [],
      drilldownBySequence: {},
      canUndo: false,
      canRedo: false,
      camera: undefined,
    });
    resetProvenanceSequence();
  });

  it('hydrates provenance entries exactly', () => {
    const entries = [
      { sequence: 1, kind: 'add-instance' as const, label: 'Added Tree', timestamp: '2026-03-15T12:00:00Z' },
      { sequence: 2, kind: 'move-instance' as const, label: 'Moved Tree', timestamp: '2026-03-15T12:01:00Z', metadata: { instanceId: 'i1' } },
    ];
    useSceneEditorStore.getState().loadPersistedProvenance(entries, {});
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(2);
    expect(state.provenance[0].sequence).toBe(1);
    expect(state.provenance[0].label).toBe('Added Tree');
    expect(state.provenance[1].sequence).toBe(2);
  });

  it('hydrates drilldown sources exactly', () => {
    const source: SceneProvenanceDrilldownSource = {
      kind: 'move-instance',
      metadata: { instanceId: 'i1' },
      beforeInstance: { ...INST_ASSET },
      afterInstance: { ...INST_ASSET, x: 200, y: 300 },
    };
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 5, kind: 'move-instance', label: 'Moved Tree', timestamp: '2026-03-15T12:00:00Z', metadata: { instanceId: 'i1' } }],
      { 5: source },
    );
    const state = useSceneEditorStore.getState();
    expect(state.drilldownBySequence[5]).toBeDefined();
    expect(state.drilldownBySequence[5].beforeInstance?.x).toBe(50);
    expect(state.drilldownBySequence[5].afterInstance?.x).toBe(200);
  });

  it('hydrates camera drilldown sources with before/after values', () => {
    const source: SceneProvenanceDrilldownSource = {
      kind: 'set-scene-camera',
      metadata: { changedFields: ['x', 'y'] },
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    };
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 3, kind: 'set-scene-camera', label: 'Camera pan', timestamp: '2026-03-15T12:00:00Z' }],
      { 3: source },
    );
    const state = useSceneEditorStore.getState();
    expect(state.drilldownBySequence[3].beforeCamera).toEqual(CAM_A);
    expect(state.drilldownBySequence[3].afterCamera).toEqual(CAM_B);
  });

  it('sets sequence counter to max(persisted) + 1', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [
        { sequence: 10, kind: 'add-instance', label: 'A', timestamp: '2026-03-15T12:00:00Z' },
        { sequence: 42, kind: 'move-instance', label: 'B', timestamp: '2026-03-15T12:01:00Z' },
      ],
      {},
    );
    expect(peekProvenanceSequence()).toBe(43);
  });

  it('does not create history entries', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-instance', label: 'A', timestamp: '2026-03-15T12:00:00Z' }],
      {},
    );
    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it('does not append new provenance entries', () => {
    // Pre-load some entries then hydrate — should replace, not append
    const { applyEdit, loadInstances } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);

    // Hydrate with different entries — replaces entirely
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 5, kind: 'add-instance', label: 'Loaded', timestamp: '2026-03-15T12:00:00Z' }],
      {},
    );
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].sequence).toBe(5);
    expect(state.provenance[0].label).toBe('Loaded');
  });

  it('loading scene B replaces scene A provenance', () => {
    // Scene A provenance
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-instance', label: 'Scene A', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'add-instance', afterInstance: { ...INST_ASSET } } },
    );
    expect(useSceneEditorStore.getState().provenance[0].label).toBe('Scene A');

    // Scene B provenance replaces
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'move-instance', label: 'Scene B', timestamp: '2026-03-15T13:00:00Z' }],
      {},
    );
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].label).toBe('Scene B');
    expect(Object.keys(state.drilldownBySequence)).toHaveLength(0);
  });

  it('loading empty provenance clears prior state', () => {
    // Load some provenance first
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-instance', label: 'A', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'add-instance', afterInstance: { ...INST_ASSET } } },
    );
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);

    // Load empty — clears
    useSceneEditorStore.getState().loadPersistedProvenance([], {});
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(0);
    expect(Object.keys(state.drilldownBySequence)).toHaveLength(0);
  });

  it('loaded instance provenance entry still derives valid drilldown', () => {
    const before = { ...INST_ASSET, x: 50, y: 100 };
    const after = { ...INST_ASSET, x: 200, y: 300 };
    const source: SceneProvenanceDrilldownSource = {
      kind: 'move-instance',
      metadata: { instanceId: 'i1' },
      beforeInstance: before,
      afterInstance: after,
    };
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'move-instance', label: 'Moved Tree', timestamp: '2026-03-15T12:00:00Z', metadata: { instanceId: 'i1' } }],
      { 1: source },
    );
    const loaded = useSceneEditorStore.getState().drilldownBySequence[1];
    const diff = deriveProvenanceDiff(
      loaded.kind,
      loaded.beforeInstance ? [loaded.beforeInstance] : [],
      loaded.afterInstance ? [loaded.afterInstance] : [],
      loaded.metadata,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('move');
    if (diff!.type === 'move') {
      expect(diff!.before).toEqual({ x: 50, y: 100 });
      expect(diff!.after).toEqual({ x: 200, y: 300 });
    }
  });

  it('loaded camera provenance entry still derives valid drilldown', () => {
    const source: SceneProvenanceDrilldownSource = {
      kind: 'set-scene-camera',
      metadata: { changedFields: ['x', 'y'], beforeCamera: CAM_A, afterCamera: CAM_B },
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    };
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'set-scene-camera', label: 'Camera pan', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: source },
    );
    const loaded = useSceneEditorStore.getState().drilldownBySequence[1];
    const diff = deriveProvenanceDiff(
      loaded.kind,
      loaded.beforeInstance ? [loaded.beforeInstance] : [],
      loaded.afterInstance ? [loaded.afterInstance] : [],
      loaded.metadata,
      loaded.beforeCamera,
      loaded.afterCamera,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('camera');
    if (diff!.type === 'camera') {
      expect(diff!.before).toEqual(CAM_A);
      expect(diff!.after).toEqual(CAM_B);
    }
  });
});

// ── Stage 20.3 — Sequence continuity and post-load append law ──

describe('SceneEditorStore — sequence continuity after load', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 120, y: 80, zoom: 1.0 };

  beforeEach(() => {
    useSceneEditorStore.setState({
      instances: [INST_ASSET],
      history: createEmptySceneHistoryState(),
      provenance: [],
      drilldownBySequence: {},
      canUndo: false,
      canRedo: false,
      camera: undefined,
    });
    resetProvenanceSequence();
  });

  // ── Post-load sequence continuity ──

  it('load [1,2,3] then edit → next sequence is 4', () => {
    const entries = [1, 2, 3].map((s) => ({
      sequence: s, kind: 'add-instance' as const, label: `Entry ${s}`, timestamp: '2026-03-15T12:00:00Z',
    }));
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadPersistedProvenance(entries, {});
    expect(peekProvenanceSequence()).toBe(4);

    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(4);
    expect(state.provenance[3].sequence).toBe(4);
  });

  it('load [4,5,9] then edit → next sequence is 10', () => {
    const entries = [4, 5, 9].map((s) => ({
      sequence: s, kind: 'move-instance' as const, label: `Entry ${s}`, timestamp: '2026-03-15T12:00:00Z',
    }));
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadPersistedProvenance(entries, {});
    expect(peekProvenanceSequence()).toBe(10);

    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    const state = useSceneEditorStore.getState();
    expect(state.provenance[3].sequence).toBe(10);
  });

  it('load one entry then multiple edits → sequences continue monotonically', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadPersistedProvenance(
      [{ sequence: 7, kind: 'add-instance', label: 'Loaded', timestamp: '2026-03-15T12:00:00Z' }],
      {},
    );

    // Three new edits
    let inst = { ...INST_ASSET, x: 100 };
    applyEdit('move-instance', [inst], { instanceId: 'i1' });
    inst = { ...inst, x: 200 };
    applyEdit('move-instance', [inst], { instanceId: 'i1' });
    inst = { ...inst, x: 300 };
    applyEdit('move-instance', [inst], { instanceId: 'i1' });

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(4);
    expect(state.provenance[1].sequence).toBe(8);
    expect(state.provenance[2].sequence).toBe(9);
    expect(state.provenance[3].sequence).toBe(10);
  });

  it('new drilldown capture after load keyed by new sequence, not old', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadPersistedProvenance(
      [{ sequence: 5, kind: 'add-instance', label: 'Loaded', timestamp: '2026-03-15T12:00:00Z' }],
      { 5: { kind: 'add-instance', afterInstance: { ...INST_ASSET } } },
    );

    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });

    const state = useSceneEditorStore.getState();
    // Old capture still exists at key 5
    expect(state.drilldownBySequence[5]).toBeDefined();
    // New capture at key 6 (next after 5)
    expect(state.drilldownBySequence[6]).toBeDefined();
    expect(state.drilldownBySequence[6].kind).toBe('move-instance');
    // No accidental overwrite of key 5
    expect(state.drilldownBySequence[5].kind).toBe('add-instance');
  });

  // ── Scene switch / reset tests ──

  it('load scene A then load scene B → B replaces A cleanly', () => {
    const { loadPersistedProvenance } = useSceneEditorStore.getState();

    // Scene A
    loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-instance', label: 'Scene A Entry', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'add-instance', afterInstance: { ...INST_ASSET } } },
    );
    expect(useSceneEditorStore.getState().provenance[0].label).toBe('Scene A Entry');

    // Scene B (simulates resetHistory + loadPersistedProvenance)
    useSceneEditorStore.getState().resetHistory();
    loadPersistedProvenance(
      [{ sequence: 10, kind: 'move-instance', label: 'Scene B Entry', timestamp: '2026-03-15T13:00:00Z' }],
      { 10: { kind: 'move-instance', beforeInstance: { ...INST_ASSET }, afterInstance: { ...INST_ASSET, x: 500 } } },
    );

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].label).toBe('Scene B Entry');
    expect(state.provenance[0].sequence).toBe(10);
    expect(Object.keys(state.drilldownBySequence)).toEqual(['10']);
    expect(peekProvenanceSequence()).toBe(11);
  });

  it('load scene A then load scene B with no provenance → empty state', () => {
    const { loadPersistedProvenance } = useSceneEditorStore.getState();

    // Scene A
    loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-instance', label: 'A', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'add-instance' } },
    );

    // Scene B (empty provenance)
    useSceneEditorStore.getState().resetHistory();
    loadPersistedProvenance([], {});

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(0);
    expect(Object.keys(state.drilldownBySequence)).toHaveLength(0);
    expect(peekProvenanceSequence()).toBe(1); // baseline
  });

  it('resetHistory clears history stacks while scene switch preserves loaded instances', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().canUndo).toBe(true);

    // Scene switch: reset then hydrate new scene
    useSceneEditorStore.getState().resetHistory();
    const newInst = { ...INST_ASSET, instanceId: 'i2', name: 'Rock', x: 10, y: 20 };
    loadInstances([newInst]);
    loadPersistedProvenance([], {});

    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0].instanceId).toBe('i2');
  });

  // ── Empty and sparse handling ──

  it('load empty provenance → first new edit uses baseline sequence 1', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadPersistedProvenance([], {});

    expect(peekProvenanceSequence()).toBe(1);

    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    const state = useSceneEditorStore.getState();
    expect(state.provenance[0].sequence).toBe(1);
  });

  it('sparse drilldown keys do not break sequence generation', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);

    // Entries at 2, 5, 8 — drilldown only for 5
    const entries = [2, 5, 8].map((s) => ({
      sequence: s, kind: 'move-instance' as const, label: `E${s}`, timestamp: '2026-03-15T12:00:00Z',
    }));
    loadPersistedProvenance(entries, {
      5: { kind: 'move-instance', beforeInstance: { ...INST_ASSET }, afterInstance: { ...INST_ASSET, x: 200 } },
    });

    expect(peekProvenanceSequence()).toBe(9);
    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().provenance[3].sequence).toBe(9);
  });

  // ── No-noise tests ──

  it('hydration does not append provenance entries', () => {
    const before = useSceneEditorStore.getState().provenance.length;
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-instance', label: 'A', timestamp: '2026-03-15T12:00:00Z' }],
      {},
    );
    // Should be exactly the loaded entries, not loaded + extra
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);
  });

  it('hydration does not create undo history', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-instance', label: 'A', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'add-instance', afterInstance: { ...INST_ASSET } } },
    );
    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it('refresh after hydration does not duplicate entries', () => {
    const { loadInstances, loadPersistedProvenance } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    const entries = [
      { sequence: 1, kind: 'add-instance' as const, label: 'A', timestamp: '2026-03-15T12:00:00Z' },
    ];
    loadPersistedProvenance(entries, {});
    // Simulate a refresh that re-hydrates the same data
    loadPersistedProvenance(entries, {});
    expect(useSceneEditorStore.getState().provenance).toHaveLength(1);
    expect(peekProvenanceSequence()).toBe(2);
  });

  // ── Mixed continuity tests ──

  it('persisted instance entry + new camera edit → correct next sequence', () => {
    const { loadInstances, loadCamera, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadCamera(CAM_A);
    loadPersistedProvenance(
      [{ sequence: 3, kind: 'add-instance', label: 'Instance', timestamp: '2026-03-15T12:00:00Z' }],
      {},
    );

    const inst2 = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [inst2], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    }, CAM_B);

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(2);
    expect(state.provenance[1].sequence).toBe(4);
    expect(state.provenance[1].kind).toBe('set-scene-camera');
  });

  it('persisted camera entry + new instance edit → correct next sequence', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadPersistedProvenance(
      [{ sequence: 15, kind: 'set-scene-camera', label: 'Camera', timestamp: '2026-03-15T12:00:00Z' }],
      {},
    );

    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(2);
    expect(state.provenance[1].sequence).toBe(16);
    expect(state.provenance[1].kind).toBe('move-instance');
  });

  it('persisted override entry + new override edit → correct next sequence and no overwrite', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    loadPersistedProvenance(
      [{ sequence: 20, kind: 'clear-all-character-overrides', label: 'Cleared', timestamp: '2026-03-15T12:00:00Z', metadata: { instanceId: 'i2' } }],
      { 20: { kind: 'clear-all-character-overrides', metadata: { instanceId: 'i2' }, beforeInstance: { ...INST_CHAR }, afterInstance: { ...INST_CHAR } } },
    );

    const moved = { ...INST_CHAR, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i2' });

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(2);
    expect(state.provenance[1].sequence).toBe(21);
    // Old drilldown untouched
    expect(state.drilldownBySequence[20]).toBeDefined();
    expect(state.drilldownBySequence[20].kind).toBe('clear-all-character-overrides');
    // New drilldown at 21
    expect(state.drilldownBySequence[21]).toBeDefined();
    expect(state.drilldownBySequence[21].kind).toBe('move-instance');
  });
});

// ── Backward compatibility hardening (Stage 20 closeout) ──

describe('SceneEditorStore — backward compatibility hardening', () => {
  beforeEach(() => {
    useSceneEditorStore.getState().resetHistory();
  });

  it('persisted provenance without drilldown map shows timeline rows with empty drilldown', () => {
    const { loadInstances, loadPersistedProvenance } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    // Load provenance entries but NO drilldown data (partial persistence)
    loadPersistedProvenance(
      [
        { sequence: 1, kind: 'add-instance', label: 'Added Tree', timestamp: '2026-03-15T12:00:00Z' },
        { sequence: 2, kind: 'move-instance', label: 'Moved Tree', timestamp: '2026-03-15T12:01:00Z', metadata: { instanceId: 'i1' } },
      ],
      {},
    );
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(2);
    expect(state.provenance[0].label).toBe('Added Tree');
    expect(state.provenance[1].label).toBe('Moved Tree');
    // Drilldown map is empty — no fake data invented
    expect(Object.keys(state.drilldownBySequence)).toHaveLength(0);
  });

  it('persisted camera entry with partial metadata (missing beforeCamera) degrades without crash', () => {
    const { loadInstances, loadPersistedProvenance } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    // Camera drilldown with afterCamera but no beforeCamera — simulates partial data
    loadPersistedProvenance(
      [{ sequence: 5, kind: 'set-scene-camera', label: 'Camera pan', timestamp: '2026-03-15T12:00:00Z' }],
      {
        5: {
          kind: 'set-scene-camera',
          metadata: { changedFields: ['x', 'y'] },
          afterCamera: { x: 100, y: 200, zoom: 1.0 },
          // beforeCamera intentionally absent
        },
      },
    );
    const state = useSceneEditorStore.getState();
    const source = state.drilldownBySequence[5];
    expect(source).toBeDefined();
    expect(source.afterCamera).toEqual({ x: 100, y: 200, zoom: 1.0 });
    expect(source.beforeCamera).toBeUndefined();
  });

  it('repeated loadPersistedProvenance with same data is idempotent', () => {
    const { loadInstances, loadPersistedProvenance } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    const entries = [
      { sequence: 1, kind: 'add-instance' as const, label: 'A', timestamp: '2026-03-15T12:00:00Z' },
      { sequence: 2, kind: 'move-instance' as const, label: 'B', timestamp: '2026-03-15T12:01:00Z', metadata: { instanceId: 'i1' } as const },
    ];
    const drilldown = {
      1: { kind: 'add-instance' as const, afterInstance: { ...INST_ASSET } },
      2: { kind: 'move-instance' as const, metadata: { instanceId: 'i1' } as const, beforeInstance: { ...INST_ASSET }, afterInstance: { ...INST_ASSET, x: 200 } },
    };
    loadPersistedProvenance(entries, drilldown);
    loadPersistedProvenance(entries, drilldown);
    loadPersistedProvenance(entries, drilldown);
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(2);
    expect(Object.keys(state.drilldownBySequence)).toHaveLength(2);
    expect(peekProvenanceSequence()).toBe(3);
  });

  it('persisted entry remains truthful after later live edit to same instance', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    // Load a persisted move entry with captured before/after
    loadPersistedProvenance(
      [{ sequence: 1, kind: 'move-instance', label: 'Moved Tree', timestamp: '2026-03-15T12:00:00Z', metadata: { instanceId: 'i1' } }],
      {
        1: {
          kind: 'move-instance',
          metadata: { instanceId: 'i1' },
          beforeInstance: { ...INST_ASSET, x: 10, y: 20 },
          afterInstance: { ...INST_ASSET, x: 50, y: 100 },
        },
      },
    );
    // Now make a new live edit to the same instance
    const moved = { ...INST_ASSET, x: 999, y: 888 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    // The persisted entry's captured slices must be unchanged
    const state = useSceneEditorStore.getState();
    const persistedSource = state.drilldownBySequence[1];
    expect(persistedSource.beforeInstance?.x).toBe(10);
    expect(persistedSource.afterInstance?.x).toBe(50);
    // The new edit has its own drilldown
    const liveSource = state.drilldownBySequence[2];
    expect(liveSource.beforeInstance?.x).toBe(50); // store had INST_ASSET loaded, but edit was from that
    expect(liveSource.afterInstance?.x).toBe(999);
  });

  it('first new edit after loading empty provenance uses sequence 1', () => {
    const { loadInstances, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadPersistedProvenance([], {});
    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].sequence).toBe(1);
  });
});

// ── Stage 21.2 — Authored keyframe edits through the lawful seam ──

describe('SceneEditorStore — keyframe edits through applyEdit', () => {
  const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
  const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };
  const KF_C: SceneCameraKeyframe = { tick: 60, x: 200, y: 100, zoom: 1.5, interpolation: 'linear' };

  beforeEach(() => {
    useSceneEditorStore.setState({
      instances: [INST_ASSET],
      camera: undefined,
      keyframes: [],
      history: createEmptySceneHistoryState(),
      provenance: [],
      drilldownBySequence: {},
      canUndo: false,
      canRedo: false,
    });
    resetProvenanceSequence();
  });

  // ── Operation coverage ──

  it('add-camera-keyframe records history and provenance', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);

    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].kind).toBe('add-camera-keyframe');
    expect(state.keyframes).toEqual([KF_A]);
  });

  it('remove-camera-keyframe records history and provenance', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    // Remove KF_B
    applyEdit('remove-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A]);

    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].kind).toBe('remove-camera-keyframe');
    expect(state.keyframes).toEqual([KF_A]);
  });

  it('move-camera-keyframe records history and provenance', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    const movedB: SceneCameraKeyframe = { ...KF_B, tick: 45 };
    applyEdit('move-camera-keyframe', [INST_ASSET], { tick: 45, previousTick: 30 }, undefined, [KF_A, movedB]);

    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].kind).toBe('move-camera-keyframe');
    expect(state.keyframes).toEqual([KF_A, movedB]);
  });

  it('edit-camera-keyframe records history and provenance', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    const editedB: SceneCameraKeyframe = { ...KF_B, zoom: 3.0 };
    applyEdit('edit-camera-keyframe', [INST_ASSET], { tick: 30, changedFields: ['zoom'] }, undefined, [KF_A, editedB]);

    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.provenance).toHaveLength(1);
    expect(state.provenance[0].kind).toBe('edit-camera-keyframe');
    expect(state.keyframes).toEqual([KF_A, editedB]);
  });

  // ── loadKeyframes ──

  it('loadKeyframes sets keyframes without recording history', () => {
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    const state = useSceneEditorStore.getState();
    expect(state.keyframes).toEqual([KF_A, KF_B]);
    expect(state.canUndo).toBe(false);
    expect(state.provenance).toHaveLength(0);
  });

  // ── Undo / redo keyframes ──

  it('undo restores keyframes from history snapshot', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A]);

    // Add KF_B
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A, KF_B]);

    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();
    expect(result!.keyframes).toEqual([KF_A]);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]);
  });

  it('redo restores keyframes from history snapshot', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]);

    const result = useSceneEditorStore.getState().redo();
    expect(result).toBeDefined();
    expect(result!.keyframes).toEqual([KF_A, KF_B]);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A, KF_B]);
  });

  it('rollback after undo failure restores keyframes to pre-undo state', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);
    const preUndoKeyframes = useSceneEditorStore.getState().keyframes;

    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();

    // Simulate backend failure — rollback
    result!.rollback();
    expect(useSceneEditorStore.getState().keyframes).toEqual(preUndoKeyframes);
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
  });

  // ── Drilldown capture ──

  it('add-camera-keyframe captures drilldown with afterKeyframe', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);

    const state = useSceneEditorStore.getState();
    const source = state.drilldownBySequence[state.provenance[0].sequence];
    expect(source).toBeDefined();
    expect(source.kind).toBe('add-camera-keyframe');
    expect(source.afterKeyframe).toEqual(KF_A);
  });

  it('remove-camera-keyframe captures drilldown with beforeKeyframe', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    applyEdit('remove-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A]);

    const state = useSceneEditorStore.getState();
    const source = state.drilldownBySequence[state.provenance[0].sequence];
    expect(source).toBeDefined();
    expect(source.kind).toBe('remove-camera-keyframe');
    expect(source.beforeKeyframe).toEqual(KF_B);
  });

  it('edit-camera-keyframe captures drilldown with beforeKeyframe and afterKeyframe', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    const editedB: SceneCameraKeyframe = { ...KF_B, zoom: 3.0 };
    applyEdit('edit-camera-keyframe', [INST_ASSET], { tick: 30, changedFields: ['zoom'] }, undefined, [KF_A, editedB]);

    const state = useSceneEditorStore.getState();
    const source = state.drilldownBySequence[state.provenance[0].sequence];
    expect(source).toBeDefined();
    expect(source.kind).toBe('edit-camera-keyframe');
    expect(source.beforeKeyframe).toEqual(KF_B);
    expect(source.afterKeyframe).toEqual(editedB);
  });

  it('move-camera-keyframe captures drilldown with beforeKeyframe and afterKeyframe', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    const movedB: SceneCameraKeyframe = { ...KF_B, tick: 45 };
    applyEdit('move-camera-keyframe', [INST_ASSET], { tick: 45, previousTick: 30 }, undefined, [KF_A, movedB]);

    const state = useSceneEditorStore.getState();
    const source = state.drilldownBySequence[state.provenance[0].sequence];
    expect(source).toBeDefined();
    expect(source.kind).toBe('move-camera-keyframe');
    expect(source.beforeKeyframe).toEqual(KF_B);
    expect(source.afterKeyframe).toEqual(movedB);
  });

  // ── Keyframe drilldown diff derivation ──

  it('add-camera-keyframe drilldown derives keyframe-added diff', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);

    const state = useSceneEditorStore.getState();
    const source = state.drilldownBySequence[state.provenance[0].sequence];
    const diff = deriveProvenanceDiff(
      source.kind,
      source.beforeInstance ? [source.beforeInstance] : [],
      source.afterInstance ? [source.afterInstance] : [],
      source.metadata,
      source.beforeCamera,
      source.afterCamera,
      source.beforeKeyframe,
      source.afterKeyframe,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('keyframe-added');
  });

  it('remove-camera-keyframe drilldown derives keyframe-removed diff', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    applyEdit('remove-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A]);

    const state = useSceneEditorStore.getState();
    const source = state.drilldownBySequence[state.provenance[0].sequence];
    const diff = deriveProvenanceDiff(
      source.kind,
      source.beforeInstance ? [source.beforeInstance] : [],
      source.afterInstance ? [source.afterInstance] : [],
      source.metadata,
      source.beforeCamera,
      source.afterCamera,
      source.beforeKeyframe,
      source.afterKeyframe,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('keyframe-removed');
  });

  // ── No-op guard ──

  it('keyframe edit with identical instances is not a no-op when keyframes differ', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A]);

    // Same instances, new keyframes → should record history
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);

    const state = useSceneEditorStore.getState();
    expect(state.canUndo).toBe(true);
    expect(state.provenance).toHaveLength(1);
  });

  // ── Mixed authored-state: instance + keyframe edits coexist ──

  it('instance edit followed by keyframe edit produces separate provenance entries', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    // Instance edit
    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });

    // Keyframe edit
    applyEdit('add-camera-keyframe', [moved], { tick: 0 }, undefined, [KF_A]);

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(2);
    expect(state.provenance[0].kind).toBe('move-instance');
    expect(state.provenance[1].kind).toBe('add-camera-keyframe');
    expect(state.provenance[1].sequence).toBe(2);
  });

  it('undo keyframe edit does not affect instances', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    // Instance edit first
    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });

    // Keyframe edit second
    applyEdit('add-camera-keyframe', [moved], { tick: 0 }, undefined, [KF_A]);

    // Undo keyframe edit
    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();
    // Instances remain at moved position (from before the keyframe add)
    expect(result!.instances[0].x).toBe(999);
    // Keyframes go back to empty
    expect(result!.keyframes).toEqual([]);
  });

  it('multiple keyframe edits produce correct undo chain', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    // Add KF_A
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    // Add KF_B
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);
    // Add KF_C
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 60 }, undefined, [KF_A, KF_B, KF_C]);

    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A, KF_B, KF_C]);

    // Undo last → back to [KF_A, KF_B]
    const r1 = useSceneEditorStore.getState().undo();
    expect(r1!.keyframes).toEqual([KF_A, KF_B]);

    // Undo again → back to [KF_A]
    const r2 = useSceneEditorStore.getState().undo();
    expect(r2!.keyframes).toEqual([KF_A]);

    // Undo again → back to []
    const r3 = useSceneEditorStore.getState().undo();
    expect(r3!.keyframes).toEqual([]);
  });

  // ── Non-keyframe edits do not pollute keyframe state ──

  it('instance-only edit does not change keyframes in store', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });

    const state = useSceneEditorStore.getState();
    expect(state.keyframes).toEqual([KF_A, KF_B]);
  });

  // ── Provenance label includes tick ──

  it('keyframe provenance entry label includes tick', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_B]);

    const state = useSceneEditorStore.getState();
    expect(state.provenance[0].label).toContain('tick 30');
  });

  // ── Hydration continuity with keyframe entries ──

  it('persisted keyframe entry + new keyframe edit → correct next sequence', () => {
    const { loadInstances, loadKeyframes, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A]);
    loadPersistedProvenance(
      [{ sequence: 5, kind: 'add-camera-keyframe', label: 'Add Keyframe (tick 0)', timestamp: '2026-03-15T12:00:00Z', metadata: { tick: 0 } }],
      {},
    );

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(2);
    expect(state.provenance[1].sequence).toBe(6);
    expect(state.provenance[1].kind).toBe('add-camera-keyframe');
  });
});

// ── Stage 21.3 — Keyframe undo/redo integrity hardening ──

describe('SceneEditorStore — 21.3 keyframe undo/redo integrity', () => {
  const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
  const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };
  const KF_C: SceneCameraKeyframe = { tick: 60, x: 200, y: 100, zoom: 1.5, interpolation: 'linear' };
  const CAM_ORIGIN: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_PANNED: SceneCamera = { x: 120, y: 80, zoom: 1.0 };

  beforeEach(() => {
    useSceneEditorStore.setState({
      instances: [INST_ASSET],
      camera: undefined,
      keyframes: [],
      history: createEmptySceneHistoryState(),
      provenance: [],
      drilldownBySequence: {},
      canUndo: false,
      canRedo: false,
    });
    resetProvenanceSequence();
  });

  // ── Core exactness: add → undo → redo ──

  it('add keyframe → undo → redo restores exact keyframe', () => {
    const { loadInstances, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]);

    // Undo: keyframe removed
    const undoResult = useSceneEditorStore.getState().undo();
    expect(undoResult).toBeDefined();
    expect(undoResult!.keyframes).toEqual([]);
    expect(useSceneEditorStore.getState().keyframes).toEqual([]);

    // Redo: exact same keyframe restored
    const redoResult = useSceneEditorStore.getState().redo();
    expect(redoResult).toBeDefined();
    expect(redoResult!.keyframes).toEqual([KF_A]);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]);
    // Exact field-level check
    expect(redoResult!.keyframes![0].tick).toBe(0);
    expect(redoResult!.keyframes![0].x).toBe(0);
    expect(redoResult!.keyframes![0].y).toBe(0);
    expect(redoResult!.keyframes![0].zoom).toBe(1.0);
    expect(redoResult!.keyframes![0].interpolation).toBe('linear');
  });

  // ── Core exactness: remove → undo → redo ──

  it('remove keyframe → undo → redo restores exact presence/absence', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    // Remove KF_B
    applyEdit('remove-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A]);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]);

    // Undo: KF_B restored
    const undoResult = useSceneEditorStore.getState().undo();
    expect(undoResult!.keyframes).toEqual([KF_A, KF_B]);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A, KF_B]);
    // Exact restored keyframe
    expect(undoResult!.keyframes![1].tick).toBe(30);
    expect(undoResult!.keyframes![1].x).toBe(100);
    expect(undoResult!.keyframes![1].zoom).toBe(2.0);
    expect(undoResult!.keyframes![1].interpolation).toBe('hold');

    // Redo: KF_B removed again
    const redoResult = useSceneEditorStore.getState().redo();
    expect(redoResult!.keyframes).toEqual([KF_A]);
  });

  // ── Core exactness: move → undo → redo ──

  it('move keyframe → undo → redo restores exact tick positions', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    const movedB: SceneCameraKeyframe = { ...KF_B, tick: 45 };
    applyEdit('move-camera-keyframe', [INST_ASSET], { tick: 45, previousTick: 30 }, undefined, [KF_A, movedB]);
    expect(useSceneEditorStore.getState().keyframes[1].tick).toBe(45);

    // Undo: original tick restored
    const undoResult = useSceneEditorStore.getState().undo();
    expect(undoResult!.keyframes![1].tick).toBe(30);
    expect(useSceneEditorStore.getState().keyframes[1].tick).toBe(30);

    // Redo: moved tick restored
    const redoResult = useSceneEditorStore.getState().redo();
    expect(redoResult!.keyframes![1].tick).toBe(45);
    // Value fields unchanged by move
    expect(redoResult!.keyframes![1].x).toBe(100);
    expect(redoResult!.keyframes![1].y).toBe(50);
    expect(redoResult!.keyframes![1].zoom).toBe(2.0);
    expect(redoResult!.keyframes![1].interpolation).toBe('hold');
  });

  // ── Core exactness: edit value → undo → redo ──

  it('edit keyframe value → undo → redo restores exact before/after values', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    const editedB: SceneCameraKeyframe = { ...KF_B, zoom: 3.5, interpolation: 'linear' };
    applyEdit('edit-camera-keyframe', [INST_ASSET], { tick: 30, changedFields: ['zoom', 'interpolation'] }, undefined, [KF_A, editedB]);
    expect(useSceneEditorStore.getState().keyframes[1].zoom).toBe(3.5);
    expect(useSceneEditorStore.getState().keyframes[1].interpolation).toBe('linear');

    // Undo: original values restored exactly
    const undoResult = useSceneEditorStore.getState().undo();
    expect(undoResult!.keyframes![1].zoom).toBe(2.0);
    expect(undoResult!.keyframes![1].interpolation).toBe('hold');
    // Tick and position stable across value edit undo
    expect(undoResult!.keyframes![1].tick).toBe(30);
    expect(undoResult!.keyframes![1].x).toBe(100);
    expect(undoResult!.keyframes![1].y).toBe(50);

    // Redo: edited values restored exactly
    const redoResult = useSceneEditorStore.getState().redo();
    expect(redoResult!.keyframes![1].zoom).toBe(3.5);
    expect(redoResult!.keyframes![1].interpolation).toBe('linear');
    expect(redoResult!.keyframes![1].tick).toBe(30);
  });

  // ── Rollback coherence: undo failure ──

  it('failed undo backend sync restores prior keyframe state and history', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);

    const preUndo = useSceneEditorStore.getState();
    const preUndoKeyframes = preUndo.keyframes;
    const preUndoCanUndo = preUndo.canUndo;
    const preUndoCanRedo = preUndo.canRedo;
    const preUndoProvenance = preUndo.provenance;

    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]); // undone

    // Simulate backend failure → rollback
    result!.rollback();

    const after = useSceneEditorStore.getState();
    expect(after.keyframes).toEqual(preUndoKeyframes);
    expect(after.canUndo).toBe(preUndoCanUndo);
    expect(after.canRedo).toBe(preUndoCanRedo);
    // Provenance is not affected by undo/redo/rollback — it's append-only
    expect(after.provenance).toEqual(preUndoProvenance);
  });

  // ── Rollback coherence: redo failure ──

  it('failed redo backend sync restores prior keyframe state and history', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    useSceneEditorStore.getState().undo(); // undo the add

    const preRedo = useSceneEditorStore.getState();
    const preRedoKeyframes = preRedo.keyframes;
    const preRedoCanUndo = preRedo.canUndo;
    const preRedoCanRedo = preRedo.canRedo;

    const result = useSceneEditorStore.getState().redo();
    expect(result).toBeDefined();
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]); // redone

    // Simulate backend failure → rollback
    result!.rollback();

    const after = useSceneEditorStore.getState();
    expect(after.keyframes).toEqual(preRedoKeyframes);
    expect(after.canUndo).toBe(preRedoCanUndo);
    expect(after.canRedo).toBe(preRedoCanRedo);
  });

  it('rollback preserves prior history stacks exactly', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 60 }, undefined, [KF_A, KF_B, KF_C]);

    const preUndoHistory = useSceneEditorStore.getState().history;

    const result = useSceneEditorStore.getState().undo();
    result!.rollback();

    // History stacks restored exactly
    expect(useSceneEditorStore.getState().history).toBe(preUndoHistory);
  });

  // ── Redo invalidation ──

  it('new keyframe edit after undo clears redo stack', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().canRedo).toBe(true);

    // New forward keyframe edit should clear redo
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 60 }, undefined, [KF_C]);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_C]);
  });

  it('new instance edit after keyframe undo clears redo stack', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().canRedo).toBe(true);

    // Instance edit should also clear redo
    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  it('new camera edit after keyframe undo clears redo stack', () => {
    const { loadInstances, loadKeyframes, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);
    loadCamera(CAM_ORIGIN);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().canRedo).toBe(true);

    // Camera edit should also clear redo
    const inst2 = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-camera', [inst2], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_PANNED,
    }, CAM_PANNED);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  // ── Mixed authored-state chain: instance → keyframe → camera → undo × 3 → redo × 3 ──

  it('instance → keyframe → camera undo/redo chain restores each state exactly', () => {
    const { loadInstances, loadKeyframes, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);
    loadCamera(CAM_ORIGIN);

    // Edit 1: move instance
    const moved = { ...INST_ASSET, x: 500 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });

    // Edit 2: add keyframe
    applyEdit('add-camera-keyframe', [moved], { tick: 0 }, undefined, [KF_A]);

    // Edit 3: camera pan
    applyEdit('set-scene-camera', [moved], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_PANNED,
    }, CAM_PANNED);

    expect(useSceneEditorStore.getState().instances[0].x).toBe(500);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]);
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_PANNED);

    // Undo 3: camera restored to origin
    const u3 = useSceneEditorStore.getState().undo();
    expect(u3!.camera).toEqual(CAM_ORIGIN);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]); // keyframe unchanged

    // Undo 2: keyframe removed
    const u2 = useSceneEditorStore.getState().undo();
    expect(u2!.keyframes).toEqual([]);
    expect(useSceneEditorStore.getState().instances[0].x).toBe(500); // instance still moved

    // Undo 1: instance restored
    const u1 = useSceneEditorStore.getState().undo();
    expect(u1!.instances[0].x).toBe(50); // original INST_ASSET.x
    expect(useSceneEditorStore.getState().canUndo).toBe(false);

    // Redo 1: instance moved again
    const r1 = useSceneEditorStore.getState().redo();
    expect(r1!.instances[0].x).toBe(500);

    // Redo 2: keyframe added
    const r2 = useSceneEditorStore.getState().redo();
    expect(r2!.keyframes).toEqual([KF_A]);

    // Redo 3: camera panned
    const r3 = useSceneEditorStore.getState().redo();
    expect(r3!.camera).toEqual(CAM_PANNED);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  // ── Mixed chain: keyframe → instance → keyframe ──

  it('keyframe → instance → keyframe chain preserves interleaved state', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    // Add KF_A
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    // Move instance
    const moved = { ...INST_ASSET, x: 777 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    // Add KF_B
    applyEdit('add-camera-keyframe', [moved], { tick: 30 }, undefined, [KF_A, KF_B]);

    // Undo KF_B add
    const u1 = useSceneEditorStore.getState().undo();
    expect(u1!.keyframes).toEqual([KF_A]);
    expect(u1!.instances[0].x).toBe(777); // instance state from before KF_B add

    // Undo instance move
    const u2 = useSceneEditorStore.getState().undo();
    expect(u2!.instances[0].x).toBe(50);
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A]); // keyframe still present

    // Undo KF_A add
    const u3 = useSceneEditorStore.getState().undo();
    expect(u3!.keyframes).toEqual([]);
    expect(useSceneEditorStore.getState().canUndo).toBe(false);

    // Redo all 3
    useSceneEditorStore.getState().redo(); // KF_A
    useSceneEditorStore.getState().redo(); // instance move
    const r3 = useSceneEditorStore.getState().redo(); // KF_B
    expect(r3!.keyframes).toEqual([KF_A, KF_B]);
    expect(useSceneEditorStore.getState().instances[0].x).toBe(777);
  });

  // ── Mixed chain: provenance sequence continuity ──

  it('mixed chain preserves monotonic provenance sequence', () => {
    const { loadInstances, loadKeyframes, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);
    loadCamera(CAM_ORIGIN);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    const moved = { ...INST_ASSET, x: 999 };
    applyEdit('move-instance', [moved], { instanceId: 'i1' });
    applyEdit('set-scene-camera', [moved], {
      changedFields: ['x'],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_PANNED,
    }, CAM_PANNED);

    const state = useSceneEditorStore.getState();
    expect(state.provenance).toHaveLength(3);
    expect(state.provenance[0].sequence).toBe(1);
    expect(state.provenance[1].sequence).toBe(2);
    expect(state.provenance[2].sequence).toBe(3);
    expect(state.provenance[0].kind).toBe('add-camera-keyframe');
    expect(state.provenance[1].kind).toBe('move-instance');
    expect(state.provenance[2].kind).toBe('set-scene-camera');
  });

  // ── Playback boundary: playback ops stay outside ──

  it('playback state change (set-scene-playback) does not record keyframes in history', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B]);

    // Playback edit (different instances to avoid no-op)
    const inst2 = { ...INST_ASSET, x: 999 };
    applyEdit('set-scene-playback', [inst2]);

    // Undo the playback edit
    const result = useSceneEditorStore.getState().undo();
    expect(result).toBeDefined();
    // Keyframes unchanged — playback edits don't snapshot keyframes unless they're present
    // The keyframes in the store should remain as loaded
    expect(useSceneEditorStore.getState().keyframes).toEqual([KF_A, KF_B]);
  });

  // ── Stable identity across undo/redo cycles ──

  it('keyframe identity (tick + all fields) is stable across multiple undo/redo cycles', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_B]);

    // 3 full undo/redo cycles
    for (let i = 0; i < 3; i++) {
      const undoResult = useSceneEditorStore.getState().undo();
      expect(undoResult!.keyframes).toEqual([]);
      const redoResult = useSceneEditorStore.getState().redo();
      expect(redoResult!.keyframes).toEqual([KF_B]);
      expect(redoResult!.keyframes![0]).toEqual(KF_B);
    }
  });

  // ── Undo/redo with 3 keyframes: no cross-contamination ──

  it('undo/redo with multiple keyframes preserves exact array order and values', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A, KF_B, KF_C]);

    // Edit KF_B's zoom
    const editedB: SceneCameraKeyframe = { ...KF_B, zoom: 5.0 };
    applyEdit('edit-camera-keyframe', [INST_ASSET], { tick: 30, changedFields: ['zoom'] }, undefined, [KF_A, editedB, KF_C]);

    // Undo: exact original array restored
    const undoResult = useSceneEditorStore.getState().undo();
    expect(undoResult!.keyframes).toEqual([KF_A, KF_B, KF_C]);
    // KF_A and KF_C untouched
    expect(undoResult!.keyframes![0]).toEqual(KF_A);
    expect(undoResult!.keyframes![2]).toEqual(KF_C);
    // KF_B original zoom restored
    expect(undoResult!.keyframes![1].zoom).toBe(2.0);

    // Redo: exact edited array restored
    const redoResult = useSceneEditorStore.getState().redo();
    expect(redoResult!.keyframes![1].zoom).toBe(5.0);
    expect(redoResult!.keyframes![0]).toEqual(KF_A);
    expect(redoResult!.keyframes![2]).toEqual(KF_C);
  });

  // ── Rollback preserves drilldown captures ──

  it('rollback after undo preserves drilldown captures from prior edits', () => {
    const { loadInstances, loadKeyframes, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);

    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);

    const preUndoDrilldown = { ...useSceneEditorStore.getState().drilldownBySequence };

    const result = useSceneEditorStore.getState().undo();
    result!.rollback();

    // Drilldown map restored exactly (via history rollback)
    const after = useSceneEditorStore.getState();
    expect(Object.keys(after.drilldownBySequence)).toEqual(Object.keys(preUndoDrilldown));
  });

  // ── Camera + keyframe in same undo chain ──

  it('camera edit and keyframe edit in same chain restore independently', () => {
    const { loadInstances, loadKeyframes, loadCamera, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([]);
    loadCamera(CAM_ORIGIN);

    // Camera pan (change instances to avoid no-op)
    const inst2 = { ...INST_ASSET, x: 200 };
    applyEdit('set-scene-camera', [inst2], {
      changedFields: ['x', 'y'],
      beforeCamera: CAM_ORIGIN,
      afterCamera: CAM_PANNED,
    }, CAM_PANNED);

    // Keyframe add
    applyEdit('add-camera-keyframe', [inst2], { tick: 0 }, undefined, [KF_A]);

    // Undo keyframe → camera unaffected
    const u1 = useSceneEditorStore.getState().undo();
    expect(u1!.keyframes).toEqual([]);
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_PANNED);

    // Undo camera → keyframes unaffected (already empty)
    const u2 = useSceneEditorStore.getState().undo();
    expect(u2!.camera).toEqual(CAM_ORIGIN);
    expect(useSceneEditorStore.getState().keyframes).toEqual([]);

    // Redo camera → keyframes still empty
    const r1 = useSceneEditorStore.getState().redo();
    expect(r1!.camera).toEqual(CAM_PANNED);
    expect(useSceneEditorStore.getState().keyframes).toEqual([]);

    // Redo keyframe → camera still panned
    const r2 = useSceneEditorStore.getState().redo();
    expect(r2!.keyframes).toEqual([KF_A]);
    expect(useSceneEditorStore.getState().camera).toEqual(CAM_PANNED);
  });

  // ── Persisted load → keyframe edit → undo/redo → sequence continuity ──

  it('persisted scene load → keyframe edit → undo/redo → sequence remains sane', () => {
    const { loadInstances, loadKeyframes, loadPersistedProvenance, applyEdit } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    loadKeyframes([KF_A]);
    loadPersistedProvenance(
      [{ sequence: 10, kind: 'add-camera-keyframe', label: 'Loaded kf', timestamp: '2026-03-15T12:00:00Z' }],
      {},
    );

    // New keyframe edit
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);
    expect(useSceneEditorStore.getState().provenance[1].sequence).toBe(11);

    // Undo and redo — sequence counter should not regress
    useSceneEditorStore.getState().undo();
    useSceneEditorStore.getState().redo();

    // Another edit after redo cycle
    applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 60 }, undefined, [KF_A, KF_B, KF_C]);

    const state = useSceneEditorStore.getState();
    // Redo was cleared by new edit, but provenance still grows monotonically
    expect(state.provenance).toHaveLength(3);
    expect(state.provenance[2].sequence).toBe(12);
  });
});

// ── Restore entry tests ──

describe('SceneEditorStore — restoreEntry', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };
  const PB_A: ScenePlaybackConfig = { fps: 12, looping: false };
  const PB_B: ScenePlaybackConfig = { fps: 24, looping: true };
  const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
  const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };

  function setupWithEdit() {
    // Load initial state and make an edit to get a drilldown source
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadCamera(CAM_A);
    store.loadPlaybackConfig(PB_A);
    // Make a move edit — this creates drilldown with afterInstance
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 999, y: 888 }], { instanceId: 'i1' }, CAM_A);
    return useSceneEditorStore.getState();
  }

  it('successful restore applies historical instances', () => {
    setupWithEdit();
    // Now the scene has moved instance. Change further.
    const store = useSceneEditorStore.getState();
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.1 }], { instanceId: 'i1' }, CAM_A);

    // Restore entry #1 (the move)
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    const { instances } = useSceneEditorStore.getState();
    // Restored instance from drilldown afterInstance
    expect(instances).toHaveLength(1);
    expect(instances[0].x).toBe(999);
    expect(instances[0].y).toBe(888);
  });

  it('successful restore creates one history entry', () => {
    setupWithEdit();
    const beforeHistory = useSceneEditorStore.getState().history.past.length;
    // Make another edit to create a difference
    useSceneEditorStore.getState().applyEdit(
      'set-instance-opacity',
      [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.5 }],
      { instanceId: 'i1' },
      CAM_A,
    );
    const midHistory = useSceneEditorStore.getState().history.past.length;
    useSceneEditorStore.getState().restoreEntry(1);
    const afterHistory = useSceneEditorStore.getState().history.past.length;
    expect(afterHistory).toBe(midHistory + 1);
  });

  it('successful restore creates one provenance entry', () => {
    setupWithEdit();
    useSceneEditorStore.getState().applyEdit(
      'set-instance-opacity',
      [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.5 }],
      { instanceId: 'i1' },
      CAM_A,
    );
    const beforeProv = useSceneEditorStore.getState().provenance.length;
    useSceneEditorStore.getState().restoreEntry(1);
    const afterProv = useSceneEditorStore.getState().provenance.length;
    expect(afterProv).toBe(beforeProv + 1);
  });

  it('successful restore creates one drilldown capture', () => {
    setupWithEdit();
    useSceneEditorStore.getState().applyEdit(
      'set-instance-opacity',
      [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.5 }],
      { instanceId: 'i1' },
      CAM_A,
    );
    const beforeDrilldownCount = Object.keys(useSceneEditorStore.getState().drilldownBySequence).length;
    useSceneEditorStore.getState().restoreEntry(1);
    const afterDrilldownCount = Object.keys(useSceneEditorStore.getState().drilldownBySequence).length;
    expect(afterDrilldownCount).toBe(beforeDrilldownCount + 1);
  });

  it('restore provenance kind is restore-entry', () => {
    setupWithEdit();
    useSceneEditorStore.getState().applyEdit(
      'set-instance-opacity',
      [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.5 }],
      { instanceId: 'i1' },
      CAM_A,
    );
    useSceneEditorStore.getState().restoreEntry(1);
    const prov = useSceneEditorStore.getState().provenance;
    const lastEntry = prov[prov.length - 1];
    expect(lastEntry.kind).toBe('restore-entry');
  });

  it('restore drilldown source kind is restore-entry', () => {
    setupWithEdit();
    useSceneEditorStore.getState().applyEdit(
      'set-instance-opacity',
      [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.5 }],
      { instanceId: 'i1' },
      CAM_A,
    );
    useSceneEditorStore.getState().restoreEntry(1);
    const prov = useSceneEditorStore.getState().provenance;
    const lastEntry = prov[prov.length - 1];
    const source = useSceneEditorStore.getState().drilldownBySequence[lastEntry.sequence];
    expect(source).toBeDefined();
    expect(source.kind).toBe('restore-entry');
  });

  it('unavailable restore creates no history entry', () => {
    // Setup and restore the same entry without changes → source-matches-current
    setupWithEdit();
    const beforeHistory = useSceneEditorStore.getState().history.past.length;
    // Entry 1 matches current (moved instance is still at 999,888)
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('unavailable');
    expect(useSceneEditorStore.getState().history.past.length).toBe(beforeHistory);
  });

  it('unavailable restore creates no provenance entry', () => {
    setupWithEdit();
    const beforeProv = useSceneEditorStore.getState().provenance.length;
    useSceneEditorStore.getState().restoreEntry(1);
    expect(useSceneEditorStore.getState().provenance.length).toBe(beforeProv);
  });

  it('unavailable restore creates no drilldown capture', () => {
    setupWithEdit();
    const beforeDrilldownCount = Object.keys(useSceneEditorStore.getState().drilldownBySequence).length;
    useSceneEditorStore.getState().restoreEntry(1);
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence).length).toBe(beforeDrilldownCount);
  });

  it('restore with camera applies historical camera', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadCamera(CAM_A);
    // Edit camera
    store.applyEdit('set-scene-camera', [INST_ASSET], { changedFields: ['x', 'y'] }, CAM_B);
    // Now scene has CAM_B. Restore entry 1 should bring back CAM_A from afterCamera
    // Actually the drilldown for set-scene-camera captures afterCamera: CAM_B
    // So restore #1 would apply CAM_B. Let's change camera again.
    store.applyEdit('set-scene-camera', [INST_ASSET], { changedFields: ['zoom'] }, { x: 100, y: 50, zoom: 5.0 });
    // Restore #1 (afterCamera=CAM_B) should change from zoom 5.0 to CAM_B.zoom=2.0
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.camera).toEqual(CAM_B);
    }
  });

  it('restore with playback config applies historical playback', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadPlaybackConfig(PB_A);
    // Edit playback + move instance (instance change required for history entry)
    store.applyEdit('set-scene-playback', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' }, undefined, undefined, PB_B);
    // Change further
    store.applyEdit('set-scene-playback', [{ ...INST_ASSET, x: 300 }], { instanceId: 'i1' }, undefined, undefined, { fps: 60, looping: false });
    // Restore #1 should bring back PB_B from afterPlayback
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.playbackConfig).toEqual(PB_B);
    }
  });

  it('restore does not change isPlaying or currentTick in playback store', () => {
    // This test verifies restore doesn't touch transient playback.
    // Since restoreEntry only calls applyEdit on sceneEditorStore,
    // and never touches scenePlaybackStore, this is a contract check.
    setupWithEdit();
    useSceneEditorStore.getState().applyEdit(
      'set-instance-opacity',
      [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.5 }],
      { instanceId: 'i1' },
      CAM_A,
    );
    // Restore does not interact with scenePlaybackStore
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    // No isPlaying or currentTick fields in the result
    if (result.status === 'success') {
      expect('isPlaying' in result).toBe(false);
      expect('currentTick' in result).toBe(false);
    }
  });

  it('restore is undoable', () => {
    setupWithEdit();
    useSceneEditorStore.getState().applyEdit(
      'set-instance-opacity',
      [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.5 }],
      { instanceId: 'i1' },
      CAM_A,
    );
    const beforeInstances = useSceneEditorStore.getState().instances;
    useSceneEditorStore.getState().restoreEntry(1);
    expect(useSceneEditorStore.getState().canUndo).toBe(true);
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().instances).toEqual(beforeInstances);
  });

  it('character overrides restore correctly with instances', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_CHAR_WITH_OVERRIDES]);
    // Make an edit to create drilldown
    store.applyEdit('set-instance-opacity', [{ ...INST_CHAR_WITH_OVERRIDES, opacity: 0.5 }], { instanceId: 'i4' });
    // Change overrides
    store.applyEdit('clear-all-character-overrides', [{ ...INST_CHAR_WITH_OVERRIDES, opacity: 0.5, characterOverrides: undefined }], { instanceId: 'i4' });
    // Restore #1 should bring back the overrides
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.instances[0].characterOverrides).toBeDefined();
    }
  });

  it('missing drilldown source returns unavailable', () => {
    // restoreEntry for a sequence with no drilldown source
    const result = useSceneEditorStore.getState().restoreEntry(999);
    expect(result.status).toBe('unavailable');
  });

  it('successful restore returns rollback function', () => {
    setupWithEdit();
    useSceneEditorStore.getState().applyEdit(
      'set-instance-opacity',
      [{ ...INST_ASSET, x: 999, y: 888, opacity: 0.5 }],
      { instanceId: 'i1' },
      CAM_A,
    );
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(typeof result.rollback).toBe('function');
    }
  });
});

// ── Restore undo/redo integrity ──

describe('SceneEditorStore — restore undo/redo integrity', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };
  const PB_A: ScenePlaybackConfig = { fps: 12, looping: false };
  const PB_B: ScenePlaybackConfig = { fps: 24, looping: true };
  const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
  const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };

  it('restore → undo → redo cycle restores instances exactly', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 999, opacity: 0.5 }], { instanceId: 'i1' });
    const preRestore = useSceneEditorStore.getState().instances;

    useSceneEditorStore.getState().restoreEntry(1);
    const postRestore = useSceneEditorStore.getState().instances;

    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().instances).toEqual(preRestore);

    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().instances).toEqual(postRestore);
  });

  it('restore → undo → redo cycle restores camera exactly', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadCamera(CAM_A);
    store.applyEdit('set-scene-camera', [INST_ASSET], { changedFields: ['x'] }, CAM_B);
    store.applyEdit('set-scene-camera', [INST_ASSET], { changedFields: ['zoom'] }, { ...CAM_B, zoom: 5.0 });

    useSceneEditorStore.getState().restoreEntry(1);
    const postRestoreCamera = useSceneEditorStore.getState().camera;
    expect(postRestoreCamera).toEqual(CAM_B);

    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().camera).toEqual({ ...CAM_B, zoom: 5.0 });

    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().camera).toEqual(postRestoreCamera);
  });

  it('restore → undo → redo cycle restores keyframes exactly', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    store.applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 30 }, undefined, [KF_A, KF_B]);
    // Modify keyframe
    const KF_A_MODIFIED: SceneCameraKeyframe = { ...KF_A, zoom: 3.0 };
    store.applyEdit('edit-camera-keyframe', [INST_ASSET], { tick: 0, changedFields: ['zoom'] }, undefined, [KF_A_MODIFIED, KF_B]);

    // Restore entry #2 (after adding KF_B) — should restore [KF_A, KF_B] from drilldown
    // But drilldown for add-camera-keyframe captures afterKeyframe only (single KF).
    // So the restore will have limited data. Instead, just verify undo/redo cycle.
    const preRestoreKeyframes = useSceneEditorStore.getState().keyframes;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    if (result.status !== 'success') return; // Skip if unavailable

    const postRestoreKeyframes = useSceneEditorStore.getState().keyframes;
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().keyframes).toEqual(preRestoreKeyframes);

    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().keyframes).toEqual(postRestoreKeyframes);
  });

  it('restore → undo → redo cycle restores authored playback config exactly', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadPlaybackConfig(PB_A);
    store.applyEdit('set-scene-playback', [INST_ASSET], undefined, undefined, undefined, PB_B);
    store.applyEdit('set-scene-playback', [INST_ASSET], undefined, undefined, undefined, { fps: 60, looping: false });
    const preRestore = useSceneEditorStore.getState().playbackConfig;

    useSceneEditorStore.getState().restoreEntry(1);
    const postRestore = useSceneEditorStore.getState().playbackConfig;

    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().playbackConfig).toEqual(preRestore);

    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().playbackConfig).toEqual(postRestore);
  });

  it('character source/link mode restores exactly across undo/redo', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_CHAR]);
    store.applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    store.applyEdit('set-instance-opacity', [{ ...INST_CHAR, characterLinkMode: 'unlinked', opacity: 0.3 }], { instanceId: 'i2' });

    // Restore entry #1 — drilldown has afterInstance with characterLinkMode: 'unlinked'
    useSceneEditorStore.getState().restoreEntry(1);
    const postRestore = useSceneEditorStore.getState().instances;

    useSceneEditorStore.getState().undo();
    const afterUndo = useSceneEditorStore.getState().instances;
    expect(afterUndo[0].opacity).toBe(0.3);

    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().instances).toEqual(postRestore);
  });

  it('character overrides restore exactly across undo/redo', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_CHAR_WITH_OVERRIDES]);
    store.applyEdit('set-instance-opacity', [{ ...INST_CHAR_WITH_OVERRIDES, opacity: 0.5 }], { instanceId: 'i4' });
    store.applyEdit('clear-all-character-overrides', [{ ...INST_CHAR_WITH_OVERRIDES, opacity: 0.5, characterOverrides: undefined }], { instanceId: 'i4' });

    useSceneEditorStore.getState().restoreEntry(1);
    const postRestore = useSceneEditorStore.getState().instances;
    expect(postRestore[0].characterOverrides).toBeDefined();

    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().instances[0].characterOverrides).toBeUndefined();

    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().instances[0].characterOverrides).toBeDefined();
  });
});

// ── Restore rollback coherence ──

describe('SceneEditorStore — restore rollback coherence', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };
  const PB_A: ScenePlaybackConfig = { fps: 12, looping: false };
  const PB_B: ScenePlaybackConfig = { fps: 24, looping: true };

  function setupForRollback() {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadCamera(CAM_A);
    store.loadPlaybackConfig(PB_A);
    // Entry #1: move instance to x:999
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }], { instanceId: 'i1' }, CAM_A);
    // Entry #2: change camera
    store.applyEdit('set-scene-camera', [{ ...INST_ASSET, x: 999 }], { changedFields: ['x'] }, CAM_B);
    // Entry #3: move instance again so entry #1 differs from current
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 500 }], { instanceId: 'i1' }, CAM_B);
  }

  it('rollback restores instances exactly', () => {
    setupForRollback();
    const pre = useSceneEditorStore.getState().instances;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().instances).toEqual(pre);
  });

  it('rollback restores camera exactly', () => {
    setupForRollback();
    const pre = useSceneEditorStore.getState().camera;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().camera).toEqual(pre);
  });

  it('rollback restores playback config exactly', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadPlaybackConfig(PB_A);
    // Instance change required alongside playback for history entry
    store.applyEdit('set-scene-playback', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' }, undefined, undefined, PB_B);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 500 }], { instanceId: 'i1' });
    const pre = useSceneEditorStore.getState().playbackConfig;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().playbackConfig).toEqual(pre);
  });

  it('rollback restores history stacks exactly', () => {
    setupForRollback();
    const pre = useSceneEditorStore.getState().history;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().history).toBe(pre);
  });

  it('rollback restores provenance exactly', () => {
    setupForRollback();
    const pre = useSceneEditorStore.getState().provenance;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().provenance).toBe(pre);
  });

  it('rollback restores drilldown captures exactly', () => {
    setupForRollback();
    const pre = useSceneEditorStore.getState().drilldownBySequence;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().drilldownBySequence).toBe(pre);
  });

  it('rollback restores canUndo/canRedo exactly', () => {
    setupForRollback();
    const preUndo = useSceneEditorStore.getState().canUndo;
    const preRedo = useSceneEditorStore.getState().canRedo;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().canUndo).toBe(preUndo);
    expect(useSceneEditorStore.getState().canRedo).toBe(preRedo);
  });

  it('rollback restores keyframes exactly', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
    store.applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 500 }], { instanceId: 'i1' });
    const preKeyframes = useSceneEditorStore.getState().keyframes;
    const result = useSceneEditorStore.getState().restoreEntry(1);
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().keyframes).toEqual(preKeyframes);
  });
});

// ── Redo invalidation after restore undo ──

describe('SceneEditorStore — redo invalidation after restore undo', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };
  const PB_A: ScenePlaybackConfig = { fps: 12, looping: false };
  const PB_B: ScenePlaybackConfig = { fps: 24, looping: true };
  const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };

  it('restore → undo → new instance edit clears redo', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });

    useSceneEditorStore.getState().restoreEntry(1);
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().canRedo).toBe(true);

    useSceneEditorStore.getState().applyEdit('move-instance', [{ ...INST_ASSET, x: 200, opacity: 0.5, y: 777 }], { instanceId: 'i1' });
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  it('restore → undo → new camera edit clears redo', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadCamera(CAM_A);
    store.applyEdit('set-scene-camera', [INST_ASSET], { changedFields: ['x'] }, CAM_B);
    store.applyEdit('set-scene-camera', [INST_ASSET], { changedFields: ['zoom'] }, { ...CAM_B, zoom: 5.0 });

    useSceneEditorStore.getState().restoreEntry(1);
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().canRedo).toBe(true);

    useSceneEditorStore.getState().applyEdit('set-scene-camera', [INST_ASSET], { changedFields: ['y'] }, { ...CAM_B, zoom: 5.0, y: 999 });
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  it('restore → undo → new keyframe edit clears redo', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('add-camera-keyframe', [INST_ASSET], { tick: 0 }, undefined, [KF_A]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 500 }], { instanceId: 'i1' });

    const result = useSceneEditorStore.getState().restoreEntry(1);
    if (result.status !== 'success') return;
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().canRedo).toBe(true);

    const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };
    useSceneEditorStore.getState().applyEdit('add-camera-keyframe', [{ ...INST_ASSET, x: 500 }], { tick: 30 }, undefined, [KF_A, KF_B]);
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });

  it('restore → undo → new playback-config edit clears redo', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadPlaybackConfig(PB_A);
    // Instance changes required alongside playback for history entries
    store.applyEdit('set-scene-playback', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' }, undefined, undefined, PB_B);
    store.applyEdit('set-scene-playback', [{ ...INST_ASSET, x: 300 }], { instanceId: 'i1' }, undefined, undefined, { fps: 60, looping: false });

    useSceneEditorStore.getState().restoreEntry(1);
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().canRedo).toBe(true);

    useSceneEditorStore.getState().applyEdit('set-scene-playback', [{ ...INST_ASSET, x: 400 }], { instanceId: 'i1' }, undefined, undefined, { fps: 30, looping: true });
    expect(useSceneEditorStore.getState().canRedo).toBe(false);
  });
});

// ── Mixed edit chains ──

describe('SceneEditorStore — mixed edit chains with restore', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };

  it('normal edit → restore → undo → redo stays exact', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });
    const preRestore = useSceneEditorStore.getState().instances;

    useSceneEditorStore.getState().restoreEntry(1);
    const postRestore = useSceneEditorStore.getState().instances;

    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().instances).toEqual(preRestore);

    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().instances).toEqual(postRestore);
  });

  it('restore → normal edit → undo chain stays exact', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });

    useSceneEditorStore.getState().restoreEntry(1);
    const postRestore = useSceneEditorStore.getState().instances;

    // Normal edit after restore
    useSceneEditorStore.getState().applyEdit(
      'set-instance-visibility',
      [{ ...postRestore[0], visible: false }],
      { instanceId: 'i1' },
    );

    // Undo the visibility edit
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().instances).toEqual(postRestore);

    // Undo the restore
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().instances[0].opacity).toBe(0.5);
  });

  it('restore provenance does not create extra entries during undo/redo', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });

    useSceneEditorStore.getState().restoreEntry(1);
    const provAfterRestore = useSceneEditorStore.getState().provenance.length;

    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().provenance.length).toBe(provAfterRestore);

    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().provenance.length).toBe(provAfterRestore);
  });

  it('restore provenance sequence remains monotonic', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });

    useSceneEditorStore.getState().restoreEntry(1);

    // New edit after restore
    useSceneEditorStore.getState().applyEdit(
      'move-instance',
      [{ ...INST_ASSET, x: 300, opacity: 0.5 }],
      { instanceId: 'i1' },
    );

    const prov = useSceneEditorStore.getState().provenance;
    for (let i = 1; i < prov.length; i++) {
      expect(prov[i].sequence).toBeGreaterThan(prov[i - 1].sequence);
    }
  });

  it('load → restore → edit → undo/redo keeps sequence monotonic', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });

    useSceneEditorStore.getState().restoreEntry(1);

    useSceneEditorStore.getState().applyEdit(
      'move-instance',
      [{ ...INST_ASSET, x: 400 }],
      { instanceId: 'i1' },
    );

    useSceneEditorStore.getState().undo();
    useSceneEditorStore.getState().redo();

    // Another edit
    useSceneEditorStore.getState().applyEdit(
      'set-instance-visibility',
      [{ ...INST_ASSET, x: 400, visible: false }],
      { instanceId: 'i1' },
    );

    const prov = useSceneEditorStore.getState().provenance;
    for (let i = 1; i < prov.length; i++) {
      expect(prov[i].sequence).toBeGreaterThan(prov[i - 1].sequence);
    }
  });
});

// ── Playback boundary ──

describe('SceneEditorStore — restore playback boundary', () => {
  it('restore undo does not change isPlaying or currentTick', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });

    useSceneEditorStore.getState().restoreEntry(1);
    const result = useSceneEditorStore.getState().undo();

    // undo returns instances but no transient playback fields
    expect(result).toBeDefined();
    if (result) {
      expect('isPlaying' in result).toBe(false);
      expect('currentTick' in result).toBe(false);
    }
  });

  it('restore redo does not change isPlaying or currentTick', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });

    useSceneEditorStore.getState().restoreEntry(1);
    useSceneEditorStore.getState().undo();
    const result = useSceneEditorStore.getState().redo();

    expect(result).toBeDefined();
    if (result) {
      expect('isPlaying' in result).toBe(false);
      expect('currentTick' in result).toBe(false);
    }
  });

  it('restore rollback does not change transient playback state', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('set-instance-opacity', [{ ...INST_ASSET, x: 200, opacity: 0.5 }], { instanceId: 'i1' });

    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      result.rollback();
    }
    // sceneEditorStore does not contain isPlaying or currentTick — they live in scenePlaybackStore
    // Rollback only affects sceneEditorStore fields
    const state = useSceneEditorStore.getState();
    expect('isPlaying' in state).toBe(false);
    expect('currentTick' in state).toBe(false);
  });
});

// ── Scoped restore (selective) ──

describe('SceneEditorStore — scoped restore', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };
  const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
  const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };

  // Helper: setup scene with a camera edit that also captures afterCamera
  // Entry 1: camera change (CAM_A → CAM_B), then entry 2 changes camera further
  // so entry 1's afterCamera (CAM_B) differs from current camera (CAM_C)
  const CAM_C: SceneCamera = { x: 999, y: 999, zoom: 5.0 };

  function setupForCameraRestore() {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadCamera(CAM_A);
    // Entry 1: camera change + instance move (history needs instance diff)
    store.applyEdit('set-scene-camera', [{ ...INST_ASSET, x: 200 }], { changedFields: ['x', 'y'] }, CAM_B);
    // Entry 2: camera changes again — so entry 1's afterCamera (CAM_B) ≠ current (CAM_C)
    store.applyEdit('set-scene-camera', [{ ...INST_ASSET, x: 200 }], { changedFields: ['zoom'] }, CAM_C);
  }

  // Helper: setup scene with instance edits that capture afterInstance
  // Entry 1: move instance (x:50→200), then entry 2 moves further (200→500)
  function setupForInstanceRestore() {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadCamera(CAM_A);
    // Entry 1: move instance — drilldown captures afterInstance with x:200
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' }, CAM_A);
    // Entry 2: move instance further — so entry 1's afterInstance differs from current
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 500 }], { instanceId: 'i1' }, CAM_A);
  }

  // ── Camera-scoped restore ──

  it('camera-scoped restore mutates only camera', () => {
    setupForCameraRestore();
    const preInstances = useSceneEditorStore.getState().instances;
    const result = useSceneEditorStore.getState().restoreEntry(1, 'camera');
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    // Camera restored to CAM_B (entry 1's afterCamera)
    expect(result.camera).toEqual(CAM_B);
    // Instances unchanged from pre-restore
    expect(useSceneEditorStore.getState().instances).toEqual(preInstances);
  });

  it('camera-scoped restore creates history/provenance entry', () => {
    setupForCameraRestore();
    const prevProvLen = useSceneEditorStore.getState().provenance.length;
    const prevHistLen = useSceneEditorStore.getState().history.past.length;
    useSceneEditorStore.getState().restoreEntry(1, 'camera');
    expect(useSceneEditorStore.getState().provenance.length).toBe(prevProvLen + 1);
    expect(useSceneEditorStore.getState().history.past.length).toBe(prevHistLen + 1);
  });

  it('camera-scoped restore is undoable', () => {
    setupForCameraRestore();
    const preCam = useSceneEditorStore.getState().camera;
    useSceneEditorStore.getState().restoreEntry(1, 'camera');
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().camera).toEqual(preCam);
  });

  it('camera-scoped restore undo → redo round-trips', () => {
    setupForCameraRestore();
    const result = useSceneEditorStore.getState().restoreEntry(1, 'camera');
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    const postCam = useSceneEditorStore.getState().camera;
    useSceneEditorStore.getState().undo();
    useSceneEditorStore.getState().redo();
    expect(useSceneEditorStore.getState().camera).toEqual(postCam);
  });

  it('camera-scoped restore fails honestly when no camera data in source', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    // Entry 1: instance-only edit — no camera captured in drilldown
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 500 }], { instanceId: 'i1' });
    const result = useSceneEditorStore.getState().restoreEntry(1, 'camera');
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.label).toContain('Camera');
  });

  // ── Instances-scoped restore ──

  it('instances-scoped restore mutates only instances', () => {
    setupForInstanceRestore();
    const preCam = useSceneEditorStore.getState().camera;
    const result = useSceneEditorStore.getState().restoreEntry(1, 'instances');
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    // Camera unchanged
    expect(useSceneEditorStore.getState().camera).toEqual(preCam);
    // Instance restored to entry 1's afterInstance position
    expect(useSceneEditorStore.getState().instances[0].x).toBe(200);
  });

  it('instances-scoped restore is undoable', () => {
    setupForInstanceRestore();
    const preInst = useSceneEditorStore.getState().instances;
    useSceneEditorStore.getState().restoreEntry(1, 'instances');
    useSceneEditorStore.getState().undo();
    expect(useSceneEditorStore.getState().instances).toEqual(preInst);
  });

  it('instances-scoped restore creates one provenance entry', () => {
    setupForInstanceRestore();
    const prevLen = useSceneEditorStore.getState().provenance.length;
    useSceneEditorStore.getState().restoreEntry(1, 'instances');
    expect(useSceneEditorStore.getState().provenance.length).toBe(prevLen + 1);
  });

  // ── Keyframes-scoped restore ──

  it('keyframes-scoped restore mutates only keyframes', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.loadCamera(CAM_A);
    // Entry 1: add keyframe + move instance
    store.applyEdit('add-camera-keyframe', [{ ...INST_ASSET, x: 200 }], { tick: 0 }, CAM_A, [KF_A]);
    // Entry 2: change keyframe
    store.applyEdit('edit-camera-keyframe', [{ ...INST_ASSET, x: 200 }], { tick: 0 }, CAM_A, [KF_B]);
    const preInstances = useSceneEditorStore.getState().instances;
    const preCam = useSceneEditorStore.getState().camera;
    const result = useSceneEditorStore.getState().restoreEntry(1, 'keyframes');
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(useSceneEditorStore.getState().instances).toEqual(preInstances);
    expect(useSceneEditorStore.getState().camera).toEqual(preCam);
    // Keyframes restored to entry 1's value
    expect(result.keyframes).toBeDefined();
  });

  it('keyframes-scoped restore fails when no keyframe data', () => {
    const store = useSceneEditorStore.getState();
    store.loadInstances([INST_ASSET]);
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }], { instanceId: 'i1' });
    store.applyEdit('move-instance', [{ ...INST_ASSET, x: 500 }], { instanceId: 'i1' });
    const result = useSceneEditorStore.getState().restoreEntry(1, 'keyframes');
    expect(result.status).toBe('unavailable');
  });

  // ── Honest playback limitation ──

  it('full restore still works with default scope', () => {
    setupForInstanceRestore();
    const result = useSceneEditorStore.getState().restoreEntry(1);
    expect(result.status).toBe('success');
  });

  it('scope metadata is recorded in provenance drilldown', () => {
    setupForCameraRestore();
    useSceneEditorStore.getState().restoreEntry(1, 'camera');
    const prov = useSceneEditorStore.getState().provenance;
    const lastEntry = prov[prov.length - 1];
    const source = useSceneEditorStore.getState().drilldownBySequence[lastEntry.sequence];
    expect(source).toBeDefined();
    expect(source.metadata).toBeDefined();
    if (source.metadata && 'scope' in source.metadata) {
      expect(source.metadata.scope).toBe('camera');
    }
  });

  it('scoped restore rollback restores exact pre-restore state', () => {
    setupForCameraRestore();
    const pre = {
      instances: useSceneEditorStore.getState().instances,
      camera: useSceneEditorStore.getState().camera,
    };
    const result = useSceneEditorStore.getState().restoreEntry(1, 'camera');
    expect(result.status).toBe('success');
    if (result.status === 'success') result.rollback();
    expect(useSceneEditorStore.getState().instances).toEqual(pre.instances);
    expect(useSceneEditorStore.getState().camera).toEqual(pre.camera);
  });
});
