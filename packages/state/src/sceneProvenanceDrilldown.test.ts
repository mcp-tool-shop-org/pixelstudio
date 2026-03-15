import { describe, it, expect, beforeEach } from 'vitest';
import type { SceneAssetInstance, SceneCamera } from '@glyphstudio/domain';
import {
  deriveProvenanceDiff,
  deriveProvenanceDrilldown,
  describeProvenanceDiff,
  captureProvenanceDrilldownSource,
} from './sceneProvenanceDrilldown';
import type { SceneProvenanceDiff } from './sceneProvenanceDrilldown';
import { createSceneProvenanceEntry, resetProvenanceSequence } from './sceneProvenance';

// ── Fixtures ──

const INST_A: SceneAssetInstance = {
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

beforeEach(() => {
  resetProvenanceSequence();
});

// ── Instance lifecycle diffs ──

describe('ProvenanceDrilldown — instance lifecycle', () => {
  it('add-instance derives instance-added diff', () => {
    const diff = deriveProvenanceDiff('add-instance', [], [INST_A], { instanceId: 'i1' });
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('instance-added');
    if (diff!.type === 'instance-added') {
      expect(diff!.instanceId).toBe('i1');
      expect(diff!.name).toBe('Tree');
      expect(diff!.position).toEqual({ x: 50, y: 100 });
    }
  });

  it('remove-instance derives instance-removed diff', () => {
    const diff = deriveProvenanceDiff('remove-instance', [INST_A], [], { instanceId: 'i1' });
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('instance-removed');
    if (diff!.type === 'instance-removed') {
      expect(diff!.instanceId).toBe('i1');
      expect(diff!.name).toBe('Tree');
      expect(diff!.position).toEqual({ x: 50, y: 100 });
    }
  });
});

// ── Transform diffs ──

describe('ProvenanceDrilldown — move', () => {
  it('move-instance derives before/after positions', () => {
    const moved = { ...INST_A, x: 200, y: 300 };
    const diff = deriveProvenanceDiff('move-instance', [INST_A], [moved], { instanceId: 'i1' });
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('move');
    if (diff!.type === 'move') {
      expect(diff!.before).toEqual({ x: 50, y: 100 });
      expect(diff!.after).toEqual({ x: 200, y: 300 });
    }
  });

  it('move preserves exact stored values', () => {
    const moved = { ...INST_A, x: 777, y: 888 };
    const diff = deriveProvenanceDiff('move-instance', [INST_A], [moved], { instanceId: 'i1' });
    if (diff!.type === 'move') {
      expect(diff!.before.x).toBe(50);
      expect(diff!.after.x).toBe(777);
    }
  });
});

// ── Property diffs ──

describe('ProvenanceDrilldown — property diffs', () => {
  it('visibility derives before/after', () => {
    const hidden = { ...INST_A, visible: false };
    const diff = deriveProvenanceDiff('set-instance-visibility', [INST_A], [hidden], { instanceId: 'i1' });
    expect(diff!.type).toBe('visibility');
    if (diff!.type === 'visibility') {
      expect(diff!.before).toBe(true);
      expect(diff!.after).toBe(false);
    }
  });

  it('opacity derives before/after', () => {
    const faded = { ...INST_A, opacity: 0.5 };
    const diff = deriveProvenanceDiff('set-instance-opacity', [INST_A], [faded], { instanceId: 'i1' });
    expect(diff!.type).toBe('opacity');
    if (diff!.type === 'opacity') {
      expect(diff!.before).toBe(1.0);
      expect(diff!.after).toBe(0.5);
    }
  });

  it('layer derives before/after z-order', () => {
    const raised = { ...INST_A, zOrder: 5 };
    const diff = deriveProvenanceDiff('set-instance-layer', [INST_A], [raised], { instanceId: 'i1' });
    expect(diff!.type).toBe('layer');
    if (diff!.type === 'layer') {
      expect(diff!.before).toBe(0);
      expect(diff!.after).toBe(5);
    }
  });

  it('clip derives before/after', () => {
    const clipped = { ...INST_A, clipId: 'walk' };
    const diff = deriveProvenanceDiff('set-instance-clip', [INST_A], [clipped], { instanceId: 'i1' });
    expect(diff!.type).toBe('clip');
    if (diff!.type === 'clip') {
      expect(diff!.before).toBeUndefined();
      expect(diff!.after).toBe('walk');
    }
  });

  it('parallax derives before/after', () => {
    const deep = { ...INST_A, parallax: 0.5 };
    const diff = deriveProvenanceDiff('set-instance-parallax', [INST_A], [deep], { instanceId: 'i1' });
    expect(diff!.type).toBe('parallax');
    if (diff!.type === 'parallax') {
      expect(diff!.before).toBe(1.0);
      expect(diff!.after).toBe(0.5);
    }
  });
});

// ── Source ops — must remain distinct ──

describe('ProvenanceDrilldown — source ops distinctness', () => {
  it('unlink derives unlink diff', () => {
    const unlinked = { ...INST_CHAR, characterLinkMode: 'unlinked' as const };
    const diff = deriveProvenanceDiff('unlink-character-source', [INST_CHAR], [unlinked], { instanceId: 'i2' });
    expect(diff!.type).toBe('unlink');
  });

  it('relink derives relink diff', () => {
    const relinked = { ...INST_CHAR_UNLINKED, characterLinkMode: undefined };
    const diff = deriveProvenanceDiff('relink-character-source', [INST_CHAR_UNLINKED], [relinked], { instanceId: 'i3' });
    expect(diff!.type).toBe('relink');
  });

  it('reapply derives reapply diff', () => {
    const reapplied = {
      ...INST_CHAR,
      characterSlotSnapshot: { slots: { head: 'helm-v2', torso: 'plate-steel' }, equippedCount: 2, totalSlots: 12 },
    };
    const diff = deriveProvenanceDiff('reapply-character-source', [INST_CHAR], [reapplied], { instanceId: 'i2' });
    expect(diff!.type).toBe('reapply');
  });

  it('unlink/relink/reapply never collapse into same diff type', () => {
    const types = new Set<string>();
    const unlinked = { ...INST_CHAR, characterLinkMode: 'unlinked' as const };
    types.add(deriveProvenanceDiff('unlink-character-source', [INST_CHAR], [unlinked], { instanceId: 'i2' })!.type);
    const relinked = { ...INST_CHAR_UNLINKED, characterLinkMode: undefined };
    types.add(deriveProvenanceDiff('relink-character-source', [INST_CHAR_UNLINKED], [relinked], { instanceId: 'i3' })!.type);
    const reapplied = { ...INST_CHAR, characterSlotSnapshot: { slots: { head: 'helm-v2' }, equippedCount: 1, totalSlots: 12 } };
    types.add(deriveProvenanceDiff('reapply-character-source', [INST_CHAR], [reapplied], { instanceId: 'i2' })!.type);
    expect(types.size).toBe(3);
  });

  it('unlink includes build name', () => {
    const unlinked = { ...INST_CHAR, characterLinkMode: 'unlinked' as const };
    const diff = deriveProvenanceDiff('unlink-character-source', [INST_CHAR], [unlinked], { instanceId: 'i2' });
    if (diff!.type === 'unlink') {
      expect(diff!.buildName).toBe('Knight Build');
    }
  });

  it('relink includes build name', () => {
    const relinked = { ...INST_CHAR_UNLINKED, characterLinkMode: undefined };
    const diff = deriveProvenanceDiff('relink-character-source', [INST_CHAR_UNLINKED], [relinked], { instanceId: 'i3' });
    if (diff!.type === 'relink') {
      expect(diff!.buildName).toBe('Knight Build');
    }
  });

  it('reapply shows slot-level changes', () => {
    const reapplied = {
      ...INST_CHAR,
      characterSlotSnapshot: { slots: { head: 'helm-v2', torso: 'plate-steel', boots: 'greaves' }, equippedCount: 3, totalSlots: 12 },
    };
    const diff = deriveProvenanceDiff('reapply-character-source', [INST_CHAR], [reapplied], { instanceId: 'i2' });
    if (diff!.type === 'reapply') {
      expect(diff!.slotChanges).toContainEqual({ slot: 'head', before: 'helm-iron', after: 'helm-v2' });
      expect(diff!.slotChanges).toContainEqual({ slot: 'boots', before: undefined, after: 'greaves' });
      // torso unchanged
      const torsoChange = diff!.slotChanges.find((c) => c.slot === 'torso');
      expect(torsoChange).toBeUndefined();
    }
  });
});

// ── Override diffs — must stay distinct ──

describe('ProvenanceDrilldown — override diffs', () => {
  it('set-override derives set-override diff with slot', () => {
    const withOverrides = { ...INST_CHAR, characterOverrides: INST_CHAR_WITH_OVERRIDES.characterOverrides };
    const diff = deriveProvenanceDiff(
      'set-character-override', [INST_CHAR], [withOverrides],
      { instanceId: 'i2', slotId: 'head' },
    );
    expect(diff!.type).toBe('set-override');
    if (diff!.type === 'set-override') {
      expect(diff!.slotId).toBe('head');
      expect(diff!.mode).toBe('replace');
      expect(diff!.replacementPartId).toBe('helm-gold');
    }
  });

  it('remove-override derives remove-override diff with slot', () => {
    const noHeadOverride = {
      ...INST_CHAR_WITH_OVERRIDES,
      characterOverrides: { torso: INST_CHAR_WITH_OVERRIDES.characterOverrides!.torso },
    };
    const diff = deriveProvenanceDiff(
      'remove-character-override', [INST_CHAR_WITH_OVERRIDES], [noHeadOverride],
      { instanceId: 'i4', slotId: 'head' },
    );
    expect(diff!.type).toBe('remove-override');
    if (diff!.type === 'remove-override') {
      expect(diff!.slotId).toBe('head');
      expect(diff!.previousMode).toBe('replace');
      expect(diff!.previousPartId).toBe('helm-gold');
    }
  });

  it('clear-all-overrides derives clear-all diff with count and slots', () => {
    const noOverrides = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    const diff = deriveProvenanceDiff(
      'clear-all-character-overrides', [INST_CHAR_WITH_OVERRIDES], [noOverrides],
      { instanceId: 'i4' },
    );
    expect(diff!.type).toBe('clear-all-overrides');
    if (diff!.type === 'clear-all-overrides') {
      expect(diff!.count).toBe(2);
      expect(diff!.clearedSlots).toContain('head');
      expect(diff!.clearedSlots).toContain('torso');
    }
  });

  it('set/remove/clear-all override diffs stay distinct', () => {
    const types = new Set<string>();
    types.add(deriveProvenanceDiff(
      'set-character-override', [INST_CHAR], [INST_CHAR_WITH_OVERRIDES],
      { instanceId: 'i2', slotId: 'head' },
    )!.type);
    const noHead = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: { torso: INST_CHAR_WITH_OVERRIDES.characterOverrides!.torso } };
    types.add(deriveProvenanceDiff(
      'remove-character-override', [INST_CHAR_WITH_OVERRIDES], [noHead],
      { instanceId: 'i4', slotId: 'head' },
    )!.type);
    types.add(deriveProvenanceDiff(
      'clear-all-character-overrides', [INST_CHAR_WITH_OVERRIDES], [{ ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined }],
      { instanceId: 'i4' },
    )!.type);
    expect(types.size).toBe(3);
  });
});

// ── Camera / playback ──

describe('ProvenanceDrilldown — camera and playback', () => {
  it('camera derives camera diff with changedFields', () => {
    const diff = deriveProvenanceDiff('set-scene-camera', [INST_A], [{ ...INST_A, x: 10 }], { changedFields: ['x', 'zoom'] });
    expect(diff!.type).toBe('camera');
    if (diff!.type === 'camera') {
      expect(diff!.changedFields).toEqual(['x', 'zoom']);
    }
  });

  it('playback derives playback diff', () => {
    const diff = deriveProvenanceDiff('set-scene-playback', [INST_A], [{ ...INST_A, x: 10 }]);
    expect(diff!.type).toBe('playback');
  });
});

// ── Full drilldown derivation ──

describe('ProvenanceDrilldown — full drilldown', () => {
  it('deriveProvenanceDrilldown returns complete drilldown', () => {
    const entry = createSceneProvenanceEntry('move-instance', { instanceId: 'i1' });
    const moved = { ...INST_A, x: 200, y: 300 };
    const drilldown = deriveProvenanceDrilldown(entry, [INST_A], [moved]);
    expect(drilldown).toBeDefined();
    expect(drilldown!.kind).toBe('move-instance');
    expect(drilldown!.label).toContain('Move');
    expect(drilldown!.sequence).toBe(1);
    expect(drilldown!.diff.type).toBe('move');
  });

  it('deriveProvenanceDrilldown returns undefined when target missing', () => {
    const entry = createSceneProvenanceEntry('move-instance', { instanceId: 'nonexistent' });
    const drilldown = deriveProvenanceDrilldown(entry, [INST_A], [INST_A]);
    expect(drilldown).toBeUndefined();
  });

  it('returns undefined when no metadata for instance op', () => {
    const entry = createSceneProvenanceEntry('move-instance');
    const drilldown = deriveProvenanceDrilldown(entry, [INST_A], [{ ...INST_A, x: 200 }]);
    expect(drilldown).toBeUndefined();
  });
});

// ── describeProvenanceDiff ──

describe('ProvenanceDrilldown — describe diff', () => {
  it('describes move diff', () => {
    const diff: SceneProvenanceDiff = { type: 'move', instanceId: 'i1', before: { x: 50, y: 100 }, after: { x: 200, y: 300 } };
    const desc = describeProvenanceDiff(diff);
    expect(desc).toContain('50');
    expect(desc).toContain('200');
  });

  it('describes visibility diff', () => {
    const diff: SceneProvenanceDiff = { type: 'visibility', instanceId: 'i1', before: true, after: false };
    expect(describeProvenanceDiff(diff)).toContain('hidden');
  });

  it('describes opacity diff as percentage', () => {
    const diff: SceneProvenanceDiff = { type: 'opacity', instanceId: 'i1', before: 1.0, after: 0.6 };
    const desc = describeProvenanceDiff(diff);
    expect(desc).toContain('100%');
    expect(desc).toContain('60%');
  });

  it('describes unlink with build name', () => {
    const diff: SceneProvenanceDiff = { type: 'unlink', instanceId: 'i2', buildName: 'Knight Build' };
    expect(describeProvenanceDiff(diff)).toContain('Knight Build');
  });

  it('describes relink with build name', () => {
    const diff: SceneProvenanceDiff = { type: 'relink', instanceId: 'i2', buildName: 'Knight Build' };
    expect(describeProvenanceDiff(diff)).toContain('Knight Build');
  });

  it('describes reapply with slot changes', () => {
    const diff: SceneProvenanceDiff = {
      type: 'reapply', instanceId: 'i2',
      slotChanges: [{ slot: 'head', before: 'helm-iron', after: 'helm-v2' }],
    };
    expect(describeProvenanceDiff(diff)).toContain('head');
    expect(describeProvenanceDiff(diff)).toContain('helm-v2');
  });

  it('describes set-override with slot and part', () => {
    const diff: SceneProvenanceDiff = { type: 'set-override', instanceId: 'i2', slotId: 'head', mode: 'replace', replacementPartId: 'helm-gold' };
    const desc = describeProvenanceDiff(diff);
    expect(desc).toContain('head');
    expect(desc).toContain('helm-gold');
  });

  it('describes remove-override with slot', () => {
    const diff: SceneProvenanceDiff = { type: 'remove-override', instanceId: 'i2', slotId: 'head' };
    expect(describeProvenanceDiff(diff)).toContain('head');
  });

  it('describes clear-all with count and slots', () => {
    const diff: SceneProvenanceDiff = { type: 'clear-all-overrides', instanceId: 'i4', clearedSlots: ['head', 'torso'], count: 2 };
    const desc = describeProvenanceDiff(diff);
    expect(desc).toContain('2');
    expect(desc).toContain('head');
    expect(desc).toContain('torso');
  });

  it('describes camera with changed fields (no before/after)', () => {
    const diff: SceneProvenanceDiff = { type: 'camera', changedFields: ['x', 'zoom'] };
    const desc = describeProvenanceDiff(diff);
    expect(desc).toContain('x');
    expect(desc).toContain('zoom');
  });

  it('describes camera with before/after values', () => {
    const diff: SceneProvenanceDiff = {
      type: 'camera',
      changedFields: ['x', 'y'],
      before: { x: 0, y: 0, zoom: 1.0 },
      after: { x: 100, y: 50, zoom: 1.0 },
    };
    const desc = describeProvenanceDiff(diff);
    expect(desc).toContain('0.0');
    expect(desc).toContain('100.0');
    expect(desc).toContain('50.0');
  });

  it('describes instance-added with name and position', () => {
    const diff: SceneProvenanceDiff = { type: 'instance-added', instanceId: 'i1', name: 'Tree', position: { x: 50, y: 100 } };
    const desc = describeProvenanceDiff(diff);
    expect(desc).toContain('Tree');
    expect(desc).toContain('50');
  });

  it('describes instance-removed with name', () => {
    const diff: SceneProvenanceDiff = { type: 'instance-removed', instanceId: 'i1', name: 'Tree', position: { x: 50, y: 100 } };
    expect(describeProvenanceDiff(diff)).toContain('Tree');
  });
});

// ── Camera drilldown capture ──

describe('captureProvenanceDrilldownSource — camera', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };

  it('set-scene-camera captures beforeCamera and afterCamera', () => {
    const src = captureProvenanceDrilldownSource(
      'set-scene-camera', [INST_A], [INST_A],
      { changedFields: ['x', 'y'] }, CAM_A, CAM_B,
    );
    expect(src.kind).toBe('set-scene-camera');
    expect(src.beforeCamera).toEqual(CAM_A);
    expect(src.afterCamera).toEqual(CAM_B);
    expect(src.beforeInstance).toBeUndefined();
    expect(src.afterInstance).toBeUndefined();
  });

  it('pan captures beforeCamera and afterCamera with position fields', () => {
    const panBefore: SceneCamera = { x: 10, y: 20, zoom: 1.0 };
    const panAfter: SceneCamera = { x: 50, y: 80, zoom: 1.0 };
    const src = captureProvenanceDrilldownSource(
      'set-scene-camera', [INST_A], [INST_A],
      { changedFields: ['x', 'y'] }, panBefore, panAfter,
    );
    expect(src.beforeCamera).toEqual(panBefore);
    expect(src.afterCamera).toEqual(panAfter);
  });

  it('zoom captures beforeCamera and afterCamera with zoom field', () => {
    const zoomBefore: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
    const zoomAfter: SceneCamera = { x: 0, y: 0, zoom: 2.5 };
    const src = captureProvenanceDrilldownSource(
      'set-scene-camera', [INST_A], [INST_A],
      { changedFields: ['zoom'] }, zoomBefore, zoomAfter,
    );
    expect(src.beforeCamera!.zoom).toBe(1.0);
    expect(src.afterCamera!.zoom).toBe(2.5);
  });

  it('reset captures beforeCamera and afterCamera with all fields', () => {
    const resetBefore: SceneCamera = { x: 100, y: 50, zoom: 3.0 };
    const resetAfter: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
    const src = captureProvenanceDrilldownSource(
      'set-scene-camera', [INST_A], [INST_A],
      { changedFields: ['x', 'y', 'zoom'] }, resetBefore, resetAfter,
    );
    expect(src.beforeCamera).toEqual(resetBefore);
    expect(src.afterCamera).toEqual(resetAfter);
  });

  it('changedFields preserved alongside camera slices', () => {
    const src = captureProvenanceDrilldownSource(
      'set-scene-camera', [INST_A], [INST_A],
      { changedFields: ['zoom'] }, CAM_A, CAM_B,
    );
    expect((src.metadata as { changedFields: string[] }).changedFields).toEqual(['zoom']);
    expect(src.beforeCamera).toBeDefined();
    expect(src.afterCamera).toBeDefined();
  });

  it('instance ops do not capture camera fields', () => {
    const src = captureProvenanceDrilldownSource(
      'move-instance', [INST_A], [{ ...INST_A, x: 200 }],
      { instanceId: 'i1' }, CAM_A, CAM_B,
    );
    expect(src.beforeCamera).toBeUndefined();
    expect(src.afterCamera).toBeUndefined();
    expect(src.beforeInstance).toBeDefined();
  });

  it('set-scene-playback does not capture camera fields', () => {
    const src = captureProvenanceDrilldownSource(
      'set-scene-playback', [INST_A], [INST_A],
      undefined, CAM_A, CAM_B,
    );
    expect(src.beforeCamera).toBeUndefined();
    expect(src.afterCamera).toBeUndefined();
  });

  it('camera slices are shallow copies (not aliased)', () => {
    const src = captureProvenanceDrilldownSource(
      'set-scene-camera', [INST_A], [INST_A],
      { changedFields: ['x'] }, CAM_A, CAM_B,
    );
    expect(src.beforeCamera).toEqual(CAM_A);
    expect(src.beforeCamera).not.toBe(CAM_A);
    expect(src.afterCamera).toEqual(CAM_B);
    expect(src.afterCamera).not.toBe(CAM_B);
  });
});

// ── Camera drilldown derivation ──

describe('deriveProvenanceDiff — camera with values', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };

  it('pan derives camera diff with exact before/after', () => {
    const panBefore: SceneCamera = { x: 10, y: 20, zoom: 1.0 };
    const panAfter: SceneCamera = { x: 50, y: 80, zoom: 1.0 };
    const diff = deriveProvenanceDiff(
      'set-scene-camera', [], [],
      { changedFields: ['x', 'y'] }, panBefore, panAfter,
    );
    expect(diff).toBeDefined();
    expect(diff!.type).toBe('camera');
    if (diff!.type === 'camera') {
      expect(diff!.before).toEqual(panBefore);
      expect(diff!.after).toEqual(panAfter);
      expect(diff!.changedFields).toEqual(['x', 'y']);
    }
  });

  it('zoom derives camera diff with exact before/after', () => {
    const diff = deriveProvenanceDiff(
      'set-scene-camera', [], [],
      { changedFields: ['zoom'] }, CAM_A, { ...CAM_A, zoom: 3.0 },
    );
    expect(diff!.type).toBe('camera');
    if (diff!.type === 'camera') {
      expect(diff!.before!.zoom).toBe(1.0);
      expect(diff!.after!.zoom).toBe(3.0);
    }
  });

  it('reset derives camera diff with all changed fields', () => {
    const diff = deriveProvenanceDiff(
      'set-scene-camera', [], [],
      { changedFields: ['x', 'y', 'zoom'] }, CAM_B, CAM_A,
    );
    expect(diff!.type).toBe('camera');
    if (diff!.type === 'camera') {
      expect(diff!.before).toEqual(CAM_B);
      expect(diff!.after).toEqual(CAM_A);
      expect(diff!.changedFields).toEqual(['x', 'y', 'zoom']);
    }
  });

  it('camera diff without camera params still works (metadata only)', () => {
    const diff = deriveProvenanceDiff(
      'set-scene-camera', [], [],
      { changedFields: ['zoom'] },
    );
    expect(diff!.type).toBe('camera');
    if (diff!.type === 'camera') {
      expect(diff!.changedFields).toEqual(['zoom']);
      expect(diff!.before).toBeUndefined();
      expect(diff!.after).toBeUndefined();
    }
  });

  it('instance diff ignores camera params', () => {
    const diff = deriveProvenanceDiff(
      'move-instance', [INST_A], [{ ...INST_A, x: 200 }],
      { instanceId: 'i1' }, CAM_A, CAM_B,
    );
    expect(diff!.type).toBe('move');
  });
});
