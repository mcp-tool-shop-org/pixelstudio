import { describe, it, expect, beforeEach } from 'vitest';
import { usePaletteStore } from './paletteStore';
import type { PaletteDefinition } from '@glyphstudio/domain';

function makePalette(id: string, name?: string): PaletteDefinition {
  return {
    id,
    name: name ?? `Palette ${id}`,
    slots: [
      { id: `${id}-s1`, rgba: [255, 0, 0, 255], name: 'Red', semanticRole: null, locked: false, rampId: null },
      { id: `${id}-s2`, rgba: [0, 255, 0, 255], name: 'Green', semanticRole: null, locked: false, rampId: null },
    ],
    ramps: [],
  };
}

describe('paletteStore', () => {
  beforeEach(() => {
    usePaletteStore.setState({
      activePaletteId: null,
      paletteById: {},
      activeContractId: null,
      recentSlotIds: [],
    });
  });

  // --- Palette CRUD ---

  it('starts empty', () => {
    const s = usePaletteStore.getState();
    expect(s.activePaletteId).toBeNull();
    expect(Object.keys(s.paletteById)).toHaveLength(0);
  });

  it('addPalette stores by id', () => {
    usePaletteStore.getState().addPalette(makePalette('p1'));
    const s = usePaletteStore.getState();
    expect(s.paletteById['p1']).toBeDefined();
    expect(s.paletteById['p1'].name).toBe('Palette p1');
  });

  it('addPalette accumulates multiple', () => {
    usePaletteStore.getState().addPalette(makePalette('p1'));
    usePaletteStore.getState().addPalette(makePalette('p2'));
    expect(Object.keys(usePaletteStore.getState().paletteById)).toHaveLength(2);
  });

  it('addPalette overwrites same id', () => {
    usePaletteStore.getState().addPalette(makePalette('p1', 'Version 1'));
    usePaletteStore.getState().addPalette(makePalette('p1', 'Version 2'));
    expect(usePaletteStore.getState().paletteById['p1'].name).toBe('Version 2');
  });

  it('setActivePalette selects and clears', () => {
    usePaletteStore.getState().setActivePalette('p1');
    expect(usePaletteStore.getState().activePaletteId).toBe('p1');
    usePaletteStore.getState().setActivePalette(null);
    expect(usePaletteStore.getState().activePaletteId).toBeNull();
  });

  // --- Contract ---

  it('setContract selects contract id', () => {
    usePaletteStore.getState().setContract('c1');
    expect(usePaletteStore.getState().activeContractId).toBe('c1');
    usePaletteStore.getState().setContract(null);
    expect(usePaletteStore.getState().activeContractId).toBeNull();
  });

  // --- Recent slots ---

  it('pushRecentSlot adds to front', () => {
    usePaletteStore.getState().pushRecentSlot('s1');
    usePaletteStore.getState().pushRecentSlot('s2');
    usePaletteStore.getState().pushRecentSlot('s3');
    expect(usePaletteStore.getState().recentSlotIds).toEqual(['s3', 's2', 's1']);
  });

  it('pushRecentSlot deduplicates (moves existing to front)', () => {
    usePaletteStore.getState().pushRecentSlot('s1');
    usePaletteStore.getState().pushRecentSlot('s2');
    usePaletteStore.getState().pushRecentSlot('s1'); // s1 already exists
    expect(usePaletteStore.getState().recentSlotIds).toEqual(['s1', 's2']);
  });

  it('pushRecentSlot caps at 16 entries', () => {
    for (let i = 0; i < 20; i++) {
      usePaletteStore.getState().pushRecentSlot(`s${i}`);
    }
    expect(usePaletteStore.getState().recentSlotIds).toHaveLength(16);
    // Most recent should be first
    expect(usePaletteStore.getState().recentSlotIds[0]).toBe('s19');
  });
});
