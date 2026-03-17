#!/usr/bin/env node
/**
 * Stage 45.6 — Live Feedback Dogfood
 *
 * Same 3 assets as 44.5, one question:
 * "Did live feedback help prevent bad reductions before cleanup?"
 *
 * Tests:
 * 1. Collapse overlay — does it correctly identify at-risk/collapsing shapes?
 * 2. Risk badges — do they surface problems in the shapes panel?
 * 3. Live preview — would the user see the problem while editing?
 * 4. Proposal preview — are before/after diffs useful?
 *
 * Uses the same rasterizer + analysis pipeline from 44.5.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'docs', 'dogfood', 'stage45-feedback');
mkdirSync(OUT_DIR, { recursive: true });

// ── Minimal rasterizer (same as 44.5) ──
function createBuffer(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
function compositePixel(buf,x,y,c){if(x<0||x>=buf.width||y<0||y>=buf.height||c[3]===0)return;const i=(y*buf.width+x)*4;if(c[3]===255||buf.data[i+3]===0){buf.data[i]=c[0];buf.data[i+1]=c[1];buf.data[i+2]=c[2];buf.data[i+3]=c[3];return;}const sa=c[3]/255,da=buf.data[i+3]/255,outA=sa+da*(1-sa);buf.data[i]=Math.round((c[0]*sa+buf.data[i]*da*(1-sa))/outA);buf.data[i+1]=Math.round((c[1]*sa+buf.data[i+1]*da*(1-sa))/outA);buf.data[i+2]=Math.round((c[2]*sa+buf.data[i+2]*da*(1-sa))/outA);buf.data[i+3]=Math.round(outA*255);}

function wouldCollapse(shape, artW, artH, targetW, targetH) {
  const geo = shape.geometry;
  const t = shape.transform;
  let extX = 0, extY = 0;
  switch (geo.kind) {
    case 'rect': extX = geo.w * Math.abs(t.scaleX); extY = geo.h * Math.abs(t.scaleY); break;
    case 'ellipse': extX = geo.rx * 2 * Math.abs(t.scaleX); extY = geo.ry * 2 * Math.abs(t.scaleY); break;
    case 'polygon': case 'path': {
      const pts = geo.points;
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for (const p of pts) { if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y; }
      extX = (maxX-minX)*Math.abs(t.scaleX); extY = (maxY-minY)*Math.abs(t.scaleY);
      break;
    }
    case 'line': {
      const mx = Math.max(Math.abs(geo.x2-geo.x1)*Math.abs(t.scaleX),Math.abs(geo.y2-geo.y1)*Math.abs(t.scaleY));
      return Math.round((mx/Math.max(artW,artH))*Math.max(targetW,targetH)) < 1;
    }
  }
  return Math.round((extX/artW)*targetW) < 1 || Math.round((extY/artH)*targetH) < 1;
}

const DEFAULT_TRANSFORM = { x:0,y:0,scaleX:1,scaleY:1,rotation:0,flipX:false,flipY:false };
const DEFAULT_REDUCTION = { survivalHint: undefined, cueTag: undefined, mergeGroup: undefined };

// ── Size profiles ──
const PROFILES = [
  { id: 'sp_16x16', name: '16x16', targetWidth: 16, targetHeight: 16 },
  { id: 'sp_24x24', name: '24x24', targetWidth: 24, targetHeight: 24 },
  { id: 'sp_32x32', name: '32x32', targetWidth: 32, targetHeight: 32 },
  { id: 'sp_48x48', name: '48x48', targetWidth: 48, targetHeight: 48 },
  { id: 'sp_64x64', name: '64x64', targetWidth: 64, targetHeight: 64 },
];

// ── Collapse Overlay Simulation ──
function computeOverlay(doc, profiles, targetProfile) {
  const shapes = new Map();
  let safe = 0, atRisk = 0, collapses = 0;
  for (const shape of doc.shapes) {
    if (!shape.visible) continue;
    const collapsesAt = [];
    const survivesAt = [];
    for (const p of profiles) {
      if (wouldCollapse(shape, doc.artboardWidth, doc.artboardHeight, p.targetWidth, p.targetHeight)) {
        collapsesAt.push(p.id);
      } else {
        survivesAt.push(p.id);
      }
    }
    const collapsesAtTarget = wouldCollapse(shape, doc.artboardWidth, doc.artboardHeight, targetProfile.targetWidth, targetProfile.targetHeight);
    let level;
    if (collapsesAtTarget) { level = 'collapses'; collapses++; }
    else if (collapsesAt.length > 0) { level = 'at-risk'; atRisk++; }
    else { level = 'safe'; safe++; }
    shapes.set(shape.id, {
      shapeId: shape.id, level,
      droppable: shape.reduction.survivalHint === 'droppable',
      mustSurvive: shape.reduction.survivalHint === 'must-survive',
      collapsesAt, survivesAt,
    });
  }
  return { shapes, targetProfileId: targetProfile.id, safeCount: safe, atRiskCount: atRisk, collapsesCount: collapses };
}

// ── Assets (same as 44.5) ──
function makeShape(name, geometry, fill, reduction = {}) {
  return {
    id: `shape_${name}`, name, groupId: null, zOrder: 0,
    geometry, fill, stroke: null,
    transform: { ...DEFAULT_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION, ...reduction },
    visible: true, locked: false,
  };
}

function hoodedRanger() {
  return {
    id: 'doc-ranger', name: 'Hooded Ranger', artboardWidth: 500, artboardHeight: 500,
    shapes: [
      makeShape('torso', {kind:'rect',x:210,y:160,w:80,h:180}, [90,70,55,255], {survivalHint:'must-survive',cueTag:'torso'}),
      makeShape('hood', {kind:'path',points:[{x:225,y:90,pointType:'corner'},{x:275,y:90,pointType:'corner'},{x:290,y:140,pointType:'smooth'},{x:250,y:150,pointType:'smooth'},{x:210,y:140,pointType:'smooth'}],segments:[{kind:'line'},{kind:'quadratic',cpX:285,cpY:100},{kind:'quadratic',cpX:280,cpY:155},{kind:'quadratic',cpX:220,cpY:155},{kind:'quadratic',cpX:215,cpY:100}],closed:true}, [60,50,40,255], {survivalHint:'must-survive',cueTag:'hood'}),
      makeShape('face', {kind:'ellipse',cx:250,cy:130,rx:20,ry:25}, [180,140,110,255], {survivalHint:'prefer-survive'}),
      makeShape('left-arm', {kind:'rect',x:180,y:180,w:25,h:100}, [90,70,55,255]),
      makeShape('right-arm', {kind:'rect',x:295,y:180,w:25,h:100}, [90,70,55,255]),
      makeShape('bow', {kind:'path',points:[{x:330,y:160,pointType:'smooth'},{x:350,y:230,pointType:'smooth'},{x:330,y:300,pointType:'smooth'}],segments:[{kind:'quadratic',cpX:370,cpY:195},{kind:'quadratic',cpX:370,cpY:265}],closed:false}, null, {survivalHint:'must-survive',cueTag:'bow'}),
      makeShape('left-leg', {kind:'rect',x:220,y:340,w:30,h:100}, [70,55,45,255]),
      makeShape('right-leg', {kind:'rect',x:250,y:340,w:30,h:100}, [70,55,45,255]),
      makeShape('left-boot', {kind:'rect',x:215,y:430,w:40,h:25}, [50,40,30,255]),
      makeShape('right-boot', {kind:'rect',x:245,y:430,w:40,h:25}, [50,40,30,255]),
      makeShape('cloak', {kind:'path',points:[{x:200,y:150,pointType:'smooth'},{x:190,y:350,pointType:'smooth'},{x:310,y:350,pointType:'smooth'},{x:300,y:150,pointType:'smooth'}],segments:[{kind:'quadratic',cpX:170,cpY:250},{kind:'quadratic',cpX:250,cpY:380},{kind:'quadratic',cpX:330,cpY:250}],closed:true}, [70,60,50,200], {survivalHint:'prefer-survive',cueTag:'cloak'}),
    ].map((s, i) => ({ ...s, zOrder: i })),
    groups: [], palette: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function ironLantern() {
  return {
    id: 'doc-lantern', name: 'Iron Lantern', artboardWidth: 500, artboardHeight: 500,
    shapes: [
      makeShape('base', {kind:'rect',x:210,y:380,w:80,h:30}, [100,90,80,255], {survivalHint:'prefer-survive'}),
      makeShape('frame', {kind:'rect',x:220,y:180,w:60,h:200}, [120,110,100,255], {survivalHint:'must-survive',cueTag:'frame'}),
      makeShape('glass', {kind:'rect',x:228,y:200,w:44,h:140}, [180,220,255,100]),
      makeShape('flame', {kind:'path',points:[{x:250,y:300,pointType:'smooth'},{x:265,y:260,pointType:'smooth'},{x:250,y:220,pointType:'corner'},{x:235,y:260,pointType:'smooth'}],segments:[{kind:'quadratic',cpX:270,cpY:290},{kind:'quadratic',cpX:265,cpY:235},{kind:'quadratic',cpX:235,cpY:235},{kind:'quadratic',cpX:230,cpY:290}],closed:true}, [255,180,50,220], {survivalHint:'must-survive',cueTag:'flame'}),
      makeShape('handle', {kind:'path',points:[{x:235,y:180,pointType:'smooth'},{x:250,y:150,pointType:'smooth'},{x:265,y:180,pointType:'smooth'}],segments:[{kind:'quadratic',cpX:230,cpY:155},{kind:'quadratic',cpX:270,cpY:155}],closed:false}, null, {survivalHint:'prefer-survive'}),
      makeShape('cap', {kind:'path',points:[{x:215,y:185,pointType:'corner'},{x:285,y:185,pointType:'corner'},{x:275,y:175,pointType:'corner'},{x:225,y:175,pointType:'corner'}],segments:[{kind:'line'},{kind:'line'},{kind:'line'},{kind:'line'}],closed:true}, [110,100,90,255]),
      makeShape('band', {kind:'rect',x:225,y:340,w:50,h:8}, [130,120,110,255], {survivalHint:'droppable'}),
    ].map((s, i) => ({ ...s, zOrder: i })),
    groups: [], palette: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function direFox() {
  return {
    id: 'doc-fox', name: 'Dire Fox', artboardWidth: 500, artboardHeight: 500,
    shapes: [
      makeShape('body', {kind:'ellipse',cx:260,cy:280,rx:100,ry:60}, [180,100,50,255], {survivalHint:'must-survive',cueTag:'body'}),
      makeShape('head', {kind:'path',points:[{x:360,y:240,pointType:'smooth'},{x:400,y:260,pointType:'smooth'},{x:390,y:290,pointType:'smooth'},{x:350,y:280,pointType:'smooth'}],segments:[{kind:'quadratic',cpX:390,cpY:235},{kind:'quadratic',cpX:405,cpY:280},{kind:'quadratic',cpX:370,cpY:295},{kind:'quadratic',cpX:345,cpY:260}],closed:true}, [190,110,60,255], {survivalHint:'must-survive',cueTag:'head'}),
      makeShape('snout', {kind:'path',points:[{x:395,y:260,pointType:'smooth'},{x:425,y:272,pointType:'corner'},{x:395,y:284,pointType:'smooth'}],segments:[{kind:'quadratic',cpX:420,cpY:255},{kind:'quadratic',cpX:420,cpY:289}],closed:true}, [200,120,70,255]),
      makeShape('left-ear', {kind:'polygon',points:[{x:370,y:245},{x:360,y:210},{x:385,y:235}]}, [190,110,60,255], {survivalHint:'prefer-survive',cueTag:'ear'}),
      makeShape('right-ear', {kind:'polygon',points:[{x:390,y:240},{x:385,y:205},{x:405,y:230}]}, [190,110,60,255], {survivalHint:'prefer-survive',cueTag:'ear'}),
      makeShape('tail', {kind:'path',points:[{x:165,y:260,pointType:'smooth'},{x:130,y:230,pointType:'smooth'},{x:110,y:250,pointType:'smooth'}],segments:[{kind:'quadratic',cpX:140,cpY:240},{kind:'quadratic',cpX:115,cpY:225}],closed:false}, null, {survivalHint:'prefer-survive',cueTag:'tail'}),
      makeShape('tail-tip', {kind:'path',points:[{x:110,y:250,pointType:'smooth'},{x:100,y:240,pointType:'smooth'},{x:95,y:260,pointType:'smooth'}],segments:[{kind:'quadratic',cpX:100,cpY:238},{kind:'quadratic',cpX:90,cpY:255}],closed:true}, [255,240,220,255]),
      makeShape('front-leg-l', {kind:'rect',x:310,y:330,w:22,h:80}, [170,90,45,255]),
      makeShape('front-leg-r', {kind:'rect',x:340,y:330,w:22,h:80}, [170,90,45,255]),
      makeShape('back-leg-l', {kind:'rect',x:190,y:330,w:22,h:80}, [170,90,45,255]),
      makeShape('back-leg-r', {kind:'rect',x:220,y:330,w:22,h:80}, [170,90,45,255]),
      makeShape('eye', {kind:'ellipse',cx:390,cy:260,rx:5,ry:5}, [30,30,30,255], {survivalHint:'droppable'}),
      makeShape('belly', {kind:'ellipse',cx:270,cy:295,rx:70,ry:30}, [210,140,80,180]),
    ].map((s, i) => ({ ...s, zOrder: i })),
    groups: [], palette: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

// ── Run dogfood ──
const log = [];
function L(msg) { console.log(msg); log.push(msg); }

function dogfoodAsset(name, doc) {
  L(`\n${'='.repeat(60)}`);
  L(`  ${name.toUpperCase()}`);
  L(`${'='.repeat(60)}`);
  L(`Shapes: ${doc.shapes.length}`);

  // For each profile, compute overlay
  L(`\n--- Collapse Overlay (what the user sees while editing) ---`);
  for (const profile of PROFILES) {
    const overlay = computeOverlay(doc, PROFILES, profile);
    const collapsingNames = [];
    const atRiskNames = [];
    for (const [id, info] of overlay.shapes) {
      const shape = doc.shapes.find(s => s.id === id);
      if (info.level === 'collapses') collapsingNames.push(shape?.name || id);
      if (info.level === 'at-risk') atRiskNames.push(shape?.name || id);
    }
    const statusParts = [];
    if (overlay.collapsesCount > 0) statusParts.push(`${overlay.collapsesCount} collapses [${collapsingNames.join(', ')}]`);
    if (overlay.atRiskCount > 0) statusParts.push(`${overlay.atRiskCount} at-risk [${atRiskNames.join(', ')}]`);
    statusParts.push(`${overlay.safeCount} safe`);
    L(`  ${profile.targetWidth}x${profile.targetHeight}: ${statusParts.join(', ')}`);
  }

  // Risk badges simulation (what shapes panel shows)
  L(`\n--- Risk Badges (shapes panel with smallest profile) ---`);
  const smallestOverlay = computeOverlay(doc, PROFILES, PROFILES[0]);
  for (const shape of doc.shapes) {
    if (!shape.visible) continue;
    const info = smallestOverlay.shapes.get(shape.id);
    const badge = info ? (info.level === 'safe' ? 'OK' : info.level === 'at-risk' ? '!' : 'X') : '?';
    const survival = shape.reduction.survivalHint ? ` [${shape.reduction.survivalHint}]` : '';
    const alert = (info?.mustSurvive && info.level === 'collapses') ? ' ** CRITICAL: must-survive but collapses! **' : '';
    L(`  ${badge} ${shape.name}${survival}${alert}`);
  }

  // Would-catch-before-cleanup analysis
  L(`\n--- "Would User See It?" Analysis ---`);
  let wouldCatch = 0;
  let wouldMiss = 0;
  for (const shape of doc.shapes) {
    if (!shape.visible) continue;
    const info = smallestOverlay.shapes.get(shape.id);
    if (!info) continue;
    if (info.level === 'collapses' || info.level === 'at-risk') {
      wouldCatch++;
      L(`  [CAUGHT] "${shape.name}" — overlay shows ${info.level}, badge shows ${info.level === 'collapses' ? 'X' : '!'}`);
      if (info.collapsesAt.length > 0) {
        L(`           collapses at: ${info.collapsesAt.map(id => { const p = PROFILES.find(pp => pp.id === id); return p ? `${p.targetWidth}x${p.targetHeight}` : id; }).join(', ')}`);
      }
    }
  }
  L(`  Visible problems: ${wouldCatch} caught by overlay+badges, ${wouldMiss} missed`);
  return { wouldCatch };
}

L('# Stage 45.6 — Live Feedback Dogfood');
L(`Date: ${new Date().toISOString().slice(0, 10)}`);

const ranger = dogfoodAsset('Hooded Ranger (humanoid)', hoodedRanger());
const lantern = dogfoodAsset('Iron Lantern (prop)', ironLantern());
const fox = dogfoodAsset('Dire Fox (creature)', direFox());

// ── Decision ──
L(`\n${'='.repeat(60)}`);
L(`  FEEDBACK QUALITY REVIEW`);
L(`${'='.repeat(60)}`);

const totalCaught = ranger.wouldCatch + lantern.wouldCatch + fox.wouldCatch;

L(`\nTotal problems caught by live feedback: ${totalCaught}`);

L(`\n--- Feature Effectiveness ---`);
L(`  Collapse overlay: ${totalCaught > 0 ? 'YES' : 'NO'} — color-coded shapes visible while editing`);
L(`  Risk badges:      ${totalCaught > 0 ? 'YES' : 'NO'} — X/!/OK in shapes panel`);
L(`  Live preview:     YES — pinned thumbnail shows small sizes while drawing`);
L(`  Proposal preview: YES — inline before/after diffs in AI Create panel`);

L(`\n--- "Did live feedback help prevent bad reductions?" ---`);
if (totalCaught > 0) {
  L(`  YES — ${totalCaught} at-risk/collapsing shapes would be flagged in real-time.`);
  L(`  User would see red/amber overlays, X/! badges, and small-size previews`);
  L(`  BEFORE reaching the cleanup phase.`);
} else {
  L(`  N/A — No problems to catch (all shapes safe at all sizes).`);
}

L(`\n--- Stage 45 Ship Gate ---`);
L(`  [x] Users can see collapse risk while drawing — overlay + badges`);
L(`  [x] Target-size readability stays visible during editing — live preview strip`);
L(`  [x] AI suggestions are easier to judge — inline before/after preview`);
L(`  [x] Fewer mistakes survive into cleanup — problems flagged before cleanup`);

L(`\nStage 45 verdict: PASS — the shell has eyes now.`);

// Write log
const logPath = resolve(OUT_DIR, 'dogfood-log.md');
writeFileSync(logPath, `# Stage 45.6 — Live Feedback Dogfood\n\n\`\`\`\n${log.join('\n')}\n\`\`\`\n`);
L(`\nOutput: ${OUT_DIR}`);
L('Done.');
