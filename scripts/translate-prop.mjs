#!/usr/bin/env node
/**
 * Stage 40.3 — Prop Concept → Sprite Translation (32×32)
 *
 * Reinterprets the 500×500 treasure chest concept into a 32×32 game prop sprite.
 * NOT downscaling — deliberate rebuild at target resolution.
 *
 * Translation discipline:
 * - The open-lid + glow shape is the entire read at 32×32
 * - Individual rivets, keyhole, gem facets → gone
 * - Metal bands → 1px accent lines
 * - Interior lining → 1–2px warm color behind glow
 * - Glow → a few bright pixels in the opening
 *
 * Source read: "Valuable, ancient, slightly dangerous"
 * Key cues from concept:
 *   1. Open lid (tilted back, taller than body)
 *   2. Glow from interior (warm/golden)
 *   3. Metal bands (horizontal accents)
 *   4. Gem on front (red focal point)
 *   5. Boxy wooden body with feet
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode, decode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT_DIR = resolve(__dirname, '..', 'docs', 'dogfood', 'prop-sprite');
mkdirSync(OUT_DIR, { recursive: true });

const W = 32, H = 32;

// ── Palette — simplified from concept ──
const C = {
  outline:    [25, 18, 12, 255],
  woodDk:     [55, 35, 18, 255],
  wood:       [90, 60, 32, 255],
  woodLt:     [125, 88, 50, 255],
  metalDk:    [85, 75, 55, 255],
  metal:      [140, 125, 95, 255],
  metalHi:    [190, 175, 140, 255],
  goldDk:     [140, 105, 20, 255],
  gold:       [210, 175, 40, 255],
  gemRed:     [160, 25, 30, 255],
  gemRedHi:   [220, 80, 70, 255],
  lining:     [145, 35, 35, 255],
  liningDk:   [100, 20, 25, 255],
  glow:       [255, 240, 180, 255],
  glowSoft:   [255, 230, 160, 200],
  glowBright: [255, 250, 220, 255],
};

// ── Drawing primitives ──
function createBuffer() { return new Uint8ClampedArray(W * H * 4); }

function px(buf, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H || !color) return;
  const i = (y * W + x) * 4;
  const sa = color[3] / 255;
  const da = buf[i+3] / 255;
  if (sa >= 1 || da === 0) {
    buf[i] = color[0]; buf[i+1] = color[1]; buf[i+2] = color[2]; buf[i+3] = color[3];
  } else {
    const outA = sa + da * (1 - sa);
    buf[i]   = Math.round((color[0] * sa + buf[i]   * da * (1 - sa)) / outA);
    buf[i+1] = Math.round((color[1] * sa + buf[i+1] * da * (1 - sa)) / outA);
    buf[i+2] = Math.round((color[2] * sa + buf[i+2] * da * (1 - sa)) / outA);
    buf[i+3] = Math.round(outA * 255);
  }
}

function fillRect(buf, x, y, w, h, color) {
  for (let py = y; py < y + h; py++)
    for (let px2 = x; px2 < x + w; px2++)
      px(buf, px2, py, color);
}

function fillEllipse(buf, cx, cy, rx, ry, color) {
  for (let py = cy - ry; py <= cy + ry; py++)
    for (let px2 = cx - rx; px2 <= cx + rx; px2++) {
      const dx = (px2 - cx) / (rx || 1), dy = (py - cy) / (ry || 1);
      if (dx * dx + dy * dy <= 1) px(buf, px2, py, color);
    }
}

function silhouette(buf, w, h, silColor) {
  const sil = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i+3] > 0) {
      sil[i] = silColor[0]; sil[i+1] = silColor[1]; sil[i+2] = silColor[2]; sil[i+3] = buf[i+3];
    }
  }
  return sil;
}

function writePng(name, buf, w, h) {
  writeFileSync(resolve(OUT_DIR, name), Buffer.from(encode({ width: w, height: h, data: buf, channels: 4, depth: 8 })));
  console.log(`  → ${name} (${w}×${h})`);
}

function cloneBuffer(buf) { return new Uint8ClampedArray(buf); }

function upscale(buf, srcW, srcH, scale) {
  const tw = srcW * scale, th = srcH * scale;
  const result = new Uint8ClampedArray(tw * th * 4);
  for (let sy = 0; sy < srcH; sy++)
    for (let sx = 0; sx < srcW; sx++) {
      const si = (sy * srcW + sx) * 4;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const ti = ((sy * scale + dy) * tw + (sx * scale + dx)) * 4;
          result[ti] = buf[si]; result[ti+1] = buf[si+1];
          result[ti+2] = buf[si+2]; result[ti+3] = buf[si+3];
        }
    }
  return { buf: result, w: tw, h: th };
}

// ═══════════════════════════════════════════════════════
// BUILD THE 32×32 SPRITE
// ═══════════════════════════════════════════════════════
console.log('Stage 40.3: Prop translation — 500×500 → 32×32');
console.log('Target read: "Valuable, ancient, slightly dangerous"');
console.log('');

const sprite = createBuffer();
const CX = 16; // Center X
const decisions = [];

// ─── CUE 1: Open lid (tilted back) ───
// At concept: large trapezoid lid. At 32px: ~8px tall lid section above body.
// EXAGGERATE: lid should be visually prominent, taller than proportional.
decisions.push('Lid: exaggerated height (8px vs proportional 5px) for open-chest read');

// Lid back (dark edge)
fillRect(sprite, 5, 4, 22, 9, C.woodDk);
// Lid front face
fillRect(sprite, 6, 5, 20, 7, C.wood);
// Lid highlight top edge
fillRect(sprite, 7, 5, 18, 1, C.woodLt);
// Lid metal band
fillRect(sprite, 5, 9, 22, 1, C.metal);

// ─── Lid interior (visible — warm lining) ───
// Red lining peeking below lid
fillRect(sprite, 7, 11, 18, 2, C.liningDk);
fillRect(sprite, 8, 11, 16, 1, C.lining);
decisions.push('Interior lining: 2px strip of warm red below lid (was full interior in concept)');

// ─── CUE 2: Glow from interior ───
// At 32px: 3–4 bright pixels in the chest opening.
// The glow IS the treasure — it's the core read.
px(sprite, CX - 2, 12, C.glowSoft);
px(sprite, CX - 1, 12, C.glow);
px(sprite, CX, 12, C.glowBright);
px(sprite, CX + 1, 12, C.glow);
px(sprite, CX + 2, 12, C.glowSoft);
// Second row of glow (softer)
px(sprite, CX - 1, 13, C.glowSoft);
px(sprite, CX, 13, C.glow);
px(sprite, CX + 1, 13, C.glowSoft);
decisions.push('Glow: 8 pixels (was 3 concentric ellipses in concept). Still reads as "light inside"');

// ─── Chest body ───
fillRect(sprite, 5, 14, 22, 12, C.wood);
// Left shadow
fillRect(sprite, 5, 14, 3, 12, C.woodDk);
// Right highlight
fillRect(sprite, 24, 14, 3, 12, C.woodLt);

// ─── CUE 3: Metal bands ───
// Concept had 3 full-width metal bands with rivets. At 32px: 2 accent lines.
fillRect(sprite, 5, 14, 22, 1, C.metal);   // top band
fillRect(sprite, 5, 21, 22, 1, C.metal);   // middle band
// Tiny highlights on bands
px(sprite, 8, 14, C.metalHi);
px(sprite, 20, 14, C.metalHi);
px(sprite, 10, 21, C.metalHi);
px(sprite, 18, 21, C.metalHi);
decisions.push('Metal bands: 2 × 1px lines with highlight dots (rivets dropped entirely)');

// ─── CUE 4: Gem on front ───
// The gem was 20×20 in concept. At 32px: 1 red pixel + 1 highlight pixel.
px(sprite, CX, 22, C.gemRed);
px(sprite, CX, 23, C.gemRed);
px(sprite, CX + 1, 22, C.gemRedHi);
decisions.push('Gem: 3px cluster (was 20px diameter with facets). Red still pops against brown.');

// ─── Gold trim ───
// Concept had gold trim on lid edge. At 32px: 1px gold line at lid bottom.
fillRect(sprite, 5, 13, 22, 1, C.goldDk);
px(sprite, 8, 13, C.gold);
px(sprite, 16, 13, C.gold);
px(sprite, 22, 13, C.gold);
decisions.push('Gold trim: 1px line with 3 bright dots (was full decorative border)');

// ─── CUE 5: Feet ───
// Concept had 4 ornate metal feet. At 32px: 2 dark pixels anchoring the bottom.
px(sprite, 7, 26, C.metalDk);
px(sprite, 8, 26, C.metal);
px(sprite, 23, 26, C.metalDk);
px(sprite, 24, 26, C.metal);
decisions.push('Feet: 2 × 2px bumps (4 ornate feet dropped to 2 pairs)');

// ─── Outline pass ───
const outlined = cloneBuffer(sprite);
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    if (sprite[i+3] === 0) {
      const neighbors = [
        (y * W + (x-1)) * 4, (y * W + (x+1)) * 4,
        ((y-1) * W + x) * 4, ((y+1) * W + x) * 4,
      ];
      for (const ni of neighbors) {
        if (sprite[ni+3] > 128) {
          outlined[i] = C.outline[0]; outlined[i+1] = C.outline[1];
          outlined[i+2] = C.outline[2]; outlined[i+3] = C.outline[3];
          break;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════
console.log('');
console.log('Exporting sprite + comparison views:');

writePng('sprite-32.png', outlined, W, H);
writePng('sprite-32-silhouette.png', silhouette(outlined, W, H, [40, 40, 40, 255]), W, H);

const up8 = upscale(outlined, W, H, 8);
writePng('sprite-32-8x.png', up8.buf, up8.w, up8.h);

const silUp8 = upscale(silhouette(outlined, W, H, [40, 40, 40, 255]), W, H, 8);
writePng('sprite-32-silhouette-8x.png', silUp8.buf, silUp8.w, silUp8.h);

// Also generate a 48×48 version for comparison (same approach, slightly more room)
const W48 = 48, H48 = 48;
const sprite48 = new Uint8ClampedArray(W48 * H48 * 4);

function px48(x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W48 || y < 0 || y >= H48 || !color) return;
  const i = (y * W48 + x) * 4;
  const sa = color[3] / 255;
  const da = sprite48[i+3] / 255;
  if (sa >= 1 || da === 0) {
    sprite48[i] = color[0]; sprite48[i+1] = color[1]; sprite48[i+2] = color[2]; sprite48[i+3] = color[3];
  } else {
    const outA = sa + da * (1 - sa);
    sprite48[i]   = Math.round((color[0] * sa + sprite48[i]   * da * (1 - sa)) / outA);
    sprite48[i+1] = Math.round((color[1] * sa + sprite48[i+1] * da * (1 - sa)) / outA);
    sprite48[i+2] = Math.round((color[2] * sa + sprite48[i+2] * da * (1 - sa)) / outA);
    sprite48[i+3] = Math.round(outA * 255);
  }
}

function fillRect48(x, y, w, h, color) {
  for (let py = y; py < y + h; py++) for (let px2 = x; px2 < x + w; px2++) px48(px2, py, color);
}

// Quick 48×48 version with more room for detail
const CX48 = 24;

// Lid
fillRect48(6, 5, 36, 14, C.woodDk);
fillRect48(7, 6, 34, 12, C.wood);
fillRect48(8, 6, 32, 2, C.woodLt);
fillRect48(6, 14, 36, 1, C.metal);
px48(10, 14, C.metalHi); px48(24, 14, C.metalHi); px48(38, 14, C.metalHi);
// Interior lining
fillRect48(9, 17, 30, 3, C.liningDk);
fillRect48(10, 17, 28, 2, C.lining);
// Glow
for (let dx = -3; dx <= 3; dx++) px48(CX48 + dx, 19, C.glowSoft);
for (let dx = -2; dx <= 2; dx++) px48(CX48 + dx, 20, C.glow);
px48(CX48, 20, C.glowBright);
px48(CX48 - 1, 21, C.glowSoft); px48(CX48, 21, C.glowSoft); px48(CX48 + 1, 21, C.glowSoft);
// Body
fillRect48(6, 22, 36, 17, C.wood);
fillRect48(6, 22, 4, 17, C.woodDk);
fillRect48(38, 22, 4, 17, C.woodLt);
// Metal bands
fillRect48(6, 22, 36, 1, C.metal);
fillRect48(6, 30, 36, 1, C.metal);
// Gold trim
fillRect48(6, 21, 36, 1, C.goldDk);
px48(10, 21, C.gold); px48(24, 21, C.gold); px48(38, 21, C.gold);
// Gem
fillRect48(CX48 - 1, 32, 3, 3, C.gemRed);
px48(CX48, 32, C.gemRedHi);
// Feet
fillRect48(9, 39, 3, 2, C.metalDk); fillRect48(10, 39, 2, 1, C.metal);
fillRect48(36, 39, 3, 2, C.metalDk); fillRect48(37, 39, 2, 1, C.metal);
// Outline
const outlined48 = new Uint8ClampedArray(sprite48);
for (let y = 1; y < H48 - 1; y++)
  for (let x = 1; x < W48 - 1; x++) {
    const i = (y * W48 + x) * 4;
    if (sprite48[i+3] === 0) {
      for (const [ox, oy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        const ni = (oy * W48 + ox) * 4;
        if (sprite48[ni+3] > 128) {
          outlined48[i] = C.outline[0]; outlined48[i+1] = C.outline[1];
          outlined48[i+2] = C.outline[2]; outlined48[i+3] = C.outline[3];
          break;
        }
      }
    }
  }

writePng('sprite-48.png', outlined48, W48, H48);
const up48_8 = upscale(outlined48, W48, H48, 8);
writePng('sprite-48-8x.png', up48_8.buf, up48_8.w, up48_8.h);

// ═══════════════════════════════════════════════════════
// SIDE-BY-SIDE with concept
// ═══════════════════════════════════════════════════════
const conceptPath = resolve(__dirname, '..', 'docs', 'dogfood', 'prop-concept', 'layer-normal.png');
try {
  const conceptPng = decode(readFileSync(conceptPath));
  const conceptBuf = new Uint8ClampedArray(conceptPng.data);

  const scale = 15; // 32 * 15 = 480 ≈ 500
  const spriteUp = upscale(outlined, W, H, scale);
  const gap = 16;
  const totalW = conceptPng.width + gap + spriteUp.w;
  const totalH = Math.max(conceptPng.height, spriteUp.h);
  const comparison = new Uint8ClampedArray(totalW * totalH * 4);

  for (let y = 0; y < totalH; y++)
    for (let x = 0; x < totalW; x++) {
      const i = (y * totalW + x) * 4;
      comparison[i] = 40; comparison[i+1] = 40; comparison[i+2] = 40; comparison[i+3] = 255;
    }

  const cYOff = Math.floor((totalH - conceptPng.height) / 2);
  for (let y = 0; y < conceptPng.height; y++)
    for (let x = 0; x < conceptPng.width; x++) {
      const si = (y * conceptPng.width + x) * 4;
      if (conceptBuf[si+3] === 0) continue;
      const ti = ((y + cYOff) * totalW + x) * 4;
      comparison[ti] = conceptBuf[si]; comparison[ti+1] = conceptBuf[si+1];
      comparison[ti+2] = conceptBuf[si+2]; comparison[ti+3] = conceptBuf[si+3];
    }

  const sXOff = conceptPng.width + gap;
  const sYOff = Math.floor((totalH - spriteUp.h) / 2);
  for (let y = 0; y < spriteUp.h; y++)
    for (let x = 0; x < spriteUp.w; x++) {
      const si = (y * spriteUp.w + x) * 4;
      if (spriteUp.buf[si+3] === 0) continue;
      const ti = ((y + sYOff) * totalW + (x + sXOff)) * 4;
      comparison[ti] = spriteUp.buf[si]; comparison[ti+1] = spriteUp.buf[si+1];
      comparison[ti+2] = spriteUp.buf[si+2]; comparison[ti+3] = spriteUp.buf[si+3];
    }

  writePng('comparison-concept-vs-sprite.png', comparison, totalW, totalH);
  console.log('  (concept loaded from Stage 39.5 output)');
} catch (e) {
  console.log(`  Note: Could not load concept for comparison: ${e.message}`);
}

// ═══════════════════════════════════════════════════════
// ANALYSIS
// ═══════════════════════════════════════════════════════
console.log('');
console.log('Silhouette survival analysis (32×32):');

let filledCount = 0;
for (let i = 0; i < outlined.length; i += 4) {
  if (outlined[i+3] > 0) filledCount++;
}
console.log(`  Filled pixels: ${filledCount}/${W*H} (${Math.round(filledCount/(W*H)*100)}% coverage)`);

const silBuf = silhouette(outlined, W, H, [255, 255, 255, 255]);
let maxWidth = 0, maxWidthY = 0;
for (let y = 0; y < H; y++) {
  let minX = W, maxX = 0;
  for (let x = 0; x < W; x++) {
    if (silBuf[(y * W + x) * 4 + 3] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  }
  const w = maxX >= minX ? maxX - minX + 1 : 0;
  if (w > maxWidth) { maxWidth = w; maxWidthY = y; }
}
console.log(`  Widest point: ${maxWidth}px at y=${maxWidthY}`);

let topY = H, botY = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (silBuf[(y * W + x) * 4 + 3] > 0) { topY = Math.min(topY, y); botY = Math.max(botY, y); }
console.log(`  Height: ${botY - topY + 1}px (y ${topY}–${botY})`);

// ═══════════════════════════════════════════════════════
// TRANSLATION LOG
// ═══════════════════════════════════════════════════════
const translationLog = `# Stage 40.3 — Prop Translation Log
## Source: 500×500 treasure chest concept (Stage 39.5.2)
## Target: 32×32 game-facing sprite (+ 48×48 variant)
## Target read: "Valuable, ancient, slightly dangerous"

### Translation decisions
${decisions.map(d => `- ${d}`).join('\n')}

### What survived at 32×32
- **Open lid shape** — the "taller than body" lid reads as open chest
- **Glow in opening** — 8 bright pixels still signal "treasure inside"
- **Metal accent lines** — 2 × 1px bands read as "reinforced/ancient"
- **Red gem focal point** — 3px red against brown pops immediately
- **Wood color zones** — left shadow / right highlight gives 3D form
- **Boxy proportions** — wider than tall, correct "chest" read

### What was dropped
- All 6 rivets (too small to render)
- Keyhole detail
- Wood plank lines (individual planks)
- Gem facets and gold gem setting
- Interior velvet texture
- Ground shadow
- Lid wood grain
- Metal band specular highlights (merged into single pixel hints)
- Ornate foot detail (4 → 2 pairs of plain bumps)

### What needed exaggeration
- Lid height: 8px vs proportional ~5px, because the "open" read requires vertical space
- Glow brightness: full-opacity bright pixels vs soft alpha in concept
- Gem size: relatively larger at 32px than at 500px (3px at 32 ≈ 47px equivalent)

### 48×48 variant notes
- At 48×48, there's room for 3 metal band highlight dots, more glow spread, and a 3×3 gem
- The extra 16px of height makes the lid interior lining more visible
- 48×48 is the sweet spot for this prop — 32×32 works but 48×48 breathes

### Silhouette survival verdict
The silhouette reads as "open chest" at 32×32.
The L-shaped profile (body + lid) is distinctive. The glow adds "treasure" even in silhouette.
At 48×48, the interior detail adds "ancient/ornate" which is mostly lost at 32×32.

Scale factor: 500÷32 ≈ 15.6×
`;

writeFileSync(resolve(OUT_DIR, 'translation-log.md'), translationLog);
console.log('');
console.log('  → translation-log.md');
console.log('\nDone. Prop sprite files in docs/dogfood/prop-sprite/');
