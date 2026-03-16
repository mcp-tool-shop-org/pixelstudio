import { describe, it, expect, beforeEach } from 'vitest';
import { useReferenceStore } from './referenceStore';

function getState() {
  return useReferenceStore.getState();
}

function act(fn: () => void) {
  fn();
}

describe('referenceStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useReferenceStore.setState({
      images: [],
      activeImageId: null,
      panelCollapsed: false,
    });
  });

  it('starts with empty state', () => {
    const s = getState();
    expect(s.images).toEqual([]);
    expect(s.activeImageId).toBeNull();
    expect(s.panelCollapsed).toBe(false);
  });

  it('adds an image and sets it active', () => {
    const id = getState().addImage('/path/to/knight.png', 'knight');
    const s = getState();
    expect(s.images).toHaveLength(1);
    expect(s.images[0].filePath).toBe('/path/to/knight.png');
    expect(s.images[0].name).toBe('knight');
    expect(s.images[0].opacity).toBe(0.5);
    expect(s.images[0].scale).toBe(1);
    expect(s.images[0].visible).toBe(true);
    expect(s.images[0].locked).toBe(false);
    expect(s.activeImageId).toBe(id);
  });

  it('adds multiple images', () => {
    getState().addImage('/a.png', 'a');
    getState().addImage('/b.png', 'b');
    getState().addImage('/c.png', 'c');
    expect(getState().images).toHaveLength(3);
    // Last added is active
    expect(getState().activeImageId).toBe(getState().images[2].id);
  });

  it('removes an image', () => {
    const id1 = getState().addImage('/a.png', 'a');
    const id2 = getState().addImage('/b.png', 'b');
    getState().removeImage(id1);
    expect(getState().images).toHaveLength(1);
    expect(getState().images[0].id).toBe(id2);
  });

  it('clears active when active image is removed', () => {
    const id = getState().addImage('/a.png', 'a');
    expect(getState().activeImageId).toBe(id);
    getState().removeImage(id);
    expect(getState().activeImageId).toBeNull();
  });

  it('keeps active when non-active image is removed', () => {
    getState().addImage('/a.png', 'a');
    const id2 = getState().addImage('/b.png', 'b');
    const id1 = getState().images[0].id;
    // id2 is active (last added)
    expect(getState().activeImageId).toBe(id2);
    getState().removeImage(id1);
    expect(getState().activeImageId).toBe(id2);
  });

  it('clears all images', () => {
    getState().addImage('/a.png', 'a');
    getState().addImage('/b.png', 'b');
    getState().clearAll();
    expect(getState().images).toEqual([]);
    expect(getState().activeImageId).toBeNull();
  });

  it('sets opacity clamped to [0, 1]', () => {
    const id = getState().addImage('/a.png', 'a');
    getState().setOpacity(id, 0.8);
    expect(getState().images[0].opacity).toBe(0.8);

    getState().setOpacity(id, -0.5);
    expect(getState().images[0].opacity).toBe(0);

    getState().setOpacity(id, 1.5);
    expect(getState().images[0].opacity).toBe(1);
  });

  it('sets scale clamped to [0.1, 10]', () => {
    const id = getState().addImage('/a.png', 'a');
    getState().setScale(id, 2.5);
    expect(getState().images[0].scale).toBe(2.5);

    getState().setScale(id, 0.01);
    expect(getState().images[0].scale).toBe(0.1);

    getState().setScale(id, 20);
    expect(getState().images[0].scale).toBe(10);
  });

  it('sets pan position', () => {
    const id = getState().addImage('/a.png', 'a');
    getState().setPan(id, 100, -50);
    expect(getState().images[0].panX).toBe(100);
    expect(getState().images[0].panY).toBe(-50);
  });

  it('toggles visibility', () => {
    const id = getState().addImage('/a.png', 'a');
    expect(getState().images[0].visible).toBe(true);
    getState().toggleVisible(id);
    expect(getState().images[0].visible).toBe(false);
    getState().toggleVisible(id);
    expect(getState().images[0].visible).toBe(true);
  });

  it('toggles locked', () => {
    const id = getState().addImage('/a.png', 'a');
    expect(getState().images[0].locked).toBe(false);
    getState().toggleLocked(id);
    expect(getState().images[0].locked).toBe(true);
    getState().toggleLocked(id);
    expect(getState().images[0].locked).toBe(false);
  });

  it('sets active image manually', () => {
    const id1 = getState().addImage('/a.png', 'a');
    const id2 = getState().addImage('/b.png', 'b');
    expect(getState().activeImageId).toBe(id2);
    getState().setActiveImage(id1);
    expect(getState().activeImageId).toBe(id1);
  });

  it('sets panel collapsed state', () => {
    getState().setPanelCollapsed(true);
    expect(getState().panelCollapsed).toBe(true);
    getState().setPanelCollapsed(false);
    expect(getState().panelCollapsed).toBe(false);
  });

  it('generates unique IDs for each image', () => {
    getState().addImage('/a.png', 'a');
    getState().addImage('/b.png', 'b');
    getState().addImage('/c.png', 'c');
    const ids = getState().images.map((i) => i.id);
    expect(new Set(ids).size).toBe(3);
  });
});
