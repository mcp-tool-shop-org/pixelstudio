import { describe, it, expect } from 'vitest';
import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
import {
  deriveSceneRestore,
  describeSceneRestore,
  FULL_RESTORE_DOMAINS,
  RESTORE_SCOPE_LABELS,
  SELECTIVE_RESTORE_SCOPES,
} from './sceneRestore';
import type {
  SceneRestoreRequest,
  SceneRestoreSnapshot,
  SceneRestoreResult,
  SceneRestoreScope,
} from './sceneRestore';

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

const INST_A_MOVED: SceneAssetInstance = {
  ...INST_A,
  x: 999,
  y: 888,
};

const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
const CAM_B: SceneCamera = { x: 100, y: 50, zoom: 2.0 };

const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };

const PB_A: ScenePlaybackConfig = { fps: 12, looping: false };
const PB_B: ScenePlaybackConfig = { fps: 24, looping: true };

function makeRequest(
  source: Partial<SceneRestoreSnapshot>,
  current: Partial<SceneRestoreSnapshot>,
  sequence = 5,
  scope: SceneRestoreScope = 'full',
): SceneRestoreRequest {
  return {
    scope,
    sourceSequence: sequence,
    sourceSnapshot: {
      instances: [],
      ...source,
    },
    currentSnapshot: {
      instances: [],
      ...current,
    },
  };
}

// ── Contract tests ──

describe('sceneRestore contract', () => {
  it('SceneRestoreRequest requires scope, sourceSequence, and snapshots', () => {
    const req: SceneRestoreRequest = {
      scope: 'full',
      sourceSequence: 3,
      sourceSnapshot: { instances: [INST_A] },
      currentSnapshot: { instances: [INST_B] },
    };
    expect(req.scope).toBe('full');
    expect(req.sourceSequence).toBe(3);
    expect(req.sourceSnapshot.instances).toHaveLength(1);
    expect(req.currentSnapshot.instances).toHaveLength(1);
  });

  it('FULL_RESTORE_DOMAINS covers instances, camera, keyframes, playbackConfig', () => {
    expect(FULL_RESTORE_DOMAINS).toEqual(['instances', 'camera', 'keyframes', 'playbackConfig']);
  });

  it('FULL_RESTORE_DOMAINS does not include transient playback state', () => {
    const domains = FULL_RESTORE_DOMAINS as readonly string[];
    expect(domains).not.toContain('isPlaying');
    expect(domains).not.toContain('currentTick');
  });

  it('SceneRestoreResult success variant carries all authored domains', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A, keyframes: [KF_A], playbackConfig: PB_A },
      { instances: [INST_B], camera: CAM_B, keyframes: [KF_B], playbackConfig: PB_B },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.instances).toBeDefined();
    expect(result.camera).toBeDefined();
    expect(result.keyframes).toBeDefined();
    expect(result.playbackConfig).toBeDefined();
    expect(result.before).toBeDefined();
    expect(result.after).toBeDefined();
    expect(result.label).toBeDefined();
  });

  it('SceneRestoreResult unavailable variant carries reason and label', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_A] },
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('source-matches-current');
    expect(result.label).toBeTruthy();
  });
});

// ── Success derivation tests ──

describe('deriveSceneRestore success', () => {
  it('restores all instances from source snapshot', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A, INST_B] },
      { instances: [INST_A_MOVED] },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.instances).toHaveLength(2);
    expect(result.instances[0].instanceId).toBe('i1');
    expect(result.instances[0].x).toBe(50); // original position, not moved
    expect(result.instances[1].instanceId).toBe('i2');
  });

  it('restores camera from source when available', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.camera).toEqual(CAM_A);
  });

  it('restores keyframes from source when available', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], keyframes: [KF_A] },
      { instances: [INST_B], keyframes: [KF_B] },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.keyframes).toHaveLength(1);
    expect(result.keyframes![0].tick).toBe(0);
  });

  it('restores playback config from source when available', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], playbackConfig: PB_A },
      { instances: [INST_B], playbackConfig: PB_B },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.playbackConfig).toEqual(PB_A);
  });

  it('preserves current camera when source has no camera data', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_B], camera: CAM_B },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.camera).toEqual(CAM_B);
  });

  it('preserves current keyframes when source has no keyframe data', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_B], keyframes: [KF_B] },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.keyframes).toHaveLength(1);
    expect(result.keyframes![0].tick).toBe(30);
  });

  it('preserves current playback when source has no playback data', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_B], playbackConfig: PB_B },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.playbackConfig).toEqual(PB_B);
  });

  it('before snapshot captures current state', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.before.instances).toHaveLength(1);
    expect(result.before.instances[0].instanceId).toBe('i2');
    expect(result.before.camera).toEqual(CAM_B);
  });

  it('after snapshot captures restored state', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.after.instances).toHaveLength(1);
    expect(result.after.instances[0].instanceId).toBe('i1');
    expect(result.after.camera).toEqual(CAM_A);
  });

  it('deep clones instances — no aliasing between result and input', () => {
    const source: SceneRestoreSnapshot = { instances: [{ ...INST_A }] };
    const current: SceneRestoreSnapshot = { instances: [{ ...INST_B }] };
    const result = deriveSceneRestore({
      scope: 'full',
      sourceSequence: 1,
      sourceSnapshot: source,
      currentSnapshot: current,
    });
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    // Mutating the result should not affect the input
    result.instances[0].x = -1;
    expect(source.instances[0].x).toBe(50);
  });

  it('includes character fields in restored instances', () => {
    const charInstance: SceneAssetInstance = {
      ...INST_A,
      instanceKind: 'character',
      sourceCharacterBuildId: 'build-1',
      characterLinkMode: 'linked',
      characterSlotSnapshot: { slots: { head: 'p1' }, equippedCount: 1, totalSlots: 3 },
      characterOverrides: { body: { slot: 'body', mode: 'remove' } },
    };
    const result = deriveSceneRestore(makeRequest(
      { instances: [charInstance] },
      { instances: [INST_B] },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.instances[0].sourceCharacterBuildId).toBe('build-1');
    expect(result.instances[0].characterLinkMode).toBe('linked');
    expect(result.instances[0].characterSlotSnapshot).toBeDefined();
    expect(result.instances[0].characterOverrides).toBeDefined();
  });
});

// ── Exclusion tests ──

describe('deriveSceneRestore exclusions', () => {
  it('does not include isPlaying in restore snapshot type', () => {
    // Type-level check: SceneRestoreSnapshot has no isPlaying field
    const snap: SceneRestoreSnapshot = { instances: [] };
    expect('isPlaying' in snap).toBe(false);
  });

  it('does not include currentTick in restore snapshot type', () => {
    const snap: SceneRestoreSnapshot = { instances: [] };
    expect('currentTick' in snap).toBe(false);
  });

  it('restores playbackConfig (authored) but not transient playback state', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], playbackConfig: PB_A },
      { instances: [INST_B], playbackConfig: PB_B },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.playbackConfig).toEqual({ fps: 12, looping: false });
    // No transient fields in result
    expect('isPlaying' in result).toBe(false);
    expect('currentTick' in result).toBe(false);
  });
});

// ── Unavailable / failure tests ──

describe('deriveSceneRestore unavailable', () => {
  it('returns source-matches-current when source equals current (instances only)', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_A] },
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('source-matches-current');
  });

  it('returns source-matches-current when all domains match', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A, keyframes: [KF_A], playbackConfig: PB_A },
      { instances: [INST_A], camera: CAM_A, keyframes: [KF_A], playbackConfig: PB_A },
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('source-matches-current');
  });

  it('returns source-matches-current when both snapshots have empty instances and no other data', () => {
    const result = deriveSceneRestore(makeRequest({}, {}));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('source-matches-current');
  });

  it('label includes sequence number on unavailable result', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_A] },
      42,
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.label).toContain('#42');
  });
});

// ── Label tests ──

describe('describeSceneRestore', () => {
  it('full scope produces "Restore #N"', () => {
    expect(describeSceneRestore(7, 'full')).toBe('Restore #7');
  });

  it('label includes sequence number', () => {
    expect(describeSceneRestore(42, 'full')).toContain('#42');
  });

  it('success result label matches describeSceneRestore output', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_B] },
      10,
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.label).toBe('Restore #10');
  });
});

// ── History snapshot shape tests ──

describe('deriveSceneRestore history snapshots', () => {
  it('before snapshot omits camera when current has no camera', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B] },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.before.camera).toBeUndefined();
  });

  it('after snapshot includes camera when source provides it', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B] },
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.after.camera).toEqual(CAM_A);
  });

  it('before and after snapshots are deep clones of input', () => {
    const source: SceneRestoreSnapshot = { instances: [{ ...INST_A }] };
    const current: SceneRestoreSnapshot = { instances: [{ ...INST_B }] };
    const result = deriveSceneRestore({
      scope: 'full',
      sourceSequence: 1,
      sourceSnapshot: source,
      currentSnapshot: current,
    });
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    result.before.instances[0].x = -999;
    result.after.instances[0].x = -999;
    expect(current.instances[0].x).toBe(200);
    expect(source.instances[0].x).toBe(50);
  });
});

// ── Scope labels and constants ──

describe('restore scope labels and constants', () => {
  it('RESTORE_SCOPE_LABELS has operator-readable labels', () => {
    expect(RESTORE_SCOPE_LABELS.full).toBe('Full Scene');
    expect(RESTORE_SCOPE_LABELS.camera).toBe('Camera');
    expect(RESTORE_SCOPE_LABELS.keyframes).toBe('Keyframes');
    expect(RESTORE_SCOPE_LABELS.instances).toBe('Instances');
  });

  it('SELECTIVE_RESTORE_SCOPES excludes full', () => {
    expect(SELECTIVE_RESTORE_SCOPES).not.toContain('full');
    expect(SELECTIVE_RESTORE_SCOPES).toContain('instances');
    expect(SELECTIVE_RESTORE_SCOPES).toContain('camera');
    expect(SELECTIVE_RESTORE_SCOPES).toContain('keyframes');
  });

  it('SELECTIVE_RESTORE_SCOPES does not include playback', () => {
    expect(SELECTIVE_RESTORE_SCOPES).not.toContain('playback');
  });

  it('describeSceneRestore includes scope label for non-full scopes', () => {
    expect(describeSceneRestore(3, 'camera')).toBe('Restore #3 (Camera)');
    expect(describeSceneRestore(7, 'keyframes')).toBe('Restore #7 (Keyframes)');
    expect(describeSceneRestore(1, 'instances')).toBe('Restore #1 (Instances)');
  });

  it('describeSceneRestore omits scope label for full', () => {
    expect(describeSceneRestore(5, 'full')).toBe('Restore #5');
  });
});

// ── Camera-scoped restore ──

describe('deriveSceneRestore camera scope', () => {
  it('restores only camera from source, preserves current instances', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
      5,
      'camera',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.camera).toEqual(CAM_A);
    expect(result.instances).toEqual([INST_B]); // current preserved
  });

  it('preserves current keyframes when restoring camera', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A, keyframes: [KF_A] },
      { instances: [INST_B], camera: CAM_B, keyframes: [KF_B] },
      5,
      'camera',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.keyframes).toEqual([KF_B]); // current preserved
  });

  it('preserves current playback config when restoring camera', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A, playbackConfig: PB_A },
      { instances: [INST_B], camera: CAM_B, playbackConfig: PB_B },
      5,
      'camera',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.playbackConfig).toEqual(PB_B); // current preserved
  });

  it('returns missing-domain-data when source has no camera', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_B], camera: CAM_B },
      5,
      'camera',
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('missing-domain-data');
    expect(result.label).toContain('Camera');
  });

  it('returns source-matches-current when camera already matches', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_A },
      5,
      'camera',
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('source-matches-current');
  });

  it('camera restore does not fail because keyframes are missing', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
      5,
      'camera',
    ));
    expect(result.status).toBe('success');
  });

  it('history snapshots reflect only camera change', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
      5,
      'camera',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    // Instances identical in before and after
    expect(result.before.instances).toEqual(result.after.instances);
    expect(result.before.camera).toEqual(CAM_B);
    expect(result.after.camera).toEqual(CAM_A);
  });

  it('label includes scope name', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
      3,
      'camera',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.label).toBe('Restore #3 (Camera)');
  });
});

// ── Keyframes-scoped restore ──

describe('deriveSceneRestore keyframes scope', () => {
  it('restores only keyframes from source, preserves current instances', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], keyframes: [KF_A] },
      { instances: [INST_B], keyframes: [KF_B] },
      5,
      'keyframes',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.keyframes).toEqual([KF_A]);
    expect(result.instances).toEqual([INST_B]); // current preserved
  });

  it('preserves current camera when restoring keyframes', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], keyframes: [KF_A], camera: CAM_A },
      { instances: [INST_B], keyframes: [KF_B], camera: CAM_B },
      5,
      'keyframes',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.camera).toEqual(CAM_B); // current preserved
  });

  it('preserves current playback config when restoring keyframes', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], keyframes: [KF_A], playbackConfig: PB_A },
      { instances: [INST_B], keyframes: [KF_B], playbackConfig: PB_B },
      5,
      'keyframes',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.playbackConfig).toEqual(PB_B); // current preserved
  });

  it('returns missing-domain-data when source has no keyframes', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], keyframes: [KF_B] },
      5,
      'keyframes',
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('missing-domain-data');
    expect(result.label).toContain('Keyframes');
  });

  it('returns source-matches-current when keyframes already match', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], keyframes: [KF_A] },
      { instances: [INST_B], keyframes: [KF_A] },
      5,
      'keyframes',
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('source-matches-current');
  });

  it('keyframes restore does not fail because camera is missing', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], keyframes: [KF_A] },
      { instances: [INST_B], keyframes: [KF_B] },
      5,
      'keyframes',
    ));
    expect(result.status).toBe('success');
  });

  it('label includes scope name', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], keyframes: [KF_A] },
      { instances: [INST_B], keyframes: [KF_B] },
      3,
      'keyframes',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.label).toBe('Restore #3 (Keyframes)');
  });
});

// ── Instances-scoped restore ──

describe('deriveSceneRestore instances scope', () => {
  it('restores only instances from source, preserves current camera', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
      5,
      'instances',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.instances).toEqual([INST_A]);
    expect(result.camera).toEqual(CAM_B); // current preserved
  });

  it('preserves current keyframes when restoring instances', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], keyframes: [KF_A] },
      { instances: [INST_B], keyframes: [KF_B] },
      5,
      'instances',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.keyframes).toEqual([KF_B]); // current preserved
  });

  it('preserves current playback config when restoring instances', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], playbackConfig: PB_A },
      { instances: [INST_B], playbackConfig: PB_B },
      5,
      'instances',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.playbackConfig).toEqual(PB_B); // current preserved
  });

  it('returns missing-domain-data when source has empty instances', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [] },
      { instances: [INST_B] },
      5,
      'instances',
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('missing-domain-data');
    expect(result.label).toContain('Instances');
  });

  it('returns source-matches-current when instances already match', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_A] },
      5,
      'instances',
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('source-matches-current');
  });

  it('instances restore does not fail because playback is missing', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_B] },
      5,
      'instances',
    ));
    expect(result.status).toBe('success');
  });

  it('history snapshots reflect only instances change', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
      5,
      'instances',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    // Camera identical in before and after
    expect(result.before.camera).toEqual(CAM_B);
    expect(result.after.camera).toEqual(CAM_B);
    // Instances differ
    expect(result.before.instances[0].instanceId).toBe('i2');
    expect(result.after.instances[0].instanceId).toBe('i1');
  });

  it('includes character fields in scoped instance restore', () => {
    const charInstance: SceneAssetInstance = {
      ...INST_A,
      instanceKind: 'character',
      sourceCharacterBuildId: 'build-1',
      characterLinkMode: 'linked',
      characterSlotSnapshot: { slots: { head: 'p1' }, equippedCount: 1, totalSlots: 3 },
    };
    const result = deriveSceneRestore(makeRequest(
      { instances: [charInstance] },
      { instances: [INST_B] },
      5,
      'instances',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.instances[0].sourceCharacterBuildId).toBe('build-1');
  });

  it('label includes scope name', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A] },
      { instances: [INST_B] },
      3,
      'instances',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.label).toBe('Restore #3 (Instances)');
  });
});

// ── Cross-scope isolation ──

describe('deriveSceneRestore cross-scope isolation', () => {
  it('full scope restores all domains', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A, keyframes: [KF_A], playbackConfig: PB_A },
      { instances: [INST_B], camera: CAM_B, keyframes: [KF_B], playbackConfig: PB_B },
      5,
      'full',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.instances).toEqual([INST_A]);
    expect(result.camera).toEqual(CAM_A);
    expect(result.keyframes).toEqual([KF_A]);
    expect(result.playbackConfig).toEqual(PB_A);
  });

  it('camera scope does not touch instances even when source has different ones', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
      5,
      'camera',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.instances[0].instanceId).toBe('i2'); // current, not source
  });

  it('instances scope does not touch camera even when source has different one', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A },
      { instances: [INST_B], camera: CAM_B },
      5,
      'instances',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.camera).toEqual(CAM_B); // current, not source
  });

  it('keyframes scope does not touch instances or camera', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A, keyframes: [KF_A] },
      { instances: [INST_B], camera: CAM_B, keyframes: [KF_B] },
      5,
      'keyframes',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.instances[0].instanceId).toBe('i2'); // current
    expect(result.camera).toEqual(CAM_B); // current
    expect(result.keyframes).toEqual([KF_A]); // restored
  });

  it('selective restore never mutates authored playback config', () => {
    for (const scope of SELECTIVE_RESTORE_SCOPES) {
      const result = deriveSceneRestore(makeRequest(
        { instances: [INST_A], camera: CAM_A, keyframes: [KF_A], playbackConfig: PB_A },
        { instances: [INST_B], camera: CAM_B, keyframes: [KF_B], playbackConfig: PB_B },
        5,
        scope,
      ));
      if (result.status !== 'success') continue;
      // Playback config always preserved from current
      expect(result.playbackConfig).toEqual(PB_B);
    }
  });

  it('full restore includes authored playback config from source', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A, keyframes: [KF_A], playbackConfig: PB_A },
      { instances: [INST_B], camera: CAM_B, keyframes: [KF_B], playbackConfig: PB_B },
      5,
      'full',
    ));
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.playbackConfig).toEqual(PB_A);
  });

  it('playback scope is not a valid SceneRestoreScope', () => {
    const result = deriveSceneRestore(makeRequest(
      { instances: [INST_A], camera: CAM_A, playbackConfig: PB_A },
      { instances: [INST_B], camera: CAM_B, playbackConfig: PB_B },
      5,
      'playback' as any,
    ));
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toBe('scope-not-supported');
  });
});
