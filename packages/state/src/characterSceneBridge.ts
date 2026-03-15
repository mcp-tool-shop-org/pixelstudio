import type {
  CharacterBuild,
  CharacterValidationIssue,
  SceneAssetInstance,
  CharacterSlotSnapshot,
  CharacterSlotId,
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
  };
}
