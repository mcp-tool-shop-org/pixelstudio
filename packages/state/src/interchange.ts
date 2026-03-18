/**
 * Interchange format for authored structures.
 *
 * JSON-based, versioned, human-inspectable.
 * Covers palette sets and parts for cross-project transfer.
 */

import type { PaletteSet, SpriteColor } from '@glyphstudio/domain';
import type { Part, PartLibrary } from '@glyphstudio/domain';

// ── Format ──

export const INTERCHANGE_FORMAT = 'glyphstudio-interchange';
export const INTERCHANGE_VERSION = 1;

/** Top-level interchange file structure. */
export interface InterchangeFile {
  format: typeof INTERCHANGE_FORMAT;
  version: number;
  /** What kind of data this file contains. */
  contentType: 'palette-sets' | 'parts' | 'mixed';
  /** ISO timestamp of export. */
  exportedAt: string;
  /** Optional palette sets payload. */
  paletteSets?: InterchangePaletteSet[];
  /** Optional parts payload. */
  parts?: InterchangePart[];
}

/** Palette set in interchange format (mirrors PaletteSet). */
export interface InterchangePaletteSet {
  id: string;
  name: string;
  colors: { rgba: [number, number, number, number]; name?: string }[];
}

/** Part in interchange format (mirrors Part). */
export interface InterchangePart {
  id: string;
  name: string;
  width: number;
  height: number;
  pixelData: number[];
  tags?: string[];
}

// ── Export ──

/** Export selected palette sets to interchange JSON string. */
export function exportPaletteSets(paletteSets: PaletteSet[]): string {
  const file: InterchangeFile = {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    contentType: 'palette-sets',
    exportedAt: new Date().toISOString(),
    paletteSets: paletteSets.map((ps) => ({
      id: ps.id,
      name: ps.name,
      colors: ps.colors.map((c) => ({
        rgba: [...c.rgba] as [number, number, number, number],
        ...(c.name ? { name: c.name } : {}),
      })),
    })),
  };
  return JSON.stringify(file, null, 2);
}

/** Export selected parts to interchange JSON string. */
export function exportParts(parts: Part[]): string {
  const file: InterchangeFile = {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    contentType: 'parts',
    exportedAt: new Date().toISOString(),
    parts: parts.map((p) => ({
      id: p.id,
      name: p.name,
      width: p.width,
      height: p.height,
      pixelData: [...p.pixelData],
      ...(p.tags?.length ? { tags: [...p.tags] } : {}),
    })),
  };
  return JSON.stringify(file, null, 2);
}

// ── Import (parse + validate) ──

/** Import conflict for a single item. */
export interface ImportConflict {
  id: string;
  name: string;
  /** Whether an item with the same name already exists. */
  hasNameConflict: boolean;
}

/** Result of parsing an interchange file. */
export interface ImportParseResult {
  contentType: 'palette-sets' | 'parts' | 'mixed';
  paletteSets: InterchangePaletteSet[];
  parts: InterchangePart[];
  /** Items that conflict with existing names. */
  conflicts: ImportConflict[];
}

/**
 * Parse and validate an interchange JSON string.
 *
 * Returns parsed data with conflict analysis, or an error string.
 */
export function parseInterchangeFile(
  json: string,
  existingPaletteSetNames: string[],
  existingPartNames: string[],
): ImportParseResult | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { error: 'Invalid JSON' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: 'File is not a valid object' };
  }

  const file = parsed as Record<string, unknown>;

  if (file.format !== INTERCHANGE_FORMAT) {
    return { error: `Unknown format: ${String(file.format)}` };
  }

  if (typeof file.version !== 'number' || file.version > INTERCHANGE_VERSION) {
    return { error: `Unsupported version: ${String(file.version)}` };
  }

  const paletteSets: InterchangePaletteSet[] = [];
  const parts: InterchangePart[] = [];
  const conflicts: ImportConflict[] = [];

  const existingPsNames = new Set(existingPaletteSetNames);
  const existingPartNameSet = new Set(existingPartNames);

  // Parse palette sets
  if (Array.isArray(file.paletteSets)) {
    for (const raw of file.paletteSets) {
      const ps = coercePaletteSet(raw);
      if (ps) {
        paletteSets.push(ps);
        if (existingPsNames.has(ps.name)) {
          conflicts.push({ id: ps.id, name: ps.name, hasNameConflict: true });
        }
      }
    }
  }

  // Parse parts
  if (Array.isArray(file.parts)) {
    for (const raw of file.parts) {
      const part = coercePart(raw);
      if (part) {
        parts.push(part);
        if (existingPartNameSet.has(part.name)) {
          conflicts.push({ id: part.id, name: part.name, hasNameConflict: true });
        }
      }
    }
  }

  if (paletteSets.length === 0 && parts.length === 0) {
    return { error: 'No valid data found in file' };
  }

  const contentType: ImportParseResult['contentType'] =
    paletteSets.length > 0 && parts.length > 0 ? 'mixed' :
    paletteSets.length > 0 ? 'palette-sets' : 'parts';

  return { contentType, paletteSets, parts, conflicts };
}

// ── Collision resolution ──

/** How to handle a name collision. */
export type CollisionStrategy = 'skip' | 'rename' | 'overwrite';

/** Derive a unique name by appending " (Imported)", " (Imported 2)", etc. */
export function deriveImportName(baseName: string, existingNames: Set<string>): string {
  const candidate = `${baseName} (Imported)`;
  if (!existingNames.has(candidate)) return candidate;
  let n = 2;
  while (existingNames.has(`${baseName} (Imported ${n})`)) n++;
  return `${baseName} (Imported ${n})`;
}

// ── Coercion helpers ──

function coercePaletteSet(raw: unknown): InterchangePaletteSet | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.name !== 'string' || !r.name) return null;
  if (!Array.isArray(r.colors)) return null;

  const colors: InterchangePaletteSet['colors'] = [];
  for (const c of r.colors) {
    if (!c || typeof c !== 'object') continue;
    const cc = c as Record<string, unknown>;
    if (!Array.isArray(cc.rgba) || cc.rgba.length !== 4) continue;
    colors.push({
      rgba: cc.rgba as [number, number, number, number],
      ...(typeof cc.name === 'string' ? { name: cc.name } : {}),
    });
  }

  return { id: r.id, name: r.name, colors };
}

function coercePart(raw: unknown): InterchangePart | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.name !== 'string' || !r.name) return null;
  if (typeof r.width !== 'number' || r.width <= 0) return null;
  if (typeof r.height !== 'number' || r.height <= 0) return null;
  if (!Array.isArray(r.pixelData)) return null;

  const part: InterchangePart = {
    id: r.id,
    name: r.name,
    width: r.width,
    height: r.height,
    pixelData: r.pixelData as number[],
  };

  if (Array.isArray(r.tags) && r.tags.every((t: unknown) => typeof t === 'string')) {
    part.tags = r.tags as string[];
  }

  return part;
}
