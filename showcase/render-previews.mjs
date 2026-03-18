#!/usr/bin/env node
/**
 * Render showcase pixel art as upscaled PNG preview images.
 *
 * Uses raw Canvas API via node-canvas-like approach — but since we
 * want zero native deps, we generate PPM (Portable Pixel Map) files
 * that can be viewed directly or converted to PNG with any tool.
 *
 * Output: showcase/previews/*.ppm (8x upscaled, nearest-neighbor)
 *
 * Run: node showcase/render-previews.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREVIEW_DIR = join(__dirname, 'previews');
const SCALE = 8;

mkdirSync(PREVIEW_DIR, { recursive: true });

/**
 * Render RGBA pixel data to an upscaled PPM file.
 * PPM P6 format: binary RGB, no alpha (composited over dark background).
 */
function renderPPM(pixelData, width, height, scale) {
  const outW = width * scale;
  const outH = height * scale;
  // Dark checkerboard background for transparency
  const BG_DARK = [40, 40, 40];
  const BG_LIGHT = [50, 50, 50];
  const CHECKER_SIZE = scale; // One checker square per source pixel

  const header = `P6\n${outW} ${outH}\n255\n`;
  const pixels = Buffer.alloc(outW * outH * 3);

  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      const sx = Math.floor(ox / scale);
      const sy = Math.floor(oy / scale);
      const srcIdx = (sy * width + sx) * 4;

      const r = pixelData[srcIdx];
      const g = pixelData[srcIdx + 1];
      const b = pixelData[srcIdx + 2];
      const a = pixelData[srcIdx + 3] / 255;

      // Checkerboard background
      const checkerX = Math.floor(ox / CHECKER_SIZE);
      const checkerY = Math.floor(oy / CHECKER_SIZE);
      const bg = (checkerX + checkerY) % 2 === 0 ? BG_DARK : BG_LIGHT;

      // Alpha composite over background
      const outR = Math.round(r * a + bg[0] * (1 - a));
      const outG = Math.round(g * a + bg[1] * (1 - a));
      const outB = Math.round(b * a + bg[2] * (1 - a));

      const outIdx = (oy * outW + ox) * 3;
      pixels[outIdx] = outR;
      pixels[outIdx + 1] = outG;
      pixels[outIdx + 2] = outB;
    }
  }

  return Buffer.concat([Buffer.from(header, 'ascii'), pixels]);
}

/**
 * Render a composite strip of multiple frames side by side.
 */
function renderStripPPM(parts, frameWidth, frameHeight, scale) {
  const count = parts.length;
  const GAP = 2; // pixel gap between frames
  const outW = (frameWidth * count + GAP * (count - 1)) * scale;
  const outH = frameHeight * scale;
  const BG_DARK = [40, 40, 40];
  const BG_LIGHT = [50, 50, 50];
  const GAP_COLOR = [30, 30, 30];
  const CHECKER_SIZE = scale;

  const header = `P6\n${outW} ${outH}\n255\n`;
  const pixels = Buffer.alloc(outW * outH * 3);

  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      // Determine which frame this pixel belongs to
      const totalFrameW = (frameWidth + GAP) * scale;
      const frameIdx = Math.floor(ox / totalFrameW);
      const localX = ox - frameIdx * totalFrameW;

      // Check if in gap region
      if (localX >= frameWidth * scale) {
        const outIdx = (oy * outW + ox) * 3;
        pixels[outIdx] = GAP_COLOR[0];
        pixels[outIdx + 1] = GAP_COLOR[1];
        pixels[outIdx + 2] = GAP_COLOR[2];
        continue;
      }

      if (frameIdx >= count) {
        continue;
      }

      const part = parts[frameIdx];
      const sx = Math.floor(localX / scale);
      const sy = Math.floor(oy / scale);
      const srcIdx = (sy * frameWidth + sx) * 4;

      const r = part.pixelData[srcIdx];
      const g = part.pixelData[srcIdx + 1];
      const b = part.pixelData[srcIdx + 2];
      const a = part.pixelData[srcIdx + 3] / 255;

      const checkerX = Math.floor(ox / CHECKER_SIZE);
      const checkerY = Math.floor(oy / CHECKER_SIZE);
      const bg = (checkerX + checkerY) % 2 === 0 ? BG_DARK : BG_LIGHT;

      const outR = Math.round(r * a + bg[0] * (1 - a));
      const outG = Math.round(g * a + bg[1] * (1 - a));
      const outB = Math.round(b * a + bg[2] * (1 - a));

      const outIdx = (oy * outW + ox) * 3;
      pixels[outIdx] = outR;
      pixels[outIdx + 1] = outG;
      pixels[outIdx + 2] = outB;
    }
  }

  return Buffer.concat([Buffer.from(header, 'ascii'), pixels]);
}

// ── Load showcase data ──

function loadShowcase(name) {
  return JSON.parse(readFileSync(join(__dirname, `${name}.interchange.json`), 'utf8'));
}

console.log('Rendering showcase previews...');

// 1. Crystal Gem — single still
const gem = loadShowcase('still-sprite');
const gemPart = gem.parts[0];
const gemPPM = renderPPM(gemPart.pixelData, gemPart.width, gemPart.height, SCALE);
writeFileSync(join(PREVIEW_DIR, 'hero-still.ppm'), gemPPM);
console.log('  ✓ hero-still.ppm (Crystal Gem, 128x128)');

// 2. Flickering Flame — 4-frame animation strip
const flame = loadShowcase('loop-animation');
const flameStrip = renderStripPPM(flame.parts, 16, 16, SCALE);
writeFileSync(join(PREVIEW_DIR, 'hero-animation.ppm'), flameStrip);
console.log(`  ✓ hero-animation.ppm (Flame loop, ${flame.parts.length} frames)`);

// 3. Shield Variants — base shown as single
const shield = loadShowcase('variant-family');
const shieldPart = shield.parts[0];
const shieldPPM = renderPPM(shieldPart.pixelData, shieldPart.width, shieldPart.height, SCALE);
writeFileSync(join(PREVIEW_DIR, 'hero-variants.ppm'), shieldPPM);
console.log('  ✓ hero-variants.ppm (Shield base, 128x128)');

// 4. Game UI Kit — parts strip
const pack = loadShowcase('pack-project');
// Render each part individually since they are different sizes
for (const part of pack.parts) {
  const ppm = renderPPM(part.pixelData, part.width, part.height, SCALE);
  const safeName = part.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  writeFileSync(join(PREVIEW_DIR, `part-${safeName}.ppm`), ppm);
  console.log(`  ✓ part-${safeName}.ppm (${part.name}, ${part.width * SCALE}x${part.height * SCALE})`);
}

console.log('Done. Preview files in showcase/previews/');
console.log('');
console.log('To convert to PNG (if ImageMagick available):');
console.log('  convert showcase/previews/hero-still.ppm showcase/previews/hero-still.png');
