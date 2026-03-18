/**
 * Sample content — canonical templates and packs that ship with GlyphStudio.
 *
 * These prove the system works and give users meaningful starting points.
 * Not throwaway demos — production-grade starter materials.
 */

import type { SavedTemplate } from './templateLibrary';
import type { SavedPack } from './packLibrary';
import { INTERCHANGE_FORMAT, INTERCHANGE_VERSION } from './interchange';

// ── Sample palette: Pixel Art Essentials ──

const PIXEL_ART_PALETTE = [
  { rgba: [0, 0, 0, 0] as [number, number, number, number], name: 'Transparent' },
  { rgba: [0, 0, 0, 255] as [number, number, number, number], name: 'Black' },
  { rgba: [34, 32, 52, 255] as [number, number, number, number], name: 'Dark Purple' },
  { rgba: [69, 40, 60, 255] as [number, number, number, number], name: 'Dark Red' },
  { rgba: [102, 57, 49, 255] as [number, number, number, number], name: 'Brown' },
  { rgba: [143, 86, 59, 255] as [number, number, number, number], name: 'Tan' },
  { rgba: [223, 113, 38, 255] as [number, number, number, number], name: 'Orange' },
  { rgba: [217, 160, 102, 255] as [number, number, number, number], name: 'Sand' },
  { rgba: [238, 195, 154, 255] as [number, number, number, number], name: 'Skin Light' },
  { rgba: [251, 242, 54, 255] as [number, number, number, number], name: 'Yellow' },
  { rgba: [153, 229, 80, 255] as [number, number, number, number], name: 'Green Light' },
  { rgba: [106, 190, 48, 255] as [number, number, number, number], name: 'Green' },
  { rgba: [55, 148, 110, 255] as [number, number, number, number], name: 'Teal' },
  { rgba: [75, 105, 47, 255] as [number, number, number, number], name: 'Green Dark' },
  { rgba: [82, 75, 36, 255] as [number, number, number, number], name: 'Olive' },
  { rgba: [50, 60, 57, 255] as [number, number, number, number], name: 'Dark Teal' },
  { rgba: [63, 63, 116, 255] as [number, number, number, number], name: 'Navy' },
  { rgba: [48, 96, 130, 255] as [number, number, number, number], name: 'Blue' },
  { rgba: [91, 110, 225, 255] as [number, number, number, number], name: 'Blue Light' },
  { rgba: [99, 155, 255, 255] as [number, number, number, number], name: 'Sky' },
  { rgba: [95, 205, 228, 255] as [number, number, number, number], name: 'Cyan' },
  { rgba: [203, 219, 252, 255] as [number, number, number, number], name: 'Ice' },
  { rgba: [255, 255, 255, 255] as [number, number, number, number], name: 'White' },
  { rgba: [155, 173, 183, 255] as [number, number, number, number], name: 'Gray Light' },
  { rgba: [105, 106, 106, 255] as [number, number, number, number], name: 'Gray' },
  { rgba: [89, 86, 82, 255] as [number, number, number, number], name: 'Gray Dark' },
];

// ── Warm/Cool palette set variants ──

const WARM_PALETTE = PIXEL_ART_PALETTE.map((c) => ({
  rgba: [
    Math.min(255, c.rgba[0] + 15),
    Math.max(0, c.rgba[1] - 5),
    Math.max(0, c.rgba[2] - 10),
    c.rgba[3],
  ] as [number, number, number, number],
  ...(c.name ? { name: c.name } : {}),
}));

const COOL_PALETTE = PIXEL_ART_PALETTE.map((c) => ({
  rgba: [
    Math.max(0, c.rgba[0] - 10),
    Math.max(0, c.rgba[1] - 5),
    Math.min(255, c.rgba[2] + 15),
    c.rgba[3],
  ] as [number, number, number, number],
  ...(c.name ? { name: c.name } : {}),
}));

// ── Sample parts: basic pixel shapes ──

/** 4x4 circle outline */
const CIRCLE_4X4: number[] = [
  0,0,0,0,  255,255,255,255,  255,255,255,255,  0,0,0,0,
  255,255,255,255,  0,0,0,0,  0,0,0,0,  255,255,255,255,
  255,255,255,255,  0,0,0,0,  0,0,0,0,  255,255,255,255,
  0,0,0,0,  255,255,255,255,  255,255,255,255,  0,0,0,0,
];

/** 4x4 diamond */
const DIAMOND_4X4: number[] = [
  0,0,0,0,  0,0,0,0,  200,200,200,255,  0,0,0,0,
  0,0,0,0,  200,200,200,255,  255,255,255,255,  200,200,200,255,
  200,200,200,255,  255,255,255,255,  255,255,255,255,  200,200,200,255,
  0,0,0,0,  200,200,200,255,  200,200,200,255,  0,0,0,0,
];

/** 4x6 arrow pointing right */
const ARROW_4X6: number[] = [
  0,0,0,0,  180,180,180,255,  0,0,0,0,  0,0,0,0,
  0,0,0,0,  180,180,180,255,  180,180,180,255,  0,0,0,0,
  180,180,180,255,  255,255,255,255,  255,255,255,255,  180,180,180,255,
  180,180,180,255,  255,255,255,255,  255,255,255,255,  180,180,180,255,
  0,0,0,0,  180,180,180,255,  180,180,180,255,  0,0,0,0,
  0,0,0,0,  180,180,180,255,  0,0,0,0,  0,0,0,0,
];

// ── Build interchange JSON strings ──

type PaletteColor = { rgba: [number, number, number, number]; name?: string };

function buildTemplateJson(opts: {
  name: string;
  width: number;
  height: number;
  frameCount?: number;
  frameDurationMs?: number;
  palette: PaletteColor[];
  paletteSets?: { name: string; colors: PaletteColor[] }[];
}): string {
  return JSON.stringify({
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    contentType: 'template',
    exportedAt: '2026-01-01T00:00:00.000Z',
    template: {
      name: opts.name,
      canvasWidth: opts.width,
      canvasHeight: opts.height,
      palette: opts.palette,
      ...(opts.frameCount ? { frameCount: opts.frameCount } : {}),
      ...(opts.frameDurationMs ? { frameDurationMs: opts.frameDurationMs } : {}),
    },
    ...(opts.paletteSets ? {
      paletteSets: opts.paletteSets.map((ps, i) => ({
        id: `sample-ps-${i}`,
        name: ps.name,
        colors: ps.colors,
      })),
    } : {}),
  });
}

function buildPackJson(opts: {
  name: string;
  description: string;
  paletteSets?: { name: string; colors: PaletteColor[] }[];
  parts?: { id: string; name: string; width: number; height: number; pixelData: number[]; tags?: string[] }[];
}): string {
  return JSON.stringify({
    format: INTERCHANGE_FORMAT,
    version: INTERCHANGE_VERSION,
    contentType: 'pack',
    exportedAt: '2026-01-01T00:00:00.000Z',
    pack: { name: opts.name, description: opts.description },
    ...(opts.paletteSets ? {
      paletteSets: opts.paletteSets.map((ps, i) => ({
        id: `pack-ps-${i}`,
        name: ps.name,
        colors: ps.colors,
      })),
    } : {}),
    ...(opts.parts ? { parts: opts.parts } : {}),
  });
}

// ── Exported sample content ──

/** Animation-ready template: 32x32, 4 frames at 100ms. */
export const SAMPLE_TEMPLATE_LOOP: SavedTemplate = {
  id: 'sample-tmpl-loop',
  name: 'Loop Starter',
  description: '32x32 animation loop with 4 frames at 100ms',
  canvasWidth: 32,
  canvasHeight: 32,
  interchangeJson: buildTemplateJson({
    name: 'Loop Starter',
    width: 32,
    height: 32,
    frameCount: 4,
    frameDurationMs: 100,
    palette: PIXEL_ART_PALETTE,
  }),
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Variant-ready template: 32x48 with Warm/Cool palette sets. */
export const SAMPLE_TEMPLATE_VARIANT: SavedTemplate = {
  id: 'sample-tmpl-variant',
  name: 'Character Variant Starter',
  description: '32x48 with Warm and Cool palette variants',
  canvasWidth: 32,
  canvasHeight: 48,
  interchangeJson: buildTemplateJson({
    name: 'Character Variant Starter',
    width: 32,
    height: 48,
    palette: PIXEL_ART_PALETTE,
    paletteSets: [
      { name: 'Warm', colors: WARM_PALETTE },
      { name: 'Cool', colors: COOL_PALETTE },
    ],
  }),
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Curated palette pack with Warm and Cool variants. */
export const SAMPLE_PACK_PALETTES: SavedPack = {
  id: 'sample-pack-palettes',
  name: 'Palette Essentials',
  description: 'Warm and Cool palette variants for quick recoloring',
  paletteSetCount: 2,
  partCount: 0,
  interchangeJson: buildPackJson({
    name: 'Palette Essentials',
    description: 'Warm and Cool palette variants for quick recoloring',
    paletteSets: [
      { name: 'Warm Shift', colors: WARM_PALETTE },
      { name: 'Cool Shift', colors: COOL_PALETTE },
    ],
  }),
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Reusable parts pack with basic pixel shapes. */
export const SAMPLE_PACK_PARTS: SavedPack = {
  id: 'sample-pack-parts',
  name: 'Shape Basics',
  description: 'Circle, diamond, and arrow stamps for quick construction',
  paletteSetCount: 0,
  partCount: 3,
  interchangeJson: buildPackJson({
    name: 'Shape Basics',
    description: 'Circle, diamond, and arrow stamps for quick construction',
    parts: [
      { id: 'sample-part-circle', name: 'Circle 4x4', width: 4, height: 4, pixelData: CIRCLE_4X4, tags: ['shape'] },
      { id: 'sample-part-diamond', name: 'Diamond 4x4', width: 4, height: 4, pixelData: DIAMOND_4X4, tags: ['shape'] },
      { id: 'sample-part-arrow', name: 'Arrow Right', width: 4, height: 6, pixelData: ARROW_4X6, tags: ['shape', 'ui'] },
    ],
  }),
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** All sample templates. */
export const SAMPLE_TEMPLATES: SavedTemplate[] = [
  SAMPLE_TEMPLATE_LOOP,
  SAMPLE_TEMPLATE_VARIANT,
];

/** All sample packs. */
export const SAMPLE_PACKS: SavedPack[] = [
  SAMPLE_PACK_PALETTES,
  SAMPLE_PACK_PARTS,
];

/** Seed IDs for checking if samples have already been added. */
export const SAMPLE_IDS = new Set([
  ...SAMPLE_TEMPLATES.map((t) => t.id),
  ...SAMPLE_PACKS.map((p) => p.id),
]);
