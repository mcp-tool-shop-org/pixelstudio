import { describe, it, expect } from 'vitest';
import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import type { SceneProvenanceEntry } from './sceneProvenance';
import type { SceneProvenanceDrilldownSource } from './sceneProvenanceDrilldown';
import {
  createCurrentAnchor,
  createEntryAnchor,
  createComparisonRequest,
  validateComparisonRequest,
  describeComparison,
  resolveComparisonScopes,
  deriveSceneComparison,
} from './sceneComparison';
import type {
  SceneComparisonSnapshot,
  SceneComparisonAnchor,
} from './sceneComparison';

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

const INST_B: SceneAssetInstance = {
  instanceId: 'i2',
  name: 'Rock',
  sourcePath: '/assets/rock.pxs',
  x: 200,
  y: 300,
  zOrder: 1,
  visible: true,
  opacity: 0.8,
  parallax: 1.0,
};

const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };

const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };

const PB_A: ScenePlaybackConfig = { fps: 12, looping: false };
const PB_B: ScenePlaybackConfig = { fps: 24, looping: true };

const ENTRY_1: SceneProvenanceEntry = {
  sequence: 1,
  kind: 'add-instance',
  label: 'Add Instance (i1)',
  timestamp: '2026-03-16T00:00:00.000Z',
  metadata: { instanceId: 'i1' },
};

const ENTRY_2: SceneProvenanceEntry = {
  sequence: 2,
  kind: 'move-instance',
  label: 'Move Instance (i1)',
  timestamp: '2026-03-16T00:01:00.000Z',
  metadata: { instanceId: 'i1' },
};

const SOURCE_1: SceneProvenanceDrilldownSource = {
  kind: 'add-instance',
  metadata: { instanceId: 'i1' },
  afterInstance: INST_A,
};

const SOURCE_2: SceneProvenanceDrilldownSource = {
  kind: 'move-instance',
  metadata: { instanceId: 'i1' },
  beforeInstance: INST_A,
  afterInstance: { ...INST_A, x: 75, y: 125 },
};

const SOURCE_CAMERA: SceneProvenanceDrilldownSource = {
  kind: 'set-scene-camera',
  beforeCamera: CAM_A,
  afterCamera: CAM_B,
};

const SOURCE_PLAYBACK: SceneProvenanceDrilldownSource = {
  kind: 'set-scene-playback',
  beforePlayback: PB_A,
  afterPlayback: PB_B,
};

// ── createCurrentAnchor ──

describe('createCurrentAnchor', () => {
  it('creates a current anchor with the provided snapshot', () => {
    const snapshot: SceneComparisonSnapshot = {
      instances: [INST_A],
      camera: CAM_A,
      keyframes: [KF_A],
      playbackConfig: PB_A,
    };
    const anchor = createCurrentAnchor(snapshot);
    expect(anchor.type).toBe('current');
    expect(anchor.snapshot).toBe(snapshot);
  });

  it('creates a current anchor with empty instances', () => {
    const snapshot: SceneComparisonSnapshot = { instances: [] };
    const anchor = createCurrentAnchor(snapshot);
    expect(anchor.type).toBe('current');
    expect(anchor.snapshot.instances).toHaveLength(0);
  });
});

// ── createEntryAnchor ──

describe('createEntryAnchor', () => {
  it('creates an entry anchor with afterInstance when no fullInstances', () => {
    const anchor = createEntryAnchor(ENTRY_1, SOURCE_1);
    expect(anchor.type).toBe('entry');
    if (anchor.type === 'entry') {
      expect(anchor.entry).toBe(ENTRY_1);
      expect(anchor.source).toBe(SOURCE_1);
      expect(anchor.snapshot.instances).toHaveLength(1);
      expect(anchor.snapshot.instances[0]).toBe(INST_A);
    }
  });

  it('uses fullInstances when provided', () => {
    const full = [INST_A, INST_B];
    const anchor = createEntryAnchor(ENTRY_1, SOURCE_1, full);
    expect(anchor.type).toBe('entry');
    if (anchor.type === 'entry') {
      expect(anchor.snapshot.instances).toBe(full);
      expect(anchor.snapshot.instances).toHaveLength(2);
    }
  });

  it('populates camera from drilldown source', () => {
    const anchor = createEntryAnchor(
      { ...ENTRY_1, kind: 'set-scene-camera' },
      SOURCE_CAMERA,
    );
    if (anchor.type === 'entry') {
      expect(anchor.snapshot.camera).toBe(CAM_B);
    }
  });

  it('populates playback from drilldown source', () => {
    const anchor = createEntryAnchor(
      { ...ENTRY_1, kind: 'set-scene-playback' },
      SOURCE_PLAYBACK,
    );
    if (anchor.type === 'entry') {
      expect(anchor.snapshot.playbackConfig).toBe(PB_B);
    }
  });

  it('returns empty instances when source has no afterInstance and no fullInstances', () => {
    const source: SceneProvenanceDrilldownSource = {
      kind: 'set-scene-camera',
      beforeCamera: CAM_A,
      afterCamera: CAM_B,
    };
    const anchor = createEntryAnchor(
      { ...ENTRY_1, kind: 'set-scene-camera' },
      source,
    );
    if (anchor.type === 'entry') {
      expect(anchor.snapshot.instances).toHaveLength(0);
    }
  });
});

// ── createComparisonRequest ──

describe('createComparisonRequest', () => {
  it('infers current-vs-entry when left is current', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createEntryAnchor(ENTRY_1, SOURCE_1);
    const req = createComparisonRequest(left, right);
    expect(req.mode).toBe('current-vs-entry');
    expect(req.left).toBe(left);
    expect(req.right).toBe(right);
  });

  it('infers current-vs-entry when right is current', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1);
    const right = createCurrentAnchor({ instances: [INST_A] });
    const req = createComparisonRequest(left, right);
    expect(req.mode).toBe('current-vs-entry');
  });

  it('infers entry-vs-entry when both are entries', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1);
    const right = createEntryAnchor(ENTRY_2, SOURCE_2);
    const req = createComparisonRequest(left, right);
    expect(req.mode).toBe('entry-vs-entry');
  });

  it('infers current-vs-entry when both are current', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [INST_B] });
    const req = createComparisonRequest(left, right);
    expect(req.mode).toBe('current-vs-entry');
  });
});

// ── validateComparisonRequest ──

describe('validateComparisonRequest', () => {
  it('returns undefined for valid current-vs-entry', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createEntryAnchor(ENTRY_1, SOURCE_1);
    const req = createComparisonRequest(left, right);
    expect(validateComparisonRequest(req)).toBeUndefined();
  });

  it('returns undefined for valid entry-vs-entry', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1);
    const right = createEntryAnchor(ENTRY_2, SOURCE_2);
    const req = createComparisonRequest(left, right);
    expect(validateComparisonRequest(req)).toBeUndefined();
  });

  it('returns error for entry-vs-entry with a current anchor', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createEntryAnchor(ENTRY_1, SOURCE_1);
    // Force mode to entry-vs-entry
    const req = { mode: 'entry-vs-entry' as const, left, right };
    expect(validateComparisonRequest(req)).toContain('entry-vs-entry');
  });

  it('returns error for current-vs-entry with no current anchor', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1);
    const right = createEntryAnchor(ENTRY_2, SOURCE_2);
    // Force mode to current-vs-entry
    const req = { mode: 'current-vs-entry' as const, left, right };
    expect(validateComparisonRequest(req)).toContain('current-vs-entry');
  });
});

// ── describeComparison ──

describe('describeComparison', () => {
  it('describes current-vs-entry', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1);
    const right = createCurrentAnchor({ instances: [INST_A] });
    const req = createComparisonRequest(left, right);
    expect(describeComparison(req)).toBe('#1 vs Current');
  });

  it('describes entry-vs-entry', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1);
    const right = createEntryAnchor(ENTRY_2, SOURCE_2);
    const req = createComparisonRequest(left, right);
    expect(describeComparison(req)).toBe('#1 vs #2');
  });

  it('describes current-vs-current', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [INST_B] });
    const req = createComparisonRequest(left, right);
    expect(describeComparison(req)).toBe('Current vs Current');
  });
});

// ── resolveComparisonScopes ──

describe('resolveComparisonScopes', () => {
  it('includes instances when either side has instances', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.has('instances')).toBe(true);
  });

  it('excludes instances when both sides are empty', () => {
    const left = createCurrentAnchor({ instances: [] });
    const right = createCurrentAnchor({ instances: [] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.has('instances')).toBe(false);
  });

  it('includes camera when either side has camera', () => {
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.has('camera')).toBe(true);
  });

  it('excludes camera when neither side has camera', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [INST_B] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.has('camera')).toBe(false);
  });

  it('includes keyframes when either side has keyframes', () => {
    const left = createCurrentAnchor({ instances: [], keyframes: [KF_A] });
    const right = createCurrentAnchor({ instances: [] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.has('keyframes')).toBe(true);
  });

  it('excludes keyframes when neither side has keyframes', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [INST_B] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.has('keyframes')).toBe(false);
  });

  it('includes playback when either side has playback', () => {
    const left = createCurrentAnchor({ instances: [], playbackConfig: PB_A });
    const right = createCurrentAnchor({ instances: [] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.has('playback')).toBe(true);
  });

  it('excludes playback when neither side has playback', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [INST_B] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.has('playback')).toBe(false);
  });

  it('includes all scopes when both sides are fully populated', () => {
    const snapshot: SceneComparisonSnapshot = {
      instances: [INST_A],
      camera: CAM_A,
      keyframes: [KF_A],
      playbackConfig: PB_A,
    };
    const left = createCurrentAnchor(snapshot);
    const right = createCurrentAnchor({
      instances: [INST_B],
      camera: CAM_B,
      keyframes: [KF_B],
      playbackConfig: PB_B,
    });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.size).toBe(4);
    expect(scopes.has('instances')).toBe(true);
    expect(scopes.has('camera')).toBe(true);
    expect(scopes.has('keyframes')).toBe(true);
    expect(scopes.has('playback')).toBe(true);
  });

  it('returns empty set when both sides have nothing', () => {
    const left = createCurrentAnchor({ instances: [] });
    const right = createCurrentAnchor({ instances: [] });
    const req = createComparisonRequest(left, right);
    const scopes = resolveComparisonScopes(req);
    expect(scopes.size).toBe(0);
  });
});

// ── Entry anchor snapshot reconstruction ──

describe('entry anchor snapshot reconstruction', () => {
  it('camera anchor carries afterCamera as snapshot camera', () => {
    const anchor = createEntryAnchor(
      { ...ENTRY_1, kind: 'set-scene-camera' },
      SOURCE_CAMERA,
    );
    if (anchor.type !== 'entry') throw new Error('expected entry');
    expect(anchor.snapshot.camera).toEqual(CAM_B);
    expect(anchor.snapshot.instances).toHaveLength(0);
  });

  it('playback anchor carries afterPlayback as snapshot playback', () => {
    const anchor = createEntryAnchor(
      { ...ENTRY_1, kind: 'set-scene-playback' },
      SOURCE_PLAYBACK,
    );
    if (anchor.type !== 'entry') throw new Error('expected entry');
    expect(anchor.snapshot.playbackConfig).toEqual(PB_B);
  });

  it('instance anchor uses afterInstance when no fullInstances', () => {
    const anchor = createEntryAnchor(ENTRY_1, SOURCE_1);
    if (anchor.type !== 'entry') throw new Error('expected entry');
    expect(anchor.snapshot.instances).toEqual([INST_A]);
  });

  it('instance anchor prefers fullInstances over afterInstance', () => {
    const full = [INST_A, INST_B];
    const anchor = createEntryAnchor(ENTRY_1, SOURCE_1, full);
    if (anchor.type !== 'entry') throw new Error('expected entry');
    expect(anchor.snapshot.instances).toHaveLength(2);
    expect(anchor.snapshot.instances).toBe(full);
  });
});

// ══════════════════════════════════════════════
// ── deriveSceneComparison — top-level ──
// ══════════════════════════════════════════════

describe('deriveSceneComparison — top-level', () => {
  it('current-vs-entry produces a valid result', () => {
    const left = createCurrentAnchor({ instances: [INST_A], camera: CAM_A });
    const right = createEntryAnchor(ENTRY_1, SOURCE_1, [INST_A]);
    const req = createComparisonRequest(left, right);
    const result = deriveSceneComparison(req);
    expect(result.mode).toBe('current-vs-entry');
    expect(result.label).toContain('Current');
  });

  it('entry-vs-entry produces a valid result', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1, [INST_A]);
    const right = createEntryAnchor(ENTRY_2, SOURCE_2, [{ ...INST_A, x: 75, y: 125 }]);
    const req = createComparisonRequest(left, right);
    const result = deriveSceneComparison(req);
    expect(result.mode).toBe('entry-vs-entry');
    expect(result.label).toBe('#1 vs #2');
  });

  it('identical snapshots yield hasChanges = false', () => {
    const left = createCurrentAnchor({ instances: [INST_A], camera: CAM_A, playbackConfig: PB_A });
    const right = createCurrentAnchor({ instances: [INST_A], camera: CAM_A, playbackConfig: PB_A });
    const req = createComparisonRequest(left, right);
    const result = deriveSceneComparison(req);
    expect(result.hasChanges).toBe(false);
  });

  it('changed snapshots yield hasChanges = true', () => {
    const left = createCurrentAnchor({ instances: [INST_A], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [INST_A], camera: CAM_B });
    const req = createComparisonRequest(left, right);
    const result = deriveSceneComparison(req);
    expect(result.hasChanges).toBe(true);
  });
});

// ══════════════════════════════════════════════
// ── Instance comparison ──
// ══════════════════════════════════════════════

describe('deriveSceneComparison — instances', () => {
  it('detects added instance', () => {
    const left = createCurrentAnchor({ instances: [] });
    const right = createCurrentAnchor({ instances: [INST_A] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.instances.status).toBe('changed');
    expect(result.instances.added).toBe(1);
    expect(result.instances.entries[0].status).toBe('added');
    expect(result.instances.entries[0].name).toBe('Tree');
  });

  it('detects removed instance', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.instances.status).toBe('changed');
    expect(result.instances.removed).toBe(1);
    expect(result.instances.entries[0].status).toBe('removed');
    expect(result.instances.entries[0].name).toBe('Tree');
  });

  it('detects moved instance (position change)', () => {
    const moved = { ...INST_A, x: 999, y: 888 };
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [moved] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.instances.changed).toBe(1);
    const entry = result.instances.entries[0];
    expect(entry.status).toBe('changed');
    const xDiff = entry.fieldDiffs.find((d) => d.field === 'x');
    const yDiff = entry.fieldDiffs.find((d) => d.field === 'y');
    expect(xDiff).toBeDefined();
    expect(yDiff).toBeDefined();
    expect(xDiff!.before).toBe('50');
    expect(xDiff!.after).toBe('999');
  });

  it('detects visibility change', () => {
    const hidden = { ...INST_A, visible: false };
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [hidden] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    const entry = result.instances.entries[0];
    expect(entry.status).toBe('changed');
    const diff = entry.fieldDiffs.find((d) => d.field === 'visible');
    expect(diff).toBeDefined();
    expect(diff!.before).toBe('Yes');
    expect(diff!.after).toBe('No');
  });

  it('detects opacity change', () => {
    const dimmed = { ...INST_A, opacity: 0.5 };
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [dimmed] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    const entry = result.instances.entries[0];
    const diff = entry.fieldDiffs.find((d) => d.field === 'opacity');
    expect(diff).toBeDefined();
    expect(diff!.before).toBe('100%');
    expect(diff!.after).toBe('50%');
  });

  it('detects layer change', () => {
    const reordered = { ...INST_A, zOrder: 5 };
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [reordered] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    const entry = result.instances.entries[0];
    const diff = entry.fieldDiffs.find((d) => d.field === 'zOrder');
    expect(diff).toBeDefined();
    expect(diff!.label).toBe('Layer');
  });

  it('detects clip change', () => {
    const clipped = { ...INST_A, clipId: 'walk' };
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [clipped] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    const entry = result.instances.entries[0];
    const diff = entry.fieldDiffs.find((d) => d.field === 'clipId');
    expect(diff).toBeDefined();
    expect(diff!.before).toBe('none');
    expect(diff!.after).toBe('walk');
  });

  it('detects parallax change', () => {
    const parallaxed = { ...INST_A, parallax: 0.5 };
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [parallaxed] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    const entry = result.instances.entries[0];
    const diff = entry.fieldDiffs.find((d) => d.field === 'parallax');
    expect(diff).toBeDefined();
  });

  it('detects character link mode change', () => {
    const charInst: SceneAssetInstance = {
      ...INST_A,
      instanceKind: 'character',
      characterLinkMode: 'linked',
    };
    const unlinked = { ...charInst, characterLinkMode: 'unlinked' as const };
    const left = createCurrentAnchor({ instances: [charInst] });
    const right = createCurrentAnchor({ instances: [unlinked] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    const entry = result.instances.entries[0];
    const diff = entry.fieldDiffs.find((d) => d.field === 'characterLinkMode');
    expect(diff).toBeDefined();
    expect(diff!.before).toBe('linked');
    expect(diff!.after).toBe('unlinked');
  });

  it('detects character override change', () => {
    const charInst: SceneAssetInstance = {
      ...INST_A,
      instanceKind: 'character',
      characterOverrides: {},
    };
    const overridden: SceneAssetInstance = {
      ...charInst,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace', replacementPartId: 'helm-gold' },
      },
    };
    const left = createCurrentAnchor({ instances: [charInst] });
    const right = createCurrentAnchor({ instances: [overridden] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    const entry = result.instances.entries[0];
    const diff = entry.fieldDiffs.find((d) => d.field === 'override:head');
    expect(diff).toBeDefined();
    expect(diff!.before).toBe('none');
    expect(diff!.after).toBe('replace:helm-gold');
  });

  it('stable ordering by instanceId', () => {
    const left = createCurrentAnchor({ instances: [INST_B, INST_A] });
    const right = createCurrentAnchor({ instances: [INST_B, INST_A] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    // Both unchanged, but order should be i1 then i2
    expect(result.instances.unchanged).toBe(2);
  });

  it('unchanged instances are counted but not in entries', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [INST_A] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.instances.status).toBe('unchanged');
    expect(result.instances.unchanged).toBe(1);
    expect(result.instances.entries).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// ── Camera comparison ──
// ══════════════════════════════════════════════

describe('deriveSceneComparison — camera', () => {
  it('detects Pan X difference', () => {
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [], camera: { ...CAM_A, x: 50 } });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.camera.status).toBe('changed');
    expect(result.camera.changedFields).toContain('x');
  });

  it('detects Pan Y difference', () => {
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [], camera: { ...CAM_A, y: 75 } });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.camera.status).toBe('changed');
    expect(result.camera.changedFields).toContain('y');
  });

  it('detects zoom difference', () => {
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [], camera: { ...CAM_A, zoom: 3.0 } });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.camera.status).toBe('changed');
    expect(result.camera.changedFields).toContain('zoom');
  });

  it('stable config order for changed fields', () => {
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [], camera: CAM_B });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    // CAMERA_FIELD_CONFIGS order: x, y, zoom
    expect(result.camera.changedFields).toEqual(['x', 'y', 'zoom']);
  });

  it('identical cameras yield unchanged', () => {
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [], camera: { ...CAM_A } });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.camera.status).toBe('unchanged');
    expect(result.camera.changedFields).toHaveLength(0);
  });

  it('carries before/after camera values', () => {
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [], camera: CAM_B });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.camera.before).toEqual(CAM_A);
    expect(result.camera.after).toEqual(CAM_B);
  });
});

// ══════════════════════════════════════════════
// ── Keyframe comparison ──
// ══════════════════════════════════════════════

describe('deriveSceneComparison — keyframes', () => {
  it('detects added keyframe', () => {
    const left = createCurrentAnchor({ instances: [], keyframes: [] });
    const right = createCurrentAnchor({ instances: [], keyframes: [KF_A] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.keyframes.status).toBe('changed');
    expect(result.keyframes.entries).toHaveLength(1);
    expect(result.keyframes.entries[0].status).toBe('added');
    expect(result.keyframes.entries[0].tick).toBe(0);
  });

  it('detects removed keyframe', () => {
    const left = createCurrentAnchor({ instances: [], keyframes: [KF_A] });
    const right = createCurrentAnchor({ instances: [], keyframes: [] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.keyframes.status).toBe('changed');
    expect(result.keyframes.entries[0].status).toBe('removed');
    expect(result.keyframes.entries[0].tick).toBe(0);
  });

  it('detects edited keyframe value', () => {
    const edited: SceneCameraKeyframe = { ...KF_A, zoom: 3.0 };
    const left = createCurrentAnchor({ instances: [], keyframes: [KF_A] });
    const right = createCurrentAnchor({ instances: [], keyframes: [edited] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.keyframes.status).toBe('changed');
    const entry = result.keyframes.entries[0];
    expect(entry.status).toBe('changed');
    expect(entry.changedFields).toContain('zoom');
  });

  it('detects interpolation change', () => {
    const changed: SceneCameraKeyframe = { ...KF_A, interpolation: 'hold' };
    const left = createCurrentAnchor({ instances: [], keyframes: [KF_A] });
    const right = createCurrentAnchor({ instances: [], keyframes: [changed] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    const entry = result.keyframes.entries[0];
    expect(entry.changedFields).toContain('interpolation');
  });

  it('compares by tick identity, not array index', () => {
    // Left has tick 0, right has tick 30 — these are different keyframes
    const left = createCurrentAnchor({ instances: [], keyframes: [KF_A] });
    const right = createCurrentAnchor({ instances: [], keyframes: [KF_B] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.keyframes.status).toBe('changed');
    // tick 0 removed, tick 30 added
    const removed = result.keyframes.entries.find((e) => e.status === 'removed');
    const added = result.keyframes.entries.find((e) => e.status === 'added');
    expect(removed).toBeDefined();
    expect(added).toBeDefined();
    expect(removed!.tick).toBe(0);
    expect(added!.tick).toBe(30);
  });

  it('unchanged keyframes are omitted from entries', () => {
    const left = createCurrentAnchor({ instances: [], keyframes: [KF_A] });
    const right = createCurrentAnchor({ instances: [], keyframes: [{ ...KF_A }] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.keyframes.status).toBe('unchanged');
    expect(result.keyframes.entries).toHaveLength(0);
  });

  it('stable ordering by tick', () => {
    const left = createCurrentAnchor({ instances: [], keyframes: [KF_B, KF_A] });
    const right = createCurrentAnchor({ instances: [], keyframes: [] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.keyframes.entries[0].tick).toBe(0);
    expect(result.keyframes.entries[1].tick).toBe(30);
  });
});

// ══════════════════════════════════════════════
// ── Playback comparison ──
// ══════════════════════════════════════════════

describe('deriveSceneComparison — playback', () => {
  it('detects FPS difference', () => {
    const left = createCurrentAnchor({ instances: [], playbackConfig: PB_A });
    const right = createCurrentAnchor({ instances: [], playbackConfig: { ...PB_A, fps: 30 } });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.playback.status).toBe('changed');
    expect(result.playback.changedFields).toContain('fps');
  });

  it('detects looping difference', () => {
    const left = createCurrentAnchor({ instances: [], playbackConfig: PB_A });
    const right = createCurrentAnchor({ instances: [], playbackConfig: { ...PB_A, looping: true } });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.playback.status).toBe('changed');
    expect(result.playback.changedFields).toContain('looping');
  });

  it('identical playback yields unchanged', () => {
    const left = createCurrentAnchor({ instances: [], playbackConfig: PB_A });
    const right = createCurrentAnchor({ instances: [], playbackConfig: { ...PB_A } });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.playback.status).toBe('unchanged');
  });

  it('carries before/after values', () => {
    const left = createCurrentAnchor({ instances: [], playbackConfig: PB_A });
    const right = createCurrentAnchor({ instances: [], playbackConfig: PB_B });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.playback.before).toEqual(PB_A);
    expect(result.playback.after).toEqual(PB_B);
  });
});

// ══════════════════════════════════════════════
// ── Fallback / unavailable ──
// ══════════════════════════════════════════════

describe('deriveSceneComparison — fallback', () => {
  it('missing camera data on both sides yields unavailable', () => {
    const left = createCurrentAnchor({ instances: [INST_A] });
    const right = createCurrentAnchor({ instances: [INST_A] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.camera.status).toBe('unavailable');
  });

  it('missing keyframe data on both sides yields unavailable', () => {
    const left = createCurrentAnchor({ instances: [] });
    const right = createCurrentAnchor({ instances: [] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.keyframes.status).toBe('unavailable');
  });

  it('missing playback data on both sides yields unavailable', () => {
    const left = createCurrentAnchor({ instances: [] });
    const right = createCurrentAnchor({ instances: [] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.playback.status).toBe('unavailable');
  });

  it('camera on one side only yields changed (not unavailable)', () => {
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.camera.status).toBe('changed');
    expect(result.camera.before).toEqual(CAM_A);
    expect(result.camera.after).toBeUndefined();
  });

  it('playback on one side only yields changed (not unavailable)', () => {
    const left = createCurrentAnchor({ instances: [] });
    const right = createCurrentAnchor({ instances: [], playbackConfig: PB_B });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.playback.status).toBe('changed');
  });

  it('partial payload does not masquerade as unchanged', () => {
    // Left has camera but right doesn't — this is a change, not no-change
    const left = createCurrentAnchor({ instances: [], camera: CAM_A });
    const right = createCurrentAnchor({ instances: [] });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.hasChanges).toBe(true);
  });

  it('entry-vs-entry works without current live state', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1, [INST_A]);
    const right = createEntryAnchor(ENTRY_2, SOURCE_2, [{ ...INST_A, x: 75 }]);
    const req = createComparisonRequest(left, right);
    const result = deriveSceneComparison(req);
    expect(result.mode).toBe('entry-vs-entry');
    expect(result.instances.changed).toBe(1);
    expect(result.hasChanges).toBe(true);
  });
});

// ══════════════════════════════════════════════
// ── Mixed-domain ──
// ══════════════════════════════════════════════

describe('deriveSceneComparison — mixed domains', () => {
  it('reports changes across all four domains', () => {
    const left = createCurrentAnchor({
      instances: [INST_A],
      camera: CAM_A,
      keyframes: [KF_A],
      playbackConfig: PB_A,
    });
    const right = createCurrentAnchor({
      instances: [{ ...INST_A, x: 999 }],
      camera: CAM_B,
      keyframes: [KF_B],
      playbackConfig: PB_B,
    });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.hasChanges).toBe(true);
    expect(result.instances.status).toBe('changed');
    expect(result.camera.status).toBe('changed');
    expect(result.keyframes.status).toBe('changed');
    expect(result.playback.status).toBe('changed');
  });

  it('only one domain changed, others unchanged', () => {
    const left = createCurrentAnchor({
      instances: [INST_A],
      camera: CAM_A,
      playbackConfig: PB_A,
    });
    const right = createCurrentAnchor({
      instances: [INST_A],
      camera: { ...CAM_A, zoom: 5.0 },
      playbackConfig: PB_A,
    });
    const result = deriveSceneComparison(createComparisonRequest(left, right));
    expect(result.hasChanges).toBe(true);
    expect(result.instances.status).toBe('unchanged');
    expect(result.camera.status).toBe('changed');
    expect(result.playback.status).toBe('unchanged');
  });

  it('comparison label stays sane for mixed changes', () => {
    const left = createEntryAnchor(ENTRY_1, SOURCE_1, [INST_A]);
    const right = createCurrentAnchor({ instances: [INST_B] });
    const req = createComparisonRequest(left, right);
    const result = deriveSceneComparison(req);
    expect(result.label).toBe('#1 vs Current');
  });
});
