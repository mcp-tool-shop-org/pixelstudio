import { create } from 'zustand';
import type {
  CharacterBuild,
  CharacterPartRef,
  CharacterSlotId,
  CharacterValidationIssue,
} from '@glyphstudio/domain';
import { CHARACTER_SLOT_IDS } from '@glyphstudio/domain';
import {
  equipPart,
  unequipSlot,
  validateCharacterBuild,
  deriveMissingRequiredSlots,
  deriveEquippedParts,
} from './characterHelpers';

// ── State shape ──

interface CharacterState {
  /** The active character build being edited. Null when no character is open. */
  activeCharacterBuild: CharacterBuild | null;
  /** Currently selected slot in the builder UI. */
  selectedSlot: CharacterSlotId | null;
  /** Cached validation issues for the active build. */
  validationIssues: CharacterValidationIssue[];
  /** Whether the build has been modified since last save/load. */
  isDirty: boolean;

  // ── Actions ──

  /** Create a new empty character build. */
  createCharacterBuild: (name?: string) => void;
  /** Load an existing character build into state. */
  loadCharacterBuild: (build: CharacterBuild) => void;
  /** Set the character name. */
  setCharacterName: (name: string) => void;
  /** Select a slot in the builder UI. */
  selectSlot: (slot: CharacterSlotId | null) => void;
  /** Equip a part into its declared slot. Replaces existing occupant. */
  equipCharacterPart: (part: CharacterPartRef) => void;
  /** Remove the part from a slot. */
  unequipCharacterSlot: (slot: CharacterSlotId) => void;
  /** Replace the part in a slot (equip with explicit replace semantics). */
  replaceCharacterPart: (part: CharacterPartRef) => void;
  /** Clear the active build entirely. */
  clearCharacterBuild: () => void;
  /** Force re-derive validation from current build state. */
  revalidateCharacterBuild: () => void;
}

// ── Initial state ──

const initialState = {
  activeCharacterBuild: null as CharacterBuild | null,
  selectedSlot: null as CharacterSlotId | null,
  validationIssues: [] as CharacterValidationIssue[],
  isDirty: false,
};

// ── Helpers ──

let nextBuildId = 1;

function generateBuildId(): string {
  return `char-build-${nextBuildId++}`;
}

/** Revalidate and return new validation issues for a build. */
function revalidate(build: CharacterBuild | null): CharacterValidationIssue[] {
  if (!build) return [];
  return validateCharacterBuild(build);
}

// ── Store ──

// Character state is the authoring truth for character assembly.
// Layer state is the rendering/composition consequence — it reflects
// what the character looks like, but character slots and parts are
// the primary identity. Future commits will add character→layer
// synchronization, but the character store is always the authority
// for "what is this character made of."

export const useCharacterStore = create<CharacterState>((set) => ({
  ...initialState,

  createCharacterBuild: (name) => {
    const build: CharacterBuild = {
      id: generateBuildId(),
      name: name ?? 'Untitled Character',
      slots: {},
    };
    set({
      activeCharacterBuild: build,
      selectedSlot: null,
      validationIssues: revalidate(build),
      isDirty: false,
    });
  },

  loadCharacterBuild: (build) => {
    set({
      activeCharacterBuild: build,
      selectedSlot: null,
      validationIssues: revalidate(build),
      isDirty: false,
    });
  },

  setCharacterName: (name) =>
    set((s) => {
      if (!s.activeCharacterBuild) return s;
      const updated = { ...s.activeCharacterBuild, name };
      return {
        activeCharacterBuild: updated,
        isDirty: true,
      };
    }),

  selectSlot: (slot) => set({ selectedSlot: slot }),

  equipCharacterPart: (part) =>
    set((s) => {
      if (!s.activeCharacterBuild) return s;
      const updated = equipPart(s.activeCharacterBuild, part);
      return {
        activeCharacterBuild: updated,
        validationIssues: revalidate(updated),
        isDirty: true,
      };
    }),

  unequipCharacterSlot: (slot) =>
    set((s) => {
      if (!s.activeCharacterBuild) return s;
      const updated = unequipSlot(s.activeCharacterBuild, slot);
      return {
        activeCharacterBuild: updated,
        validationIssues: revalidate(updated),
        isDirty: true,
      };
    }),

  replaceCharacterPart: (part) =>
    set((s) => {
      if (!s.activeCharacterBuild) return s;
      const updated = equipPart(s.activeCharacterBuild, part);
      return {
        activeCharacterBuild: updated,
        validationIssues: revalidate(updated),
        isDirty: true,
      };
    }),

  clearCharacterBuild: () => set(initialState),

  revalidateCharacterBuild: () =>
    set((s) => ({
      validationIssues: revalidate(s.activeCharacterBuild),
    })),
}));

// ── Derived selectors ──

/** Get the equipped part for a specific slot, or undefined. */
export function getEquippedPartForSlot(
  state: CharacterState,
  slot: CharacterSlotId,
): CharacterPartRef | undefined {
  return state.activeCharacterBuild?.slots[slot];
}

/** Get missing required slots for the active build. */
export function getMissingRequiredSlots(state: CharacterState): CharacterSlotId[] {
  if (!state.activeCharacterBuild) return [];
  return deriveMissingRequiredSlots(state.activeCharacterBuild);
}

/** Get only error-severity issues. */
export function getCharacterErrors(state: CharacterState): CharacterValidationIssue[] {
  return state.validationIssues.filter((i) => i.severity === 'error');
}

/** Get only warning-severity issues. */
export function getCharacterWarnings(state: CharacterState): CharacterValidationIssue[] {
  return state.validationIssues.filter((i) => i.severity === 'warning');
}

/** Check if the active build has zero errors. */
export function isCharacterValid(state: CharacterState): boolean {
  return getCharacterErrors(state).length === 0;
}

/** Get equipped slots in canonical display order. */
export function getEquippedSlotsInDisplayOrder(
  state: CharacterState,
): { slot: CharacterSlotId; part: CharacterPartRef }[] {
  if (!state.activeCharacterBuild) return [];
  const equipped = deriveEquippedParts(state.activeCharacterBuild);
  // Sort by canonical slot order
  const order = new Map(CHARACTER_SLOT_IDS.map((s, i) => [s, i]));
  return equipped.sort((a, b) => (order.get(a.slot) ?? 99) - (order.get(b.slot) ?? 99));
}
