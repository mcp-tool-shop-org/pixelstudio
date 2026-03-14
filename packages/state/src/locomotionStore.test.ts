import { describe, it, expect, beforeEach } from 'vitest';
import { useLocomotionStore } from './locomotionStore';

function makeAnalysis(id: string) {
  return {
    id,
    weightClass: 'standard' as const,
    cadence: 120,
    strideSymmetryScore: 0.95,
    centerOfMassPath: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    silhouetteStabilityScore: 0.8,
    notes: ['test note'],
  };
}

describe('locomotionStore', () => {
  beforeEach(() => {
    // Reset to initial state by replacing analysis state
    useLocomotionStore.setState({
      activeAnalysisId: null,
      analysesById: {},
      previewMode: 'gameplay',
      showFootfalls: true,
      showRootMotion: true,
      showCenterOfMass: true,
      showCollisionWarnings: true,
    });
  });

  // --- Analysis ---

  it('starts with no active analysis', () => {
    const s = useLocomotionStore.getState();
    expect(s.activeAnalysisId).toBeNull();
    expect(s.analysesById).toEqual({});
  });

  it('setAnalysis stores and activates analysis', () => {
    const a = makeAnalysis('a1');
    useLocomotionStore.getState().setAnalysis(a);
    const s = useLocomotionStore.getState();
    expect(s.activeAnalysisId).toBe('a1');
    expect(s.analysesById['a1']).toEqual(a);
  });

  it('setAnalysis accumulates multiple analyses', () => {
    useLocomotionStore.getState().setAnalysis(makeAnalysis('a1'));
    useLocomotionStore.getState().setAnalysis(makeAnalysis('a2'));
    const s = useLocomotionStore.getState();
    expect(s.activeAnalysisId).toBe('a2'); // latest is active
    expect(Object.keys(s.analysesById)).toHaveLength(2);
  });

  it('setAnalysis overwrites existing analysis with same id', () => {
    useLocomotionStore.getState().setAnalysis(makeAnalysis('a1'));
    const updated = { ...makeAnalysis('a1'), cadence: 200 };
    useLocomotionStore.getState().setAnalysis(updated);
    expect(useLocomotionStore.getState().analysesById['a1'].cadence).toBe(200);
  });

  // --- Preview mode ---

  it('starts in gameplay mode', () => {
    expect(useLocomotionStore.getState().previewMode).toBe('gameplay');
  });

  it('setPreviewMode changes mode', () => {
    useLocomotionStore.getState().setPreviewMode('side-by-side');
    expect(useLocomotionStore.getState().previewMode).toBe('side-by-side');
  });

  // --- Overlay toggles ---

  it('toggleOverlay flips showFootfalls', () => {
    expect(useLocomotionStore.getState().showFootfalls).toBe(true);
    useLocomotionStore.getState().toggleOverlay('showFootfalls');
    expect(useLocomotionStore.getState().showFootfalls).toBe(false);
    useLocomotionStore.getState().toggleOverlay('showFootfalls');
    expect(useLocomotionStore.getState().showFootfalls).toBe(true);
  });

  it('toggleOverlay flips showRootMotion', () => {
    useLocomotionStore.getState().toggleOverlay('showRootMotion');
    expect(useLocomotionStore.getState().showRootMotion).toBe(false);
  });

  it('toggleOverlay flips showCenterOfMass', () => {
    useLocomotionStore.getState().toggleOverlay('showCenterOfMass');
    expect(useLocomotionStore.getState().showCenterOfMass).toBe(false);
  });

  it('toggleOverlay flips showCollisionWarnings', () => {
    useLocomotionStore.getState().toggleOverlay('showCollisionWarnings');
    expect(useLocomotionStore.getState().showCollisionWarnings).toBe(false);
  });

  it('toggles are independent', () => {
    useLocomotionStore.getState().toggleOverlay('showFootfalls');
    expect(useLocomotionStore.getState().showFootfalls).toBe(false);
    expect(useLocomotionStore.getState().showRootMotion).toBe(true);
    expect(useLocomotionStore.getState().showCenterOfMass).toBe(true);
    expect(useLocomotionStore.getState().showCollisionWarnings).toBe(true);
  });
});
