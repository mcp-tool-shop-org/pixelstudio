#!/usr/bin/env node
/**
 * Showcase generator — builds canonical interchange files with real pixel art.
 *
 * Each showcase proves a different GlyphStudio workflow:
 * 1. Still Sprite — clean standalone asset with palette use
 * 2. Loop Animation — motion cycle with varied timing
 * 3. Variant Family — base + palette variants + document variants
 * 4. Template/Pack — reusable structure as project start
 *
 * Run: node showcase/generate.mjs
 * Output: showcase/*.interchange.json
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Color definitions ──

const T = [0, 0, 0, 0];           // Transparent
const BLK = [34, 32, 52, 255];    // Dark outline
const WHT = [255, 255, 255, 255]; // White highlight

// Gem palette
const GEM_DEEP = [48, 96, 130, 255];     // Deep blue
const GEM_MID = [91, 110, 225, 255];     // Mid blue
const GEM_LIGHT = [99, 155, 255, 255];   // Light blue
const GEM_SHINE = [203, 219, 252, 255];  // Ice highlight

// Flame palette
const FLAME_RED = [172, 50, 50, 255];
const FLAME_ORANGE = [223, 113, 38, 255];
const FLAME_YELLOW = [251, 242, 54, 255];
const FLAME_TIP = [255, 255, 200, 255];
const FLAME_CORE = [217, 160, 102, 255];
const EMBER = [102, 57, 49, 255];

// Shield palette
const METAL_DARK = [89, 86, 82, 255];
const METAL_MID = [155, 173, 183, 255];
const METAL_LIGHT = [203, 219, 252, 255];
const WOOD_DARK = [102, 57, 49, 255];
const WOOD_MID = [143, 86, 59, 255];
const WOOD_LIGHT = [217, 160, 102, 255];
const CREST_GOLD = [251, 242, 54, 255];
const CREST_RED = [172, 50, 50, 255];

// Part colors
const PART_GREEN = [106, 190, 48, 255];
const PART_TEAL = [55, 148, 110, 255];
const PART_SKY = [95, 205, 228, 255];

// ── Pixel art helpers ──

/**
 * Build pixel data from a 2D color map.
 * @param {number[][]} rows - Array of rows, each row is array of RGBA pixels
 * @returns {number[]} Flat RGBA pixel data
 */
function buildPixels(rows) {
  return rows.flat(2);
}

/**
 * Create a blank canvas of transparent pixels.
 */
function blankCanvas(w, h) {
  return Array(h).fill(null).map(() => Array(w).fill(T));
}

/**
 * Draw into a canvas at (x, y) from a pattern.
 */
function stamp(canvas, pattern, ox, oy) {
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern[y].length; x++) {
      const px = pattern[y][x];
      if (px !== T && px[3] > 0) {
        canvas[oy + y][ox + x] = px;
      }
    }
  }
  return canvas;
}

// ── 1. Still Sprite: Crystal Gem (16x16) ──

const gemRows = [
  [T,T,T,T,T,T, BLK,BLK,BLK,BLK, T,T,T,T,T,T],
  [T,T,T,T,T, BLK,GEM_SHINE,GEM_LIGHT,GEM_LIGHT,GEM_SHINE,BLK, T,T,T,T,T],
  [T,T,T,T, BLK,GEM_SHINE,GEM_LIGHT,GEM_MID,GEM_MID,GEM_LIGHT,GEM_SHINE,BLK, T,T,T,T],
  [T,T,T, BLK,GEM_LIGHT,GEM_LIGHT,GEM_MID,GEM_MID,GEM_MID,GEM_MID,GEM_LIGHT,GEM_LIGHT,BLK, T,T,T],
  [T,T, BLK,GEM_LIGHT,GEM_MID,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_MID,GEM_MID,GEM_LIGHT,BLK, T,T],
  [T, BLK,GEM_SHINE,GEM_LIGHT,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_MID,GEM_LIGHT,GEM_SHINE,BLK, T],
  [BLK,GEM_SHINE,GEM_LIGHT,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_MID,GEM_LIGHT,GEM_SHINE,BLK],
  [BLK,GEM_LIGHT,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_MID,GEM_LIGHT,BLK],
  [T, BLK,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_MID,BLK, T],
  [T,T, BLK,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_MID,BLK, T,T],
  [T,T,T, BLK,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_MID,BLK, T,T,T],
  [T,T,T,T, BLK,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_DEEP,GEM_MID,BLK, T,T,T,T],
  [T,T,T,T,T, BLK,GEM_MID,GEM_DEEP,GEM_DEEP,GEM_MID,BLK, T,T,T,T,T],
  [T,T,T,T,T,T, BLK,GEM_DEEP,GEM_DEEP,BLK, T,T,T,T,T,T],
  [T,T,T,T,T,T,T, BLK,BLK, T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
];

const GEM_PALETTE = [
  { rgba: T, name: 'Transparent' },
  { rgba: BLK, name: 'Outline' },
  { rgba: GEM_DEEP, name: 'Gem Deep' },
  { rgba: GEM_MID, name: 'Gem Mid' },
  { rgba: GEM_LIGHT, name: 'Gem Light' },
  { rgba: GEM_SHINE, name: 'Gem Shine' },
  { rgba: WHT, name: 'White' },
];

// ── 2. Loop Animation: Flame (16x16, 4 frames) ──

const flameFrame1 = [
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T, FLAME_TIP,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T, FLAME_TIP,FLAME_YELLOW,FLAME_TIP,T,T,T,T,T,T,T],
  [T,T,T,T,T,T, FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,T,T,T,T,T,T,T],
  [T,T,T,T,T, FLAME_YELLOW,FLAME_YELLOW,FLAME_TIP,FLAME_YELLOW,FLAME_YELLOW,T,T,T,T,T,T],
  [T,T,T,T,T, FLAME_ORANGE,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_ORANGE,T,T,T,T,T,T],
  [T,T,T,T, FLAME_ORANGE,FLAME_ORANGE,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_ORANGE,FLAME_ORANGE,T,T,T,T,T],
  [T,T,T,T, FLAME_RED,FLAME_ORANGE,FLAME_ORANGE,FLAME_YELLOW,FLAME_ORANGE,FLAME_ORANGE,FLAME_RED,T,T,T,T,T],
  [T,T,T, FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_RED,FLAME_RED,T,T,T,T],
  [T,T,T, FLAME_RED,FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_CORE,FLAME_ORANGE,FLAME_RED,FLAME_RED,FLAME_RED,T,T,T,T],
  [T,T,T,T, FLAME_RED,FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_RED,FLAME_RED,FLAME_RED,T,T,T,T,T],
  [T,T,T,T, EMBER,FLAME_RED,FLAME_RED,FLAME_RED,FLAME_RED,FLAME_RED,EMBER,T,T,T,T,T],
  [T,T,T,T,T, EMBER,FLAME_RED,FLAME_RED,FLAME_RED,EMBER,T,T,T,T,T,T],
  [T,T,T,T,T, EMBER,EMBER,FLAME_RED,EMBER,EMBER,T,T,T,T,T,T],
  [T,T,T,T,T,T, EMBER,EMBER,EMBER,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T, EMBER,T,T,T,T,T,T,T,T],
];

const flameFrame2 = [
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T, FLAME_TIP,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T, FLAME_TIP,FLAME_YELLOW,T,T,T,T,T,T,T],
  [T,T,T,T,T,T, FLAME_YELLOW,FLAME_YELLOW,FLAME_TIP,T,T,T,T,T,T,T],
  [T,T,T,T,T, FLAME_TIP,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,T,T,T,T,T,T,T],
  [T,T,T,T, FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_TIP,FLAME_YELLOW,FLAME_YELLOW,T,T,T,T,T,T],
  [T,T,T,T, FLAME_ORANGE,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_ORANGE,T,T,T,T,T,T],
  [T,T,T, FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_YELLOW,FLAME_YELLOW,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,T,T,T,T,T],
  [T,T,T, FLAME_RED,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_YELLOW,FLAME_ORANGE,FLAME_ORANGE,FLAME_RED,T,T,T,T,T],
  [T,T,T, FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_ORANGE,FLAME_CORE,FLAME_ORANGE,FLAME_RED,FLAME_RED,T,T,T,T,T],
  [T,T,T,T, FLAME_RED,FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_RED,FLAME_RED,FLAME_RED,T,T,T,T,T],
  [T,T,T,T,T, FLAME_RED,FLAME_RED,FLAME_RED,FLAME_RED,FLAME_RED,T,T,T,T,T,T],
  [T,T,T,T,T, EMBER,FLAME_RED,FLAME_RED,FLAME_RED,EMBER,T,T,T,T,T,T],
  [T,T,T,T,T,T, EMBER,FLAME_RED,EMBER,T,T,T,T,T,T,T],
  [T,T,T,T,T,T, EMBER,EMBER,EMBER,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T, EMBER,T,T,T,T,T,T,T,T],
];

const flameFrame3 = [
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T, FLAME_TIP,FLAME_TIP,T,T,T,T,T,T,T,T],
  [T,T,T,T,T, FLAME_TIP,FLAME_YELLOW,FLAME_YELLOW,FLAME_TIP,T,T,T,T,T,T,T],
  [T,T,T,T,T, FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,T,T,T,T,T,T,T],
  [T,T,T,T, FLAME_YELLOW,FLAME_YELLOW,FLAME_TIP,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,T,T,T,T,T,T],
  [T,T,T,T, FLAME_ORANGE,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_ORANGE,T,T,T,T,T,T],
  [T,T,T, FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_YELLOW,FLAME_YELLOW,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,T,T,T,T,T],
  [T,T,T, FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_RED,T,T,T,T,T],
  [T,T,T, FLAME_RED,FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_CORE,FLAME_ORANGE,FLAME_RED,FLAME_RED,FLAME_RED,T,T,T,T],
  [T,T,T,T, FLAME_RED,FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_RED,FLAME_RED,FLAME_RED,T,T,T,T,T],
  [T,T,T,T, EMBER,FLAME_RED,FLAME_RED,FLAME_RED,FLAME_RED,FLAME_RED,EMBER,T,T,T,T,T],
  [T,T,T,T,T, EMBER,FLAME_RED,FLAME_RED,FLAME_RED,EMBER,T,T,T,T,T,T],
  [T,T,T,T,T, EMBER,EMBER,EMBER,EMBER,EMBER,T,T,T,T,T,T],
  [T,T,T,T,T,T, EMBER,EMBER,EMBER,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T, EMBER,T,T,T,T,T,T,T,T],
];

// Frame 4 = slight variation of frame 1 for smooth loop
const flameFrame4 = [
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T, FLAME_TIP,T,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T, FLAME_TIP,FLAME_YELLOW,T,T,T,T,T,T,T,T],
  [T,T,T,T,T, FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,T,T,T,T,T,T,T,T],
  [T,T,T,T,T, FLAME_YELLOW,FLAME_TIP,FLAME_YELLOW,FLAME_YELLOW,T,T,T,T,T,T,T],
  [T,T,T,T, FLAME_ORANGE,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_ORANGE,FLAME_YELLOW,T,T,T,T,T,T],
  [T,T,T,T, FLAME_ORANGE,FLAME_ORANGE,FLAME_YELLOW,FLAME_YELLOW,FLAME_YELLOW,FLAME_ORANGE,FLAME_ORANGE,T,T,T,T,T],
  [T,T,T, FLAME_RED,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_YELLOW,FLAME_ORANGE,FLAME_ORANGE,FLAME_RED,T,T,T,T,T],
  [T,T,T, FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_ORANGE,FLAME_RED,FLAME_RED,FLAME_RED,T,T,T,T],
  [T,T,T,T, FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_CORE,FLAME_ORANGE,FLAME_RED,FLAME_RED,T,T,T,T,T],
  [T,T,T,T, FLAME_RED,FLAME_RED,FLAME_RED,FLAME_ORANGE,FLAME_RED,FLAME_RED,FLAME_RED,T,T,T,T,T],
  [T,T,T,T, EMBER,FLAME_RED,FLAME_RED,FLAME_RED,FLAME_RED,FLAME_RED,EMBER,T,T,T,T,T],
  [T,T,T,T,T, EMBER,EMBER,FLAME_RED,EMBER,EMBER,T,T,T,T,T,T],
  [T,T,T,T,T,T, EMBER,EMBER,EMBER,T,T,T,T,T,T,T],
  [T,T,T,T,T,T, EMBER,EMBER,T,T,T,T,T,T,T,T],
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
];

const FLAME_PALETTE = [
  { rgba: T, name: 'Transparent' },
  { rgba: EMBER, name: 'Ember' },
  { rgba: FLAME_RED, name: 'Flame Red' },
  { rgba: FLAME_ORANGE, name: 'Flame Orange' },
  { rgba: FLAME_CORE, name: 'Flame Core' },
  { rgba: FLAME_YELLOW, name: 'Flame Yellow' },
  { rgba: FLAME_TIP, name: 'Flame Tip' },
];

// ── 3. Variant Family: Shield (16x16) ──

const shieldBase = [
  [T,T,T,T, BLK,BLK,BLK,BLK,BLK,BLK,BLK,BLK, T,T,T,T],
  [T,T,T, BLK,METAL_LIGHT,METAL_LIGHT,METAL_MID,METAL_MID,METAL_MID,METAL_MID,METAL_LIGHT,METAL_LIGHT,BLK, T,T,T],
  [T,T, BLK,METAL_LIGHT,METAL_MID,METAL_MID,METAL_MID,METAL_MID,METAL_MID,METAL_MID,METAL_MID,METAL_MID,METAL_LIGHT,BLK, T,T],
  [T, BLK,METAL_LIGHT,METAL_MID,WOOD_LIGHT,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_LIGHT,METAL_MID,METAL_LIGHT,BLK, T],
  [T, BLK,METAL_MID,WOOD_LIGHT,WOOD_MID,WOOD_MID,WOOD_MID,CREST_GOLD,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_LIGHT,METAL_MID,BLK, T],
  [BLK,METAL_MID,WOOD_LIGHT,WOOD_MID,WOOD_MID,WOOD_MID,CREST_GOLD,CREST_RED,CREST_GOLD,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_LIGHT,METAL_MID,BLK],
  [BLK,METAL_MID,WOOD_MID,WOOD_MID,WOOD_MID,CREST_GOLD,CREST_RED,CREST_RED,CREST_RED,CREST_GOLD,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,METAL_MID,BLK],
  [BLK,METAL_MID,WOOD_MID,WOOD_MID,WOOD_MID,CREST_GOLD,CREST_RED,CREST_RED,CREST_RED,CREST_GOLD,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,METAL_MID,BLK],
  [BLK,METAL_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,CREST_GOLD,CREST_RED,CREST_GOLD,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,METAL_MID,BLK],
  [T, BLK,METAL_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,CREST_GOLD,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,METAL_MID,BLK, T],
  [T, BLK,METAL_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,METAL_MID,BLK, T],
  [T,T, BLK,METAL_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,WOOD_MID,METAL_MID,BLK, T,T],
  [T,T,T, BLK,METAL_MID,WOOD_MID,WOOD_DARK,WOOD_DARK,WOOD_DARK,WOOD_MID,WOOD_MID,METAL_MID,BLK, T,T,T],
  [T,T,T,T, BLK,METAL_MID,WOOD_MID,WOOD_DARK,WOOD_MID,METAL_MID,METAL_MID,BLK, T,T,T,T],
  [T,T,T,T,T, BLK,METAL_MID,METAL_MID,METAL_MID,METAL_MID,BLK, T,T,T,T,T],
  [T,T,T,T,T,T, BLK,BLK,BLK,BLK, T,T,T,T,T,T],
];

const SHIELD_PALETTE = [
  { rgba: T, name: 'Transparent' },
  { rgba: BLK, name: 'Outline' },
  { rgba: METAL_DARK, name: 'Metal Dark' },
  { rgba: METAL_MID, name: 'Metal Mid' },
  { rgba: METAL_LIGHT, name: 'Metal Light' },
  { rgba: WOOD_DARK, name: 'Wood Dark' },
  { rgba: WOOD_MID, name: 'Wood Mid' },
  { rgba: WOOD_LIGHT, name: 'Wood Light' },
  { rgba: CREST_GOLD, name: 'Crest Gold' },
  { rgba: CREST_RED, name: 'Crest Red' },
  { rgba: WHT, name: 'White' },
];

// Fire variant palette: replace wood browns with warm reds, crest stays gold
const FIRE_PALETTE = SHIELD_PALETTE.map((c) => {
  const remap = {
    'Wood Dark': { rgba: [120, 30, 30, 255] },
    'Wood Mid': { rgba: [172, 50, 50, 255] },
    'Wood Light': { rgba: [223, 113, 38, 255] },
    'Metal Mid': { rgba: [180, 160, 140, 255] },
    'Metal Light': { rgba: [220, 200, 180, 255] },
    'Crest Red': { rgba: [251, 242, 54, 255] },
  };
  if (c.name && remap[c.name]) {
    return { rgba: remap[c.name].rgba, name: c.name };
  }
  return c;
});

// Ice variant palette: replace wood browns with cool blues
const ICE_PALETTE = SHIELD_PALETTE.map((c) => {
  const remap = {
    'Wood Dark': { rgba: [30, 60, 120, 255] },
    'Wood Mid': { rgba: [48, 96, 160, 255] },
    'Wood Light': { rgba: [91, 140, 225, 255] },
    'Metal Mid': { rgba: [140, 160, 200, 255] },
    'Metal Light': { rgba: [180, 200, 240, 255] },
    'Crest Gold': { rgba: [203, 219, 252, 255] },
    'Crest Red': { rgba: [95, 205, 228, 255] },
  };
  if (c.name && remap[c.name]) {
    return { rgba: remap[c.name].rgba, name: c.name };
  }
  return c;
});

// ── 4. Reusable parts for pack showcase ──

// 8x8 star shape
const starPattern = [
  [T,T,T, CREST_GOLD,CREST_GOLD, T,T,T],
  [T,T, CREST_GOLD,CREST_GOLD,CREST_GOLD,CREST_GOLD, T,T],
  [CREST_GOLD,CREST_GOLD,CREST_GOLD,WHT,WHT,CREST_GOLD,CREST_GOLD,CREST_GOLD],
  [T, CREST_GOLD,CREST_GOLD,CREST_GOLD,CREST_GOLD,CREST_GOLD,CREST_GOLD, T],
  [T, CREST_GOLD,CREST_GOLD,CREST_GOLD,CREST_GOLD,CREST_GOLD,CREST_GOLD, T],
  [CREST_GOLD,CREST_GOLD,CREST_GOLD,WHT,WHT,CREST_GOLD,CREST_GOLD,CREST_GOLD],
  [T,T, CREST_GOLD,CREST_GOLD,CREST_GOLD,CREST_GOLD, T,T],
  [T,T,T, CREST_GOLD,CREST_GOLD, T,T,T],
];

// 6x6 heart
const heartPattern = [
  [T, CREST_RED,CREST_RED, T, CREST_RED,CREST_RED],
  [CREST_RED,FLAME_ORANGE,CREST_RED,CREST_RED,FLAME_ORANGE,CREST_RED],
  [CREST_RED,CREST_RED,CREST_RED,CREST_RED,CREST_RED,CREST_RED],
  [T, CREST_RED,CREST_RED,CREST_RED,CREST_RED, T],
  [T,T, CREST_RED,CREST_RED, T,T],
  [T,T,T, CREST_RED, T,T],
];

// 5x5 coin
const coinPattern = [
  [T, CREST_GOLD,CREST_GOLD,CREST_GOLD, T],
  [CREST_GOLD,WOOD_LIGHT,CREST_GOLD,WOOD_MID,CREST_GOLD],
  [CREST_GOLD,CREST_GOLD,WHT,CREST_GOLD,CREST_GOLD],
  [CREST_GOLD,WOOD_MID,CREST_GOLD,WOOD_LIGHT,CREST_GOLD],
  [T, CREST_GOLD,CREST_GOLD,CREST_GOLD, T],
];

// ── Build interchange files ──

const FORMAT = 'glyphstudio-interchange';
const VERSION = 1;
const NOW = '2026-03-18T00:00:00.000Z';

// 1. Still Sprite
const stillSprite = {
  format: FORMAT,
  version: VERSION,
  contentType: 'template',
  exportedAt: NOW,
  template: {
    name: 'Crystal Gem',
    canvasWidth: 16,
    canvasHeight: 16,
    palette: GEM_PALETTE,
  },
  // Include the pixel data as a part so the showcase has actual content
  parts: [{
    id: 'showcase-gem-16x16',
    name: 'Crystal Gem 16x16',
    width: 16,
    height: 16,
    pixelData: buildPixels(gemRows),
    tags: ['showcase', 'gem', 'still'],
  }],
};

// 2. Loop Animation
const loopAnimation = {
  format: FORMAT,
  version: VERSION,
  contentType: 'template',
  exportedAt: NOW,
  template: {
    name: 'Flickering Flame',
    canvasWidth: 16,
    canvasHeight: 16,
    palette: FLAME_PALETTE,
    frameCount: 4,
    frameDurationMs: 120,
  },
  // Frames as parts for showcase reference
  parts: [
    {
      id: 'showcase-flame-f1',
      name: 'Flame Frame 1',
      width: 16, height: 16,
      pixelData: buildPixels(flameFrame1),
      tags: ['showcase', 'flame', 'animation'],
    },
    {
      id: 'showcase-flame-f2',
      name: 'Flame Frame 2',
      width: 16, height: 16,
      pixelData: buildPixels(flameFrame2),
      tags: ['showcase', 'flame', 'animation'],
    },
    {
      id: 'showcase-flame-f3',
      name: 'Flame Frame 3',
      width: 16, height: 16,
      pixelData: buildPixels(flameFrame3),
      tags: ['showcase', 'flame', 'animation'],
    },
    {
      id: 'showcase-flame-f4',
      name: 'Flame Frame 4',
      width: 16, height: 16,
      pixelData: buildPixels(flameFrame4),
      tags: ['showcase', 'flame', 'animation'],
    },
  ],
};

// 3. Variant Family
const variantFamily = {
  format: FORMAT,
  version: VERSION,
  contentType: 'template',
  exportedAt: NOW,
  template: {
    name: 'Shield Variants',
    canvasWidth: 16,
    canvasHeight: 16,
    palette: SHIELD_PALETTE,
  },
  paletteSets: [
    { id: 'showcase-ps-fire', name: 'Fire', colors: FIRE_PALETTE },
    { id: 'showcase-ps-ice', name: 'Ice', colors: ICE_PALETTE },
  ],
  parts: [{
    id: 'showcase-shield-base',
    name: 'Shield Base 16x16',
    width: 16, height: 16,
    pixelData: buildPixels(shieldBase),
    tags: ['showcase', 'shield', 'variant'],
  }],
};

// 4. Template/Pack
const packProject = {
  format: FORMAT,
  version: VERSION,
  contentType: 'pack',
  exportedAt: NOW,
  pack: {
    name: 'Game UI Kit',
    description: 'Reusable UI elements for game sprites: star, heart, coin',
  },
  paletteSets: [
    {
      id: 'showcase-ps-warm-ui',
      name: 'Warm UI',
      colors: [
        { rgba: T, name: 'Transparent' },
        { rgba: CREST_GOLD, name: 'Gold' },
        { rgba: CREST_RED, name: 'Red' },
        { rgba: FLAME_ORANGE, name: 'Orange' },
        { rgba: WOOD_MID, name: 'Wood' },
        { rgba: WOOD_LIGHT, name: 'Wood Light' },
        { rgba: WHT, name: 'White' },
      ],
    },
  ],
  parts: [
    {
      id: 'showcase-star-8x8',
      name: 'Star 8x8',
      width: 8, height: 8,
      pixelData: buildPixels(starPattern),
      tags: ['ui', 'star', 'rating'],
    },
    {
      id: 'showcase-heart-6x6',
      name: 'Heart 6x6',
      width: 6, height: 6,
      pixelData: buildPixels(heartPattern),
      tags: ['ui', 'heart', 'health'],
    },
    {
      id: 'showcase-coin-5x5',
      name: 'Coin 5x5',
      width: 5, height: 5,
      pixelData: buildPixels(coinPattern),
      tags: ['ui', 'coin', 'currency'],
    },
  ],
};

// ── Write files ──

function writeShowcase(name, data) {
  const path = join(__dirname, `${name}.interchange.json`);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✓ ${path}`);
}

console.log('Generating showcase interchange files...');
writeShowcase('still-sprite', stillSprite);
writeShowcase('loop-animation', loopAnimation);
writeShowcase('variant-family', variantFamily);
writeShowcase('pack-project', packProject);
console.log('Done.');
