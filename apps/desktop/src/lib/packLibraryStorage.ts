import type { SavedPack, PackLibrary } from '@glyphstudio/state';
import { PACK_LIBRARY_VERSION, createEmptyPackLibrary } from '@glyphstudio/state';

const STORAGE_KEY = 'glyphstudio_pack_library';

function coercePack(raw: unknown): SavedPack | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.name !== 'string' || !r.name) return null;
  if (typeof r.paletteSetCount !== 'number') return null;
  if (typeof r.partCount !== 'number') return null;
  if (typeof r.interchangeJson !== 'string') return null;
  if (typeof r.createdAt !== 'string') return null;

  const pack: SavedPack = {
    id: r.id,
    name: r.name,
    paletteSetCount: r.paletteSetCount,
    partCount: r.partCount,
    interchangeJson: r.interchangeJson,
    createdAt: r.createdAt,
  };
  if (typeof r.description === 'string') pack.description = r.description;
  return pack;
}

export function loadPackLibrary(): PackLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyPackLibrary();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyPackLibrary();
    if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion !== PACK_LIBRARY_VERSION) {
      return createEmptyPackLibrary();
    }
    if (!Array.isArray(parsed.packs)) return createEmptyPackLibrary();

    const packs: SavedPack[] = [];
    for (const entry of parsed.packs) {
      const p = coercePack(entry);
      if (p) packs.push(p);
    }
    return { schemaVersion: PACK_LIBRARY_VERSION, packs };
  } catch {
    return createEmptyPackLibrary();
  }
}

export function savePackLibrary(library: PackLibrary): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    /* silently skip */
  }
}
