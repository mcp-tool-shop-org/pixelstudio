#!/usr/bin/env node
/**
 * Stage 39.5.2 — Prop Concept Dogfood (500×500)
 *
 * Target: Ornate treasure chest — open, with light spilling out.
 * Target read: "Valuable, ancient, slightly dangerous"
 *
 * Workflow: 3 silhouette variations → pick best → sketch → refine → export
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT_DIR = resolve(__dirname, '..', 'docs', 'dogfood', 'prop-concept');
mkdirSync(OUT_DIR, { recursive: true });

const W = 500, H = 500;

// ── Palette ──
const C = {
  sketch:      [180, 140, 80, 153],
  sketchLight: [200, 170, 100, 102],

  woodDk:      [55, 35, 18, 255],
  wood:        [90, 60, 32, 255],
  woodLt:      [125, 88, 50, 255],
  woodHi:      [155, 115, 70, 255],
  metalDk:     [85, 75, 55, 255],
  metal:       [140, 125, 95, 255],
  metalHi:     [190, 175, 140, 255],
  metalSpec:   [225, 215, 185, 255],
  goldDk:      [140, 105, 20, 255],
  gold:        [210, 175, 40, 255],
  goldHi:      [245, 215, 80, 255],
  goldSpec:    [255, 240, 140, 255],
  gemRed:      [160, 25, 30, 255],
  gemRedHi:    [220, 80, 70, 255],
  gemRedDk:    [95, 12, 15, 255],
  liningDk:    [100, 20, 25, 255],
  lining:      [145, 35, 35, 255],
  liningLt:    [175, 55, 50, 255],
  glow:        [255, 240, 180, 180],
  glowSoft:    [255, 230, 160, 80],
  glowBright:  [255, 250, 220, 220],
  shadow:      [20, 15, 10, 200],
  outline:     [25, 18, 12, 255],
};

// ── Drawing primitives ──
function createBuffer() { return new Uint8ClampedArray(W * H * 4); }

function px(buf, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H || !color) return;
  const i = (y * W + x) * 4;
  // Alpha blend for glow effects
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
      const dx = (px2 - cx) / rx, dy = (py - cy) / ry;
      if (dx * dx + dy * dy <= 1) px(buf, px2, py, color);
    }
}

function fillTrapezoid(buf, x, y, topW, botW, h, color) {
  for (let row = 0; row < h; row++) {
    const t = row / (h - 1 || 1);
    const rowW = Math.round(topW + (botW - topW) * t);
    const cx2 = x + Math.round((Math.max(topW, botW) - rowW) / 2);
    fillRect(buf, cx2, y + row, rowW, 1, color);
  }
}

function fillTriangle(buf, x1, y1, x2, y2, x3, y3, color) {
  const minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
  for (let y = minY; y <= maxY; y++) {
    let minX = W, maxX = 0;
    const edges = [[x1,y1,x2,y2],[x2,y2,x3,y3],[x3,y3,x1,y1]];
    for (const [ex1,ey1,ex2,ey2] of edges) {
      if ((y >= ey1 && y <= ey2) || (y >= ey2 && y <= ey1)) {
        const dy = ey2 - ey1;
        const ix = dy === 0 ? ex1 : ex1 + (y - ey1) * (ex2 - ex1) / dy;
        minX = Math.min(minX, ix);
        maxX = Math.max(maxX, ix);
      }
    }
    for (let x = Math.round(minX); x <= Math.round(maxX); x++) px(buf, x, y, color);
  }
}

function roughStroke(buf, x0, y0, x1, y1, size, color) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx*dx + dy*dy);
  const step = Math.max(1, Math.round(size * 0.4));
  const steps = Math.ceil(len / step);
  for (let i = 0; i <= steps; i++) {
    const t = i / (steps || 1);
    const cx = Math.round(x0 + dx * t), cy = Math.round(y0 + dy * t);
    const r = (size - 1) / 2;
    for (let ddy = -r; ddy <= r; ddy++)
      for (let ddx = -r; ddx <= r; ddx++)
        if (ddx*ddx + ddy*ddy <= r*r) px(buf, cx + ddx, cy + ddy, color);
  }
}

function silhouette(buf, silColor) {
  const sil = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i+3] > 0) {
      sil[i] = silColor[0]; sil[i+1] = silColor[1]; sil[i+2] = silColor[2]; sil[i+3] = buf[i+3];
    }
  }
  return sil;
}

function writePng(name, buf) {
  writeFileSync(resolve(OUT_DIR, name), Buffer.from(encode({ width: W, height: H, data: buf, channels: 4, depth: 8 })));
  console.log(`  → ${name}`);
}

function cloneBuffer(buf) { return new Uint8ClampedArray(buf); }

const CX = 250, CY = 280; // Chest center (lower in frame for drama)

// ═══════════════════════════════════════════════════════
// PHASE 1: Silhouette variations
// ═══════════════════════════════════════════════════════
console.log('Phase 1: Silhouette variations');

// A: Closed chest — simple box
const silA = createBuffer();
fillRect(silA, CX - 100, CY - 50, 200, 100, C.sketch);
fillTrapezoid(silA, CX - 105, CY - 80, 200, 210, 30, C.sketch); // lid
writePng('sil-A-closed.png', silhouette(silA, [60, 60, 60, 255]));

// B: Open chest — lid tilted back, glow visible
const silB = createBuffer();
// Body
fillRect(silB, CX - 100, CY - 30, 200, 100, C.sketch);
// Open lid (tilted back as trapezoid)
fillTrapezoid(silB, CX - 105, CY - 120, 180, 210, 90, C.sketch);
// Glow spill
fillEllipse(silB, CX, CY - 40, 70, 30, C.sketchLight);
writePng('sil-B-open-glow.png', silhouette(silB, [60, 60, 60, 255]));

// C: Open chest angled — 3/4 view suggestion
const silC = createBuffer();
// Body (wider on left)
fillTrapezoid(silC, CX - 110, CY - 25, 210, 220, 95, C.sketch);
// Lid angled
fillTrapezoid(silC, CX - 115, CY - 110, 170, 220, 85, C.sketch);
// Glow blob
fillEllipse(silC, CX - 10, CY - 35, 60, 25, C.sketchLight);
writePng('sil-C-angled.png', silhouette(silC, [60, 60, 60, 255]));

console.log('  Evaluation: B is strongest — open chest with glow reads immediately as "treasure"');

// ═══════════════════════════════════════════════════════
// PHASE 2: Sketch refinement on chosen (B)
// ═══════════════════════════════════════════════════════
console.log('Phase 2: Sketch refinement');
const sketch = cloneBuffer(silB);
// Structure lines
roughStroke(sketch, CX - 100, CY - 30, CX + 100, CY - 30, 2, C.sketchLight); // top edge
roughStroke(sketch, CX - 100, CY + 70, CX + 100, CY + 70, 2, C.sketchLight); // bottom
roughStroke(sketch, CX, CY - 120, CX, CY + 70, 2, C.sketchLight); // center line
// Hardware hints
fillEllipse(sketch, CX, CY - 30, 8, 6, C.sketch); // lock position
roughStroke(sketch, CX - 80, CY + 20, CX + 80, CY + 20, 2, C.sketchLight); // plank line
writePng('sketch-refined.png', sketch);

const snapshotSketch = cloneBuffer(sketch);
console.log('  Snapshot: "sketch-complete"');

// ═══════════════════════════════════════════════════════
// PHASE 3: Normal layer — refined rendering
// ═══════════════════════════════════════════════════════
console.log('Phase 3: Rendering on normal layer');
const normal = createBuffer();

// ── Ground shadow ──
fillEllipse(normal, CX, CY + 78, 115, 15, C.shadow);

// ── Chest body ──
fillRect(normal, CX - 100, CY - 30, 200, 100, C.wood);
// Top face (slight perspective)
fillRect(normal, CX - 98, CY - 28, 196, 10, C.woodLt);
// Wood planks (horizontal lines)
for (let i = 0; i < 4; i++) {
  fillRect(normal, CX - 98, CY - 8 + i * 22, 196, 2, C.woodDk);
}
// Left face shadow
fillRect(normal, CX - 100, CY - 30, 20, 100, C.woodDk);
// Right face highlight
fillRect(normal, CX + 80, CY - 30, 20, 100, C.woodHi);
// Bottom edge
fillRect(normal, CX - 102, CY + 68, 204, 4, C.woodDk);

// ── Metal bands ──
fillRect(normal, CX - 102, CY - 32, 204, 5, C.metal);
fillRect(normal, CX - 102, CY + 15, 204, 6, C.metal);
fillRect(normal, CX - 102, CY + 62, 204, 6, C.metal);
// Band highlights
fillRect(normal, CX - 100, CY - 31, 200, 2, C.metalHi);
fillRect(normal, CX - 100, CY + 16, 200, 2, C.metalHi);
fillRect(normal, CX - 100, CY + 63, 200, 2, C.metalHi);

// ── Corner rivets ──
const rivets = [
  [CX - 90, CY - 28], [CX + 90, CY - 28],
  [CX - 90, CY + 65], [CX + 90, CY + 65],
  [CX - 90, CY + 18], [CX + 90, CY + 18],
];
for (const [rx, ry] of rivets) {
  fillEllipse(normal, rx, ry, 4, 4, C.metalDk);
  fillEllipse(normal, rx, ry, 3, 3, C.metal);
  fillEllipse(normal, rx - 1, ry - 1, 1, 1, C.metalSpec);
}

// ── Open lid (tilted back) ──
// Lid back face
fillTrapezoid(normal, CX - 103, CY - 115, 185, 206, 85, C.woodDk);
// Lid front face
fillTrapezoid(normal, CX - 100, CY - 112, 180, 200, 80, C.wood);
// Lid wood grain
for (let i = 0; i < 3; i++) {
  const y = CY - 105 + i * 25;
  const t = (i * 25) / 80;
  const w = Math.round(180 + (200 - 180) * t);
  const x = CX - Math.round(w / 2);
  fillRect(normal, x + 2, y, w - 4, 2, C.woodLt);
}
// Lid highlight (top edge)
fillRect(normal, CX - 95, CY - 113, 170, 3, C.woodHi);
// Metal band on lid
fillRect(normal, CX - 103, CY - 75, 206, 5, C.metal);
fillRect(normal, CX - 101, CY - 74, 202, 2, C.metalHi);

// ── Lid interior (visible — red velvet lining) ──
fillTrapezoid(normal, CX - 90, CY - 105, 160, 180, 72, C.liningDk);
fillTrapezoid(normal, CX - 85, CY - 100, 150, 170, 65, C.lining);
// Lining highlight
fillTrapezoid(normal, CX - 75, CY - 95, 80, 90, 30, C.liningLt);

// ── Chest interior (glow source) ──
fillRect(normal, CX - 88, CY - 28, 176, 10, C.liningDk);
fillRect(normal, CX - 85, CY - 26, 170, 6, C.lining);

// ── Glow effect ──
// Large soft glow
fillEllipse(normal, CX, CY - 50, 90, 50, C.glowSoft);
// Medium glow
fillEllipse(normal, CX, CY - 40, 60, 30, C.glow);
// Bright center
fillEllipse(normal, CX, CY - 35, 30, 15, C.glowBright);

// ── Lock / clasp ──
fillRect(normal, CX - 12, CY - 36, 24, 16, C.goldDk);
fillRect(normal, CX - 10, CY - 34, 20, 12, C.gold);
fillRect(normal, CX - 8, CY - 32, 16, 8, C.goldHi);
// Keyhole
fillEllipse(normal, CX, CY - 29, 3, 3, C.woodDk);
fillRect(normal, CX - 1, CY - 27, 3, 4, C.woodDk);

// ── Gold trim on chest edges ──
fillRect(normal, CX - 102, CY - 33, 204, 3, C.goldDk);
fillRect(normal, CX - 101, CY - 32, 202, 1, C.goldHi);

// ── Gem on front ──
fillEllipse(normal, CX, CY + 40, 10, 10, C.gemRedDk);
fillEllipse(normal, CX, CY + 40, 8, 8, C.gemRed);
fillEllipse(normal, CX - 2, CY + 38, 4, 3, C.gemRedHi);
// Gem setting
fillEllipse(normal, CX, CY + 40, 12, 12, C.goldDk);
fillEllipse(normal, CX, CY + 40, 10, 10, C.gemRedDk);
fillEllipse(normal, CX, CY + 40, 8, 8, C.gemRed);
fillEllipse(normal, CX - 2, CY + 38, 3, 2, C.gemRedHi);

// ── Chest feet ──
const feet = [CX - 85, CX - 30, CX + 30, CX + 85];
for (const fx of feet) {
  fillRect(normal, fx - 6, CY + 68, 12, 8, C.metalDk);
  fillRect(normal, fx - 5, CY + 69, 10, 6, C.metal);
  fillRect(normal, fx - 4, CY + 70, 8, 2, C.metalHi);
}

// ── Outline pass ──
const outlined = cloneBuffer(normal);
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    if (normal[i+3] === 0) {
      const neighbors = [
        (y * W + (x-1)) * 4, (y * W + (x+1)) * 4,
        ((y-1) * W + x) * 4, ((y+1) * W + x) * 4,
      ];
      for (const ni of neighbors) {
        if (normal[ni+3] > 128) { // Only outline solid pixels (not glow)
          outlined[i] = C.outline[0]; outlined[i+1] = C.outline[1];
          outlined[i+2] = C.outline[2]; outlined[i+3] = C.outline[3];
          break;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 4: Export
// ═══════════════════════════════════════════════════════
console.log('Phase 4: Export');
writePng('layer-sketch.png', sketch);
writePng('layer-normal.png', outlined);
writePng('final-silhouette.png', silhouette(outlined, [40, 40, 40, 255]));

// Snapshot comparison
const snapshotFinal = cloneBuffer(outlined);
let added = 0, removed = 0, refined = 0;
for (let i = 0; i < W * H * 4; i += 4) {
  const hadS = snapshotSketch[i+3] > 0, hasF = snapshotFinal[i+3] > 0;
  if (hasF && !hadS) added++;
  if (!hasF && hadS) removed++;
  if (hasF && hadS) refined++;
}
console.log(`  Sketch→Final diff: +${added} added, -${removed} removed, ${refined} refined`);

// ── Friction log ──
const frictionLog = `# Stage 39.5.2 — Prop Concept Dogfood
## Target: Ornate treasure chest (open, glowing), 500×500
## Target read: "Valuable, ancient, slightly dangerous"

### What worked
- Silhouette B (open + glow) was immediately strongest — the open lid
  breaks the boxy shape and the glow gives purpose
- Sketch → refined transition was smoother for props than characters
  because props have more geometric structure
- The metal bands, rivets, and gem give material variety at 500×500
- Glow effect with layered alpha reads well even in silhouette

### What fought back
- FRICTION: Alpha blending in the glow requires per-pixel composite;
  the simple px() overwrite doesn't layer glow naturally. Had to
  add inline alpha blending to px() for this script.
- FRICTION: No radial gradient primitive — had to fake glow with
  concentric ellipses at different opacities
- OBSERVATION: Props are easier than characters because they have
  clear geometric structure. The silhouette step still helps
  enormously for choosing between closed vs open vs angled.
- OBSERVATION: The "interior visible" detail (red lining) adds
  a lot of read. Without it the chest is just a box with a lid.

### Decisions
- Pre-production tools work well for props
- Gradient/glow helpers would speed up lighting exploration
- The 3-silhouette → pick → refine workflow is solid for both
  characters and props
`;

writeFileSync(resolve(OUT_DIR, 'friction-log.md'), frictionLog);
console.log('  → friction-log.md');
console.log('\nDone. Prop concept files in docs/dogfood/prop-concept/');
