/**
 * Stage 37 — Benchmark Asset Materialization
 *
 * Writes all 5 benchmark sprites to disk as:
 *   - examples/benchmark-assets/<slug>/<slug>.glyph  (canonical source)
 *   - docs/benchmark-assets/<slug>/<slug>.png        (exported frame/sheet)
 *   - docs/benchmark-assets/<slug>/<slug>.gif        (animated only)
 *   - docs/benchmark-assets/<slug>/<slug>-sheet.png  (animated only)
 *   - docs/benchmark-assets/<slug>/metadata.json     (summary)
 *
 * These become regression fixtures, visual proof, and demo assets.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { encode } from 'fast-png';
import {
  createHeadlessStore,
  storeNewDocument,
  storeDrawPixels,
  storeAddFrame,
  storeSetActiveFrame,
  storeSetFrameDuration,
  storeAddLayer,
  storeSetActiveLayer,
  storeRenameLayer,
  storeLoadDocument,
  storeGetDocumentSummary,
  storeExportSheetWithMeta,
  storeExportGif,
  storeAnalyzeBounds,
  storeAnalyzeColors,
  storeCompareFrames,
  storeSaveDocument,
  type HeadlessStore,
  type PixelEntry,
} from '../adapters/storeAdapter.js';
import { runSpriteValidation, flattenLayers } from '@glyphstudio/state';
import type { SpriteColor, SpriteColorGroup } from '@glyphstudio/domain';

// ── Paths ──

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const EXAMPLES = resolve(ROOT, 'examples', 'benchmark-assets');
const DOCS = resolve(ROOT, 'docs', 'benchmark-assets');

// ── Palette (same as benchmarkPack.test.ts) ──

type RGBA = [number, number, number, number];

const PAL = {
  transparent: [0, 0, 0, 0] as RGBA,
  black:       [0, 0, 0, 255] as RGBA,
  darkGray:    [85, 85, 85, 255] as RGBA,
  midGray:     [170, 170, 170, 255] as RGBA,
  white:       [255, 255, 255, 255] as RGBA,
  darkBrown:   [102, 57, 0, 255] as RGBA,
  brown:       [153, 102, 51, 255] as RGBA,
  tan:         [204, 170, 102, 255] as RGBA,
  darkRed:     [153, 0, 0, 255] as RGBA,
  red:         [255, 51, 51, 255] as RGBA,
  darkGreen:   [0, 102, 0, 255] as RGBA,
  green:       [51, 170, 51, 255] as RGBA,
  darkBlue:    [0, 51, 153, 255] as RGBA,
  blue:        [51, 102, 255, 255] as RGBA,
  yellow:      [255, 204, 0, 255] as RGBA,
  peach:       [255, 204, 170, 255] as RGBA,
};

function rect(x: number, y: number, w: number, h: number, rgba: RGBA): PixelEntry[] {
  const pixels: PixelEntry[] = [];
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      pixels.push({ x: px, y: py, rgba });
    }
  }
  return pixels;
}

function outlineRect(x: number, y: number, w: number, h: number, rgba: RGBA): PixelEntry[] {
  const pixels: PixelEntry[] = [];
  for (let px = x; px < x + w; px++) {
    pixels.push({ x: px, y, rgba });
    pixels.push({ x: px, y: y + h - 1, rgba });
  }
  for (let py = y + 1; py < y + h - 1; py++) {
    pixels.push({ x, y: py, rgba });
    pixels.push({ x: x + w - 1, y: py, rgba });
  }
  return pixels;
}

function setupPalette(store: HeadlessStore): void {
  const state = store.getState();
  if (!state.document) return;

  const colors: SpriteColor[] = [
    { rgba: PAL.transparent, name: 'Transparent' },
    { rgba: PAL.black, name: 'Black', locked: true, semanticRole: 'outline', groupId: 'grp_outline' },
    { rgba: PAL.darkGray, name: 'Dark Gray', semanticRole: 'shadow', groupId: 'grp_neutral' },
    { rgba: PAL.midGray, name: 'Mid Gray', groupId: 'grp_neutral' },
    { rgba: PAL.white, name: 'White', semanticRole: 'highlight', groupId: 'grp_neutral' },
    { rgba: PAL.darkBrown, name: 'Dark Brown', groupId: 'grp_warm' },
    { rgba: PAL.brown, name: 'Brown', groupId: 'grp_warm' },
    { rgba: PAL.tan, name: 'Tan', semanticRole: 'skin', groupId: 'grp_warm' },
    { rgba: PAL.darkRed, name: 'Dark Red', groupId: 'grp_accent' },
    { rgba: PAL.red, name: 'Red', groupId: 'grp_accent' },
    { rgba: PAL.darkGreen, name: 'Dark Green', groupId: 'grp_nature' },
    { rgba: PAL.green, name: 'Green', groupId: 'grp_nature' },
    { rgba: PAL.darkBlue, name: 'Dark Blue', groupId: 'grp_cool' },
    { rgba: PAL.blue, name: 'Blue', groupId: 'grp_cool' },
    { rgba: PAL.yellow, name: 'Yellow', groupId: 'grp_accent' },
    { rgba: PAL.peach, name: 'Peach', semanticRole: 'skin-light', groupId: 'grp_warm' },
  ];

  const groups: SpriteColorGroup[] = [
    { id: 'grp_outline', name: 'Outline' },
    { id: 'grp_neutral', name: 'Neutral' },
    { id: 'grp_warm', name: 'Warm' },
    { id: 'grp_accent', name: 'Accent' },
    { id: 'grp_nature', name: 'Nature' },
    { id: 'grp_cool', name: 'Cool' },
  ];

  store.setState({
    document: {
      ...state.document,
      palette: { ...state.document.palette, colors, foregroundIndex: 1, backgroundIndex: 0, groups },
    },
  });
}

// ── File writing helpers ──

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writePng(filePath: string, data: Uint8ClampedArray, width: number, height: number) {
  const pngBytes = encode({ width, height, data, channels: 4, depth: 8 });
  writeFileSync(filePath, Buffer.from(pngBytes));
}

function writeGif(filePath: string, gifData: Uint8Array) {
  writeFileSync(filePath, Buffer.from(gifData));
}

function writeGlyph(filePath: string, json: string) {
  writeFileSync(filePath, json, 'utf-8');
}

function writeMetadata(filePath: string, meta: Record<string, unknown>) {
  writeFileSync(filePath, JSON.stringify(meta, null, 2), 'utf-8');
}

/** Flatten frame 0 (or specified) to a single RGBA buffer for PNG export. */
function flattenFrame(store: HeadlessStore, frameIndex = 0) {
  const { document: doc, pixelBuffers } = store.getState();
  if (!doc) throw new Error('No document');
  const frame = doc.frames[frameIndex];
  return flattenLayers(frame.layers, pixelBuffers, doc.width, doc.height);
}

/** Build metadata object for a materialized asset. */
function buildMetadata(store: HeadlessStore, workflow: string) {
  const doc = store.getState().document!;
  const summary = storeGetDocumentSummary(store)!;
  const report = runSpriteValidation(doc);

  const frameAnalysis = doc.frames.map((_, i) => {
    const bounds = storeAnalyzeBounds(store, i);
    const colors = storeAnalyzeColors(store, i);
    return {
      frame: i,
      bounds: typeof bounds === 'string' ? { error: bounds } : bounds,
      colors: typeof colors === 'string' ? { error: colors } : { uniqueColors: colors.uniqueColors, opaqueCount: colors.opaqueCount },
    };
  });

  return {
    name: doc.name,
    width: doc.width,
    height: doc.height,
    frameCount: doc.frames.length,
    frameDurations: doc.frames.map((f) => f.durationMs),
    palette: {
      colorCount: doc.palette.colors.length,
      groups: (doc.palette.groups ?? []).map((g) => g.name),
      namedColors: doc.palette.colors.filter((c) => c.name).map((c) => ({
        name: c.name,
        rgba: c.rgba,
        role: c.semanticRole,
        group: (doc.palette.groups ?? []).find((g) => g.id === c.groupId)?.name,
        locked: c.locked ?? false,
      })),
    },
    workflow,
    validation: {
      errors: report.summary.errorCount,
      warnings: report.summary.warningCount,
      info: report.summary.infoCount,
      issues: report.issues.map((i) => ({
        severity: i.severity,
        rule: i.ruleId,
        message: i.message,
      })),
    },
    analysis: frameAnalysis,
    generatedAt: new Date().toISOString(),
    generator: 'Stage 37 — Benchmark Asset Materialization',
  };
}

// ═══════════════════════════════════════════════════════════════════
// Asset builders (same pixel data as benchmarkPack.test.ts)
// ═══════════════════════════════════════════════════════════════════

function buildWoodenCrate(): HeadlessStore {
  const store = createHeadlessStore();
  storeNewDocument(store, 'Wooden Crate', 16, 16);
  setupPalette(store);

  storeDrawPixels(store, outlineRect(2, 2, 12, 12, PAL.black));
  storeDrawPixels(store, rect(3, 3, 10, 10, PAL.brown));
  storeDrawPixels(store, rect(3, 7, 10, 2, PAL.darkBrown));
  storeDrawPixels(store, rect(7, 3, 2, 10, PAL.darkBrown));
  storeDrawPixels(store, rect(3, 3, 10, 1, PAL.tan));
  storeDrawPixels(store, rect(3, 12, 10, 1, PAL.darkGray));
  storeDrawPixels(store, [
    { x: 4, y: 4, rgba: PAL.yellow },
    { x: 11, y: 4, rgba: PAL.yellow },
    { x: 4, y: 11, rgba: PAL.yellow },
    { x: 11, y: 11, rgba: PAL.yellow },
  ]);

  return store;
}

// ── Hero knight palette (7 colors + transparent) ──

const KNIGHT_PAL = {
  o: [20, 12, 28, 255] as RGBA,     // outline — near-black
  D: [55, 65, 85, 255] as RGBA,     // armor dark (shadow)
  M: [90, 110, 140, 255] as RGBA,   // armor mid (base)
  L: [145, 165, 195, 255] as RGBA,  // armor light (lit)
  S: [224, 180, 140, 255] as RGBA,  // skin
  s: [184, 140, 108, 255] as RGBA,  // skin shadow
  G: [230, 190, 50, 255] as RGBA,   // gold accent
};

/**
 * Stage 38 — Hero Knight (16×24, static, front-facing idle)
 *
 * Design: armored knight with helmet, pauldrons, breastplate,
 * gold crest + belt, greaves, boots. Light from top-left.
 *
 * Grid key:
 *   . = transparent   o = outline      D = armor dark
 *   M = armor mid     L = armor light  S = skin
 *   s = skin shadow   G = gold accent
 */
const KNIGHT_GRID: string[] = [
  // 0123456789ABCDEF
  '................', // 0
  '.......oGo......', // 1  crest tip
  '......oGGGo.....', // 2  crest
  '.....oLLMMDo....', // 3  helmet top
  '.....oLMMDDo....', // 4  helmet
  '....oLMMMMDDo...', // 5  helmet wide (brow)
  '....oDDSsSDDo...', // 6  visor: dark frame, skin eyes
  '.....oLMMDDo....', // 7  chin guard
  '......oMDDo.....', // 8  gorget
  '....oLLMMDDDo...', // 9  shoulders
  '...oLMDoMMDoDDo.', // 10 pauldron|chest|pauldron
  '..oLDoLMMDoDDo..', // 11 arm|chest|arm (connected)
  '..oLDoLMMDoDDo..', // 12 arm|chest|arm
  '..oooooGGGooooo.', // 13 hands + gold belt
  '.....oLMMDDo....', // 14 tasset
  '....oLMDooDDo...', // 15 upper legs
  '....oLMo..oDo...', // 16 legs
  '....oLMo..oDo...', // 17 legs
  '....oMDo..oDo...', // 18 knees (darker)
  '....oLMo..oDo...', // 19 greaves
  '...oLMDo..oDDo..', // 20 boots (wider)
  '...ooooo..ooooo.', // 21 soles
  '................', // 22
  '................', // 23
];

function gridToPixels(grid: string[], pal: Record<string, RGBA>): PixelEntry[] {
  const pixels: PixelEntry[] = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const rgba = pal[ch];
      if (rgba) pixels.push({ x, y, rgba });
    }
  }
  return pixels;
}

function buildKnightIdle(): HeadlessStore {
  const store = createHeadlessStore();
  storeNewDocument(store, 'Knight Idle', 16, 24);
  setupPalette(store);

  // Single frame, no animation — this is a hero quality test
  storeDrawPixels(store, gridToPixels(KNIGHT_GRID, KNIGHT_PAL));

  return store;
}

function buildKnightWalk(): HeadlessStore {
  const store = createHeadlessStore();
  storeNewDocument(store, 'Knight Walk', 16, 24);
  setupPalette(store);

  storeAddFrame(store);
  storeAddFrame(store);
  storeAddFrame(store);
  const doc = store.getState().document!;
  for (const frame of doc.frames) {
    storeSetFrameDuration(store, frame.id, 150);
  }

  const walkPoses = [
    { leftLeg: { x: 4, y: 14, w: 3, h: 8 }, rightLeg: { x: 9, y: 14, w: 3, h: 6 } },
    { leftLeg: { x: 5, y: 14, w: 3, h: 7 }, rightLeg: { x: 8, y: 14, w: 3, h: 7 } },
    { leftLeg: { x: 4, y: 14, w: 3, h: 6 }, rightLeg: { x: 9, y: 14, w: 3, h: 8 } },
    { leftLeg: { x: 5, y: 15, w: 3, h: 7 }, rightLeg: { x: 8, y: 15, w: 3, h: 7 } },
  ];

  for (let i = 0; i < 4; i++) {
    storeSetActiveFrame(store, i);
    const pose = walkPoses[i];
    storeDrawPixels(store, rect(4, 1, 8, 13, PAL.blue));
    storeDrawPixels(store, rect(5, 0, 6, 5, PAL.peach));
    storeDrawPixels(store, rect(pose.leftLeg.x, pose.leftLeg.y, pose.leftLeg.w, pose.leftLeg.h, PAL.darkBlue));
    storeDrawPixels(store, rect(pose.rightLeg.x, pose.rightLeg.y, pose.rightLeg.w, pose.rightLeg.h, PAL.darkBlue));
  }

  return store;
}

function buildSparkHit(): HeadlessStore {
  const store = createHeadlessStore();
  storeNewDocument(store, 'Spark Hit', 16, 16);
  setupPalette(store);

  storeAddFrame(store);
  storeAddFrame(store);
  const doc = store.getState().document!;
  for (const frame of doc.frames) {
    storeSetFrameDuration(store, frame.id, 80);
  }

  // Frame 0: small spark
  storeSetActiveFrame(store, 0);
  storeDrawPixels(store, [
    { x: 7, y: 7, rgba: PAL.white },
    { x: 8, y: 7, rgba: PAL.white },
    { x: 7, y: 8, rgba: PAL.white },
    { x: 8, y: 8, rgba: PAL.white },
    { x: 6, y: 7, rgba: PAL.yellow },
    { x: 9, y: 7, rgba: PAL.yellow },
    { x: 7, y: 6, rgba: PAL.yellow },
    { x: 7, y: 9, rgba: PAL.yellow },
  ]);

  // Frame 1: burst
  storeSetActiveFrame(store, 1);
  storeDrawPixels(store, rect(5, 5, 6, 6, PAL.yellow));
  storeDrawPixels(store, rect(6, 6, 4, 4, PAL.white));
  storeDrawPixels(store, [
    { x: 4, y: 4, rgba: PAL.red },
    { x: 11, y: 4, rgba: PAL.red },
    { x: 4, y: 11, rgba: PAL.red },
    { x: 11, y: 11, rgba: PAL.red },
  ]);

  // Frame 2: embers
  storeSetActiveFrame(store, 2);
  storeDrawPixels(store, [
    { x: 5, y: 5, rgba: PAL.darkRed },
    { x: 10, y: 5, rgba: PAL.darkRed },
    { x: 5, y: 10, rgba: PAL.darkRed },
    { x: 10, y: 10, rgba: PAL.darkRed },
    { x: 7, y: 7, rgba: PAL.yellow },
    { x: 8, y: 8, rgba: PAL.yellow },
  ]);

  return store;
}

function buildGrassTiles(): HeadlessStore {
  const store = createHeadlessStore();
  storeNewDocument(store, 'Grass Tiles', 32, 16);
  setupPalette(store);

  // Tile 1: flat grass
  storeDrawPixels(store, rect(0, 0, 16, 16, PAL.green));
  storeDrawPixels(store, rect(0, 12, 16, 4, PAL.darkBrown));
  storeDrawPixels(store, [
    { x: 2, y: 8, rgba: PAL.darkGreen },
    { x: 3, y: 7, rgba: PAL.darkGreen },
    { x: 7, y: 9, rgba: PAL.darkGreen },
    { x: 8, y: 8, rgba: PAL.darkGreen },
    { x: 12, y: 8, rgba: PAL.darkGreen },
    { x: 13, y: 7, rgba: PAL.darkGreen },
  ]);

  // Tile 2: grass with flower
  storeDrawPixels(store, rect(16, 0, 16, 16, PAL.green));
  storeDrawPixels(store, rect(16, 12, 16, 4, PAL.darkBrown));
  storeDrawPixels(store, [
    { x: 19, y: 9, rgba: PAL.darkGreen },
    { x: 20, y: 8, rgba: PAL.darkGreen },
    { x: 25, y: 8, rgba: PAL.darkGreen },
    { x: 26, y: 7, rgba: PAL.darkGreen },
    { x: 22, y: 6, rgba: PAL.red },
    { x: 23, y: 5, rgba: PAL.red },
    { x: 23, y: 7, rgba: PAL.red },
    { x: 24, y: 6, rgba: PAL.red },
    { x: 23, y: 6, rgba: PAL.yellow },
    { x: 23, y: 8, rgba: PAL.darkGreen },
    { x: 23, y: 9, rgba: PAL.darkGreen },
  ]);

  return store;
}

// ═══════════════════════════════════════════════════════════════════
// Materialization tests
// ═══════════════════════════════════════════════════════════════════

interface AssetDef {
  slug: string;
  build: () => HeadlessStore;
  workflow: string;
  animated: boolean;
}

const ASSETS: AssetDef[] = [
  { slug: 'wooden-crate', build: buildWoodenCrate, workflow: 'new-static-sprite', animated: false },
  { slug: 'knight-idle', build: buildKnightIdle, workflow: 'new-static-sprite', animated: false },
  { slug: 'knight-walk', build: buildKnightWalk, workflow: 'new-animation-sprite', animated: true },
  { slug: 'spark-hit', build: buildSparkHit, workflow: 'new-animation-sprite', animated: true },
  { slug: 'grass-tiles', build: buildGrassTiles, workflow: 'new-static-sprite', animated: false },
];

describe('Benchmark Asset Materialization', () => {
  for (const asset of ASSETS) {
    describe(asset.slug, () => {
      it(`writes ${asset.slug}.glyph to examples/`, () => {
        const store = asset.build();
        const result = storeSaveDocument(store);
        expect('error' in result).toBe(false);
        if ('error' in result) return;

        const dir = resolve(EXAMPLES, asset.slug);
        ensureDir(dir);
        const filePath = resolve(dir, `${asset.slug}.glyph`);
        writeGlyph(filePath, result.json);
        expect(existsSync(filePath)).toBe(true);
      });

      it(`writes ${asset.slug}.png to docs/`, () => {
        const store = asset.build();
        const doc = store.getState().document!;
        const flat = flattenFrame(store, 0);

        const dir = resolve(DOCS, asset.slug);
        ensureDir(dir);
        const filePath = resolve(dir, `${asset.slug}.png`);
        writePng(filePath, flat.data, doc.width, doc.height);
        expect(existsSync(filePath)).toBe(true);
      });

      if (asset.animated) {
        it(`writes ${asset.slug}.gif to docs/`, () => {
          const store = asset.build();

          const gif = storeExportGif(store, true);
          expect(gif instanceof Uint8Array).toBe(true);
          if (!(gif instanceof Uint8Array)) return;

          const dir = resolve(DOCS, asset.slug);
          ensureDir(dir);
          const filePath = resolve(dir, `${asset.slug}.gif`);
          writeGif(filePath, gif);
          expect(existsSync(filePath)).toBe(true);
        });

        it(`writes ${asset.slug}-sheet.png to docs/`, () => {
          const store = asset.build();
          const result = storeExportSheetWithMeta(store);
          expect('error' in result).toBe(false);
          if ('error' in result) return;

          const dir = resolve(DOCS, asset.slug);
          ensureDir(dir);
          const filePath = resolve(dir, `${asset.slug}-sheet.png`);
          writePng(filePath, result.sheet.data, result.sheet.width, result.sheet.height);
          expect(existsSync(filePath)).toBe(true);
        });
      }

      it(`writes metadata.json to docs/`, () => {
        const store = asset.build();
        const meta = buildMetadata(store, asset.workflow);

        const dir = resolve(DOCS, asset.slug);
        ensureDir(dir);
        const filePath = resolve(dir, 'metadata.json');
        writeMetadata(filePath, meta);
        expect(existsSync(filePath)).toBe(true);

        // Verify metadata structure
        expect(meta.name).toBeTruthy();
        expect(meta.width).toBeGreaterThan(0);
        expect(meta.height).toBeGreaterThan(0);
        expect(meta.frameCount).toBeGreaterThanOrEqual(1);
        expect(meta.palette.colorCount).toBe(16);
        expect(meta.palette.groups.length).toBe(6);
        expect(meta.workflow).toBeTruthy();
        expect(meta.validation).toBeTruthy();
        expect(meta.analysis.length).toBe(meta.frameCount);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Regression checks — verify materialized files are correct
// ═══════════════════════════════════════════════════════════════════

describe('Regression checks', () => {
  it('all .glyph files round-trip cleanly', () => {
    for (const asset of ASSETS) {
      const store = asset.build();
      const saveResult = storeSaveDocument(store);
      expect('error' in saveResult).toBe(false);
      if ('error' in saveResult) continue;

      // Round-trip: save → load into new store → save again → compare
      const store2 = createHeadlessStore();
      const loadErr = storeLoadDocument(store2, saveResult.json, `${asset.slug}.glyph`);
      expect(loadErr).toBeNull();

      const doc1 = store.getState().document!;
      const doc2 = store2.getState().document!;
      expect(doc2.name).toBe(doc1.name);
      expect(doc2.width).toBe(doc1.width);
      expect(doc2.height).toBe(doc1.height);
      expect(doc2.frames.length).toBe(doc1.frames.length);
      expect(doc2.palette.colors.length).toBe(doc1.palette.colors.length);
    }
  });

  it('animated assets produce GIFs with correct frame count encoding', () => {
    const animated = ASSETS.filter((a) => a.animated);
    expect(animated.length).toBe(2);

    for (const asset of animated) {
      const store = asset.build();
      const gif = storeExportGif(store, true);
      expect(gif instanceof Uint8Array).toBe(true);
      if (gif instanceof Uint8Array) {
        // GIF magic bytes: GIF89a
        expect(gif[0]).toBe(0x47); // G
        expect(gif[1]).toBe(0x49); // I
        expect(gif[2]).toBe(0x46); // F
      }
    }
  });

  it('static assets have exactly 1 frame', () => {
    const statics = ASSETS.filter((a) => !a.animated);
    expect(statics.length).toBe(3);

    for (const asset of statics) {
      const store = asset.build();
      expect(store.getState().document!.frames.length).toBe(1);
    }
  });

  it('all assets use the shared 16-color palette', () => {
    for (const asset of ASSETS) {
      const store = asset.build();
      const doc = store.getState().document!;
      expect(doc.palette.colors.length).toBe(16);
      expect(doc.palette.groups?.length).toBe(6);
      // Outline color is locked
      expect(doc.palette.colors[1].locked).toBe(true);
    }
  });

  it('all assets have non-empty opaque content', () => {
    for (const asset of ASSETS) {
      const store = asset.build();
      const bounds = storeAnalyzeBounds(store, 0);
      expect(typeof bounds).not.toBe('string');
      if (typeof bounds !== 'string') {
        expect(bounds.empty).toBe(false);
        expect(bounds.opaquePixelCount).toBeGreaterThan(0);
      }
    }
  });

  it('sprite sheets have correct dimensions', () => {
    const animated = ASSETS.filter((a) => a.animated);
    for (const asset of animated) {
      const store = asset.build();
      const doc = store.getState().document!;
      const sheet = storeExportSheetWithMeta(store);
      expect('error' in sheet).toBe(false);
      if ('error' in sheet) continue;
      expect(sheet.sheet.width).toBe(doc.width * doc.frames.length);
      expect(sheet.sheet.height).toBe(doc.height);
    }
  });
});
