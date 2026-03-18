/**
 * Interchange format for authored structures.
 *
 * JSON-based, versioned, human-inspectable.
 * Covers palette sets and parts for cross-project transfer.
 */

import type { PaletteSet, SpriteColor, SpriteDocument } from '@glyphstudio/domain';
import type { Part, PartLibrary } from '@glyphstudio/domain';

// ── Format ──

export const INTERCHANGE_FORMAT = 'glyphstudio-interchange';
export const INTERCHANGE_VERSION = 1;

/** Top-level interchange file structure. */
export interface InterchangeFile {
  format: typeof INTERCHANGE_FORMAT;
  version: number;
  /** What kind of data this file contains. */
  contentType: 'palette-sets' | 'parts' | 'mixed' | 'template';
  /** ISO timestamp of export. */
  exportedAt: string;
  /** Optional palette sets payload. */
  paletteSets?: InterchangePaletteSet[];
  /** Optional parts payload. */
  parts?: InterchangePart[];
  /** Optional project template data. */
  template?: ProjectTemplateData;
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

/** Project template data — document settings for bootstrapping a new project. */
export interface ProjectTemplateData {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  /** Base palette colors for the new document. */
  palette: { rgba: [number, number, number, number]; name?: string }[];
  /** Frame count for animation templates. Omit or 1 for static. */
  frameCount?: number;
  /** Frame duration in ms for animation templates. */
  frameDurationMs?: number;
}

/** Parsed result of a project template file. */
export interface ProjectTemplateParseResult {
  template: ProjectTemplateData;
  paletteSets: InterchangePaletteSet[];
  parts: InterchangePart[];
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

// ── Project template export/import ──

/** Options for what to include in a project template export. */
export interface ExportTemplateOptions {
  includePaletteSets?: boolean;
  includeParts?: boolean;
}

/**
 * Export a project template from the current document + part library.
 *
 * Captures document settings (name, canvas size, palette) and optionally
 * includes palette sets and parts. Returns interchange JSON string.
 */
export function exportProjectTemplate(
  doc: SpriteDocument,
  partLibrary: PartLibrary,
  options: ExportTemplateOptions = {},
): string {
  const { includePaletteSets = true, includeParts = true } = options;

  const template: ProjectTemplateData = {
    name: doc.name,
    canvasWidth: doc.width,
    canvasHeight: doc.height,
    palette: doc.palette.colors.map((c) => ({
      rgba: [...c.rgba] as [number, number, number, number],
      ...(c.name ? { name: c.name } : {}),
    })),
    ...(doc.frames.length > 1 ? {
      frameCount: doc.frames.length,
      frameDurationMs: doc.frames[0]?.durationMs ?? 100,
    } : {}),
  };

  const file: InterchangeFile = {
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    contentType: 'template',
    exportedAt: new Date().toISOString(),
    template,
  };

  if (includePaletteSets && (doc.paletteSets ?? []).length > 0) {
    file.paletteSets = (doc.paletteSets ?? []).map((ps) => ({
      id: ps.id,
      name: ps.name,
      colors: ps.colors.map((c) => ({
        rgba: [...c.rgba] as [number, number, number, number],
        ...(c.name ? { name: c.name } : {}),
      })),
    }));
  }

  if (includeParts && partLibrary.parts.length > 0) {
    file.parts = partLibrary.parts.map((p) => ({
      id: p.id,
      name: p.name,
      width: p.width,
      height: p.height,
      pixelData: [...p.pixelData],
      ...(p.tags?.length ? { tags: [...p.tags] } : {}),
    }));
  }

  return JSON.stringify(file, null, 2);
}

/**
 * Parse a project template from interchange JSON.
 *
 * Returns template data + optional palette sets + parts, or error string.
 */
export function parseProjectTemplate(
  json: string,
): ProjectTemplateParseResult | { error: string } {
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

  // Validate template data
  const rawTemplate = file.template;
  if (!rawTemplate || typeof rawTemplate !== 'object') {
    return { error: 'Missing template data' };
  }

  const t = rawTemplate as Record<string, unknown>;
  if (typeof t.name !== 'string' || !t.name) return { error: 'Template missing name' };
  if (typeof t.canvasWidth !== 'number' || t.canvasWidth <= 0) return { error: 'Template missing valid canvasWidth' };
  if (typeof t.canvasHeight !== 'number' || t.canvasHeight <= 0) return { error: 'Template missing valid canvasHeight' };
  if (!Array.isArray(t.palette)) return { error: 'Template missing palette' };

  const palette: ProjectTemplateData['palette'] = [];
  for (const c of t.palette) {
    if (!c || typeof c !== 'object') continue;
    const cc = c as Record<string, unknown>;
    if (!Array.isArray(cc.rgba) || cc.rgba.length !== 4) continue;
    palette.push({
      rgba: cc.rgba as [number, number, number, number],
      ...(typeof cc.name === 'string' ? { name: cc.name } : {}),
    });
  }

  const template: ProjectTemplateData = {
    name: t.name,
    canvasWidth: t.canvasWidth,
    canvasHeight: t.canvasHeight,
    palette,
    ...(typeof t.frameCount === 'number' && t.frameCount > 1 ? { frameCount: t.frameCount } : {}),
    ...(typeof t.frameDurationMs === 'number' ? { frameDurationMs: t.frameDurationMs } : {}),
  };

  // Parse optional palette sets and parts
  const paletteSets: InterchangePaletteSet[] = [];
  if (Array.isArray(file.paletteSets)) {
    for (const raw of file.paletteSets) {
      const ps = coercePaletteSet(raw);
      if (ps) paletteSets.push(ps);
    }
  }

  const parts: InterchangePart[] = [];
  if (Array.isArray(file.parts)) {
    for (const raw of file.parts) {
      const part = coercePart(raw);
      if (part) parts.push(part);
    }
  }

  return { template, paletteSets, parts };
}
