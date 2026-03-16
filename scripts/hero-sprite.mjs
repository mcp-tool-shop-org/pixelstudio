#!/usr/bin/env node
/**
 * Hero Sprite Generator — Stage 38 (500×500)
 *
 * Programmatic drawing at full resolution. No text grids.
 * Draws a front-facing armored knight with proper shapes.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT_DIR = resolve(__dirname, '..', 'docs', 'visual-recovery', 'hero-sprite');
mkdirSync(OUT_DIR, { recursive: true });

const W = 500, H = 500;
const data = new Uint8ClampedArray(W * H * 4);

// ── Palette ──
const C = {
  outline:    [20, 12, 28, 255],
  armorDk:    [45, 55, 75, 255],
  armorMd:    [75, 95, 125, 255],
  armorLt:    [120, 145, 175, 255],
  armorHi:    [165, 185, 210, 255],
  armorSpec:  [200, 215, 235, 255],
  skin:       [224, 180, 140, 255],
  skinSh:     [190, 145, 110, 255],
  skinDk:     [155, 115, 85, 255],
  eyeWhite:   [240, 238, 230, 255],
  iris:       [65, 90, 140, 255],
  pupil:      [20, 12, 28, 255],
  gold:       [230, 190, 50, 255],
  goldSh:     [180, 145, 30, 255],
  goldDk:     [130, 100, 15, 255],
  goldHi:     [255, 225, 100, 255],
  leather:    [85, 60, 40, 255],
  leatherDk:  [55, 38, 25, 255],
  leatherLt:  [115, 85, 60, 255],
  hair:       [50, 35, 25, 255],
  // Shield
  shieldRed:  [160, 35, 35, 255],
  shieldRedDk:[110, 20, 20, 255],
  shieldRedLt:[195, 60, 55, 255],
  // Sword
  steel:      [195, 200, 210, 255],
  steelHi:    [230, 235, 245, 255],
  steelDk:    [140, 150, 165, 255],
  bg:         null,
};

// ── Drawing primitives ──

function px(x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H || !color) return;
  const i = (y * W + x) * 4;
  data[i] = color[0]; data[i+1] = color[1]; data[i+2] = color[2]; data[i+3] = color[3];
}

function fillRect(x, y, w, h, color) {
  for (let py = y; py < y + h; py++)
    for (let px2 = x; px2 < x + w; px2++)
      px(px2, py, color);
}

function fillEllipse(cx, cy, rx, ry, color) {
  for (let py = cy - ry; py <= cy + ry; py++) {
    for (let px2 = cx - rx; px2 <= cx + rx; px2++) {
      const dx = (px2 - cx) / rx, dy = (py - cy) / ry;
      if (dx * dx + dy * dy <= 1) px(px2, py, color);
    }
  }
}

function fillRoundRect(x, y, w, h, r, color) {
  fillRect(x + r, y, w - 2*r, h, color);
  fillRect(x, y + r, w, h - 2*r, color);
  fillEllipse(x + r, y + r, r, r, color);
  fillEllipse(x + w - r - 1, y + r, r, r, color);
  fillEllipse(x + r, y + h - r - 1, r, r, color);
  fillEllipse(x + w - r - 1, y + h - r - 1, r, r, color);
}

function outlineRect(x, y, w, h, t, color) {
  fillRect(x, y, w, t, color);           // top
  fillRect(x, y + h - t, w, t, color);   // bottom
  fillRect(x, y, t, h, color);           // left
  fillRect(x + w - t, y, t, h, color);   // right
}

function fillTrapezoid(x, y, topW, botW, h, color) {
  for (let row = 0; row < h; row++) {
    const t = row / (h - 1 || 1);
    const rowW = Math.round(topW + (botW - topW) * t);
    const cx = x + Math.round((Math.max(topW, botW) - rowW) / 2);
    fillRect(cx, y + row, rowW, 1, color);
  }
}

function fillTriangle(x1, y1, x2, y2, x3, y3, color) {
  const minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
  for (let y = minY; y <= maxY; y++) {
    let minX = W, maxX = 0;
    const edges = [[x1,y1,x2,y2],[x2,y2,x3,y3],[x3,y3,x1,y1]];
    for (const [ax,ay,bx,by] of edges) {
      if ((y >= Math.min(ay,by)) && (y <= Math.max(ay,by))) {
        const t = (ay === by) ? 0.5 : (y - ay) / (by - ay);
        const ix = Math.round(ax + t * (bx - ax));
        minX = Math.min(minX, ix);
        maxX = Math.max(maxX, ix);
      }
    }
    for (let x = minX; x <= maxX; x++) px(x, y, color);
  }
}

// ── Light-side / dark-side helpers ──
// For a shape, fill left portion with light color, right with dark

function fillRectShaded(x, y, w, h, lightColor, darkColor, midColor) {
  const third = Math.floor(w / 3);
  fillRect(x, y, third, h, lightColor);
  fillRect(x + third, y, w - 2 * third, h, midColor || lightColor);
  fillRect(x + w - third, y, third, h, darkColor);
}

// ═══════════════════════════════════════════════
// DRAW THE KNIGHT — bottom up, back to front
// ═══════════════════════════════════════════════
// v2: Better proportions — narrower torso, longer legs,
//     connected arms, armor skirt, hands with fists

const CX = 250;  // center X

// ── CAPE (drawn first — behind everything) ──
// Flowing cape from shoulders to below knees, slightly asymmetric
// Cape drapes from ~y:170 down to ~y:450, wider at bottom
for (let y = 170; y <= 455; y++) {
  const t = (y - 170) / 285;
  // Cape widens as it goes down with a gentle wave
  const wave = Math.sin(t * 4 + 0.5) * 8 * t;
  const halfW = Math.round(55 + 70 * t + wave);
  const lx = CX - halfW, rx = CX + halfW;
  // Color: darker red for cape
  const shade = t < 0.3 ? C.shieldRedLt : t < 0.7 ? C.shieldRed : C.shieldRedDk;
  for (let x = lx; x <= rx; x++) {
    // Add some light/shadow variation
    const xn = (x - lx) / (rx - lx);
    const c = xn < 0.25 ? C.shieldRedLt : xn < 0.6 ? C.shieldRed : C.shieldRedDk;
    px(x, y, c);
  }
  // Cape outline edges
  px(lx - 1, y, C.outline);
  px(lx, y, C.outline);
  px(rx, y, C.outline);
  px(rx + 1, y, C.outline);
}
// Cape bottom edge (smooth flowing curve)
for (let x = CX - 130; x <= CX + 130; x++) {
  const wave = Math.sin(x * 0.04) * 8 + Math.sin(x * 0.02) * 5;
  const by = 455 + Math.round(wave);
  // Fill from cape bottom to edge for clean finish
  for (let y = 450; y <= by; y++) {
    const xn = (x - (CX - 130)) / 260;
    const c = xn < 0.25 ? C.shieldRedLt : xn < 0.6 ? C.shieldRed : C.shieldRedDk;
    px(x, y, c);
  }
  px(x, by, C.outline);
  px(x, by + 1, C.outline);
}

// ── BOOTS (y: 430–470) ──
// Left boot
fillRoundRect(182, 432, 55, 38, 6, C.outline);
fillRoundRect(185, 435, 49, 32, 5, C.leatherDk);
fillRect(185, 435, 18, 32, C.leatherLt);
fillRect(203, 435, 15, 32, C.leather);
// Boot sole highlight
fillRect(185, 460, 49, 4, C.leatherDk);
// Right boot
fillRoundRect(263, 432, 55, 38, 6, C.outline);
fillRoundRect(266, 435, 49, 32, 5, C.leatherDk);
fillRect(266, 435, 18, 32, C.leather);
fillRect(284, 435, 15, 32, C.leatherDk);
fillRect(266, 460, 49, 4, C.leatherDk);

// ── LEGS / GREAVES (y: 320–435) — LONGER ──
// Left leg (lit)
fillRoundRect(186, 320, 48, 118, 5, C.outline);
fillRoundRect(189, 323, 42, 112, 4, C.armorMd);
fillRect(189, 323, 14, 112, C.armorLt);
fillRect(203, 323, 14, 112, C.armorMd);
fillRect(217, 323, 14, 112, C.armorDk);
// Knee cap left
fillEllipse(210, 370, 20, 10, C.outline);
fillEllipse(210, 370, 17, 8, C.armorMd);
fillEllipse(205, 368, 8, 4, C.armorHi);
// Greave ridge (vertical)
fillRect(208, 385, 3, 45, C.armorHi);

// Right leg (shadow)
fillRoundRect(266, 320, 48, 118, 5, C.outline);
fillRoundRect(269, 323, 42, 112, 4, C.armorDk);
fillRect(269, 323, 14, 112, C.armorMd);
fillRect(283, 323, 14, 112, C.armorDk);
fillRect(297, 323, 14, 112, C.armorDk);
// Knee cap right
fillEllipse(290, 370, 20, 10, C.outline);
fillEllipse(290, 370, 17, 8, C.armorDk);
fillEllipse(285, 368, 8, 4, C.armorMd);
fillRect(288, 385, 3, 45, C.armorMd);

// ── TASSETS / ARMOR SKIRT (y: 290–330) ──
// Left tasset
fillTrapezoid(178, 290, 60, 50, 40, C.outline);
fillTrapezoid(181, 293, 54, 44, 34, C.armorMd);
fillTrapezoid(181, 293, 20, 16, 34, C.armorLt);  // lit edge
// Right tasset
fillTrapezoid(262, 290, 60, 50, 40, C.outline);
fillTrapezoid(265, 293, 54, 44, 34, C.armorDk);
fillTrapezoid(265, 293, 20, 16, 34, C.armorMd);
// Center tasset (narrow, between legs)
fillTrapezoid(228, 290, 44, 30, 40, C.outline);
fillTrapezoid(231, 293, 38, 24, 34, C.armorMd);

// ── BELT / WAIST (y: 275–300) ──
fillRoundRect(175, 275, 150, 25, 4, C.outline);
fillRoundRect(178, 278, 144, 19, 3, C.goldSh);
fillRect(178, 278, 50, 19, C.gold);
fillRect(228, 278, 45, 19, C.goldSh);
fillRect(273, 278, 49, 19, C.goldDk);
// Belt buckle
fillRoundRect(233, 279, 34, 17, 3, C.outline);
fillRoundRect(236, 282, 28, 11, 2, C.goldHi);
fillRect(241, 285, 18, 5, C.gold);

// ── TORSO / BREASTPLATE (y: 180–280) — TAPERED ──
// Wider at shoulders (~160px), narrower at waist (~130px)
fillTrapezoid(170, 180, 160, 130, 100, C.outline);
fillTrapezoid(173, 183, 154, 124, 94, C.armorMd);
// Light gradient on torso (three big vertical bands)
fillTrapezoid(173, 183, 50, 40, 94, C.armorLt);          // left lit
fillTrapezoid(222, 183, 56, 44, 94, C.armorMd);          // center
fillTrapezoid(277, 183, 50, 40, 94, C.armorDk);          // right shadow
// Chest plate highlight
fillEllipse(228, 218, 32, 22, C.armorHi);
fillEllipse(223, 213, 16, 11, C.armorSpec);
// Center ridge
fillRect(248, 185, 4, 90, C.armorDk);
// Pectoral lines
fillEllipse(222, 208, 28, 3, C.armorDk);
fillEllipse(278, 208, 28, 3, C.armorDk);
// Ab plate lines
fillRect(192, 248, 116, 2, C.armorDk);
fillRect(195, 260, 110, 2, C.armorDk);

// ── ARMS (y: 185–370) — CONNECTED TO BODY ──
// Left upper arm (flush with torso at x:175)
fillRoundRect(130, 190, 50, 100, 6, C.outline);
fillRoundRect(133, 193, 44, 94, 5, C.armorLt);
fillRect(133, 193, 15, 94, C.armorHi);
fillRect(148, 193, 14, 94, C.armorLt);
fillRect(162, 193, 15, 94, C.armorMd);
// Left elbow joint
fillEllipse(155, 290, 22, 12, C.outline);
fillEllipse(155, 290, 19, 10, C.armorMd);
fillEllipse(150, 288, 8, 5, C.armorHi);
// Left forearm
fillRoundRect(133, 298, 46, 50, 6, C.outline);
fillRoundRect(136, 301, 40, 44, 5, C.armorMd);
fillRect(136, 301, 14, 44, C.armorLt);
// Left gauntlet
fillRoundRect(130, 342, 50, 28, 5, C.outline);
fillRoundRect(133, 345, 44, 22, 4, C.leatherDk);
fillRect(133, 345, 16, 22, C.leather);
// Left fist
fillRoundRect(133, 367, 40, 14, 4, C.outline);
fillRoundRect(136, 370, 34, 8, 3, C.skinSh);
fillRect(136, 370, 12, 8, C.skin);

// Right upper arm (flush with torso at x:325)
fillRoundRect(320, 190, 50, 100, 6, C.outline);
fillRoundRect(323, 193, 44, 94, 5, C.armorDk);
fillRect(323, 193, 15, 94, C.armorMd);
fillRect(338, 193, 14, 94, C.armorDk);
fillRect(352, 193, 15, 94, C.armorDk);
// Right elbow
fillEllipse(345, 290, 22, 12, C.outline);
fillEllipse(345, 290, 19, 10, C.armorDk);
fillEllipse(340, 288, 8, 5, C.armorMd);
// Right forearm
fillRoundRect(321, 298, 46, 50, 6, C.outline);
fillRoundRect(324, 301, 40, 44, 5, C.armorDk);
fillRect(324, 301, 14, 44, C.armorMd);
// Right gauntlet
fillRoundRect(320, 342, 50, 28, 5, C.outline);
fillRoundRect(323, 345, 44, 22, 4, C.leatherDk);
// Right fist
fillRoundRect(323, 367, 40, 14, 4, C.outline);
fillRoundRect(326, 370, 34, 8, 3, C.skinDk);
fillRect(326, 370, 12, 8, C.skinSh);

// ── PAULDRONS / SHOULDERS (y: 165–200) — OVERLAP ARMS+TORSO ──
// Left pauldron (lit)
fillEllipse(155, 190, 38, 20, C.outline);
fillEllipse(155, 190, 35, 17, C.armorLt);
fillEllipse(148, 185, 16, 9, C.armorHi);
fillEllipse(145, 183, 9, 5, C.armorSpec);
// Pauldron rim detail
fillEllipse(130, 196, 4, 4, C.goldSh);
fillEllipse(155, 200, 4, 4, C.goldSh);
fillEllipse(178, 196, 4, 4, C.goldSh);
// Gold trim on pauldron edge
for (let a = -35; a <= 35; a++) {
  const rad = a * Math.PI / 180;
  const ex = Math.round(155 + 36 * Math.cos(rad));
  const ey = Math.round(197 + 10 * Math.cos(rad));
  px(ex, ey, C.goldSh);
  px(ex, ey + 1, C.goldSh);
}

// Right pauldron (shadow)
fillEllipse(345, 190, 38, 20, C.outline);
fillEllipse(345, 190, 35, 17, C.armorDk);
fillEllipse(338, 185, 16, 9, C.armorMd);
fillEllipse(330, 196, 4, 4, C.goldDk);
fillEllipse(345, 200, 4, 4, C.goldDk);
fillEllipse(368, 196, 4, 4, C.goldDk);

// ── GORGET / NECK GUARD (y: 150–185) ──
fillRoundRect(205, 152, 90, 38, 5, C.outline);
fillRoundRect(208, 155, 84, 32, 4, C.armorMd);
fillRect(208, 155, 30, 32, C.armorLt);
fillRect(238, 155, 25, 32, C.armorMd);
fillRect(263, 155, 29, 32, C.armorDk);
// Gold trim at gorget top
fillRect(208, 152, 84, 5, C.outline);
fillRect(210, 153, 80, 3, C.gold);

// ── NECK (y: 135–158) ──
fillRect(228, 135, 44, 25, C.skinSh);
fillRect(228, 135, 18, 25, C.skin);

// ── HEAD / HELMET (y: 35–145) ──
// Helmet shell
fillEllipse(250, 88, 65, 55, C.outline);
fillEllipse(250, 88, 62, 52, C.armorMd);
// Light gradient on helmet
fillEllipse(236, 78, 32, 38, C.armorLt);
fillEllipse(230, 72, 18, 23, C.armorHi);
fillEllipse(227, 68, 11, 14, C.armorSpec);
// Dark side
fillEllipse(272, 93, 28, 33, C.armorDk);

// Helmet brim (wider, more knightly)
fillRect(182, 47, 136, 12, C.outline);
fillRect(185, 49, 130, 8, C.armorLt);
fillRect(250, 49, 65, 8, C.armorDk);
// Brim edge detail
fillRect(185, 56, 130, 2, C.outline);

// ── GOLD CREST / PLUME (larger, more dramatic) ──
for (let i = 0; i < 50; i++) {
  const t = i / 49;
  const crestH = Math.round(28 + 20 * Math.sin(t * Math.PI));
  const cx2 = 225 + i;
  const color = i < 17 ? C.goldHi : i < 34 ? C.gold : C.goldSh;
  fillRect(cx2, 47 - crestH, 1, crestH, color);
}
// Crest outline
for (let i = 0; i < 50; i++) {
  const t = i / 49;
  const crestH = Math.round(28 + 20 * Math.sin(t * Math.PI));
  px(225 + i, 47 - crestH - 1, C.outline);
  px(225 + i, 47 - crestH, C.outline);
}
for (let py2 = 47 - 48; py2 <= 47; py2++) {
  px(224, py2, C.outline);
  px(275, py2, C.outline);
}

// ── FACE / VISOR OPENING (y: 90–140) ──
fillRoundRect(210, 93, 80, 48, 8, C.outline);
fillRoundRect(213, 96, 74, 42, 6, C.skin);
// Shadow on right side of face
fillRect(258, 96, 29, 42, C.skinSh);
fillRect(273, 96, 14, 42, C.skinDk);

// Eyes — more expressive
// Left eye
fillEllipse(233, 112, 12, 8, C.outline);
fillEllipse(233, 112, 10, 6, C.eyeWhite);
fillEllipse(235, 112, 6, 5, C.iris);
fillEllipse(236, 111, 3, 3, C.pupil);
fillEllipse(231, 110, 2, 2, C.eyeWhite);
// Right eye
fillEllipse(267, 112, 11, 7, C.outline);
fillEllipse(267, 112, 9, 5, C.eyeWhite);
fillEllipse(269, 112, 5, 4, C.iris);
fillEllipse(270, 111, 3, 3, C.pupil);
fillEllipse(265, 110, 2, 2, C.eyeWhite);

// Eyebrows (angled for determination)
for (let b = 0; b < 24; b++) {
  fillRect(221 + b, 102 - Math.floor(b / 8), 1, 3, C.outline);
}
for (let b = 0; b < 22; b++) {
  fillRect(257 + b, 100 + Math.floor(b / 8), 1, 3, C.outline);
}

// Nose
fillRect(248, 119, 5, 10, C.skinSh);
fillRect(247, 129, 7, 2, C.skinDk);

// Mouth
fillRect(240, 133, 20, 2, C.skinDk);
fillRect(237, 136, 26, 2, C.skinSh);

// ── VISOR FRAME ──
outlineRect(208, 91, 84, 52, 3, C.outline);
outlineRect(211, 94, 78, 46, 2, C.armorDk);
fillRect(211, 94, 2, 46, C.armorLt);
// Visor hinge bolts
fillEllipse(211, 115, 3, 3, C.goldSh);
fillEllipse(289, 115, 3, 3, C.goldDk);

// ── SHIELD (left hand, overlaps arm) ──
// Kite shield shape — pointed bottom, flat top
// Shield is held at forearm level (y: 260–410)
fillTriangle(70, 260, 170, 260, 120, 420, C.outline);
fillTriangle(74, 264, 166, 264, 120, 414, C.shieldRedDk);
// Lit side (left half)
fillTriangle(74, 264, 120, 264, 120, 414, C.shieldRed);
fillTriangle(74, 264, 100, 264, 87, 340, C.shieldRedLt);
// Shield border (gold rim)
for (let y = 264; y <= 414; y++) {
  const t = (y - 264) / 150;
  const halfW = Math.round(46 * (1 - t));
  const lx = 120 - halfW, rx = 120 + halfW;
  for (let b = 0; b < 4; b++) {
    px(lx + b, y, C.goldSh);
    px(rx - b, y, C.goldSh);
  }
}
fillRect(74, 264, 92, 4, C.goldSh);  // top border
// Shield cross emblem (gold)
fillRect(114, 290, 12, 90, C.gold);      // vertical bar
fillRect(90, 320, 60, 12, C.gold);       // horizontal bar
fillRect(114, 290, 12, 90, C.goldHi);    // vertical bar highlight
fillRect(116, 290, 4, 90, C.gold);
fillRect(90, 322, 60, 4, C.goldHi);      // horizontal bar highlight
// Shield boss (center rivet)
fillEllipse(120, 335, 8, 8, C.outline);
fillEllipse(120, 335, 6, 6, C.goldSh);
fillEllipse(118, 333, 3, 3, C.goldHi);

// ── SWORD (right hand) ──
// Sword hangs from right hand (x: ~345, blade goes down)
// Pommel
fillEllipse(345, 370, 6, 6, C.outline);
fillEllipse(345, 370, 5, 5, C.goldSh);
fillEllipse(344, 369, 2, 2, C.goldHi);
// Grip (leather wrapped)
fillRect(342, 355, 6, 18, C.outline);
fillRect(343, 356, 4, 16, C.leather);
fillRect(343, 356, 2, 16, C.leatherLt);
// Cross-guard
fillRoundRect(328, 349, 34, 8, 3, C.outline);
fillRoundRect(330, 351, 30, 4, 2, C.goldSh);
fillRect(330, 351, 12, 4, C.goldHi);
fillRect(348, 351, 12, 4, C.goldDk);
// Blade
fillRect(342, 240, 6, 112, C.outline);
fillRect(343, 241, 4, 110, C.steelDk);
fillRect(343, 241, 2, 110, C.steelHi);  // edge highlight
fillRect(345, 241, 1, 110, C.steel);
// Fuller (central groove)
fillRect(344, 260, 1, 80, C.steelDk);
// Blade tip (pointed)
fillTriangle(342, 240, 348, 240, 345, 225, C.outline);
fillTriangle(343, 239, 347, 239, 345, 227, C.steel);
fillTriangle(343, 239, 345, 239, 344, 228, C.steelHi);

// ── Write output ──
const pngBytes = encode({ width: W, height: H, data, channels: 4, depth: 8 });
writeFileSync(resolve(OUT_DIR, 'hero-500.png'), Buffer.from(pngBytes));

// Also write silhouette
const silData = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H * 4; i += 4) {
  if (data[i + 3] > 0) {
    silData[i] = 20; silData[i+1] = 12; silData[i+2] = 28; silData[i+3] = 255;
  }
}
const silPng = encode({ width: W, height: H, data: silData, channels: 4, depth: 8 });
writeFileSync(resolve(OUT_DIR, 'hero-silhouette-500.png'), Buffer.from(silPng));

let opaqueCount = 0;
for (let i = 3; i < W * H * 4; i += 4) if (data[i] > 0) opaqueCount++;
console.log(`Hero sprite (500x500) generated:`);
console.log(`  Opaque pixels: ${opaqueCount}`);
console.log(`  Output: ${resolve(OUT_DIR, 'hero-500.png')}`);
console.log(`  Silhouette: ${resolve(OUT_DIR, 'hero-silhouette-500.png')}`);
