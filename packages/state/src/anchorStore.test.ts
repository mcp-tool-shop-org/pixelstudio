import { describe, it, expect, beforeEach } from 'vitest';
import { useAnchorStore } from './anchorStore';
import type { Anchor } from '@pixelstudio/domain';

function makeAnchor(id: string, overrides?: Partial<Anchor>): Anchor {
  return {
    id,
    name: `Anchor ${id}`,
    kind: 'custom',
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe('anchorStore', () => {
  beforeEach(() => {
    useAnchorStore.getState().reset();
  });

  // --- CRUD ---

  it('starts empty', () => {
    const s = useAnchorStore.getState();
    expect(s.anchors).toEqual([]);
    expect(s.selectedAnchorId).toBeNull();
    expect(s.overlayVisible).toBe(true);
  });

  it('setAnchors replaces the list', () => {
    const anchors = [makeAnchor('a1'), makeAnchor('a2')];
    useAnchorStore.getState().setAnchors(anchors);
    expect(useAnchorStore.getState().anchors).toHaveLength(2);
  });

  it('addAnchor appends', () => {
    useAnchorStore.getState().addAnchor(makeAnchor('a1'));
    useAnchorStore.getState().addAnchor(makeAnchor('a2'));
    expect(useAnchorStore.getState().anchors).toHaveLength(2);
    expect(useAnchorStore.getState().anchors[1].id).toBe('a2');
  });

  it('removeAnchor deletes by id', () => {
    useAnchorStore.getState().setAnchors([makeAnchor('a1'), makeAnchor('a2')]);
    useAnchorStore.getState().removeAnchor('a1');
    const s = useAnchorStore.getState();
    expect(s.anchors).toHaveLength(1);
    expect(s.anchors[0].id).toBe('a2');
  });

  it('removeAnchor clears selection if deleted anchor was selected', () => {
    useAnchorStore.getState().setAnchors([makeAnchor('a1'), makeAnchor('a2')]);
    useAnchorStore.getState().selectAnchor('a1');
    useAnchorStore.getState().removeAnchor('a1');
    expect(useAnchorStore.getState().selectedAnchorId).toBeNull();
  });

  it('removeAnchor preserves selection of other anchor', () => {
    useAnchorStore.getState().setAnchors([makeAnchor('a1'), makeAnchor('a2')]);
    useAnchorStore.getState().selectAnchor('a2');
    useAnchorStore.getState().removeAnchor('a1');
    expect(useAnchorStore.getState().selectedAnchorId).toBe('a2');
  });

  it('updateAnchor patches fields', () => {
    useAnchorStore.getState().addAnchor(makeAnchor('a1', { name: 'Head', x: 0, y: 0 }));
    useAnchorStore.getState().updateAnchor('a1', { name: 'Torso', x: 10, y: 20 });
    const a = useAnchorStore.getState().anchors[0];
    expect(a.name).toBe('Torso');
    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
  });

  it('updateAnchor does not affect other anchors', () => {
    useAnchorStore.getState().setAnchors([
      makeAnchor('a1', { name: 'Head' }),
      makeAnchor('a2', { name: 'Torso' }),
    ]);
    useAnchorStore.getState().updateAnchor('a1', { name: 'New Head' });
    expect(useAnchorStore.getState().anchors[1].name).toBe('Torso');
  });

  // --- Selection ---

  it('selectAnchor sets and clears', () => {
    useAnchorStore.getState().selectAnchor('a1');
    expect(useAnchorStore.getState().selectedAnchorId).toBe('a1');
    useAnchorStore.getState().selectAnchor(null);
    expect(useAnchorStore.getState().selectedAnchorId).toBeNull();
  });

  // --- Overlay ---

  it('toggleOverlay flips visibility', () => {
    expect(useAnchorStore.getState().overlayVisible).toBe(true);
    useAnchorStore.getState().toggleOverlay();
    expect(useAnchorStore.getState().overlayVisible).toBe(false);
    useAnchorStore.getState().toggleOverlay();
    expect(useAnchorStore.getState().overlayVisible).toBe(true);
  });

  it('setOverlayVisible sets directly', () => {
    useAnchorStore.getState().setOverlayVisible(false);
    expect(useAnchorStore.getState().overlayVisible).toBe(false);
  });

  // --- Reset ---

  it('reset restores initial state', () => {
    useAnchorStore.getState().setAnchors([makeAnchor('a1')]);
    useAnchorStore.getState().selectAnchor('a1');
    useAnchorStore.getState().setOverlayVisible(false);
    useAnchorStore.getState().reset();

    const s = useAnchorStore.getState();
    expect(s.anchors).toEqual([]);
    expect(s.selectedAnchorId).toBeNull();
    expect(s.overlayVisible).toBe(true);
  });
});
