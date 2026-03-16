import { describe, it, expect, beforeEach } from 'vitest';
import { useSandboxStore } from './sandboxStore';

const initialPlayback = { fps: 8, looping: true };

function resetStore() {
  useSandboxStore.getState().reset();
}

describe('sandboxStore', () => {
  beforeEach(resetStore);

  // --- Session ---

  it('starts with no session', () => {
    const s = useSandboxStore.getState();
    expect(s.session).toBeNull();
    expect(s.playing).toBe(false);
    expect(s.currentFrame).toBe(0);
    expect(s.playback).toEqual(initialPlayback);
  });

  it('setSession resets playback state', () => {
    useSandboxStore.getState().setPlaying(true);
    useSandboxStore.getState().setCurrentFrame(5);
    useSandboxStore.getState().setError('old error');

    useSandboxStore.getState().setSession({
      sessionId: 'sess1',
      intent: 'idle_bob',
      sourceFrameId: 'f1',
      outputFrameCount: 4,
    } as any);

    const s = useSandboxStore.getState();
    expect(s.session?.sessionId).toBe('sess1');
    expect(s.currentFrame).toBe(0);
    expect(s.playing).toBe(false);
    expect(s.lastError).toBeNull();
  });

  it('setSession clears analysis and paths', () => {
    useSandboxStore.getState().setMetrics({
      sessionId: 'old',
      totalFrames: 4,
    } as any);
    useSandboxStore.getState().setAnchorPaths(
      [{ anchorName: 'Head', points: [] } as any],
      'old',
    );

    useSandboxStore.getState().setSession({ id: 'new' } as any);
    const s = useSandboxStore.getState();
    expect(s.metrics).toBeNull();
    expect(s.anchorPaths).toEqual([]);
    expect(s.selectedAnchorNames).toEqual([]);
  });

  // --- Playback ---

  it('setFps updates FPS', () => {
    useSandboxStore.getState().setFps(24);
    expect(useSandboxStore.getState().playback.fps).toBe(24);
  });

  it('setLooping updates loop flag', () => {
    useSandboxStore.getState().setLooping(false);
    expect(useSandboxStore.getState().playback.looping).toBe(false);
  });

  it('setPlaying toggles', () => {
    useSandboxStore.getState().setPlaying(true);
    expect(useSandboxStore.getState().playing).toBe(true);
  });

  it('setError stops playback', () => {
    useSandboxStore.getState().setPlaying(true);
    useSandboxStore.getState().setError('Failed');
    const s = useSandboxStore.getState();
    expect(s.lastError).toBe('Failed');
    expect(s.playing).toBe(false);
  });

  // --- Analysis ---

  it('setMetrics stores metrics and clears loading', () => {
    useSandboxStore.getState().setAnalysisLoading(true);
    useSandboxStore.getState().setMetrics({
      sessionId: 's1',
      totalFrames: 4,
    } as any);
    const s = useSandboxStore.getState();
    expect(s.metrics).toBeDefined();
    expect(s.analysisLoading).toBe(false);
    expect(s.analysisError).toBeNull();
    expect(s.analyzedSessionId).toBe('s1');
  });

  it('setAnalysisError clears loading', () => {
    useSandboxStore.getState().setAnalysisLoading(true);
    useSandboxStore.getState().setAnalysisError('Analysis failed');
    const s = useSandboxStore.getState();
    expect(s.analysisError).toBe('Analysis failed');
    expect(s.analysisLoading).toBe(false);
  });

  it('clearAnalysis removes metrics', () => {
    useSandboxStore.getState().setMetrics({ sessionId: 's1' } as any);
    useSandboxStore.getState().clearAnalysis();
    const s = useSandboxStore.getState();
    expect(s.metrics).toBeNull();
    expect(s.analyzedSessionId).toBeNull();
  });

  // --- Anchor paths ---

  it('setAnchorPaths stores paths and session', () => {
    const paths = [{ anchorName: 'Head', points: [{ x: 0, y: 0 }] }] as any[];
    useSandboxStore.getState().setAnchorPaths(paths, 'sess1');
    const s = useSandboxStore.getState();
    expect(s.anchorPaths).toHaveLength(1);
    expect(s.pathsSessionId).toBe('sess1');
    expect(s.pathsLoading).toBe(false);
  });

  it('toggleAnchorName adds and removes', () => {
    useSandboxStore.getState().toggleAnchorName('Head');
    expect(useSandboxStore.getState().selectedAnchorNames).toEqual(['Head']);
    useSandboxStore.getState().toggleAnchorName('Torso');
    expect(useSandboxStore.getState().selectedAnchorNames).toEqual(['Head', 'Torso']);
    useSandboxStore.getState().toggleAnchorName('Head');
    expect(useSandboxStore.getState().selectedAnchorNames).toEqual(['Torso']);
  });

  it('clearPaths resets all path state', () => {
    useSandboxStore.getState().setAnchorPaths([{ anchorName: 'A' } as any], 's1');
    useSandboxStore.getState().setSelectedAnchorNames(['A']);
    useSandboxStore.getState().clearPaths();
    const s = useSandboxStore.getState();
    expect(s.anchorPaths).toEqual([]);
    expect(s.selectedAnchorNames).toEqual([]);
    expect(s.pathsSessionId).toBeNull();
  });

  // --- Action state ---

  it('setActionSuccess clears error', () => {
    useSandboxStore.getState().setActionError('failed');
    useSandboxStore.getState().setActionSuccess('Applied');
    const s = useSandboxStore.getState();
    expect(s.actionSuccess).toBe('Applied');
    expect(s.actionError).toBeNull();
  });

  it('setActionError clears success and stops actions', () => {
    useSandboxStore.getState().setApplying(true);
    useSandboxStore.getState().setDuplicating(true);
    useSandboxStore.getState().setActionError('Failed to apply');
    const s = useSandboxStore.getState();
    expect(s.actionError).toBe('Failed to apply');
    expect(s.actionSuccess).toBeNull();
    expect(s.applying).toBe(false);
    expect(s.duplicating).toBe(false);
  });

  it('clearActionFeedback clears both', () => {
    useSandboxStore.getState().setActionSuccess('ok');
    useSandboxStore.getState().clearActionFeedback();
    const s = useSandboxStore.getState();
    expect(s.actionSuccess).toBeNull();
    expect(s.actionError).toBeNull();
  });

  // --- Reset ---

  it('reset restores all state', () => {
    useSandboxStore.getState().setSession({ id: 's' } as any);
    useSandboxStore.getState().setFps(30);
    useSandboxStore.getState().setPlaying(true);
    useSandboxStore.getState().setApplying(true);
    useSandboxStore.getState().reset();

    const s = useSandboxStore.getState();
    expect(s.session).toBeNull();
    expect(s.playback).toEqual(initialPlayback);
    expect(s.playing).toBe(false);
    expect(s.applying).toBe(false);
    expect(s.anchorPaths).toEqual([]);
    expect(s.metrics).toBeNull();
  });
});
