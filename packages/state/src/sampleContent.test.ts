import { describe, it, expect } from 'vitest';
import {
  SAMPLE_TEMPLATES,
  SAMPLE_PACKS,
  SAMPLE_TEMPLATE_LOOP,
  SAMPLE_TEMPLATE_VARIANT,
  SAMPLE_PACK_PALETTES,
  SAMPLE_PACK_PARTS,
  SAMPLE_IDS,
} from './sampleContent';
import { parseProjectTemplate, parsePack, INTERCHANGE_FORMAT } from './interchange';

describe('sampleContent', () => {
  it('has 2 sample templates', () => {
    expect(SAMPLE_TEMPLATES).toHaveLength(2);
  });

  it('has 2 sample packs', () => {
    expect(SAMPLE_PACKS).toHaveLength(2);
  });

  it('all sample IDs are tracked', () => {
    expect(SAMPLE_IDS.size).toBe(4);
    expect(SAMPLE_IDS.has('sample-tmpl-loop')).toBe(true);
    expect(SAMPLE_IDS.has('sample-tmpl-variant')).toBe(true);
    expect(SAMPLE_IDS.has('sample-pack-palettes')).toBe(true);
    expect(SAMPLE_IDS.has('sample-pack-parts')).toBe(true);
  });

  describe('Loop Starter template', () => {
    it('has correct metadata', () => {
      expect(SAMPLE_TEMPLATE_LOOP.canvasWidth).toBe(32);
      expect(SAMPLE_TEMPLATE_LOOP.canvasHeight).toBe(32);
    });

    it('produces valid interchange JSON', () => {
      const result = parseProjectTemplate(SAMPLE_TEMPLATE_LOOP.interchangeJson);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.template.frameCount).toBe(4);
      expect(result.template.frameDurationMs).toBe(100);
      expect(result.template.palette.length).toBeGreaterThan(10);
    });
  });

  describe('Character Variant Starter template', () => {
    it('has correct metadata', () => {
      expect(SAMPLE_TEMPLATE_VARIANT.canvasWidth).toBe(32);
      expect(SAMPLE_TEMPLATE_VARIANT.canvasHeight).toBe(48);
    });

    it('includes palette sets', () => {
      const result = parseProjectTemplate(SAMPLE_TEMPLATE_VARIANT.interchangeJson);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.paletteSets).toHaveLength(2);
      expect(result.paletteSets[0].name).toBe('Warm');
      expect(result.paletteSets[1].name).toBe('Cool');
    });
  });

  describe('Palette Essentials pack', () => {
    it('has correct counts', () => {
      expect(SAMPLE_PACK_PALETTES.paletteSetCount).toBe(2);
      expect(SAMPLE_PACK_PALETTES.partCount).toBe(0);
    });

    it('produces valid interchange JSON', () => {
      const result = parsePack(SAMPLE_PACK_PALETTES.interchangeJson, [], []);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.paletteSets).toHaveLength(2);
      expect(result.parts).toHaveLength(0);
    });
  });

  describe('Shape Basics pack', () => {
    it('has correct counts', () => {
      expect(SAMPLE_PACK_PARTS.paletteSetCount).toBe(0);
      expect(SAMPLE_PACK_PARTS.partCount).toBe(3);
    });

    it('produces valid interchange JSON with correct pixel data sizes', () => {
      const result = parsePack(SAMPLE_PACK_PARTS.interchangeJson, [], []);
      expect('error' in result).toBe(false);
      if ('error' in result) return;
      expect(result.parts).toHaveLength(3);
      // Circle: 4x4 = 64 bytes
      expect(result.parts[0].pixelData.length).toBe(4 * 4 * 4);
      // Diamond: 4x4 = 64 bytes
      expect(result.parts[1].pixelData.length).toBe(4 * 4 * 4);
      // Arrow: 4x6 = 96 bytes
      expect(result.parts[2].pixelData.length).toBe(4 * 6 * 4);
    });
  });
});
