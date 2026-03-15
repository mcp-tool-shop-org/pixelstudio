import { describe, it, expect } from 'vitest';
import type { CharacterBuild, CharacterPartRef, CharacterSlotId } from '@glyphstudio/domain';
import {
  CHARACTER_SLOT_IDS,
  REQUIRED_SLOTS,
  OPTIONAL_SLOTS,
} from '@glyphstudio/domain';
import {
  equipPart,
  unequipSlot,
  replacePart,
  isSlotCompatible,
  collectProvidedSockets,
  collectProvidedAnchors,
  validateCharacterBuild,
  deriveMissingRequiredSlots,
  deriveEquippedParts,
  isCharacterBuildValid,
} from './characterHelpers';

// ── Fixtures ──

function emptyBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  return { id: 'build-1', name: 'Test Build', slots: {}, ...overrides };
}

const HEAD_PART: CharacterPartRef = {
  sourceId: 'head-basic',
  slot: 'head',
  tags: ['human'],
};

const TORSO_PART: CharacterPartRef = {
  sourceId: 'torso-plate',
  slot: 'torso',
  providedSockets: ['chest_mount'],
  providedAnchors: ['torso'],
};

const ARMS_PART: CharacterPartRef = {
  sourceId: 'arms-default',
  slot: 'arms',
};

const LEGS_PART: CharacterPartRef = {
  sourceId: 'legs-default',
  slot: 'legs',
};

const WEAPON_PART: CharacterPartRef = {
  sourceId: 'sword-iron',
  slot: 'weapon',
  requiredSockets: ['hand'],
  requiredAnchors: ['arm_right'],
};

const HANDS_PART: CharacterPartRef = {
  sourceId: 'hands-gauntlet',
  slot: 'hands',
  providedSockets: ['hand'],
  providedAnchors: ['arm_right'],
};

function validBuild(): CharacterBuild {
  return emptyBuild({
    slots: {
      head: HEAD_PART,
      torso: TORSO_PART,
      arms: ARMS_PART,
      legs: LEGS_PART,
    },
  });
}

// ── Slot vocabulary ──

describe('slot vocabulary', () => {
  it('has 12 slots in canonical order', () => {
    expect(CHARACTER_SLOT_IDS).toHaveLength(12);
    expect(CHARACTER_SLOT_IDS[0]).toBe('head');
    expect(CHARACTER_SLOT_IDS[11]).toBe('offhand');
  });

  it('required slots are head, torso, arms, legs', () => {
    expect([...REQUIRED_SLOTS].sort()).toEqual(['arms', 'head', 'legs', 'torso']);
  });

  it('optional slots are everything else', () => {
    expect(OPTIONAL_SLOTS).toHaveLength(8);
    for (const slot of OPTIONAL_SLOTS) {
      expect(REQUIRED_SLOTS).not.toContain(slot);
    }
  });

  it('required + optional covers all slots', () => {
    const all = new Set([...REQUIRED_SLOTS, ...OPTIONAL_SLOTS]);
    expect(all.size).toBe(CHARACTER_SLOT_IDS.length);
    for (const slot of CHARACTER_SLOT_IDS) {
      expect(all.has(slot)).toBe(true);
    }
  });
});

// ── Slot operations ──

describe('equipPart', () => {
  it('equips a part into an empty slot', () => {
    const build = equipPart(emptyBuild(), HEAD_PART);
    expect(build.slots.head).toEqual(HEAD_PART);
  });

  it('replaces existing occupant in same slot', () => {
    const altHead: CharacterPartRef = { sourceId: 'head-alt', slot: 'head' };
    const build = equipPart(equipPart(emptyBuild(), HEAD_PART), altHead);
    expect(build.slots.head?.sourceId).toBe('head-alt');
  });

  it('does not mutate the original build', () => {
    const original = emptyBuild();
    const modified = equipPart(original, HEAD_PART);
    expect(original.slots.head).toBeUndefined();
    expect(modified.slots.head).toEqual(HEAD_PART);
  });
});

describe('unequipSlot', () => {
  it('removes a part from a slot', () => {
    const build = unequipSlot(equipPart(emptyBuild(), HEAD_PART), 'head');
    expect(build.slots.head).toBeUndefined();
  });

  it('is a no-op for already-empty slot', () => {
    const build = unequipSlot(emptyBuild(), 'weapon');
    expect(build.slots.weapon).toBeUndefined();
  });

  it('does not affect other slots', () => {
    let build = equipPart(emptyBuild(), HEAD_PART);
    build = equipPart(build, TORSO_PART);
    build = unequipSlot(build, 'head');
    expect(build.slots.head).toBeUndefined();
    expect(build.slots.torso).toEqual(TORSO_PART);
  });
});

describe('replacePart', () => {
  it('replaces existing part in a slot', () => {
    const altTorso: CharacterPartRef = { sourceId: 'torso-cloth', slot: 'torso' };
    let build = equipPart(emptyBuild(), TORSO_PART);
    build = replacePart(build, altTorso);
    expect(build.slots.torso?.sourceId).toBe('torso-cloth');
  });
});

// ── Compatibility ──

describe('isSlotCompatible', () => {
  it('returns true when part slot matches target', () => {
    expect(isSlotCompatible(HEAD_PART, 'head')).toBe(true);
  });

  it('returns false when part slot does not match target', () => {
    expect(isSlotCompatible(HEAD_PART, 'torso')).toBe(false);
  });
});

describe('collectProvidedSockets', () => {
  it('returns empty set for empty build', () => {
    expect(collectProvidedSockets(emptyBuild()).size).toBe(0);
  });

  it('collects sockets from all equipped parts', () => {
    let build = equipPart(emptyBuild(), TORSO_PART);
    build = equipPart(build, HANDS_PART);
    const sockets = collectProvidedSockets(build);
    expect(sockets.has('chest_mount')).toBe(true);
    expect(sockets.has('hand')).toBe(true);
  });
});

describe('collectProvidedAnchors', () => {
  it('returns empty set for empty build', () => {
    expect(collectProvidedAnchors(emptyBuild()).size).toBe(0);
  });

  it('collects anchors from all equipped parts', () => {
    let build = equipPart(emptyBuild(), TORSO_PART);
    build = equipPart(build, HANDS_PART);
    const anchors = collectProvidedAnchors(build);
    expect(anchors.has('torso')).toBe(true);
    expect(anchors.has('arm_right')).toBe(true);
  });
});

// ── Validation ──

describe('validateCharacterBuild', () => {
  it('empty build reports all 4 required missing slots', () => {
    const issues = validateCharacterBuild(emptyBuild());
    const missing = issues.filter((i) => i.kind === 'missing_required_slot');
    expect(missing).toHaveLength(4);
    const missingSlots = missing.map((i) => i.slot).sort();
    expect(missingSlots).toEqual(['arms', 'head', 'legs', 'torso']);
  });

  it('all required missing slots are severity error', () => {
    const issues = validateCharacterBuild(emptyBuild());
    for (const issue of issues.filter((i) => i.kind === 'missing_required_slot')) {
      expect(issue.severity).toBe('error');
    }
  });

  it('partially filled build reports remaining missing slots', () => {
    const build = equipPart(equipPart(emptyBuild(), HEAD_PART), TORSO_PART);
    const issues = validateCharacterBuild(build);
    const missing = issues.filter((i) => i.kind === 'missing_required_slot');
    expect(missing).toHaveLength(2);
    const missingSlots = missing.map((i) => i.slot).sort();
    expect(missingSlots).toEqual(['arms', 'legs']);
  });

  it('valid build with all required slots reports no errors', () => {
    const issues = validateCharacterBuild(validBuild());
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('optional slots are not flagged as missing', () => {
    const issues = validateCharacterBuild(validBuild());
    const missing = issues.filter((i) => i.kind === 'missing_required_slot');
    expect(missing).toHaveLength(0);
  });

  it('detects slot mismatch when part declares wrong slot', () => {
    const mismatchedPart: CharacterPartRef = { sourceId: 'torso-in-head', slot: 'torso' };
    const build = emptyBuild({ slots: { head: mismatchedPart, torso: TORSO_PART, arms: ARMS_PART, legs: LEGS_PART } });
    const issues = validateCharacterBuild(build);
    const mismatches = issues.filter((i) => i.kind === 'slot_mismatch');
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].slot).toBe('head');
    expect(mismatches[0].severity).toBe('error');
  });

  it('detects missing required socket', () => {
    // Weapon requires 'hand' socket, but nothing provides it
    const build = emptyBuild({
      slots: {
        head: HEAD_PART,
        torso: TORSO_PART,
        arms: ARMS_PART,
        legs: LEGS_PART,
        weapon: WEAPON_PART,
      },
    });
    const issues = validateCharacterBuild(build);
    const socketIssues = issues.filter((i) => i.kind === 'missing_required_socket');
    expect(socketIssues).toHaveLength(1);
    expect(socketIssues[0].slot).toBe('weapon');
    expect(socketIssues[0].message).toContain('hand');
    expect(socketIssues[0].severity).toBe('warning');
  });

  it('no socket warning when requirement is satisfied', () => {
    const build = emptyBuild({
      slots: {
        head: HEAD_PART,
        torso: TORSO_PART,
        arms: ARMS_PART,
        legs: LEGS_PART,
        hands: HANDS_PART,
        weapon: WEAPON_PART,
      },
    });
    const issues = validateCharacterBuild(build);
    const socketIssues = issues.filter((i) => i.kind === 'missing_required_socket');
    expect(socketIssues).toHaveLength(0);
  });

  it('detects missing required anchor', () => {
    // Weapon requires 'arm_right' anchor, nothing provides it
    const build = emptyBuild({
      slots: {
        head: HEAD_PART,
        torso: TORSO_PART,
        arms: ARMS_PART,
        legs: LEGS_PART,
        weapon: WEAPON_PART,
      },
    });
    const issues = validateCharacterBuild(build);
    const anchorIssues = issues.filter((i) => i.kind === 'missing_required_anchor');
    expect(anchorIssues).toHaveLength(1);
    expect(anchorIssues[0].slot).toBe('weapon');
    expect(anchorIssues[0].message).toContain('arm_right');
    expect(anchorIssues[0].severity).toBe('warning');
  });

  it('no anchor warning when requirement is satisfied', () => {
    const build = emptyBuild({
      slots: {
        head: HEAD_PART,
        torso: TORSO_PART,
        arms: ARMS_PART,
        legs: LEGS_PART,
        hands: HANDS_PART,
        weapon: WEAPON_PART,
      },
    });
    const issues = validateCharacterBuild(build);
    const anchorIssues = issues.filter((i) => i.kind === 'missing_required_anchor');
    expect(anchorIssues).toHaveLength(0);
  });
});

describe('deriveMissingRequiredSlots', () => {
  it('returns all required for empty build', () => {
    expect(deriveMissingRequiredSlots(emptyBuild()).sort()).toEqual(['arms', 'head', 'legs', 'torso']);
  });

  it('returns empty for complete build', () => {
    expect(deriveMissingRequiredSlots(validBuild())).toHaveLength(0);
  });

  it('returns only unfilled required slots', () => {
    const build = equipPart(emptyBuild(), HEAD_PART);
    const missing = deriveMissingRequiredSlots(build).sort();
    expect(missing).toEqual(['arms', 'legs', 'torso']);
  });
});

describe('deriveEquippedParts', () => {
  it('returns empty array for empty build', () => {
    expect(deriveEquippedParts(emptyBuild())).toHaveLength(0);
  });

  it('returns all equipped parts with slot info', () => {
    const parts = deriveEquippedParts(validBuild());
    expect(parts).toHaveLength(4);
    expect(parts.map((p) => p.slot).sort()).toEqual(['arms', 'head', 'legs', 'torso']);
  });
});

describe('isCharacterBuildValid', () => {
  it('returns false for empty build (missing required slots)', () => {
    expect(isCharacterBuildValid(emptyBuild())).toBe(false);
  });

  it('returns true for complete valid build', () => {
    expect(isCharacterBuildValid(validBuild())).toBe(true);
  });

  it('returns true even with warnings (missing socket is a warning, not error)', () => {
    // Weapon with missing socket requirement — warning, not error
    const build = emptyBuild({
      slots: {
        head: HEAD_PART,
        torso: TORSO_PART,
        arms: ARMS_PART,
        legs: LEGS_PART,
        weapon: WEAPON_PART,
      },
    });
    expect(isCharacterBuildValid(build)).toBe(true);
  });

  it('returns false when slot mismatch exists (error)', () => {
    const mismatched: CharacterPartRef = { sourceId: 'wrong', slot: 'weapon' };
    const build = emptyBuild({
      slots: { head: mismatched, torso: TORSO_PART, arms: ARMS_PART, legs: LEGS_PART },
    });
    expect(isCharacterBuildValid(build)).toBe(false);
  });
});
