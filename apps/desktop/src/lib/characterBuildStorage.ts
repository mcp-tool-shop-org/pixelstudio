import type { CharacterBuildLibrary, SavedCharacterBuild, CharacterPartRef, CharacterSlotId } from '@glyphstudio/domain';
import { CHARACTER_BUILD_LIBRARY_VERSION, CHARACTER_SLOT_IDS } from '@glyphstudio/domain';
import { createEmptyLibrary } from '@glyphstudio/state';

const STORAGE_KEY = 'glyphstudio_character_builds';

const VALID_SLOTS = new Set<string>(CHARACTER_SLOT_IDS);

// ── Coercion helpers ──

function isValidSlotId(s: unknown): s is CharacterSlotId {
  return typeof s === 'string' && VALID_SLOTS.has(s);
}

function coercePartRef(raw: unknown): CharacterPartRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sourceId !== 'string' || !r.sourceId) return null;
  if (!isValidSlotId(r.slot)) return null;

  const part: CharacterPartRef = {
    sourceId: r.sourceId,
    slot: r.slot,
  };

  if (typeof r.variantId === 'string') part.variantId = r.variantId;
  if (Array.isArray(r.tags) && r.tags.every((t: unknown) => typeof t === 'string')) part.tags = r.tags;
  if (Array.isArray(r.requiredSockets) && r.requiredSockets.every((s: unknown) => typeof s === 'string')) part.requiredSockets = r.requiredSockets;
  if (Array.isArray(r.providedSockets) && r.providedSockets.every((s: unknown) => typeof s === 'string')) part.providedSockets = r.providedSockets;
  if (Array.isArray(r.requiredAnchors) && r.requiredAnchors.every((a: unknown) => typeof a === 'string')) part.requiredAnchors = r.requiredAnchors;
  if (Array.isArray(r.providedAnchors) && r.providedAnchors.every((a: unknown) => typeof a === 'string')) part.providedAnchors = r.providedAnchors;

  return part;
}

function coerceSlots(raw: unknown): Partial<Record<CharacterSlotId, CharacterPartRef>> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Partial<Record<CharacterSlotId, CharacterPartRef>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidSlotId(key)) continue;
    const part = coercePartRef(value);
    if (part) result[key] = part;
  }
  return result;
}

function coerceSavedBuild(raw: unknown): SavedCharacterBuild | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.name !== 'string' || !r.name) return null;
  if (typeof r.createdAt !== 'string') return null;
  if (typeof r.updatedAt !== 'string') return null;

  const build: SavedCharacterBuild = {
    id: r.id,
    name: r.name,
    slots: coerceSlots(r.slots),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };

  if (Array.isArray(r.tags) && r.tags.every((t: unknown) => typeof t === 'string')) build.tags = r.tags;
  if (typeof r.description === 'string') build.description = r.description;
  if (typeof r.sourcePresetId === 'string') build.sourcePresetId = r.sourcePresetId;

  return build;
}

// ── Public API ──

export function loadCharacterBuildLibrary(): CharacterBuildLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyLibrary();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyLibrary();

    // Version guard
    if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion !== CHARACTER_BUILD_LIBRARY_VERSION) {
      return createEmptyLibrary();
    }

    if (!Array.isArray(parsed.builds)) return createEmptyLibrary();

    const builds: SavedCharacterBuild[] = [];
    for (const entry of parsed.builds) {
      const build = coerceSavedBuild(entry);
      if (build) builds.push(build);
    }

    return {
      schemaVersion: CHARACTER_BUILD_LIBRARY_VERSION,
      builds,
    };
  } catch {
    return createEmptyLibrary();
  }
}

export function saveCharacterBuildLibrary(library: CharacterBuildLibrary): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    /* localStorage unavailable — silently skip */
  }
}
