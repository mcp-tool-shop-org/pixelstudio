/**
 * Library index — unified view over all authored asset types.
 *
 * Pure functions. Builds a flat scannable index from document
 * structure (palette sets, variants) and part library.
 */

import type { SpriteDocument } from '@glyphstudio/domain';
import type { PartLibrary } from '@glyphstudio/domain';

/** Asset type in the library. */
export type LibraryItemKind = 'part' | 'palette-set' | 'variant';

/** A single item in the unified library index. */
export interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  name: string;
  updatedAt: string;
  /** Part-specific: dimensions. */
  width?: number;
  height?: number;
  /** Part-specific: pixel data for thumbnail rendering. */
  pixelData?: number[];
  /** Palette-set-specific: first 8 RGBA colors for swatch strip. */
  swatchColors?: [number, number, number, number][];
  /** Palette-set-specific: total color count. */
  colorCount?: number;
  /** Variant-specific: frame count. */
  frameCount?: number;
  /** Whether this item is currently active/selected in the editor. */
  isActive: boolean;
}

/**
 * Build a unified library index from document + part library.
 *
 * Returns items grouped by kind, each sorted by updatedAt (most recent first).
 */
export function buildLibraryIndex(
  doc: SpriteDocument | null,
  partLibrary: PartLibrary,
  activeStampPartId: string | null,
  activePaletteSetId: string | null,
  activeVariantId: string | null,
): LibraryItem[] {
  const items: LibraryItem[] = [];

  // Parts (already ordered most-recent-first from addPartToLibrary)
  for (const part of partLibrary.parts) {
    items.push({
      id: part.id,
      kind: 'part',
      name: part.name,
      updatedAt: part.updatedAt,
      width: part.width,
      height: part.height,
      pixelData: part.pixelData,
      isActive: activeStampPartId === part.id,
    });
  }

  // Palette sets
  if (doc) {
    for (const ps of doc.paletteSets ?? []) {
      items.push({
        id: ps.id,
        kind: 'palette-set',
        name: ps.name,
        updatedAt: doc.updatedAt, // palette sets don't have individual timestamps
        swatchColors: ps.colors.slice(0, 8).map((c) => c.rgba),
        colorCount: ps.colors.length,
        isActive: activePaletteSetId === ps.id,
      });
    }

    // Document variants
    for (const v of doc.variants ?? []) {
      items.push({
        id: v.id,
        kind: 'variant',
        name: v.name,
        updatedAt: v.updatedAt,
        frameCount: v.frames.length,
        isActive: activeVariantId === v.id,
      });
    }
  }

  return items;
}

/**
 * Filter library items by name query and kind set.
 *
 * Case-insensitive substring match on name.
 * Returns only items whose kind is in the filter set.
 */
export function filterLibraryItems(
  items: LibraryItem[],
  query: string,
  kinds: Set<LibraryItemKind>,
): LibraryItem[] {
  const q = query.toLowerCase().trim();
  return items.filter((item) => {
    if (!kinds.has(item.kind)) return false;
    if (q && !item.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Group library items by kind. */
export function groupByKind(items: LibraryItem[]): Record<LibraryItemKind, LibraryItem[]> {
  const groups: Record<LibraryItemKind, LibraryItem[]> = {
    'part': [],
    'palette-set': [],
    'variant': [],
  };
  for (const item of items) {
    groups[item.kind].push(item);
  }
  return groups;
}
