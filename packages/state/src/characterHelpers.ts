import type {
  CharacterBuild,
  CharacterPartRef,
  CharacterSlotId,
  CharacterValidationIssue,
} from '@glyphstudio/domain';
import {
  REQUIRED_SLOTS,
  CHARACTER_SLOT_LABELS,
} from '@glyphstudio/domain';

// ── Slot operations ──

/** Equip a part into a slot, replacing any existing occupant. Returns a new build. */
export function equipPart(build: CharacterBuild, part: CharacterPartRef): CharacterBuild {
  return {
    ...build,
    slots: { ...build.slots, [part.slot]: part },
  };
}

/** Remove the part from a slot. Returns a new build. */
export function unequipSlot(build: CharacterBuild, slot: CharacterSlotId): CharacterBuild {
  const { [slot]: _, ...rest } = build.slots;
  return { ...build, slots: rest };
}

/** Replace the part in a slot (alias for equipPart — semantically distinct in UI). */
export function replacePart(build: CharacterBuild, part: CharacterPartRef): CharacterBuild {
  return equipPart(build, part);
}

// ── Compatibility ──

/** Check if a part's declared slot matches the target slot. */
export function isSlotCompatible(part: CharacterPartRef, targetSlot: CharacterSlotId): boolean {
  return part.slot === targetSlot;
}

/** Get the set of all socket roles provided by all equipped parts. */
export function collectProvidedSockets(build: CharacterBuild): Set<string> {
  const provided = new Set<string>();
  for (const part of Object.values(build.slots)) {
    if (part?.providedSockets) {
      for (const s of part.providedSockets) provided.add(s);
    }
  }
  return provided;
}

/** Get the set of all anchor kinds provided by all equipped parts. */
export function collectProvidedAnchors(build: CharacterBuild): Set<string> {
  const provided = new Set<string>();
  for (const part of Object.values(build.slots)) {
    if (part?.providedAnchors) {
      for (const a of part.providedAnchors) provided.add(a);
    }
  }
  return provided;
}

// ── Validation ──

/** Validate a character build and return all issues. */
export function validateCharacterBuild(build: CharacterBuild): CharacterValidationIssue[] {
  const issues: CharacterValidationIssue[] = [];

  // 1. Missing required slots
  for (const slot of REQUIRED_SLOTS) {
    if (!build.slots[slot]) {
      issues.push({
        kind: 'missing_required_slot',
        slot,
        message: `Required slot "${CHARACTER_SLOT_LABELS[slot]}" is empty.`,
        severity: 'error',
      });
    }
  }

  // 2. Slot mismatch — part declares a different slot than it occupies
  for (const [slot, part] of Object.entries(build.slots) as [CharacterSlotId, CharacterPartRef | undefined][]) {
    if (part && part.slot !== slot) {
      issues.push({
        kind: 'slot_mismatch',
        slot,
        message: `Part "${part.sourceId}" declares slot "${CHARACTER_SLOT_LABELS[part.slot]}" but is equipped in "${CHARACTER_SLOT_LABELS[slot]}".`,
        severity: 'error',
      });
    }
  }

  // Collect what the entire build provides
  const providedSockets = collectProvidedSockets(build);
  const providedAnchors = collectProvidedAnchors(build);

  // 3. Missing required sockets
  for (const [slot, part] of Object.entries(build.slots) as [CharacterSlotId, CharacterPartRef | undefined][]) {
    if (!part?.requiredSockets) continue;
    for (const req of part.requiredSockets) {
      if (!providedSockets.has(req)) {
        issues.push({
          kind: 'missing_required_socket',
          slot,
          message: `Part in "${CHARACTER_SLOT_LABELS[slot]}" requires socket "${req}" but no equipped part provides it.`,
          severity: 'warning',
        });
      }
    }
  }

  // 4. Missing required anchors
  for (const [slot, part] of Object.entries(build.slots) as [CharacterSlotId, CharacterPartRef | undefined][]) {
    if (!part?.requiredAnchors) continue;
    for (const req of part.requiredAnchors) {
      if (!providedAnchors.has(req)) {
        issues.push({
          kind: 'missing_required_anchor',
          slot,
          message: `Part in "${CHARACTER_SLOT_LABELS[slot]}" requires anchor "${req}" but no equipped part provides it.`,
          severity: 'warning',
        });
      }
    }
  }

  return issues;
}

/** Derive the list of missing required slots from a build. */
export function deriveMissingRequiredSlots(build: CharacterBuild): CharacterSlotId[] {
  return REQUIRED_SLOTS.filter((slot) => !build.slots[slot]);
}

/** Derive the current composition: ordered list of equipped parts. */
export function deriveEquippedParts(build: CharacterBuild): { slot: CharacterSlotId; part: CharacterPartRef }[] {
  return (Object.entries(build.slots) as [CharacterSlotId, CharacterPartRef | undefined][])
    .filter((entry): entry is [CharacterSlotId, CharacterPartRef] => entry[1] !== undefined)
    .map(([slot, part]) => ({ slot, part }));
}

/** Check if a build has zero validation errors (warnings are ok). */
export function isCharacterBuildValid(build: CharacterBuild): boolean {
  return validateCharacterBuild(build).filter((i) => i.severity === 'error').length === 0;
}
