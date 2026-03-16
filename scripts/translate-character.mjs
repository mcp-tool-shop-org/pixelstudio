#!/usr/bin/env node
/**
 * Stage 40.2 — Character Concept → Sprite Translation (48×48)
 *
 * Reinterprets the 500×500 ranger/scout concept into a game-facing 48×48 sprite.
 * This is NOT downscaling — it's a deliberate rebuild at target resolution.
 *
 * Translation discipline:
 * - Identify the 3–5 strongest read cues from the concept
 * - Rebuild each cue at 48×48, exaggerating where needed
 * - Accept that fine details (face features, belt buckle, arrow tips) will be lost
 * - The silhouette must survive — that's the test
 *
 * Source read: "Alert scout, ready to move"
 * Key cues from concept:
 *   1. Hooded silhouette (peaked hood, shadow under)
 *   2. Asymmetric pose (weight right, hand on hip)
 *   3. Bow + quiver on back (visible equipment)
 *   4. Cloak drape (wider than body, earth tones)
 *   5. Boots (grounded, dark at bottom)
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode, decode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT_DIR = resolve(__dirname, '..', 'docs', 'dogfood', 'character-sprite');
mkdirSync(OUT_DIR, { recursive: true });

const W = 48, H = 48;

// ── Palette — same family as concept, simplified for small canvas ──
// At 48×48, we need fewer values per material. 2–3 values max per element.
const C = {
  outline:    [25, 18, 12, 255],
  cloakDk:    [45, 50, 38, 255],
  cloakMd:    [65, 75, 55, 255],
  cloakLt:    [90, 105, 78, 255],
  skin:       [210, 170, 130, 255],
  skinDk:     [165, 120, 85, 255],
  hair:       [55, 40, 30, 255],
  leather:    [80, 58, 38, 255],
  leatherDk:  [50, 35, 22, 255],
  beltMetal:  [140, 130, 115, 255],
  bootDk:     [40, 30, 22, 255],
  boot:       [65, 50, 38, 255],
  bowWood:    [100, 70, 40, 255],
  tunic:      [120, 95, 65, 255],
  tunicDk:    [85, 65, 42, 255],
  eyeDot:     [20, 15, 10, 255],
};

// ── Drawing primitives (adapted for small canvas) ──
function createBuffer() { return new Uint8ClampedArray(W * H * 4); }

function px(buf, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H || !color) return;
  const i = (y * W + x) * 4;
  buf[i] = color[0]; buf[i+1] = color[1]; buf[i+2] = color[2]; buf[i+3] = color[3];
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

function fillTriangle(buf, x1, y1, x2, y2, x3, y3, color) {
  const minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
  for (let y = minY; y <= maxY; y++) {
    let minX = W, maxX = 0;
    const edges = [[x1,y1,x2,y2],[x2,y2,x3,y3],[x3,y3,x1,y1]];
    for (const [ex1,ey1,ex2,ey2] of edges) {
      if ((y >= ey1 && y <= ey2) || (y >= ey2 && y <= ey1)) {
        const dy2 = ey2 - ey1;
        const ix = dy2 === 0 ? ex1 : ex1 + (y - ey1) * (ex2 - ex1) / dy2;
        minX = Math.min(minX, ix);
        maxX = Math.max(maxX, ix);
      }
    }
    for (let x = Math.round(minX); x <= Math.round(maxX); x++) px(buf, x, y, color);
  }
}

/** Generate silhouette from buffer */
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
  const path = resolve(OUT_DIR, name);
  writeFileSync(path, Buffer.from(encode({ width: w, height: h, data: buf, channels: 4, depth: 8 })));
  console.log(`  → ${name} (${w}×${h})`);
}

function cloneBuffer(buf) { return new Uint8ClampedArray(buf); }

/** Pixel-perfect upscale for comparison */
function upscale(buf, srcW, srcH, scale) {
  const tw = srcW * scale, th = srcH * scale;
  const result = new Uint8ClampedArray(tw * th * 4);
  for (let sy = 0; sy < srcH; sy++) {
    for (let sx = 0; sx < srcW; sx++) {
      const si = (sy * srcW + sx) * 4;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const ti = ((sy * scale + dy) * tw + (sx * scale + dx)) * 4;
          result[ti] = buf[si]; result[ti+1] = buf[si+1];
          result[ti+2] = buf[si+2]; result[ti+3] = buf[si+3];
        }
      }
    }
  }
  return { buf: result, w: tw, h: th };
}

// ═══════════════════════════════════════════════════════
// BUILD THE 48×48 SPRITE
// ═══════════════════════════════════════════════════════
console.log('Stage 40.2: Character translation — 500×500 → 48×48');
console.log('Target read: "Alert scout, ready to move"');
console.log('');

const sprite = createBuffer();
const CX = 24; // Center X

// Translation decisions logged as we go:
const decisions = [];

// ─── CUE 1: Hooded silhouette ───
// At concept scale: peaked hood with shadow. At 48px: 3–4 pixel hood peak, dark face shadow.
// EXAGGERATE: make hood 1px wider than head to ensure silhouette reads as "hooded"
decisions.push('Hood: exaggerated width (+1px each side) for silhouette read');

// Hood peak
fillTriangle(sprite, CX - 5, 4, CX + 6, 4, CX + 1, 1, C.cloakMd);
// Hood body
fillEllipse(sprite, CX + 1, 7, 6, 4, C.cloakMd);
// Hood shadow (face area)
fillEllipse(sprite, CX + 1, 8, 5, 3, C.cloakDk);
// Face — just skin showing through hood shadow
fillEllipse(sprite, CX + 1, 9, 4, 3, C.skin);
// Face shadow (left)
px(sprite, CX - 2, 9, C.skinDk);
px(sprite, CX - 2, 10, C.skinDk);
// Eyes — single dark pixel each (NO iris/pupil/white at this scale)
px(sprite, CX - 1, 8, C.eyeDot);
px(sprite, CX + 2, 8, C.eyeDot);
decisions.push('Eyes: reduced to single dark pixel each (detail dropped)');

// Hood highlight (top edge)
px(sprite, CX - 3, 4, C.cloakLt);
px(sprite, CX + 4, 4, C.cloakLt);

// ─── Hood tail (right drape) ───
// Concept had an asymmetric hood tail. At 48px: 2–3 pixels trailing right.
px(sprite, CX + 5, 5, C.cloakMd);
px(sprite, CX + 6, 6, C.cloakMd);
px(sprite, CX + 7, 7, C.cloakDk);
decisions.push('Hood tail: 3px drape right, enough to break symmetry');

// ─── CUE 2: Asymmetric pose ───
// Weight on right leg — right leg 1px lower. Left arm at hip.
decisions.push('Pose: right leg 1px lower, left arm angled to hip');

// Neck
fillRect(sprite, CX - 1, 12, 3, 2, C.leather);

// ─── Torso / Tunic ───
fillRect(sprite, CX - 5, 14, 11, 8, C.tunic);
// Tunic shadow (left)
fillRect(sprite, CX - 5, 14, 4, 8, C.tunicDk);
// Tunic highlight (center-right)
fillRect(sprite, CX, 15, 3, 5, C.tunic);

// ─── Belt ───
fillRect(sprite, CX - 5, 22, 11, 2, C.leather);
// Belt buckle — single bright pixel
px(sprite, CX + 1, 22, C.beltMetal);
decisions.push('Belt buckle: reduced to 1px metallic hint (was 14×16 in concept)');

// ─── CUE 3: Cloak drape ───
// Cloak is wider than body — critical silhouette element.
// Concept: cloak draped from shoulders, longer on left.
// At 48px: 1–2px extension on each side.
// Left cloak drape
fillRect(sprite, CX - 7, 13, 2, 14, C.cloakDk);
px(sprite, CX - 7, 14, C.cloakMd);
px(sprite, CX - 7, 16, C.cloakMd);
// Right cloak drape
fillRect(sprite, CX + 6, 14, 2, 13, C.cloakDk);
px(sprite, CX + 6, 15, C.cloakMd);
px(sprite, CX + 6, 17, C.cloakMd);
decisions.push('Cloak: 2px extension each side, ensures "wider than body" read');

// ─── Left arm (hand on hip) ───
// Concept: left arm bent, hand resting on hip. At 48px: 3–4px diagonal stroke.
px(sprite, CX - 6, 16, C.tunic);
px(sprite, CX - 7, 18, C.skin);
px(sprite, CX - 6, 20, C.skin);
px(sprite, CX - 5, 22, C.skin);  // hand at belt level

// ─── Right arm (hanging) ───
px(sprite, CX + 6, 16, C.tunic);
px(sprite, CX + 6, 18, C.skin);
px(sprite, CX + 6, 20, C.skin);

// ─── CUE 4: Bow + quiver on back ───
// The bow diagonal and quiver rectangle are key equipment reads.
// At 48px: bow = 1px wide diagonal line, quiver = 2×5 block.
// Quiver (behind right shoulder)
fillRect(sprite, CX + 4, 5, 2, 7, C.leather);
px(sprite, CX + 4, 5, C.leatherDk); // quiver top dark
// Arrow tips — 2 bright pixels poking up
px(sprite, CX + 4, 4, C.beltMetal);
px(sprite, CX + 5, 4, C.beltMetal);
decisions.push('Quiver: 2×7 block + 2px arrow tips (was 16×72 in concept)');

// Bow (diagonal behind body)
px(sprite, CX + 5, 4, C.bowWood);
px(sprite, CX + 4, 8, C.bowWood);
px(sprite, CX + 3, 12, C.bowWood);
px(sprite, CX + 3, 16, C.bowWood);
px(sprite, CX + 2, 20, C.bowWood);
decisions.push('Bow: 5px diagonal line (was full arc in concept — detail dropped)');

// ─── Legs ───
// Left leg
fillRect(sprite, CX - 4, 24, 4, 7, C.tunic);     // upper
fillRect(sprite, CX - 4, 31, 4, 5, C.leather);    // lower
// Right leg (1px lower — weight shifted)
fillRect(sprite, CX + 1, 25, 4, 7, C.tunic);
fillRect(sprite, CX + 1, 32, 4, 5, C.leather);

// ─── CUE 5: Boots ───
// Dark, grounded. Simple blocks.
// Left boot
fillRect(sprite, CX - 5, 36, 5, 3, C.bootDk);
fillRect(sprite, CX - 4, 36, 3, 2, C.boot);
// Right boot (1px lower)
fillRect(sprite, CX, 37, 6, 3, C.bootDk);
fillRect(sprite, CX + 1, 37, 4, 2, C.boot);
decisions.push('Boots: 5×3 and 6×3 blocks (was 28×30 and 30×32 in concept)');

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
        if (sprite[ni+3] > 0) {
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

writePng('sprite-48.png', outlined, W, H);
writePng('sprite-48-silhouette.png', silhouette(outlined, W, H, [40, 40, 40, 255]), W, H);

// Upscaled views for visual comparison
const up8 = upscale(outlined, W, H, 8);
writePng('sprite-48-8x.png', up8.buf, up8.w, up8.h);

const silUp8 = upscale(silhouette(outlined, W, H, [40, 40, 40, 255]), W, H, 8);
writePng('sprite-48-silhouette-8x.png', silUp8.buf, silUp8.w, silUp8.h);

// ═══════════════════════════════════════════════════════
// SIDE-BY-SIDE with concept (load concept PNG for comparison)
// ═══════════════════════════════════════════════════════
const conceptPath = resolve(__dirname, '..', 'docs', 'dogfood', 'character-concept', 'layer-normal.png');
try {
  const conceptPng = decode(readFileSync(conceptPath));
  const conceptBuf = new Uint8ClampedArray(conceptPng.data);

  // Generate side-by-side: concept (500×500) | gap | sprite (upscaled to match)
  const scale = 10; // 48 * 10 = 480 ≈ 500
  const spriteUp = upscale(outlined, W, H, scale);
  const gap = 16;
  const totalW = conceptPng.width + gap + spriteUp.w;
  const totalH = Math.max(conceptPng.height, spriteUp.h);
  const comparison = new Uint8ClampedArray(totalW * totalH * 4);

  // Background
  for (let y = 0; y < totalH; y++)
    for (let x = 0; x < totalW; x++) {
      const i = (y * totalW + x) * 4;
      comparison[i] = 40; comparison[i+1] = 40; comparison[i+2] = 40; comparison[i+3] = 255;
    }

  // Blit concept (left)
  const cYOff = Math.floor((totalH - conceptPng.height) / 2);
  for (let y = 0; y < conceptPng.height; y++)
    for (let x = 0; x < conceptPng.width; x++) {
      const si = (y * conceptPng.width + x) * 4;
      if (conceptBuf[si+3] === 0) continue;
      const ti = ((y + cYOff) * totalW + x) * 4;
      comparison[ti] = conceptBuf[si]; comparison[ti+1] = conceptBuf[si+1];
      comparison[ti+2] = conceptBuf[si+2]; comparison[ti+3] = conceptBuf[si+3];
    }

  // Blit sprite upscaled (right)
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
  console.log('  Run dogfood-character.mjs first to generate concept images.');
}

// ═══════════════════════════════════════════════════════
// SILHOUETTE SURVIVAL ANALYSIS
// ═══════════════════════════════════════════════════════
console.log('');
console.log('Silhouette survival analysis:');

// Count filled pixels
let filledCount = 0;
for (let i = 0; i < outlined.length; i += 4) {
  if (outlined[i+3] > 0) filledCount++;
}
const totalPixels = W * H;
const fillPercent = Math.round((filledCount / totalPixels) * 100);
console.log(`  Filled pixels: ${filledCount}/${totalPixels} (${fillPercent}% coverage)`);

// Check silhouette distinct features
// The silhouette should show: wider-than-body shape (cloak), peaked top (hood), equipment bump (quiver)
const silBuf = silhouette(outlined, W, H, [255, 255, 255, 255]);
// Measure widest point
let maxWidth = 0, maxWidthY = 0;
for (let y = 0; y < H; y++) {
  let minX = W, maxX = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (silBuf[i+3] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  }
  const width = maxX >= minX ? maxX - minX + 1 : 0;
  if (width > maxWidth) { maxWidth = width; maxWidthY = y; }
}
console.log(`  Widest point: ${maxWidth}px at y=${maxWidthY}`);

// Measure height
let topY = H, botY = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (silBuf[i+3] > 0) { topY = Math.min(topY, y); botY = Math.max(botY, y); }
  }
console.log(`  Height: ${botY - topY + 1}px (y ${topY}–${botY})`);

// ═══════════════════════════════════════════════════════
// TRANSLATION LOG
// ═══════════════════════════════════════════════════════
const translationLog = `# Stage 40.2 — Character Translation Log
## Source: 500×500 ranger/scout concept (Stage 39.5.1)
## Target: 48×48 game-facing sprite
## Target read: "Alert scout, ready to move"

### Translation decisions
${decisions.map(d => `- ${d}`).join('\n')}

### What survived at 48×48
- **Hood silhouette** — peaked hood shape reads clearly at small size
- **Asymmetric pose** — right leg 1px lower, hand on hip visible
- **Cloak wider than body** — 2px extension each side maintains the shape language
- **Equipment on back** — quiver + bow diagonal are distinct even at this scale
- **Dark boots grounding** — dark bottom anchors the character

### What was dropped
- Face features (eyes reduced to 1px dots, no nose/mouth/iris/pupil/white)
- Belt buckle detail (14×16 → 1px metallic hint)
- Bowstring (invisible at 1px)
- Hair under hood (merged into hood shadow)
- Tunic texture/folds
- Boot highlights/detail
- Quiver strap (diagonal line too small to read)
- Arrow tip variety (4 distinct tips → 2 bright pixels)

### What needed exaggeration
- Hood width (+1px each side vs proportional) to ensure "hooded" reads
- Cloak extent (+2px beyond body) to maintain "cloaked figure" shape
- Equipment bump (quiver kept relatively large for its scale)

### Silhouette survival verdict
The silhouette reads as "cloaked figure with gear" at 48×48.
The peaked hood, wider-than-body cloak, and equipment bumps survive.
The asymmetric pose is subtle but present (right leg lower).
Face is just skin-in-shadow with two eye dots — that's correct for this scale.

Scale factor: 500÷48 ≈ 10.4×
`;

writeFileSync(resolve(OUT_DIR, 'translation-log.md'), translationLog);
console.log('');
console.log('  → translation-log.md');
console.log('\nDone. Character sprite files in docs/dogfood/character-sprite/');
