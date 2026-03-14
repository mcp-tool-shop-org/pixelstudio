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
});
