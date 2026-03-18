/**
 * Pack library — pure CRUD for saved asset packs.
 *
 * Same pattern as templateLibrary. Stores interchange JSON as blob.
 */

export const PACK_LIBRARY_VERSION = 1;

/** A saved asset pack. */
export interface SavedPack {
  id: string;
  name: string;
  description?: string;
  /** Count of palette sets in this pack. */
  paletteSetCount: number;
  /** Count of parts in this pack. */
  partCount: number;
  /** The full interchange JSON string. */
  interchangeJson: string;
  createdAt: string;
}

/** The persisted pack library. */
export interface PackLibrary {
  schemaVersion: number;
  packs: SavedPack[];
}

export function generatePackId(): string {
  return `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyPackLibrary(): PackLibrary {
  return { schemaVersion: PACK_LIBRARY_VERSION, packs: [] };
}

export function addPackToLibrary(library: PackLibrary, pack: SavedPack): PackLibrary {
  return { ...library, packs: [pack, ...library.packs] };
}

export function deletePackFromLibrary(library: PackLibrary, packId: string): PackLibrary {
  const packs = library.packs.filter((p) => p.id !== packId);
  if (packs.length === library.packs.length) return library;
  return { ...library, packs };
}

export function renamePackInLibrary(library: PackLibrary, packId: string, newName: string): PackLibrary {
  const index = library.packs.findIndex((p) => p.id === packId);
  if (index < 0) return library;
  const packs = [...library.packs];
  packs[index] = { ...packs[index], name: newName };
  return { ...library, packs };
}

export function findPackById(library: PackLibrary, packId: string): SavedPack | undefined {
  return library.packs.find((p) => p.id === packId);
}

export function getPackCount(library: PackLibrary): number {
  return library.packs.length;
}
