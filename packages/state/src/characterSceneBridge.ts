import type {
  CharacterBuild,
  CharacterPartRef,
  CharacterValidationIssue,
  SceneAssetInstance,
  CharacterSlotSnapshot,
  CharacterSlotId,
  CharacterInstanceOverrides,
  CharacterSlotOverride,
  CharacterSlotOverrideMode,
} from '@glyphstudio/domain';
import { CHARACTER_SLOT_IDS } from '@glyphstudio/domain';

// ── Snapshot helpers ──

/**
 * Create a slot snapshot from a character build.
 * Captures which slots have which parts at the moment of snapshot.
 */
export function createSlotSnapshot(build: CharacterBuild): CharacterSlotSnapshot {
  const slots: Record<string, string> = {};
  for (const [slotId, part] of Object.entries(build.slots)) {
    if (part) {
      slots[slotId] = part.sourceId;
    }
  }
  return {
    slots,
    equippedCount: Object.keys(slots).length,
    totalSlots: CHARACTER_SLOT_IDS.length,
  };
}

// ── Instance ID generation ──

let nextCharacterInstanceId = 1;

/** Generate a unique scene instance ID for a character placement. */
export function generateCharacterInstanceId(): string {
  return `char-inst-${Date.now()}-${nextCharacterInstanceId++}`;
}

// ── Placeability ──

/** Result of checking whether a build can be placed into a scene. */
export interface PlaceabilityResult {
  /** Whether the build is placeable. */
  placeable: boolean;
  /** Reason placement is blocked (only when placeable is false). */
  reason?: string;
}

/**
 * Check whether a character build can be placed into a scene.
 *
 * Placement rules (v1):
 * - Build must exist
 * - Build must have at least one equipped slot
 * - Build must have zero validation errors (warnings are allowed)
 */
export function checkPlaceability(
  build: CharacterBuild | null,
  validationIssues: CharacterValidationIssue[],
): PlaceabilityResult {
  if (!build) {
    return { placeable: false, reason: 'No active build' };
  }

  const equippedCount = Object.keys(build.slots).length;
  if (equippedCount === 0) {
    return { placeable: false, reason: 'Build has no equipped parts' };
  }

  const errors = validationIssues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    return {
      placeable: false,
      reason: `Build has ${errors.length} error${errors.length !== 1 ? 's' : ''} — resolve before placing`,
    };
  }

  return { placeable: true };
}

// ── Placement defaults ──

/** Default placement values for a new character scene instance. */
export const CHARACTER_PLACEMENT_DEFAULTS = {
  x: 0,
  y: 0,
  zOrder: 0,
  visible: true,
  opacity: 1.0,
  parallax: 1.0,
} as const;

// ── Placement ──

/** Options for placing a character build into a scene. */
export interface CharacterPlacementOptions {
  /** Override X position (default: 0). */
  x?: number;
  /** Override Y position (default: 0). */
  y?: number;
  /** Override Z-order (default: 0). */
  zOrder?: number;
  /** Override instance name (default: build name). */
  name?: string;
  /** Source path for the project file (required for scene rendering). */
  sourcePath?: string;
}

/**
 * Create a scene asset instance from a character build.
 *
 * This is the core placement transform — it converts a Character Build
 * (authoring artifact) into a SceneAssetInstance (scene composition unit).
 *
 * The placement creates a snapshot: the scene instance records what the
 * build looked like at placement time. Future edits to the source build
 * do not automatically propagate. Use `reapplyCharacterBuild` (future)
 * to manually refresh.
 *
 * @returns A new SceneAssetInstance with instanceKind 'character'
 */
export function placeCharacterBuild(
  build: CharacterBuild,
  options: CharacterPlacementOptions = {},
): SceneAssetInstance {
  return {
    instanceId: generateCharacterInstanceId(),
    sourcePath: options.sourcePath ?? '',
    instanceKind: 'character',
    sourceCharacterBuildId: build.id,
    sourceCharacterBuildName: build.name,
    characterSlotSnapshot: createSlotSnapshot(build),
    name: options.name ?? build.name,
    x: options.x ?? CHARACTER_PLACEMENT_DEFAULTS.x,
    y: options.y ?? CHARACTER_PLACEMENT_DEFAULTS.y,
    zOrder: options.zOrder ?? CHARACTER_PLACEMENT_DEFAULTS.zOrder,
    visible: CHARACTER_PLACEMENT_DEFAULTS.visible,
    opacity: CHARACTER_PLACEMENT_DEFAULTS.opacity,
    parallax: CHARACTER_PLACEMENT_DEFAULTS.parallax,
  };
}

// ── Instance queries ──

/** Check if a scene instance is a character-derived instance. */
export function isCharacterInstance(instance: SceneAssetInstance): boolean {
  return instance.instanceKind === 'character';
}

/** Check if a character instance's source build is available in the library. */
export function isSourceBuildAvailable(
  instance: SceneAssetInstance,
  libraryBuildIds: string[],
): boolean {
  if (!instance.sourceCharacterBuildId) return false;
  return libraryBuildIds.includes(instance.sourceCharacterBuildId);
}

// ── Instance summary helpers ──

/** Source linkage status for a character scene instance. */
export type CharacterSourceStatus = 'linked' | 'missing-source' | 'not-character';

/** Derive the source linkage status for a scene instance. */
export function deriveSourceStatus(
  instance: SceneAssetInstance,
  libraryBuildIds: string[],
): CharacterSourceStatus {
  if (instance.instanceKind !== 'character') return 'not-character';
  return isSourceBuildAvailable(instance, libraryBuildIds) ? 'linked' : 'missing-source';
}

/** Human-readable source status label. */
export function sourceStatusLabel(status: CharacterSourceStatus): string {
  switch (status) {
    case 'linked': return 'Linked';
    case 'missing-source': return 'Source missing';
    case 'not-character': return '';
  }
}

/** Build name with fallback for missing data. */
export function instanceBuildName(instance: SceneAssetInstance): string {
  if (instance.instanceKind !== 'character') return '';
  return instance.sourceCharacterBuildName || 'Unknown build';
}

/** Snapshot summary text (e.g. "4/12 equipped"). */
export function snapshotSummary(instance: SceneAssetInstance): string {
  if (!instance.characterSlotSnapshot) return '0/0 equipped';
  const { equippedCount, totalSlots } = instance.characterSlotSnapshot;
  return `${equippedCount}/${totalSlots} equipped`;
}

/**
 * Check if a character instance's snapshot may be stale relative to the
 * current source build in the library.
 *
 * Compares equipped slot count and build name — a lightweight heuristic
 * that avoids deep slot-by-slot diffing. Returns false for non-character
 * instances or when the source is missing.
 */
export function isSnapshotPossiblyStale(
  instance: SceneAssetInstance,
  sourceBuild: { name: string; slots: Record<string, unknown> } | undefined,
): boolean {
  if (instance.instanceKind !== 'character' || !sourceBuild) return false;
  if (!instance.characterSlotSnapshot) return true;
  const sourceEquipped = Object.keys(sourceBuild.slots).length;
  if (instance.characterSlotSnapshot.equippedCount !== sourceEquipped) return true;
  if (instance.sourceCharacterBuildName !== sourceBuild.name) return true;
  return false;
}

// ── Reapply ──

/**
 * Reapply a character build onto an existing scene instance.
 *
 * Refreshes the character snapshot (name, slots) while preserving
 * scene-local state (position, z-order, visibility, opacity, parallax).
 *
 * @returns A new instance with updated character data, or null if instance
 *          is not a character instance.
 */
export function reapplyCharacterBuild(
  instance: SceneAssetInstance,
  build: CharacterBuild,
): SceneAssetInstance | null {
  if (instance.instanceKind !== 'character') return null;

  return {
    ...instance,
    sourceCharacterBuildId: build.id,
    sourceCharacterBuildName: build.name,
    characterSlotSnapshot: createSlotSnapshot(build),
    // Overrides are preserved across reapply — they layer on top of the new snapshot
  };
}

// ── Character instance overrides ──

/**
 * Effective slot composition after applying overrides to a snapshot.
 * Key = slot ID, value = source part ID (slots removed by override are absent).
 */
export type EffectiveSlotComposition = Record<string, string>;

/**
 * Apply local overrides to a snapshot, producing the effective slot composition.
 *
 * Rules:
 * - Slots not in overrides inherit from snapshot as-is
 * - 'replace' override swaps the slot occupant
 * - 'remove' override deletes the slot from effective composition
 * - Override for a slot not in snapshot: 'replace' adds it, 'remove' is a no-op
 */
export function applyOverridesToSnapshot(
  snapshot: CharacterSlotSnapshot | undefined,
  overrides: CharacterInstanceOverrides | undefined,
): EffectiveSlotComposition {
  // Start with snapshot slots
  const effective: EffectiveSlotComposition = { ...(snapshot?.slots ?? {}) };

  if (!overrides) return effective;

  for (const [slotId, override] of Object.entries(overrides)) {
    switch (override.mode) {
      case 'remove':
        delete effective[slotId];
        break;
      case 'replace':
        if (override.replacementPartId) {
          effective[slotId] = override.replacementPartId;
        }
        break;
    }
  }

  return effective;
}

/**
 * Derive the effective slot composition for a character scene instance.
 * Combines snapshot + local overrides.
 * Returns empty composition for non-character instances.
 */
export function deriveEffectiveSlots(
  instance: SceneAssetInstance,
): EffectiveSlotComposition {
  if (instance.instanceKind !== 'character') return {};
  return applyOverridesToSnapshot(instance.characterSlotSnapshot, instance.characterOverrides);
}

/** Check if a character instance has any local overrides. */
export function hasOverrides(instance: SceneAssetInstance): boolean {
  if (!instance.characterOverrides) return false;
  return Object.keys(instance.characterOverrides).length > 0;
}

/** Get the list of slot IDs that have local overrides. */
export function getOverriddenSlots(instance: SceneAssetInstance): string[] {
  if (!instance.characterOverrides) return [];
  return Object.keys(instance.characterOverrides);
}

/** Check if a specific slot has a local override. */
export function isSlotOverridden(instance: SceneAssetInstance, slotId: string): boolean {
  if (!instance.characterOverrides) return false;
  return slotId in instance.characterOverrides;
}

/** Get the override for a specific slot, or undefined if not overridden. */
export function getSlotOverride(
  instance: SceneAssetInstance,
  slotId: string,
): CharacterSlotOverride | undefined {
  return instance.characterOverrides?.[slotId];
}

/**
 * Create a new instance with a slot override applied.
 * Returns a new instance — does not mutate.
 */
export function setSlotOverride(
  instance: SceneAssetInstance,
  override: CharacterSlotOverride,
): SceneAssetInstance {
  const existing = instance.characterOverrides ?? {};
  return {
    ...instance,
    characterOverrides: {
      ...existing,
      [override.slot]: override,
    },
  };
}

/**
 * Create a new instance with a slot override cleared.
 * Returns a new instance — does not mutate.
 * If no overrides remain, characterOverrides is set to undefined.
 */
export function clearSlotOverride(
  instance: SceneAssetInstance,
  slotId: string,
): SceneAssetInstance {
  if (!instance.characterOverrides || !(slotId in instance.characterOverrides)) {
    return instance;
  }
  const { [slotId]: _removed, ...remaining } = instance.characterOverrides;
  return {
    ...instance,
    characterOverrides: Object.keys(remaining).length > 0 ? remaining : undefined,
  };
}

/**
 * Create a new instance with all overrides cleared.
 * Returns a new instance — does not mutate.
 */
export function clearAllOverrides(instance: SceneAssetInstance): SceneAssetInstance {
  if (!instance.characterOverrides) return instance;
  return { ...instance, characterOverrides: undefined };
}

// ── Effective slot state derivation ──

/** Source of a slot's effective value in the three-layer model. */
export type EffectiveSlotSource = 'inherited' | 'override_replace' | 'override_remove';

/** Per-slot derivation result — UI-ready representation of a single slot's state. */
export interface EffectiveCharacterSlotState {
  /** Slot ID. */
  slot: CharacterSlotId;
  /** Effective part source ID (undefined if slot is empty or removed). */
  effectivePart: string | undefined;
  /** Where this slot's value comes from. */
  source: EffectiveSlotSource;
  /** Whether this slot has a local override. */
  isOverridden: boolean;
  /** Override mode if overridden, undefined otherwise. */
  overrideMode: CharacterSlotOverrideMode | undefined;
  /** Whether the slot has a part in the effective composition. */
  hasPart: boolean;
}

/**
 * Derive per-slot effective state for all canonical slots on a character instance.
 *
 * Returns one entry per slot in CHARACTER_SLOT_IDS canonical order.
 * Non-character instances return an empty array.
 */
export function deriveEffectiveCharacterSlotStates(
  instance: SceneAssetInstance,
): EffectiveCharacterSlotState[] {
  if (instance.instanceKind !== 'character') return [];

  const effective = applyOverridesToSnapshot(
    instance.characterSlotSnapshot,
    instance.characterOverrides,
  );

  return CHARACTER_SLOT_IDS.map((slotId): EffectiveCharacterSlotState => {
    const override = instance.characterOverrides?.[slotId];
    const effectivePart = effective[slotId];

    if (override) {
      return {
        slot: slotId,
        effectivePart,
        source: override.mode === 'remove' ? 'override_remove' : 'override_replace',
        isOverridden: true,
        overrideMode: override.mode,
        hasPart: effectivePart !== undefined,
      };
    }

    return {
      slot: slotId,
      effectivePart,
      source: 'inherited',
      isOverridden: false,
      overrideMode: undefined,
      hasPart: effectivePart !== undefined,
    };
  });
}

// ── Higher-level override status helpers ──

/** Count of local overrides on a character instance. */
export function getOverrideCount(instance: SceneAssetInstance): number {
  if (!instance.characterOverrides) return 0;
  return Object.keys(instance.characterOverrides).length;
}

/** Count of equipped slots in the effective composition (after overrides). */
export function getEffectiveEquippedCount(instance: SceneAssetInstance): number {
  if (instance.instanceKind !== 'character') return 0;
  const effective = applyOverridesToSnapshot(
    instance.characterSlotSnapshot,
    instance.characterOverrides,
  );
  return Object.keys(effective).length;
}

/** Get slot IDs that have 'remove' overrides. */
export function getRemovedOverrideSlots(instance: SceneAssetInstance): string[] {
  if (!instance.characterOverrides) return [];
  return Object.entries(instance.characterOverrides)
    .filter(([, ov]) => ov.mode === 'remove')
    .map(([slotId]) => slotId);
}

/** Get slot IDs that have 'replace' overrides. */
export function getReplacedOverrideSlots(instance: SceneAssetInstance): string[] {
  if (!instance.characterOverrides) return [];
  return Object.entries(instance.characterOverrides)
    .filter(([, ov]) => ov.mode === 'replace')
    .map(([slotId]) => slotId);
}

// ── Summary helpers ──

/** Compact override summary text (e.g. "2 local overrides"). */
export function overrideSummary(instance: SceneAssetInstance): string {
  const count = getOverrideCount(instance);
  if (count === 0) return 'No local overrides';
  return `${count} local override${count !== 1 ? 's' : ''}`;
}

/** Effective slot summary text (e.g. "4/12 effective"). */
export function effectiveSlotSummary(instance: SceneAssetInstance): string {
  if (instance.instanceKind !== 'character') return '';
  const equipped = getEffectiveEquippedCount(instance);
  return `${equipped}/${CHARACTER_SLOT_IDS.length} effective`;
}

// ── Compatibility bridge ──

/**
 * Build a synthetic CharacterBuild from a character instance's effective composition.
 *
 * This bridges the scene-instance world (snapshots + overrides) to the
 * character-build world (CharacterBuild) so that compatibility helpers
 * like `classifyPresetCompatibility` can operate on scene instances.
 *
 * The synthetic build contains minimal CharacterPartRef entries (sourceId + slot only).
 * Socket/anchor data is not available from snapshots, so compatibility checks
 * will be degraded for those dimensions — slot matching remains fully accurate.
 *
 * Returns null for non-character instances.
 */
export function effectiveCompositionAsBuild(
  instance: SceneAssetInstance,
): CharacterBuild | null {
  if (instance.instanceKind !== 'character') return null;

  const effective = deriveEffectiveSlots(instance);
  const slots: Partial<Record<CharacterSlotId, CharacterPartRef>> = {};

  for (const [slotId, sourceId] of Object.entries(effective)) {
    slots[slotId as CharacterSlotId] = {
      sourceId,
      slot: slotId as CharacterSlotId,
    };
  }

  return {
    id: instance.instanceId,
    name: instance.name,
    slots,
  };
}
