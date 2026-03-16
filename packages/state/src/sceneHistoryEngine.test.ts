import { describe, it, expect } from 'vitest';
import type { SceneAssetInstance, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import type { SceneHistoryState } from './sceneHistoryEngine';
import {
  createEmptySceneHistoryState,
  canUndoScene,
  canRedoScene,
  recordSceneHistoryEntry,
  undoSceneHistory,
  redoSceneHistory,
  finishApplyingHistory,
  applySceneEditWithHistory,
} from './sceneHistoryEngine';
import { createSceneHistoryEntry, captureSceneSnapshot } from './sceneHistory';
import type { SceneHistoryEntry, SceneHistorySnapshot } from './sceneHistory';

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

function makeEntry(
  kind: 'move-instance' | 'add-instance' | 'remove-instance' | 'unlink-character-source' | 'set-character-override',
  before: SceneAssetInstance[],
  after: SceneAssetInstance[],
): SceneHistoryEntry {
  return createSceneHistoryEntry(kind, snap(before), snap(after))!;
}

// ── Core stack tests ──

describe('SceneHistoryEngine — core stack', () => {
  it('empty history cannot undo', () => {
    const h = createEmptySceneHistoryState();
    expect(canUndoScene(h)).toBe(false);
  });

  it('empty history cannot redo', () => {
    const h = createEmptySceneHistoryState();
    expect(canRedoScene(h)).toBe(false);
  });

  it('recording first change adds one past entry', () => {
    const h = createEmptySceneHistoryState();
    const entry = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 999 }]);
    const h2 = recordSceneHistoryEntry(h, entry);
    expect(h2.past).toHaveLength(1);
    expect(h2.past[0].kind).toBe('move-instance');
    expect(canUndoScene(h2)).toBe(true);
  });

  it('recording change clears redo stack', () => {
    // Build a state with one future entry
    const h = createEmptySceneHistoryState();
    const entry1 = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 100 }]);
    const h2 = recordSceneHistoryEntry(h, entry1);
    const { history: h3 } = undoSceneHistory(h2);
    expect(canRedoScene(h3)).toBe(true);
    // Record a new forward edit
    const entry2 = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 200 }]);
    const h4 = recordSceneHistoryEntry(h3, entry2);
    expect(canRedoScene(h4)).toBe(false);
    expect(h4.future).toHaveLength(0);
  });

  it('no-op change records nothing via applySceneEditWithHistory', () => {
    const h = createEmptySceneHistoryState();
    const instances = [INST_ASSET];
    const result = applySceneEditWithHistory(instances, h, 'move-instance', instances);
    expect(result.history.past).toHaveLength(0);
  });

  it('undo restores exact before snapshot', () => {
    const h = createEmptySceneHistoryState();
    const before = [INST_ASSET];
    const after = [{ ...INST_ASSET, x: 999 }];
    const entry = makeEntry('move-instance', before, after);
    const h2 = recordSceneHistoryEntry(h, entry);
    const { snapshot } = undoSceneHistory(h2);
    expect(snapshot).toBeDefined();
    expect(snapshot!.instances[0].x).toBe(50);
  });

  it('redo restores exact after snapshot', () => {
    const h = createEmptySceneHistoryState();
    const entry = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 999 }]);
    const h2 = recordSceneHistoryEntry(h, entry);
    const { history: h3 } = undoSceneHistory(h2);
    const { snapshot } = redoSceneHistory(h3);
    expect(snapshot).toBeDefined();
    expect(snapshot!.instances[0].x).toBe(999);
  });

  it('undo moves entry from past to future', () => {
    const h = createEmptySceneHistoryState();
    const entry = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 999 }]);
    const h2 = recordSceneHistoryEntry(h, entry);
    expect(h2.past).toHaveLength(1);
    expect(h2.future).toHaveLength(0);
    const { history: h3 } = undoSceneHistory(h2);
    expect(h3.past).toHaveLength(0);
    expect(h3.future).toHaveLength(1);
  });

  it('redo moves entry from future back to past', () => {
    const h = createEmptySceneHistoryState();
    const entry = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 999 }]);
    const h2 = recordSceneHistoryEntry(h, entry);
    const { history: h3 } = undoSceneHistory(h2);
    const { history: h4 } = redoSceneHistory(h3);
    expect(h4.past).toHaveLength(1);
    expect(h4.future).toHaveLength(0);
  });

  it('undo on empty is a clean no-op', () => {
    const h = createEmptySceneHistoryState();
    const { history: h2, snapshot } = undoSceneHistory(h);
    expect(snapshot).toBeUndefined();
    expect(h2).toBe(h); // same reference — truly no-op
  });

  it('redo on empty is a clean no-op', () => {
    const h = createEmptySceneHistoryState();
    const { history: h2, snapshot } = redoSceneHistory(h);
    expect(snapshot).toBeUndefined();
    expect(h2).toBe(h);
  });
});

// ── Multi-step behavior ──

describe('SceneHistoryEngine — multi-step', () => {
  it('two forward edits undo in reverse order', () => {
    let h = createEmptySceneHistoryState();
    const e1 = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 100 }]);
    const e2 = makeEntry('move-instance', [{ ...INST_ASSET, x: 100 }], [{ ...INST_ASSET, x: 200 }]);
    h = recordSceneHistoryEntry(h, e1);
    h = recordSceneHistoryEntry(h, e2);
    // First undo restores x=100 (before of e2)
    const { history: h2, snapshot: s1 } = undoSceneHistory(h);
    expect(s1!.instances[0].x).toBe(100);
    // Second undo restores x=50 (before of e1)
    const { snapshot: s2 } = undoSceneHistory(h2);
    expect(s2!.instances[0].x).toBe(50);
  });

  it('two undos then one redo restores the correct intermediate state', () => {
    let h = createEmptySceneHistoryState();
    const e1 = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 100 }]);
    const e2 = makeEntry('move-instance', [{ ...INST_ASSET, x: 100 }], [{ ...INST_ASSET, x: 200 }]);
    h = recordSceneHistoryEntry(h, e1);
    h = recordSceneHistoryEntry(h, e2);
    // Undo twice
    const { history: h2 } = undoSceneHistory(h);
    const { history: h3 } = undoSceneHistory(h2);
    // Redo once — should get x=100 (after of e1)
    const { snapshot } = redoSceneHistory(h3);
    expect(snapshot!.instances[0].x).toBe(100);
  });

  it('undo followed by new forward edit clears redo stack', () => {
    let h = createEmptySceneHistoryState();
    const e1 = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 100 }]);
    const e2 = makeEntry('move-instance', [{ ...INST_ASSET, x: 100 }], [{ ...INST_ASSET, x: 200 }]);
    h = recordSceneHistoryEntry(h, e1);
    h = recordSceneHistoryEntry(h, e2);
    // Undo once
    const { history: h2 } = undoSceneHistory(h);
    expect(canRedoScene(h2)).toBe(true);
    // New forward edit
    const e3 = makeEntry('move-instance', [{ ...INST_ASSET, x: 100 }], [{ ...INST_ASSET, x: 300 }]);
    const h3 = recordSceneHistoryEntry(h2, e3);
    expect(canRedoScene(h3)).toBe(false);
    expect(h3.past).toHaveLength(2); // e1 + e3
    expect(h3.past[1].after.instances[0].x).toBe(300);
  });
});

// ── Snapshot integrity ──

describe('SceneHistoryEngine — snapshot integrity', () => {
  it('undo restores unlinked characterLinkMode exactly', () => {
    let h = createEmptySceneHistoryState();
    const before = [INST_CHAR_UNLINKED];
    const after = [{ ...INST_CHAR_UNLINKED, characterLinkMode: undefined as unknown as typeof INST_CHAR_UNLINKED.characterLinkMode }];
    const entry = makeEntry('unlink-character-source', before, after);
    h = recordSceneHistoryEntry(h, entry);
    const { snapshot } = undoSceneHistory(h);
    expect(snapshot!.instances[0].characterLinkMode).toBe('unlinked');
  });

  it('redo restores linked state exactly', () => {
    let h = createEmptySceneHistoryState();
    const before = [INST_CHAR];
    const after = [{ ...INST_CHAR, characterLinkMode: 'unlinked' as const }];
    const entry = makeEntry('unlink-character-source', before, after);
    h = recordSceneHistoryEntry(h, entry);
    const { history: h2 } = undoSceneHistory(h);
    const { snapshot } = redoSceneHistory(h2);
    expect(snapshot!.instances[0].characterLinkMode).toBe('unlinked');
  });

  it('overrides survive undo/redo intact', () => {
    let h = createEmptySceneHistoryState();
    const before = [INST_CHAR];
    const after = [INST_CHAR_WITH_OVERRIDES];
    const entry = makeEntry('set-character-override', before, after);
    h = recordSceneHistoryEntry(h, entry);
    // Undo — overrides should be absent
    const { history: h2, snapshot: undoSnap } = undoSceneHistory(h);
    expect(undoSnap!.instances[0].characterOverrides).toBeUndefined();
    // Redo — overrides should be back
    const { snapshot: redoSnap } = redoSceneHistory(h2);
    expect(redoSnap!.instances[0].characterOverrides!.head.mode).toBe('replace');
    expect(redoSnap!.instances[0].characterOverrides!.head.replacementPartId).toBe('helm-gold');
    expect(redoSnap!.instances[0].characterOverrides!.torso.mode).toBe('remove');
  });

  it('remove-mode override survives undo/redo', () => {
    let h = createEmptySceneHistoryState();
    const before = [INST_CHAR_WITH_OVERRIDES];
    const after = [{
      ...INST_CHAR_WITH_OVERRIDES,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace' as const, replacementPartId: 'helm-gold' },
        // torso remove-override removed
      },
    }];
    const entry = makeEntry('set-character-override', before, after);
    h = recordSceneHistoryEntry(h, entry);
    const { snapshot: undoSnap } = undoSceneHistory(h);
    expect(undoSnap!.instances[0].characterOverrides!.torso.mode).toBe('remove');
  });

  it('source build id survives undo/redo', () => {
    let h = createEmptySceneHistoryState();
    const before = [INST_CHAR];
    const after = [{ ...INST_CHAR, sourceCharacterBuildId: 'build-2', sourceCharacterBuildName: 'New Build' }];
    const entry = makeEntry('unlink-character-source', before, after);
    h = recordSceneHistoryEntry(h, entry);
    const { history: h2, snapshot: undoSnap } = undoSceneHistory(h);
    expect(undoSnap!.instances[0].sourceCharacterBuildId).toBe('build-1');
    expect(undoSnap!.instances[0].sourceCharacterBuildName).toBe('Knight Build');
    const { snapshot: redoSnap } = redoSceneHistory(h2);
    expect(redoSnap!.instances[0].sourceCharacterBuildId).toBe('build-2');
    expect(redoSnap!.instances[0].sourceCharacterBuildName).toBe('New Build');
  });

  it('slot snapshot survives undo/redo', () => {
    let h = createEmptySceneHistoryState();
    const reapplied = {
      ...INST_CHAR,
      characterSlotSnapshot: {
        slots: { head: 'helm-v2', torso: 'plate-v2', boots: 'greaves' },
        equippedCount: 3,
        totalSlots: 12,
      },
    };
    const entry = makeEntry('move-instance', [INST_CHAR], [reapplied]);
    h = recordSceneHistoryEntry(h, entry);
    const { history: h2, snapshot: undoSnap } = undoSceneHistory(h);
    expect(undoSnap!.instances[0].characterSlotSnapshot!.equippedCount).toBe(2);
    const { snapshot: redoSnap } = redoSceneHistory(h2);
    expect(redoSnap!.instances[0].characterSlotSnapshot!.equippedCount).toBe(3);
    expect(redoSnap!.instances[0].characterSlotSnapshot!.slots.boots).toBe('greaves');
  });

  it('instance transform and parallax survive undo/redo', () => {
    let h = createEmptySceneHistoryState();
    const moved = { ...INST_ASSET, x: 200, y: 300, parallax: 0.5 };
    const entry = makeEntry('move-instance', [INST_ASSET], [moved]);
    h = recordSceneHistoryEntry(h, entry);
    const { history: h2, snapshot: undoSnap } = undoSceneHistory(h);
    expect(undoSnap!.instances[0].x).toBe(50);
    expect(undoSnap!.instances[0].y).toBe(100);
    expect(undoSnap!.instances[0].parallax).toBe(1.0);
    const { snapshot: redoSnap } = redoSceneHistory(h2);
    expect(redoSnap!.instances[0].x).toBe(200);
    expect(redoSnap!.instances[0].y).toBe(300);
    expect(redoSnap!.instances[0].parallax).toBe(0.5);
  });
});

// ── Guardrail tests ──

describe('SceneHistoryEngine — guardrails', () => {
  it('undo does not mutate existing history entry payloads', () => {
    let h = createEmptySceneHistoryState();
    const entry = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 999 }]);
    h = recordSceneHistoryEntry(h, entry);
    // Capture reference to the entry in past before undo
    const entryBeforeUndo = h.past[0];
    const beforeX = entryBeforeUndo.before.instances[0].x;
    const afterX = entryBeforeUndo.after.instances[0].x;
    undoSceneHistory(h);
    // Original entry must not be mutated
    expect(entryBeforeUndo.before.instances[0].x).toBe(beforeX);
    expect(entryBeforeUndo.after.instances[0].x).toBe(afterX);
  });

  it('redo does not mutate existing history entry payloads', () => {
    let h = createEmptySceneHistoryState();
    const entry = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 999 }]);
    h = recordSceneHistoryEntry(h, entry);
    const { history: h2 } = undoSceneHistory(h);
    // Capture reference to the entry in future before redo
    const entryBeforeRedo = h2.future[0];
    const beforeX = entryBeforeRedo.before.instances[0].x;
    const afterX = entryBeforeRedo.after.instances[0].x;
    redoSceneHistory(h2);
    // Original entry must not be mutated
    expect(entryBeforeRedo.before.instances[0].x).toBe(beforeX);
    expect(entryBeforeRedo.after.instances[0].x).toBe(afterX);
  });

  it('applying history does not create extra entries', () => {
    let h = createEmptySceneHistoryState();
    const instances = [INST_ASSET];
    const moved = [{ ...INST_ASSET, x: 999 }];
    // Record a normal edit
    const result = applySceneEditWithHistory(instances, h, 'move-instance', moved);
    expect(result.history.past).toHaveLength(1);
    // Simulate undo
    const { history: afterUndo, snapshot } = undoSceneHistory(result.history);
    expect(afterUndo.isApplyingHistory).toBe(true);
    // Apply the restored snapshot while isApplyingHistory is true
    const restored = applySceneEditWithHistory(
      moved,
      afterUndo,
      'move-instance',
      snapshot!.instances,
    );
    // Must NOT have recorded an extra entry
    expect(restored.history.past).toHaveLength(0);
    expect(restored.history.future).toHaveLength(1);
  });

  it('finishApplyingHistory clears the guard flag', () => {
    let h = createEmptySceneHistoryState();
    const entry = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 999 }]);
    h = recordSceneHistoryEntry(h, entry);
    const { history: afterUndo } = undoSceneHistory(h);
    expect(afterUndo.isApplyingHistory).toBe(true);
    const cleared = finishApplyingHistory(afterUndo);
    expect(cleared.isApplyingHistory).toBe(false);
  });
});

// ── applySceneEditWithHistory ──

describe('SceneHistoryEngine — applySceneEditWithHistory', () => {
  it('records a forward edit with correct kind', () => {
    const h = createEmptySceneHistoryState();
    const instances = [INST_ASSET];
    const moved = [{ ...INST_ASSET, x: 999 }];
    const result = applySceneEditWithHistory(instances, h, 'move-instance', moved);
    expect(result.history.past).toHaveLength(1);
    expect(result.history.past[0].kind).toBe('move-instance');
    expect(result.instances[0].x).toBe(999);
  });

  it('skips recording for no-op edits', () => {
    const h = createEmptySceneHistoryState();
    const instances = [INST_ASSET];
    const result = applySceneEditWithHistory(instances, h, 'move-instance', [...instances]);
    expect(result.history.past).toHaveLength(0);
  });

  it('clears future on new forward edit', () => {
    let h = createEmptySceneHistoryState();
    const entry = makeEntry('move-instance', [INST_ASSET], [{ ...INST_ASSET, x: 100 }]);
    h = recordSceneHistoryEntry(h, entry);
    const { history: afterUndo } = undoSceneHistory(h);
    const h2 = finishApplyingHistory(afterUndo);
    expect(canRedoScene(h2)).toBe(true);
    const result = applySceneEditWithHistory(
      [INST_ASSET],
      h2,
      'move-instance',
      [{ ...INST_ASSET, x: 200 }],
    );
    expect(canRedoScene(result.history)).toBe(false);
  });

  it('attaches metadata to recorded entry', () => {
    const h = createEmptySceneHistoryState();
    const result = applySceneEditWithHistory(
      [INST_ASSET],
      h,
      'move-instance',
      [{ ...INST_ASSET, x: 999 }],
      { instanceId: 'i1' },
    );
    expect(result.history.past[0].metadata).toEqual({ instanceId: 'i1' });
  });

  it('deep-clones snapshots so mutations do not affect history', () => {
    const h = createEmptySceneHistoryState();
    const instances = [{ ...INST_ASSET }];
    const moved = [{ ...INST_ASSET, x: 999 }];
    const result = applySceneEditWithHistory(instances, h, 'move-instance', moved);
    // Mutate the original arrays
    instances[0].x = -1;
    moved[0].x = -1;
    // History snapshots must be unaffected
    expect(result.history.past[0].before.instances[0].x).toBe(50);
    expect(result.history.past[0].after.instances[0].x).toBe(999);
  });
});

// ── maxEntries ──

describe('SceneHistoryEngine — maxEntries', () => {
  it('trims oldest entries when past exceeds maxEntries', () => {
    let h = createEmptySceneHistoryState(3);
    for (let i = 1; i <= 5; i++) {
      const entry = makeEntry(
        'move-instance',
        [{ ...INST_ASSET, x: i - 1 }],
        [{ ...INST_ASSET, x: i }],
      );
      h = recordSceneHistoryEntry(h, entry);
    }
    expect(h.past).toHaveLength(3);
    // Oldest surviving entry should be the one that moved x from 2→3
    expect(h.past[0].before.instances[0].x).toBe(2);
    expect(h.past[0].after.instances[0].x).toBe(3);
  });

  it('defaults to 100 max entries', () => {
    const h = createEmptySceneHistoryState();
    expect(h.maxEntries).toBe(100);
  });
});

// ── Keyframe support in applySceneEditWithHistory ──

const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };

describe('SceneHistoryEngine — keyframe support', () => {
  it('records keyframe-only change via applySceneEditWithHistory', () => {
    const h = createEmptySceneHistoryState();
    const result = applySceneEditWithHistory(
      [INST_ASSET], h, 'add-camera-keyframe', [INST_ASSET],
      { tick: 30 },
      undefined, undefined,
      [KF_A], [KF_A, KF_B],
    );
    expect(result.history.past).toHaveLength(1);
    expect(result.history.past[0].kind).toBe('add-camera-keyframe');
    expect(result.keyframes).toEqual([KF_A, KF_B]);
  });

  it('returns keyframes in result', () => {
    const h = createEmptySceneHistoryState();
    const result = applySceneEditWithHistory(
      [INST_ASSET], h, 'add-camera-keyframe', [INST_ASSET],
      { tick: 30 },
      undefined, undefined,
      [KF_A], [KF_A, KF_B],
    );
    expect(result.keyframes).toHaveLength(2);
  });

  it('no-op keyframe edit skips recording', () => {
    const h = createEmptySceneHistoryState();
    const result = applySceneEditWithHistory(
      [INST_ASSET], h, 'edit-camera-keyframe', [INST_ASSET],
      { tick: 0 },
      undefined, undefined,
      [KF_A], [{ ...KF_A }],
    );
    expect(result.history.past).toHaveLength(0);
  });

  it('mid-undo keyframe edit is not recorded', () => {
    let h = createEmptySceneHistoryState();
    // Record a keyframe add
    const r1 = applySceneEditWithHistory(
      [INST_ASSET], h, 'add-camera-keyframe', [INST_ASSET],
      { tick: 30 },
      undefined, undefined,
      [KF_A], [KF_A, KF_B],
    );
    // Undo
    const { history: afterUndo } = undoSceneHistory(r1.history);
    expect(afterUndo.isApplyingHistory).toBe(true);
    // Apply restored state while mid-undo
    const r2 = applySceneEditWithHistory(
      [INST_ASSET], afterUndo, 'add-camera-keyframe', [INST_ASSET],
      { tick: 30 },
      undefined, undefined,
      [KF_A, KF_B], [KF_A],
    );
    expect(r2.history.past).toHaveLength(0);
    expect(r2.history.future).toHaveLength(1);
  });

  it('undo/redo restores keyframes from snapshot', () => {
    let h = createEmptySceneHistoryState();
    const r1 = applySceneEditWithHistory(
      [INST_ASSET], h, 'add-camera-keyframe', [INST_ASSET],
      { tick: 30 },
      undefined, undefined,
      [KF_A], [KF_A, KF_B],
    );
    // Undo should restore before keyframes
    const { snapshot: undoSnap } = undoSceneHistory(r1.history);
    expect(undoSnap).toBeDefined();
    expect(undoSnap!.keyframes).toHaveLength(1);
    expect(undoSnap!.keyframes![0].tick).toBe(0);
  });
});

// ── PlaybackConfig support in applySceneEditWithHistory ──

const PB_DEFAULT: ScenePlaybackConfig = { fps: 24, looping: false };
const PB_FAST: ScenePlaybackConfig = { fps: 60, looping: true };

describe('SceneHistoryEngine — playbackConfig support', () => {
  it('records playbackConfig-only change via applySceneEditWithHistory', () => {
    const h = createEmptySceneHistoryState();
    const result = applySceneEditWithHistory(
      [INST_ASSET], h, 'set-scene-playback', [INST_ASSET],
      undefined,
      undefined, undefined,
      undefined, undefined,
      PB_DEFAULT, PB_FAST,
    );
    expect(result.history.past).toHaveLength(1);
    expect(result.history.past[0].kind).toBe('set-scene-playback');
    expect(result.playbackConfig).toEqual(PB_FAST);
  });

  it('returns playbackConfig in result', () => {
    const h = createEmptySceneHistoryState();
    const result = applySceneEditWithHistory(
      [INST_ASSET], h, 'set-scene-playback', [INST_ASSET],
      undefined,
      undefined, undefined,
      undefined, undefined,
      PB_DEFAULT, PB_FAST,
    );
    expect(result.playbackConfig).toEqual(PB_FAST);
  });

  it('no-op playbackConfig edit skips recording', () => {
    const h = createEmptySceneHistoryState();
    const result = applySceneEditWithHistory(
      [INST_ASSET], h, 'set-scene-playback', [INST_ASSET],
      undefined,
      undefined, undefined,
      undefined, undefined,
      PB_DEFAULT, { ...PB_DEFAULT },
    );
    expect(result.history.past).toHaveLength(0);
  });

  it('undo restores playbackConfig from snapshot', () => {
    const h = createEmptySceneHistoryState();
    const r1 = applySceneEditWithHistory(
      [INST_ASSET], h, 'set-scene-playback', [INST_ASSET],
      undefined,
      undefined, undefined,
      undefined, undefined,
      PB_DEFAULT, PB_FAST,
    );
    const { snapshot: undoSnap } = undoSceneHistory(r1.history);
    expect(undoSnap).toBeDefined();
    expect(undoSnap!.playbackConfig).toEqual(PB_DEFAULT);
  });

  it('redo restores playbackConfig from snapshot', () => {
    const h = createEmptySceneHistoryState();
    const r1 = applySceneEditWithHistory(
      [INST_ASSET], h, 'set-scene-playback', [INST_ASSET],
      undefined,
      undefined, undefined,
      undefined, undefined,
      PB_DEFAULT, PB_FAST,
    );
    const { history: afterUndo } = undoSceneHistory(r1.history);
    const { snapshot: redoSnap } = redoSceneHistory(finishApplyingHistory(afterUndo));
    expect(redoSnap).toBeDefined();
    expect(redoSnap!.playbackConfig).toEqual(PB_FAST);
  });

  it('mid-undo playbackConfig edit is not recorded', () => {
    const h = createEmptySceneHistoryState();
    const r1 = applySceneEditWithHistory(
      [INST_ASSET], h, 'set-scene-playback', [INST_ASSET],
      undefined,
      undefined, undefined,
      undefined, undefined,
      PB_DEFAULT, PB_FAST,
    );
    const { history: afterUndo } = undoSceneHistory(r1.history);
    expect(afterUndo.isApplyingHistory).toBe(true);
    const r2 = applySceneEditWithHistory(
      [INST_ASSET], afterUndo, 'set-scene-playback', [INST_ASSET],
      undefined,
      undefined, undefined,
      undefined, undefined,
      PB_FAST, PB_DEFAULT,
    );
    expect(r2.history.past).toHaveLength(0);
    expect(r2.history.future).toHaveLength(1);
  });
});
