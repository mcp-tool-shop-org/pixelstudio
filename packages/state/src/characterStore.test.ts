import { describe, it, expect, beforeEach } from 'vitest';
import type { CharacterBuild, CharacterPartRef } from '@glyphstudio/domain';
import {
  useCharacterStore,
  getEquippedPartForSlot,
  getMissingRequiredSlots,
  getCharacterErrors,
  getCharacterWarnings,
  isCharacterValid,
  getEquippedSlotsInDisplayOrder,
} from './characterStore';

// ── Fixtures ──

const HEAD: CharacterPartRef = { sourceId: 'head-basic', slot: 'head' };
const TORSO: CharacterPartRef = { sourceId: 'torso-plate', slot: 'torso', providedSockets: ['chest_mount'] };
const ARMS: CharacterPartRef = { sourceId: 'arms-default', slot: 'arms' };
const LEGS: CharacterPartRef = { sourceId: 'legs-default', slot: 'legs' };
const WEAPON: CharacterPartRef = { sourceId: 'sword-iron', slot: 'weapon', requiredSockets: ['hand'] };
const HANDS: CharacterPartRef = { sourceId: 'hands-gauntlet', slot: 'hands', providedSockets: ['hand'] };
const HAIR: CharacterPartRef = { sourceId: 'hair-long', slot: 'hair' };

const PREBUILT: CharacterBuild = {
  id: 'pre-1',
  name: 'Warrior',
  slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS },
};

function state() {
  return useCharacterStore.getState();
}

// ── Reset before each test ──

beforeEach(() => {
  useCharacterStore.getState().clearCharacterBuild();
});

// ── Creation / Load / Reset ──

describe('creation and lifecycle', () => {
  it('starts with no active build', () => {
    expect(state().activeCharacterBuild).toBeNull();
    expect(state().selectedSlot).toBeNull();
    expect(state().validationIssues).toEqual([]);
    expect(state().isDirty).toBe(false);
  });

  it('createCharacterBuild initializes empty slots', () => {
    state().createCharacterBuild('Hero');
    expect(state().activeCharacterBuild).not.toBeNull();
    expect(state().activeCharacterBuild!.name).toBe('Hero');
    expect(Object.keys(state().activeCharacterBuild!.slots)).toHaveLength(0);
    expect(state().isDirty).toBe(false);
  });

  it('createCharacterBuild defaults name to Untitled Character', () => {
    state().createCharacterBuild();
    expect(state().activeCharacterBuild!.name).toBe('Untitled Character');
  });

  it('createCharacterBuild generates unique IDs', () => {
    state().createCharacterBuild('A');
    const id1 = state().activeCharacterBuild!.id;
    state().createCharacterBuild('B');
    const id2 = state().activeCharacterBuild!.id;
    expect(id1).not.toBe(id2);
  });

  it('createCharacterBuild computes validation for empty build', () => {
    state().createCharacterBuild();
    const errors = state().validationIssues.filter((i) => i.kind === 'missing_required_slot');
    expect(errors).toHaveLength(4);
  });

  it('loadCharacterBuild sets state correctly', () => {
    state().loadCharacterBuild(PREBUILT);
    expect(state().activeCharacterBuild).toEqual(PREBUILT);
    expect(state().isDirty).toBe(false);
    expect(state().selectedSlot).toBeNull();
  });

  it('loadCharacterBuild computes validation', () => {
    state().loadCharacterBuild(PREBUILT);
    // PREBUILT has all required slots → no errors
    const errors = state().validationIssues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('clearCharacterBuild resets all state', () => {
    state().loadCharacterBuild(PREBUILT);
    state().selectSlot('head');
    state().clearCharacterBuild();
    expect(state().activeCharacterBuild).toBeNull();
    expect(state().selectedSlot).toBeNull();
    expect(state().validationIssues).toEqual([]);
    expect(state().isDirty).toBe(false);
  });

  it('partial/incomplete build loads safely', () => {
    const partial: CharacterBuild = { id: 'p', name: 'Partial', slots: { head: HEAD } };
    state().loadCharacterBuild(partial);
    expect(state().activeCharacterBuild!.slots.head).toEqual(HEAD);
    // Missing torso, arms, legs → 3 errors
    const missing = state().validationIssues.filter((i) => i.kind === 'missing_required_slot');
    expect(missing).toHaveLength(3);
  });
});

// ── Slot selection ──

describe('slot selection', () => {
  it('selectSlot updates selected slot', () => {
    state().createCharacterBuild();
    state().selectSlot('torso');
    expect(state().selectedSlot).toBe('torso');
  });

  it('selectSlot null clears selection', () => {
    state().createCharacterBuild();
    state().selectSlot('head');
    state().selectSlot(null);
    expect(state().selectedSlot).toBeNull();
  });
});

// ── Equip / Unequip / Replace ──

describe('equip/unequip/replace', () => {
  beforeEach(() => {
    state().createCharacterBuild('Test');
  });

  it('equipCharacterPart fills correct slot', () => {
    state().equipCharacterPart(HEAD);
    expect(state().activeCharacterBuild!.slots.head).toEqual(HEAD);
  });

  it('equipCharacterPart replaces existing occupant', () => {
    state().equipCharacterPart(HEAD);
    const altHead: CharacterPartRef = { sourceId: 'head-alt', slot: 'head' };
    state().equipCharacterPart(altHead);
    expect(state().activeCharacterBuild!.slots.head?.sourceId).toBe('head-alt');
  });

  it('equipCharacterPart marks dirty', () => {
    expect(state().isDirty).toBe(false);
    state().equipCharacterPart(HEAD);
    expect(state().isDirty).toBe(true);
  });

  it('equipCharacterPart is no-op with no active build', () => {
    state().clearCharacterBuild();
    state().equipCharacterPart(HEAD);
    expect(state().activeCharacterBuild).toBeNull();
  });

  it('unequipCharacterSlot clears slot', () => {
    state().equipCharacterPart(HEAD);
    state().unequipCharacterSlot('head');
    expect(state().activeCharacterBuild!.slots.head).toBeUndefined();
  });

  it('unequipCharacterSlot marks dirty', () => {
    state().equipCharacterPart(HEAD);
    state().loadCharacterBuild(state().activeCharacterBuild!); // reset dirty
    state().unequipCharacterSlot('head');
    expect(state().isDirty).toBe(true);
  });

  it('unequipCharacterSlot does not affect other slots', () => {
    state().equipCharacterPart(HEAD);
    state().equipCharacterPart(TORSO);
    state().unequipCharacterSlot('head');
    expect(state().activeCharacterBuild!.slots.torso).toEqual(TORSO);
  });

  it('replaceCharacterPart replaces occupant and preserves one-slot rule', () => {
    state().equipCharacterPart(TORSO);
    const altTorso: CharacterPartRef = { sourceId: 'torso-cloth', slot: 'torso' };
    state().replaceCharacterPart(altTorso);
    expect(state().activeCharacterBuild!.slots.torso?.sourceId).toBe('torso-cloth');
  });
});

// ── Name ──

describe('setCharacterName', () => {
  it('updates the character name', () => {
    state().createCharacterBuild('Old');
    state().setCharacterName('New');
    expect(state().activeCharacterBuild!.name).toBe('New');
  });

  it('marks dirty', () => {
    state().createCharacterBuild('Old');
    state().setCharacterName('New');
    expect(state().isDirty).toBe(true);
  });

  it('is no-op with no active build', () => {
    state().setCharacterName('Ghost');
    expect(state().activeCharacterBuild).toBeNull();
  });
});

// ── Validation refresh ──

describe('validation auto-refresh', () => {
  it('validation updates after equip', () => {
    state().createCharacterBuild();
    // 4 missing required slots initially
    expect(state().validationIssues.filter((i) => i.kind === 'missing_required_slot')).toHaveLength(4);
    state().equipCharacterPart(HEAD);
    expect(state().validationIssues.filter((i) => i.kind === 'missing_required_slot')).toHaveLength(3);
  });

  it('validation updates after unequip', () => {
    state().loadCharacterBuild(PREBUILT);
    expect(state().validationIssues.filter((i) => i.kind === 'missing_required_slot')).toHaveLength(0);
    state().unequipCharacterSlot('head');
    expect(state().validationIssues.filter((i) => i.kind === 'missing_required_slot')).toHaveLength(1);
  });

  it('revalidateCharacterBuild forces refresh', () => {
    state().loadCharacterBuild(PREBUILT);
    state().revalidateCharacterBuild();
    expect(state().validationIssues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('weapon with missing socket produces warning', () => {
    state().loadCharacterBuild(PREBUILT);
    state().equipCharacterPart(WEAPON);
    const warnings = state().validationIssues.filter((i) => i.kind === 'missing_required_socket');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].slot).toBe('weapon');
  });

  it('weapon warning clears when hands provide socket', () => {
    state().loadCharacterBuild(PREBUILT);
    state().equipCharacterPart(WEAPON);
    state().equipCharacterPart(HANDS);
    const warnings = state().validationIssues.filter((i) => i.kind === 'missing_required_socket');
    expect(warnings).toHaveLength(0);
  });
});

// ── Selectors ──

describe('selectors', () => {
  it('getEquippedPartForSlot returns part or undefined', () => {
    state().loadCharacterBuild(PREBUILT);
    expect(getEquippedPartForSlot(state(), 'head')).toEqual(HEAD);
    expect(getEquippedPartForSlot(state(), 'weapon')).toBeUndefined();
  });

  it('getEquippedPartForSlot returns undefined with no build', () => {
    expect(getEquippedPartForSlot(state(), 'head')).toBeUndefined();
  });

  it('getMissingRequiredSlots returns missing slots', () => {
    state().createCharacterBuild();
    state().equipCharacterPart(HEAD);
    const missing = getMissingRequiredSlots(state()).sort();
    expect(missing).toEqual(['arms', 'legs', 'torso']);
  });

  it('getMissingRequiredSlots returns empty with no build', () => {
    expect(getMissingRequiredSlots(state())).toEqual([]);
  });

  it('getCharacterErrors returns only errors', () => {
    state().loadCharacterBuild(PREBUILT);
    state().equipCharacterPart(WEAPON); // produces warning, not error
    expect(getCharacterErrors(state())).toHaveLength(0);
  });

  it('getCharacterWarnings returns only warnings', () => {
    state().loadCharacterBuild(PREBUILT);
    state().equipCharacterPart(WEAPON); // missing socket → warning
    expect(getCharacterWarnings(state()).length).toBeGreaterThan(0);
  });

  it('isCharacterValid true for complete build', () => {
    state().loadCharacterBuild(PREBUILT);
    expect(isCharacterValid(state())).toBe(true);
  });

  it('isCharacterValid false for incomplete build', () => {
    state().createCharacterBuild();
    expect(isCharacterValid(state())).toBe(false);
  });

  it('isCharacterValid true even with warnings', () => {
    state().loadCharacterBuild(PREBUILT);
    state().equipCharacterPart(WEAPON);
    expect(isCharacterValid(state())).toBe(true);
  });

  it('getEquippedSlotsInDisplayOrder returns canonical order', () => {
    state().loadCharacterBuild(PREBUILT);
    state().equipCharacterPart(HAIR);
    state().equipCharacterPart(WEAPON);
    const ordered = getEquippedSlotsInDisplayOrder(state());
    const slots = ordered.map((e) => e.slot);
    // head(0), hair(2), torso(3), arms(4), legs(6), weapon(10)
    expect(slots).toEqual(['head', 'hair', 'torso', 'arms', 'legs', 'weapon']);
  });

  it('getEquippedSlotsInDisplayOrder returns empty with no build', () => {
    expect(getEquippedSlotsInDisplayOrder(state())).toEqual([]);
  });
});

// ── Integration flows ──

describe('integration flows', () => {
  it('create → equip all required → valid', () => {
    state().createCharacterBuild('Warrior');
    expect(isCharacterValid(state())).toBe(false);
    state().equipCharacterPart(HEAD);
    state().equipCharacterPart(TORSO);
    state().equipCharacterPart(ARMS);
    state().equipCharacterPart(LEGS);
    expect(isCharacterValid(state())).toBe(true);
    expect(getMissingRequiredSlots(state())).toHaveLength(0);
    expect(state().isDirty).toBe(true);
  });

  it('equip weapon requiring missing socket → warning appears', () => {
    state().loadCharacterBuild(PREBUILT);
    state().equipCharacterPart(WEAPON);
    const warnings = getCharacterWarnings(state());
    expect(warnings.some((w) => w.kind === 'missing_required_socket' && w.slot === 'weapon')).toBe(true);
  });

  it('equip hands providing socket → weapon warning clears', () => {
    state().loadCharacterBuild(PREBUILT);
    state().equipCharacterPart(WEAPON);
    expect(getCharacterWarnings(state()).length).toBeGreaterThan(0);
    state().equipCharacterPart(HANDS);
    expect(getCharacterWarnings(state()).filter((w) => w.kind === 'missing_required_socket')).toHaveLength(0);
  });

  it('replace slot part → old gone, new present, validation refreshed', () => {
    state().loadCharacterBuild(PREBUILT);
    const altTorso: CharacterPartRef = { sourceId: 'torso-cloth', slot: 'torso' };
    state().replaceCharacterPart(altTorso);
    expect(state().activeCharacterBuild!.slots.torso?.sourceId).toBe('torso-cloth');
    // Still valid — all required still filled
    expect(isCharacterValid(state())).toBe(true);
  });

  it('unequip required → invalid → re-equip → valid', () => {
    state().loadCharacterBuild(PREBUILT);
    expect(isCharacterValid(state())).toBe(true);
    state().unequipCharacterSlot('head');
    expect(isCharacterValid(state())).toBe(false);
    state().equipCharacterPart(HEAD);
    expect(isCharacterValid(state())).toBe(true);
  });
});
