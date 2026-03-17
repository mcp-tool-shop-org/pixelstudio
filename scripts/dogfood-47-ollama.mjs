#!/usr/bin/env node
/**
 * Stage 47.4 — Dogfood: Ollama generates sprites
 *
 * Ask qwen2.5:14b to generate vector shapes for:
 * 1. Shadow Monk (hooded figure with staff)
 * 2. Magic Scroll (rolled parchment with wax seal)
 * 3. Flame Drake (winged dragon breathing fire)
 *
 * Then rasterize, compare to hand-coded Stage 46 versions,
 * and log quality metrics.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastPngPath = resolve(__dirname, '..', 'packages', 'mcp-sprite-server', 'node_modules', 'fast-png', 'lib', 'index.js');
const { encode } = await import(`file:///${fastPngPath.replace(/\\/g, '/')}`);

const OUT_DIR = resolve(__dirname, '..', 'docs', 'showcase', 'stage47-ollama');
mkdirSync(OUT_DIR, { recursive: true });

const OLLAMA_URL = 'http://localhost:11434';
const TEXT_MODEL = 'qwen2.5:14b';
const SIZES = [16, 24, 32, 48, 64];

// ── Rasterizer (minimal port) ──
function createBuffer(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
function compositePixel(buf,x,y,c){if(x<0||x>=buf.width||y<0||y>=buf.height||c[3]===0)return;const i=(y*buf.width+x)*4;if(c[3]===255||buf.data[i+3]===0){buf.data[i]=c[0];buf.data[i+1]=c[1];buf.data[i+2]=c[2];buf.data[i+3]=c[3];return;}const sa=c[3]/255,da=buf.data[i+3]/255,outA=sa+da*(1-sa);buf.data[i]=Math.round((c[0]*sa+buf.data[i]*da*(1-sa))/outA);buf.data[i+1]=Math.round((c[1]*sa+buf.data[i+1]*da*(1-sa))/outA);buf.data[i+2]=Math.round((c[2]*sa+buf.data[i+2]*da*(1-sa))/outA);buf.data[i+3]=Math.round(outA*255);}
function toTarget(v,artS,tgtS){return Math.round((v/artS)*tgtS);}
function scanFill(buf,pts,c){if(pts.length<3)return;const n=pts.length;let minY=Infinity,maxY=-Infinity;for(const p of pts){if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;}minY=Math.max(0,minY);maxY=Math.min(buf.height-1,maxY);for(let y=minY;y<=maxY;y++){const xs=[];for(let i=0;i<n;i++){const j=(i+1)%n;const yi=pts[i].y,yj=pts[j].y;if((yi<=y&&yj>y)||(yj<=y&&yi>y)){xs.push(Math.round(pts[i].x+(y-yi)/(yj-yi)*(pts[j].x-pts[i].x)));}}xs.sort((a,b)=>a-b);for(let k=0;k<xs.length-1;k+=2){const xS=Math.max(0,xs[k]),xE=Math.min(buf.width-1,xs[k+1]);for(let x=xS;x<=xE;x++)compositePixel(buf,x,y,c);}}}

function rasterizeLLMShapes(shapes, artW, artH, tw, th) {
  const buf = createBuffer(tw, th);
  for (const s of shapes) {
    const fill = s.fill;
    if (!fill) continue;
    switch (s.type) {
      case 'rect': {
        const x0 = toTarget(s.x, artW, tw);
        const y0 = toTarget(s.y, artH, th);
        const x1 = Math.max(x0+1, toTarget(s.x+s.w, artW, tw));
        const y1 = Math.max(y0+1, toTarget(s.y+s.h, artH, th));
        for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)compositePixel(buf,x,y,fill);
        break;
      }
      case 'ellipse': {
        const cx = toTarget(s.cx, artW, tw);
        const cy = toTarget(s.cy, artH, th);
        const rx = Math.max(1, Math.round(Math.abs(s.rx/artW)*tw));
        const ry = Math.max(1, Math.round(Math.abs(s.ry/artH)*th));
        for(let dy=-ry;dy<=ry;dy++){const xs=Math.round(rx*Math.sqrt(Math.max(0,1-(dy*dy)/(ry*ry))));for(let dx=-xs;dx<=xs;dx++)compositePixel(buf,cx+dx,cy+dy,fill);}
        break;
      }
      case 'polygon': {
        if (!s.points || s.points.length < 3) break;
        const sp = s.points.map(p=>({x:toTarget(p.x,artW,tw),y:toTarget(p.y,artH,th)}));
        scanFill(buf, sp, fill);
        break;
      }
      case 'path': {
        if (!s.points || s.points.length < 3 || !s.closed) break;
        const sp = s.points.map(p=>({x:toTarget(p.x,artW,tw),y:toTarget(p.y,artH,th)}));
        scanFill(buf, sp, fill);
        break;
      }
    }
  }
  return buf;
}

function countFilled(buf) {
  let count = 0;
  for (let i = 3; i < buf.data.length; i += 4) {
    if (buf.data[i] > 0) count++;
  }
  return count;
}

function upscale(buf, factor) {
  const w2 = buf.width * factor;
  const h2 = buf.height * factor;
  const out = createBuffer(w2, h2);
  for (let y = 0; y < buf.height; y++) {
    for (let x = 0; x < buf.width; x++) {
      const i = (y * buf.width + x) * 4;
      const c = [buf.data[i], buf.data[i+1], buf.data[i+2], buf.data[i+3]];
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const j = ((y*factor+dy)*w2 + (x*factor+dx))*4;
          out.data[j] = c[0]; out.data[j+1] = c[1]; out.data[j+2] = c[2]; out.data[j+3] = c[3];
        }
      }
    }
  }
  return out;
}

function savePng(buf, path) {
  const png = encode({ width: buf.width, height: buf.height, data: buf.data, channels: 4, depth: 8 });
  writeFileSync(path, Buffer.from(png));
}

// ── Ollama call ──
async function callOllama(prompt) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: TEXT_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.7, num_predict: 4096 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.response?.trim() ?? '';
}

function extractJson(raw) {
  try { return JSON.parse(raw); } catch {}
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fence) try { return JSON.parse(fence[1].trim()); } catch {}
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last > first) try { return JSON.parse(raw.slice(first, last + 1)); } catch {}
  return null;
}

function buildPrompt(description, artW, artH, sizes) {
  return `You are a 2D sprite artist designing vector shapes for a pixel art character.

TASK: Design "${description}" as vector shapes on a ${artW}x${artH} artboard.

CRITICAL DESIGN RULES:
- This will be rendered as pixel art at these tiny sizes: ${sizes.join(', ')} pixels
- Every shape must be BIG ENOUGH to survive reduction to ${Math.min(...sizes)}x${Math.min(...sizes)}
- Minimum dimension for any shape: ${Math.round(artW * 0.04)}px (anything smaller vanishes)
- Use HIGH CONTRAST between adjacent shapes — dark next to light, warm next to cool
- SEPARATE FORMS clearly — arms away from torso, head distinct from body
- Silhouette must read instantly — a stranger should recognize what this is from the outline alone
- Use 10-20 shapes total. More than 20 is too complex.
- Center the character in the artboard with padding on all sides

SHAPE TYPES AVAILABLE:
- rect: { type: "rect", x, y, w, h } — rectangles
- ellipse: { type: "ellipse", cx, cy, rx, ry } — ovals
- polygon: { type: "polygon", points: [{x,y}...], closed: true } — closed shapes (3+ points)

FILL FORMAT: [R, G, B, A] where each is 0-255

GOOD SPRITE DESIGN:
- Wide shoulders/hips for humanoids (breaks the "rectangle" read)
- Exaggerated key features (big head, big weapon, distinctive silhouette)
- Color contrast between body parts (dark body, light face/hands, colored accessories)
- Negative space between limbs and body
- Identity cues (hood, wings, horns, weapon) must be LARGE, not tiny details

OUTPUT FORMAT: Return ONLY valid JSON, no markdown, no explanation outside the JSON.
{
  "reasoning": "Brief explanation of design choices",
  "shapes": [
    {
      "name": "shape-name",
      "type": "rect|ellipse|polygon",
      "fill": [R, G, B, A],
      "mustSurvive": true/false,
      ...type-specific fields
    }
  ]
}`;
}

// ── Main ──
const assets = [
  {
    name: 'Shadow Monk',
    slug: 'shadow-monk-ai',
    description: 'A hooded monk holding a tall staff. Wide robe, dark hood covering the face, visible belt/sash, glowing staff orb on top. The silhouette should read as "robed wizard/monk with staff" even at 16x16.',
  },
  {
    name: 'Magic Scroll',
    slug: 'magic-scroll-ai',
    description: 'A rolled parchment scroll with a bright red wax seal hanging from ribbons. Thick rounded scroll body, visible paper texture, decorative seal. Should read as "scroll" even at 16x16.',
  },
  {
    name: 'Flame Drake',
    slug: 'flame-drake-ai',
    description: 'A fire-breathing dragon with spread wings, long neck, thick body, four legs, curved tail with spade tip. Fire/flame coming from the mouth. Wings spread wide. Should read as "dragon" even at 16x16.',
  },
];

console.log('# Stage 47 — Ollama AI Generation Dogfood');
console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
console.log(`Model: ${TEXT_MODEL}\n`);

const results = [];

for (const asset of assets) {
  console.log(`${'='.repeat(60)}`);
  console.log(`  ${asset.name.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);

  const prompt = buildPrompt(asset.description, 500, 500, SIZES);
  console.log(`Calling Ollama (${TEXT_MODEL})...`);
  const startMs = Date.now();

  let rawResponse;
  try {
    rawResponse = await callOllama(prompt);
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    results.push({ name: asset.name, ok: false, error: err.message });
    continue;
  }

  const elapsedMs = Date.now() - startMs;
  console.log(`Response in ${elapsedMs}ms`);

  const parsed = extractJson(rawResponse);
  if (!parsed || !parsed.shapes) {
    console.log('ERROR: Could not parse JSON from response');
    console.log(`Raw response (first 500 chars): ${rawResponse.slice(0, 500)}`);
    results.push({ name: asset.name, ok: false, error: 'JSON parse failed' });
    continue;
  }

  const shapes = parsed.shapes.filter(s => {
    if (!s.name || !s.type || !s.fill || s.fill.length !== 4) return false;
    if (s.type === 'rect' && (s.w < 2 || s.h < 2)) return false;
    if (s.type === 'ellipse' && (s.rx < 2 || s.ry < 2)) return false;
    if (s.type === 'polygon' && (!s.points || s.points.length < 3)) return false;
    return true;
  });

  console.log(`Shapes: ${shapes.length} valid (${parsed.shapes.length} raw)`);
  console.log(`Reasoning: ${parsed.reasoning}`);
  console.log();

  // Rasterize at each size
  console.log('--- Rasterization ---');
  const fills = {};
  for (const size of SIZES) {
    const buf = rasterizeLLMShapes(shapes, 500, 500, size, size);
    const filled = countFilled(buf);
    const pct = ((filled / (size * size)) * 100).toFixed(1);
    fills[size] = pct;
    console.log(`  ${size}x${size}: ${pct}% fill (${filled}/${size*size} pixels)`);

    // Save upscaled PNG
    const scale = Math.ceil(256 / size);
    const up = upscale(buf, scale);
    savePng(up, resolve(OUT_DIR, `${asset.slug}---${size}x${size}.png`));
  }

  // Shape list
  console.log('\n--- Shapes ---');
  for (const s of shapes) {
    const dims = s.type === 'rect' ? `${s.w}x${s.h}` :
                 s.type === 'ellipse' ? `rx${s.rx} ry${s.ry}` :
                 `${s.points?.length}pts`;
    console.log(`  ${s.name} (${s.type}, ${dims}) fill=[${s.fill.join(',')}]${s.mustSurvive ? ' MUST-SURVIVE' : ''}`);
  }

  results.push({
    name: asset.name,
    ok: true,
    shapeCount: shapes.length,
    reasoning: parsed.reasoning,
    fills,
    elapsedMs,
  });

  console.log();
}

// ── Summary ──
console.log(`${'='.repeat(60)}`);
console.log('  SUMMARY');
console.log(`${'='.repeat(60)}`);

for (const r of results) {
  if (r.ok) {
    console.log(`${r.name}: ${r.shapeCount} shapes, ${r.fills[16]}% fill at 16x16, ${r.elapsedMs}ms`);
  } else {
    console.log(`${r.name}: FAILED — ${r.error}`);
  }
}

// Save log
const logPath = resolve(OUT_DIR, 'dogfood-log.md');
const logLines = [`# Stage 47 — Ollama AI Generation Dogfood\n\nModel: ${TEXT_MODEL}\nDate: ${new Date().toISOString().split('T')[0]}\n`];
for (const r of results) {
  if (r.ok) {
    logLines.push(`## ${r.name}\n- Shapes: ${r.shapeCount}\n- Reasoning: ${r.reasoning}\n- Fill at 16x16: ${r.fills[16]}%\n- Generation time: ${r.elapsedMs}ms\n`);
  } else {
    logLines.push(`## ${r.name}\n- FAILED: ${r.error}\n`);
  }
}
writeFileSync(logPath, logLines.join('\n'));

console.log(`\nOutput: ${OUT_DIR}`);
console.log('Done.');
