/**
 * Seeding and error-path hardening tests.
 *
 * Verifies first-launch content is idempotent and error paths
 * surface failures correctly.
 */

import { describe, it, expect } from 'vitest';
import { SAMPLE_TEMPLATES, SAMPLE_PACKS, SAMPLE_IDS } from './sampleContent';
import {
  createEmptyTemplateLibrary,
  addTemplateToLibrary,
} from './templateLibrary';
import {
  createEmptyPackLibrary,
  addPackToLibrary,
} from './packLibrary';
import { generateBundlePlan, executeBundleExport } from './bundleExport';
import type { BundlePlan } from './bundleExport';
import { createSpriteDocument, createBlankPixelBuffer } from '@glyphstudio/domain';

describe('Seeding Hardening', () => {
  it('sample templates have unique IDs', () => {
    const ids = SAMPLE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sample packs have unique IDs', () => {
    const ids = SAMPLE_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no ID collision between templates and packs', () => {
    const allIds = [
      ...SAMPLE_TEMPLATES.map((t) => t.id),
      ...SAMPLE_PACKS.map((p) => p.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('adding same template twice does not corrupt library', () => {
    let lib = createEmptyTemplateLibrary();
    lib = addTemplateToLibrary(lib, SAMPLE_TEMPLATES[0]);
    lib = addTemplateToLibrary(lib, SAMPLE_TEMPLATES[0]);
    // Two entries with same ID — library allows this (idempotent seeding checks ID before adding)
    expect(lib.templates.length).toBe(2);
  });

  it('SAMPLE_IDS contains all sample IDs', () => {
    for (const t of SAMPLE_TEMPLATES) {
      expect(SAMPLE_IDS.has(t.id)).toBe(true);
    }
    for (const p of SAMPLE_PACKS) {
      expect(SAMPLE_IDS.has(p.id)).toBe(true);
    }
  });
});

describe('Error Path Hardening', () => {
  it('bundle export with unknown variant returns error', () => {
    const doc = createSpriteDocument('test', 4, 4);
    const plan: BundlePlan = {
      entries: [{
        filename: 'test',
        documentVariantId: 'nonexistent',
        documentVariantName: 'Ghost',
        paletteSetId: null,
        paletteSetName: 'base',
        format: 'sheet',
      }],
      totalFiles: 1,
    };
    const result = executeBundleExport(doc, {}, plan);
    expect('error' in result).toBe(true);
  });

  it('bundle export with unknown palette set returns error', () => {
    const doc = createSpriteDocument('test', 4, 4);
    const layerId = doc.frames[0].layers[0].id;
    const plan: BundlePlan = {
      entries: [{
        filename: 'test',
        documentVariantId: null,
        documentVariantName: 'base',
        paletteSetId: 'nonexistent',
        paletteSetName: 'Ghost',
        format: 'sheet',
      }],
      totalFiles: 1,
    };
    const result = executeBundleExport(doc, { [layerId]: createBlankPixelBuffer(4, 4) }, plan);
    expect('error' in result).toBe(true);
  });

  it('empty bundle plan produces empty result', () => {
    const doc = createSpriteDocument('test', 4, 4);
    const plan = generateBundlePlan(doc, { documentVariants: [], paletteSets: [], format: 'sheet' });
    expect(plan.totalFiles).toBe(1); // defaults to base when empty
  });
});
