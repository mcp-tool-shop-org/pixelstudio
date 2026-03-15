import type {
  CharacterBuild,
  CharacterBuildLibrary,
  SavedCharacterBuild,
} from '@glyphstudio/domain';
import { CHARACTER_BUILD_LIBRARY_VERSION } from '@glyphstudio/domain';

// ── Library creation ──

/** Create an empty character build library. */
export function createEmptyLibrary(): CharacterBuildLibrary {
  return {
    schemaVersion: CHARACTER_BUILD_LIBRARY_VERSION,
    builds: [],
  };
}

// ── ID generation ──

let nextSavedBuildId = 1;

/** Generate a unique saved build ID. */
export function generateSavedBuildId(): string {
  return `saved-build-${Date.now()}-${nextSavedBuildId++}`;
}

// ── Conversion ──

/**
 * Convert a CharacterBuild (editor state) to a SavedCharacterBuild (persisted).
 * Sets createdAt and updatedAt to now.
 */
export function toSavedBuild(build: CharacterBuild): SavedCharacterBuild {
  const now = new Date().toISOString();
  return {
    id: build.id,
    name: build.name,
    slots: { ...build.slots },
    tags: build.tags ? [...build.tags] : undefined,
    sourcePresetId: build.sourcePresetId,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert a SavedCharacterBuild back to a CharacterBuild (editor state).
 * Drops persistence metadata (timestamps).
 */
export function toCharacterBuild(saved: SavedCharacterBuild): CharacterBuild {
  return {
    id: saved.id,
    name: saved.name,
    slots: { ...saved.slots },
    tags: saved.tags ? [...saved.tags] : undefined,
    sourcePresetId: saved.sourcePresetId,
  };
}

// ── Library operations ──

/**
 * Save a build to the library.
 * If a build with the same ID exists, it is overwritten (updatedAt refreshed).
 * If the build is new, it is prepended (most recent first).
 * Returns a new library.
 */
export function saveBuildToLibrary(
  library: CharacterBuildLibrary,
  build: CharacterBuild,
): CharacterBuildLibrary {
  const now = new Date().toISOString();
  const existingIndex = library.builds.findIndex((b) => b.id === build.id);

  let saved: SavedCharacterBuild;
  let builds: SavedCharacterBuild[];

  if (existingIndex >= 0) {
    // Overwrite: preserve createdAt, refresh updatedAt
    const existing = library.builds[existingIndex];
    saved = {
      id: build.id,
      name: build.name,
      slots: { ...build.slots },
      tags: build.tags ? [...build.tags] : undefined,
      description: existing.description,
      sourcePresetId: build.sourcePresetId,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    // Remove old entry, prepend updated one
    builds = [saved, ...library.builds.filter((_, i) => i !== existingIndex)];
  } else {
    // New entry
    saved = {
      ...toSavedBuild(build),
      createdAt: now,
      updatedAt: now,
    };
    builds = [saved, ...library.builds];
  }

  return { ...library, builds };
}

/**
 * Delete a build from the library by ID.
 * Returns a new library. No-op if ID not found.
 */
export function deleteBuildFromLibrary(
  library: CharacterBuildLibrary,
  buildId: string,
): CharacterBuildLibrary {
  const builds = library.builds.filter((b) => b.id !== buildId);
  if (builds.length === library.builds.length) return library; // no-op
  return { ...library, builds };
}

/**
 * Duplicate a build in the library.
 * Creates a new build with a new ID and optional new name.
 * The duplicate is prepended as the most recent entry.
 * Returns the new library and the duplicated build's ID.
 */
export function duplicateBuildInLibrary(
  library: CharacterBuildLibrary,
  buildId: string,
  newName?: string,
): { library: CharacterBuildLibrary; newBuildId: string | null } {
  const source = library.builds.find((b) => b.id === buildId);
  if (!source) return { library, newBuildId: null };

  const now = new Date().toISOString();
  const newId = generateSavedBuildId();
  const duplicate: SavedCharacterBuild = {
    ...source,
    id: newId,
    name: newName ?? `${source.name} Copy`,
    slots: { ...source.slots },
    tags: source.tags ? [...source.tags] : undefined,
    createdAt: now,
    updatedAt: now,
  };

  return {
    library: { ...library, builds: [duplicate, ...library.builds] },
    newBuildId: newId,
  };
}

/**
 * Find a build in the library by ID.
 */
export function findBuildById(
  library: CharacterBuildLibrary,
  buildId: string,
): SavedCharacterBuild | undefined {
  return library.builds.find((b) => b.id === buildId);
}

/**
 * Rename a build in the library.
 * Returns a new library. No-op if ID not found.
 */
export function renameBuildInLibrary(
  library: CharacterBuildLibrary,
  buildId: string,
  newName: string,
): CharacterBuildLibrary {
  const index = library.builds.findIndex((b) => b.id === buildId);
  if (index < 0) return library;

  const now = new Date().toISOString();
  const builds = [...library.builds];
  builds[index] = { ...builds[index], name: newName, updatedAt: now };
  return { ...library, builds };
}

/**
 * Check if a build with the given ID exists in the library.
 */
export function hasBuildInLibrary(library: CharacterBuildLibrary, buildId: string): boolean {
  return library.builds.some((b) => b.id === buildId);
}

/**
 * Get the number of builds in the library.
 */
export function getLibraryBuildCount(library: CharacterBuildLibrary): number {
  return library.builds.length;
}
