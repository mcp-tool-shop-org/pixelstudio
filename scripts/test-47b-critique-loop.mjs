#!/usr/bin/env node
/**
 * Test 47B — Full critique loop on Shadow Monk.
 * Generate → rasterize → llava critique → refine → repeat.
 * Compare round 0 (initial) vs round 2 (after 2 critiques).
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT = resolve(__dirname, '..', 'docs', 'showcase', 'stage47b-critique');
mkdirSync(OUT, { recursive: true });

const OLLAMA = 'http://localhost:11434';
const TEXT_MODEL = 'qwen2.5:14b';
const VISION_MODEL = 'llava:13b';

// ── Minimal rasterizer ──
function createBuffer(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
function px(buf,x,y,c){if(x<0||x>=buf.width||y<0||y>=buf.height||c[3]===0)return;const i=(y*buf.width+x)*4;buf.data[i]=c[0];buf.data[i+1]=c[1];buf.data[i+2]=c[2];buf.data[i+3]=c[3];}
function tt(v,art,tgt){return Math.round((v/art)*tgt);}
function scanFill(buf,pts,c){if(pts.length<3)return;let minY=1e9,maxY=-1e9;for(const p of pts){if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;}minY=Math.max(0,minY);maxY=Math.min(buf.height-1,maxY);for(let y=minY;y<=maxY;y++){const xs=[];for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;const yi=pts[i].y,yj=pts[j].y;if((yi<=y&&yj>y)||(yj<=y&&yi>y))xs.push(Math.round(pts[i].x+(y-yi)/(yj-yi)*(pts[j].x-pts[i].x)));}xs.sort((a,b)=>a-b);for(let k=0;k<xs.length-1;k+=2){for(let x=Math.max(0,xs[k]);x<=Math.min(buf.width-1,xs[k+1]);x++)px(buf,x,y,c);}}}

function rasterize(shapes, aw, ah, tw, th) {
  const buf = createBuffer(tw, th);
  for (const s of shapes) {
    const f = s.fill; if (!f) continue;
    switch (s.type) {
      case 'rect': { const x0=tt(s.x,aw,tw),y0=tt(s.y,ah,th),x1=Math.max(x0+1,tt(s.x+s.w,aw,tw)),y1=Math.max(y0+1,tt(s.y+s.h,ah,th));for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)px(buf,x,y,f);break;}
      case 'ellipse': { const cx=tt(s.cx,aw,tw),cy=tt(s.cy,ah,th),rx=Math.max(1,Math.round(Math.abs(s.rx/aw)*tw)),ry=Math.max(1,Math.round(Math.abs(s.ry/ah)*th));for(let dy=-ry;dy<=ry;dy++){const xs=Math.round(rx*Math.sqrt(Math.max(0,1-(dy*dy)/(ry*ry))));for(let dx=-xs;dx<=xs;dx++)px(buf,cx+dx,cy+dy,f);}break;}
      case 'polygon': { if(!s.points||s.points.length<3)break;scanFill(buf,s.points.map(p=>({x:tt(p.x,aw,tw),y:tt(p.y,ah,th)})),f);break;}
    }
  }
  return buf;
}
function upscale(buf,f){const o=createBuffer(buf.width*f,buf.height*f);for(let y=0;y<buf.height;y++)for(let x=0;x<buf.width;x++){const i=(y*buf.width+x)*4;for(let dy=0;dy<f;dy++)for(let dx=0;dx<f;dx++){const j=((y*f+dy)*(buf.width*f)+(x*f+dx))*4;o.data[j]=buf.data[i];o.data[j+1]=buf.data[i+1];o.data[j+2]=buf.data[i+2];o.data[j+3]=buf.data[i+3];}}return o;}
function savePng(buf,path){writeFileSync(path,Buffer.from(encode({width:buf.width,height:buf.height,data:buf.data,channels:4,depth:8})));}
function fillPct(buf){let c=0;for(let i=3;i<buf.data.length;i+=4)if(buf.data[i]>0)c++;return(c/(buf.width*buf.height)*100).toFixed(1);}

// ── PNG encoder for sending to llava ──
function bufToPngBase64(buf) {
  const png = encode({width:buf.width,height:buf.height,data:buf.data,channels:4,depth:8});
  return Buffer.from(png).toString('base64');
}

// ── Ollama calls ──
async function callText(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({model:TEXT_MODEL,prompt,stream:false,options:{temperature:0.7,num_predict:4096}}),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  return (await res.json()).response?.trim() ?? '';
}

async function callVision(prompt, imgBase64) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({model:VISION_MODEL,prompt,images:[imgBase64],stream:false}),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  return (await res.json()).response?.trim() ?? '';
}

function stripJsonComments(s) {
  // Remove // comments but not inside strings
  return s.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (m, str) => str || '');
}

function extractJson(raw) {
  const cleaned = stripJsonComments(raw);
  try { return JSON.parse(cleaned); } catch {}
  const fence = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fence) try { return JSON.parse(fence[1].trim()); } catch {}
  const f = cleaned.indexOf('{'), l = cleaned.lastIndexOf('}');
  if (f!==-1&&l>f) try { return JSON.parse(cleaned.slice(f,l+1)); } catch {}
  return null;
}

// ── Prompts ──
// (Using the 47A improved prompt inline)
const palette = {primary:[40,30,60,255],secondary:[70,50,90,255],accent:[220,180,50,255],skin:[200,160,130,255],shadow:[20,15,30,255],highlight:[100,200,220,255]};

function genPrompt(desc, existing) {
  const pfmt = c => `[${c.join(',')}]`;
  return `You are a 2D pixel art sprite designer. You output vector shapes as JSON.

TASK: Design "${desc}" on a 500x500 artboard. Must read at 16x16.

SPATIAL LAYOUT: Head y=25-150, Shoulders y=125-225, Torso y=200-325, Legs y=350-475. Center x=250, span x=125-375.

PROPORTIONS: Head 75-100px tall. Shoulders 125-175px wide. Body 100-140px. Arms have 15-30px gap from body. Legs have 10-20px gap between them.

NO OVERLAP: Different body parts must NOT overlap. Arms NEXT TO body, not on top. Head ABOVE body.

PALETTE: Primary ${pfmt(palette.primary)}, Secondary ${pfmt(palette.secondary)}, Accent ${pfmt(palette.accent)}, Skin ${pfmt(palette.skin)}, Shadow ${pfmt(palette.shadow)}, Highlight ${pfmt(palette.highlight)}

SHAPES: rect {type,x,y,w,h}, ellipse {type,cx,cy,rx,ry}, polygon {type,points:[{x,y}...],closed:true}
Min dimension: 30px. Fill: [R,G,B,255].

${existing ? `CURRENT SHAPES TO IMPROVE:\n${JSON.stringify(existing,null,2)}\n` : ''}
RETURN ONLY JSON: {"reasoning":"...","shapes":[...]}`;
}

const critiquePrompt = `You are a pixel art critic. This is a small sprite upscaled for visibility.
1. IDENTITY: What does this look like at 32x32?
2. SILHOUETTE: Distinctive or blob?
3. FORM SEPARATION: Which parts merge?
4. COLOR: Enough contrast?
5. FIXES: 3-5 specific changes.
RETURN ONLY JSON: {"critique":"...","suggestions":["...","...","..."]}`;

function refinePrompt(desc, shapes, critique, suggestions) {
  return `Refine this sprite based on critique.
DESIGN: "${desc}" on 500x500. Renders at 16,32,64px.
CURRENT SHAPES: ${JSON.stringify(shapes,null,2)}
CRITIQUE: ${critique}
FIXES: ${suggestions.map((s,i)=>`${i+1}. ${s}`).join('\n')}
Rules: Don't shrink. Only enlarge/move/recolor. Min dimension 30px.
Return COMPLETE shape list. ONLY JSON: {"reasoning":"...","shapes":[...]}`;
}

// ── Main ──
const DESC = 'A hooded monk holding a tall staff. Wide robe, dark hood covering the face, visible belt/sash, glowing staff orb on top.';

console.log('# Stage 47B — Critique Loop Dogfood');
console.log(`Text: ${TEXT_MODEL}, Vision: ${VISION_MODEL}\n`);

// ROUND 0: Generate
console.log('=== ROUND 0: Initial Generation ===');
let startMs = Date.now();
const raw0 = await callText(genPrompt(DESC));
const parsed0 = extractJson(raw0);
if (!parsed0?.shapes) { console.log('FAILED to generate'); console.log(raw0.slice(0,500)); process.exit(1); }
let shapes = parsed0.shapes
  .map((s, i) => ({ ...s, name: s.name || `shape-${i}` }))
  .filter(s => s.type && s.fill?.length === 4);
console.log(`Generated ${shapes.length} shapes in ${Date.now()-startMs}ms`);
console.log(`Reasoning: ${parsed0.reasoning}`);

// Save round 0
for (const sz of [16,32,64]) {
  const buf = rasterize(shapes, 500, 500, sz, sz);
  console.log(`  ${sz}x${sz}: ${fillPct(buf)}% fill`);
  savePng(upscale(buf, Math.ceil(256/sz)), resolve(OUT, `monk-r0---${sz}x${sz}.png`));
}

// ROUND 1: Critique + Refine
console.log('\n=== ROUND 1: Vision Critique ===');
const buf64 = rasterize(shapes, 500, 500, 64, 64);
const img64 = bufToPngBase64(upscale(buf64, 4)); // 256x256 for llava
startMs = Date.now();
const critiqueRaw1 = await callVision(critiquePrompt, img64);
const critique1 = extractJson(critiqueRaw1);
console.log(`Critique in ${Date.now()-startMs}ms`);
if (critique1) {
  console.log(`  Says: "${critique1.critique}"`);
  console.log(`  Suggestions: ${JSON.stringify(critique1.suggestions)}`);
} else {
  console.log(`  Raw: "${critiqueRaw1.slice(0,300)}"`);
}

if (critique1?.suggestions?.length > 0) {
  console.log('\n=== ROUND 1: Refine ===');
  startMs = Date.now();
  const refineRaw1 = await callText(refinePrompt(DESC, shapes, critique1.critique, critique1.suggestions));
  const refined1 = extractJson(refineRaw1);
  if (refined1?.shapes?.length > 0) {
    shapes = refined1.shapes.map((s,i)=>({...s,name:s.name||`shape-${i}`})).filter(s => s.type && s.fill?.length === 4);
    console.log(`Refined to ${shapes.length} shapes in ${Date.now()-startMs}ms`);
    console.log(`Reasoning: ${refined1.reasoning}`);
    for (const sz of [16,32,64]) {
      const buf = rasterize(shapes, 500, 500, sz, sz);
      console.log(`  ${sz}x${sz}: ${fillPct(buf)}% fill`);
      savePng(upscale(buf, Math.ceil(256/sz)), resolve(OUT, `monk-r1---${sz}x${sz}.png`));
    }
  } else {
    console.log('Refine failed, keeping round 0 shapes');
  }
}

// ROUND 2: Critique + Refine again
console.log('\n=== ROUND 2: Vision Critique ===');
const buf64r2 = rasterize(shapes, 500, 500, 64, 64);
const img64r2 = bufToPngBase64(upscale(buf64r2, 4));
startMs = Date.now();
const critiqueRaw2 = await callVision(critiquePrompt, img64r2);
const critique2 = extractJson(critiqueRaw2);
console.log(`Critique in ${Date.now()-startMs}ms`);
if (critique2) {
  console.log(`  Says: "${critique2.critique}"`);
  console.log(`  Suggestions: ${JSON.stringify(critique2.suggestions)}`);
} else {
  console.log(`  Raw: "${critiqueRaw2.slice(0,300)}"`);
}

if (critique2?.suggestions?.length > 0) {
  console.log('\n=== ROUND 2: Refine ===');
  startMs = Date.now();
  const refineRaw2 = await callText(refinePrompt(DESC, shapes, critique2.critique, critique2.suggestions));
  const refined2 = extractJson(refineRaw2);
  if (refined2?.shapes?.length > 0) {
    shapes = refined2.shapes.map((s,i)=>({...s,name:s.name||`shape-${i}`})).filter(s => s.type && s.fill?.length === 4);
    console.log(`Refined to ${shapes.length} shapes in ${Date.now()-startMs}ms`);
    console.log(`Reasoning: ${refined2.reasoning}`);
    for (const sz of [16,32,64]) {
      const buf = rasterize(shapes, 500, 500, sz, sz);
      console.log(`  ${sz}x${sz}: ${fillPct(buf)}% fill`);
      savePng(upscale(buf, Math.ceil(256/sz)), resolve(OUT, `monk-r2---${sz}x${sz}.png`));
    }
  } else {
    console.log('Refine failed, keeping round 1 shapes');
  }
}

console.log(`\nOutput: ${OUT}`);
console.log('Compare monk-r0 (initial) vs monk-r1 (after 1 critique) vs monk-r2 (after 2 critiques)');
