import type { Part, PartLibrary } from '@glyphstudio/domain';
import { PART_LIBRARY_VERSION } from '@glyphstudio/domain';
import { createEmptyPartLibrary } from '@glyphstudio/state';

const STORAGE_KEY = 'glyphstudio_part_library';

// ── Coercion helpers ──

function coercePart(raw: unknown): Part | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.name !== 'string' || !r.name) return null;
  if (typeof r.width !== 'number' || r.width <= 0) return null;
  if (typeof r.height !== 'number' || r.height <= 0) return null;
  if (!Array.isArray(r.pixelData)) return null;
  if (typeof r.createdAt !== 'string') return null;
  if (typeof r.updatedAt !== 'string') return null;

  const part: Part = {
    id: r.id,
    name: r.name,
    width: r.width,
    height: r.height,
    pixelData: r.pixelData as number[],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };

  if (Array.isArray(r.tags) && r.tags.every((t: unknown) => typeof t === 'string')) {
    part.tags = r.tags as string[];
  }

  return part;
}

// ── Public API ──

export function loadPartLibrary(): PartLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyPartLibrary();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyPartLibrary();

    if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion !== PART_LIBRARY_VERSION) {
      return createEmptyPartLibrary();
    }

    if (!Array.isArray(parsed.parts)) return createEmptyPartLibrary();

    const parts: Part[] = [];
    for (const entry of parsed.parts) {
      const part = coercePart(entry);
      if (part) parts.push(part);
    }

    return {
      schemaVersion: PART_LIBRARY_VERSION,
      parts,
    };
  } catch {
    return createEmptyPartLibrary();
  }
}

export function savePartLibrary(library: PartLibrary): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    /* localStorage unavailable — silently skip */
  }
}
