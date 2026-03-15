import { describe, it, expect, beforeEach } from 'vitest';
import type { SceneAssetInstance } from '@glyphstudio/domain';
import { useSceneEditorStore } from './sceneEditorStore';
import { createEmptySceneHistoryState } from './sceneHistoryEngine';

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
  useSceneEditorStore.setState({
    instances: [],
    history: createEmptySceneHistoryState(),
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
    expect(restored![0].characterLinkMode).toBeUndefined();
    expect(restored![0].sourceCharacterBuildId).toBe('build-1');
  });

  it('relink then undo restores unlinked exactly', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR_UNLINKED]);
    applyEdit('relink-character-source', [{ ...INST_CHAR_UNLINKED, characterLinkMode: undefined }]);
    const restored = undo();
    expect(restored).toBeDefined();
    expect(restored![0].characterLinkMode).toBe('unlinked');
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
    expect(restored![0].characterSlotSnapshot!.equippedCount).toBe(2);
    expect(restored![0].characterSlotSnapshot!.slots.head).toBe('helm-iron');
  });

  it('override edit then undo restores prior override exactly', () => {
    const { loadInstances, applyEdit, undo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES]);
    const restored = undo();
    expect(restored![0].characterOverrides).toBeUndefined();
  });

  it('remove-mode override survives full undo/redo cycle', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES]);
    undo();
    const redone = redo();
    expect(redone![0].characterOverrides!.torso.mode).toBe('remove');
    expect(redone![0].characterOverrides!.head.mode).toBe('replace');
    expect(redone![0].characterOverrides!.head.replacementPartId).toBe('helm-gold');
  });

  it('parallax survives undo/redo', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('set-instance-parallax', [{ ...INST_ASSET, parallax: 0.5 }]);
    const undone = undo();
    expect(undone![0].parallax).toBe(1.0);
    const redone = redo();
    expect(redone![0].parallax).toBe(0.5);
  });

  it('instance transform survives undo/redo', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200, y: 300 }]);
    const undone = undo();
    expect(undone![0].x).toBe(50);
    expect(undone![0].y).toBe(100);
    const redone = redo();
    expect(redone![0].x).toBe(200);
    expect(redone![0].y).toBe(300);
  });

  it('source build id survives undo/redo', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_CHAR]);
    applyEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }]);
    const undone = undo();
    expect(undone![0].sourceCharacterBuildId).toBe('build-1');
    expect(undone![0].sourceCharacterBuildName).toBe('Knight Build');
    const redone = redo();
    expect(redone![0].sourceCharacterBuildId).toBe('build-1');
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
    expect(restored![0].x).toBe(50);
  });

  it('redo returns restored instances', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 999 }]);
    undo();
    const restored = redo();
    expect(restored).toBeDefined();
    expect(restored![0].x).toBe(999);
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
    expect(first![0].x).toBe(100);
    const second = undo();
    expect(second![0].x).toBe(50);
  });

  it('undo+redo+undo returns to correct state', () => {
    const { loadInstances, applyEdit, undo, redo } = useSceneEditorStore.getState();
    loadInstances([INST_ASSET]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 100 }]);
    applyEdit('move-instance', [{ ...INST_ASSET, x: 200 }]);
    undo(); // → x=100
    redo(); // → x=200
    const result = undo(); // → x=100
    expect(result![0].x).toBe(100);
  });
});
