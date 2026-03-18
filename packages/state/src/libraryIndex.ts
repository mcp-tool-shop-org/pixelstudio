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
  /** Whether this item is pinned by the user. */
  isPinned: boolean;
  /** Whether this item was recently accessed. */
  isRecent: boolean;
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
  pinnedIds: string[] = [],
  recentIds: string[] = [],
): LibraryItem[] {
  const pinSet = new Set(pinnedIds);
  const recSet = new Set(recentIds);
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
      isPinned: pinSet.has(part.id),
      isRecent: recSet.has(part.id),
    });
  }

  // Palette sets
  if (doc) {
    for (const ps of doc.paletteSets ?? []) {
      items.push({
        id: ps.id,
        kind: 'palette-set',
        name: ps.name,
        updatedAt: doc.updatedAt,
        swatchColors: ps.colors.slice(0, 8).map((c) => c.rgba),
        colorCount: ps.colors.length,
        isActive: activePaletteSetId === ps.id,
        isPinned: pinSet.has(ps.id),
        isRecent: recSet.has(ps.id),
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
        isPinned: pinSet.has(v.id),
        isRecent: recSet.has(v.id),
      });
    }
  }

  return items;
}

/** Compound filter options for library items. */
export interface LibraryFilterOptions {
  /** Text query — tokenized, all tokens must match (AND). */
  query: string;
  /** Which item kinds to include. */
  kinds: Set<LibraryItemKind>;
  /** If true, only show pinned items. */
  pinnedOnly?: boolean;
  /** If true, only show active items. */
  activeOnly?: boolean;
}

/**
 * Filter library items with compound criteria.
 *
 * Query is tokenized by whitespace. All tokens must match the name
 * (case-insensitive, substring). This allows "walk left" to match
 * "Walk Left Idle" without requiring exact phrase order.
 */
export function filterLibraryItems(
  items: LibraryItem[],
  queryOrOptions: string | LibraryFilterOptions,
  kinds?: Set<LibraryItemKind>,
): LibraryItem[] {
  // Support both old (query, kinds) and new (options) signatures
  let opts: LibraryFilterOptions;
  if (typeof queryOrOptions === 'string') {
    opts = { query: queryOrOptions, kinds: kinds ?? new Set(['part', 'palette-set', 'variant']) };
  } else {
    opts = queryOrOptions;
  }

  const tokens = opts.query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  return items.filter((item) => {
    if (!opts.kinds.has(item.kind)) return false;
    if (opts.pinnedOnly && !item.isPinned) return false;
    if (opts.activeOnly && !item.isActive) return false;
    if (tokens.length > 0) {
      const name = item.name.toLowerCase();
      for (const token of tokens) {
        if (!name.includes(token)) return false;
      }
    }
    return true;
  });
}

/** Sort mode for library display. */
export type LibrarySortMode = 'priority' | 'name' | 'recent';

/**
 * Sort library items by the given mode.
 *
 * - priority: pinned > active > recent > rest (default workflow sort)
 * - name: alphabetical A-Z
 * - recent: most recently updated first
 */
export function sortLibraryItems(items: LibraryItem[], mode: LibrarySortMode): LibraryItem[] {
  switch (mode) {
    case 'priority':
      return sortWithPriority(items);
    case 'name':
      return [...items].sort((a, b) => a.name.localeCompare(b.name));
    case 'recent':
      return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    default:
      return items;
  }
}

/**
 * Sort items with priority: pinned first, then active, then recent, then rest.
 * Within each priority group, original order is preserved.
 */
export function sortWithPriority(items: LibraryItem[]): LibraryItem[] {
  const pinned: LibraryItem[] = [];
  const active: LibraryItem[] = [];
  const recent: LibraryItem[] = [];
  const rest: LibraryItem[] = [];

  for (const item of items) {
    if (item.isPinned) pinned.push(item);
    else if (item.isActive) active.push(item);
    else if (item.isRecent) recent.push(item);
    else rest.push(item);
  }

  return [...pinned, ...active, ...recent, ...rest];
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
