import type {
  CharacterBuild,
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
