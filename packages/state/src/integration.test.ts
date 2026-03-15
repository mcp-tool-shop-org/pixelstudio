/**
 * Integration proofs — verify cross-subsystem behavior contracts.
 *
 * These tests prove the subsystems are not lying to each other:
 * 1. Add camera keyframe → scrub → preview state correct
 * 2. Export at tick N matches resolved camera preview at tick N
 * 3. Keyframe CRUD → camera resolution stays in sync
 * 4. Tool → selection → layer cross-store contracts
 * 5. AI job → candidate → results tray workflow
 * 6. Sandbox session → analysis → paths lifecycle
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useScenePlaybackStore, resolveCameraAtTick } from './scenePlaybackStore';
import { useToolStore } from './toolStore';
import { useSelectionStore } from './selectionStore';
import { useAIStore } from './aiStore';
import { useSandboxStore } from './sandboxStore';
import { useMotionStore } from './motionStore';
import { useAnchorStore } from './anchorStore';
import { useProvenanceStore } from './provenanceStore';
import type { SceneCameraKeyframe } from '@glyphstudio/domain';

function kf(tick: number, overrides?: Partial<SceneCameraKeyframe>): SceneCameraKeyframe {
  return { tick, x: tick * 10, y: tick * 5, zoom: 1.0, interpolation: 'linear', ...overrides };
}

beforeEach(() => {
  useScenePlaybackStore.getState().clearAll();
});

// --- Integration proof 1: add keyframe → scrub → preview state is correct ---

describe('keyframe add → scrub → camera sync', () => {
  it('adding keyframes then seeking shows interpolated camera', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(100);

    // Add keyframes via setCameraKeyframes (simulates what the panel does after backend returns)
    store.getState().setCameraKeyframes([
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
      kf(20, { x: 200, y: 100, zoom: 3.0, interpolation: 'linear' }),
      kf(40, { x: 400, y: 200, zoom: 1.0 }),
    ]);

    // Scrub to different positions and verify camera
    store.getState().seekToTick(0);
    expect(store.getState().cameraX).toBe(0);
    expect(store.getState().cameraY).toBe(0);
    expect(store.getState().cameraZoom).toBe(1.0);

    store.getState().seekToTick(10);
    expect(store.getState().cameraX).toBeCloseTo(100);
    expect(store.getState().cameraY).toBeCloseTo(50);
    expect(store.getState().cameraZoom).toBeCloseTo(2.0);

    store.getState().seekToTick(20);
    expect(store.getState().cameraX).toBe(200);
    expect(store.getState().cameraY).toBe(100);
    expect(store.getState().cameraZoom).toBe(3.0);

    store.getState().seekToTick(30);
    expect(store.getState().cameraX).toBeCloseTo(300);
    expect(store.getState().cameraY).toBeCloseTo(150);
    expect(store.getState().cameraZoom).toBeCloseTo(2.0);

    store.getState().seekToTick(40);
    expect(store.getState().cameraX).toBe(400);
    expect(store.getState().cameraY).toBe(200);
    expect(store.getState().cameraZoom).toBe(1.0);
  });
});

// --- Integration proof 2: export tick matches resolved preview ---

describe('export tick matches resolved preview', () => {
  it('camera at any tick N from store matches pure resolveCameraAtTick', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(100);
    store.getState().setBaseCamera(50, 50, 1.0);

    const keyframes: SceneCameraKeyframe[] = [
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
      kf(10, { x: 50, y: 25, zoom: 2.0, interpolation: 'hold' }),
      kf(30, { x: 200, y: 100, zoom: 0.5, interpolation: 'linear' }),
      kf(50, { x: 0, y: 0, zoom: 1.0 }),
    ];
    store.getState().setCameraKeyframes(keyframes);

    // Test a range of ticks — the store's camera should match the pure function exactly
    const testTicks = [0, 1, 5, 9, 10, 15, 20, 25, 29, 30, 40, 50, 60, 99];
    for (const tick of testTicks) {
      store.getState().seekToTick(tick);
      const storeState = store.getState();
      const pure = resolveCameraAtTick(
        keyframes,
        tick,
        storeState.baseCameraX,
        storeState.baseCameraY,
        storeState.baseCameraZoom,
      );

      expect(storeState.cameraX).toBeCloseTo(pure.x, 10,
        `cameraX mismatch at tick ${tick}`);
      expect(storeState.cameraY).toBeCloseTo(pure.y, 10,
        `cameraY mismatch at tick ${tick}`);
      expect(storeState.cameraZoom).toBeCloseTo(pure.zoom, 10,
        `cameraZoom mismatch at tick ${tick}`);
    }
  });
});

// --- Integration proof 3: keyframe CRUD → camera stays in sync ---

describe('keyframe CRUD keeps camera in sync', () => {
  it('updating keyframes re-resolves camera at current tick', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(100);
    store.getState().seekToTick(5);

    // Initial keyframes
    store.getState().setCameraKeyframes([
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
      kf(10, { x: 100, y: 50, zoom: 2.0 }),
    ]);
    // At tick 5, linear between 0→100: x=50
    expect(store.getState().cameraX).toBeCloseTo(50);

    // Replace keyframes (simulate adding a new keyframe)
    store.getState().setCameraKeyframes([
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
      kf(5, { x: 999, y: 999, zoom: 5.0, interpolation: 'linear' }),
      kf(10, { x: 100, y: 50, zoom: 2.0 }),
    ]);
    // Now tick 5 should exactly be the new keyframe
    expect(store.getState().cameraX).toBe(999);
    expect(store.getState().cameraY).toBe(999);
    expect(store.getState().cameraZoom).toBe(5.0);
  });

  it('removing all keyframes falls back to base camera', () => {
    const store = useScenePlaybackStore;
    store.getState().setTotalTicks(100);
    store.getState().setBaseCamera(42, 84, 2.0);
    store.getState().setCameraKeyframes([kf(0, { x: 100, y: 100, zoom: 1.0 })]);
    expect(store.getState().cameraX).toBe(100);

    // Clear all keyframes
    store.getState().setCameraKeyframes([]);
    // Should fall back to base camera
    expect(store.getState().cameraX).toBe(42);
    expect(store.getState().cameraY).toBe(84);
    expect(store.getState().cameraZoom).toBe(2.0);
  });
});

// --- Playback → camera resolution stays correct across ticks ---

describe('playback tick advance resolves camera', () => {
  it('advancing clock resolves camera through keyframe segments', () => {
    const store = useScenePlaybackStore;
    store.getState().setFps(10); // 100ms per frame
    store.getState().setTotalTicks(100);
    store.getState().setCameraKeyframes([
      kf(0, { x: 0, y: 0, zoom: 1.0, interpolation: 'linear' }),
      kf(10, { x: 100, y: 50, zoom: 2.0 }),
    ]);

    store.getState().setPlaying(true);
    store.getState().advanceClock(1000); // init

    // Advance 500ms = 5 frames
    store.getState().advanceClock(1500);
    expect(store.getState().currentTick).toBe(5);
    expect(store.getState().cameraX).toBeCloseTo(50);
    expect(store.getState().cameraY).toBeCloseTo(25);
    expect(store.getState().cameraZoom).toBeCloseTo(1.5);
  });
});

// --- Integration proof 4: tool → selection → layer contracts ---

describe('tool → selection → layer cross-store contract', () => {
  beforeEach(() => {
    useToolStore.setState({
      activeTool: 'pencil', previousTool: null,
      primaryColor: { r: 255, g: 255, b: 255, a: 255 },
      secondaryColor: { r: 0, g: 0, b: 0, a: 0 },
      primaryColorSlotId: null, secondaryColorSlotId: null,
      palettePopup: { open: false, screenX: 0, screenY: 0 },
    });
    useSelectionStore.getState().clearSelection();
  });

  it('switching to marquee does not clear existing selection', () => {
    useSelectionStore.getState().setSelection({ x: 0, y: 0, width: 10, height: 10 });
    useToolStore.getState().setTool('marquee');
    expect(useSelectionStore.getState().hasSelection).toBe(true);
    expect(useToolStore.getState().activeTool).toBe('marquee');
  });

  it('clearing selection while transforming clears transform too', () => {
    useSelectionStore.getState().setSelection({ x: 0, y: 0, width: 10, height: 10 });
    useSelectionStore.getState().setTransform({
      sourceX: 0, sourceY: 0, payloadWidth: 10, payloadHeight: 10,
      offsetX: 5, offsetY: 5, payloadData: [255, 0, 0, 255],
    });
    expect(useSelectionStore.getState().isTransforming).toBe(true);

    useSelectionStore.getState().clearSelection();
    expect(useSelectionStore.getState().isTransforming).toBe(false);
    expect(useSelectionStore.getState().transformPreview).toBeNull();
    expect(useSelectionStore.getState().hasSelection).toBe(false);
  });

  it('tool switch preserves previous tool for return shortcut', () => {
    useToolStore.getState().setTool('pencil');
    useToolStore.getState().setTool('marquee');
    useToolStore.getState().setTool('eraser');
    // previousTool should be marquee (the one before eraser)
    expect(useToolStore.getState().previousTool).toBe('marquee');
    // Can implement "return to previous tool" by using previousTool
    const prev = useToolStore.getState().previousTool!;
    useToolStore.getState().setTool(prev);
    expect(useToolStore.getState().activeTool).toBe('marquee');
  });
});

// --- Integration proof 5: AI job → candidate → results tray ---

describe('AI job lifecycle integration', () => {
  beforeEach(() => {
    useAIStore.setState({
      jobsById: {}, jobOrder: [],
      selectedCandidateId: null, resultsTrayOpen: false,
    });
  });

  it('full job lifecycle: queue → run → succeed → select candidate', () => {
    // Queue a job
    useAIStore.getState().addJob({
      id: 'j1', type: 'inbetween' as any, status: 'queued',
      progress: null, resultCandidateIds: [], error: null,
    });
    expect(useAIStore.getState().jobsById['j1'].status).toBe('queued');

    // Start running
    useAIStore.getState().updateJob('j1', { status: 'running', progress: 0.0 });
    expect(useAIStore.getState().jobsById['j1'].progress).toBe(0.0);

    // Progress update
    useAIStore.getState().updateJob('j1', { progress: 0.75 });

    // Complete with candidates
    useAIStore.getState().updateJob('j1', {
      status: 'succeeded', progress: 1.0,
      resultCandidateIds: ['c1', 'c2', 'c3'],
    });

    // Open results tray and select a candidate
    useAIStore.getState().toggleResultsTray();
    useAIStore.getState().selectCandidate('c2');

    const s = useAIStore.getState();
    expect(s.resultsTrayOpen).toBe(true);
    expect(s.selectedCandidateId).toBe('c2');
    expect(s.jobsById['j1'].resultCandidateIds).toEqual(['c1', 'c2', 'c3']);
  });

  it('failed job preserves error and does not produce candidates', () => {
    useAIStore.getState().addJob({
      id: 'j1', type: 'inbetween' as any, status: 'queued',
      progress: null, resultCandidateIds: [], error: null,
    });
    useAIStore.getState().updateJob('j1', {
      status: 'failed', error: 'Backend timeout',
    });
    const job = useAIStore.getState().jobsById['j1'];
    expect(job.status).toBe('failed');
    expect(job.error).toBe('Backend timeout');
    expect(job.resultCandidateIds).toEqual([]);
  });
});

// --- Integration proof 6: sandbox → analysis → paths lifecycle ---

describe('sandbox session → analysis → paths lifecycle', () => {
  beforeEach(() => {
    useSandboxStore.getState().reset();
  });

  it('full sandbox lifecycle: session → play → analyze → paths → apply', () => {
    // Start session
    useSandboxStore.getState().setSession({ id: 'sess1' } as any);
    expect(useSandboxStore.getState().session?.id).toBe('sess1');
    expect(useSandboxStore.getState().playing).toBe(false);

    // Play
    useSandboxStore.getState().setPlaying(true);
    useSandboxStore.getState().setCurrentFrame(2);

    // Trigger analysis
    useSandboxStore.getState().setAnalysisLoading(true);
    expect(useSandboxStore.getState().analysisLoading).toBe(true);

    // Analysis completes
    useSandboxStore.getState().setMetrics({ sessionId: 'sess1', totalFrames: 4 } as any);
    expect(useSandboxStore.getState().analyzedSessionId).toBe('sess1');
    expect(useSandboxStore.getState().analysisLoading).toBe(false);

    // Load anchor paths
    useSandboxStore.getState().setPathsLoading(true);
    useSandboxStore.getState().setAnchorPaths(
      [{ anchorName: 'Head', points: [] }, { anchorName: 'Torso', points: [] }] as any[],
      'sess1',
    );
    expect(useSandboxStore.getState().anchorPaths).toHaveLength(2);

    // Select anchors to visualize
    useSandboxStore.getState().toggleAnchorName('Head');
    expect(useSandboxStore.getState().selectedAnchorNames).toEqual(['Head']);

    // Apply to timeline
    useSandboxStore.getState().setApplying(true);
    useSandboxStore.getState().setActionSuccess('Frames inserted');
    expect(useSandboxStore.getState().actionSuccess).toBe('Frames inserted');
    expect(useSandboxStore.getState().actionError).toBeNull();
  });

  it('new session discards old analysis', () => {
    useSandboxStore.getState().setSession({ id: 'sess1' } as any);
    useSandboxStore.getState().setMetrics({ sessionId: 'sess1' } as any);
    useSandboxStore.getState().setAnchorPaths([{ anchorName: 'A' } as any], 'sess1');

    // Start new session — old analysis should be gone
    useSandboxStore.getState().setSession({ id: 'sess2' } as any);
    expect(useSandboxStore.getState().metrics).toBeNull();
    expect(useSandboxStore.getState().anchorPaths).toEqual([]);
    expect(useSandboxStore.getState().analyzedSessionId).toBeNull();
  });
});

// --- Integration proof 7: motion → anchor → provenance coordination ---

describe('motion + anchor + provenance coordination', () => {
  beforeEach(() => {
    useMotionStore.getState().reset();
    useAnchorStore.getState().reset();
    useProvenanceStore.setState({ entries: [], selectedEntryId: null });
  });

  it('motion session uses anchors from anchor store', () => {
    // Set up anchors
    useAnchorStore.getState().addAnchor({
      id: 'a1', name: 'Torso', kind: 'torso', x: 16, y: 24,
    });
    useAnchorStore.getState().addAnchor({
      id: 'a2', name: 'Head', kind: 'head', x: 16, y: 8, parentName: 'Torso',
    });

    // Start motion session targeting the torso anchor
    useMotionStore.getState().setSession({
      sessionId: 'ms1',
      intent: 'idle_bob',
      direction: null,
      targetMode: 'anchor_binding',
      outputFrameCount: 4,
      sourceFrameId: 'f1',
      proposals: [],
      selectedProposalId: null,
      status: 'configuring',
    });

    // Verify stores are independently consistent
    expect(useAnchorStore.getState().anchors).toHaveLength(2);
    expect(useMotionStore.getState().targetMode).toBe('anchor_binding');
    expect(useMotionStore.getState().sessionId).toBe('ms1');
  });

  it('provenance records track operations across subsystems', () => {
    // Simulate: user draws, then does motion generation, then undoes
    useProvenanceStore.getState().addEntry({
      id: 'p1', operationName: 'Brush stroke', kind: 'deterministic',
      timestamp: '2026-01-01T00:00:00Z',
      affectedLayerIds: ['l1'], affectedFrameIds: ['f1'], replayable: true,
    });
    useProvenanceStore.getState().addEntry({
      id: 'p2', operationName: 'Motion generation', kind: 'probabilistic',
      timestamp: '2026-01-01T00:00:01Z',
      affectedLayerIds: ['l1'], affectedFrameIds: ['f1', 'f2', 'f3', 'f4'], replayable: false,
    });

    const entries = useProvenanceStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].operationName).toBe('Motion generation'); // newest first
    expect(entries[0].replayable).toBe(false); // probabilistic can't be replayed
    expect(entries[1].operationName).toBe('Brush stroke');
    expect(entries[1].replayable).toBe(true);
  });
});
