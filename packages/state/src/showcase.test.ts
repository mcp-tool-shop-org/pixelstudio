import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseProjectTemplate,
  parsePack,
  parseInterchangeFile,
  INTERCHANGE_FORMAT,
  INTERCHANGE_VERSION,
} from './interchange';

/**
 * Showcase validation tests.
 *
 * Verify that all canonical showcase interchange files:
 * - parse successfully through the real interchange system
 * - contain valid pixel data with correct dimensions
 * - represent the intended product workflows
 */

const SHOWCASE_DIR = join(__dirname, '../../../showcase');

function loadShowcase(name: string): string {
  return readFileSync(join(SHOWCASE_DIR, `${name}.interchange.json`), 'utf8');
}

function loadShowcaseJson(name: string): Record<string, unknown> {
  return JSON.parse(loadShowcase(name));
}

describe('showcase: interchange file validity', () => {
  const files = ['still-sprite', 'loop-animation', 'variant-family', 'pack-project'];

  for (const name of files) {
    it(`${name} has correct format header`, () => {
      const data = loadShowcaseJson(name);
      expect(data.format).toBe(INTERCHANGE_FORMAT);
      expect(data.version).toBe(INTERCHANGE_VERSION);
      expect(data.exportedAt).toBeTruthy();
    });
  }
});

describe('showcase: Still Sprite (Crystal Gem)', () => {
  it('parses as a valid project template', () => {
    const result = parseProjectTemplate(loadShowcase('still-sprite'));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.template.name).toBe('Crystal Gem');
    expect(result.template.canvasWidth).toBe(16);
    expect(result.template.canvasHeight).toBe(16);
    expect(result.template.palette.length).toBeGreaterThan(3);
  });

  it('has no animation settings (static sprite)', () => {
    const result = parseProjectTemplate(loadShowcase('still-sprite'));
    if ('error' in result) return;
    expect(result.template.frameCount).toBeUndefined();
    expect(result.template.frameDurationMs).toBeUndefined();
  });

  it('includes gem part with valid 16x16 pixel data', () => {
    const data = loadShowcaseJson('still-sprite');
    const parts = data.parts as Array<{ width: number; height: number; pixelData: number[] }>;
    expect(parts).toHaveLength(1);
    expect(parts[0].pixelData.length).toBe(16 * 16 * 4);
  });

  it('gem pixel data contains non-transparent pixels', () => {
    const data = loadShowcaseJson('still-sprite');
    const parts = data.parts as Array<{ pixelData: number[] }>;
    const nonTransparent = parts[0].pixelData.filter(
      (_v, i) => i % 4 === 3 && parts[0].pixelData[i] > 0
    );
    expect(nonTransparent.length).toBeGreaterThan(50);
  });
});

describe('showcase: Loop Animation (Flickering Flame)', () => {
  it('parses as a valid animation template', () => {
    const result = parseProjectTemplate(loadShowcase('loop-animation'));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.template.name).toBe('Flickering Flame');
    expect(result.template.frameCount).toBe(4);
    expect(result.template.frameDurationMs).toBe(120);
  });

  it('includes 4 frame parts with valid pixel data', () => {
    const data = loadShowcaseJson('loop-animation');
    const parts = data.parts as Array<{ width: number; height: number; pixelData: number[]; name: string }>;
    expect(parts).toHaveLength(4);
    for (const part of parts) {
      expect(part.pixelData.length).toBe(16 * 16 * 4);
      expect(part.name).toContain('Flame Frame');
    }
  });

  it('frames differ from each other (actual animation)', () => {
    const data = loadShowcaseJson('loop-animation');
    const parts = data.parts as Array<{ pixelData: number[] }>;
    // Compare frame 1 vs frame 2 — they should not be identical
    const f1 = JSON.stringify(parts[0].pixelData);
    const f2 = JSON.stringify(parts[1].pixelData);
    expect(f1).not.toBe(f2);
    // Compare frame 2 vs frame 3
    const f3 = JSON.stringify(parts[2].pixelData);
    expect(f2).not.toBe(f3);
  });
});

describe('showcase: Variant Family (Shield)', () => {
  it('parses as a valid template with palette sets', () => {
    const result = parseProjectTemplate(loadShowcase('variant-family'));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.template.name).toBe('Shield Variants');
    expect(result.paletteSets).toHaveLength(2);
    expect(result.paletteSets[0].name).toBe('Fire');
    expect(result.paletteSets[1].name).toBe('Ice');
  });

  it('palette variants have the same color count as base palette', () => {
    const result = parseProjectTemplate(loadShowcase('variant-family'));
    if ('error' in result) return;
    const baseCount = result.template.palette.length;
    expect(baseCount).toBeGreaterThan(5);
    for (const ps of result.paletteSets) {
      expect(ps.colors.length).toBe(baseCount);
    }
  });

  it('palette variants differ from base (actual recoloring)', () => {
    const result = parseProjectTemplate(loadShowcase('variant-family'));
    if ('error' in result) return;
    const baseColors = JSON.stringify(result.template.palette);
    const fireColors = JSON.stringify(result.paletteSets[0].colors);
    const iceColors = JSON.stringify(result.paletteSets[1].colors);
    expect(fireColors).not.toBe(baseColors);
    expect(iceColors).not.toBe(baseColors);
    expect(fireColors).not.toBe(iceColors);
  });

  it('includes shield base part with valid pixel data', () => {
    const data = loadShowcaseJson('variant-family');
    const parts = data.parts as Array<{ pixelData: number[] }>;
    expect(parts).toHaveLength(1);
    expect(parts[0].pixelData.length).toBe(16 * 16 * 4);
  });
});

describe('showcase: Pack Project (Game UI Kit)', () => {
  it('parses as a valid pack', () => {
    const result = parsePack(loadShowcase('pack-project'), [], []);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.pack.name).toBe('Game UI Kit');
    expect(result.pack.description).toBeTruthy();
  });

  it('contains 3 reusable parts with correct dimensions', () => {
    const result = parsePack(loadShowcase('pack-project'), [], []);
    if ('error' in result) return;
    expect(result.parts).toHaveLength(3);

    const star = result.parts.find((p) => p.name.includes('Star'));
    expect(star).toBeTruthy();
    expect(star!.width).toBe(8);
    expect(star!.height).toBe(8);
    expect(star!.pixelData.length).toBe(8 * 8 * 4);

    const heart = result.parts.find((p) => p.name.includes('Heart'));
    expect(heart).toBeTruthy();
    expect(heart!.width).toBe(6);
    expect(heart!.height).toBe(6);
    expect(heart!.pixelData.length).toBe(6 * 6 * 4);

    const coin = result.parts.find((p) => p.name.includes('Coin'));
    expect(coin).toBeTruthy();
    expect(coin!.width).toBe(5);
    expect(coin!.height).toBe(5);
    expect(coin!.pixelData.length).toBe(5 * 5 * 4);
  });

  it('includes a palette set', () => {
    const result = parsePack(loadShowcase('pack-project'), [], []);
    if ('error' in result) return;
    expect(result.paletteSets).toHaveLength(1);
    expect(result.paletteSets[0].name).toBe('Warm UI');
  });

  it('all parts have meaningful tags', () => {
    const result = parsePack(loadShowcase('pack-project'), [], []);
    if ('error' in result) return;
    for (const part of result.parts) {
      expect(part.tags).toBeTruthy();
      expect(part.tags!.length).toBeGreaterThan(0);
      expect(part.tags).toContain('ui');
    }
  });

  it('can also be parsed as generic interchange', () => {
    const result = parseInterchangeFile(loadShowcase('pack-project'), [], []);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.parts.length).toBe(3);
    expect(result.paletteSets.length).toBe(1);
  });
});

describe('showcase: cross-showcase consistency', () => {
  it('all showcase files use the same interchange version', () => {
    const files = ['still-sprite', 'loop-animation', 'variant-family', 'pack-project'];
    for (const name of files) {
      const data = loadShowcaseJson(name);
      expect(data.version).toBe(INTERCHANGE_VERSION);
    }
  });

  it('all parts across all showcases have valid pixel data lengths', () => {
    const files = ['still-sprite', 'loop-animation', 'variant-family', 'pack-project'];
    for (const name of files) {
      const data = loadShowcaseJson(name);
      const parts = (data.parts ?? []) as Array<{ name: string; width: number; height: number; pixelData: number[] }>;
      for (const part of parts) {
        const expected = part.width * part.height * 4;
        expect(part.pixelData.length).toBe(expected);
      }
    }
  });

  it('all pixel data values are valid RGBA (0-255)', () => {
    const files = ['still-sprite', 'loop-animation', 'variant-family', 'pack-project'];
    for (const name of files) {
      const data = loadShowcaseJson(name);
      const parts = (data.parts ?? []) as Array<{ name: string; pixelData: number[] }>;
      for (const part of parts) {
        for (const val of part.pixelData) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(255);
          expect(Number.isInteger(val)).toBe(true);
        }
      }
    }
  });
});
