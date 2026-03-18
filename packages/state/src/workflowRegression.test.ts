/**
 * Workflow regression tests — canonical production paths end to end.
 *
 * These verify the strongest workflows maintain data integrity
 * through their complete lifecycle: create → edit → save → load → export.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createBlankPixelBuffer, createSpriteDocument } from '@glyphstudio/domain';
import type { SpriteDocument, SpritePixelBuffer, Part } from '@glyphstudio/domain';
import { useSpriteEditorStore } from './spriteEditorStore';
import { setPixel, samplePixel, clonePixelBuffer } from './spriteRaster';
import type { Rgba } from './spriteRaster';
import { serializeSpriteFile, deserializeSpriteFile } from './spritePersistence';
import { generateSpriteSheetMeta, encodeAnimatedGif } from './spriteExport';
import { generateBundlePlan, executeBundleExport } from './bundleExport';
import { buildColorMap, remapPixelBuffer } from './paletteRemap';
import { createPartFromSelection } from './partPromotion';
import {
  createEmptyPartLibrary,
  addPartToLibrary,
  findPartById,
} from './partLibrary';
import {
  exportProjectTemplate,
  parseProjectTemplate,
  exportPack,
  parsePack,
  parseInterchangeFile,
} from './interchange';

const RED: Rgba = [255, 0, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const BLACK: Rgba = [0, 0, 0, 255];

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
}

function openDoc(w = 8, h = 8) {
  useSpriteEditorStore.getState().newDocument('test', w, h);
}

function getDoc() {
  return useSpriteEditorStore.getState().document!;
}

function getBuffers() {
  return useSpriteEditorStore.getState().pixelBuffers;
}

function layerId(frameIndex: number): string {
  return getDoc().frames[frameIndex].layers[0].id;
}

describe('Workflow Regression: Blank → Draw → Save → Reopen → Export', () => {
  beforeEach(() => resetStore());

  it('full still-image lifecycle', () => {
    // 1. Create blank
    openDoc(4, 4);
    expect(getDoc()).not.toBeNull();
    expect(getDoc().frames).toHaveLength(1);

    // 2. Draw pixels
    const lid = layerId(0);
    const buf = clonePixelBuffer(getBuffers()[lid]);
    setPixel(buf, 0, 0, RED);
    setPixel(buf, 1, 1, BLUE);
    useSpriteEditorStore.getState().commitPixels(buf);

    expect(samplePixel(getBuffers()[lid], 0, 0)).toEqual(RED);
    expect(samplePixel(getBuffers()[lid], 1, 1)).toEqual(BLUE);

    // 3. Save (serialize)
    const json = serializeSpriteFile(getDoc(), getBuffers());
    expect(json).toBeTruthy();

    // 4. Reopen (deserialize)
    const loaded = deserializeSpriteFile(json);
    expect('error' in loaded).toBe(false);
    if ('error' in loaded) return;

    // 5. Verify pixel integrity after roundtrip
    expect(samplePixel(loaded.pixelBuffers[lid], 0, 0)).toEqual(RED);
    expect(samplePixel(loaded.pixelBuffers[lid], 1, 1)).toEqual(BLUE);

    // 6. Export
    const meta = generateSpriteSheetMeta(loaded.document);
    expect('error' in meta).toBe(false);
  });
});

describe('Workflow Regression: Animation → GIF Export', () => {
  beforeEach(() => resetStore());

  it('multi-frame animation lifecycle', () => {
    openDoc(4, 4);

    // Add frames
    useSpriteEditorStore.getState().addFrame();
    useSpriteEditorStore.getState().addFrame();
    expect(getDoc().frames).toHaveLength(3);

    // Switch back to frame 0 and draw
    useSpriteEditorStore.getState().setActiveFrame(0);
    const lid0 = layerId(0);
    const activeLayer = getDoc().frames[0].layers[0].id;
    useSpriteEditorStore.setState({ activeLayerId: activeLayer });
    const buf0 = clonePixelBuffer(getBuffers()[lid0]);
    setPixel(buf0, 0, 0, RED);
    useSpriteEditorStore.getState().commitPixels(buf0);

    // Save + load roundtrip
    const json = serializeSpriteFile(getDoc(), getBuffers());
    const loaded = deserializeSpriteFile(json);
    expect('error' in loaded).toBe(false);
    if ('error' in loaded) return;
    expect(loaded.document.frames).toHaveLength(3);
    expect(samplePixel(loaded.pixelBuffers[lid0], 0, 0)).toEqual(RED);

    // GIF export
    const { document: doc, pixelBuffers } = loaded;
    const frameBuffers = doc.frames.map((f) => {
      const layerBuf = pixelBuffers[f.layers[0].id];
      return layerBuf ?? createBlankPixelBuffer(doc.width, doc.height);
    });
    const durations = doc.frames.map((f) => f.durationMs);
    const gif = encodeAnimatedGif(frameBuffers, durations);
    expect(gif).toBeInstanceOf(Uint8Array);
  });
});

describe('Workflow Regression: Palette Variant → Preview → Apply → Undo', () => {
  beforeEach(() => resetStore());

  it('palette variant apply and remap', () => {
    openDoc(4, 4);

    // Paint black
    const lid = layerId(0);
    const buf = clonePixelBuffer(getBuffers()[lid]);
    setPixel(buf, 0, 0, BLACK);
    useSpriteEditorStore.getState().commitPixels(buf);

    // Create palette set with Black → Red
    const psId = useSpriteEditorStore.getState().createPaletteSet('Red Shift')!;
    const doc = getDoc();
    const variantColors = doc.paletteSets![0].colors.map((c) => ({ ...c }));
    variantColors[1] = { ...variantColors[1], rgba: RED };
    useSpriteEditorStore.setState({
      document: {
        ...getDoc(),
        paletteSets: getDoc().paletteSets!.map((ps) =>
          ps.id === psId ? { ...ps, colors: variantColors } : ps,
        ),
      },
    });

    // Preview
    useSpriteEditorStore.getState().previewPaletteSet(psId);
    expect(useSpriteEditorStore.getState().previewPaletteSetId).toBe(psId);

    // Apply
    useSpriteEditorStore.getState().applyPaletteSetToFrame(psId);
    expect(samplePixel(getBuffers()[lid], 0, 0)).toEqual(RED);
    expect(useSpriteEditorStore.getState().previewPaletteSetId).toBeNull();

    // Save + load preserves palette sets
    const json = serializeSpriteFile(getDoc(), getBuffers());
    const loaded = deserializeSpriteFile(json);
    expect('error' in loaded).toBe(false);
    if ('error' in loaded) return;
    expect(loaded.document.paletteSets).toHaveLength(1);
    expect(loaded.document.paletteSets![0].name).toBe('Red Shift');
  });
});

describe('Workflow Regression: Document Variants → Compare → Bundle Export', () => {
  beforeEach(() => resetStore());

  it('variant family lifecycle', () => {
    openDoc(4, 4);

    // Paint base
    const lid = layerId(0);
    const buf = clonePixelBuffer(getBuffers()[lid]);
    setPixel(buf, 0, 0, RED);
    useSpriteEditorStore.getState().commitPixels(buf);

    // Create variant
    const varId = useSpriteEditorStore.getState().createVariant('Walk Left')!;
    expect(getDoc().variants).toHaveLength(1);

    // Switch + edit variant
    useSpriteEditorStore.getState().switchToVariant(varId);
    expect(getDoc().activeVariantId).toBe(varId);
    const varLid = getDoc().variants![0].frames[0].layers[0].id;
    const varBuf = clonePixelBuffer(getBuffers()[varLid]);
    setPixel(varBuf, 0, 0, BLUE);
    useSpriteEditorStore.getState().commitPixels(varBuf);

    // Switch back to base — base pixel intact
    useSpriteEditorStore.getState().switchToVariant(null);
    expect(samplePixel(getBuffers()[lid], 0, 0)).toEqual(RED);

    // Compare mode
    useSpriteEditorStore.getState().setCompareVariant(varId);
    expect(useSpriteEditorStore.getState().compareVariantId).toBe(varId);
    const compareFrames = useSpriteEditorStore.getState().getCompareFrames();
    expect(compareFrames).toHaveLength(1);

    // Bundle export
    const plan = generateBundlePlan(getDoc(), {
      documentVariants: [null, varId],
      paletteSets: [],
      format: 'sheet',
    });
    expect(plan.totalFiles).toBe(2);
    const result = executeBundleExport(getDoc(), getBuffers(), plan);
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result).toHaveLength(2);

    // Save + load preserves variants
    const json = serializeSpriteFile(getDoc(), getBuffers());
    const loaded = deserializeSpriteFile(json);
    expect('error' in loaded).toBe(false);
    if ('error' in loaded) return;
    expect(loaded.document.variants).toHaveLength(1);
    expect(loaded.document.variants![0].name).toBe('Walk Left');
  });
});

describe('Workflow Regression: Parts → Stamp → Library', () => {
  beforeEach(() => resetStore());

  it('part promotion and stamping lifecycle', () => {
    // Create a part from pixel data
    const partBuf = createBlankPixelBuffer(2, 2);
    setPixel(partBuf, 0, 0, RED);
    setPixel(partBuf, 1, 0, BLUE);
    const part = createPartFromSelection(partBuf, 'Test Stamp');

    expect(part.width).toBe(2);
    expect(part.height).toBe(2);
    expect(part.pixelData.length).toBe(2 * 2 * 4);

    // Add to library
    let lib = addPartToLibrary(createEmptyPartLibrary(), part);
    expect(findPartById(lib, part.id)?.name).toBe('Test Stamp');

    // Stamp onto document
    openDoc(8, 8);
    useSpriteEditorStore.getState().stampPart(part.pixelData, part.width, part.height, 3, 3);

    const lid = layerId(0);
    expect(samplePixel(getBuffers()[lid], 3, 3)).toEqual(RED);
    expect(samplePixel(getBuffers()[lid], 4, 3)).toEqual(BLUE);
  });
});

describe('Workflow Regression: Template → New Project', () => {
  beforeEach(() => resetStore());

  it('template roundtrip and project creation', () => {
    // Create source doc with palette sets
    openDoc(32, 48);
    useSpriteEditorStore.getState().createPaletteSet('Warm');
    useSpriteEditorStore.getState().addFrame();

    // Export as template
    const json = exportProjectTemplate(getDoc(), createEmptyPartLibrary());
    const parsed = parseProjectTemplate(json);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.template.canvasWidth).toBe(32);
    expect(parsed.template.canvasHeight).toBe(48);
    expect(parsed.template.frameCount).toBe(2);

    // Create new document from template
    resetStore();
    const err = useSpriteEditorStore.getState().newDocumentFromTemplate(json);
    expect(err).toBeNull();
    expect(getDoc().width).toBe(32);
    expect(getDoc().height).toBe(48);
    expect(getDoc().frames.length).toBe(2);
    expect(getDoc().paletteSets).toHaveLength(1);
  });
});

describe('Workflow Regression: Pack → Import → Apply', () => {
  beforeEach(() => resetStore());

  it('pack export and import lifecycle', () => {
    openDoc(16, 16);
    useSpriteEditorStore.getState().createPaletteSet('Cool');

    const lib = addPartToLibrary(createEmptyPartLibrary(), {
      id: 'p1', name: 'Head', width: 4, height: 4,
      pixelData: new Array(64).fill(0),
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });

    // Export pack
    const json = exportPack(getDoc(), lib, {
      name: 'Player Kit',
      paletteSetIds: getDoc().paletteSets!.map((ps) => ps.id),
      partIds: ['p1'],
    });

    // Parse and verify
    const result = parsePack(json, [], []);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.pack.name).toBe('Player Kit');
    expect(result.paletteSets).toHaveLength(1);
    expect(result.parts).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);

    // Conflict detection
    const withConflicts = parsePack(json, ['Cool'], ['Head']);
    expect('error' in withConflicts).toBe(false);
    if ('error' in withConflicts) return;
    expect(withConflicts.conflicts).toHaveLength(2);
  });
});

describe('Workflow Regression: Interchange Error Handling', () => {
  it('rejects invalid JSON gracefully', () => {
    expect('error' in parseInterchangeFile('not json', [], [])).toBe(true);
    expect('error' in parseProjectTemplate('not json')).toBe(true);
    expect('error' in parsePack('not json', [], [])).toBe(true);
  });

  it('rejects wrong format', () => {
    const bad = JSON.stringify({ format: 'wrong' });
    expect('error' in parseInterchangeFile(bad, [], [])).toBe(true);
    expect('error' in parseProjectTemplate(bad)).toBe(true);
    expect('error' in parsePack(bad, [], [])).toBe(true);
  });

  it('rejects future version', () => {
    const future = JSON.stringify({ format: 'glyphstudio-interchange', version: 999 });
    expect('error' in parseInterchangeFile(future, [], [])).toBe(true);
  });
});
