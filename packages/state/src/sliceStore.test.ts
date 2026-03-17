import { describe, it, expect, beforeEach } from 'vitest';
import { useSliceStore } from './sliceStore';
import type { SliceRegion } from './sliceStore';

const REGION_A: SliceRegion = { id: 'r1', name: 'slice_1', x: 0, y: 0, width: 16, height: 16 };
const REGION_B: SliceRegion = { id: 'r2', name: 'slice_2', x: 10, y: 5, width: 8, height: 8 };

function reset() {
  useSliceStore.setState({ sliceRegions: [], selectedSliceId: null });
}

describe('useSliceStore', () => {
  beforeEach(reset);

  it('initial state is empty with no selection', () => {
    const s = useSliceStore.getState();
    expect(s.sliceRegions).toEqual([]);
    expect(s.selectedSliceId).toBeNull();
  });

  it('setSliceRegions replaces the list', () => {
    useSliceStore.getState().setSliceRegions([REGION_A, REGION_B]);
    expect(useSliceStore.getState().sliceRegions).toHaveLength(2);
    expect(useSliceStore.getState().sliceRegions[0].id).toBe('r1');
  });

  it('setSliceRegions with empty list clears', () => {
    useSliceStore.getState().setSliceRegions([REGION_A]);
    useSliceStore.getState().setSliceRegions([]);
    expect(useSliceStore.getState().sliceRegions).toHaveLength(0);
  });

  it('setSelectedSliceId sets and clears', () => {
    useSliceStore.getState().setSelectedSliceId('r1');
    expect(useSliceStore.getState().selectedSliceId).toBe('r1');
    useSliceStore.getState().setSelectedSliceId(null);
    expect(useSliceStore.getState().selectedSliceId).toBeNull();
  });

  it('selecting a region does not affect sliceRegions list', () => {
    useSliceStore.getState().setSliceRegions([REGION_A, REGION_B]);
    useSliceStore.getState().setSelectedSliceId('r2');
    expect(useSliceStore.getState().sliceRegions).toHaveLength(2);
    expect(useSliceStore.getState().selectedSliceId).toBe('r2');
  });

  it('setSliceRegions does not change selectedSliceId', () => {
    useSliceStore.getState().setSelectedSliceId('r1');
    useSliceStore.getState().setSliceRegions([REGION_B]);
    // selection intentionally persists — caller must clear if needed
    expect(useSliceStore.getState().selectedSliceId).toBe('r1');
  });
});
