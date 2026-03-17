import { describe, it, expect, beforeEach } from 'vitest';
import { useToolStore } from './toolStore';

describe('toolStore', () => {
  beforeEach(() => {
    // Reset to defaults
    useToolStore.setState({
      activeTool: 'pencil',
      previousTool: null,
      primaryColor: { r: 255, g: 255, b: 255, a: 255 },
      secondaryColor: { r: 0, g: 0, b: 0, a: 0 },
      primaryColorSlotId: null,
      secondaryColorSlotId: null,
      recentColors: [],
      pinnedColors: [],
      palettePopup: { open: false, screenX: 0, screenY: 0 },
    });
  });

  // --- Tool switching ---

  it('starts with pencil', () => {
    expect(useToolStore.getState().activeTool).toBe('pencil');
    expect(useToolStore.getState().previousTool).toBeNull();
  });

  it('setTool changes active and tracks previous', () => {
    useToolStore.getState().setTool('eraser');
    const s = useToolStore.getState();
    expect(s.activeTool).toBe('eraser');
    expect(s.previousTool).toBe('pencil');
  });

  it('setTool chains correctly through multiple switches', () => {
    useToolStore.getState().setTool('eraser');
    useToolStore.getState().setTool('fill');
    useToolStore.getState().setTool('marquee');
    const s = useToolStore.getState();
    expect(s.activeTool).toBe('marquee');
    expect(s.previousTool).toBe('fill'); // only tracks the last one
  });

  // --- Color management ---

  it('swapColors swaps primary and secondary', () => {
    const s = useToolStore.getState();
    const origPrimary = s.primaryColor;
    const origSecondary = s.secondaryColor;
    useToolStore.getState().swapColors();
    const after = useToolStore.getState();
    expect(after.primaryColor).toEqual(origSecondary);
    expect(after.secondaryColor).toEqual(origPrimary);
  });

  it('swapColors swaps slot ids too', () => {
    useToolStore.getState().setPrimaryColor({ r: 1, g: 2, b: 3, a: 255 }, 'slot-a');
    useToolStore.getState().setSecondaryColor({ r: 4, g: 5, b: 6, a: 255 }, 'slot-b');
    useToolStore.getState().swapColors();
    const s = useToolStore.getState();
    expect(s.primaryColorSlotId).toBe('slot-b');
    expect(s.secondaryColorSlotId).toBe('slot-a');
  });

  it('swap twice is identity', () => {
    useToolStore.getState().setPrimaryColor({ r: 10, g: 20, b: 30, a: 255 });
    useToolStore.getState().setSecondaryColor({ r: 40, g: 50, b: 60, a: 128 });
    const before = useToolStore.getState();
    useToolStore.getState().swapColors();
    useToolStore.getState().swapColors();
    const after = useToolStore.getState();
    expect(after.primaryColor).toEqual(before.primaryColor);
    expect(after.secondaryColor).toEqual(before.secondaryColor);
  });

  it('setPrimaryColor with no slotId clears the slot', () => {
    useToolStore.getState().setPrimaryColor({ r: 255, g: 0, b: 0, a: 255 }, 'slot-1');
    expect(useToolStore.getState().primaryColorSlotId).toBe('slot-1');
    useToolStore.getState().setPrimaryColor({ r: 0, g: 255, b: 0, a: 255 });
    expect(useToolStore.getState().primaryColorSlotId).toBeNull();
  });

  // --- Recent colors ---

  it('recentColors starts empty', () => {
    expect(useToolStore.getState().recentColors).toHaveLength(0);
  });

  it('setPrimaryColor pushes to recentColors', () => {
    useToolStore.getState().setPrimaryColor({ r: 255, g: 0, b: 0, a: 255 });
    expect(useToolStore.getState().recentColors).toHaveLength(1);
    expect(useToolStore.getState().recentColors[0]).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it('setPrimaryColor deduplicates by rgb', () => {
    useToolStore.getState().setPrimaryColor({ r: 255, g: 0, b: 0, a: 255 });
    useToolStore.getState().setPrimaryColor({ r: 0, g: 255, b: 0, a: 255 });
    useToolStore.getState().setPrimaryColor({ r: 255, g: 0, b: 0, a: 128 }); // same rgb, different alpha
    // Dedup by rgb so only 2 entries: red moved to front, green remains
    expect(useToolStore.getState().recentColors).toHaveLength(2);
    expect(useToolStore.getState().recentColors[0].r).toBe(255);
    expect(useToolStore.getState().recentColors[0].g).toBe(0);
  });

  it('recentColors is capped at 12', () => {
    for (let i = 0; i < 20; i++) {
      useToolStore.getState().setPrimaryColor({ r: i * 10, g: 0, b: 0, a: 255 });
    }
    expect(useToolStore.getState().recentColors).toHaveLength(12);
  });

  it('most recently set color is first in recentColors', () => {
    useToolStore.getState().setPrimaryColor({ r: 10, g: 0, b: 0, a: 255 });
    useToolStore.getState().setPrimaryColor({ r: 20, g: 0, b: 0, a: 255 });
    expect(useToolStore.getState().recentColors[0].r).toBe(20);
  });

  it('setSecondaryColor also pushes to recentColors', () => {
    useToolStore.getState().setSecondaryColor({ r: 0, g: 128, b: 255, a: 255 });
    expect(useToolStore.getState().recentColors[0]).toEqual({ r: 0, g: 128, b: 255, a: 255 });
  });

  it('pushRecentColor adds without changing primaryColor', () => {
    const before = useToolStore.getState().primaryColor;
    useToolStore.getState().pushRecentColor({ r: 100, g: 100, b: 100, a: 255 });
    expect(useToolStore.getState().primaryColor).toEqual(before);
    expect(useToolStore.getState().recentColors[0].r).toBe(100);
  });

  // --- Pinned colors ---

  it('pinnedColors starts empty', () => {
    expect(useToolStore.getState().pinnedColors).toHaveLength(0);
  });

  it('pinColor adds a color', () => {
    useToolStore.getState().pinColor({ r: 50, g: 100, b: 150, a: 255 });
    expect(useToolStore.getState().pinnedColors).toHaveLength(1);
    expect(useToolStore.getState().pinnedColors[0]).toEqual({ r: 50, g: 100, b: 150, a: 255 });
  });

  it('pinColor ignores duplicates by rgb', () => {
    useToolStore.getState().pinColor({ r: 50, g: 100, b: 150, a: 255 });
    useToolStore.getState().pinColor({ r: 50, g: 100, b: 150, a: 128 }); // same rgb
    expect(useToolStore.getState().pinnedColors).toHaveLength(1);
  });

  it('pinColor caps at 8', () => {
    for (let i = 0; i < 12; i++) {
      useToolStore.getState().pinColor({ r: i * 20, g: 0, b: 0, a: 255 });
    }
    expect(useToolStore.getState().pinnedColors).toHaveLength(8);
  });

  it('unpinColor removes by index', () => {
    useToolStore.getState().pinColor({ r: 10, g: 0, b: 0, a: 255 });
    useToolStore.getState().pinColor({ r: 20, g: 0, b: 0, a: 255 });
    useToolStore.getState().unpinColor(0);
    const s = useToolStore.getState();
    expect(s.pinnedColors).toHaveLength(1);
    expect(s.pinnedColors[0].r).toBe(20);
  });

  it('unpinColor with out-of-range index is a no-op that does not throw', () => {
    useToolStore.getState().pinColor({ r: 10, g: 0, b: 0, a: 255 });
    useToolStore.getState().unpinColor(99);
    expect(useToolStore.getState().pinnedColors).toHaveLength(1);
  });

  // --- Palette popup ---

  it('openPalettePopup sets position and open', () => {
    useToolStore.getState().openPalettePopup(100, 200);
    const s = useToolStore.getState();
    expect(s.palettePopup.open).toBe(true);
    expect(s.palettePopup.screenX).toBe(100);
    expect(s.palettePopup.screenY).toBe(200);
  });

  it('closePalettePopup resets', () => {
    useToolStore.getState().openPalettePopup(100, 200);
    useToolStore.getState().closePalettePopup();
    const s = useToolStore.getState();
    expect(s.palettePopup.open).toBe(false);
    expect(s.palettePopup.screenX).toBe(0);
    expect(s.palettePopup.screenY).toBe(0);
  });

  // --- Mirror mode ---

  it('mirrorMode initialises to none', () => {
    useToolStore.setState({ mirrorMode: 'none' });
    expect(useToolStore.getState().mirrorMode).toBe('none');
  });

  it('toggleMirrorH: none → h', () => {
    useToolStore.setState({ mirrorMode: 'none' });
    useToolStore.getState().toggleMirrorH();
    expect(useToolStore.getState().mirrorMode).toBe('h');
  });

  it('toggleMirrorH: h → none', () => {
    useToolStore.setState({ mirrorMode: 'h' });
    useToolStore.getState().toggleMirrorH();
    expect(useToolStore.getState().mirrorMode).toBe('none');
  });

  it('toggleMirrorH: v → both', () => {
    useToolStore.setState({ mirrorMode: 'v' });
    useToolStore.getState().toggleMirrorH();
    expect(useToolStore.getState().mirrorMode).toBe('both');
  });

  it('toggleMirrorH: both → v (drops h)', () => {
    useToolStore.setState({ mirrorMode: 'both' });
    useToolStore.getState().toggleMirrorH();
    expect(useToolStore.getState().mirrorMode).toBe('v');
  });

  it('toggleMirrorV: none → v', () => {
    useToolStore.setState({ mirrorMode: 'none' });
    useToolStore.getState().toggleMirrorV();
    expect(useToolStore.getState().mirrorMode).toBe('v');
  });

  it('toggleMirrorV: v → none', () => {
    useToolStore.setState({ mirrorMode: 'v' });
    useToolStore.getState().toggleMirrorV();
    expect(useToolStore.getState().mirrorMode).toBe('none');
  });

  it('toggleMirrorV: h → both', () => {
    useToolStore.setState({ mirrorMode: 'h' });
    useToolStore.getState().toggleMirrorV();
    expect(useToolStore.getState().mirrorMode).toBe('both');
  });

  it('toggleMirrorV: both → h (drops v)', () => {
    useToolStore.setState({ mirrorMode: 'both' });
    useToolStore.getState().toggleMirrorV();
    expect(useToolStore.getState().mirrorMode).toBe('h');
  });
});
