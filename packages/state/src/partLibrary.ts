/**
 * Part library — pure CRUD functions for reusable pixel parts.
 *
 * Follows the characterBuildLibrary pattern: immutable operations,
 * prepend-on-add, derive duplicate names, no I/O.
 */

import type { Part, PartLibrary } from '@glyphstudio/domain';
import { PART_LIBRARY_VERSION, generatePartId } from '@glyphstudio/domain';
import { deriveDuplicateName } from './characterBuildLibrary';

/** Create an empty part library. */
export function createEmptyPartLibrary(): PartLibrary {
  return {
    schemaVersion: PART_LIBRARY_VERSION,
    parts: [],
  };
}

/** Generate a default name like "Part 1", "Part 2", etc. */
export function generateDefaultPartName(library: PartLibrary): string {
  const existing = new Set(library.parts.map((p) => p.name));
  let n = 1;
  while (existing.has(`Part ${n}`)) n++;
  return `Part ${n}`;
}

/** Add a part to the library. Prepends (most recent first). Returns new library. */
export function addPartToLibrary(library: PartLibrary, part: Part): PartLibrary {
  return { ...library, parts: [part, ...library.parts] };
}

/** Delete a part by ID. Returns new library. No-op if not found. */
export function deletePartFromLibrary(library: PartLibrary, partId: string): PartLibrary {
  const parts = library.parts.filter((p) => p.id !== partId);
  if (parts.length === library.parts.length) return library;
  return { ...library, parts };
}

/** Rename a part. Returns new library. No-op if not found. */
export function renamePartInLibrary(library: PartLibrary, partId: string, newName: string): PartLibrary {
  const index = library.parts.findIndex((p) => p.id === partId);
  if (index < 0) return library;
  const now = new Date().toISOString();
  const parts = [...library.parts];
  parts[index] = { ...parts[index], name: newName, updatedAt: now };
  return { ...library, parts };
}

/**
 * Duplicate a part with a derived name. Returns { library, newPartId }.
 * Returns null newPartId if source not found.
 */
export function duplicatePartInLibrary(
  library: PartLibrary,
  partId: string,
  newName?: string,
): { library: PartLibrary; newPartId: string | null } {
  const source = library.parts.find((p) => p.id === partId);
  if (!source) return { library, newPartId: null };

  const now = new Date().toISOString();
  const newId = generatePartId();
  const existingNames = library.parts.map((p) => p.name);
  const duplicate: Part = {
    ...source,
    id: newId,
    name: newName ?? deriveDuplicateName(source.name, existingNames),
    pixelData: [...source.pixelData],
    tags: source.tags ? [...source.tags] : undefined,
    createdAt: now,
    updatedAt: now,
  };

  return {
    library: { ...library, parts: [duplicate, ...library.parts] },
    newPartId: newId,
  };
}

/** Find a part by ID. */
export function findPartById(library: PartLibrary, partId: string): Part | undefined {
  return library.parts.find((p) => p.id === partId);
}

/** Check if a part exists. */
export function hasPartInLibrary(library: PartLibrary, partId: string): boolean {
  return library.parts.some((p) => p.id === partId);
}

/** Get part count. */
export function getPartCount(library: PartLibrary): number {
  return library.parts.length;
}
