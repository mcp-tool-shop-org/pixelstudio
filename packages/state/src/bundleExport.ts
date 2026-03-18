/**
 * Bundle export — cross-product of document variants × palette variants.
 *
 * Pure functions. Composes existing export/remap infrastructure
 * into a single deliberate batch pass with previewable plan.
 */

import type { SpriteDocument, SpritePixelBuffer, SpriteSheetMeta, SpriteFrame } from '@glyphstudio/domain';
import { sanitizeFilename, generateSpriteSheetMeta } from './spriteExport';
import { buildColorMap, remapFrameBuffers } from './paletteRemap';
import { flattenLayers } from './spriteRaster';
import { assembleSpriteSheet } from './spriteImportExport';

// ── Types ──

/** Which axes to include in a bundle export. */
export interface BundleScope {
  /** Document variant IDs to include. null = base sequence. */
  documentVariants: (string | null)[];
  /** Palette set IDs to include. Empty = use base palette only. */
  paletteSets: string[];
  /** Export format. */
  format: 'sheet' | 'gif';
}

/** A single entry in the export plan. */
export interface BundlePlanEntry {
  /** Contextual filename without extension. */
  filename: string;
  documentVariantId: string | null;
  documentVariantName: string;
  paletteSetId: string | null;
  paletteSetName: string;
  format: 'sheet' | 'gif';
}

/** The full plan — previewable before executing. */
export interface BundlePlan {
  entries: BundlePlanEntry[];
  totalFiles: number;
}

/** Result of executing a single bundle entry. */
export interface BundleExportEntry {
  filename: string;
  sheet: SpritePixelBuffer;
  meta: SpriteSheetMeta;
}

// ── Plan generation ──

/**
 * Generate a bundle export plan from scope selection.
 *
 * Crosses document variants × palette sets (with base palette as implicit
 * entry when no palette sets are selected). Generates contextual filenames
 * with clean omission of empty axes.
 */
export function generateBundlePlan(doc: SpriteDocument, scope: BundleScope): BundlePlan {
  const docVariants = scope.documentVariants.length > 0 ? scope.documentVariants : [null];
  const hasMultipleDocVariants = docVariants.length > 1;

  // Palette axis: if no palette sets selected, just base palette (null)
  // If palette sets selected, include base palette + selected sets
  const paletteEntries: { id: string | null; name: string }[] = [];
  if (scope.paletteSets.length === 0) {
    paletteEntries.push({ id: null, name: 'base' });
  } else {
    paletteEntries.push({ id: null, name: 'base' });
    for (const psId of scope.paletteSets) {
      const ps = (doc.paletteSets ?? []).find((p) => p.id === psId);
      if (ps) paletteEntries.push({ id: ps.id, name: ps.name });
    }
  }
  const hasMultiplePalettes = paletteEntries.length > 1;

  const entries: BundlePlanEntry[] = [];

  for (const docVarId of docVariants) {
    let docVarName: string;
    if (docVarId === null) {
      docVarName = 'base';
    } else {
      const variant = (doc.variants ?? []).find((v) => v.id === docVarId);
      docVarName = variant?.name ?? 'unknown';
    }

    for (const palette of paletteEntries) {
      const filename = buildFilename(doc.name, docVarName, palette.name, hasMultipleDocVariants, hasMultiplePalettes);

      entries.push({
        filename,
        documentVariantId: docVarId,
        documentVariantName: docVarName,
        paletteSetId: palette.id,
        paletteSetName: palette.name,
        format: scope.format,
      });
    }
  }

  return { entries, totalFiles: entries.length };
}

/**
 * Build a contextual filename with clean axis omission.
 *
 * Rules:
 * - Single doc variant + single palette: just project name
 * - Multiple doc variants only: {project}-{docVariant}
 * - Multiple palettes only: {project}-{palette}
 * - Both axes: {project}-{docVariant}-{palette}
 * - "base" suffix included only when other entries exist on that axis
 */
function buildFilename(
  projectName: string,
  docVariantName: string,
  paletteName: string,
  hasMultipleDocVariants: boolean,
  hasMultiplePalettes: boolean,
): string {
  const base = sanitizeFilename(projectName);
  const parts: string[] = [base];

  if (hasMultipleDocVariants) {
    parts.push(sanitizeFilename(docVariantName));
  }

  if (hasMultiplePalettes) {
    parts.push(sanitizeFilename(paletteName));
  }

  return parts.join('-');
}

// ── Export execution ──

/**
 * Execute a bundle export plan.
 *
 * For each plan entry: resolve frames (base or variant), optionally
 * apply palette remap, flatten layers, assemble sprite sheet.
 *
 * Returns array of export entries with pixel data + metadata, or error.
 */
export function executeBundleExport(
  doc: SpriteDocument,
  pixelBuffers: Record<string, SpritePixelBuffer>,
  plan: BundlePlan,
): BundleExportEntry[] | { error: string } {
  const results: BundleExportEntry[] = [];

  for (const entry of plan.entries) {
    // 1. Resolve frames
    let frames: SpriteFrame[];
    if (entry.documentVariantId === null) {
      frames = doc.frames;
    } else {
      const variant = (doc.variants ?? []).find((v) => v.id === entry.documentVariantId);
      if (!variant) return { error: `Variant "${entry.documentVariantName}" not found` };
      frames = variant.frames;
    }

    if (frames.length === 0) {
      return { error: `No frames in "${entry.documentVariantName}"` };
    }

    // 2. Optionally apply palette remap
    let effectiveBuffers = pixelBuffers;
    if (entry.paletteSetId !== null) {
      const ps = (doc.paletteSets ?? []).find((p) => p.id === entry.paletteSetId);
      if (!ps) return { error: `Palette set "${entry.paletteSetName}" not found` };
      const colorMap = buildColorMap(doc.palette.colors, ps.colors);
      if (colorMap.size > 0) {
        effectiveBuffers = remapFrameBuffers(frames, pixelBuffers, colorMap, 0, frames.length - 1);
      }
    }

    // 3. Flatten + assemble
    const frameBuffers = frames.map((f) =>
      flattenLayers(f.layers, effectiveBuffers, doc.width, doc.height),
    );

    const sheet = assembleSpriteSheet(frameBuffers);
    if ('error' in sheet) return sheet;

    const meta = generateSpriteSheetMeta({ ...doc, frames });
    if ('error' in meta) return meta;

    results.push({
      filename: entry.filename,
      sheet,
      meta: { ...meta, name: entry.filename },
    });
  }

  return results;
}
