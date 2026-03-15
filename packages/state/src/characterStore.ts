import { create } from 'zustand';
import type {
  CharacterBuild,
  CharacterBuildLibrary,
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
import {
  createEmptyLibrary,
  generateSavedBuildId,
  saveBuildToLibrary,
  deleteBuildFromLibrary,
  duplicateBuildInLibrary,
  toCharacterBuild,
  findBuildById,
} from './characterBuildLibrary';

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
  /** In-memory build library. */
  buildLibrary: CharacterBuildLibrary;
  /** Currently selected library row ID (independent of slot selection). */
  selectedLibraryBuildId: string | null;
  /** The saved build ID the active editor was loaded from / last saved as. Null = never saved. */
  activeSavedBuildId: string | null;

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

  // ── Library actions ──

  /** Set the in-memory library (e.g. after loading from storage). */
  setLibrary: (library: CharacterBuildLibrary) => void;
  /** Save the current active build into the library (overwrite by ID). Returns updated library. */
  saveActiveBuildToLibrary: () => CharacterBuildLibrary | null;
  /** Save the current active build as a new library entry with a new ID. Returns updated library. */
  saveAsNewToLibrary: () => CharacterBuildLibrary | null;
  /** Load a saved build from the library into the active editor. */
  loadLibraryBuildIntoActive: (buildId: string) => void;
  /** Duplicate a build in the library. Returns updated library. */
  duplicateLibraryBuild: (buildId: string) => CharacterBuildLibrary | null;
  /** Delete a build from the library. Returns updated library. */
  deleteLibraryBuild: (buildId: string) => CharacterBuildLibrary | null;
  /** Select a library row (independent from slot selection). */
  selectLibraryBuild: (buildId: string | null) => void;
  /** Revert active build to the last saved version. No-op if no saved identity. */
  revertToSaved: () => void;
}

// ── Initial state ──

const initialState = {
  activeCharacterBuild: null as CharacterBuild | null,
  selectedSlot: null as CharacterSlotId | null,
  validationIssues: [] as CharacterValidationIssue[],
  isDirty: false,
  buildLibrary: createEmptyLibrary() as CharacterBuildLibrary,
  selectedLibraryBuildId: null as string | null,
  activeSavedBuildId: null as string | null,
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
      activeSavedBuildId: null,
    });
  },

  loadCharacterBuild: (build) => {
    set({
      activeCharacterBuild: build,
      selectedSlot: null,
      validationIssues: revalidate(build),
      isDirty: false,
      activeSavedBuildId: null,
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

  clearCharacterBuild: () =>
    set((s) => ({
      ...initialState,
      buildLibrary: s.buildLibrary,
      selectedLibraryBuildId: s.selectedLibraryBuildId,
      activeSavedBuildId: null,
    })),

  revalidateCharacterBuild: () =>
    set((s) => ({
      validationIssues: revalidate(s.activeCharacterBuild),
    })),

  // ── Library actions ──

  setLibrary: (library) => set({ buildLibrary: library }),

  saveActiveBuildToLibrary: () => {
    const s = useCharacterStore.getState();
    if (!s.activeCharacterBuild) return null;
    const updated = saveBuildToLibrary(s.buildLibrary, s.activeCharacterBuild);
    useCharacterStore.setState({
      buildLibrary: updated,
      isDirty: false,
      activeSavedBuildId: s.activeCharacterBuild.id,
    });
    return updated;
  },

  saveAsNewToLibrary: () => {
    const s = useCharacterStore.getState();
    if (!s.activeCharacterBuild) return null;
    const newId = generateSavedBuildId();
    const forked: CharacterBuild = { ...s.activeCharacterBuild, id: newId };
    const updated = saveBuildToLibrary(s.buildLibrary, forked);
    useCharacterStore.setState({
      activeCharacterBuild: forked,
      buildLibrary: updated,
      isDirty: false,
      activeSavedBuildId: newId,
    });
    return updated;
  },

  loadLibraryBuildIntoActive: (buildId) => {
    const s = useCharacterStore.getState();
    const saved = findBuildById(s.buildLibrary, buildId);
    if (!saved) return;
    const build = toCharacterBuild(saved);
    useCharacterStore.setState({
      activeCharacterBuild: build,
      selectedSlot: null,
      validationIssues: revalidate(build),
      isDirty: false,
      selectedLibraryBuildId: buildId,
      activeSavedBuildId: buildId,
    });
  },

  duplicateLibraryBuild: (buildId) => {
    const s = useCharacterStore.getState();
    const result = duplicateBuildInLibrary(s.buildLibrary, buildId);
    if (!result.newBuildId) return null;
    useCharacterStore.setState({ buildLibrary: result.library });
    return result.library;
  },

  deleteLibraryBuild: (buildId) => {
    const s = useCharacterStore.getState();
    const updated = deleteBuildFromLibrary(s.buildLibrary, buildId);
    const newSelected = s.selectedLibraryBuildId === buildId ? null : s.selectedLibraryBuildId;
    const newActiveSaved = s.activeSavedBuildId === buildId ? null : s.activeSavedBuildId;
    useCharacterStore.setState({
      buildLibrary: updated,
      selectedLibraryBuildId: newSelected,
      activeSavedBuildId: newActiveSaved,
      isDirty: newActiveSaved === null && s.activeSavedBuildId === buildId ? true : s.isDirty,
    });
    return updated;
  },

  selectLibraryBuild: (buildId) => set({ selectedLibraryBuildId: buildId }),

  revertToSaved: () => {
    const s = useCharacterStore.getState();
    if (!s.activeSavedBuildId) return;
    const saved = findBuildById(s.buildLibrary, s.activeSavedBuildId);
    if (!saved) return;
    const build = toCharacterBuild(saved);
    useCharacterStore.setState({
      activeCharacterBuild: build,
      selectedSlot: null,
      validationIssues: revalidate(build),
      isDirty: false,
    });
  },
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
