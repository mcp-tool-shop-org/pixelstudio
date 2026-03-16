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
