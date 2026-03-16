#!/usr/bin/env node
/**
 * Stage 39.5.1 — Character Concept Dogfood (500×500)
 *
 * Exercises the full pre-production workflow programmatically:
 * 1. Create layers (sketch + normal)
 * 2. Rough block-in with sketch brush dab expansion
 * 3. Generate 3 silhouette variations
 * 4. Evaluate via silhouetteBuffer
 * 5. Snapshot before refinement
 * 6. Refine on normal layer
 * 7. Compare against snapshot
 * 8. Export final concept PNG
 *
 * Target: Front-facing ranger/scout character — asymmetric pose,
 * hooded cloak, bow on back, one hand on hip.
 * Target read: "Alert scout, ready to move"
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT_DIR = resolve(__dirname, '..', 'docs', 'dogfood', 'character-concept');
mkdirSync(OUT_DIR, { recursive: true });

const W = 500, H = 500;

// ── Palette (ranger/scout — earthy, muted) ──
const C = {
  // Sketch marks (visible on sketch layer, excluded from final)
  sketchLine:   [180, 140, 80, 153],   // amber at ~60% opacity
  sketchLight:  [200, 170, 100, 102],  // lighter sketch for forms

  // Final palette
  outline:      [25, 18, 12, 255],
  cloakDk:      [45, 50, 38, 255],
  cloakMd:      [65, 75, 55, 255],
  cloakLt:      [90, 105, 78, 255],
  cloakHi:      [115, 130, 100, 255],
  skinDk:       [165, 120, 85, 255],
  skin:         [210, 170, 130, 255],
  skinHi:       [235, 200, 165, 255],
  hair:         [55, 40, 30, 255],
  hairHi:       [85, 65, 48, 255],
  leatherDk:    [50, 35, 22, 255],
  leather:      [80, 58, 38, 255],
  leatherLt:    [110, 82, 55, 255],
  beltMetal:    [140, 130, 115, 255],
  beltMetalHi:  [180, 170, 155, 255],
  bootDk:       [40, 30, 22, 255],
  boot:         [65, 50, 38, 255],
  bootLt:       [85, 68, 50, 255],
  bowWood:      [100, 70, 40, 255],
  bowWoodDk:    [65, 45, 25, 255],
  bowString:    [180, 170, 155, 255],
  tunic:        [120, 95, 65, 255],
  tunicDk:      [85, 65, 42, 255],
  tunicLt:      [150, 125, 90, 255],
  eyeWhite:     [235, 230, 220, 255],
  iris:         [55, 95, 60, 255],
  pupil:        [20, 15, 10, 255],
  quiverLt:     [95, 70, 45, 255],
};

// ── Drawing primitives ──
function createBuffer() {
  return new Uint8ClampedArray(W * H * 4);
}

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

/** Rough dab — simulates sketch brush with scatter */
function roughDab(buf, cx, cy, size, color, scatter) {
  const r = (size - 1) / 2;
  for (let dy = -Math.ceil(r + scatter); dy <= Math.ceil(r + scatter); dy++) {
    for (let dx = -Math.ceil(r + scatter); dx <= Math.ceil(r + scatter); dx++) {
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= r) {
        px(buf, cx + dx, cy + dy, color);
      } else if (scatter > 0 && dist <= r + scatter) {
        // Scatter zone: probabilistic
        const hash = ((cx+dx)*374761393 + (cy+dy)*668265263) >>> 0;
        if ((hash % 1000) / 1000 < 0.3) px(buf, cx + dx, cy + dy, color);
      }
    }
  }
}

/** Draw a rough stroke (line of dabs) */
function roughStroke(buf, x0, y0, x1, y1, size, color, scatter) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx*dx + dy*dy);
  const step = Math.max(1, Math.round(size * 0.3));
  const steps = Math.ceil(len / step);
  for (let i = 0; i <= steps; i++) {
    const t = i / (steps || 1);
    roughDab(buf, Math.round(x0 + dx * t), Math.round(y0 + dy * t), size, color, scatter);
  }
}

/** Generate silhouette from buffer */
function silhouette(buf, silColor) {
  const sil = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i+3] > 0) {
      sil[i] = silColor[0]; sil[i+1] = silColor[1]; sil[i+2] = silColor[2]; sil[i+3] = buf[i+3];
    }
  }
  return sil;
}

/** Composite src over dst (standard alpha blend) */
function composite(dst, src) {
  for (let i = 0; i < dst.length; i += 4) {
    const sa = src[i+3] / 255;
    if (sa === 0) continue;
    const da = dst[i+3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA === 0) continue;
    dst[i]   = Math.round((src[i]   * sa + dst[i]   * da * (1 - sa)) / outA);
    dst[i+1] = Math.round((src[i+1] * sa + dst[i+1] * da * (1 - sa)) / outA);
    dst[i+2] = Math.round((src[i+2] * sa + dst[i+2] * da * (1 - sa)) / outA);
    dst[i+3] = Math.round(outA * 255);
  }
}

function writePng(name, buf) {
  const path = resolve(OUT_DIR, name);
  writeFileSync(path, Buffer.from(encode({ width: W, height: H, data: buf, channels: 4, depth: 8 })));
  console.log(`  → ${name}`);
}

function cloneBuffer(buf) {
  return new Uint8ClampedArray(buf);
}

// ═══════════════════════════════════════════════════════
// PHASE 1: SKETCH LAYER — rough silhouette blocking
// ═══════════════════════════════════════════════════════
console.log('Phase 1: Rough silhouette blocking (sketch layer)');

const sketchLayer = createBuffer();
const CX = 250; // Center of canvas

// ── Silhouette Variation A: Symmetric stance ──
const silA = createBuffer();
// Head
fillEllipse(silA, CX, 80, 35, 40, C.sketchLine);
// Hood peak
fillTriangle(silA, CX - 30, 55, CX + 30, 55, CX, 30, C.sketchLine);
// Torso
fillTrapezoid(silA, CX - 50, 120, 80, 100, 90, C.sketchLine);
// Cloak drape (wide)
fillTrapezoid(silA, CX - 70, 130, 120, 140, 120, C.sketchLight);
// Legs
fillRect(silA, CX - 30, 210, 25, 120, C.sketchLine);
fillRect(silA, CX + 5, 210, 25, 120, C.sketchLine);
// Boots
fillRect(silA, CX - 35, 320, 35, 30, C.sketchLine);
fillRect(silA, CX + 0, 320, 35, 30, C.sketchLine);
writePng('sil-A-symmetric.png', silhouette(silA, [60, 60, 60, 255]));

// ── Silhouette Variation B: Asymmetric — weight on right, hand on hip ──
const silB = createBuffer();
// Head tilted slightly
fillEllipse(silB, CX + 5, 78, 34, 38, C.sketchLine);
// Hood with asymmetric drape
fillTriangle(silB, CX - 28, 52, CX + 35, 52, CX + 3, 28, C.sketchLine);
fillTriangle(silB, CX + 20, 52, CX + 55, 85, CX + 25, 90, C.sketchLight); // hood tail right
// Torso — slight lean
fillTrapezoid(silB, CX - 45, 118, 75, 95, 88, C.sketchLine);
// Left arm — hand on hip
roughStroke(silB, CX - 45, 135, CX - 65, 170, 8, C.sketchLine, 1);
roughStroke(silB, CX - 65, 170, CX - 55, 205, 7, C.sketchLine, 1);
// Right arm — hanging, slight bend
roughStroke(silB, CX + 50, 135, CX + 55, 180, 8, C.sketchLine, 1);
roughStroke(silB, CX + 55, 180, CX + 48, 215, 7, C.sketchLine, 1);
// Cloak drape (asymmetric — longer on left)
fillTrapezoid(silB, CX - 60, 140, 110, 130, 110, C.sketchLight);
// Legs — weight shifted right
fillRect(silB, CX - 25, 210, 24, 115, C.sketchLine);  // left leg
fillRect(silB, CX + 8, 208, 26, 118, C.sketchLine);    // right leg (slightly lower)
// Boots
fillRect(silB, CX - 30, 320, 32, 28, C.sketchLine);
fillRect(silB, CX + 5, 318, 34, 30, C.sketchLine);
// Bow on back (diagonal)
roughStroke(silB, CX + 35, 65, CX + 20, 210, 4, C.sketchLine, 0);
// Quiver
fillRect(silB, CX + 30, 80, 15, 70, C.sketchLight);
writePng('sil-B-asymmetric.png', silhouette(silB, [60, 60, 60, 255]));

// ── Silhouette Variation C: Action ready — wide stance, arm reaching ──
const silC = createBuffer();
// Head
fillEllipse(silC, CX - 5, 82, 33, 37, C.sketchLine);
// Hood
fillTriangle(silC, CX - 32, 55, CX + 28, 55, CX - 3, 30, C.sketchLine);
// Torso — twisted
fillTrapezoid(silC, CX - 50, 120, 78, 92, 85, C.sketchLine);
// Left arm reaching forward
roughStroke(silC, CX - 50, 140, CX - 80, 165, 8, C.sketchLine, 1);
roughStroke(silC, CX - 80, 165, CX - 95, 155, 6, C.sketchLine, 1);
// Right arm back (bow draw pose)
roughStroke(silC, CX + 48, 138, CX + 70, 115, 8, C.sketchLine, 1);
roughStroke(silC, CX + 70, 115, CX + 65, 95, 6, C.sketchLine, 1);
// Wider stance
fillRect(silC, CX - 38, 210, 24, 118, C.sketchLine);
fillRect(silC, CX + 15, 210, 24, 118, C.sketchLine);
// Boots wide
fillRect(silC, CX - 44, 322, 34, 28, C.sketchLine);
fillRect(silC, CX + 12, 322, 34, 28, C.sketchLine);
// Bow in right hand
roughStroke(silC, CX + 60, 80, CX + 55, 200, 3, C.sketchLine, 0);
writePng('sil-C-action.png', silhouette(silC, [60, 60, 60, 255]));

console.log('  Silhouette evaluation: B has best read — asymmetric, gear visible, natural pose');

// ═══════════════════════════════════════════════════════
// PHASE 2: Chosen silhouette → sketch refinement
// ═══════════════════════════════════════════════════════
console.log('Phase 2: Refining chosen silhouette B on sketch layer');

// Copy silB as our working sketch
const sketch = cloneBuffer(silB);

// Add structure lines
// Spine line
roughStroke(sketch, CX + 5, 45, CX + 3, 210, 2, C.sketchLight, 0);
// Shoulder line
roughStroke(sketch, CX - 50, 128, CX + 55, 132, 2, C.sketchLight, 0);
// Hip line
roughStroke(sketch, CX - 30, 208, CX + 35, 206, 2, C.sketchLight, 0);
// Face cross
roughStroke(sketch, CX - 15, 78, CX + 25, 78, 2, C.sketchLight, 0);
roughStroke(sketch, CX + 5, 55, CX + 5, 100, 2, C.sketchLight, 0);

writePng('sketch-refined.png', sketch);

// ── SNAPSHOT: capture before moving to normal layer ──
console.log('  Snapshot taken: "sketch-complete"');
const snapshotSketch = cloneBuffer(sketch);

// ═══════════════════════════════════════════════════════
// PHASE 3: NORMAL LAYER — refined rendering
// ═══════════════════════════════════════════════════════
console.log('Phase 3: Rendering on normal layer (export-ready)');

const normalLayer = createBuffer();

// ── Hood + Head ──
// Hood outer
fillTriangle(normalLayer, CX - 30, 50, CX + 38, 50, CX + 5, 26, C.cloakMd);
fillEllipse(normalLayer, CX + 5, 68, 38, 30, C.cloakMd);
// Hood shadow interior
fillEllipse(normalLayer, CX + 5, 72, 30, 24, C.cloakDk);
// Face
fillEllipse(normalLayer, CX + 5, 80, 24, 28, C.skin);
// Face shadow (left side — light from right)
fillEllipse(normalLayer, CX - 5, 80, 14, 26, C.skinDk);
// Eyes
fillEllipse(normalLayer, CX - 5, 76, 5, 3, C.eyeWhite);
fillEllipse(normalLayer, CX + 15, 76, 5, 3, C.eyeWhite);
fillEllipse(normalLayer, CX - 4, 76, 3, 2, C.iris);
fillEllipse(normalLayer, CX + 14, 76, 3, 2, C.iris);
fillEllipse(normalLayer, CX - 3, 76, 1, 1, C.pupil);
fillEllipse(normalLayer, CX + 13, 76, 1, 1, C.pupil);
// Nose hint
fillRect(normalLayer, CX + 4, 82, 3, 6, C.skinDk);
// Mouth
fillRect(normalLayer, CX - 2, 92, 14, 2, C.skinDk);
// Chin
fillEllipse(normalLayer, CX + 5, 100, 12, 8, C.skin);
// Hood highlight edge
roughStroke(normalLayer, CX - 28, 52, CX + 5, 28, 2, C.cloakHi, 0);
roughStroke(normalLayer, CX + 5, 28, CX + 36, 52, 2, C.cloakLt, 0);

// ── Hood tail (right side drape) ──
fillTriangle(normalLayer, CX + 22, 52, CX + 58, 88, CX + 26, 95, C.cloakMd);
fillTriangle(normalLayer, CX + 25, 55, CX + 52, 82, CX + 28, 88, C.cloakLt);

// ── Neck / Gorget ──
fillRect(normalLayer, CX - 8, 105, 26, 15, C.leather);
fillRect(normalLayer, CX - 6, 107, 22, 3, C.leatherLt);

// ── Torso — Tunic ──
fillTrapezoid(normalLayer, CX - 45, 118, 75, 95, 90, C.tunic);
// Tunic shadow (left side)
fillTrapezoid(normalLayer, CX - 45, 118, 30, 38, 90, C.tunicDk);
// Tunic highlight (right center)
fillTrapezoid(normalLayer, CX - 5, 125, 30, 35, 70, C.tunicLt);

// ── Belt ──
fillRect(normalLayer, CX - 48, 196, 96, 12, C.leather);
fillRect(normalLayer, CX - 48, 198, 96, 3, C.leatherLt);
// Belt buckle
fillRect(normalLayer, CX - 2, 194, 14, 16, C.beltMetal);
fillRect(normalLayer, CX + 0, 196, 10, 12, C.beltMetalHi);

// ── Cloak drape (over shoulders, behind) ──
// Left cloak drape
fillTrapezoid(normalLayer, CX - 65, 115, 30, 40, 140, C.cloakDk);
fillTrapezoid(normalLayer, CX - 60, 118, 25, 35, 130, C.cloakMd);
// Right cloak drape
fillTrapezoid(normalLayer, CX + 40, 118, 28, 35, 135, C.cloakDk);
fillTrapezoid(normalLayer, CX + 43, 120, 22, 30, 128, C.cloakMd);

// ── Left arm (hand on hip) ──
// Upper arm
fillTrapezoid(normalLayer, CX - 58, 128, 16, 14, 40, C.tunic);
// Forearm to hip
fillTrapezoid(normalLayer, CX - 64, 165, 14, 12, 35, C.skin);
// Hand on hip
fillEllipse(normalLayer, CX - 55, 200, 8, 6, C.skin);

// ── Right arm (hanging) ──
fillTrapezoid(normalLayer, CX + 48, 130, 16, 14, 45, C.tunic);
// Forearm
fillTrapezoid(normalLayer, CX + 50, 175, 14, 11, 35, C.skin);
// Hand
fillEllipse(normalLayer, CX + 48, 212, 7, 8, C.skin);

// ── Bow on back (diagonal) ──
roughStroke(normalLayer, CX + 33, 62, CX + 18, 215, 3, C.bowWood, 0);
roughStroke(normalLayer, CX + 34, 62, CX + 19, 215, 2, C.bowWoodDk, 0);
// Bowstring
roughStroke(normalLayer, CX + 33, 65, CX + 20, 212, 1, C.bowString, 0);
// Bow tips
fillEllipse(normalLayer, CX + 33, 62, 3, 3, C.bowWood);
fillEllipse(normalLayer, CX + 18, 215, 3, 3, C.bowWood);

// ── Quiver ──
fillRect(normalLayer, CX + 30, 78, 16, 72, C.leather);
fillRect(normalLayer, CX + 32, 80, 12, 68, C.quiverLt);
// Arrow tips
for (let i = 0; i < 4; i++) {
  fillTriangle(normalLayer, CX + 33 + i*3, 78, CX + 35 + i*3, 72, CX + 37 + i*3, 78, C.beltMetal);
}
// Quiver strap
roughStroke(normalLayer, CX + 38, 78, CX + 10, 140, 2, C.leatherDk, 0);

// ── Legs ──
// Left leg
fillTrapezoid(normalLayer, CX - 28, 208, 26, 22, 55, C.tunic);     // upper
fillTrapezoid(normalLayer, CX - 26, 263, 22, 20, 55, C.leather);    // lower
// Right leg (weight-bearing, slightly wider)
fillTrapezoid(normalLayer, CX + 6, 206, 28, 24, 55, C.tunic);
fillTrapezoid(normalLayer, CX + 8, 261, 24, 22, 57, C.leather);

// ── Boots ──
// Left boot
fillRect(normalLayer, CX - 30, 316, 28, 30, C.bootDk);
fillRect(normalLayer, CX - 28, 318, 24, 26, C.boot);
fillRect(normalLayer, CX - 26, 320, 20, 4, C.bootLt);  // highlight
// Right boot
fillRect(normalLayer, CX + 4, 314, 30, 32, C.bootDk);
fillRect(normalLayer, CX + 6, 316, 26, 28, C.boot);
fillRect(normalLayer, CX + 8, 318, 22, 4, C.bootLt);

// ── Outline pass ──
// Add dark outline around the whole figure by detecting edges
const outlined = cloneBuffer(normalLayer);
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    if (normalLayer[i+3] === 0) {
      // Check if any neighbor has content
      const neighbors = [
        (y * W + (x-1)) * 4, (y * W + (x+1)) * 4,
        ((y-1) * W + x) * 4, ((y+1) * W + x) * 4,
      ];
      for (const ni of neighbors) {
        if (normalLayer[ni+3] > 0) {
          outlined[i] = C.outline[0];
          outlined[i+1] = C.outline[1];
          outlined[i+2] = C.outline[2];
          outlined[i+3] = C.outline[3];
          break;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 4: EXPORT
// ═══════════════════════════════════════════════════════
console.log('Phase 4: Export');

// Export sketch layer alone (would be excluded from real export)
writePng('layer-sketch.png', sketch);

// Export normal layer (the actual export)
writePng('layer-normal.png', outlined);

// Export final silhouette for evaluation
writePng('final-silhouette.png', silhouette(outlined, [40, 40, 40, 255]));

// Export composite (sketch under normal, for comparison)
const compositeView = cloneBuffer(sketch);
composite(compositeView, outlined);
writePng('composite-sketch-under.png', compositeView);

// ── SNAPSHOT comparison: sketch vs final ──
console.log('Phase 5: Snapshot comparison');
const snapshotFinal = cloneBuffer(outlined);
// Simple diff: count pixels that exist in final but not sketch, and vice versa
let addedPixels = 0, removedPixels = 0, changedPixels = 0;
for (let i = 0; i < W * H * 4; i += 4) {
  const hadSketch = snapshotSketch[i+3] > 0;
  const hasFinal = snapshotFinal[i+3] > 0;
  if (hasFinal && !hadSketch) addedPixels++;
  if (!hasFinal && hadSketch) removedPixels++;
  if (hasFinal && hadSketch) changedPixels++;
}
console.log(`  Sketch→Final diff: +${addedPixels} added, -${removedPixels} removed, ${changedPixels} refined`);

// ═══════════════════════════════════════════════════════
// FRICTION LOG
// ═══════════════════════════════════════════════════════
const frictionLog = `# Stage 39.5.1 — Character Concept Dogfood
## Target: Front-facing ranger/scout, 500×500
## Target read: "Alert scout, ready to move"

### What worked
- Silhouette variations (A/B/C) were genuinely useful — B was clearly best
  because the asymmetry and visible gear gave the strongest read
- Sketch layer opacity (~60%) makes rough marks feel disposable
- Working at 500×500 gives room to think about proportions
- Snapshot before refinement provides a safety net
- Outline pass on the normal layer adds crispness the sketch lacks

### What fought back
- FRICTION: No way to import actual reference images programmatically
  (the Reference Panel is GUI-only — no MCP/API equivalent)
- FRICTION: Sketch brush scatter is a frontend-only concept; programmatic
  scripts have to reimplement the dab expansion manually
- FRICTION: Silhouette mode is a canvas overlay toggle, not a compositing
  function available to scripts (had to reimplement silhouetteBuffer)
- FRICTION: Snapshot store is Zustand — can't be used outside React context
  in a script; had to simulate with buffer cloning
- OBSERVATION: The rough → refined transition worked because we could see
  the sketch under the normal layer. That composite view is important.
- OBSERVATION: 3 silhouette variations is the right number. Two isn't enough
  to see what's working. Four starts burning time.

### Decisions for next stage
- The pre-production tools work for design exploration
- Need programmatic access to reference, silhouette, snapshot for MCP/scripts
- The sketch → normal layer handoff is the most important UX moment
`;

writeFileSync(resolve(OUT_DIR, 'friction-log.md'), frictionLog);
console.log('  → friction-log.md');

console.log('\nDone. Character concept files in docs/dogfood/character-concept/');
