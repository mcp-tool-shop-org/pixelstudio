import { describe, it, expect } from 'vitest';
import {
  createVectorMasterDocument,
  createRectShape,
  createEllipseShape,
  BUILT_IN_SIZE_PROFILES,
} from '@glyphstudio/domain';
import type { VectorMasterDocument, SizeProfile } from '@glyphstudio/domain';
import { vectorToSpriteHandoff, extractPaletteFromBuffer } from './vectorHandoff';
import { createBlankPixelBuffer } from '@glyphstudio/domain';

function makeTestDoc(): VectorMasterDocument {
  const doc = createVectorMasterDocument('Test Master');
  const rect = createRectShape('body', 100, 100, 200, 200, [255, 0, 0, 255]);
  rect.zOrder = 0;
  const ellipse = createEllipseShape('head', 250, 250, 80, 80, [0, 0, 255, 255]);
  ellipse.zOrder = 1;
  doc.shapes.push(rect, ellipse);
  return doc;
}

const PROFILE_32: SizeProfile = BUILT_IN_SIZE_PROFILES.find(p => p.id === 'sp_32x32')!;
const PROFILE_64: SizeProfile = BUILT_IN_SIZE_PROFILES.find(p => p.id === 'sp_64x64')!;
const PROFILE_16: SizeProfile = BUILT_IN_SIZE_PROFILES.find(p => p.id === 'sp_16x16')!;

describe('vectorToSpriteHandoff', () => {
  it('returns a sprite document with correct dimensions', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_32);
    expect(result.document.width).toBe(32);
    expect(result.document.height).toBe(32);
  });

  it('document has one frame with one layer', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_32);
    expect(result.document.frames.length).toBe(1);
    expect(result.document.frames[0].layers.length).toBe(1);
  });

  it('pixel buffer matches target dimensions', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_64);
    const layerId = result.document.frames[0].layers[0].id;
    const buf = result.pixelBuffers[layerId];
    expect(buf.width).toBe(64);
    expect(buf.height).toBe(64);
  });

  it('pixel buffer has non-transparent pixels', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_32);
    const layerId = result.document.frames[0].layers[0].id;
    const buf = result.pixelBuffers[layerId];
    let hasColor = false;
    for (let i = 0; i < buf.data.length; i += 4) {
      if (buf.data[i + 3] > 0) { hasColor = true; break; }
    }
    expect(hasColor).toBe(true);
  });

  it('source link records correct profile ID', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_32, 'test.glyphvec');
    expect(result.sourceLink.profileId).toBe('sp_32x32');
    expect(result.sourceLink.sourceFile).toBe('test.glyphvec');
    expect(result.sourceLink.sourceArtboardWidth).toBe(500);
    expect(result.sourceLink.sourceArtboardHeight).toBe(500);
  });

  it('source link has valid rasterizedAt timestamp', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_16);
    expect(new Date(result.sourceLink.rasterizedAt).getTime()).not.toBeNaN();
  });

  it('document name includes dimensions', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_32);
    expect(result.document.name).toContain('32×32');
    expect(result.document.name).toContain('Test Master');
  });

  it('palette includes transparent as index 0', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_32);
    const c0 = result.document.palette.colors[0];
    expect(c0.rgba).toEqual([0, 0, 0, 0]);
  });

  it('palette extracts unique colors from rasterized output', () => {
    const doc = makeTestDoc();
    const result = vectorToSpriteHandoff(doc, PROFILE_64);
    // Should have at least transparent + red + blue
    expect(result.document.palette.colors.length).toBeGreaterThanOrEqual(3);
  });

  it('different profiles produce different sprite dimensions', () => {
    const doc = makeTestDoc();
    const r32 = vectorToSpriteHandoff(doc, PROFILE_32);
    const r64 = vectorToSpriteHandoff(doc, PROFILE_64);
    expect(r32.document.width).not.toBe(r64.document.width);
  });

  it('empty document produces blank buffer', () => {
    const doc = createVectorMasterDocument('Empty');
    const result = vectorToSpriteHandoff(doc, PROFILE_16);
    const layerId = result.document.frames[0].layers[0].id;
    const buf = result.pixelBuffers[layerId];
    // All pixels should be transparent
    let allTransparent = true;
    for (let i = 0; i < buf.data.length; i += 4) {
      if (buf.data[i + 3] > 0) { allTransparent = false; break; }
    }
    expect(allTransparent).toBe(true);
  });
});

describe('extractPaletteFromBuffer', () => {
  it('returns only transparent for blank buffer', () => {
    const buf = createBlankPixelBuffer(8, 8);
    const colors = extractPaletteFromBuffer(buf);
    expect(colors.length).toBe(1);
    expect(colors[0].rgba).toEqual([0, 0, 0, 0]);
  });

  it('deduplicates identical colors', () => {
    const buf = createBlankPixelBuffer(4, 4);
    // Fill every pixel with the same color
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = 128;
      buf.data[i + 1] = 64;
      buf.data[i + 2] = 32;
      buf.data[i + 3] = 255;
    }
    const colors = extractPaletteFromBuffer(buf);
    expect(colors.length).toBe(2); // transparent + one color
  });

  it('extracts multiple distinct colors', () => {
    const buf = createBlankPixelBuffer(4, 1);
    // 4 pixels, 2 distinct colors
    buf.data[0] = 255; buf.data[1] = 0; buf.data[2] = 0; buf.data[3] = 255;
    buf.data[4] = 0; buf.data[5] = 255; buf.data[6] = 0; buf.data[7] = 255;
    buf.data[8] = 255; buf.data[9] = 0; buf.data[10] = 0; buf.data[11] = 255;
    // pixel 4 stays transparent
    const colors = extractPaletteFromBuffer(buf);
    expect(colors.length).toBe(3); // transparent + red + green
  });
});
